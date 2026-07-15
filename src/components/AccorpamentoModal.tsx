import React, { useState, useMemo, useEffect } from 'react';
import { X, FileText, RefreshCcw, Play, Eye, CheckCircle2, XCircle, AlertTriangle, FileCheck, FastForward, Layers, ChevronUp, ChevronDown } from 'lucide-react';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useClientiDaAccorpare, useDocumentiDaAccorpare, useEseguiAccorpamento } from '@/hooks/api/useAccorpamento';
import { useFatture } from '@/hooks/api/useFatture';
import { useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import DocumentDetail from './DocumentDetail'; 
import { useAuthAccess } from '@/hooks/useAuthAccess';

const getLocalDate = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const [yyyy, mm, dd] = dateString.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

interface Props { 
  isOpen: boolean; 
  onClose: () => void; 
  prefillData?: { idCliente: number; targetType: number; sourceType: number; };
}

export default function AccorpamentoModal({ isOpen, onClose, prefillData }: Props) {
  const queryClient = useQueryClient();
  
  const auth = useAuthAccess(); 
  const canAccorpare = auth.canCreate; // Regola: Livello >= 3
  const [permissionWarning, setPermissionWarning] = useState(false);
  
  const [sourceType, setSourceType] = useState<number>(() => Number(localStorage.getItem('accorp_source')) || 0);
  const [targetType, setTargetType] = useState<number>(() => Number(localStorage.getItem('accorp_target')) || 0);
  const [targetDate, setTargetDate] = useState<string>(getLocalDate());
  
  const [selectedClient, setSelectedClient] = useState<number | null>(null);
  const [showClientDocs, setShowClientDocs] = useState<boolean>(false);
  const [excludedClients, setExcludedClients] = useState<Set<number>>(new Set());
  const [excludedDocs, setExcludedDocs] = useState<Set<number>>(new Set());
  
  const [nextDocNumber, setNextDocNumber] = useState<string | number>('-');
  const [viewDocument, setViewDocument] = useState<any | null>(null); 

  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean; title: string; message: string; isMassive: boolean; onConfirm: () => void; onSkip?: () => void; onAbort?: () => void; }>({ isOpen: false, title: '', message: '', isMassive: false, onConfirm: () => {} });
  const [successDialog, setSuccessDialog] = useState<{ isOpen: boolean; message: string; newDocId?: number; }>({ isOpen: false, message: '' });
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: any, onConfirm?: () => void, confirmLabel?: string }>({ isOpen: false, type: 'info', title: '', msg: '' });
  
  const [massState, setMassState] = useState({ isActive: false, queue: [] as any[], currentIndex: 0, successCount: 0, isFetching: false });
  const [hasPrefilled, setHasPrefilled] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  

  const { data: tipiDoc } = useTipiDocumento();
  const { data: clienti, isLoading: loadingClienti } = useClientiDaAccorpare(sourceType);
  const { data: documentiCliente } = useDocumentiDaAccorpare(sourceType, selectedClient || 0);
  const { data: tutteLeFatture } = useFatture(); 
  const accorpaMutation = useEseguiAccorpamento();
  
  // Se l'utente non ha i permessi, all'apertura gli facciamo apparire un avviso
  useEffect(() => {
    if (isOpen && !canAccorpare) {
      setPermissionWarning(true);
    }
  }, [isOpen, canAccorpare]);

  useEffect(() => {
    if (!isOpen) setHasPrefilled(false);
  }, [isOpen]);

  useEffect(() => { localStorage.setItem('accorp_source', String(sourceType)); }, [sourceType]);
  useEffect(() => { localStorage.setItem('accorp_target', String(targetType)); }, [targetType]);

  useEffect(() => {
    if (isOpen && prefillData && !hasPrefilled) {
      if (prefillData.sourceType > 0) setSourceType(prefillData.sourceType);
      if (prefillData.targetType > 0) setTargetType(prefillData.targetType);
    }
  }, [isOpen, prefillData, hasPrefilled]);

  const tipiDocSorgente = useMemo(() => {
    if (!tipiDoc) return [];
    return tipiDoc.filter((t: any) => !t.da || t.da.trim() === '');
  }, [tipiDoc]);

  useEffect(() => {
    if (!targetType || !targetDate) { setNextDocNumber('-'); return; }
    const anno = targetDate.split('-')[0];
    fetch(`${API_HOST}/api.php?action=get_next_number&tipo=${targetType}&anno=${anno}`)
      .then(res => res.json())
      .then(data => setNextDocNumber(data.success && data.nextNum ? data.nextNum : '-'))
      .catch(() => setNextDocNumber('-'));
  }, [targetType, targetDate, successDialog.isOpen]);

  // Gestione della selezione automatica (disabilitata per non aprire modali a caso, usata solo per il prefill)
  useEffect(() => {
    if (loadingClienti) return; 
    const validClients = (clienti || []).filter((c: any) => !excludedClients.has(Number(c.ID)));
    if (validClients.length === 0) {
      setSelectedClient(null);
      setShowClientDocs(false);
    } else {
      if (prefillData && !hasPrefilled) {
        const exists = validClients.some((c:any) => Number(c.ID) === prefillData.idCliente);
        if (exists) {
          setSelectedClient(prefillData.idCliente);
          setShowClientDocs(true);
        }
        setExcludedDocs(new Set());
        setHasPrefilled(true);
      } else {
        const isCurrentValid = validClients.some((c: any) => Number(c.ID) === selectedClient);
        if (!isCurrentValid && selectedClient !== null) {
          setSelectedClient(null);
          setShowClientDocs(false);
        }
      }
    }
  }, [clienti, excludedClients, selectedClient, loadingClienti, prefillData, hasPrefilled]);

  const activeDocs = useMemo(() => {
    if (!documentiCliente) return [];
    return documentiCliente.filter((d: any) => !excludedDocs.has(Number(d.ID)));
  }, [documentiCliente, excludedDocs]);

  const totImponibile = useMemo(() => activeDocs.reduce((acc, d) => acc + Number(d.impondoc), 0), [activeDocs]);
  const totImposta = useMemo(() => activeDocs.reduce((acc, d) => acc + Number(d.ivadoc), 0), [activeDocs]);
  const totDocumento = totImponibile + totImposta;

  const handleSourceTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSourceType(Number(e.target.value)); setSelectedClient(null); setShowClientDocs(false); setExcludedClients(new Set()); setExcludedDocs(new Set());
  };

  const handleToggleClient = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setExcludedClients(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleToggleDoc = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setExcludedDocs(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const executeMergeForClient = async (idCliente: number, docIds: number[]) => {
    const descSorgente = tipiDoc?.find((t: any) => Number(t.id) === sourceType)?.descrizione || 'Documento';
    return await accorpaMutation.mutateAsync({ idCliente, docIds, targetTipo: targetType, targetData: targetDate, tipoDocSorgenteDescr: descSorgente });
  };

  const triggerAccorpaSingolo = () => {
    // 1. Se manca la destinazione, avvisiamo l'utente invece di bloccare il tasto!
    if (!targetType) {
      setFeedback({ 
        isOpen: true, type: 'warning', title: 'Dati Mancanti', 
        msg: 'Seleziona prima il "TIPO DOC. DESTINAZIONE" dal pannello principale.' 
      });
      setShowClientDocs(false); // Chiudiamo il sottomodale per fargli vedere la scelta
      return;
    }

    if (!selectedClient || activeDocs.length === 0) return;
    
    const clienteNome = clienti?.find((c:any) => Number(c.ID) === selectedClient)?.Ragione_Sociale;
    const targetDesc = tipiDoc?.find((t: any) => Number(t.id) === Number(targetType))?.descrizione || 'Documento';
    
    setConfirmDialog({
      isOpen: true, isMassive: false,
      title: 'Conferma Accorpamento',
      message: `Stai per accorpare ${activeDocs.length} documenti del cliente:\n${clienteNome}\n\nVerrà generato un nuovo documento: ${targetDesc}. Procedere?`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        setIsProcessing(true);
        try {
          const result: any = await executeMergeForClient(selectedClient, activeDocs.map((d: any) => Number(d.ID)));
          queryClient.invalidateQueries(); // Forza il ricaricamento globale
          setShowClientDocs(false);
          setSelectedClient(null); 
          setExcludedDocs(new Set());
          setSuccessDialog({ isOpen: true, message: `Documento generato con successo per:\n${clienteNome}`, newDocId: result.newDocId });
        } catch (error: any) { alert("Errore: " + error.message); } 
        finally { setIsProcessing(false); }
      }
    });
  };

  const startMassive = () => {
    if (!sourceType || !targetType) return;
    const validClients = (clienti || []).filter((c: any) => !excludedClients.has(Number(c.ID)));
    if (validClients.length === 0) return;
    setMassState({ isActive: true, queue: validClients, currentIndex: 0, successCount: 0, isFetching: false });
  };

  useEffect(() => {
    if (massState.isActive && !massState.isFetching && !confirmDialog.isOpen && !successDialog.isOpen && !viewDocument) {
      if (massState.currentIndex < massState.queue.length) {
        const currentClient = massState.queue[massState.currentIndex];
        setMassState(prev => ({ ...prev, isFetching: true }));
        
        fetch(`${API_HOST}/api.php?action=get_documenti_da_accorpare&tipoDoc=${sourceType}&idCliente=${currentClient.ID}`)
          .then(res => res.json())
          .then(docs => {
            if (docs && docs.length > 0) {
              const targetDesc = tipiDoc?.find((t: any) => Number(t.id) === Number(targetType))?.descrizione || 'Documento';
              setConfirmDialog({
                isOpen: true, isMassive: true,
                title: `Accorpamento ${massState.currentIndex + 1} di ${massState.queue.length}`,
                message: `Cliente: ${currentClient.Ragione_Sociale}\nDocumenti da accorpare: ${docs.length}\n\nVerrà generato: ${targetDesc}\nVuoi procedere?`,
                onConfirm: async () => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  setIsProcessing(true);
                  try {
                    const result: any = await executeMergeForClient(Number(currentClient.ID), docs.map((d: any) => Number(d.ID)));
                    queryClient.invalidateQueries({ queryKey: ['fatture'] });
                    setSuccessDialog({ isOpen: true, message: `Documento generato con successo per:\n${currentClient.Ragione_Sociale}`, newDocId: result.newDocId });
                  } catch (e: any) {
                    alert("Errore: " + e.message);
                    setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, isFetching: false }));
                  } finally { setIsProcessing(false); }
                },
                onSkip: () => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, isFetching: false }));
                },
                onAbort: () => {
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  setMassState(prev => ({ ...prev, isActive: false, isFetching: false }));
                  setSuccessDialog({ isOpen: true, message: `Operazione interrotta dall'utente.\n\nDocumenti generati finora: ${massState.successCount}` });
                }
              });
            } else {
              setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, isFetching: false }));
            }
          })
          .catch(() => {
            setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, isFetching: false }));
          });
      } else {
        setMassState(prev => ({ ...prev, isActive: false, isFetching: false }));
        setSuccessDialog({ isOpen: true, message: `Elaborazione massiva completata!\n\nDocumenti generati totali: ${massState.successCount}` });
      }
    }
  }, [massState, confirmDialog.isOpen, successDialog.isOpen, viewDocument, sourceType, targetType, tipiDoc]);

  const openGeneratedDoc = async (id: number) => {
    let docToOpen = tutteLeFatture?.find((f:any) => Number(f.ID) === Number(id));
    if (!docToOpen) {
      try {
        const res = await fetch(`${API_HOST}/api.php?action=fatture`);
        const data = await res.json();
        docToOpen = data.find((f:any) => Number(f.ID) === Number(id));
      } catch (e) {}
    }
    if (docToOpen) {
      setSuccessDialog({ isOpen: false, message: '' });
      setViewDocument(docToOpen);
    } else {
      alert("Errore nel caricamento del documento generato.");
    }
  };

  const handleCloseDocumentDetail = () => {
    setViewDocument(null);
    if (massState.isActive) {
      setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, successCount: prev.successCount + 1, isFetching: false }));
    }
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      
      {/* Visualizzazione Dettaglio Fattura (Es. Al click sull'occhio o dopo la generazione) */}
      {viewDocument && (
        <div className="fixed inset-0 z-[250]">
          <DocumentDetail document={viewDocument} onClose={handleCloseDocumentDetail} onEdit={() => {}} onToggle={(field) => setViewDocument((prev: any) => prev ? { ...prev, [field]: -1 } : prev)} />
        </div>
      )}

      {/* MODALE PRINCIPALE */}
      <div onClick={e => e.stopPropagation()} className="bg-background sm:rounded-xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-5xl max-h-[100dvh] sm:max-h-[90vh] flex flex-col animate-fade-up sm:animate-fade-in">
        
		{/* HEADER MODALE PRINCIPALE */}
        <div className="px-6 py-4 border-b border-border bg-slate-800 text-white flex justify-between items-center shrink-0 sm:rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><Layers className="w-6 h-6 text-purple-400" /></div>
            <div>
              <h2 className="text-xl font-bold uppercase tracking-wider">Accorpamento Documenti</h2>
              <p className="text-xs text-slate-300 font-medium">Fatturazione differita massiva</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => queryClient.invalidateQueries()} className="hover:bg-white/20 p-2 rounded-full transition-colors text-white" title="Aggiorna Dati">
              <RefreshCcw className="w-5 h-5" />
            </button>
            <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors text-white">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* CORPO MODALE PRINCIPALE */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar flex flex-col gap-4 sm:gap-6 min-h-0">
          
          {/* SELEZIONE ORIGINE */}
          <div className="bg-card p-4 rounded-xl border border-border flex flex-col md:flex-row gap-4 sm:gap-6 items-start md:items-center shrink-0">
            <div className="w-full md:w-1/3">
              <label className="block text-[11px] font-bold text-muted-foreground mb-1.5 uppercase tracking-wider">1. Documenti da Raggruppare</label>
              <select className={`${inputClass} font-semibold`} value={sourceType} onChange={handleSourceTypeChange}>
                <option value={0}>-- Seleziona origine --</option>
                {tipiDocSorgente?.map((t: any) => <option key={t.id} value={t.id}>{t.descrizione}</option>)}
              </select>
            </div>
            <div className="text-sm text-muted-foreground bg-secondary/50 p-3 rounded-lg border border-border w-full md:w-2/3 flex items-center gap-3 h-full">
              <FileText className="w-5 h-5 text-primary shrink-0" />
              <p>Seleziona il tipo di documento aperto (es. DDT). Il sistema mostrerà i clienti con movimenti non ancora fatturati. Clicca su <b>Vedi Documenti</b> per procedere con il singolo cliente.</p>
            </div>
          </div>

          {/* LISTA CLIENTI */}
          <div className="flex-1 flex flex-col bg-card rounded-xl border border-border overflow-hidden min-h-[250px] shadow-sm">
            <div className="bg-secondary/30 px-4 py-3 border-b border-border flex justify-between items-center shrink-0">
              <h3 className="font-bold text-foreground text-sm uppercase tracking-wider">Clienti con movimenti da accorpare</h3>
              <span className="bg-background border border-border text-foreground text-xs py-1 px-3 rounded-full font-bold shadow-sm">{clienti?.length || 0} Trovati</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 scrollbar-thin bg-slate-50">
              {loadingClienti && <div className="p-8 text-center text-muted-foreground animate-pulse font-medium">Ricerca documenti in corso...</div>}
              {!loadingClienti && (!clienti || clienti.length === 0) && sourceType > 0 && (
                <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-6 text-center">
                  <CheckCircle2 className="w-12 h-12 mb-3 opacity-30 text-success" />
                  <p>Nessun documento in sospeso per questa tipologia.</p>
                </div>
              )}
              {!loadingClienti && clienti?.map((c: any) => {
                const isExcluded = excludedClients.has(Number(c.ID));
                return (
                  <div key={c.ID} onClick={() => { setSelectedClient(Number(c.ID)); setExcludedDocs(new Set()); setShowClientDocs(true); }}
                    className={`flex items-center justify-between gap-3 p-3 mb-2 rounded-lg cursor-pointer transition-all border shadow-sm ${isExcluded ? 'bg-background border-border/50 opacity-60' : 'bg-white border-border hover:border-primary/50 hover:shadow-md'}`}>
                    
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      <button onClick={(e) => handleToggleClient(e, Number(c.ID))} className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isExcluded ? 'text-destructive/50 hover:bg-destructive/10' : 'text-success hover:bg-success/10'}`} title={isExcluded ? "Includi nel massivo" : "Escludi dal massivo"}>
                        {isExcluded ? <XCircle className="w-6 h-6" /> : <CheckCircle2 className="w-6 h-6" />}
                      </button>
                      <span className={`font-semibold text-sm sm:text-base truncate ${isExcluded ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{c.Ragione_Sociale}</span>
                    </div>

                    <button className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-primary bg-primary/10 px-3 py-2 rounded-lg hover:bg-primary hover:text-white transition-colors shrink-0">
                      <Eye className="w-4 h-4" /> <span className="hidden sm:inline">VEDI DOCUMENTI</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

{/* FOOTER MODALE PRINCIPALE CON CASSETTO A SCOMPARSA */}
        <div className="bg-card border-t border-border sm:rounded-b-xl shrink-0 flex flex-col z-10 shadow-[0_-8px_30px_rgba(0,0,0,0.08)]">
          
          {/* BOTTONE APRI/CHIUDI (Ben evidenziato, visibile solo su schermi piccoli) */}
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="md:hidden w-full flex items-center justify-center gap-2 py-3 bg-secondary/80 text-[11px] tracking-widest font-black text-foreground hover:bg-secondary transition-colors border-b border-border shadow-inner"
          >
            {showSettings ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {showSettings ? 'NASCONDI IMPOSTAZIONI MASSIVE' : 'MOSTRA IMPOSTAZIONI MASSIVE'}
          </button>

          {/* CONTENUTO FOOTER (Sempre visibile su PC, a comparsa su Mobile) */}
          <div className={`${showSettings ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-center justify-between gap-4 p-4 sm:p-5 overflow-y-auto max-h-[40vh] md:max-h-none custom-scrollbar`}>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 w-full md:w-auto">
              <div className="w-full sm:w-56">
                <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase">2. TIPO DOC. DESTINAZIONE</label>
                <select className={inputClass} value={targetType} onChange={(e) => setTargetType(Number(e.target.value))}>
                  <option value={0}>-- Seleziona --</option>
                  {tipiDoc?.map((t: any) => <option key={t.id} value={t.id}>{t.descrizione}</option>)}
                </select>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <div className="w-1/2 sm:w-24">
                  <label className="block text-[10px] font-bold text-destructive mb-1 uppercase text-center">PROX. N. DOC</label>
                  <div className="w-full px-3 py-[9px] bg-destructive/10 border border-destructive/20 text-destructive text-sm rounded-lg font-bold text-center">{nextDocNumber}</div>
                </div>
                <div className="w-1/2 sm:w-36">
                  <label className="block text-[10px] font-bold text-muted-foreground mb-1 uppercase">DATA DOCUMENTO</label>
                  <input type="date" className={inputClass} value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="w-full md:w-auto pt-2 md:pt-0 border-t border-border md:border-none">
              <button 
				  onClick={startMassive} 
				  disabled={!sourceType || !targetType || isProcessing || !clienti || clienti.length === 0 || !canAccorpare} 
				  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-accent text-accent-foreground hover:opacity-90 font-bold rounded-lg transition-opacity disabled:opacity-50 disabled:cursor-not-allowed shadow-sm border border-border"
				  >
				{isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                <span className="text-sm">ACCORPAMENTO MASSIVO</span>
              </button>
            </div>
          </div>
        </div>
</div>

      {/* SOTTO-MODALE: DETTAGLIO DOCUMENTI DEL CLIENTE SINGOLO */}
      {showClientDocs && selectedClient && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowClientDocs(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-background sm:rounded-xl border border-border shadow-2xl w-full h-[95dvh] sm:h-auto max-w-4xl max-h-[95dvh] sm:max-h-[90vh] flex flex-col animate-fade-up sm:animate-fade-in">
            
            <div className="px-5 py-4 border-b border-border bg-card flex justify-between items-center shrink-0 sm:rounded-t-xl">
              <div>
                <h3 className="font-bold text-lg text-foreground">Documenti da Accorpare</h3>
                <p className="text-sm text-primary font-medium">{clienti?.find((c:any) => Number(c.ID) === selectedClient)?.Ragione_Sociale}</p>
              </div>
              <button onClick={() => setShowClientDocs(false)} className="p-2 hover:bg-secondary rounded-full transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 sm:p-4 bg-slate-50 scrollbar-thin">
              {/* TABELLA DESKTOP */}
              <div className="hidden sm:block border border-border rounded-lg overflow-x-auto bg-white shadow-sm">
                <table className="w-full text-sm text-left">
                  <thead className="text-[11px] font-bold text-muted-foreground uppercase bg-secondary/50 border-b border-border">
                    <tr><th className="px-4 py-3 text-center w-20">INCLUDI</th><th className="px-4 py-3">NUM</th><th className="px-4 py-3">DATA</th><th className="px-4 py-3 text-right">IMPONIBILE</th><th className="px-4 py-3 text-right">IMPOSTA</th><th className="px-4 py-3 text-center w-24">AZIONI</th></tr>
                  </thead>
                  <tbody>
                    {documentiCliente?.map((d: any) => {
                      const isExcluded = excludedDocs.has(Number(d.ID));
                      return (
                        <tr key={d.ID} onClick={() => setViewDocument(d)} className={`border-b border-border last:border-0 transition-colors cursor-pointer ${isExcluded ? 'bg-secondary/20' : 'bg-background hover:bg-secondary/40'}`}>
                          <td className="px-4 py-2 text-center" onClick={e=>e.stopPropagation()}><input type="checkbox" checked={!isExcluded} onChange={(e) => handleToggleDoc(e as any, Number(d.ID))} className="w-4 h-4 text-primary bg-background border-border rounded cursor-pointer" /></td>
                          <td className={`px-4 py-3 font-medium font-mono ${isExcluded ? 'text-muted-foreground' : 'text-primary'}`}>{d.Num}</td>
                          <td className={`px-4 py-3 font-medium ${isExcluded ? 'text-muted-foreground' : ''}`}>{formatDate(d.datafatt)}</td>
                          <td className={`px-4 py-3 text-right font-mono ${isExcluded ? 'text-muted-foreground' : ''}`}>{formatCurrency(Number(d.impondoc))}</td>
                          <td className={`px-4 py-3 text-right font-mono ${isExcluded ? 'text-muted-foreground' : ''}`}>{formatCurrency(Number(d.ivadoc))}</td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={(e) => { e.stopPropagation(); setViewDocument(d); }} className="text-primary hover:text-white p-1.5 bg-primary/10 hover:bg-primary rounded transition-colors flex items-center justify-center mx-auto" title="APRI">
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* CARD MOBILE */}
              <div className="sm:hidden flex flex-col gap-2">
                {documentiCliente?.map((d: any) => {
                  const isExcluded = excludedDocs.has(Number(d.ID));
                  return (
                    <div key={d.ID} onClick={() => setViewDocument(d)} className={`flex flex-col p-3 rounded-xl border transition-all cursor-pointer shadow-sm ${isExcluded ? 'bg-secondary/30 border-dashed border-border opacity-60' : 'bg-white border-border hover:shadow-md'}`}>
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/50">
                        <div className="flex items-center gap-2" onClick={e=>e.stopPropagation()}>
                          <input type="checkbox" checked={!isExcluded} onChange={(e) => handleToggleDoc(e as any, Number(d.ID))} className="w-5 h-5 text-primary rounded cursor-pointer" />
                          <span className="text-xs font-bold uppercase text-muted-foreground ml-1">{isExcluded ? 'Escluso' : 'Incluso'}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setViewDocument(d); }} className="flex items-center gap-1 text-[10px] font-bold bg-primary/10 text-primary px-2 py-1 rounded hover:bg-primary hover:text-white transition-colors">
                          <Eye className="w-3 h-3" /> VEDI
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className={`text-sm font-mono font-bold ${isExcluded ? 'text-muted-foreground' : 'text-primary'}`}>Doc. N° {d.Num}</span>
                          <span className={`text-xs font-medium ${isExcluded ? 'text-muted-foreground' : 'text-slate-600'}`}>{formatDate(d.datafatt)}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">Totale</span>
                          <span className={`text-base font-mono font-black ${isExcluded ? 'text-muted-foreground' : 'text-slate-800'}`}>
                            {formatCurrency(Number(d.impondoc) + Number(d.ivadoc))}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-card border-t border-border p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-center gap-4 sm:rounded-b-xl shrink-0">
              <div className="flex items-center justify-between sm:justify-start gap-6 bg-secondary/30 px-4 py-2 rounded-lg border border-border w-full sm:w-auto">
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-muted-foreground uppercase">TOT. IMPONIBILE</span>
                  <span className="text-sm font-bold text-foreground">{formatCurrency(totImponibile)}</span>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] font-bold text-primary uppercase">TOT. DOCUMENTO</span>
                  <span className="text-base font-black text-primary">{formatCurrency(totDocumento)}</span>
                </div>
              </div>
			  <button 
                onClick={triggerAccorpaSingolo} 
                disabled={activeDocs.length === 0 || isProcessing || !canAccorpare} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-lg transition-opacity hover:opacity-90 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                <span className="text-sm">ACCORPA SELEZIONATI</span>
              </button>
	
            </div>
          </div>
        </div>
      )}

      {/* DIALOGHI DI CONFERMA E SUCCESSO */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => !isProcessing && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-border max-h-[90vh]">
            <div className="p-6 flex flex-col items-center text-center overflow-y-auto flex-1 custom-scrollbar">
              <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-4 shrink-0"><AlertTriangle className="w-8 h-8 text-warning" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2 shrink-0">{confirmDialog.title}</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{confirmDialog.message}</p>
            </div>
            <div className="bg-secondary/30 p-4 border-t border-border flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
              {confirmDialog.isMassive ? (
                <>
                  <button onClick={confirmDialog.onAbort} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg border border-destructive/30 text-destructive text-sm font-bold hover:bg-destructive/10 transition-colors sm:mr-auto disabled:opacity-50">Interrompi</button>
                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button onClick={confirmDialog.onSkip} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg bg-secondary text-secondary-foreground text-sm font-bold hover:bg-secondary/80 transition-opacity shadow-sm border border-border flex items-center gap-1 disabled:opacity-50">Salta <FastForward className="w-4 h-4"/></button>
                    <button onClick={confirmDialog.onConfirm} disabled={isProcessing} className="w-full sm:w-auto flex items-center justify-center px-4 py-3 sm:py-2.5 rounded-xl sm:rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
                      {isProcessing ? 'Elaborazione...' : 'Procedi'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))} disabled={isProcessing} className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl sm:rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">Annulla</button>
                  <button onClick={confirmDialog.onConfirm} disabled={isProcessing} className="w-full sm:w-auto px-5 py-3 sm:py-2.5 rounded-xl sm:rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50">
                    {isProcessing ? 'Elaborazione...' : 'Sì, procedi'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {successDialog.isOpen && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4 animate-fade-in" onClick={() => {
          setSuccessDialog({ isOpen: false, message: '' });
          if (massState.isActive) setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, successCount: prev.successCount + 1, isFetching: false }));
        }}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden border border-border">
            <div className="p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4"><FileCheck className="w-8 h-8 text-success" /></div>
              <h3 className="text-xl font-bold text-foreground mb-2">Operazione Completata</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{successDialog.message}</p>
            </div>
            <div className="bg-secondary/30 p-4 border-t border-border flex justify-end gap-3">
              <button onClick={() => {
                setSuccessDialog({ isOpen: false, message: '' });
                if (massState.isActive) setMassState(prev => ({ ...prev, currentIndex: prev.currentIndex + 1, successCount: prev.successCount + 1, isFetching: false }));
              }} className="px-5 py-2.5 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors sm:mr-auto">
                {massState.isActive ? 'Prosegui' : 'Chiudi'}
              </button>
              {successDialog.newDocId && (
                <button onClick={() => {
                  openGeneratedDoc(successDialog.newDocId!);
                }} className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2">
                  <Eye className="w-4 h-4" /> Apri Documento
                </button>
              )}
            </div>
          </div>
        </div>
      )}
	
	  {/* GESTORE MESSAGGI GENERICI (es. Avvisi) */}
      <ConfirmDialog 
        isOpen={feedback.isOpen} 
        type={feedback.type} 
        title={feedback.title} 
        message={feedback.msg}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
        onConfirm={feedback.onConfirm}
        confirmLabel={feedback.confirmLabel || 'OK'}
      />
	
	{/* MODALE DI AVVISO (SOLA LETTURA) CHE APPARE ALL'APERTURA */}
      <ConfirmDialog 
        isOpen={permissionWarning} 
        type="warning" 
        title="Accesso Limitato" 
        message={<>Il tuo profilo non ha i permessi necessari (Livello 3 o superiore) per generare nuovi documenti.<br/><br/>Puoi consultare le liste dei documenti da accorpare, ma l'esecuzione è disabilitata.</>}
        confirmLabel="Ho capito"
        hideCancel={true}
        onClose={() => setPermissionWarning(false)} 
        onConfirm={() => setPermissionWarning(false)}
      />
	  
    </div>
  );
}