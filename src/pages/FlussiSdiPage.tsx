import { useState, useMemo } from 'react';
import { Filter, RotateCcw, XCircle, CheckCircle2, FileText, Search, Save, RefreshCcw, DatabaseBackup, X, Pencil, CheckCircle, Eye, Lock } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess'; // <-- IMPORTIAMO I PERMESSI
import DocumentDetail from '@/components/DocumentDetail';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const FlussiSdiPage = () => {
  const auth = useAuthAccess(); // <-- ATTIVAZIONE PERMESSI REALI
  const queryClient = useQueryClient();

  // REGOLA: Se è livello 1, è in sola lettura.
  const canEdit = auth.canEdit; // true se livello >= 2

  const [filterYear, setFilterYear] = useState<number>(currentYear);
  const [filterMonthFrom, setFilterMonthFrom] = useState<number>(1);
  const [filterMonthTo, setFilterMonthTo] = useState<number>(12);
  const [filterQuery, setFilterQuery] = useState('');
  
  const [expanded, setExpanded] = useState(true);
  
  const [editDoc, setEditDoc] = useState<any | null>(null);
  
  const [confirmReg, setConfirmReg] = useState<any | null>(null);
  const [confirmSave, setConfirmSave] = useState<any | null>(null);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean, title: string, msg: string, newDocId?: number }>({ isOpen: false, title: '', msg: '' });
  const [viewImportedDoc, setViewImportedDoc] = useState<any | null>(null);
  
  const { data: tipiDocData = [] } = useTipiDocumento();
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ isOpen: false, type: 'info', title: '', msg: '' });

  // Funzione che accoppia in tempo reale il TDxx con il tuo gestionale
  const getMappedTipoDoc = (tdCode: string) => {
    if (!tdCode) return 'Mancante';
    const code = tdCode.trim().toUpperCase();
    const match = tipiDocData.find((t: any) => (t.codtipo || '').trim().toUpperCase() === code);
    return match ? match.descrizione : '⚠️ NON CONFIGURATO';
  };
  
  const { data: flussi = [], isLoading } = useQuery({
    queryKey: ['tutti_flussi'],
    queryFn: async () => (await fetch(`${API_HOST}/api.php?action=get_tutti_flussi_sdi`)).json()
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number, status: number }) => {
      const res = await fetch(`${API_HOST}/api.php?action=toggle_flusso_status`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status })
      });
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tutti_flussi'] })
  });

  const updateMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=update_flusso_sdi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tutti_flussi'] });
      setConfirmSave(null);
      setSuccessModal({ isOpen: true, title: 'Modifiche Salvate', msg: 'Le modifiche applicate al documento XML sono state salvate correttamente nel database temporaneo.' });
    },
    onError: (err: any) => alert("Errore: " + err.message) 
  });

  const importMutation = useMutation({
    mutationFn: async (idFatt: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=import_xml_to_multiv`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idFatt })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tutti_flussi'] });
      queryClient.invalidateQueries({ queryKey: ['fatture'] });
      queryClient.invalidateQueries({ queryKey: ['clienti'] }); 
      
      setConfirmReg(null);
      setEditDoc(null);
      setSuccessModal({ 
        isOpen: true, 
        title: 'Registrazione Completata', 
        msg: 'Il documento è stato importato con successo nell\'archivio contabile di Multi-V!\n\nVuoi aprire subito il documento per le successive operazioni?', 
        newDocId: data.id_multi_v // PASSA L'ID RESTITUITO DAL PHP
      });
    },
    onError: (err: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message })
  });

  const handleOpenImportedDoc = async (id: number) => {
    setSuccessModal({ isOpen: false, title: '', msg: '' });
    try {
      const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${id}`);
      const doc = await res.json();
      if (doc && doc.ID) {
        setViewImportedDoc(doc);
      } else {
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: 'Impossibile caricare il documento.' });
      }
    } catch (e) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore di Rete', msg: 'Connessione fallita.' });
    }
  };

  
  // FIX: FILTRO BLINDATO CONTRO I CRASH SE MANCA LA DATA
  const filtered = useMemo(() => {
    return flussi.filter((f: any) => {
      if (!f || !f.data || typeof f.data !== 'string') return false; // Protezione anti-crash
      
      const parts = f.data.split('-');
      if (parts.length < 2) return false; // Protezione se il formato data è corrotto
      
      const y = Number(parts[0]);
      const m = Number(parts[1]);
      
      if (y !== filterYear) return false;
      if (m < filterMonthFrom || m > filterMonthTo) return false;
      
      if (filterQuery) {
        const q = filterQuery.toLowerCase();
        if (!(f.fornitore || '').toLowerCase().includes(q) && !(f.numdoc || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [flussi, filterYear, filterMonthFrom, filterMonthTo, filterQuery]);

  const totImponibile = filtered.reduce((s: number, f: any) => s + Number(f.imponibile), 0);
  const totImposta = filtered.reduce((s: number, f: any) => s + Number(f.imposta), 0);
  const totGenerale = filtered.reduce((s: number, f: any) => s + Number(f.totaledoc), 0);

  const formatCurrency = (v: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(v);
  const formatDate = (d: string) => { if (!d) return '-'; const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };

  const handleHeadUpdate = (field: string, val: string) => {
    if (!canEdit) return; // Blocco Sicurezza
    setEditDoc((prev: any) => ({ ...prev, [field]: val }));
  };

  const handleRowUpdate = (index: number, field: string, val: string) => {
    if (!canEdit) return; // Blocco Sicurezza
    const newRighe = [...editDoc.righe];
    newRighe[index] = { ...newRighe[index], [field]: val };
    setEditDoc((prev: any) => ({ ...prev, righe: newRighe }));
  };

  const saveEdits = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return; // Blocco Sicurezza
    updateMutation.mutate(editDoc);
  };

  if (!auth.username) { window.location.href = '/'; return null; }

  const inputClass = `w-full px-2 py-1 border border-input rounded text-sm focus:ring-1 focus:ring-primary ${!canEdit ? 'bg-secondary/50 text-muted-foreground' : 'bg-background text-foreground'}`;

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Elenco Flussi Documenti (Fornitori)</h1>
          <p className="text-sm text-muted-foreground">Gestione, storico e forzatura dei flussi XML importati.</p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-4">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Filtri Ricerca</span>
          <span className="text-xs text-muted-foreground">{expanded ? 'Nascondi' : 'Mostra'}</span>
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Anno</label><select value={filterYear} onChange={e => setFilterYear(+e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Dal Mese</label><select value={filterMonthFrom} onChange={e => setFilterMonthFrom(+e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Al Mese</label><select value={filterMonthTo} onChange={e => setFilterMonthTo(+e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
              <div className="col-span-3">
                <label className="block text-xs font-medium text-muted-foreground mb-1">Cerca Anagrafica o N. Doc</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input value={filterQuery} onChange={e => setFilterQuery(e.target.value)} className="pl-9" placeholder="Scrivi per filtrare..." />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

	  {/* ========================================================= */}
      {/* 1. TABELLA DESKTOP (Nascosta su Mobile)                     */}
      {/* ========================================================= */}
      <div className="hidden md:block bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-24">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-table-header border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground">N° Doc.</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-28">Data Doc.</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-24">Tipo Doc.</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground min-w-[250px]">Fornitore</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Imponibile</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Imposta</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Importo</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Registrato</th>
				        <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-20">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground font-bold">Caricamento...</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground font-bold">Nessun flusso trovato.</td></tr>}
              {!isLoading && filtered.map((f: any) => (
			          <tr key={f.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-bold text-primary">{f.numdoc}</td>
                  <td className="px-4 py-3 font-medium">{formatDate(f.data)}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{f.tipodoc}</td>
                  <td className="px-4 py-3 font-bold truncate max-w-[250px]" title={f.fornitore}>{f.fornitore}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(Number(f.imponibile))}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{formatCurrency(Number(f.imposta))}</td>
                  <td className="px-4 py-3 text-right font-mono font-black text-foreground">{formatCurrency(Number(f.totaledoc))}</td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => {
                        if (!canEdit) {
                          setSuccessModal({ isOpen: true, title: 'Accesso Negato', msg: 'Permessi insufficienti.' });
                          return;
                        }
                        toggleStatusMutation.mutate({ id: f.id, status: Number(f.status) === 0 ? 1 : 0 });
                      }}
                      className={`transition-transform ${canEdit ? 'active:scale-95' : 'cursor-not-allowed opacity-80'}`}
                      title={Number(f.status) === 0 ? 'Documento Caricato. Clicca per sbloccare' : 'Da Caricare. Clicca per bloccare'}
                    >
                      {Number(f.status) === 0 ? (
                        <div className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded font-bold text-[11px]">SÌ (0)</div>
                      ) : (
                        <div className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded font-bold text-[11px]">NO (1)</div>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button 
                      onClick={() => setEditDoc(JSON.parse(JSON.stringify(f)))}
                      className={`p-1.5 rounded-md transition-colors mx-auto flex items-center justify-center border shadow-sm ${canEdit ? 'hover:bg-blue-600 hover:text-white bg-blue-50 text-blue-700 border-blue-200' : 'text-slate-500 bg-slate-50 border-slate-200 hover:bg-slate-100'}`} 
                      title={canEdit ? "Apri Dettaglio / Modifica" : "Visualizza Dettaglio"}
                    >
                      {canEdit ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. CARDS MOBILE (Visibili solo su Smartphone)               */}
      {/* ========================================================= */}
      <div className="md:hidden flex flex-col gap-3 pb-32">
        {isLoading && <div className="p-8 text-center text-muted-foreground font-bold">Caricamento...</div>}
        {!isLoading && filtered.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground font-bold">Nessun flusso trovato.</div>}
        
        {!isLoading && filtered.map((f: any) => (
          <div key={f.id} className="bg-card rounded-xl border border-border p-3.5 shadow-sm flex flex-col gap-2 animate-fade-in">
            
            <div className="flex items-center justify-between gap-2 border-b border-border/50 pb-2 mb-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground uppercase bg-secondary px-1.5 py-0.5 rounded">{f.tipodoc}</span>
                <span className="text-sm font-mono font-bold text-primary">N. {f.numdoc}</span>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{formatDate(f.data)}</span>
            </div>
            
            <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-2">{f.fornitore}</h3>
            
            <div className="flex items-center justify-between mt-1 pt-3 border-t border-border/50">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Totale Documento</span>
                <span className="text-base font-mono font-black text-foreground">{formatCurrency(Number(f.totaledoc))}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    if (!canEdit) { setSuccessModal({ isOpen: true, title: 'Accesso Negato', msg: 'Permessi insufficienti.' }); return; }
                    toggleStatusMutation.mutate({ id: f.id, status: Number(f.status) === 0 ? 1 : 0 });
                  }}
                  className={`transition-transform ${canEdit ? 'active:scale-95' : 'cursor-not-allowed opacity-80'}`}
                >
                  {Number(f.status) === 0 ? (
                    <div className="px-2 py-1.5 bg-green-100 text-green-700 border border-green-200 rounded font-bold text-[10px]">SÌ (0)</div>
                  ) : (
                    <div className="px-2 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded font-bold text-[10px]">NO (1)</div>
                  )}
                </button>

                <button 
                  onClick={() => setEditDoc(JSON.parse(JSON.stringify(f)))}
                  className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 text-[10px] font-bold shadow-sm ${canEdit ? 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                >
                  {canEdit ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {canEdit ? 'APRI' : 'VEDI'}
                </button>
              </div>
            </div>
            
          </div>
        ))}
      </div>	  
	  
	  
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-40">
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">n° documenti in elenco: <strong className="bg-background border border-border px-2 py-0.5 rounded text-foreground">{filtered.length}</strong></span>
          <div className="flex gap-8 items-center">
            <span className="font-bold text-sm text-foreground hidden sm:block">TOTALI:</span>
            <span className="font-mono font-bold text-destructive text-base hidden sm:block">{formatCurrency(totImponibile)}</span>
            <span className="font-mono font-bold text-destructive text-base hidden sm:block">{formatCurrency(totImposta)}</span>
            <span className="font-mono font-black text-destructive text-lg">{formatCurrency(totGenerale)}</span>
          </div>
        </div>
      </div>

      {/* MODALE DETTAGLIO */}
      {editDoc && (
        <div className="fixed inset-0 z-[100] bg-foreground/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditDoc(null)}>
          <form onSubmit={saveEdits} onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <DatabaseBackup className="w-5 h-5 text-primary" /> 
                {canEdit ? 'Modifica / Registra Flusso SDI' : 'Dettaglio Flusso SDI'}
              </h3>
              <div className="flex items-center gap-3">
                {!canEdit && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase rounded border border-red-200">Sola Lettura</span>}
                <button type="button" onClick={() => setEditDoc(null)} className="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg"><X className="w-5 h-5" /></button>
              </div>
            </div>
            
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
				{/* TESTATA EDITABILE CON SPIA VISIVA */}
               <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-secondary/30 p-4 rounded-xl mb-6 border border-border">
                  
                  <div className="md:col-span-3">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Fornitore</span>
                    {canEdit && Number(editDoc.status) === 1 ? <input type="text" value={editDoc.fornitore} onChange={e => handleHeadUpdate('fornitore', e.target.value)} className={inputClass} /> : <span className="font-bold block truncate">{editDoc.fornitore}</span>}
                  </div>
                  
                  <div className="md:col-span-2">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">P.IVA / CF</span>
                    {canEdit && Number(editDoc.status) === 1 ? <input type="text" value={editDoc.idfiscale} onChange={e => handleHeadUpdate('idfiscale', e.target.value)} className={inputClass} /> : <span className="font-mono block truncate">{editDoc.idfiscale}</span>}
                  </div>
                  
                  {/* NUOVO BLOCCO TIPO DOCUMENTO */}
                  <div className="md:col-span-3">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Tipo Multi-V</span>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded text-[10px] border border-blue-200 shrink-0">
                        {editDoc.tipodoc}
                      </span>
                      <span className={`text-[11px] font-bold uppercase truncate ${getMappedTipoDoc(editDoc.tipodoc).includes('⚠️') ? 'text-red-600' : 'text-primary'}`}>
                        {getMappedTipoDoc(editDoc.tipodoc)}
                      </span>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1">Doc. / Data</span>
                    {canEdit && Number(editDoc.status) === 1 ? (
                      <div className="flex flex-col gap-1">
                        <input type="text" value={editDoc.numdoc} onChange={e => handleHeadUpdate('numdoc', e.target.value)} className={inputClass} />
                        <input type="date" value={editDoc.data} onChange={e => handleHeadUpdate('data', e.target.value)} className={inputClass} />
                      </div>
                    ) : <span className="font-bold leading-tight">N. {editDoc.numdoc}<br/>del {formatDate(editDoc.data)}</span>}
                  </div>
                  
                  <div className="md:col-span-2 flex flex-col justify-end">
                    <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-1 text-right">Totale (Lordo)</span>
                    {canEdit && Number(editDoc.status) === 1 ? <input type="number" step="0.01" value={editDoc.totaledoc} onChange={e => handleHeadUpdate('totaledoc', e.target.value)} className={`${inputClass} text-right`} /> : <span className="font-black text-primary text-lg block text-right">{formatCurrency(Number(editDoc.totaledoc))}</span>}
                  </div>
               </div>

               {/* RIGHE EDITABILI */}
               <h4 className="font-bold text-sm mb-2 text-muted-foreground">Righe Documento XML</h4>
               <table className="w-full text-sm text-left border border-border rounded-lg">
                 <thead className="bg-table-header border-b border-border">
                   <tr>
                     <th className="px-3 py-2 font-semibold text-muted-foreground">Descrizione</th>
                     <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-24">Q.tà</th>
                     <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-28">Pr. Unit</th>
                     <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-24">Sc. %</th>
                     <th className="px-3 py-2 font-semibold text-muted-foreground text-right w-24">IVA %</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-border">
                   {editDoc.righe?.map((r: any, idx: number) => (
                     <tr key={r.ID} className="hover:bg-muted/30">
                       <td className="px-3 py-2">
                         {canEdit && Number(editDoc.status) === 1 ? <input type="text" value={r.Descrizione} onChange={e => handleRowUpdate(idx, 'Descrizione', e.target.value)} className={inputClass} /> : r.Descrizione}
                       </td>
                       <td className="px-3 py-2">
                         {canEdit && Number(editDoc.status) === 1 ? <input type="number" step="0.01" value={r.Quantita} onChange={e => handleRowUpdate(idx, 'Quantita', e.target.value)} className={`${inputClass} text-right`} /> : <div className="text-right">{r.Quantita}</div>}
                       </td>
                       <td className="px-3 py-2">
                         {canEdit && Number(editDoc.status) === 1 ? <input type="number" step="0.01" value={r.PrezzoUnitario} onChange={e => handleRowUpdate(idx, 'PrezzoUnitario', e.target.value)} className={`${inputClass} text-right`} /> : <div className="text-right">{r.PrezzoUnitario}</div>}
                       </td>
                       <td className="px-3 py-2">
                         {canEdit && Number(editDoc.status) === 1 ? <input type="number" step="0.01" value={r.sconto} onChange={e => handleRowUpdate(idx, 'sconto', e.target.value)} className={`${inputClass} text-right text-destructive`} /> : <div className="text-right text-destructive">{r.sconto}%</div>}
                       </td>
                       <td className="px-3 py-2">
                         {canEdit && Number(editDoc.status) === 1 ? <input type="number" step="0.01" value={r.AliquotaIVA} onChange={e => handleRowUpdate(idx, 'AliquotaIVA', e.target.value)} className={`${inputClass} text-right`} /> : <div className="text-right">{r.AliquotaIVA}%</div>}
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
            </div>

			{/* FOOTER DEL DETTAGLIO FLUSSO (Ottimizzato per Mobile e PC) */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 border-t border-border bg-card rounded-b-xl shrink-0 w-full overflow-hidden">
              <span className="text-[10px] sm:text-xs text-muted-foreground text-center lg:text-left w-full lg:w-auto">
                {!canEdit ? "Modalità Sola Lettura. Nessuna azione consentita." : Number(editDoc.status) === 0 ? "Documento già registrato. Modifiche disabilitate." : "Documento in attesa. È possibile apportare modifiche e registrare."}
              </span>
              
              <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                <button type="button" onClick={() => setEditDoc(null)} className="w-full sm:w-auto px-5 py-2.5 rounded-lg border border-input text-xs sm:text-sm font-bold text-muted-foreground hover:bg-secondary">
                  {canEdit ? 'Annulla' : 'Chiudi'}
                </button>
                
                {canEdit && Number(editDoc.status) === 1 && (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      type="button" 
                      onClick={() => setConfirmSave(editDoc)}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 rounded-lg border border-primary text-primary text-[10px] sm:text-sm font-bold hover:bg-primary/10 shadow-sm shrink-0"
                    >
                      <Save className="w-4 h-4 shrink-0" /> <span className="truncate">SALVA</span>
                    </button>
                    <button 
                      type="button"
                      onClick={() => setConfirmReg(editDoc)} 
                      className="flex-[1.5] sm:flex-none flex items-center justify-center gap-1.5 px-3 sm:px-6 py-2.5 rounded-lg bg-blue-600 text-white text-[10px] sm:text-sm font-bold hover:bg-blue-700 shadow-md shrink-0"
                    >
                      <DatabaseBackup className="w-4 h-4 shrink-0" /> <span className="truncate">REGISTRA</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

          </form>
        </div>
      )}

	{/* MODALE CONFERMA SALVATAGGIO MODIFICHE */}
      <ConfirmDialog 
        isOpen={!!confirmSave}
        title="Salva Modifiche"
        confirmLabel="Sì, salva modifiche"
        type="info"
        message={<>Vuoi confermare le modifiche apportate alla fattura di <strong>{confirmSave?.fornitore}</strong>?<br/>I dati verranno sovrascritti nella tabella temporanea.</>}
        onClose={() => setConfirmSave(null)}
        onConfirm={() => updateMutation.mutate(confirmSave)}
        isPending={updateMutation.isPending}
      />

      {/* MODALE CONFERMA REGISTRAZIONE IN MULTI-V */}
      <ConfirmDialog 
        isOpen={!!confirmReg}
        title="Forza Registrazione"
        confirmLabel="Sì, Registra in Multi-V"
        type="info"
        message={<>Confermi la registrazione forzata del <strong>{confirmReg?.tipodoc} n. {confirmReg?.numdoc} del {formatDate(confirmReg?.data)}</strong><br/>Fornitore: <strong>{confirmReg?.fornitore}</strong>?</>}
        onClose={() => setConfirmReg(null)}
        onConfirm={() => importMutation.mutate(confirmReg.id)}
        isPending={importMutation.isPending}
      />

	  {/* MODALE DI SUCCESSO UNIVERSALE (Verde) */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-scale-in text-center border border-border">
            <div className="p-6 pt-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-5">
                <CheckCircle className="w-12 h-12 text-success" />
              </div>
              <h2 className="text-xl font-black text-foreground mb-3">{successModal.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium whitespace-pre-wrap">
                {successModal.msg}
              </p>
            </div>
            
            <div className="px-6 py-4 bg-secondary/30 border-t border-border flex flex-col gap-2 justify-center">
              {successModal.newDocId && (
                <button 
                  onClick={() => handleOpenImportedDoc(successModal.newDocId!)} 
                  className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" /> APRI DOCUMENTO
                </button>
              )}
              <button 
                onClick={() => setSuccessModal({ isOpen: false, title: '', msg: '' })} 
                className={`w-full px-4 py-3 rounded-xl font-bold transition-opacity shadow-sm ${successModal.newDocId ? 'border border-input text-muted-foreground hover:bg-secondary' : 'bg-success text-success-foreground hover:opacity-90'}`}
              >
                {successModal.newDocId ? "Torna all'elenco Flussi" : 'CHIUDI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APERTURA DIRETTA DEL DOCUMENTO IMPORTATO */}
      {viewImportedDoc && (
        <div className="fixed z-[9999]">
          <DocumentDetail
            document={viewImportedDoc}
            onClose={() => setViewImportedDoc(null)} 
            onEdit={() => {}}
            onToggle={(field: any) => {
              setViewImportedDoc((prev: any) => prev ? { ...prev, [field]: -1 } : prev);
            }}
          />
        </div>
      )}

	  {/* MODALE DI ERRORE BLOCCANTE */}
      <ConfirmDialog 
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={<div className="whitespace-pre-wrap leading-relaxed">{feedback.msg}</div>}
        confirmLabel="OK, vado a configurarlo"
        hideCancel={true}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
        onConfirm={() => setFeedback({ ...feedback, isOpen: false })}
      />


    </AppLayout>
  );
};

export default FlussiSdiPage;