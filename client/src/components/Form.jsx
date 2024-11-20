import { useState } from 'react'
import Login from '../routes/Login'
import Register from '../routes/Register'
import './../styles/form.css'
import { useNavigate } from 'react-router-dom';

const Form = () => {
    const [isLogin, setIsLogin] = useState(true);
    const navigate = useNavigate();

    const handleToggle = () => {
        setIsLogin(!isLogin);
        if (isLogin) {
            navigate('/register');
        } else {
            navigate('/login');
        }
    };
    return (
        <>
            <div className="container">
                <div className="form-container">
                    <div className="header">
                        <h1>{isLogin ? 'Bienvenido a Cortesbank' : 'Crea tu cuenta'}</h1>
                        <p>
                            {isLogin
                                ? 'Introduce los datos de tu cuenta'
                                : 'Introduce tus datos para comenzar'}
                        </p>
                    </div>

                    {isLogin ? <Login /> : <Register />}

                    <div className="toggle-form">
                        <button
                            onClick={handleToggle}
                            className="toggle-button"
                        >
                            {isLogin ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Accede"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    )
}

export default Form
