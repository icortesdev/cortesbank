import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import Form from './components/Form.jsx';
import Dashboard from './routes/Dashboard';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute.jsx';
import AIAssistant from './components/AIAssistant.jsx';



const router = createBrowserRouter([
  {
    path: "/",
    element: <Form />,
  },
  {
    path: "/login",
    element: <Form />
  },
  {
    path: "/register",
    element: <Form />,
  },
  {
    path: "/dashboard",
    element: <PrivateRoute />,
    children: [
      { path: "/dashboard", element: <Dashboard /> },
    ],
  },
]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
    <AIAssistant />
  </StrictMode>
);