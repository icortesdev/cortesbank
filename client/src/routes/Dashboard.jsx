import { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/dashboard.css';
import TransactionsBoard from '../components/TransactionsBoard';
import TransferModal from '../components/TransferModal';
import WithdrawModal from '../components/WithdrawModal';
import DepositModal from '../components/DepositModal';

const Dashboard = () => {
    const [userName, setUserName] = useState('');
    const [accountNumber, setAccountNumber] = useState('');
    const [balance, setBalance] = useState('');
    const [isTransferOpen, setIsTransferOpen] = useState(false);
    const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
    const [isdepositOpen, setisdepositOpen] = useState(false);

    const openTransferModal = () => setIsTransferOpen(true);
    const closeTransferModal = () => setIsTransferOpen(false);
    const OpenDepositModal = () => setisdepositOpen(true);
    const closedepositModal = () => setisdepositOpen(false);
    const openWithdrawModal = () => setIsWithdrawOpen(true);
    const closeWithdrawModal = () => setIsWithdrawOpen(false);

    useEffect(() => {
        const storedUserName = localStorage.getItem('user_name');
        if (storedUserName) {
            setUserName(storedUserName);
        }

        const storedAccountNumber = localStorage.getItem('account_number');
        if (storedAccountNumber) {
            setAccountNumber(storedAccountNumber);
        }

        // Obtener el balance desde el backend
        const fetchBalance = async () => {
            const token = localStorage.getItem('token');

            if (!token) {
                console.error('Token no encontrado');
                return;
            }

            try {
                const response = await axios.get('http://localhost:3001/api/user/balance', {
                    headers: {
                        Authorization: token
                    }
                });
                setBalance(response.data.balance);
            } catch (error) {
                console.error('Error al obtener balance:', error);
            }
        };

        fetchBalance();
    }, []);

    // Obtener el numero de cuenta del usuario

    const fetchAccountNumber = async () => {
        const token = localStorage.getItem('token');

        if (!token) {
            console.error('Token no encontrado');
            return;
        }

        try {
            const response = await axios.get('http://localhost:3001/api/user/accountnumber', {
                headers: {
                    Authorization: token
                }
            });
            setAccountNumber(response.data.accountNumber);
        } catch (error) {
            console.error('Error al obtener número de cuenta:', error);
        }
    };

    fetchAccountNumber();


    const logout = () => {
        localStorage.removeItem('user_name');
        localStorage.removeItem('user_password');
        localStorage.removeItem('account_number');
        localStorage.removeItem('user_balance');
        localStorage.removeItem('token');
        window.location.reload();
    };

    return (
        <>
            <div className="headerDashboard">
                <p className="welcome">CortésBank</p>
                <button className="btn-logout" onClick={logout}>Cerrar sesión</button>
            </div>

            <div className="balance-card">
                <h1 className='welcomeName'>Bienvenido <strong>{userName}.</strong></h1>
                <h2> Número de cuenta:</h2>
                <p className='account'>{accountNumber}</p> 
                <p className="label">Balance disponible:</p>
                <p className="amount">{balance} </p>
            </div>
            <div className='btns'>
                <div className="btn-transfer" onClick={openTransferModal}>Transferir</div>
                {isTransferOpen && (
                    <TransferModal onClose={closeTransferModal} />
                )}
                <div className="btn-deposit" onClick={OpenDepositModal}>Ingresar</div>
                {isdepositOpen && (
                    <DepositModal onClose={closedepositModal} />
                )}
                <div className="btn-withdraw" onClick={openWithdrawModal}>Retirar</div>
                {isWithdrawOpen && (
                    <WithdrawModal onClose={closeWithdrawModal} />
                )}
            </div>
            <TransactionsBoard />
        </>
    );
};

export default Dashboard;
