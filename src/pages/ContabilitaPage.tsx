import { useState } from 'react';
import LoginForm from '@/components/LoginForm';
import AppLayout from '@/components/AppLayout';
import Contabilita from './Contabilita';

const ContabilitaPage = () => {
  const [authenticated, setAuthenticated] = useState(() => {
    return !!localStorage.getItem('gestionale_auth');
  });

  const handleLogout = () => {
    localStorage.removeItem('gestionale_auth');
    setAuthenticated(false);
  };

  if (!authenticated) {
    return <LoginForm onLogin={() => setAuthenticated(true)} />;
  }

  return (
    <AppLayout onLogout={handleLogout}>
      <Contabilita />
    </AppLayout>
  );
};

export default ContabilitaPage;
