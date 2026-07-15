import { useState, useEffect } from 'react';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Plus, ChevronUp, ChevronDown, Eye } from 'lucide-react';
import { PrimaNotaCasa } from '@/data/contabilitaMockData';
import { useClienti } from '@/hooks/api/useClienti';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useFatture } from '@/hooks/api/useFatture';
import { useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import DocumentDetail from './DocumentDetail';
import MovementForm from './MovementForm';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  records: PrimaNotaCasa[];
  onUpdate: (records: PrimaNotaCasa[]) => void;
  label: string;
  isScadenzario?: boolean;
  onRegistra?: (record: PrimaNotaCasa, importo: number, data: string) => void;
}

type SortCol = 'data' | 'ragioneSociale';
type SortDir = 'asc' | 'desc';

const SORT_KEY = 'gestionale_contabilita_sort';

const PrimaNotaTable = ({ records, onUpdate, label, isScadenzario, onRegistra }: Props) => {
  const queryClient = useQueryClient();
  
  const auth = useAuthAccess();
  
  // Regola: Può modificare i record ESISTENTI solo se è Livello 2, oppure da Livello 4 in su (o Admin).
  // Il Livello 3 (che può solo creare) e il Livello 1 (sola lettura) qui saranno 'false'.
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  
  
  const [sortCol, setSortCol] = useState<SortCol>(() => {
    try { return (JSON.parse(localStorage.getItem(SORT_KEY) || '{}').col) || 'data'; } catch { return 'data'; }
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    try { return (JSON.parse(localStorage.getItem(SORT_KEY) || '{}').dir) || 'desc'; } catch { return 'desc'; }
  });
  
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  // STATO PER IL FOOTER A SCOMPARSA SU MOBILE/TABLET
  const [showFooter, setShowFooter] = useState(false);

  useEffect(() => { setPage(0); }, [records]);
  
  const [linkedFattura, setLinkedFattura] = useState<any | null>(null);
  const [fetchingDocId, setFetchingDocId] = useState<number | null>(null);
 
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState<PrimaNotaCasa | null>(null);
  
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: any }>({ 
    isOpen: false, type: 'info', title: '', msg: '' 
  });
  
  const { data: clientiData, isLoading: clientiLoading, isError: clientiError } = useClienti();
  const { data: causaliData =[], isLoading: causaliLoading } = useCausali();
  const { data: tipologieData =[], isLoading: tipologieLoading } = useTipologieMovimento();
  const { data: fattureData =[] } = useFatture(); 
  
  const toggleSort = (col: SortCol) => {
    const newDir = sortCol === col ? (sortDir === 'asc' ? 'desc' : 'asc') : (col === 'data' ? 'desc' : 'asc');
    setSortCol(col); setSortDir(newDir); localStorage.setItem(SORT_KEY, JSON.stringify({ col, dir: newDir }));
  };

  const getCliente = (id: number) => (clientiData ||[]).find((c: any) => Number(c.ID) === Number(id));
  const getCausale = (id: number) => causaliData.find((c: any) => Number(c.id) === Number(id));
  const getTipo = (id: number) => tipologieData.find((t: any) => Number(t.id) === Number(id));

  const formatCurrency = (n: number) => n ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n) : '-';
  const formatDate = (d: string) => { if (!d) return '-'; const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };

  const totalDare = records.reduce((sum, r) => sum + Number(r.Dare || 0), 0);
  const totalAvere = records.reduce((sum, r) => sum + Number(r.Avere || 0), 0);
  const saldo = totalDare - totalAvere;

  const sorted = [...records].sort((a, b) => {
    if (sortCol === 'data') {
      return sortDir === 'asc' ? String(a.data).localeCompare(String(b.data)) : String(b.data).localeCompare(String(a.data));
    }
    const ra = getCliente(a.IdCliente)?.Ragione_Sociale || '';
    const rb = getCliente(b.IdCliente)?.Ragione_Sociale || '';
    return sortDir === 'asc' ? ra.localeCompare(rb) : rb.localeCompare(ra);
  });

  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paged = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const handleClickNumdoc = async (e: React.MouseEvent, record: any) => {
    e.stopPropagation(); 
    const fattId = Number(record.IdFattura || record.idfattura || 0);
    if (fattId <= 0) return;

    let docFound = fattureData.find((f: any) => Number(f.ID) === fattId);

    if (!docFound) {
      setFetchingDocId(record.Id);
      try {
        const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${fattId}`);
        const data = await res.json();
        if (data && data.ID) docFound = data;
      } catch (e) {
      } finally {
        setFetchingDocId(null);
      }
    }

    if (docFound) {
      setLinkedFattura(docFound);
    } else {
      setFeedback({ isOpen: true, type: 'danger', title: 'Non Trovato', msg: 'Il documento originale non è più presente nel database.' });
    }
  };

  const SortIcon = ({ col }: { col: SortCol }) => { if (sortCol !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />; return sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />; };

  const handleSave = async (record: PrimaNotaCasa) => {
    try {
      const payload = { ...record, isScadenzario: !!isScadenzario };
      const res = await fetch(`${API_HOST}/api.php?action=save_movimento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ['prima_nota'] });
        await queryClient.invalidateQueries({ queryKey: ['scadenzario'] });
        setShowForm(false);
        setEditRecord(null);
        setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'Il movimento è stato registrato correttamente.' });
      } else {
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore nel salvataggio', msg: data.message });
      }
    } catch (err) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore di connessione', msg: "Impossibile contattare il server." });
    }
  };

  const handleDeleteRequest = (id: number) => {
    setItemToDelete(id);
    if (showForm) { setShowForm(false); setEditRecord(null); }
  };

  const executeDelete = async () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=delete_movimento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Id: itemToDelete, isScadenzario: !!isScadenzario })
      });
      const data = await res.json();
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey:['prima_nota'] });
        await queryClient.invalidateQueries({ queryKey: ['scadenzario'] });
        setItemToDelete(null); 
        setFeedback({ isOpen: true, type: 'success', title: 'Movimento Eliminato', msg: 'La registrazione è stata rimossa con successo.' });
      } else {
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: data.message });
      }
    } catch (err) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: "Connessione fallita durante l'eliminazione." });
    } finally {
      setIsDeleting(false);
    }
  };

  const recordToDelete = itemToDelete ? records.find(r => r.Id === itemToDelete) : null;

  return (
    <>
      {/* HEADER COMPATTO CON PAGINAZIONE INTEGRATA */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 mb-4 bg-card p-3 sm:p-4 rounded-xl border border-border shadow-sm">
        
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full lg:w-auto sm:items-center">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-foreground uppercase tracking-wider">{label}</h2>
            {(clientiLoading || causaliLoading || tipologieLoading) && <p className="text-[10px] text-muted-foreground">Caricamento anagrafiche...</p>}
            {clientiError && !clientiLoading && <p className="text-[10px] text-destructive">Errore anagrafiche</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 bg-secondary/30 p-1.5 sm:p-2 rounded-lg border border-border w-fit">
            <span className="text-[11px] sm:text-xs text-muted-foreground font-bold">
              <strong className="text-primary">{records.length}</strong> mov.
            </span>
            <div className="hidden sm:block w-px h-4 bg-border"></div>
            <div className="flex items-center gap-1 sm:gap-2">
              <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(0); }} className="h-6 sm:h-7 rounded border border-input bg-background px-1 sm:px-1.5 text-[11px] sm:text-xs font-bold text-primary outline-none">
                <option value={20}>20/pag</option>
                <option value={50}>50/pag</option>
                <option value={100}>100/pag</option>
              </select>
              {totalPages > 1 && (
                <div className="flex items-center gap-0.5 sm:gap-1">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-6 sm:h-7 px-1.5 sm:px-2 rounded border border-input bg-background hover:bg-secondary disabled:opacity-50 font-bold">←</button>
                  <span className="px-1.5 sm:px-2 text-[11px] sm:text-xs font-mono font-bold">{page + 1}/{totalPages}</span>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-6 sm:h-7 px-1.5 sm:px-2 rounded border border-input bg-background hover:bg-secondary disabled:opacity-50 font-bold">→</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="w-full lg:w-auto flex justify-end">
          {auth.canCreate && (
			<button
				onClick={() => { setEditRecord(null); setShowForm(true); }}
				className="flex items-center justify-center gap-2 px-4 py-2 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity shadow-sm w-full sm:w-auto"
			>
				<Plus className="w-4 h-4 shrink-0" /> NUOVA REGISTRAZIONE
			</button>
		  )}
        </div>
      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden lg:flex lg:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-24">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-table-header text-muted-foreground text-left border-b border-border">
                <th className="px-3 py-3 font-medium cursor-pointer select-none w-24" onClick={() => toggleSort('data')}><span className="flex items-center gap-1">Data <SortIcon col="data" /></span></th>
                <th className="px-3 py-3 font-medium cursor-pointer select-none min-w-[200px]" onClick={() => toggleSort('ragioneSociale')}><span className="flex items-center gap-1">Ragione Sociale <SortIcon col="ragioneSociale" /></span></th>
                <th className="px-2 py-3 font-medium w-16 text-center">Causale</th>
                <th className="px-2 py-3 font-medium w-16 text-center">Tipo</th>
                <th className="px-3 py-3 font-medium min-w-[250px]">Descrizione</th>
                <th className="px-2 py-3 font-medium text-center w-12">C/R</th>
                <th className="px-3 py-3 font-medium w-24">Num.Doc</th>
                <th className="px-4 py-3 font-medium text-right w-28">Dare</th>
                <th className="px-4 py-3 font-medium text-right w-28">Avere</th>
                <th className="px-3 py-3 font-medium text-center w-28">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paged.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nessun movimento trovato</td></tr>}
              {paged.map((rec, idx) => {
                const cliente = getCliente(rec.IdCliente);
                const causale = getCausale(rec.Categoria);
                const tipo = getTipo(rec.TipoMovimento);
                return (
                  <tr 
                    key={rec.Id} 
                    onClick={() => { setEditRecord(rec); setShowForm(true); }}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}
                  >
                    <td className="px-3 py-2.5 text-foreground whitespace-nowrap">{formatDate(rec.data)}</td>
                    <td className="px-3 py-2.5 text-foreground truncate max-w-[250px]" title={cliente?.Ragione_Sociale || cliente?.['Ragione Sociale']}>
                      {cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || '-'}
                    </td>
                    <td className="px-2 py-2.5 text-center"><span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-secondary text-secondary-foreground cursor-help" title={causale?.Descrizione}>{causale?.suffisso || '-'}</span></td>
                    <td className="px-2 py-2.5 text-center text-muted-foreground text-[11px] cursor-help" title={tipo?.Descrizione}>{tipo?.codice || '-'}</td>
                    <td className="px-3 py-2.5 text-foreground truncate max-w-[300px] text-xs" title={rec.descrizione}>{rec.descrizione}</td>
                    <td className="px-2 py-2.5 text-center"><span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${rec['C-R'] === 'C' ? 'bg-badge-success/20 text-success' : 'bg-badge-error/20 text-destructive'}`} title={rec['C-R'] === 'C' ? 'Competenza' : 'Residuo'}>{rec['C-R']}</span></td>
                    <td className="px-3 py-2.5 text-mono text-primary cursor-pointer hover:underline text-xs" onClick={(e) => handleClickNumdoc(e, rec)} title={Number(rec.IdFattura || (rec as any).idfattura) > 0 ? '1 click per aprire il Documento' : ''}>
                      {fetchingDocId === rec.Id ? '...' : rec.numdoc}
                    </td>
                    <td className="px-4 py-2.5 text-right text-mono text-foreground font-medium">{formatCurrency(Number(rec.Dare))}</td>
                    <td className="px-4 py-2.5 text-right text-mono text-foreground font-medium">{formatCurrency(Number(rec.Avere))}</td>
                    
                    <td className="px-3 py-2.5 text-center" onClick={e => e.stopPropagation()}>
					<button 
                        onClick={(e) => { e.stopPropagation(); setEditRecord(rec); setShowForm(true); }} 
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto" 
                        title={canEditExisting ? "Modifica Registrazione" : "Visualizza Dettaglio"}
                      >
                        {canEditExisting ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span className="hidden sm:inline">{canEditExisting ? 'MODIFICA' : 'VEDI'}</span>
                    </button>

                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* MOBILE E TABLET CARDS */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2 pb-24">
        {paged.length === 0 && <div className="col-span-full bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessun movimento trovato</div>}
        
        {paged.map(rec => {
          const causale = getCausale(rec.Categoria);
          const isCompetenza = rec['C-R'] === 'C';
          return (
            <div 
              key={rec.Id} 
              onClick={() => { setEditRecord(rec); setShowForm(true); }}
              className="bg-card rounded-xl border border-border p-3 shadow-sm active:scale-[0.98] transition-all cursor-pointer animate-fade-in flex flex-col justify-center"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[11px] font-bold text-foreground shrink-0">{formatDate(rec.data)}</span>
                <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold bg-secondary text-secondary-foreground shrink-0">{causale?.suffisso}</span>
                <span className="text-mono text-[10px] text-primary font-medium hover:underline shrink-0" onClick={(e) => handleClickNumdoc(e, rec)}>
                  Doc: {fetchingDocId === rec.Id ? '...' : (rec.numdoc || '-')}
                </span>
                
				<button 
                    onClick={(e) => { e.stopPropagation(); setEditRecord(rec); setShowForm(true); }} 
                    className="inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto" 
                    title={canEditExisting ? "Modifica Registrazione" : "Visualizza Dettaglio"}
                   >
                    {canEditExisting ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span className="hidden sm:inline">{canEditExisting ? 'MODIFICA' : 'VEDI'}</span>
                </button>

              </div>

              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-foreground leading-snug line-clamp-2 flex-1" title={rec.descrizione}>{rec.descrizione}</p>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 border ${isCompetenza ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {rec['C-R']}
                </span>
                <span className={`text-mono font-bold text-sm shrink-0 ${isCompetenza ? 'text-green-600' : 'text-red-600'}`}>
                  {Number(rec.Dare) > 0 ? formatCurrency(Number(rec.Dare)) : formatCurrency(Number(rec.Avere))}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* FOOTER TOTALI (A SCOMPARSA SU MOBILE/TABLET) */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-40 flex flex-col">
        
        {/* Pulsante Toggle visibile fino a schermi Tablet inclusi */}
        <button 
          onClick={() => setShowFooter(!showFooter)} 
          className="xl:hidden w-full flex items-center justify-center gap-2 py-2 sm:py-2.5 bg-secondary/90 text-[10px] sm:text-[11px] tracking-widest font-black text-foreground hover:bg-secondary transition-colors border-b border-border shadow-inner"
        >
          {showFooter ? <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
          {showFooter ? 'NASCONDI TOTALI GLOBALI' : 'VISUALIZZA TOTALI GLOBALI'}
        </button>

        <div className={`${showFooter ? 'flex' : 'hidden'} xl:flex max-w-[1600px] mx-auto w-full px-4 sm:px-6 py-2.5 sm:py-3 flex-row flex-wrap sm:flex-nowrap items-center justify-between xl:justify-end gap-3 sm:gap-6`}>
          
          <div className="flex flex-col items-start xl:items-end flex-1 sm:flex-none">
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Tot. Dare</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-foreground">{formatCurrency(totalDare)}</span>
          </div>
          
          <div className="flex flex-col items-start xl:items-end flex-1 sm:flex-none border-l sm:border-l-0 pl-3 sm:pl-0 border-border">
            <span className="text-[9px] sm:text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Tot. Avere</span>
            <span className="text-xs sm:text-sm font-mono font-bold text-foreground">{formatCurrency(totalAvere)}</span>
          </div>
          
          <div className="hidden sm:block w-px h-8 bg-border"></div>
          
          <div className="flex flex-col items-end w-full sm:w-auto bg-primary/5 px-3 sm:px-4 py-1.5 rounded-lg border border-primary/20 mt-1 sm:mt-0">
            <span className="text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Saldo Periodo</span>
            <span className={`text-base sm:text-xl font-mono font-black ${saldo >= 0 ? 'text-success' : 'text-destructive'}`}>{formatCurrency(saldo)}</span>
          </div>
          
        </div>
      </div>

      {/* MODALI ESTERNI (Mantenuti svincolati dal layout) */}
      <div className="fixed z-[9999]">
        {linkedFattura && (
          <DocumentDetail 
            document={linkedFattura} 
            onClose={() => setLinkedFattura(null)}
            onEdit={() => {}} 
            onToggle={() => {}} 
          />
        )}

        {showForm && (
          <MovementForm
            record={editRecord}
            onSave={handleSave}
            onClose={() => { 
              setShowForm(false); 
              setEditRecord(null); 
              setFeedback({ isOpen: true, type: 'cancel-auto', title: 'Operazione Annullata', msg: '' }); 
            }}
            onDelete={handleDeleteRequest}
            isScadenzario={isScadenzario}
            onRegistra={onRegistra}
          />
        )}
      </div>

      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Movimento"
        message={
          <>
            Sei sicuro di voler eliminare definitivamente il movimento del <strong>{recordToDelete ? formatDate(recordToDelete.data) : ''}</strong>
            <br />riferito a: <em>"{recordToDelete?.descrizione || ''}"</em>?
            <br /><br />L'operazione non è reversibile.
          </>
        }
        onClose={() => setItemToDelete(null)}
        onConfirm={executeDelete}
        isPending={isDeleting}
      />

      <ConfirmDialog 
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.msg}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
      />
    </>
  );
};

export default PrimaNotaTable;