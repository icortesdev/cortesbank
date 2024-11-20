import { useState } from "react";

const API_BASE_URL = 'http://localhost:3001'

const DepositModal = ({ onClose }) => {
    const [isOpen, setIsOpen] = useState(true);
    const [amount, setAmount] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(null);

    const closeDepositModal = () => {
        setIsOpen(false);
        onClose();
    };

    const handleTransfer = async (e) => {
        e.preventDefault();

        // Validaciones básicas
        if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
            setError("Por favor ingrese una cantidad válida");
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
                },
                body: JSON.stringify({
                    amount: parseFloat(amount)
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || "Error al procesar el depósito");
            }

            setSuccess({
                message: "Depósito realizado con éxito",
                amount: amount,
                newBalance: data.data.newBalance
            });

            // Limpiar el formulario
            setAmount("");

            // Cerrar el modal después de 2 segundos
            setTimeout(() => {
                closeDepositModal();
            }, 2000);

        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <>
            {isOpen && (
                <div className="modal-overlay" onClick={closeDepositModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <form onSubmit={handleTransfer}>
                            {error && <div className="error-message">{error}</div>}
                            {success && (
                                <div className="success-message">
                                    {success.message}
                                    <br />
                                    Monto: ${parseFloat(success.amount).toFixed(2)}
                                    <br />
                                    Nuevo balance: ${success.newBalance.toFixed(2)}
                                </div>
                            )}
                            <div className="form-group">
                                <label htmlFor="amount">Cantidad</label>
                                <input
                                    type="number"
                                    id="amount"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="Ingrese la cantidad"
                                    disabled={isLoading}
                                />
                            </div>
                            <button
                                type="submit"
                                className="submit-transfer-button"
                                disabled={isLoading}
                            >
                                {isLoading ? "Procesando..." : "Realizar Ingreso"}
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