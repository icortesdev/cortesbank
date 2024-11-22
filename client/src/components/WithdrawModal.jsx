import { useState } from "react";

const API_BASE_URL = 'http://localhost:3001';

const WithdrawModal = ({ onClose, updateBalance }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(null);

    const closeWithdrawModal = () => {
        setIsOpen(false);
        onClose();
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');

        if (!token) {
            setError("No hay sesión activa");
            return;
        }

        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError("Por favor ingrese una cantidad válida mayor a cero");
            return;
        }

        setError("");
        setSuccess(null);
        setIsLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/api/withdrawal`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": token
                },
                body: JSON.stringify({
                    amount: parseFloat(amount)
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Error al procesar el retiro");
            }

            if (data.success) {
                setSuccess({
                    message: "Retiro realizado con éxito",
                    amount: data.data.amount,
                    newBalance: data.data.newBalance
                });

                if (updateBalance) {
                    updateBalance(data.data.newBalance);
                }

                setAmount("");

                setTimeout(() => {
                    closeWithdrawModal();
                }, 1000);
            } else {
                throw new Error(data.message);
            }

        } catch (err) {
            console.error("Error:", err);
            setError(err.message || "Error al procesar el retiro");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {isOpen && (
                <div className="modal-overlay" onClick={closeWithdrawModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={handleWithdraw}>
                            {error && <div className="error-message">{error}</div>}
                            {success && (
                                <div className="success-message">
                                    {success.message}
                                    <div className="mt-2">
                                        Monto retirado: ${success.amount.toFixed(2)}
                                    </div>
                                </div>
                            )}
                            <div className="form-group">
                                <label htmlFor="amount">Cantidad a Retirar</label>
                                <input
                                    type="number"
                                    id="amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    min="0.01"
                                    step="0.01"
                                    placeholder="Ingrese la cantidad a retirar"
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="submit-transfer-button"
                                disabled={isLoading}
                            >
                                {isLoading ? "Procesando..." : "Realizar Retiro"}
                            </button>
                        </form>
                        <button
                            onClick={closeWithdrawModal}
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

export default WithdrawModal;