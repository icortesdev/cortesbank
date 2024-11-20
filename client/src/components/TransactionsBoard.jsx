import '../styles/transactionDashboard.css';
import { useState, useEffect } from 'react';

const TransactionsBoard = () => {

    const [transacctions, setTransacctions] = useState();
    const [amount, setAmount] = useState()

    useEffect(() => {
        const storedtransacctions = localStorage.getItem('account_number');
        if (storedtransacctions) {
            setTransacctions(storedtransacctions);
        }

        const storedAmount = localStorage.getItem('user_balance');
        if (storedAmount) {
            setAmount(storedAmount);
        }

    }, []);


    return (
        <>
            <div className="transactions">
                <h3>Ultimas transacciones</h3>
                <div className="transaction-item">
                    <span className="description">{transacctions}</span>
                    <span className="amount">{amount}</span>
                </div>

            </div>



        </>
    )
}

export default TransactionsBoard
