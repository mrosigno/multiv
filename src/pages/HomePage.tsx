import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FileText, Calculator, Package, Settings, LogOut, ChevronRight, MonitorDot, X, Lock } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useAzienda } from '@/hooks/api/useAzienda';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import AccorpamentoModal from '@/components/AccorpamentoModal';
import { API_HOST } from '@/config';

export default function HomePage() {
  const navigate = useNavigate();
  const auth = useAuthAccess();
  
  const [activeMenu, setActiveMenu] = useState<string | null>(() => {
    return sessionStorage.getItem('active_submenu') || null;
  });

  const [isAccorpamentoOpen, setIsAccorpamentoOpen] = useState(false);

  const [userData, setUserData] = useState({ username: 'Operatore', magId: 1 });
  const { data: magazziniData } = useMagazzini();
  const { data: aziendaData } = useAzienda();
  const az = aziendaData && aziendaData.length > 0 ? aziendaData[0] : null;

  useEffect(() => {
    const rawAuth = localStorage.getItem('gestionale_auth');
    if (!rawAuth) {
      navigate('/');
    } else if (rawAuth !== 'true') {
      try {
        const parsed = JSON.parse(rawAuth);
        setUserData({
          username: parsed.username || parsed.fs_user_id || 'Operatore',
          magId: Number(parsed.gruppo) || 1
        });
      } catch (e) {}
    }
  }, [navigate]);

  const toggleMenu = (menuId: string) => {
    if (activeMenu === menuId) {
      setActiveMenu(null);
      sessionStorage.removeItem('active_submenu');
    } else {
      setActiveMenu(menuId);
      sessionStorage.setItem('active_submenu', menuId);
    }
  };

const handleLogout = async () => {
    // 1. Avvisiamo il server di svuotare il token prima di uscire
    try {
      const rawAuth = localStorage.getItem('gestionale_auth');
      if (rawAuth && rawAuth !== 'true') {
        const parsed = JSON.parse(rawAuth);
        await fetch(`${API_HOST}/api.php?action=logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: parsed.username || parsed.fs_user_id })
        });
      }
    } catch (e) {
      console.error("Errore durante il rilascio del token");
    }

    // 2. Pulizia locale
    sessionStorage.removeItem('active_submenu');
    localStorage.removeItem('gestionale_auth');
    navigate('/');
  };

  const theme = {
    doc: { bg: 'bg-blue-600', icon: <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-white" />, borderHover: 'hover:border-blue-400', textHover: 'group-hover:text-blue-700' },
    cont: { bg: 'bg-emerald-600', icon: <Calculator className="w-5 h-5 sm:w-6 sm:h-6 text-white" />, borderHover: 'hover:border-emerald-400', textHover: 'group-hover:text-emerald-700' },
    mag: { bg: 'bg-amber-500', icon: <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />, borderHover: 'hover:border-amber-400', textHover: 'group-hover:text-amber-700' },
    imp: { bg: 'bg-purple-600', icon: <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-white" />, borderHover: 'hover:border-purple-400', textHover: 'group-hover:text-purple-700' }
  };

  const subMenus = {
    doc: {
      title: "Documenti e Fatturazione",
      links: [
        { path: "/fatturazione", label: "Gestione Documenti" },
        { path: "/documenti/clienti", label: "Anagrafica Clienti/Fornitori" },
        { path: "/documenti/agenti", label: "Anagrafica Agenti" },
        { action: "accorpamento", label: "Accorpamento/Fatturazione Differita" },
        { path: "/documenti/flussi-sdi", label: "Gestione Flussi SDI" }
      ]
    },
    cont: {
      title: "Contabilità",
      links: [
        { path: "/contabilita", label: "Prima Nota e Scadenzario" },
        { path: "/documenti/causali", label: "Piano dei Conti – Mastri" },
        { path: "/documenti/tipologie-movimento", label: "Piano dei Conti – Sottoconti" },
        { path: "/documenti/modalita-pagamento", label: "Modalità di Pagamento" },
        { path: "/documenti/mezzi-pagamento", label: "Mezzi di Pagamento" },
        { path: "/documenti/aliquote-iva", label: "Aliquote IVA" },
        { path: "/documenti/banche", label: "Istituti di Credito" }
      ]
    },
    mag: {
      title: "Magazzino",
      links: [
        { path: "/magazzino/catalogo", label: "Catalogo Prodotti/Listino" },
        { path: "/magazzino/movimenti", label: "Movimenti di Magazzino" },
        { path: "/magazzino/inventario", label: "Verifica Inventario" }
      ]
    },
    imp: {
      title: "Impostazioni e Archivi",
      links: [
        { path: "/impostazioni/azienda", label: "Impostazioni Generali" },
        { path: "/impostazioni/listini", label: "Impostazione Listini" },
        { path: "/documenti/tipo-documenti", label: "Impostazione Documenti" },
		{ path: "/impostazioni/annotazioni", label: "Annotazioni nei Documenti" },
        { path: "/impostazioni/magazzini", label: "Magazzini/Punti Vendita" },
        { path: "/impostazioni/brand", label: "Brand" },
        { path: "/impostazioni/reparti", label: "Reparti" },
        { path: "/impostazioni/sdi", label: "Impostazioni Flussi SDI" }
      ]
    }
  };

  return (
    <AppLayout onLogout={handleLogout}>
      
      {/* Contenitore ottimizzato per far entrare tutto nel monitor */}
      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-6xl mx-auto py-2 sm:py-4">
        
        {/* HEADER TITOLO MODERNO */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/30 shrink-0">
              <MonitorDot className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-3xl font-black text-slate-800 tracking-tight leading-tight">Multi-V Web</h1>
              <h2 className="text-xs sm:text-sm font-bold text-blue-600 uppercase tracking-widest mt-0.5">Il Gestionale su Misura</h2>
            </div>
          </div>
          
          <button 
            onClick={handleLogout} 
            className="flex items-center gap-2 px-4 py-2 sm:px-5 sm:py-2.5 bg-red-50 text-red-600 text-xs sm:text-sm font-black rounded-lg hover:bg-red-600 hover:text-white border-2 border-red-100 hover:border-red-600 transition-all shadow-sm w-full sm:w-auto justify-center"
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5" /> ESCI DAL SISTEMA
          </button>
        </div>

{/* GRIGLIA DELLE 4 MACRO-AREE (Con Lucchetti di Sicurezza) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 w-full mb-2">

          {/* 1. DOCUMENTI */}
          {auth.canAccessArea1 ? (
            <button onClick={() => toggleMenu('doc')} className={`group flex flex-col bg-white rounded-2xl border-2 border-slate-100 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-blue-300 transition-all duration-300 text-left ${activeMenu === 'doc' ? 'border-blue-500 shadow-blue-500/20 ring-4 ring-blue-500/10' : ''}`}>
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">Documenti e Fatturazione</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-snug">Gestione Documenti, Anagrafiche, Accorpamenti e SDI.</p>
            </button>
          ) : (
            <div className="group flex flex-col bg-slate-50/50 rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-sm opacity-60 cursor-not-allowed text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-slate-200 p-1.5 rounded-full"><Lock className="w-4 h-4 text-slate-500" /></div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mb-3"><FileText className="w-5 h-5 text-slate-400" /></div>
              <h3 className="text-lg font-black text-slate-500 mb-1">Documenti e Fatturazione</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-snug">Area non abilitata per il tuo profilo.</p>
            </div>
          )}
          
          {/* 2. CONTABILITÀ */}
          {auth.canAccessArea2 ? (
            <button onClick={() => toggleMenu('cont')} className={`group flex flex-col bg-white rounded-2xl border-2 border-slate-100 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-emerald-300 transition-all duration-300 text-left ${activeMenu === 'cont' ? 'border-emerald-500 shadow-emerald-500/20 ring-4 ring-emerald-500/10' : ''}`}>
              <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Calculator className="w-5 h-5 text-emerald-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">Contabilità</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-snug">Prima Nota, Scadenzario, Banche e Piani dei Conti.</p>
            </button>
          ) : (
            <div className="group flex flex-col bg-slate-50/50 rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-sm opacity-60 cursor-not-allowed text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-slate-200 p-1.5 rounded-full"><Lock className="w-4 h-4 text-slate-500" /></div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mb-3"><Calculator className="w-5 h-5 text-slate-400" /></div>
              <h3 className="text-lg font-black text-slate-500 mb-1">Contabilità</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-snug">Area non abilitata per il tuo profilo.</p>
            </div>
          )}
          
          {/* 3. MAGAZZINO */}
          {auth.canAccessArea3 ? (
            <button onClick={() => toggleMenu('mag')} className={`group flex flex-col bg-white rounded-2xl border-2 border-slate-100 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-amber-300 transition-all duration-300 text-left ${activeMenu === 'mag' ? 'border-amber-500 shadow-amber-500/20 ring-4 ring-amber-500/10' : ''}`}>
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Package className="w-5 h-5 text-amber-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">Magazzino</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-snug">Catalogo Prodotti, Movimenti Logistici e Inventario.</p>
            </button>
          ) : (
            <div className="group flex flex-col bg-slate-50/50 rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-sm opacity-60 cursor-not-allowed text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-slate-200 p-1.5 rounded-full"><Lock className="w-4 h-4 text-slate-500" /></div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mb-3"><Package className="w-5 h-5 text-slate-400" /></div>
              <h3 className="text-lg font-black text-slate-500 mb-1">Magazzino</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-snug">Area non abilitata per il tuo profilo.</p>
            </div>
          )}
          
          {/* 4. IMPOSTAZIONI E ARCHIVI */}
          {auth.canAccessImpostazioni ? (
            <button onClick={() => toggleMenu('imp')} className={`group flex flex-col bg-white rounded-2xl border-2 border-slate-100 p-4 sm:p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-purple-300 transition-all duration-300 text-left ${activeMenu === 'imp' ? 'border-purple-500 shadow-purple-500/20 ring-4 ring-purple-500/10' : ''}`}>
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Settings className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">Impostazioni e Archivi</h3>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-snug">Impostazioni Generali, Tabelle di Base e Configurazioni.</p>
            </button>
          ) : (
            <div className="group flex flex-col bg-slate-50/50 rounded-2xl border-2 border-slate-200 p-4 sm:p-5 shadow-sm opacity-60 cursor-not-allowed text-left relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-slate-200 p-1.5 rounded-full"><Lock className="w-4 h-4 text-slate-500" /></div>
              <div className="w-10 h-10 bg-slate-200 rounded-xl flex items-center justify-center mb-3"><Settings className="w-5 h-5 text-slate-400" /></div>
              <h3 className="text-lg font-black text-slate-500 mb-1">Impostazioni e Archivi</h3>
              <p className="text-[11px] sm:text-xs text-slate-400 font-medium leading-snug">Area riservata agli Amministratori.</p>
            </div>
          )}

        </div>

      </div>

      {/* FOOTER AZIENDALE (Compatto in basso) */}
      <footer className="w-full bg-slate-900 text-white rounded-t-xl sm:rounded-xl shadow-lg mt-4 p-3 sm:p-4 border-t-4 border-slate-700 shrink-0">
        <div className="text-center text-[10px] sm:text-xs font-bold text-slate-300">
          <span className="inline-flex flex-wrap justify-center items-center gap-x-2 gap-y-1">
            <span className="text-white">{az?.RagioneSociale1 || 'Caricamento anagrafica...'}</span>
            {az?.RagioneSociale2 && <><span className="hidden md:inline opacity-50">|</span><span>{az?.RagioneSociale2}</span></>}
            {az?.RagioneSociale3 && <><span className="hidden md:inline opacity-50">|</span><span>{az?.RagioneSociale3}</span></>}
            {az?.RagioneSociale4 && <><span className="hidden md:inline opacity-50">|</span><span>{az?.RagioneSociale4}</span></>}
          </span>
        </div>
      </footer>

      {/* SOTTOMENU MODALE CENTRALE */}
      {activeMenu && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 animate-fade-in" onClick={() => setActiveMenu(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh] overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
            
            <div className={`px-5 py-4 flex items-center justify-between shrink-0 ${theme[activeMenu as keyof typeof theme].bg}`}>
              <div className="flex items-center gap-3">
                <div className={`bg-white/20 p-2 rounded-lg`}>
                  {theme[activeMenu as keyof typeof theme].icon}
                </div>
                <h3 className="text-base sm:text-xl font-bold text-white tracking-wide uppercase">
                  {subMenus[activeMenu as keyof typeof subMenus].title}
                </h3>
              </div>
              <button onClick={() => setActiveMenu(null)} className="p-2 hover:bg-white/20 rounded-full text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 sm:p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
              <div className="flex flex-col gap-2">
                {subMenus[activeMenu as keyof typeof subMenus].links.map((link, idx) => {
                  const th = theme[activeMenu as keyof typeof theme];
                  const itemClass = `flex items-center justify-between p-3 sm:p-3.5 bg-white rounded-xl border border-slate-200 shadow-sm ${th.borderHover} group transition-all cursor-pointer`;
                  
                  if (link.action) {
                    return (
                      <div key={idx} onClick={() => { setActiveMenu(null); setIsAccorpamentoOpen(true); }} className={itemClass}>
                        <span className={`font-bold text-slate-700 text-xs sm:text-sm ${th.textHover}`}>{link.label}</span>
                        <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 group-hover:text-foreground transform group-hover:translate-x-1 transition-all" />
                      </div>
                    );
                  }

                  return (
                    <Link key={idx} to={link.path!} className={itemClass}>
                      <span className={`font-bold text-slate-700 text-xs sm:text-sm ${th.textHover}`}>{link.label}</span>
                      <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5 text-slate-300 group-hover:text-foreground transform group-hover:translate-x-1 transition-all" />
                    </Link>
                  );
                })}
              </div>
            </div>

          </div>
        </div>
      )}

      {isAccorpamentoOpen && (
        <AccorpamentoModal 
          isOpen={isAccorpamentoOpen} 
          onClose={() => setIsAccorpamentoOpen(false)} 
        />
      )}

    </AppLayout>
  );
}