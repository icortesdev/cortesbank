import '../styles/transactionDashboard.css';
import { useState, useEffect } from 'react';
import axios from 'axios';

const TransactionsBoard = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const transactionsPerPage = 10;

    const getTransactionType = (transaction) => {
        if (transaction.target_account === null ||
            transaction.target_account === 'null' ||
            transaction.target_account === undefined) {
            return 'Retiro';
        } else if (transaction.origin_account === null ||
            transaction.origin_account === 'null' ||
            transaction.origin_account === undefined) {
            return 'Depósito';
        } else {
            return 'Transferencia';
        }
    };

    const getAmountColor = (transaction) => {
        const userName = localStorage.getItem('user_name');

        if (transaction.origin_user_name === userName) {
            return 'text-red-500';  // El usuario actual es el que envía
        } else {
            return 'text-green-500';  // El usuario actual recibe
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    const indexOfLastTransaction = currentPage * transactionsPerPage;
    const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
    const currentTransactions = transactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
    const totalPages = Math.ceil(transactions.length / transactionsPerPage);

    const paginate = (pageNumber) => {
        setCurrentPage(pageNumber);
    };

    useEffect(() => {
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

                const sortedTransactions = response.data.sort((a, b) =>
                    new Date(b.transaction_date) - new Date(a.transaction_date)
                );

                setTransactions(sortedTransactions);
                setLoading(false);
            } catch (error) {
                console.error('Error al obtener transacciones:', error);
                setError('Error al obtener transacciones');
                setLoading(false);
            }
        };

        fetchTransactions();
        const interval = setInterval(fetchTransactions, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Cargando transacciones...</p>
            </div>
        );
    }

    if (error) {
        return <div className="error-container">{error}</div>;
    }

    return (
        <div className="transactions-container">
            <h3 className="transactions-title">Últimas transacciones</h3>
            {transactions.length === 0 ? (
                <div className="no-transactions">No hay transacciones</div>
            ) : (
                <>
                    <div className="transactions-list">
                        {currentTransactions.map((transaction) => (
                            <div key={transaction.id} className="transaction-item">
                                <div className="transaction-info">
                                    <span className="transaction-date">
                                        {formatDate(transaction.transaction_date)}
                                    </span>
                                    <span className="transaction-type">
                                        {getTransactionType(transaction)}
                                    </span>
                                    <span className={`transaction-amount ${getAmountColor(transaction)}`}>
                                        ${parseFloat(transaction.amount).toFixed(2)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="pagination">
                        <button
                            className="pagination-button"
                            onClick={() => paginate(currentPage - 1)}
                            disabled={currentPage === 1}
                        >
                            Anterior
                        </button>
                        <span className="pagination-info">
                            Página {currentPage} de {totalPages}
                        </span>
                        <button
                            className="pagination-button"
                            onClick={() => paginate(currentPage + 1)}
                            disabled={currentPage === totalPages}
                        >
                            Siguiente
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default TransactionsBoard;