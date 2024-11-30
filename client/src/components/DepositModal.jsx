import { useState } from "react";

const API_BASE_URL = 'http://localhost:3001';

const DepositModal = ({ onClose, updateBalance }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(null);

    const handleDeposit = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError("Por favor ingrese una cantidad válida mayor a cero");
            return;
        }

        setError("");
        setSuccess(null);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/deposit`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token
                },
                body: JSON.stringify({
                    amount: parseFloat(amount),
                    type: 'deposit' // Agregamos el tipo de transacción
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message);
            }

            setSuccess({
                message: "Depósito realizado con éxito",
                amount: parseFloat(amount),
                newBalance: data.data.newBalance
            });

            if (updateBalance) {
                updateBalance(data.data.newBalance);
            }

            setAmount("");

            setTimeout(() => {
                closeDepositModal();
            }, 1000);

        } catch (err) {
            console.error("Error:", err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const closeDepositModal = () => {
        setIsOpen(false);
        onClose();
    };

    return (
        <>
            {isOpen && (
                <div className="modal-overlay" onClick={closeDepositModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={handleDeposit}>
                            {error && <div className="error-message">{error}</div>}
                            {success && (
                                <div className="success-message">
                                    {success.message}
                                    <div className="mt-2">
                                        Monto depositado: ${success.amount.toFixed(2)}
                                    </div>
                                </div>
                            )}
                            <div className="form-group">
                                <label htmlFor="amount">Cantidad a Depositar</label>
                                <input
                                    type="number"
                                    id="amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Ingrese la cantidad a depositar"
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="submit-transfer-button"
                                disabled={isLoading}
                            >
                                {isLoading ? "Procesando..." : "Realizar Depósito"}
                            </button>
                        </form>
                        <button
                            onClick={closeDepositModal}
                            className="close-modal-button"
                            disabled={isLoading}
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};

export default DepositModal;