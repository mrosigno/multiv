import { useState, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Eye, Plus, ArrowUpDown, ArrowUp, ArrowDown, Settings, X, Pencil, Upload, Layers, Calculator, Package, ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import { Fattura } from '@/data/mockData';
import { useMenu } from '@/contexts/MenuContext';
import { useClienti } from '@/hooks/api/useClienti';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';
import { useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess'; 
import DocumentDetail from './DocumentDetail';
import DocumentFormModal from './DocumentFormModal';
import MovimentiViewerModal from './MovimentiViewerModal';
import ImportFlussiSdiModal from './ImportFlussiSdiModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import VerificaIncongruenzeModal from './VerificaIncongruenzeModal';
import AccorpamentoModal from './AccorpamentoModal';

interface DocumentListProps {
  documents: Fattura[];
  onUpdate: (updated: Fattura[]) => void;
}

type SortCol = 'datafatt' | 'Tipo' | 'ragioneSociale';
type SortDir = 'asc' | 'desc';
const SORT_KEY = 'gestionale_doc_sort';

const DocumentList = ({ documents, onUpdate }: DocumentListProps) => {
  const queryClient = useQueryClient();
  const auth = useAuthAccess();
  // Regola: Modifica gli esistenti SOLO se Livello 2, oppure da 4 in su.
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  const { setHeaderTitle, setPagination } = useMenu();
  
  const latestDocs = useRef<Fattura[]>(documents);

  useEffect(() => {
    latestDocs.current = documents;
  }, [documents]);

  const [selectedDoc, setSelectedDoc] = useState<Fattura | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState<Fattura | null>(null);
  
  const [showImportSdiModal, setShowImportSdiModal] = useState(false);
  const [showAccorpamentoModal, setShowAccorpamentoModal] = useState(false);

  const [viewerModal, setViewerModal] = useState<{ isOpen: boolean, doc: Fattura | null, type: 'contabilita' | 'magazzino' }>({ isOpen: false, doc: null, type: 'contabilita' });
  const [verificaModal, setVerificaModal] = useState<'contabilita' | 'magazzino' | 'accorpamenti' | null>(null);
  const [isVerificaModalVisible, setIsVerificaModalVisible] = useState(false);
  
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: any, onConfirm?: () => void, confirmLabel?: string }>({ isOpen: false, type: 'info', title: '', msg: '' });

  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  const [massQueue, setMassQueue] = useState<Fattura[]>([]);
  const [currentMassIndex, setCurrentMassIndex] = useState(0);
  const [massActionType, setMassActionType] = useState<'contabilizza' | 'movimenta' | null>(null);
  const [processedCount, setProcessedCount] = useState(0);
  const [showMassActions, setShowMassActions] = useState(false);
  const [showFooter, setShowFooter] = useState(false);
  
  const { data: clientiData, isLoading: clientiLoading, isError: clientiError } = useClienti();
  const { data: tipiDocData = [], isLoading: tipiLoading } = useTipiDocumento();

  const [sortCol, setSortCol] = useState<SortCol>(() => { try { return (JSON.parse(localStorage.getItem(SORT_KEY) || '{}').col) || 'datafatt'; } catch { return 'datafatt'; } });
  const [sortDir, setSortDir] = useState<SortDir>(() => { try { return (JSON.parse(localStorage.getItem(SORT_KEY) || '{}').dir) || 'desc'; } catch { return 'desc'; } });

  useEffect(() => {
    setPage(0);
  }, [documents]);
  
 

  const toggleSort = (col: SortCol) => {
    const newDir = sortCol === col ? (sortDir === 'asc' ? 'desc' : 'asc') : (col === 'datafatt' ? 'desc' : 'asc');
    setSortCol(col); setSortDir(newDir); localStorage.setItem(SORT_KEY, JSON.stringify({ col, dir: newDir }));
  };

  const getCliente = (id: number) => (clientiData || []).find((c: any) => Number(c.ID) === Number(id));
  const getTipoObj = (id: number) => tipiDocData.find((t: any) => Number(t.id) === Number(id));
  const getTipo = (id: number) => getTipoObj(id)?.descrizione || '?';

  const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const formatDate = (d: string) => { if (!d) return '-'; const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };

  const totalImponibile = documents.reduce((sum, d) => sum + Number(d.impondoc || 0), 0);
  const totalDocumento = documents.reduce((sum, d) => sum + Number(d.impondoc || 0) + Number(d.ivadoc || 0), 0);

  const sorted = [...documents].sort((a, b) => {
    if (sortCol === 'datafatt') return sortDir === 'asc' ? String(a.datafatt).localeCompare(String(b.datafatt)) : String(b.datafatt).localeCompare(String(a.datafatt));
    if (sortCol === 'Tipo') return sortDir === 'asc' ? String(getTipo(a.Tipo)).localeCompare(String(getTipo(b.Tipo))) : String(getTipo(b.Tipo)).localeCompare(String(getTipo(a.Tipo)));
    const ra = getCliente(a.IDCliente)?.Ragione_Sociale || ''; const rb = getCliente(b.IDCliente)?.Ragione_Sociale || '';
    return sortDir === 'asc' ? String(ra).localeCompare(String(rb)) : String(rb).localeCompare(String(ra));
  });

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  // Trasmette costantemente i dati all'AppLayout
  useEffect(() => {
    setHeaderTitle('Elenco Documenti');
    setPagination({
      page,
      totalPages,
      pageSize,
      totalRecords: documents.length,
      onPageChange: (newPage: number) => setPage(newPage),
      onPageSizeChange: (newSize: number) => { setPageSize(newSize); setPage(0); }
    });

    // Quando l'utente esce dalla pagina, svuota l'Header!
    return () => {
      setHeaderTitle('');
      setPagination(undefined);
    };
  }, [page, totalPages, pageSize, documents.length]);
  

  const handleMassContabilizza = () => {
    const docsToProcess = sorted.filter(d => Number(d.registrata) === 0 && (getTipoObj(d.Tipo)?.da === '+' || getTipoObj(d.Tipo)?.da === '-'));
    if (docsToProcess.length === 0) {
      setFeedback({ isOpen: true, type: 'warning', title: 'Nessun Documento', msg: "Non ci sono documenti da contabilizzare nell'elenco attuale.", confirmLabel: 'OK', onConfirm: undefined });
      return;
    }
    setMassQueue(docsToProcess); setCurrentMassIndex(0); setProcessedCount(0); setMassActionType('contabilizza');
    setShowMassActions(false);
  };

  const handleMassMovimenta = () => {
    const docsToProcess = sorted.filter(d => Number(d.caricata) === 0 && ['C', 'S', 'T'].includes(getTipoObj(d.Tipo)?.movmagaz || ''));
    if (docsToProcess.length === 0) {
      setFeedback({ isOpen: true, type: 'warning', title: 'Nessun Documento', msg: "Non ci sono documenti da movimentare nell'elenco attuale.", confirmLabel: 'OK', onConfirm: undefined });
      return;
    }
    setMassQueue(docsToProcess); setCurrentMassIndex(0); setProcessedCount(0); setMassActionType('movimenta');
    setShowMassActions(false);
  };

  const advanceMassQueue = (wasProcessed: boolean) => {
    const newCount = wasProcessed ? processedCount + 1 : processedCount;
    setProcessedCount(newCount);
    if (currentMassIndex + 1 < massQueue.length) {
      setCurrentMassIndex(prev => prev + 1);
    } else {
      setMassQueue([]); setMassActionType(null);
      setFeedback({ isOpen: true, type: 'success', title: 'Operazione Completata', msg: `Sono stati elaborati ${newCount} documenti su ${massQueue.length}.`, confirmLabel: 'OK', onConfirm: undefined });
    }
  };

  const abortMassQueue = () => {
    setMassQueue([]); setMassActionType(null);
    setFeedback({ 
      isOpen: true, 
      type: 'info', 
      title: 'Operazione Interrotta', 
      msg: `L'elaborazione è stata fermata dall'utente.\nDocumenti elaborati finora: ${processedCount}.`,
      confirmLabel: 'OK',
      onConfirm: undefined 
    });
  };

  const handleToggle = async (docId: number, field: 'verificato' | 'registrata' | 'caricata' | 'accorpa') => {
    const doc = latestDocs.current.find(d => d.ID === docId) || selectedDoc || massQueue.find(d => d.ID === docId);
    if (!doc) return;
    const newValue = Number(doc[field]) !== 0 ? 0 : -1;

    const executeToggle = async () => {
      try {
        const res = await fetch(`${API_HOST}/api.php?action=toggle_document_status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: docId, field, value: newValue })
        });
        const data = await res.json();
        
        if (data.success) {
          queryClient.setQueriesData({ queryKey: ['fatture'] }, (old: any) => {
            if (!Array.isArray(old)) return old;
            return old.map((d: any) => d.ID === docId ? { ...d, [field]: newValue } : d);
          });
          onUpdate(latestDocs.current.map(d => d.ID === docId ? { ...d, [field]: newValue } : d));
          setSelectedDoc(prev => prev?.ID === docId ? { ...prev, [field]: newValue } : prev);
          setMassQueue(prev => prev.map(d => d.ID === docId ? { ...d, [field]: newValue } : d));

          if (field === 'registrata') { queryClient.invalidateQueries({ queryKey: ['prima_nota'] }); queryClient.invalidateQueries({ queryKey: ['scadenzario'] }); }
          if (field === 'caricata') { queryClient.invalidateQueries({ queryKey: ['carichi'] }); queryClient.invalidateQueries({ queryKey: ['scarichi'] }); queryClient.invalidateQueries({ queryKey: ['trasferimenti'] }); }
          
          setFeedback({ isOpen: true, type: 'success-auto', title: 'Stato Aggiornato', msg: '', confirmLabel: 'OK', onConfirm: undefined }); 
        } else { 
          setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: data.message, confirmLabel: 'OK', onConfirm: undefined }); 
        }
      } catch (e) { 
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore Server', msg: "Errore di connessione.", confirmLabel: 'OK', onConfirm: undefined }); 
      }
    };

    if (newValue === 0) {
      if (field === 'registrata') {
        setFeedback({ 
          isOpen: true, type: 'danger', title: 'Annulla Contabilizzazione', confirmLabel: 'Sì, Annulla',
          msg: 'Stai per annullare la contabilizzazione del documento.\nVerranno eliminati definitivamente tutti i movimenti in Prima Nota e nello Scadenzario collegati a questa fattura.\nVuoi procedere?', 
          onConfirm: () => { setFeedback(prev => ({ ...prev, isOpen: false })); executeToggle(); } 
        });
        return;
      }
      if (field === 'caricata') {
        setFeedback({ 
          isOpen: true, type: 'danger', title: 'Annulla Movimentazione', confirmLabel: 'Sì, Annulla',
          msg: 'Stai per annullare la movimentazione di magazzino.\nVerranno eliminati definitivamente tutti i Carichi, Scarichi e Trasferimenti collegati a questo documento.\nVuoi procedere?', 
          onConfirm: () => { setFeedback(prev => ({ ...prev, isOpen: false })); executeToggle(); } 
        });
        return;
      }
    }
    executeToggle();
  };

  const handleRemoveFromList = (docId: number) => {
    onUpdate(latestDocs.current.filter(d => d.ID !== docId));
    queryClient.setQueriesData({ queryKey: ['fatture'] }, (old: any) => {
      if (!Array.isArray(old)) return old;
      return old.filter((d: any) => d.ID !== docId);
    });
  };
  
  const handleSave = async (doc: Fattura) => {
    try {
      const res = await fetch(`${API_HOST}/api.php?action=save_fattura`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(doc)
      });
      const data = await res.json();
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ['fatture'] });
        setShowForm(false);
        if (!editDoc) { setSelectedDoc({ ...doc, ID: data.id }); }
        setEditDoc(null);
        setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: '', confirmLabel: 'OK', onConfirm: undefined });
      } else { 
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: data.message, confirmLabel: 'OK', onConfirm: undefined }); 
      }
    } catch (e) { 
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore Server', msg: "Connessione fallita.", confirmLabel: 'OK', onConfirm: undefined }); 
    }
  };

  const SortIcon = ({ col }: { col: SortCol }) => { if (sortCol !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />; return sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />; };

  const activeDoc = massQueue.length > 0 ? massQueue[currentMassIndex] : selectedDoc;
  
  const StatusCell = ({ value, field, docId, onView }: any) => {
    const isChecked = Number(value) !== 0;

    const handleSafeToggle = (e: any) => {
      e.stopPropagation();
      if (!auth.canEdit) {
        setFeedback({ isOpen: true, type: 'warning', title: 'Accesso Negato', msg: 'Non hai i permessi per modificare lo stato dei documenti.', confirmLabel: 'OK', onConfirm: undefined });
        return;
      }
      handleToggle(docId, field);
    };

    return (
      <div className="flex items-center justify-center gap-1">
        {isChecked ? (
          <div className="flex items-center gap-1">
            {onView && (
              <button onClick={(e) => { e.stopPropagation(); onView(); }} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-success/40 bg-success/10 text-success text-[10px] font-bold hover:bg-success/20 transition-colors" title="Visualizza movimenti generati">
                <CheckCircle2 className="w-3 h-3" /> vedi
              </button>
            )}
            <button onClick={handleSafeToggle} className={`p-0.5 rounded-full transition-colors ${auth.canEdit ? 'text-muted-foreground hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground opacity-40 cursor-not-allowed'}`} title="Annulla registrazione">
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : (
          <button onClick={handleSafeToggle} className={`p-1 rounded-full transition-colors ${auth.canEdit ? 'text-destructive/40 hover:text-destructive hover:bg-destructive/10' : 'text-muted-foreground opacity-40 cursor-not-allowed'}`} title="Imposta manualmente">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  };

  return (
    <>
	 
	 {/* ========================================== */}
      {/* BARRA AZIONI (Paginazione spostata su AppLayout) */}
      {/* ========================================== */}
      <div className="flex items-center justify-between gap-3 mb-4 bg-card p-3 rounded-xl border border-border shadow-sm">
        
        {/* Titolo Sezione (Visibile solo su schermi leggermente più larghi) */}
        <h2 className="hidden sm:block text-sm font-bold text-muted-foreground uppercase tracking-wider shrink-0">
          Azioni
        </h2>
        
        {/* Gruppo Pulsanti (Si espande al 100% su iPhone SE) */}
        <div className="flex items-center justify-between w-full sm:w-auto gap-2">
          
          {auth.canCreate && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowImportSdiModal(true); }} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs font-bold transition-all shadow-sm border border-amber-500 bg-white text-amber-600 hover:bg-amber-50 active:scale-95" 
              title="Importa XML"
            >
              <Upload className="w-4 h-4 shrink-0" /> 
              {/* Nascondiamo il testo sotto i 400px per far respirare i bottoni */}
              <span className="hidden min-[400px]:inline">XML</span>
            </button>
          )}
          
          {auth.canEdit && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowMassActions(true); }} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg text-xs font-bold transition-all shadow-sm border bg-white border-slate-300 text-slate-700 hover:bg-slate-50 active:scale-95" 
              title="Operazioni Massive e Audit"
            >
              <MoreHorizontal className="w-4 h-4 shrink-0" /> 
              <span className="hidden min-[400px]:inline">Massive</span>
            </button>
          )}
          
          {auth.canCreate && (
            <button 
              onClick={(e) => { e.stopPropagation(); setEditDoc(null); setShowForm(true); }} 
              className="flex-[1.2] sm:flex-none flex items-center justify-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-opacity shadow-sm border border-blue-700 active:scale-95" 
              title="Nuovo Documento"
            >
              <Plus className="w-4 h-4 shrink-0" /> 
              <span>Nuovo</span>
            </button>
          )}

        </div>
      </div>
	 
	 
      {/* TABELLA DESKTOP (Solo Monitor Grandi) */}
      <div className="hidden xl:flex xl:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-24">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-table-header text-muted-foreground text-left">
                <th className="px-4 py-3 font-medium">Num</th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('datafatt')}><span className="flex items-center gap-1">Data <SortIcon col="datafatt" /></span></th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none" onClick={() => toggleSort('Tipo')}><span className="flex items-center gap-1">Tipo <SortIcon col="Tipo" /></span></th>
                <th className="px-4 py-3 font-medium cursor-pointer select-none min-w-[250px]" onClick={() => toggleSort('ragioneSociale')}><span className="flex items-center gap-1">Cliente <SortIcon col="ragioneSociale" /></span></th>
                <th className="px-4 py-3 font-medium text-right">Imponibile</th>
                <th className="px-4 py-3 font-medium text-right">IVA</th>
                <th className="px-4 py-3 font-medium text-center">Ver.</th>
                <th className="px-4 py-3 font-medium text-center">Reg.</th>
                <th className="px-4 py-3 font-medium text-center">Car.</th>
                <th className="px-4 py-3 font-medium text-center">Modifiche</th>
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nessun documento trovato</td></tr>}
              {paged.map((doc, idx) => {
                const cliente = getCliente(doc.IDCliente);
                return (
                  <tr key={doc.ID} className={`border-t border-border hover:bg-table-row-hover transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`} onClick={() => setSelectedDoc(doc)}>
                    <td className="px-4 py-3 text-mono font-medium text-foreground">{doc.Num}</td>
                    <td className="px-4 py-3 text-foreground">{formatDate(doc.datafatt)}</td>
                    <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-badge-info text-badge-info-foreground">{getTipo(doc.Tipo)}</span></td>
                    <td className="px-4 py-3 text-foreground max-w-[350px] truncate" title={cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || '-'}>{cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || '-'}</td>
                    <td className="px-4 py-3 text-right text-mono text-foreground">{formatCurrency(doc.impondoc)}</td>
                    <td className="px-4 py-3 text-right text-mono text-foreground">{formatCurrency(doc.ivadoc)}</td>
                    
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}><StatusCell value={doc.verificato} field="verificato" docId={doc.ID} /></td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}><StatusCell value={doc.registrata} field="registrata" docId={doc.ID} onView={() => setViewerModal({ isOpen: true, doc, type: 'contabilita' })} /></td>
                    <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}><StatusCell value={doc.caricata} field="caricata" docId={doc.ID} onView={() => setViewerModal({ isOpen: true, doc, type: 'magazzino' })} /></td>
                    
					<td className="px-2 py-3 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => setSelectedDoc(doc)} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[10px] font-bold shadow-sm" title="Apri le righe e il dettaglio del documento"><Eye className="w-3 h-3" /> Dettaglio</button>
                        
                        <button onClick={(e) => { e.stopPropagation(); setEditDoc(doc); setShowForm(true); }} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors text-[10px] font-bold shadow-sm ${canEditExisting ? 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'}`} title={canEditExisting ? "Modifica intestazione" : "Vedi intestazione"}>
                          {canEditExisting ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          <span className="hidden lg:inline">{canEditExisting ? 'Testa' : 'Vedi'}</span>
                        </button>
                      </div>
                    </td>

                   </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* MOBILE / TABLET CARDS */}
      <div className="xl:hidden grid grid-cols-1 md:grid-cols-2 gap-3 pb-32">
        {paged.length === 0 && <div className="col-span-full bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessun documento trovato</div>}
        {paged.map(doc => {
          const cliente = getCliente(doc.IDCliente);
          return (
            <div key={doc.ID} onClick={() => setSelectedDoc(doc)} className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md transition-all cursor-pointer animate-fade-in flex flex-col">
              
              <div className="flex justify-between items-start mb-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-foreground bg-secondary/50 px-2 py-0.5 rounded">#{doc.Num}</span>
                  <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-badge-info text-badge-info-foreground">{getTipo(doc.Tipo)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{formatDate(doc.datafatt)}</span>
                  {auth.canEdit && (
					<button onClick={(e) => { e.stopPropagation(); setEditDoc(doc); setShowForm(true); }} className="p-1 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors shadow-sm" title={canEditExisting ? "Modifica Testata" : "Vedi Testata"}>
                    {canEditExisting ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
					
                  )}
                </div>
              </div>
              
              <p className="text-sm font-bold text-foreground leading-snug line-clamp-2 mb-3 flex-1" title={cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || '-'}>
                {cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || '-'}
              </p>
              
              <div className="flex items-center justify-between pt-3 border-t border-border/50">
                <span className="text-lg font-mono font-black text-primary">{formatCurrency(Number(doc.impondoc) + Number(doc.ivadoc))}</span>
                <div className="flex gap-2">
                  <div onClick={e => e.stopPropagation()}><StatusCell value={doc.verificato} field="verificato" docId={doc.ID} /></div>
                  <div onClick={e => e.stopPropagation()}><StatusCell value={doc.registrata} field="registrata" docId={doc.ID} onView={() => setViewerModal({ isOpen: true, doc, type: 'contabilita' })} /></div>
                  <div onClick={e => e.stopPropagation()}><StatusCell value={doc.caricata} field="caricata" docId={doc.ID} onView={() => setViewerModal({ isOpen: true, doc, type: 'magazzino' })} /></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* STICKY FOOTER RESPONSIVE (SOLO TOTALI) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-40 flex flex-col">
        <button 
          onClick={() => setShowFooter(!showFooter)} 
          className="xl:hidden w-full flex items-center justify-center gap-2 py-2.5 bg-secondary/90 text-[11px] tracking-widest font-black text-foreground hover:bg-secondary transition-colors border-b border-border shadow-inner"
        >
          {showFooter ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          {showFooter ? 'NASCONDI TOTALI GLOBALI' : 'VISUALIZZA TOTALI GLOBALI'}
        </button>

        <div className={`${showFooter ? 'flex' : 'hidden'} xl:flex max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-3 flex-col sm:flex-row items-center justify-end gap-6`}>
          <div className="flex flex-col items-end w-full sm:w-auto">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Tot. Imponibile Documenti Filtati</span>
            <span className="text-base font-mono font-bold text-foreground">{formatCurrency(totalImponibile)}</span>
          </div>
          <div className="hidden sm:block w-px h-8 bg-border"></div>
          <div className="flex flex-col items-end w-full sm:w-auto bg-primary/5 px-4 py-1.5 rounded-lg border border-primary/20">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Tot. Documenti (Lordo)</span>
            <span className="text-xl font-mono font-black text-primary">{formatCurrency(totalDocumento)}</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODALI - TENUTI SULLA ROOT PER NON SUBIRE INFLUENZE DI Z-INDEX O PARENT */}
      {/* ========================================================================= */}

      {activeDoc && (
        <DocumentDetail
          document={activeDoc}
          onClose={() => {
            if (massQueue.length > 0) abortMassQueue();
            else {
              setSelectedDoc(null);
              // Se avevamo un verificaModal valorizzato, mostriamo di nuovo il modale di verifica
              if (verificaModal) {
                setIsVerificaModalVisible(true);
              }
            }
          }}
          onEdit={() => { setEditDoc(activeDoc); setShowForm(true); setSelectedDoc(null); }}
          onToggle={(field) => handleToggle(activeDoc.ID, field)}
          onDeleteDocument={(docId) => { 
            handleRemoveFromList(docId); 
            setSelectedDoc(null); 
            // Se avevamo un verificaModal valorizzato, mostriamo di nuovo il modale di verifica dopo il feedback
            if (verificaModal) {
              setFeedback({
                isOpen:true, 
                type:'success-auto', 
                title:'Documento Eliminato', 
                msg:'Cancellato dal database', 
                confirmLabel: 'OK', 
                onConfirm: () => {
                  setFeedback(prev => ({ ...prev, isOpen: false }));
                  setIsVerificaModalVisible(true);
                }
              });
            } else {
              setFeedback({isOpen:true, type:'success-auto', title:'Documento Eliminato', msg:'Cancellato dal database', confirmLabel: 'OK', onConfirm: undefined});
            }
          }}
          autoTriggerAction={massActionType}
          massWizardInfo={massQueue.length > 0 ? {
            current: currentMassIndex + 1,
            total: massQueue.length,
            onSkip: () => advanceMassQueue(false),
            onAbort: abortMassQueue,
            onNext: () => advanceMassQueue(true)
          } : undefined}
        />
      )}

      {showForm && (
        <DocumentFormModal 
          document={editDoc} 
          onSave={handleSave} 
          onClose={() => { 
            setShowForm(false); 
            setEditDoc(null); 
            setFeedback({isOpen:false, type:'info', title:'', msg:''});
            // Se avevamo un verificaModal valorizzato, mostriamo di nuovo il modale di verifica dopo la chiusura del form
            if (verificaModal) {
              setIsVerificaModalVisible(true);
            }
          }} 
        />
      )}

      {viewerModal.isOpen && viewerModal.doc && (
        <MovimentiViewerModal
          doc={viewerModal.doc}
          type={viewerModal.type}
          onClose={() => {
            setViewerModal({ isOpen: false, doc: null, type: 'contabilita' });
            // Se avevamo un verificaModal valorizzato, mostriamo di nuovo il modale di verifica
            if (verificaModal) {
              setIsVerificaModalVisible(true);
            }
          }}
        />
      )}

      {/* MODALI AUDIT: Ultimo nel DOM per garantire lo stacking corretto */}
      {verificaModal && (
        <VerificaIncongruenzeModal 
          isOpen={isVerificaModalVisible}
          type={verificaModal} 
          onClose={() => {
            setVerificaModal(null);
            setIsVerificaModalVisible(false);
          }} 
          onFixAndOpen={async (docId) => {
            setIsVerificaModalVisible(false);
            try {
              const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${docId}`);
              const freshDoc = await res.json();
              if (freshDoc && freshDoc.ID) { setSelectedDoc(freshDoc); }
            } catch (e) {}
          }}
          onJustOpen={async (docId) => {
            setIsVerificaModalVisible(false);
            try {
              const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${docId}`);
              const freshDoc = await res.json();
              if (freshDoc && freshDoc.ID) setSelectedDoc(freshDoc); 
            } catch (e) {}
          }}
          onViewMovements={async (docId, type) => {
            setIsVerificaModalVisible(false);
            try {
              let docToView = documents.find(d => d.ID === docId);
              if (!docToView) {
                const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${docId}`);
                const storico = await res.json();
                if (storico && storico.ID) docToView = storico;
              }
              if (docToView) setViewerModal({ isOpen: true, doc: docToView, type });
            } catch (e) {}
          }}
        />
      )}

      {showImportSdiModal && <ImportFlussiSdiModal onClose={() => setShowImportSdiModal(false)} />}
      
      {showAccorpamentoModal && <AccorpamentoModal isOpen={true} onClose={() => setShowAccorpamentoModal(false)} />}

      {/* CENTRO OPERAZIONI MASSIVE */}
      {showMassActions && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in" onClick={() => setShowMassActions(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh] border border-border" onClick={e => e.stopPropagation()}>
            
            <div className="px-3 sm:px-5 py-3 sm:py-4 border-b border-border bg-slate-800 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="bg-white/20 p-1.5 sm:p-2 rounded-lg"><Settings className="w-4 h-4 sm:w-5 sm:h-5 text-blue-300" /></div>
                <div>
                  <h3 className="text-sm sm:text-base sm:text-lg font-bold uppercase tracking-wider">Centro Operazioni</h3>
                  <p className="text-[9px] sm:text-[10px] sm:text-xs text-slate-300 font-medium">Massive e Strumenti di Audit</p>
                </div>
              </div>
              <button onClick={() => setShowMassActions(false)} className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5"/></button>
            </div>

            <div className="p-3 sm:p-5 overflow-y-auto flex-1 custom-scrollbar bg-secondary/5 flex flex-col gap-3 sm:gap-6">
              
              <div className="bg-background rounded-xl border border-border p-3 sm:p-4 shadow-sm">
                <h4 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3 border-b border-border pb-1 sm:pb-2">Elaborazioni Massive</h4>
                <div className="flex flex-col gap-2 sm:gap-3">
                  <button onClick={() => { setShowMassActions(false); setShowAccorpamentoModal(true); }} className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-purple-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-purple-700 transition-colors shadow-sm">
                    <span>1. ACCORPAMENTO FATT. DIFFERITA</span>
                    <Layers className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                  </button>
                  <button onClick={() => { setShowMassActions(false); handleMassContabilizza(); }} className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-blue-700 transition-colors shadow-sm">
                    <span>2. CONTABILIZZA DOCUMENTI</span>
                    <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                  </button>
                  <button onClick={() => { setShowMassActions(false); handleMassMovimenta(); }} className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 bg-amber-500 text-white text-xs sm:text-sm font-bold rounded-lg hover:bg-amber-600 transition-colors shadow-sm">
                    <span>3. MOVIMENTA MAGAZZINO</span>
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5 opacity-70" />
                  </button>
                </div>
                <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center mt-2 sm:mt-3 font-medium">L'elaborazione massiva avverrà solo sui documenti filtrati in griglia.</p>
              </div>

              <div className="bg-background rounded-xl border border-border p-3 sm:p-4 shadow-sm">
                <h4 className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3 border-b border-border pb-1 sm:pb-2">Strumenti di Controllo (Audit)</h4>
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <button onClick={() => { setShowMassActions(false); setVerificaModal('accorpamenti'); setIsVerificaModalVisible(true); }} className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 text-[10px] sm:text-xs font-bold rounded-lg transition-colors">
                    VERIFICA ACCORPAMENTI
                  </button>
                  <button onClick={() => { setShowMassActions(false); setVerificaModal('contabilita'); setIsVerificaModalVisible(true); }} className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 text-[10px] sm:text-xs font-bold rounded-lg transition-colors">
                    VERIFICA CONTABILITÀ
                  </button>
                  <button onClick={() => { setShowMassActions(false); setVerificaModal('magazzino'); setIsVerificaModalVisible(true); }} className="w-full flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 text-[10px] sm:text-xs font-bold rounded-lg transition-colors">
                    VERIFICA MAGAZZINO
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={feedback.isOpen} 
        type={feedback.type} 
        title={feedback.title} 
        message={feedback.msg}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
        onConfirm={feedback.onConfirm}
        confirmLabel={feedback.confirmLabel}
      />
    </>
  );
};

export default DocumentList;