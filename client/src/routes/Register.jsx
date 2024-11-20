import { useState } from 'react';
import './../styles/register.css';
import { User, KeyRound, CreditCard } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    username: '',
    dni: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      alert('Las contraseñas no coinciden!');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_name: formData.username,
          dni: formData.dni,
          user_password: formData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('Usuario creado correctamente');
      } else {
        alert(`Error al crear el usuario: ${data.message}`);
      }
    } catch (error) {
      console.error('Error en la solicitud:', error);
      alert('Error al crear el usuario');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="register-form">
      <div className="register-input-group">
        <div className="register-input-icon">
          <User size={20} />
        </div>
        <input
          type="text"
          placeholder="Nombre de usuario"
          value={formData.username}
          onChange={(e) => setFormData({ ...formData, username: e.target.value })}
          className="register-input-field"
          required
        />
      </div>

      <div className="register-input-group">
        <div className="register-input-icon">
          <CreditCard size={20} />
        </div>
        <input
          type="text"
          placeholder="DNI"
          value={formData.dni}
          onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
          className="register-input-field"
          required
          pattern="[0-9]{8}[A-Za-z]{1}"
          title="inserte un formato de DNI valido (ejemplo: 12345678A)"
        />
      </div>

      <div className="register-input-group">
        <div className="register-input-icon">
          <KeyRound size={20} />
        </div>
        <input
          type="password"
          placeholder="Contraseña"
          value={formData.password}
          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
          className="register-input-field"
          required
          minLength={6}
        />
      </div>

      <div className="register-input-group">
        <div className="register-input-icon">
          <KeyRound size={20} />
        </div>
        <input
          type="password"
          placeholder="Confirma tu contraseña"
          value={formData.confirmPassword}
          onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
          className="register-input-field"
          required
          minLength={6}
        />
      </div>

      <button type="submit" className="register-submit-button">
        Registrate
      </button>
    </form>
  );
};

export default Register;