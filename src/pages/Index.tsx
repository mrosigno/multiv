import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '@/components/LoginForm';

const Index = () => {
  const navigate = useNavigate();
  const [authenticated, setAuthenticated] = useState(() => {
    return !!localStorage.getItem('gestionale_auth');
  });

  // Appena l'utente risulta autenticato, lo reindirizziamo alla Nuova HomePage!
  useEffect(() => {
    if (authenticated) {
      navigate('/home');
    }
  }, [authenticated, navigate]);

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />;
  }

  // Schermata di transizione fluida mentre React calcola il redirect
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="animate-pulse font-bold text-slate-500">Accesso in corso...</div>
    </div>
  );
};

export default Index;