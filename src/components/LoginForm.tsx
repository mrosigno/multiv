import { useState, useEffect } from 'react';
import { Lock, User, ShieldCheck, ArrowRight } from 'lucide-react';
import { useAzienda } from '@/hooks/api/useAzienda';
import { API_HOST } from '@/config';
import ConfirmDialog from './ConfirmDialog';

interface LoginFormProps {
  onLogin: () => void;
}

const generateDeviceToken = () => (Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)).substring(0, 20);

const LoginForm = ({ onLogin }: LoginFormProps) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [devLogoError, setDevLogoError] = useState(false); 
  const [clock, setClock] = useState('');
  
  const [deviceToken] = useState(() => generateDeviceToken());
  const [conflictPrompt, setConflictPrompt] = useState<{isOpen: boolean, msg: string}>({ isOpen: false, msg: '' });

  const { data: aziendaData, isLoading: isAziendaLoading, isError: isAziendaError } = useAzienda();
  const az = aziendaData && aziendaData.length > 0 ? aziendaData[0] : null;

  useEffect(() => {
    const update = () => setClock(new Date().toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  },[]);

  const executeLogin = async (forceLogin: boolean) => {
    setLoading(true);
    setError('');
    setConflictPrompt({ isOpen: false, msg: '' });

    try {
      const response = await fetch(`${API_HOST}/api.php?action=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username, 
          password, 
          device_token: deviceToken, 
          force_login: forceLogin 
        }),
      });

      const data = await response.json();

      if (data.success) {
        const authPayload = {
          username: data.username,
          gruppo: data.gruppo || 1,
          level: data.level || 1,
          dirig: data.dirig || 'N',
          g1: data.g1 || 0,
          g2: data.g2 || 0,
          g3: data.g3 || 0,
          device_token: data.device_token || deviceToken,
          ts: Date.now()
        };
        
        localStorage.setItem('gestionale_auth', JSON.stringify(authPayload));
        onLogin(); 
      } else if (data.conflict) {
        setConflictPrompt({ isOpen: true, msg: data.message });
      } else {
        setError(data.message || 'Credenziali non valide.');
      }
    } catch (err) {
      setError('Errore di connessione al server. Verifica la rete.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeLogin(false); 
  };

  const inputClass = "w-full pl-11 pr-4 py-2.5 sm:py-3 rounded-xl border border-slate-200 bg-slate-50/50 text-slate-800 text-sm font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 focus:bg-white transition-all shadow-inner";

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative overflow-hidden font-sans">
      
      <div className="fixed top-[-10%] left-[-10%] w-[30rem] h-[30rem] sm:w-[40rem] sm:h-[40rem] bg-blue-600/10 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none"></div>
      <div className="fixed bottom-[-10%] right-[-10%] w-[25rem] h-[25rem] sm:w-[35rem] sm:h-[35rem] bg-emerald-500/10 rounded-full blur-[80px] sm:blur-[100px] pointer-events-none"></div>

      <div className="absolute top-4 sm:top-6 right-4 sm:right-8 text-[10px] sm:text-sm font-mono font-bold text-slate-500 z-20">
        {clock}
      </div>

      {/* FIX: Ridotto il pb-8 a pb-2 sm:pb-4 per avvicinare il blocco al footer */}
      <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col items-center justify-start sm:justify-center px-4 pt-12 sm:pt-4 pb-2 sm:pb-4 z-10 w-full">
        
        <div className="w-full max-w-[420px] bg-white/80 backdrop-blur-xl sm:backdrop-blur-2xl rounded-3xl sm:rounded-[2rem] border border-white shadow-2xl p-6 sm:p-10 animate-fade-in relative overflow-hidden my-auto shrink-0">
          
          <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-blue-600 via-indigo-500 to-blue-400"></div>

          <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
            <div className="mb-4 sm:mb-6 flex items-center justify-center">
              {!logoError ? (
                <img 
                  src={import.meta.env.BASE_URL + 'gl_logo.png'} 
                  alt="Multi-V Logo" 
                  className="h-10 w-auto sm:h-14 object-contain drop-shadow-sm" 
                  onError={() => setLogoError(true)} 
                />
              ) : (
                <div className="w-12 h-12 bg-blue-100 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-blue-600"/>
                </div>
              )}
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight leading-none mb-1 sm:mb-2">
              Multi-V <span className="font-light text-blue-600">Web</span>
            </h1>
            <p className="text-xs sm:text-sm font-bold text-slate-500">
              Il Gestionale su misura
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-1">Nome Utente</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toUpperCase())} className={inputClass} placeholder="Inserisci il tuo ID" autoFocus />
              </div>
            </div>

            <div>
              <label className="block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-[11px] sm:text-sm font-bold rounded-xl px-4 py-2 sm:py-3 border border-red-100 animate-fade-in text-center">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading || !username || !password} className="w-full mt-2 py-3 sm:py-3.5 rounded-xl font-black text-xs sm:text-sm bg-blue-600 text-white shadow-lg shadow-blue-600/30 hover:bg-blue-700 hover:shadow-blue-600/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center gap-2">
              {loading ? 'VERIFICA IN CORSO...' : <>ACCEDI AL SISTEMA <ArrowRight className="w-4 h-4"/></>}
            </button>
          </form>
        </div>

        {/* FIX: Ridotto il margine superiore (mt-4 sm:mt-6) e inferiore (pb-2) */}
        <div className="mt-4 sm:mt-6 flex flex-col items-center justify-center shrink-0 pb-2 group">
          <a 
            href="https://www.glinformatica.it" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="flex flex-col items-center hover:opacity-80 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl p-2"
            title="G.L. Informatica Grosseto. Clicca per informazioni "
          >
            {!devLogoError && (
              <img 
                src={import.meta.env.BASE_URL + 'gl_link.png'} 
                alt="GL Informatica" 
                // FIX: Ridotto lo spazio sotto l'immagine a mb-1.5
                className="h-9 sm:h-11 w-auto object-contain mb-1.5 drop-shadow-sm group-hover:scale-105 transition-transform" 
                onError={() => setDevLogoError(true)} 
              />
            )}
            <p className="text-[9px] sm:text-[11px] font-medium text-slate-400 text-center max-w-[350px] leading-tight group-hover:text-blue-500 transition-colors">
              Sviluppato con tecnologie Cloud-Native.<br className="hidden sm:block"/> 
              Personalizzato per la tua azienda ed assistenza senza intermediari.
            </p>
          </a>
        </div>
      </div>

      <footer className="py-2.5 sm:py-4 px-4 sm:px-6 text-center text-[9px] sm:text-xs font-bold border-t border-slate-200/60 bg-white/60 backdrop-blur-md text-slate-500 relative z-20 shrink-0">
        <span className="inline-flex flex-wrap justify-center items-center gap-x-2 gap-y-1">
          <span>{isAziendaLoading ? 'Connessione al database...' : isAziendaError ? 'Nessun dato aziendale trovato' : az?.RagioneSociale1}</span>
          {az?.RagioneSociale2 && <><span className="hidden md:inline opacity-50">|</span><span>{az?.RagioneSociale2}</span></>}
          {az?.RagioneSociale3 && <><span className="hidden md:inline opacity-50">|</span><span>{az?.RagioneSociale3}</span></>}
          {az?.RagioneSociale4 && <><span className="hidden md:inline opacity-50">|</span><span>{az?.RagioneSociale4}</span></>}
        </span>
      </footer>
      
      <ConfirmDialog 
        isOpen={conflictPrompt.isOpen} 
        title="Utente già connesso" 
        type="warning" 
        confirmLabel="Forza Accesso"
        message={conflictPrompt.msg}
        onClose={() => setConflictPrompt({ isOpen: false, msg: '' })} 
        onConfirm={() => executeLogin(true)} 
      />

    </div>
  );
};

export default LoginForm;