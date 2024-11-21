import '../styles/transactionDashboard.css';
import { useState, useEffect } from 'react';
import axios from 'axios';

const TransactionsBoard = () => {
    const [accountNumber, setAccountNumber] = useState('');
    const [balance, setBalance] = useState('');
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Función para determinar el tipo de transacción
    const getTransactionType = (transaction) => {
        if (transaction.origin_account === null) {
            return 'Depósito';
        } else if (transaction.target_account === null) {
            return 'Retiro';
        } else {
            return 'Transferencia';
        }
    };

    useEffect(() => {
        // Obtener datos almacenados en localStorage
        const storedAccountNumber = localStorage.getItem('account_number');
        if (storedAccountNumber) {
            setAccountNumber(storedAccountNumber);
        }

        const storedBalance = localStorage.getItem('user_balance');
        if (storedBalance) {
            setBalance(storedBalance);
        }

        // Obtener transacciones
        const fetchTransactions = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Token no encontrado');
                return;
            }

            try {
                const response = await axios.get('http://localhost:3001/transactions', {
                    headers: {
                        Authorization: token
                    }
                });
                setTransactions(response.data);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener transacciones:', error);
                setError('Error al obtener transacciones');
                setLoading(false);
            }
        };

        fetchTransactions();
    }, []);

    if (loading) {
        return <div>Cargando...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <>
            <div className="transactions">
                <h3>Ultimas transacciones</h3>
                {transactions.length === 0 ? (
                    <div className="transaction-item">No hay transacciones</div>
                ) : (
                    transactions.map((transaction) => (
                        <div key={transaction.id} className="transaction-item">
                            <span className="description">
                                {new Date(transaction.transaction_date).toLocaleDateString()}
                            </span>
                            <span className="type">
                                {getTransactionType(transaction)}
                            </span>
                            <span className="amount">
                                ${parseFloat(transaction.amount).toFixed(2)}
                            </span>
                        </div>
                    ))
                )}
            </div>
        </>
    );
};

export default TransactionsBoard;