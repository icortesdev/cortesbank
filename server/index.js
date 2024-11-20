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


// Endpoint para deposito
app.post('api/deposit', async (req, res) => {
    const connection = await pool.getConnection();

    try {
        // Iniciamos la transacción
        await connection.beginTransaction();

        const { target_account, amount } = req.body;
        const userId = req.user.id;

        // Validaciones básicas
        if (!target_account || !amount || amount <= 0) {
            throw new Error('Datos de transacción inválidos');
        }

        // Verificar que la cuenta existe y pertenece al usuario
        const [accountRows] = await connection.execute(
            'SELECT * FROM ACCOUNTS WHERE id = ? AND user_id = ?',
            [target_account, userId]
        );

        if (accountRows.length === 0) {
            throw new Error('Cuenta no encontrada o no autorizada');
        }

        const account = accountRows[0];
        const newBalance = parseFloat(account.balance) + parseFloat(amount);

        // Actualizar el balance de la cuenta
        await connection.execute(
            'UPDATE ACCOUNTS SET balance = ? WHERE id = ?',
            [newBalance, target_account]
        );

        // Registrar la transacción
        await connection.execute(
            `INSERT INTO TRANSACTIONS 
       (origin_account, target_account, amount, transaction_date) 
       VALUES (NULL, ?, ?, NOW())`,
            [target_account, amount]
        );

        // Confirmar la transacción
        await connection.commit();

        // Enviar respuesta
        res.status(200).json({
            success: true,
            message: 'Ingreso realizado correctamente',
            newBalance: newBalance,
            transactionDate: new Date()
        });

    } catch (error) {
        // Si hay error, revertimos la transacción
        await connection.rollback();

        console.error('Error en la transacción:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error al procesar el ingreso'
        });

    } finally {
        // Siempre liberamos la conexión
        connection.release();
    }
});

// Endpoint para obtener el historial de transacciones
app.get('/transactions/:accountId', async (req, res) => {
    try {
        const { accountId } = req.params;
        const userId = req.user.id;

        // Verificar que la cuenta pertenece al usuario
        const [account] = await pool.execute(
            'SELECT * FROM ACCOUNTS WHERE id = ? AND user_id = ?',
            [accountId, userId]
        );

        if (account.length === 0) {
            throw new Error('Cuenta no encontrada o no autorizada');
        }

        // Obtener transacciones
        const [transactions] = await pool.execute(
            `SELECT 
          t.id,
          t.origin_account,
          t.target_account,
          t.amount,
          t.transaction_date,
          CASE 
            WHEN t.origin_account IS NULL THEN 'Ingreso en efectivo'
            WHEN t.origin_account = ? THEN 'Transferencia enviada'
            ELSE 'Transferencia recibida'
          END as type
        FROM TRANSACTIONS t
        WHERE t.target_account = ? OR t.origin_account = ?
        ORDER BY t.transaction_date DESC`,
            [accountId, accountId, accountId]
        );

        res.status(200).json({
            success: true,
            transactions
        });

    } catch (error) {
        console.error('Error al obtener transacciones:', error);
        res.status(400).json({
            success: false,
            message: error.message || 'Error al obtener las transacciones'
        });
    }
});


// Puerto del servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
});
