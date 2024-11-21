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

// Conexión a la base de datos
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

// Función para generar número de cuenta aleatorio de 20 dígitos
function generateAccountNumber() {
    let accountNumber = '';
    for (let i = 0; i < 20; i++) {
        accountNumber += Math.floor(Math.random() * 10);
    }
    return accountNumber;
}

// Función para verificar si un número de cuenta ya existe
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

// Función para generar un número de cuenta único
async function generateUniqueAccountNumber() {
    let accountNumber;
    let exists;
    do {
        accountNumber = generateAccountNumber();
        exists = await checkAccountNumberExists(accountNumber);
    } while (exists);
    return accountNumber;
}

// Registro de nuevo usuario
app.post("/register", async (req, res) => {
    const { user_name, dni, user_password } = req.body;

    if (!user_name || !dni || !user_password) {
        return res.status(400).json({ message: 'Por favor, completa todos los campos' });
    }

    // Validar longitud del DNI
    if (dni.length > 10) {
        return res.status(400).json({ message: 'El DNI no puede exceder 10 caracteres' });
    }

    try {
        // Comenzar transacción
        db.beginTransaction(async (err) => {
            if (err) { throw err; }

            try {
                // 1. Crear el usuario
                const hashedPassword = await bcrypt.hash(user_password, 10);
                const insertUserQuery = 'INSERT INTO users (user_name, dni, user_password) VALUES (?, ?, ?)';

                db.query(insertUserQuery, [user_name, dni, hashedPassword], async (err, userResult) => {
                    if (err) {
                        return db.rollback(() => {
                            throw err;
                        });
                    }

                    const userId = userResult.insertId;

                    // 2. Generar número de cuenta único
                    const accountNumber = await generateUniqueAccountNumber();

                    // 3. Crear la cuenta asociada al usuario
                    const insertAccountQuery = `
                        INSERT INTO accounts 
                        (user_id, balance, account_number, creation_date) 
                        VALUES (?, ?, ?, NOW())
                    `;
                    const initialBalance = 0;

                    db.query(insertAccountQuery, [userId, initialBalance, accountNumber], (err, accountResult) => {
                        if (err) {
                            return db.rollback(() => {
                                throw err;
                            });
                        }

                        // Confirmar transacción
                        db.commit((err) => {
                            if (err) {
                                return db.rollback(() => {
                                    throw err;
                                });
                            }

                            res.status(200).json({
                                message: 'Usuario y cuenta creados correctamente',
                                userId: userId,
                                accountNumber: accountNumber
                            });
                        });
                    });
                });
            } catch (error) {
                db.rollback(() => {
                    console.error('Error durante el registro:', error);
                    res.status(500).json({ message: 'Error al registrar el usuario' });
                });
            }
        });
    } catch (error) {
        console.error('Error durante el registro:', error);
        res.status(500).json({ message: 'Error al registrar el usuario' });
    }
});

// Autenticación de usuario
app.post("/login", (req, res) => {
    const { user_name, user_password } = req.body;

    if (!user_name || !user_password) {
        return res.status(400).json({ message: 'Por favor, completa todos los campos' });
    }

    const query = `
        SELECT u.*, a.account_number, a.balance 
        FROM users u
        LEFT JOIN accounts a ON u.id = a.user_id
        WHERE u.user_name = ?
    `;

    db.query(query, [user_name], async (err, results) => {
        if (err) {
            console.error('Error en la consulta de la base de datos:', err);
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
                    accountNumber: user.account_number
                },
                process.env.JWT_SECRET,
                { expiresIn: '1h' }
            );

            return res.status(200).json({
                message: 'Autenticado correctamente',
                token,
                user_name: user.user_name,
                accountNumber: user.account_number,
                balance: user.balance
            });
        } catch (compareError) {
            console.error('Error en la comparación de contraseñas:', compareError);
            return res.status(500).json({ message: 'Error en la autenticación' });
        }
    });
});

// Obtener transacciones
app.get('/transactions', (req, res) => {
    const query = 'SELECT * FROM transactions ORDER BY transaction_date DESC';
    db.query(query, (error, results) => {
        if (error) {
            console.error('Error al obtener transacciones:', error);
            res.status(500).json({ error: 'Error al obtener transacciones' });
        } else {
            res.json(results);
        }
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


// Endpoint del depósito
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

        // Obtener conexión del pool
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

                // 1. Obtener la cuenta del usuario
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

                    // 2. Actualizar el balance
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

                        // 3. Registrar la transacción con origin_account como NULL porque es un depósito
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

                            // Confirmar transacción
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

// Endpoint de retiro
app.post('/api/withdraw', (req, res) => {
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

                // 1. Obtener la cuenta del usuario y verificar balance
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

                    // Verificar si hay suficiente balance
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

                    // 2. Actualizar el balance
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

                        // 3. Registrar la transacción con target_account como la cuenta del usuario
                        const transactionQuery = `
                            INSERT INTO transactions 
                            (origin_account, target_account, amount, transaction_date) 
                            VALUES (NULL, ?, ?, NOW())
                        `;
                        connection.query(transactionQuery, [
                            account.id, // target_account es la cuenta del usuario para retiros
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

                            // Confirmar transacción
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

// Puerto del servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
