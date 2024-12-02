const express = require('express');
const mysql = require('mysql2');
const axios = require('axios');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();

// Middlewares
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));

app.use(express.json());


const db = mysql.createPool({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
});

db.getConnection((err) => {
    if (err) {
        console.error('Error conectando a la base de datos:', err);
        return;
    }
    console.log('Conectado a la base de datos MySQL');
});


function generateAccountNumber() {
    let accountNumber = '';
    for (let i = 0; i < 20; i++) {
        accountNumber += Math.floor(Math.random() * 10);
    }
    return accountNumber;
}


function checkAccountNumberExists(accountNumber) {
    return new Promise((resolve, reject) => {
        const query = 'SELECT COUNT(*) as count FROM accounts WHERE account_number = ?';
        db.query(query, [accountNumber], (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results[0].count > 0);
            }
        });
    });
}


async function generateUniqueAccountNumber() {
    let accountNumber;
    let exists;
    do {
        accountNumber = generateAccountNumber();
        exists = await checkAccountNumberExists(accountNumber);
    } while (exists);
    return accountNumber;
}

//registro nuevo usuario
app.post("/register", async (req, res) => {
    const { user_name, dni, user_password } = req.body;

    // Validaciones iniciales
    if (!user_name || !dni || !user_password) {
        return res.status(400).json({ message: "Por favor, completa todos los campos" });
    }

    if (dni.length > 10) {
        return res.status(400).json({ message: "El DNI no puede exceder 10 caracteres" });
    }

    let connection;

    try {
        
        connection = await new Promise((resolve, reject) => {
            db.getConnection((err, conn) => {
                if (err) return reject(err);
                resolve(conn);
            });
        });

      
        await new Promise((resolve, reject) => {
            connection.beginTransaction((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

       
        const hashedPassword = await bcrypt.hash(user_password, 10);
        const insertUserQuery = `
            INSERT INTO users (user_name, dni, user_password) 
            VALUES (?, ?, ?)
        `;
        const userResult = await new Promise((resolve, reject) => {
            connection.query(insertUserQuery, [user_name, dni, hashedPassword], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

        const userId = userResult.insertId;

      
        const accountNumber = await generateUniqueAccountNumber();

       
        const insertAccountQuery = `
            INSERT INTO accounts (user_id, balance, account_number, creation_date) 
            VALUES (?, ?, ?, NOW())
        `;
        const initialBalance = 0;
        await new Promise((resolve, reject) => {
            connection.query(insertAccountQuery, [userId, initialBalance, accountNumber], (err, result) => {
                if (err) return reject(err);
                resolve(result);
            });
        });

       
        await new Promise((resolve, reject) => {
            connection.commit((err) => {
                if (err) return reject(err);
                resolve();
            });
        });

        
        res.status(200).json({
            message: "Usuario y cuenta creados correctamente",
            userId: userId,
            accountNumber: accountNumber,
        });

    } catch (error) {
     
        if (connection) {
            await new Promise((resolve, reject) => {
                connection.rollback(() => resolve());
            });
        }

        console.error("Error durante el registro:", error);
        res.status(500).json({ message: "Error al registrar el usuario" });
    } finally {
     
        if (connection) {
            connection.release();
        }
    }
});

// Autenticación de usuario
app.post("/login", (req, res) => {
    const { user_name, user_password } = req.body;

    if (!user_name || !user_password) {
        return res.status(400).json({ message: 'Por favor, completa todos los campos' });
    }

    const query = `
        SELECT 
            u.*,
            a.id as account_id,
            a.account_number,
            a.balance 
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        WHERE u.user_name = ?
    `;

    db.query(query, [user_name], async (err, results) => {
        if (err) {
            console.error('Error en la consulta:', err);
            return res.status(500).json({ message: 'Error en el servidor' });
        }

        if (results.length === 0) {
            return res.status(400).json({ message: 'Usuario no encontrado' });
        }

        const user = results[0];

        try {
            const match = await bcrypt.compare(user_password, user.user_password);

            if (!match) {
                return res.status(400).json({ message: 'Contraseña incorrecta' });
            }

            const token = jwt.sign(
                {
                    userId: user.id,
                    user_name: user.user_name,
                    accountNumber: user.account_number,
                    accountId: user.account_id
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            res.status(200).json({
                message: 'Autenticado correctamente',
                token,
                user_name: user.user_name,
                accountNumber: user.account_number,
                account_id: user.account_id,
                balance: user.balance
            });
        } catch (error) {
            console.error('Error en la autenticación:', error);
            res.status(500).json({ message: 'Error en la autenticación' });
        }
    });
});

// Obtener transacciones

app.get('/transactions', (req, res) => {
    const token = req.headers['authorization'];

    if (!token) return res.status(403).json({ message: 'Token requerido' });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });

      
        const query = `
            SELECT t.*, 
                   u1.user_name as origin_user_name,
                   u2.user_name as target_user_name
            FROM transactions t
            LEFT JOIN accounts a1 ON t.origin_account = a1.id
            LEFT JOIN accounts a2 ON t.target_account = a2.id
            LEFT JOIN users u1 ON a1.user_id = u1.id
            LEFT JOIN users u2 ON a2.user_id = u2.id
            WHERE a1.user_id = ? OR a2.user_id = ?
            ORDER BY t.transaction_date DESC
        `;

        db.query(query, [decoded.userId, decoded.userId], (err, transactions) => {
            if (err) {
                console.error('Error al obtener transacciones:', err);
                return res.status(500).json({ error: 'Error al obtener transacciones' });
            }
            res.json(transactions);
        });
    });
});

// Obtener balance de la cuenta
app.get('/api/user/balance', (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const query = 'SELECT balance FROM accounts WHERE user_id = ?';
        db.query(query, [userId], (err, results) => {
            if (err) {
                console.error('Error en la consulta de balance:', err);
                return res.status(500).json({ message: 'Error al obtener balance' });
            }

            if (results.length > 0) {
                res.json({ balance: results[0].balance });
            } else {
                res.status(404).json({ message: 'Cuenta no encontrada' });
            }
        });
    } catch (error) {
        console.error('Error de autenticación:', error);
        return res.status(403).json({ message: 'Token inválido' });
    }
});

//obtener numero de cuenta
app.get('/api/user/accountnumber', (req, res) => {
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        const query = 'SELECT account_number FROM accounts WHERE user_id = ?';
        db.query(query, [userId], (err, results) => {
            if (err) {
                console.error('Error en la consulta de número de cuenta:', err);
                return res.status(500).json({ message: 'Error al obtener número de cuenta' });
            }

            if (results.length > 0) {
                res.json({ accountNumber: results[0].account_number });
            } else {
                res.status(404).json({ message: 'Cuenta no encontrada' });
            }
        });
    } catch (error) {
        console.error('Error de autenticación:', error);
        return res.status(403).json({ message: 'Token inválido' });
    }
});


// Endpoint para procesar la solicitud a OpenAI

app.post('/api/chat', async (req, res) => {
    const { messages } = req.body;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages,
                max_tokens: 100,
                temperature: 0.5
            },
            {
                headers: {
                    'Authorization': `Bearer ${process.env.API_OPENAI_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.json(response.data);
    } catch (error) {
        console.error('Error al comunicarse con OpenAI:', error);
        res.status(500).json({ error: 'Error al comunicarse con OpenAI' });
    }
});


// Endpoint para realizar depósito

app.post('/api/deposit', (req, res) => {
    const token = req.headers['authorization'];
    const { amount } = req.body;

    if (!token) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Por favor ingrese una cantidad válida mayor a cero'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        
        db.getConnection((err, connection) => {
            if (err) {
                console.error('Error al obtener conexión del pool:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error al procesar el depósito'
                });
            }

            connection.beginTransaction(err => {
                if (err) {
                    connection.release();
                    console.error('Error al iniciar la transacción:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Error al procesar el depósito'
                    });
                }

                const accountQuery = 'SELECT id, account_number, balance FROM accounts WHERE user_id = ?';
                connection.query(accountQuery, [userId], (err, accountResults) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error('Error al obtener la cuenta:', err);
                            res.status(500).json({
                                success: false,
                                message: 'Error al procesar el depósito'
                            });
                        });
                    }

                    if (accountResults.length === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({
                                success: false,
                                message: 'No se encontró una cuenta para este usuario'
                            });
                        });
                    }

                    const account = accountResults[0];
                    const newBalance = parseFloat(account.balance) + parseFloat(amount);

                    
                    const updateQuery = 'UPDATE accounts SET balance = ? WHERE id = ?';
                    connection.query(updateQuery, [newBalance, account.id], (err, updateResult) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error('Error al actualizar el balance:', err);
                                res.status(500).json({
                                    success: false,
                                    message: 'Error al procesar el depósito'
                                });
                            });
                        }

                      
                        const transactionQuery = `
                            INSERT INTO transactions 
                            (origin_account, target_account, amount, transaction_date) 
                            VALUES (?, ?, ?, NOW())
                        `;
                        connection.query(transactionQuery, [
                            null,
                            account.id,
                            amount
                        ], (err, transactionResult) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('Error al registrar la transacción:', err);
                                    res.status(500).json({
                                        success: false,
                                        message: 'Error al procesar el depósito'
                                    });
                                });
                            }

                     
                            connection.commit((err) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        console.error('Error al confirmar la transacción:', err);
                                        res.status(500).json({
                                            success: false,
                                            message: 'Error al procesar el depósito'
                                        });
                                    });
                                }

                                connection.release();
                                res.status(200).json({
                                    success: true,
                                    message: 'Depósito realizado con éxito',
                                    data: {
                                        accountNumber: account.account_number,
                                        amount: parseFloat(amount),
                                        newBalance: newBalance
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });

    } catch (error) {
        console.error('Error de autenticación:', error);
        return res.status(403).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

// Endpoint para realizar retiros

app.post('/api/withdrawal', (req, res) => {
    const token = req.headers['authorization'];
    const { amount } = req.body;

    if (!token) {
        return res.status(403).json({ message: 'Token requerido' });
    }

    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
        return res.status(400).json({
            success: false,
            message: 'Por favor ingrese una cantidad válida mayor a cero'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        // Obtener conexión del pool

        db.getConnection((err, connection) => {
            if (err) {
                console.error('Error al obtener conexión del pool:', err);
                return res.status(500).json({
                    success: false,
                    message: 'Error al procesar el retiro'
                });
            }

            connection.beginTransaction(err => {
                if (err) {
                    connection.release();
                    console.error('Error al iniciar la transacción:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Error al procesar el retiro'
                    });
                }

            
                const accountQuery = 'SELECT id, account_number, balance FROM accounts WHERE user_id = ?';
                connection.query(accountQuery, [userId], (err, accountResults) => {
                    if (err) {
                        return connection.rollback(() => {
                            connection.release();
                            console.error('Error al obtener la cuenta:', err);
                            res.status(500).json({
                                success: false,
                                message: 'Error al procesar el retiro'
                            });
                        });
                    }

                    if (accountResults.length === 0) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(404).json({
                                success: false,
                                message: 'No se encontró una cuenta para este usuario'
                            });
                        });
                    }

                    const account = accountResults[0];

                   
                    if (parseFloat(account.balance) < parseFloat(amount)) {
                        return connection.rollback(() => {
                            connection.release();
                            res.status(400).json({
                                success: false,
                                message: 'Saldo insuficiente para realizar el retiro'
                            });
                        });
                    }

                    const newBalance = parseFloat(account.balance) - parseFloat(amount);

                 
                    const updateQuery = 'UPDATE accounts SET balance = ? WHERE id = ?';
                    connection.query(updateQuery, [newBalance, account.id], (err, updateResult) => {
                        if (err) {
                            return connection.rollback(() => {
                                connection.release();
                                console.error('Error al actualizar el balance:', err);
                                res.status(500).json({
                                    success: false,
                                    message: 'Error al procesar el retiro'
                                });
                            });
                        }

                      
                        const transactionQuery = `
                            INSERT INTO transactions 
                            (origin_account, target_account, amount, transaction_date) 
                            VALUES (?, ?, ?, NOW())
                        `;
                        connection.query(transactionQuery, [
                            account.id,
                            null,
                            amount
                        ], (err, transactionResult) => {
                            if (err) {
                                return connection.rollback(() => {
                                    connection.release();
                                    console.error('Error al registrar la transacción:', err);
                                    res.status(500).json({
                                        success: false,
                                        message: 'Error al procesar el retiro'
                                    });
                                });
                            }

                            
                            connection.commit((err) => {
                                if (err) {
                                    return connection.rollback(() => {
                                        connection.release();
                                        console.error('Error al confirmar la transacción:', err);
                                        res.status(500).json({
                                            success: false,
                                            message: 'Error al procesar el retiro'
                                        });
                                    });
                                }

                                connection.release();
                                res.status(200).json({
                                    success: true,
                                    message: 'Retiro realizado con éxito',
                                    data: {
                                        accountNumber: account.account_number,
                                        amount: parseFloat(amount),
                                        newBalance: newBalance
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });

    } catch (error) {
        console.error('Error de autenticación:', error);
        return res.status(403).json({
            success: false,
            message: 'Token inválido'
        });
    }
});

// Endpoint para realizar transferencias

app.post('/api/transfer', (req, res) => {
    const token = req.headers['authorization'];
    const { targetAccount, amount } = req.body;

    if (!token) return res.status(403).json({ message: 'Token requerido' });
    if (!targetAccount || !amount || amount <= 0) {
        return res.status(400).json({ message: 'Datos inválidos' });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ message: 'Token inválido' });

        const sourceAccountId = decoded.accountId;

        db.getConnection((err, connection) => {
            if (err) return res.status(500).json({ message: 'Error de conexión' });

            connection.beginTransaction(err => {
                if (err) {
                    connection.release();
                    return res.status(500).json({ message: 'Error al iniciar transacción' });
                }

                connection.query('SELECT * FROM accounts WHERE id = ?',
                    [sourceAccountId],
                    (err, sourceAccounts) => {
                        if (err || !sourceAccounts.length) {
                            connection.rollback(() => {
                                connection.release();
                                return res.status(404).json({ message: 'Cuenta origen no encontrada' });
                            });
                            return;
                        }

                        connection.query('SELECT * FROM accounts WHERE account_number = ?',
                            [targetAccount],
                            (err, targetAccounts) => {
                                if (err || !targetAccounts.length) {
                                    connection.rollback(() => {
                                        connection.release();
                                        return res.status(404).json({ message: 'Cuenta destino no encontrada' });
                                    });
                                    return;
                                }

                                const sourceAccount = sourceAccounts[0];
                                const targetAccountData = targetAccounts[0];

                                if (sourceAccount.balance < amount) {
                                    connection.rollback(() => {
                                        connection.release();
                                        return res.status(400).json({ message: 'Saldo insuficiente' });
                                    });
                                    return;
                                }

                                connection.query('UPDATE accounts SET balance = balance - ? WHERE id = ?',
                                    [amount, sourceAccount.id],
                                    (err) => {
                                        if (err) {
                                            connection.rollback(() => {
                                                connection.release();
                                                return res.status(500).json({ message: 'Error al actualizar cuenta origen' });
                                            });
                                            return;
                                        }

                                        connection.query('UPDATE accounts SET balance = balance + ? WHERE id = ?',
                                            [amount, targetAccountData.id],
                                            (err) => {
                                                if (err) {
                                                    connection.rollback(() => {
                                                        connection.release();
                                                        return res.status(500).json({ message: 'Error al actualizar cuenta destino' });
                                                    });
                                                    return;
                                                }

                                                connection.query('INSERT INTO transactions (origin_account, target_account, amount, transaction_date) VALUES (?, ?, ?, NOW())',
                                                    [sourceAccountId, targetAccountData.id, amount],
                                                    (err) => {
                                                        if (err) {
                                                            connection.rollback(() => {
                                                                connection.release();
                                                                return res.status(500).json({ message: 'Error al registrar transacción' });
                                                            });
                                                            return;
                                                        }

                                                        connection.commit((err) => {
                                                            if (err) {
                                                                connection.rollback(() => {
                                                                    connection.release();
                                                                    return res.status(500).json({ message: 'Error al confirmar transacción' });
                                                                });
                                                                return;
                                                            }

                                                            connection.release();
                                                            res.json({
                                                                message: 'Transferencia exitosa',
                                                                amount,
                                                                newBalance: sourceAccount.balance - amount
                                                            });
                                                        });
                                                    });
                                            });
                                    });
                            });
                    });
            });
        });
    });
});

// Puerto del servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
