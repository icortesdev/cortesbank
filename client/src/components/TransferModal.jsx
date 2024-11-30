import '../styles/dashboard.css';
import { useState } from 'react';

const API_BASE_URL = 'http://localhost:3001';

const TransferModal = ({ onClose }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [formData, setFormData] = useState({
        amount: '',
        destinationAccount: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const closeTransferModal = () => {
        setIsOpen(false);
        onClose();
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.id]: e.target.value
        });
        setError('');
    };

    const handleTransfer = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_BASE_URL}/api/transfer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': token
                },
                body: JSON.stringify({
                    amount: parseFloat(formData.amount),
                    targetAccount: formData.destinationAccount
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Error al realizar la transferencia');
            }

            console.log('Transferencia exitosa:', data);
            closeTransferModal();
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {isOpen && (
                <div className="modal-overlay">
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={handleTransfer}>
                            {error && <div className="error-message">{error}</div>}
                            <div className="form-group">
                                <label htmlFor="amount">Cantidad</label>
                                <input
                                    type="number"
                                    id="amount"
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="Ingrese la cantidad"
                                    value={formData.amount}
                                    onChange={handleChange}
                                    disabled={loading}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="destinationAccount">Cuenta de Destino</label>
                                <input
                                    type="text"
                                    id="destinationAccount"
                                    required
                                    placeholder="Ingrese la cuenta de destino"
                                    value={formData.destinationAccount}
                                    onChange={handleChange}
                                    disabled={loading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="submit-transfer-button"
                                disabled={loading}
                            >
                                {loading ? 'Procesando...' : 'Enviar Transferencia'}
                            </button>
                        </form>
                        <button
                            onClick={closeTransferModal}
                            className="close-modal-button"
                            disabled={loading}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default TransferModal;