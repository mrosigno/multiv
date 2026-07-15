import { useState } from 'react';
import { X, Search, AlertTriangle, CheckCircle, RefreshCcw, Wrench, Calculator, Eye, Layers } from 'lucide-react';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import ConfirmDialog from '@/components/ConfirmDialog';
import { API_HOST } from '@/config';
import AccorpamentoModal from './AccorpamentoModal';

interface Props {
  type: 'contabilita' | 'magazzino' | 'accorpamenti';
  onClose: () => void;
  onFixAndOpen: (docId: number) => void;
  onJustOpen: (docId: number) => void; 
  onViewMovements: (docId: number, type: 'contabilita' | 'magazzino') => void; 
}

const currentYear = new Date().getFullYear();
const currentMonth = new Date().getMonth() + 1;
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

export default function VerificaIncongruenzeModal({ type, isOpen, onClose, onFixAndOpen, onJustOpen, onViewMovements }: Props & { isOpen: boolean }) {
  const queryClient = useQueryClient();
  const [anno, setAnno] = useState(currentYear);
  const [mese, setMese] = useState(currentMonth); 

  const [incongruenze, setIncongruenze] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [confirmFix, setConfirmFix] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ isOpen: false, type: 'info', title: '', msg: '' });

  const [viewSourceDocsFor, setViewSourceDocsFor] = useState<number | null>(null);
  const [sourceDocs, setSourceDocs] = useState<any[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState(false);

  const [reAccorpaPrompt, setReAccorpaPrompt] = useState<any | null>(null);
  const [showTuaFormAccorpamento, setShowTuaFormAccorpamento] = useState<any | null>(null);

  const title = type === 'contabilita' ? 'Audit Contabilità' : type === 'magazzino' ? 'Audit Magazzino' : 'Audit Accorpamenti';
  const apiAction = type === 'contabilita' ? 'verifica_contabilita' : type === 'magazzino' ? 'verifica_magazzino' : 'verifica_accorpamenti';
  const colPrevista = type === 'magazzino' ? 'Q.tà Prevista' : 'Imponibile Origine';
  const colTrovata = type === 'magazzino' ? 'Q.tà Registrata' : 'Imponibile Destinazione';
  const isCurrency = type === 'contabilita' || type === 'accorpamenti';

  const getValOrigine = (inc: any) => Number(type === 'contabilita' ? (inc?.TotDoc || 0) : (inc?.TotQtaDoc || 0));
  const getValDestinazione = (inc: any) => Number(type === 'contabilita' ? (inc?.TotMov || 0) : (inc?.TotQtaMov || 0));

  const eseguiVerifica = async () => {
    setIsLoading(true); setHasSearched(false);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=${apiAction}&anno=${anno}&mese=${mese}`);
      const data = await res.json();
      if (Array.isArray(data)) setIncongruenze(data);
      else setIncongruenze([]);
      setHasSearched(true);
    } catch (e) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: 'Connessione al database interrotta.' });
      setIncongruenze([]); setHasSearched(true);
    } finally {
      setIsLoading(false);
    }
  };

  const applicaFix = async () => {
    if (!confirmFix) return;
    const docId = confirmFix.ID;
    
    try {
      if (type === 'accorpamenti') {
        let inferredSourceType = 0;
        try {
          const resFatt = await fetch(`${API_HOST}/api.php?action=fatture&anno=${anno}`);
          const dataFatt = await resFatt.json();
          const docsOrigine = Array.isArray(dataFatt) ? dataFatt.filter((d: any) => Number(d.idaccorpa) === docId) : [];
          if (docsOrigine.length > 0) inferredSourceType = Number(docsOrigine[0].Tipo);
        } catch(e) {}

        const res = await fetch(`${API_HOST}/api.php?action=annulla_accorpamento`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: docId })
        });
        const data = await res.json();
        
        if (data.success) {
          queryClient.invalidateQueries(); 
          setIncongruenze(prev => prev.filter(i => i.ID !== docId));
          const recordScartato = { ...confirmFix, inferredSourceType };
          setConfirmFix(null);
          setReAccorpaPrompt(recordScartato);
        } else {
          setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: data.message });
        }
      } else {
        const field = type === 'contabilita' ? 'registrata' : 'caricata';
        const res = await fetch(`${API_HOST}/api.php?action=toggle_document_status`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: docId, field, value: 0 })
        });
        const data = await res.json();
        if (data.success) {
          queryClient.invalidateQueries(); 
          setConfirmFix(null);
          setIncongruenze(prev => prev.filter(i => i.ID !== docId));
          onFixAndOpen(docId); 
        } else {
          setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: data.message });
        }
      }
    } catch (e) { setFeedback({ isOpen: true, type: 'danger', title: 'Errore Server', msg: 'Connessione fallita.' }); }
  };

  const ricalcolaMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=ricalcola_totali_fattura`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Ricalcolo Eseguito', msg: 'Totali riallineati.' });
      queryClient.invalidateQueries({ queryKey: ['fatture'] });
      eseguiVerifica(); 
    },
    onError: (err: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message })
  });

  const apriDocumentiOrigine = async (idFatturaDestinazione: number) => {
    setViewSourceDocsFor(idFatturaDestinazione); setIsLoadingSources(true);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=fatture&anno=${anno}`);
      const data = await res.json();
      const docsOrigine = Array.isArray(data) ? data.filter((d: any) => Number(d.idaccorpa) === idFatturaDestinazione) : [];
      setSourceDocs(docsOrigine);
    } catch (e) { setSourceDocs([]); } finally { setIsLoadingSources(false); }
  };

  const getTipoDesc = (idTipo: number) => {
    const tipi: any[] = queryClient.getQueryData(['tipi_documento']) || [];
    return tipi.find(t => Number(t.id) === Number(idTipo))?.descrizione || 'Doc.';
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n));
  const formatDate = (d: string) => { if (!d) return '-'; const p = d.split('-'); return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

  const dialogConfig = type === 'accorpamenti' 
    ? { 
        title: "Annulla e Cancella Accorpamento", 
        btn: "Procedi con l'Eliminazione",
        msg: "ATTENZIONE!\nStai per sganciare tutti i documenti di origine. Il documento aggregato risultante verrà ELIMINATO DEFINITIVAMENTE dal database.\n\nSei sicuro di voler distruggere il documento di destinazione?"
      }
    : { 
        title: "Correggi ed Apri Documento", 
        btn: "Sì, Sblocca e Apri",
        msg: "Il sistema eliminerà i collegamenti o i movimenti errati, riportando il documento allo stato Da Lavorare e lo aprirà per la correzione.\n\nVuoi procedere?"
      };

  return (
    <div className={`fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[400] flex items-center justify-center p-0 ${isOpen ? 'animate-fade-in' : 'hidden'}`} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="fixed inset-0 flex flex-col bg-slate-50 w-full h-[100svh] sm:h-[95vh] overflow-hidden animate-fade-in">
      
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 bg-white border-b border-border shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${type === 'accorpamenti' ? 'bg-purple-100 text-purple-600' : 'bg-amber-100 text-amber-600'}`}>
              {type === 'accorpamenti' ? <Layers className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground hidden sm:block">Analizza i totali dei documenti e rileva le incongruenze.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-6 h-6" /></button>
        </div>

      <div className="p-4 sm:p-6 shrink-0 bg-white border-b border-border">
        <div className="flex flex-col sm:flex-row items-end gap-4 max-w-2xl">
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Anno</label>
            <select value={anno} onChange={e => setAnno(+e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Mese</label>
            <select value={mese} onChange={e => setMese(+e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none">
              {months.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <button onClick={eseguiVerifica} disabled={isLoading} className={`w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2 rounded-lg text-white font-bold transition-colors shadow-sm disabled:opacity-50 h-10 ${type === 'accorpamenti' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
            {isLoading ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} AVVIA VERIFICA
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar bg-slate-50">
        {!hasSearched && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50">
            <Search className="w-16 h-16 mb-4" />
            <p className="text-lg font-medium text-center">Seleziona il periodo e avvia la verifica.</p>
          </div>
        )}
        {isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-amber-600">
            <RefreshCcw className="w-12 h-12 animate-spin mb-4" />
            <p className="font-bold text-lg text-center">Scansione e incrocio dati in corso...</p>
          </div>
        )}
        {hasSearched && !isLoading && incongruenze.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-green-600 bg-green-50 rounded-2xl border border-green-200 p-8">
            <CheckCircle className="w-16 h-16 mb-4" />
            <h3 className="text-2xl font-black mb-1">Tutto Perfetto!</h3>
            <p className="font-medium text-center">Nessuna incongruenza rilevata per il periodo {months[mese - 1]} {anno}.</p>
          </div>
        )}

        {hasSearched && !isLoading && incongruenze.length > 0 && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="p-4 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700 font-bold text-sm sm:text-base">
              <AlertTriangle className="w-5 h-5 shrink-0" /> Trovate {incongruenze.length} incongruenze da correggere.
            </div>
            
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/30 border-b border-border text-[11px] uppercase text-muted-foreground font-bold">
                  <tr>
                    <th className="px-4 py-3">Tipo Doc</th>
                    <th className="px-4 py-3">Documento (Anomalo)</th>
                    <th className="px-4 py-3">Cliente / Fornitore</th>
                    <th className="px-4 py-3 text-right">{colPrevista}</th>
                    <th className="px-4 py-3 text-right text-red-600">{colTrovata}</th>
                    <th className="px-4 py-3 text-center">Azione Rapida</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {incongruenze.map(inc => (
                    <tr key={inc.ID} className="hover:bg-muted/20">
                      <td className="px-4 py-3 text-muted-foreground">{inc.tipoDesc || '-'}</td>
                      <td className="px-4 py-3 font-medium">N. {inc.Num} del {formatDate(inc.datafatt)}</td>
                      <td className="px-4 py-3 truncate max-w-[200px]">{inc.fornitore || '-'}</td>
                      
                      <td className="px-4 py-3 text-right bg-green-50/30">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono font-bold">
                            {isCurrency ? formatCurrency(getValOrigine(inc)) : getValOrigine(inc)}
                          </span>
                          {type === 'accorpamenti' ? (
                            <button onClick={() => apriDocumentiOrigine(inc.ID)} className="px-1.5 py-0.5 border border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded text-[10px] flex items-center gap-1 transition-colors" title="Mostra tutti i documenti accorpati che formano questo Imponibile">
                              <Layers className="w-3 h-3" /> vedi orig.
                            </button>
                          ) : (
                            <>
                              <button onClick={() => onJustOpen(inc.ID)} className="px-1.5 py-0.5 border border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded text-[10px] flex items-center gap-1 transition-colors" title="Apri il documento per verificare i dati">
                                <Eye className="w-3 h-3" /> vedi
                              </button>
                              <button onClick={() => ricalcolaMutation.mutate(inc.ID)} className="px-1.5 py-0.5 border border-primary text-primary bg-primary/10 hover:bg-primary hover:text-white rounded text-[10px] flex items-center gap-1 transition-colors">
                                <Calculator className="w-3 h-3" /> ricalc.
                              </button>
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right bg-red-50/30">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono font-bold text-red-600">
                            {isCurrency ? formatCurrency(getValDestinazione(inc)) : getValDestinazione(inc)}
                          </span>
                          {type === 'accorpamenti' ? (
                            <button onClick={() => onJustOpen(inc.ID)} className="px-1.5 py-0.5 border border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded text-[10px] flex items-center gap-1 transition-colors">
                              <Eye className="w-3 h-3" /> vedi doc.
                            </button>
                          ) : (
                            <button onClick={() => onViewMovements(inc.ID, type)} className="px-1.5 py-0.5 border border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded text-[10px] flex items-center gap-1 transition-colors">
                              <Eye className="w-3 h-3" /> movim.
                            </button>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button onClick={() => setConfirmFix(inc)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-100 hover:bg-red-200 text-red-700 font-bold text-xs transition-colors border border-red-200 shadow-sm">
                          <Wrench className="w-3 h-3" /> {type === 'accorpamenti' ? 'Distruggi & Correggi' : 'Correggi & Apri'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden flex flex-col gap-3 p-3 bg-secondary/10">
              {incongruenze.map(inc => (
                <div key={inc.ID} className="bg-white p-3 rounded-xl border border-border shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-xs font-bold text-muted-foreground uppercase">{inc.tipoDesc || '-'}</span>
                    <span className="text-xs font-mono font-bold text-primary">N.{inc.Num}</span>
                  </div>
                  <div className="text-sm font-bold text-foreground mb-1 leading-tight">{inc.fornitore || '-'}</div>
                  <div className="text-[10px] text-muted-foreground mb-2">{formatDate(inc.datafatt)}</div>
                  
                  <div className="flex justify-between items-center bg-green-50/50 p-2 rounded-lg border border-green-100">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{colPrevista}</span>
                    <span className="font-mono font-bold text-sm">
                      {isCurrency ? formatCurrency(getValOrigine(inc)) : getValOrigine(inc)}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center bg-red-50/50 p-2 rounded-lg border border-red-100">
                    <span className="text-[10px] font-bold uppercase text-red-600">{colTrovata}</span>
                    <span className="font-mono font-black text-sm text-red-600">
                      {isCurrency ? formatCurrency(getValDestinazione(inc)) : getValDestinazione(inc)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-border/50">
                    <div className="flex flex-col gap-1.5">
                      {type === 'accorpamenti' ? (
                        <button onClick={() => apriDocumentiOrigine(inc.ID)} className="w-full py-1.5 border border-purple-400 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded text-[10px] font-bold flex items-center justify-center gap-1">
                          <Layers className="w-3 h-3" /> Origine
                        </button>
                      ) : (
                        <button onClick={() => onJustOpen(inc.ID)} className="w-full py-1.5 border border-blue-400 text-blue-700 bg-blue-50 hover:bg-blue-100 rounded text-[10px] font-bold flex items-center justify-center gap-1">
                          <Eye className="w-3 h-3" /> Vedi Doc.
                        </button>
                      )}
                    </div>
                    
                    <button onClick={() => setConfirmFix(inc)} className="w-full py-1.5 bg-red-100 hover:bg-red-200 text-red-700 font-bold text-[10px] rounded border border-red-200 flex items-center justify-center gap-1">
                      <Wrench className="w-3 h-3" /> Correggi
                    </button>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
      </div>

      {viewSourceDocsFor && (
        <div className="fixed inset-0 z-[500] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[85vh] animate-fade-in border border-border">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-secondary/30 rounded-t-xl">
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2"><Layers className="w-5 h-5 text-purple-600" /> Dettaglio Documenti Raggruppati</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Elenco dei documenti che concorrono al totale selezionato.</p>
              </div>
              <button onClick={() => setViewSourceDocsFor(null)} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
              {isLoadingSources ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><RefreshCcw className="w-8 h-8 animate-spin mb-3" /><p className="text-sm font-medium">Recupero documenti in corso...</p></div>
              ) : sourceDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground"><AlertTriangle className="w-8 h-8 mb-3 opacity-50" /><p className="text-sm font-medium">Nessun documento di origine trovato per questa fattura.</p></div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-xs uppercase text-muted-foreground font-bold sticky top-0 border-b border-border shadow-sm">
                    <tr><th className="py-3 px-4">Tipo Doc.</th><th className="py-3 px-4">Numero</th><th className="py-3 px-4">Data</th><th className="py-3 px-4 text-right">Imponibile</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sourceDocs.map(d => (
                      <tr key={d.ID} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-4 font-medium text-foreground">{getTipoDesc(d.Tipo)}</td>
                        <td className="py-2.5 px-4 font-mono text-muted-foreground">{d.Num}</td>
                        <td className="py-2.5 px-4 text-muted-foreground">{formatDate(d.datafatt)}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-medium">{formatCurrency(Number(d.impondoc))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            {!isLoadingSources && sourceDocs.length > 0 && (
              <div className="px-4 py-4 bg-slate-100 border-t border-border rounded-b-xl flex items-center justify-end gap-6 shadow-inner">
                <span className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Totale Origine:</span>
                <span className="text-xl font-mono font-black text-purple-700">{formatCurrency(sourceDocs.reduce((acc, d) => acc + Number(d.impondoc), 0))}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog 
        isOpen={!!confirmFix} 
        title={dialogConfig.title} 
        type="danger" 
        confirmLabel={dialogConfig.btn}
        message={<div className="whitespace-pre-line">{dialogConfig.msg}</div>}
        onClose={() => setConfirmFix(null)} 
        onConfirm={applicaFix}
      />

      <ConfirmDialog 
        isOpen={!!reAccorpaPrompt} 
        title="Vuoi ricalcolare la fattura adesso?" 
        type="info" 
        confirmLabel="Riesegui Subito"
        message={`I documenti di origine di ${reAccorpaPrompt?.fornitore || 'questo cliente'} sono tornati sbloccati.\n\nVuoi aprire l'area di Accorpamento per ricreare immediatamente il documento corretto?\nIn alternativa, potrai farlo manualmente in seguito dall'apposita sezione.`}
        onClose={() => setReAccorpaPrompt(null)} 
        onConfirm={() => {
          const dataToPass = reAccorpaPrompt;
          setReAccorpaPrompt(null);
          setShowTuaFormAccorpamento(dataToPass);
        }}
      />

      {showTuaFormAccorpamento && (
        <AccorpamentoModal
          isOpen={true}
          onClose={() => {
            setShowTuaFormAccorpamento(null);
            eseguiVerifica(); 
          }}
          prefillData={{
            idCliente: Number(showTuaFormAccorpamento.IDCliente),
            targetType: Number(showTuaFormAccorpamento.Tipo),
            sourceType: Number(showTuaFormAccorpamento.inferredSourceType)
          }}
        />
      )}

      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback({ ...feedback, isOpen: false })} />
      </div>
    </div>
  );
}