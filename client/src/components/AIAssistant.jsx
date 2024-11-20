import { useState, useEffect, useRef } from 'react';
import { Bot, X, Send } from 'lucide-react';
import axios from 'axios';
import '../styles/AIAssistant.css';

const AIAssistant = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [isFullSize, setIsFullSize] = useState(false);
  const messagesEndRef = useRef(null);

  const systemContext = {
    role: 'system',
    content: `Eres un asistente virtual de CortesBank. Aquí está la información importante que debes conocer:

    - El banco se llama CortesBank
    - Horario General: De lunes a viernes de 8:00 a 14:00. Cerrado sábados y domingos.
    - Horario para Ingresos en Efectivo: Martes y jueves de 8:00 a 10:00.
    - Para agendar reuniones: Llamar al +34 123 456 678
    - Ubicación de la Oficina Central: Calle Falsa 1, Madrid.

    Debes ser amable y profesional. Proporciona siempre información precisa sobre horarios y servicios. Si te preguntan por información que no está en este contexto, indica que consultarán con un representante.`
  };

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '¡Bienvenido a CortesBank! ¿En qué puedo ayudarte hoy?'
    }
  ]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessageSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    const newMessage = { role: 'user', content: message };
    setMessages(prev => [...prev, newMessage]);
    setMessage('');

    try {
      const messagesToSend = [systemContext, ...messages, newMessage];
      const response = await axios.post('http://localhost:3001/api/chat', {
        messages: messagesToSend
      });

      const assistantMessage = response.data.choices[0].message.content;
      setMessages(prevMessages => [
        ...prevMessages,
        { role: 'assistant', content: assistantMessage }
      ]);
    } catch (error) {
      console.error("Error al obtener respuesta del backend:", error);
      setMessages(prevMessages => [
        ...prevMessages,
        {
          role: 'assistant',
          content: 'Lo siento, hubo un error al procesar tu solicitud. Por favor, intenta nuevamente más tarde.'
        }
      ]);
    }
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="ai-toggle-button"
        >
          <Bot size={20} />
        </button>
      )}

      {isOpen && (
        <div className={`ai-assistant-container ${isFullSize ? 'full-size' : ''}`}>
          <div className="ai-header">
            <div className="ai-header-title">
              <Bot size={18} />
              <h2>Asistente IA</h2>
            </div>
            <div className="ai-header-actions">
              <button onClick={() => setIsOpen(false)}>
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="ai-content">
            <div className="ai-messages">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`message-wrapper ${msg.role === 'user' ? 'user' : 'assistant'}`}
                >
                  <div className="message">
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleMessageSubmit} className="ai-input-form">
              <div className="input-container">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Escribe tu mensaje..."
                />
                <button type="submit">
                  <Send size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;