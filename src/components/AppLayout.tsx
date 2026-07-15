import React, { useState, useEffect } from 'react';
import { LogOut, User, Store, Home, Lock, Pencil, FilePlus, ShieldCheck, Crown } from 'lucide-react';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import { API_HOST } from '@/config';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMenu } from '@/contexts/MenuContext';

interface AppLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
}

export default function AppLayout({ children, onLogout }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuthAccess();
  const { data: magazziniData } = useMagazzini();
  const [kickoutMsg, setKickoutMsg] = useState('');

  const { headerTitle: title, pagination } = useMenu();

  const magName = magazziniData?.find((m: any) => Number(m.cod) === auth.magId)?.Descrizione || `Mag. ${auth.magId}`;
  const isHomePage = location.pathname === '/home' || location.pathname === '/';

  // --- LETTURA LIVELLO UTENTE DA LOCALSTORAGE ---
  const userLevel = (() => {
    try {
      const authData = JSON.parse(localStorage.getItem('gestionale_auth') || '{}');
      return Number(authData.level) || 0;
    } catch {
      return 0;
    }
  })();

  // --- FUNZIONE PER GENERARE L'ICONA E IL COLORE DEL LIVELLO ---
  const getPermissionIcon = (level: number) => {
    const iconClass = "w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0";
    switch (level) {
      case 1:
        return <Lock className={`${iconClass} text-red-400`} title="Liv. 1: Sola Lettura" />;
      case 2:
        return <Pencil className={`${iconClass} text-blue-400`} title="Liv. 2: Lettura e Modifica" />;
      case 3:
        return <FilePlus className={`${iconClass} text-emerald-400`} title="Liv. 3: Lettura e Inserimento" />;
      case 9:
        return <ShieldCheck className={`${iconClass} text-purple-400`} title="Liv. 9: Operazioni e Audit" />;
      case 10:
        return <Crown className={`${iconClass} text-amber-400`} title="Liv. 10: Amministratore Totale" />;
      default:
        // Livelli intermedi (4, 5, 6, 7, 8) o sconosciuti
        return <User className={`${iconClass} text-slate-400`} title={`Liv. ${level}: Operazioni Base`} />;
    }
  };

  const getModuleTheme = () => {
    const p = location.pathname;
    if (p.startsWith('/documenti') || p.startsWith('/fatturazione')) return { color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-500' };
    if (p.startsWith('/contabilita')) return { color: 'text-emerald-400', bg: 'bg-emerald-900/30', border: 'border-emerald-500' };
    if (p.startsWith('/magazzino')) return { color: 'text-amber-400', bg: 'bg-amber-900/30', border: 'border-amber-500' };
    if (p.startsWith('/impostazioni')) return { color: 'text-slate-300', bg: 'bg-slate-800/60', border: 'border-slate-500' };
    return { color: 'text-blue-400', bg: 'bg-blue-900/30', border: 'border-blue-500' };
  };

  const theme = getModuleTheme();

  useEffect(() => {
    const verifySession = async () => {
      if (!auth.username || auth.token === 'bypass') return;

      try {
        const res = await fetch(`${API_HOST}/api.php?action=check_session`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: auth.username, device_token: auth.token })
        });
        const data = await res.json();
        
        if (!data.valid) {
          setKickoutMsg("Attenzione: Un altro dispositivo ha effettuato l'accesso con questo account.\n\nLa tua sessione è stata disconnessa per motivi di sicurezza e licenza.");
          return; 
        }
      } catch (e) {
        console.error("Errore controllo sessione");
      }

      const path = location.pathname;
      if (path.startsWith('/fatturazione') || path.startsWith('/documenti')) {
        if (!auth.canAccessArea1) navigate('/home');
      } else if (path.startsWith('/contabilita')) {
        if (!auth.canAccessArea2) navigate('/home');
      } else if (path.startsWith('/magazzino')) {
        if (!auth.canAccessArea3) navigate('/home');
      } else if (path.startsWith('/impostazioni')) {
        if (!auth.canAccessImpostazioni) navigate('/home');
      }
    };

    verifySession();
  }, [location.pathname, auth, navigate]);

  const handleHeaderAction = () => {
    if (isHomePage) onLogout(); 
    else navigate('/home'); 
  };

  const handleKickoutConfirm = () => {
    setKickoutMsg('');
    localStorage.removeItem('gestionale_auth');
    sessionStorage.removeItem('active_submenu');
    window.location.href = import.meta.env.BASE_URL;
  };

  const handleKickoutCancel = () => {
    setKickoutMsg('');
    localStorage.removeItem('gestionale_auth');
    sessionStorage.removeItem('active_submenu');
    window.location.href = '/'; 
  };
  
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans relative">
      
      <header className={`bg-slate-900 shadow-md z-[50] sticky top-0 flex flex-col ${!title && !pagination ? 'border-b-4 border-primary' : ''}`}>
        
        {/* RIGA 1: HEADER PRINCIPALE */}
        <div className="max-w-[1800px] mx-auto w-full px-2 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => navigate('/home')}>
              <img src={import.meta.env.BASE_URL + 'gl_logo.png'} alt="Logo" className="h-8 object-contain bg-white/10 p-0.5 rounded" onError={(e) => e.currentTarget.style.display='none'} />
              <div className="hidden md:flex flex-col justify-center">
                <span className="font-black text-sm tracking-wide leading-none text-white">Multi-V <span className="font-light text-blue-400">Web</span></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-1 justify-end">
            <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-800 px-2 py-1.5 rounded-lg border border-slate-700 shadow-inner max-w-[160px] sm:max-w-none overflow-hidden cursor-help">
              
              {/* --- ZONA UTENTE CON ICONA PERMESSI DINAMICA --- */}
              <div className="flex items-center gap-1.5 border-r border-slate-600 pr-1.5 sm:pr-3 shrink-0">
                {getPermissionIcon(userLevel)}
                <span className="text-[9px] sm:text-xs font-bold uppercase tracking-wider text-slate-200 truncate max-w-[50px] sm:max-w-[100px]">{auth.username}</span>
              </div>

              <div className="flex items-center gap-1 pl-0.5 shrink-0" title="Punto Vendita Corrente">
                <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
                <span className="text-[8px] sm:text-[10px] font-bold text-amber-100 uppercase truncate max-w-[50px] sm:max-w-[150px]">{magName}</span>
              </div>
            </div>

            <button onClick={handleHeaderAction} className={`flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 rounded-lg font-bold text-[10px] sm:text-sm transition-all shadow-sm shrink-0 ${isHomePage ? 'bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30' : 'bg-slate-700 text-white hover:bg-slate-600 border border-slate-500'}`}>
              {isHomePage ? <><LogOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Disconnetti</span></> : <><Home className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Menu</span></>}
            </button>
          </div>
        </div>

        {/* RIGA 2: SUB-HEADER (TITOLO E PAGINAZIONE) */}
        {(title || pagination) && (
          <div className={`border-t border-slate-700/50 border-b-[3px] ${theme.bg} ${theme.border}`}>
            <div className="max-w-[1800px] mx-auto w-full px-2 sm:px-6 py-2 flex flex-row items-center justify-between gap-2">
              
              <div className="flex items-center gap-2 overflow-hidden flex-1">
                <div className={`w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full shrink-0 ${theme.color.replace('text-', 'bg-')} animate-pulse`} />
                <h1 className={`font-black text-[10px] sm:text-sm uppercase tracking-wider truncate ${theme.color}`}>
                  {title}
                </h1>
              </div>

              {pagination && (
                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                  <span className="text-[9px] sm:text-xs font-bold text-slate-300 hidden sm:block">
                    <strong className="text-white">{pagination.totalRecords}</strong> trovati
                  </span>
                  
                  <div className="flex items-center gap-1 sm:gap-2 bg-slate-900/50 p-1 sm:p-1.5 rounded border border-slate-700/50 shadow-inner">
                    <select 
                      value={pagination.pageSize} 
                      onChange={e => pagination.onPageSizeChange(Number(e.target.value))} 
                      className="h-6 sm:h-7 rounded border border-slate-600 bg-slate-800 text-white px-1 sm:px-1.5 text-[9px] sm:text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value={20}>20/pag</option>
                      <option value={50}>50/pag</option>
                      <option value={100}>100/pag</option>
                    </select>
                    
                    {pagination.totalPages > 1 && (
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <button disabled={pagination.page === 0} onClick={() => pagination.onPageChange(pagination.page - 1)} className="h-6 sm:h-7 px-1.5 sm:px-2 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition-colors font-bold flex items-center justify-center">←</button>
                        <span className="px-1 sm:px-2 text-[10px] sm:text-xs font-mono font-bold text-white whitespace-nowrap">
                          {pagination.page + 1} / {pagination.totalPages}
                        </span>
                        <button disabled={pagination.page >= pagination.totalPages - 1} onClick={() => pagination.onPageChange(pagination.page + 1)} className="h-6 sm:h-7 px-1.5 sm:px-2 rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-white disabled:opacity-30 transition-colors font-bold flex items-center justify-center">→</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 w-full max-w-[1800px] mx-auto p-4 sm:p-6 animate-fade-in flex flex-col">
        {children}
      </main>

      <ConfirmDialog 
        isOpen={!!kickoutMsg} 
        title="Sessione Scaduta" 
        type="warning" 
        message={kickoutMsg} 
        confirmLabel="Torna al Login"
        onClose={handleKickoutCancel}
        onConfirm={handleKickoutConfirm}
      />
	  
    </div>
  );
}