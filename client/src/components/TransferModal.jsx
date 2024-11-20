import '../styles/dashboard.css';
import { useState } from 'react';

const TransferModal = ({ onClose }) => {
    const [isOpen, setIsOpen] = useState(true);

    const closeTransferModal = () => {
        setIsOpen(false);
    };

    const handleTransfer = (e) => {
        e.preventDefault();
        // Aquí iría la lógica para procesar la transferencia
        console.log('Transferencia realizada');
        closeTransferModal();
    };

    return (
        <>
            {isOpen && (
                <div className="modal-overlay" >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={handleTransfer}>
                            <div className="form-group">
                                <label htmlFor="amount">Cantidad</label>
                                <input
                                    type="number"
                                    id="amount"
                                    required
                                    min="0"
                                    placeholder="Ingrese la cantidad"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="destinationAccount">Cuenta de Destino</label>
                                <input
                                    type="text"
                                    id="destinationAccount"
                                    required
                                    placeholder="Ingrese la cuenta de destino"
                                />
                            </div>
                            <button type="submit" className="submit-transfer-button">
                                Enviar Transferencia
                            </button>
                        </form>
                        <button onClick={onClose} className="close-modal-button">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}

        </>
    );
};

export default TransferModal;