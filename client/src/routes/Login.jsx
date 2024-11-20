import { useState } from 'react';
import '../styles/login.css'
import { User, KeyRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
    const [formData, setFormData] = useState({ user_name: '', user_password: '' });
    // eslint-disable-next-line no-unused-vars
    const [errors, setErrors] = useState({});
    const navigate = useNavigate(); 

    const validateInputs = () => {
        const newErrors = {};
        
        if (!formData.user_name) {
            newErrors.user_name = 'El nombre de usuario es obligatorio.';
        } else if (formData.user_name.length < 3) {
            newErrors.user_name = 'El nombre de usuario debe tener al menos 3 caracteres.';
        }

        if (!formData.user_password) {
            newErrors.user_password = 'La contraseña es obligatoria.';
        } else if (formData.user_password.length < 6) {
            newErrors.user_password = 'La contraseña debe tener al menos 6 caracteres.';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0; 
    };


    const handleSubmit = async (event) => {
        event.preventDefault();
 if (!validateInputs()) 
            return;
        try {
            const response = await fetch('http://localhost:3001/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });

            if (response.ok) {
                const data = await response.json();

                if (data.token) {
                    localStorage.setItem('token', data.token);
                    localStorage.setItem('user_name', data.user_name);
                    navigate('/dashboard');
                } else {
                    alert(data.message || 'Error en la autenticación');
                }
            } else {
                const errorData = await response.json();
                alert(errorData.message || 'Error en el servidor');
            }
        } catch (error) {
            console.error('Error al conectar con el backend', error);
        }
    };
    
    return (
        <form onSubmit={handleSubmit} className="login-form">
            <div className="login-input-group">
                <div className="login-input-icon">
                    <User size={20} />
                </div>
                <input
                    type="text"
                    placeholder="Nombre de usuario"
                    value={formData.user_name}
                    onChange={(e) => setFormData({ ...formData, user_name: e.target.value })}
                    className="login-input-field"
                    required
                />
            </div>

            <div className="login-input-group">
                <div className="login-input-icon">
                    <KeyRound size={20} />
                </div>
                <input
                    type="password"
                    placeholder="Contraseña"
                    value={formData.user_password}
                    onChange={(e) => setFormData({ ...formData, user_password: e.target.value })}
                    className="login-input-field"
                    required
                />
            </div>

            <button type="submit"
                className="login-submit-button"
                onClick={handleSubmit}>
                Accede
            </button>
        </form>
    );
};

export default Login;