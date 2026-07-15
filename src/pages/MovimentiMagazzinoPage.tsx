import { useState, useMemo, useEffect } from 'react';
import { Plus, Filter, RotateCcw, Pencil, Save, X, RefreshCcw, Trash2, Eye, PackageCheck } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import FastAutocomplete from '@/components/ui/FastAutocomplete';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useClienti } from '@/hooks/api/useClienti';
import { useCarichi } from '@/hooks/api/useCarichi';
import { useScarichi } from '@/hooks/api/useScarichi';
import { useTrasferimenti } from '@/hooks/api/useTrasferimenti';
import { useArticoli } from '@/hooks/api/useArticoli';
import { useFatture } from '@/hooks/api/useFatture';
import DocumentDetail from '@/components/DocumentDetail';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import { useMenu } from '@/contexts/MenuContext';

type MovType = 'carichi' | 'scarichi' | 'trasferimenti';

const MovimentiMagazzinoPage = () => {
  const queryClient = useQueryClient();
  const auth = useAuthAccess();
  const { setHeaderTitle, setPagination } = useMenu();

  // REGOLA: Chi può modificare gli esistenti? (Liv 2, o >= 4)
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;

  const currentYear = new Date().getFullYear();
  
  // --- STATI PRINCIPALI ---
  const [movType, setMovType] = useState<MovType>('carichi');
  
  // --- FILTRI ---
  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterMonth, setFilterMonth] = useState<number>(0); 
  const [filterArt, setFilterArt] = useState('');
  const [filterMag, setFilterMag] = useState(0);
  const [expanded, setExpanded] = useState(true);

  // --- PAGINAZIONE ---
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  // --- GESTIONE MODALI ---
  const [editItem, setEditItem] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const isReadOnly = !isNew && !canEditExisting;

  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ isOpen: false, type: 'info', title: '', msg: '' });

  // --- COLLEGAMENTO DOCUMENTO E FETCH ASINCRONO ---
  const [linkedFattura, setLinkedFattura] = useState<any | null>(null);

  // --- FETCH API ---
  const { data: apiCarichi = [], isLoading: loadC } = useCarichi();
  const { data: apiScarichi = [], isLoading: loadS } = useScarichi();
  const { data: apiTrasferimenti = [], isLoading: loadT } = useTrasferimenti();
  const { data: articoliData = [], isLoading: loadArt } = useArticoli();
  const { data: magazziniData = [], isLoading: loadMag } = useMagazzini();
  const { data: clientiData = [], isLoading: loadCli } = useClienti();
  const { data: fattureData = [] } = useFatture();

  const isLoading = loadC || loadS || loadT;

  // --- FUNZIONE RECUPERO E APERTURA DOCUMENTO ---
  const handleOpenDoc = async (docId: number) => {
    if (!docId) return;
    
    // 1. Cerca prima in memoria
    let docFound = fattureData.find((f: any) => Number(f.ID) === Number(docId));
    
    if (docFound) {
      setLinkedFattura(docFound);
    } else {
      // 2. Se non c'è in memoria (es. fattura di anni precedenti), la pesca dal server
      try {
        const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${docId}`);
        const data = await res.json();
        if (data && data.ID) {
          setLinkedFattura(data);
        } else {
          setFeedback({ isOpen: true, type: 'danger', title: 'Non Trovato', msg: 'Documento originale non presente in archivio.' });
        }
      } catch (e) {
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: 'Connessione al server fallita.' });
      }
    }
  };

  // --- SELETTORE DATASET ---
  const rawData = useMemo(() => {
    if (movType === 'carichi') return apiCarichi;
    if (movType === 'scarichi') return apiScarichi;
    return apiTrasferimenti;
  }, [movType, apiCarichi, apiScarichi, apiTrasferimenti]);

  // --- FILTRAGGIO ---
  const filtered = useMemo(() => {
    return rawData.filter((c: any) => {
      const dataField = c.Data || c.data || '';
      const codArt = c.Cod_articolo || c.codice || '';

      if (filterYear > 0 && !dataField.startsWith(filterYear.toString())) return false;
      if (filterMonth > 0) {
        const mStr = filterMonth.toString().padStart(2, '0');
        if (dataField.split('-')[1] !== mStr) return false;
      }
      if (filterArt) {
        const q = filterArt.toLowerCase();
        const a = articoliData.find((art: any) => art.Codice === codArt);
        const desc = a ? a.Descrizione.toLowerCase() : '';
        if (!codArt.toLowerCase().includes(q) && !desc.includes(q)) return false;
      }
      if (filterMag) {
        if (movType === 'trasferimenti') {
          if (Number(c.magout) !== filterMag && Number(c.magin) !== filterMag) return false;
        } else {
          if (Number(c.magazzino) !== filterMag) return false;
        }
      }
      return true;
    });
  }, [rawData, filterYear, filterMonth, filterArt, filterMag, articoliData, movType]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  // --- SINCRONIZZAZIONE HEADER APP ---
  useEffect(() => {
    const titles = { carichi: 'Carichi Magazzino', scarichi: 'Scarichi Magazzino', trasferimenti: 'Trasferimenti Mag.' };
    setHeaderTitle(titles[movType]);
    setPagination({
      page, totalPages, pageSize, totalRecords: filtered.length,
      onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(0); }
    });
    return () => { setHeaderTitle(''); setPagination(undefined); };
  }, [movType, page, totalPages, pageSize, filtered.length, setHeaderTitle, setPagination]);

  useEffect(() => { setPage(0); }, [movType, filterYear, filterMonth, filterArt, filterMag]);

  // --- HELPERS GRAFICI ---
  const artLabel = (code: string) => { const a = articoliData.find((x: any) => x.Codice === code); return a ? `${code} - ${a.Descrizione}` : code; };
  const cliLabel = (id: number) => { const c = clientiData.find((x:any) => Number(x.ID) === Number(id)); return c ? c.Ragione_Sociale || c['Ragione Sociale'] : ''; };
  const magLabel = (cod: number) => magazziniData.find((m: any) => m.cod === cod)?.Descrizione ?? String(cod);
  const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const formatDate = (d: string) => { if (!d) return '-'; const p = d.split(' ')[0].split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

  // --- PREPARAZIONE AUTOCOMPLETE ---
  const artOptions = useMemo(() => articoliData.map((a: any) => ({ id: a.Codice, label: a.Codice, searchString: `${a.Codice} ${a.Descrizione}`, originalData: a })), [articoliData]);

  // --- MUTAZIONI DINAMICHE ---
  const apiCall = async (action: string, payload: any) => {
    const res = await fetch(`${API_HOST}/api.php?action=${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);
    return data;
  };

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const action = movType === 'carichi' ? 'save_carico' : movType === 'scarichi' ? 'save_scarico' : 'save_trasferimento';
      const safeRec = { ...record };
      if (movType === 'trasferimenti') safeRec.operatore = Number(record.operatore || 0);
      else if (movType === 'carichi') safeRec.operatore = Number(record.operatore || 0);
      else safeRec.idoperatore = Number(record.idoperatore || 0);
      return apiCall(action, safeRec);
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: [movType] }); 
      setEditItem(null); 
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvato', msg: 'Registrazione completata con successo.' });
    },
    onError: (err: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const action = movType === 'carichi' ? 'delete_carico' : movType === 'scarichi' ? 'delete_scarico' : 'delete_trasferimento';
      return apiCall(action, { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [movType] });
      setItemToDelete(null); setEditItem(null);
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Eliminato', msg: 'Movimento rimosso.' });
    },
    onError: (err: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message })
  });

  // --- HANDLERS ---
  const handleNew = () => {
    const nextId = rawData.length > 0 ? Math.max(...rawData.map((d: any) => Number(d.Id || d.id))) + 1 : 1;
    const base = { Data: new Date().toISOString().slice(0, 10), data: new Date().toISOString().slice(0, 10), iddocumento: 0, reso: 0 };
    
    if (movType === 'carichi') setEditItem({ Id: nextId, ...base, Cod_articolo: '', Fornitore: 0, protocollo: '', lotto: '', quantita: 0, Importo: 0, perc: 0, magazzino: 1, operatore: 0, inventario: 0 });
    if (movType === 'scarichi') setEditItem({ Id: nextId, ...base, Cod_articolo: '', Cod_Cliente: 0, Riferimento: '', quantita: 0, Pr_Unit: 0, perc: 0, magazzino: 1, idoperatore: 0 });
    if (movType === 'trasferimenti') setEditItem({ id: nextId, ...base, codice: '', magout: 1, magin: 2, operatore: 0, quant: 0 });
    
    setIsNew(true);
  };

  const closeModal = () => { setEditItem(null); setIsNew(false); };

  if (!auth.username) { window.location.href = '/'; return null; }

  const inputClass = `w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed ${isReadOnly ? 'bg-secondary/30 text-muted-foreground' : 'bg-background text-foreground'}`;
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1";

  return (
    <AppLayout onLogout={auth.logout}>
      
      {/* PANNELLO DI CONTROLLO: Tipo Movimento e Filtri */}
      <div className="sticky top-14 sm:top-0 z-30 pt-1 pb-4 bg-slate-100">
        <div className="bg-card rounded-xl border border-border shadow-md p-3 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row gap-3 items-end justify-between">
            
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              <div className="w-full sm:w-48 shrink-0">
                <label className="block text-[10px] font-bold text-primary uppercase tracking-wider mb-1">Seleziona Flusso</label>
                <select value={movType} onChange={(e) => setMovType(e.target.value as MovType)} className="w-full px-3 py-2 rounded-lg border-2 border-primary bg-primary/5 text-primary text-sm focus:outline-none font-black cursor-pointer">
                  <option value="carichi">CARICHI (Entrata)</option>
                  <option value="scarichi">SCARICHI (Uscita)</option>
                  <option value="trasferimenti">TRASFERIMENTI</option>
                </select>
              </div>

              <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:w-24 shrink-0">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Anno</label>
                  <select value={filterYear} onChange={e => setFilterYear(+e.target.value)} className="w-full px-2 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm font-semibold">
                    <option value={0}>Tutti</option><option value={currentYear - 1}>{currentYear - 1}</option><option value={currentYear}>{currentYear}</option>
                  </select>
                </div>
                <div className="flex-1 sm:w-32 shrink-0">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Mese</label>
                  <select value={filterMonth} onChange={e => setFilterMonth(+e.target.value)} className="w-full px-2 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm font-semibold">
                    <option value={0}>Tutti i mesi</option>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (<option key={m} value={m}>{new Date(0, m - 1).toLocaleString('it-IT', { month: 'long' })}</option>))}
                  </select>
                </div>
              </div>
              
              <div className="w-full sm:w-48 shrink-0">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Cerca Articolo</label>
                <Input value={filterArt} onChange={e => setFilterArt(e.target.value)} placeholder="Codice o descr..." className="h-[38px] text-sm" />
              </div>
            </div>

            {/* FIX: RESPONSIVE RESET E NUOVO */}
            <div className="flex items-center justify-between gap-2 w-full lg:w-auto border-t border-border lg:border-none pt-2.5 lg:pt-0 mt-1 lg:mt-0">
              <Button variant="outline" size="sm" className="flex-1 lg:flex-none shrink-0 h-[38px]" onClick={() => { setFilterYear(currentYear); setFilterMonth(0); setFilterArt(''); setFilterMag(0); }}>
                <RotateCcw className="w-4 h-4 sm:mr-1"/> <span className="hidden sm:inline">Reset</span>
              </Button>
              {auth.canCreate && (
                <button onClick={handleNew} className="flex-[2] lg:flex-none flex items-center justify-center gap-1.5 px-4 h-[38px] bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors shadow-sm font-bold text-xs sm:text-sm shrink-0 active:scale-95">
                  <Plus className="w-4 h-4 shrink-0" /> <span className="hidden sm:inline">NUOVO MOVIMENTO</span><span className="sm:hidden">NUOVO</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden lg:flex lg:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-sm text-left">
            <thead className="bg-table-header border-b border-border">
              <tr>
                <th className="px-3 py-3 font-semibold text-muted-foreground w-24">Data</th>
                <th className="px-3 py-3 font-semibold text-muted-foreground">Articolo</th>
                
                {movType !== 'trasferimenti' && <th className="px-3 py-3 font-semibold text-muted-foreground">{movType === 'carichi' ? 'Fornitore' : 'Cliente'}</th>}
                
                <th className="px-3 py-3 font-semibold text-muted-foreground text-right w-20">Q.tà</th>
                
                {movType !== 'trasferimenti' && <th className="px-3 py-3 font-semibold text-muted-foreground text-right w-28">Importo Netto</th>}
                
                {movType === 'trasferimenti' ? (
                  <>
                    <th className="px-3 py-3 font-semibold text-amber-600 w-32">Mag. Uscita</th>
                    <th className="px-3 py-3 font-semibold text-blue-600 w-32">Mag. Entrata</th>
                  </>
                ) : (
                  <th className="px-3 py-3 font-semibold text-muted-foreground w-32">Magazzino</th>
                )}
                
                <th className="px-3 py-3 font-semibold text-muted-foreground text-center w-24">Rif. Doc</th>
                <th className="px-3 py-3 font-semibold text-muted-foreground text-center w-20">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Caricamento...</td></tr>}
              {!isLoading && paged.length === 0 && <tr><td colSpan={9} className="text-center text-muted-foreground py-8">Nessun movimento trovato.</td></tr>}
              
              {!isLoading && paged.map((c: any) => {
                const isT = movType === 'trasferimenti';
                const code = c.Cod_articolo || c.codice;
                const ent = c.Fornitore || c.Cod_Cliente;
                const qta = c.quantita || c.quant;
                const price = Number(c.Importo || c.Pr_Unit || 0);
                const netto = isT ? 0 : (movType === 'carichi' ? price * (1 - (c.perc||0)/100) : (price * qta) * (1 - (c.perc||0)/100));
                
                // FIX TOOLTIP: Mostra il protocollo o il riferimento sul passaggio del mouse
                const toolTipRif = `Protocollo/Rif: ${c.protocollo || c.Riferimento || 'Nessuno'}`;

                return (
                  <tr key={c.Id || c.id} className="hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => { setEditItem({ ...c }); setIsNew(false); }}>
                    <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{formatDate(c.Data || c.data)}</td>
                    <td className="px-3 py-2.5 text-foreground truncate max-w-[200px]" title={artLabel(code)}>{artLabel(code)}</td>
                    
                    {!isT && <td className="px-3 py-2.5 text-foreground truncate max-w-[150px]" title={cliLabel(ent)}>{cliLabel(ent)}</td>}
                    
                    <td className="px-3 py-2.5 text-right font-mono font-bold">{Number(qta).toLocaleString('it-IT')}</td>
                    
                    {!isT && <td className="px-3 py-2.5 text-right font-mono font-bold text-primary">{formatCurrency(netto)}</td>}
                    
                    {isT ? (
                      <>
                        <td className="px-3 py-2.5 text-amber-700 font-medium truncate">{magLabel(c.magout)}</td>
                        <td className="px-3 py-2.5 text-blue-700 font-medium truncate">{magLabel(c.magin)}</td>
                      </>
                    ) : (
                      <td className="px-3 py-2.5 text-muted-foreground truncate">{magLabel(c.magazzino)}</td>
                    )}
                    
                    <td className="px-3 py-2.5 text-center">
                      {Number(c.iddocumento) > 0 ? (
                        // FIX CLICK APRI DOCUMENTO
                        <span 
                          className="text-blue-600 font-bold hover:underline px-2 py-1 rounded hover:bg-blue-50 transition-colors" 
                          onClick={(e) => { e.stopPropagation(); handleOpenDoc(Number(c.iddocumento)); }} 
                          title={`APRI DOC: ${c.iddocumento}\n${toolTipRif}`}
                        >
                          {c.iddocumento}
                        </span>
                      ) : (
                        <span className="text-muted-foreground cursor-help" title={toolTipRif}>-</span>
                      )}
                    </td>
                    
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { setEditItem({ ...c }); setIsNew(false); }} className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded border transition-colors text-[10px] font-bold shadow-sm mx-auto ${canEditExisting ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-500 hover:text-white' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-200'}`}>
                        {canEditExisting ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {canEditExisting ? 'MODIFICA' : 'VEDI'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARDS MOBILE */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2 pb-8">
        {!isLoading && paged.map((c: any) => {
          const isT = movType === 'trasferimenti';
          const code = c.Cod_articolo || c.codice;
          const ent = c.Fornitore || c.Cod_Cliente;
          const qta = c.quantita || c.quant;
          const toolTipRif = `Protocollo/Rif: ${c.protocollo || c.Riferimento || 'Nessuno'}`;
          
          return (
            <div key={c.Id || c.id} onClick={() => { setEditItem({ ...c }); setIsNew(false); }} className="bg-card rounded-xl border border-border p-3 shadow-sm hover:shadow-md transition-all cursor-pointer">
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold text-muted-foreground">{formatDate(c.Data || c.data)}</span>
                <span className="text-[10px] font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">{code}</span>
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1 truncate">{artLabel(code)}</h3>
              {!isT && <p className="text-xs text-muted-foreground truncate mb-2">{cliLabel(ent)}</p>}

              <div className="flex justify-between items-center bg-secondary/30 p-2 rounded-lg mt-2">
                <span className="font-mono font-black text-foreground">Q.tà: {Number(qta).toLocaleString('it-IT')}</span>
                {Number(c.iddocumento) > 0 ? (
                  <span className="text-[10px] font-bold text-blue-600 border border-blue-200 bg-blue-50 px-2 py-0.5 rounded" onClick={(e) => { e.stopPropagation(); handleOpenDoc(Number(c.iddocumento)); }} title={`APRI DOC: ${c.iddocumento}\n${toolTipRif}`}>
                    Doc: {c.iddocumento}
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground" title={toolTipRif}>Nessun Doc</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE INSERIMENTO/MODIFICA DINAMICO */}
      {editItem && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={closeModal}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-4xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col animate-fade-up sm:animate-fade-in">
            
            <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card sm:rounded-t-xl shrink-0">
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <PackageCheck className={`w-5 h-5 ${movType==='carichi'?'text-green-500':movType==='scarichi'?'text-amber-500':'text-blue-500'}`} />
                {isReadOnly ? 'Dettaglio' : isNew ? 'Nuovo' : 'Modifica'} {movType === 'carichi' ? 'Carico' : movType === 'scarichi' ? 'Scarico' : 'Trasferimento'}
              </h3>
              <div className="flex items-center gap-3">
                {isReadOnly && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase rounded border border-red-200">Sola Lettura</span>}
                <button onClick={closeModal} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar min-h-0 bg-slate-50/50">
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
                <div className="md:col-span-3">
                  <label className={labelClass}>Data *</label>
                  <input type="date" disabled={isReadOnly} value={(editItem.Data || editItem.data || '').slice(0,10)} onChange={e => { const v = e.target.value; setEditItem({ ...editItem, Data: v, data: v }); }} className={inputClass} required />
                </div>
                
                <div className="md:col-span-6">
                  <label className={labelClass}>Articolo *</label>
                  <FastAutocomplete 
                    options={artOptions}
                    value={editItem.Cod_articolo || editItem.codice || ''}
                    onChange={(id) => setEditItem({ ...editItem, Cod_articolo: String(id), codice: String(id) })}
                    placeholder="Cerca..." disabled={loadArt || isReadOnly}
                    renderOption={(opt: any) => <div className="flex items-center gap-2 text-sm"><span className="font-bold text-primary">{opt.id}</span><span>- {opt.originalData.Descrizione}</span></div>}
                  />
                </div>

                <div className="md:col-span-3">
                  <label className={labelClass}>Quantità *</label>
                  <input type="number" step="0.01" disabled={isReadOnly} value={editItem.quantita ?? editItem.quant ?? ''} onChange={e => setEditItem({ ...editItem, quantita: +e.target.value, quant: +e.target.value })} className={`${inputClass} text-right font-bold text-primary`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
                
                {movType === 'trasferimenti' ? (
                  <>
                    <div className="md:col-span-6">
                      <label className={`${labelClass} text-amber-600`}>Mag. Uscita *</label>
                      <select disabled={isReadOnly} value={editItem.magout} onChange={e => setEditItem({ ...editItem, magout: +e.target.value })} className={inputClass}>
                        {magazziniData?.map((m: any) => <option key={m.cod} value={m.cod}>{m.Descrizione}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      <label className={`${labelClass} text-blue-600`}>Mag. Entrata *</label>
                      <select disabled={isReadOnly} value={editItem.magin} onChange={e => setEditItem({ ...editItem, magin: +e.target.value })} className={inputClass}>
                        {magazziniData?.map((m: any) => <option key={m.cod} value={m.cod}>{m.Descrizione}</option>)}
                      </select>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="md:col-span-4">
                      <label className={labelClass}>Magazzino *</label>
                      <select disabled={isReadOnly} value={editItem.magazzino} onChange={e => setEditItem({ ...editItem, magazzino: +e.target.value })} className={inputClass}>
                        {magazziniData?.map((m: any) => <option key={m.cod} value={m.cod}>{m.Descrizione}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-4">
                      <label className={labelClass}>{movType === 'carichi' ? 'Fornitore' : 'Cliente'}</label>
                      <select disabled={isReadOnly} value={editItem.Fornitore || editItem.Cod_Cliente || 0} onChange={e => setEditItem({ ...editItem, Fornitore: +e.target.value, Cod_Cliente: +e.target.value })} className={inputClass}>
                        <option value={0}>-- Nessuno --</option>
                        {clientiData?.map((c: any) => <option key={c.ID} value={c.ID}>{c.Ragione_Sociale}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Prezzo €</label>
                      <input type="number" step="0.01" disabled={isReadOnly} value={editItem.Importo ?? editItem.Pr_Unit ?? 0} onChange={e => setEditItem({ ...editItem, Importo: +e.target.value, Pr_Unit: +e.target.value })} className={`${inputClass} text-right font-mono`} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelClass}>Sconto %</label>
                      <input type="number" step="0.01" disabled={isReadOnly} value={editItem.perc ?? 0} onChange={e => setEditItem({ ...editItem, perc: +e.target.value })} className={`${inputClass} text-right font-mono text-destructive`} />
                    </div>
                  </>
                )}

                <div className="md:col-span-4 mt-2">
                  <label className={labelClass}>ID Documento (Rif)</label>
                  <input type="number" disabled={isReadOnly} value={editItem.iddocumento || ''} onChange={e => setEditItem({ ...editItem, iddocumento: +e.target.value })} className={inputClass} placeholder="ID Multi-V" />
                </div>
                <div className="md:col-span-8 mt-2">
                  <label className={labelClass}>Testo Riferimento / Note</label>
                  <input type="text" disabled={isReadOnly} value={editItem.protocollo || editItem.Riferimento || ''} onChange={e => setEditItem({ ...editItem, protocollo: e.target.value, Riferimento: e.target.value })} className={inputClass} />
                </div>

              </div>
            </div>

            {/* FIX: FOOTER CON PULSANTE ELIMINA (Sbloccato anche a chi può modificare se non è readOnly) */}
            <div className={`flex flex-col-reverse sm:flex-row items-stretch sm:items-center px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0 gap-3 ${isReadOnly ? 'justify-end' : 'justify-between'}`}>
              <div className="w-full sm:w-auto">
                {!isReadOnly && !isNew && (
                  <button type="button" onClick={() => setItemToDelete(editItem.Id || editItem.id)} className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 text-xs sm:text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 shadow-sm">
                    <Trash2 className="w-4 h-4" /> Elimina
                  </button>
                )}
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={closeModal} className="flex-1 sm:flex-none px-4 py-2.5 rounded-lg border border-input text-xs sm:text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">
                  {isReadOnly ? 'Chiudi' : 'Annulla'}
                </button>
                {!isReadOnly && (
                  <button onClick={() => saveMutation.mutate(editItem)} disabled={saveMutation.isPending} className="flex-[2] sm:flex-none flex items-center justify-center gap-1.5 px-6 py-2.5 rounded-lg bg-amber-500 text-white text-xs sm:text-sm font-bold hover:bg-amber-600 transition-opacity shadow-sm disabled:opacity-50">
                    <Save className="w-4 h-4" /> {isNew ? 'Registra' : 'Salva'}
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MODALI ESTERNI */}
      <ConfirmDialog 
        isOpen={!!itemToDelete} title="Elimina Movimento" type="danger"
        message={<>Sei sicuro di voler eliminare questo movimento?<br/>L'operazione non è reversibile e le giacenze verranno aggiornate.</>}
        onClose={() => setItemToDelete(null)} onConfirm={() => deleteMutation.mutate(itemToDelete as number)} isPending={deleteMutation.isPending}
      />
      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback({ ...feedback, isOpen: false })} />

      {/* DOCUMENT DETAIL GABBIA (Z-9999) */}
      <div className="fixed z-[9999]">
        {linkedFattura && <DocumentDetail document={linkedFattura} onClose={() => setLinkedFattura(null)} onEdit={() => {}} onToggle={() => {}} />}
      </div>

    </AppLayout>
  );
};

export default MovimentiMagazzinoPage;