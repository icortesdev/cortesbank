import { useState } from "react";



const WithdrawModal = ({ onClose }) => {

    const [isOpen, setIsOpen] = useState(true);

    const closeWithdrawModal = () => {
        setIsOpen(false);
    };

    const handleTransfer = (e) => {
        e.preventDefault();
        // Aquí iría la lógica para procesar la transferencia
        console.log('Transferencia realizada');
        closeWithdrawModal();
    };

    return (
        <>
            {isOpen && (
                <div className="modal-overlay" >
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <form
                            onSubmit={handleTransfer}>
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
                            <button type="submit" className="submit-transfer-button">
                                Realizar Retiro
                            </button>
                        </form>
                        <button onClick={onClose} className="close-modal-button">
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </>

    )
}

export default WithdrawModal
