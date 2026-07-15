import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, FileText } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import FastAutocomplete from '@/components/ui/FastAutocomplete';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';
import { useClienti } from '@/hooks/api/useClienti';
import { API_HOST } from '@/config';

const fetchAnnotazioni = async () => (await fetch(`${API_HOST}/api.php?action=get_annotazioni`)).json();

export default function AnnotazioniPage() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: apiData = [], isLoading } = useQuery({ queryKey: ['annotazioni'], queryFn: fetchAnnotazioni });
  const { data: tipiDocData = [] } = useTipiDocumento();
  const { data: clientiData = [] } = useClienti();

  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{isOpen: boolean, type: any, title: string, msg: string}>({ isOpen: false, type: 'info', title: '', msg: '' });

  const filteredData = useMemo(() => {
    if (!searchQuery) return apiData;
    const q = searchQuery.toLowerCase();
    return apiData.filter((item: any) => (item.titolo || '').toLowerCase().includes(q) || (item.testo || '').toLowerCase().includes(q));
  }, [apiData, searchQuery]);

  const handleNew = () => { setEditingRecord(null); setShowModal(true); };
  const handleEdit = (record: any) => { setEditingRecord(record); setShowModal(true); };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_annotazione`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotazioni'] });
      setConfirmDelete(null);
      setFeedback({ isOpen: true, type: 'success', title: 'Eliminata', msg: 'Annotazione rimossa con successo.' });
    },
    onError: (err: any) => {
      setConfirmDelete(null);
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_annotazione`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record) });
      const result = await res.json();
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['annotazioni'] });
      setShowModal(false);
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvato', msg: 'Annotazione salvata correttamente.' });
    },
    onError: (err: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message })
  });

  const getTipoDocName = (id: number) => id === 0 ? 'Tutti i Tipi' : tipiDocData.find((t:any) => Number(t.id) === Number(id))?.descrizione || 'N/D';
  const getClienteName = (id: number) => id === 0 ? 'Tutti i Clienti' : clientiData.find((c:any) => Number(c.ID) === Number(id))?.Ragione_Sociale || 'N/D';
  const formatDate = (d: string) => d ? d.split('-').reverse().join('/') : 'Senza Scadenza';

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Annotazioni Documenti</h1>
          <p className="text-sm text-muted-foreground">Testi dinamici da stampare in calce ai documenti PDF.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-bold text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-5 h-5" /> Nuova Annotazione
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-6 p-4 animate-fade-in">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Cerca nel titolo o nel testo..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden lg:flex lg:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20 animate-fade-in">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-16">ID</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Titolo</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-48">Vincolo Documento</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-48">Vincolo Cliente</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-32 text-center">Scadenza</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>}
            {!isLoading && filteredData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nessuna annotazione trovata.</td></tr>}
            {!isLoading && filteredData.map((item: any, idx: number) => (
              <tr key={item.id} onClick={() => handleEdit(item)} className={`hover:bg-muted/40 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 text-mono text-muted-foreground font-bold">{item.id}</td>
                <td className="px-4 py-3 font-bold text-foreground">{item.titolo}</td>
                <td className="px-4 py-3 text-primary font-bold text-xs"><span className="bg-primary/10 px-2 py-1 rounded">{getTipoDocName(item.idtipodoc)}</span></td>
                <td className="px-4 py-3 text-amber-700 font-bold text-xs truncate max-w-[200px]"><span className="bg-amber-100 px-2 py-1 rounded">{getClienteName(item.idcliente)}</span></td>
                <td className="px-4 py-3 text-center text-xs font-mono">{formatDate(item.scadenza)}</td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleEdit(item)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto">
                    <Pencil className="w-3.5 h-3.5" /> MODIFICA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* MOBILE CARDS */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
        {!isLoading && filteredData.map((item: any) => (
          <div key={item.id} onClick={() => handleEdit(item)} className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer flex flex-col">
            <div className="flex items-center justify-between mb-2 gap-2">
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">ID: {item.id}</span>
              <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="ml-auto flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm shrink-0">
                <Pencil className="w-3 h-3" /> MODIFICA
              </button>
            </div>
            <h3 className="text-sm font-bold text-foreground mb-3">{item.titolo}</h3>
            <div className="flex flex-col gap-1.5 mt-auto pt-3 border-t border-border/50 text-[10px] font-bold">
              <span className="bg-primary/10 text-primary px-2 py-1 rounded truncate">Doc: {getTipoDocName(item.idtipodoc)}</span>
              <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded truncate">Cli: {getClienteName(item.idcliente)}</span>
              <span className="bg-secondary text-muted-foreground px-2 py-1 rounded w-max">Scad: {formatDate(item.scadenza)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* SOTTO-MODALE COMPILAZIONE */}
      {showModal && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={() => setShowModal(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-background rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-4xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col animate-fade-up sm:animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-800 text-white sm:rounded-t-xl shrink-0">
              <h3 className="text-lg font-bold tracking-wide flex items-center gap-2"><FileText className="w-5 h-5 text-blue-400"/> {editingRecord ? 'Modifica Annotazione' : 'Nuova Annotazione'}</h3>
              <button onClick={() => setShowModal(false)} disabled={saveMutation.isPending} className="p-2 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"><X className="w-5 h-5" /></button>
            </div>
            
            <form id="annotazione-form" onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(editingRecord || { idtipodoc: 0, idcliente: 0, titolo: '', testo: '', scadenza: '' }); }} className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6 min-h-0 bg-slate-50/50">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Titolo Interno (Non Stampato) *</label>
                    <input type="text" value={editingRecord?.titolo || ''} onChange={e => setEditingRecord({...editingRecord, titolo: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-input bg-background font-bold text-sm focus:ring-2 focus:ring-primary/50 outline-none" required />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Applica a Tipo Documento</label>
                    <select value={editingRecord?.idtipodoc || 0} onChange={e => setEditingRecord({...editingRecord, idtipodoc: +e.target.value})} className="w-full px-3 py-2 rounded-lg border border-input bg-background font-bold text-primary text-sm focus:ring-2 focus:ring-primary/50 outline-none">
                      <option value={0}>TUTTI I DOCUMENTI (0)</option>
                      {tipiDocData.map((t: any) => <option key={t.id} value={t.id}>{t.descrizione}</option>)}
                    </select>
                  </div>

				  <div className="relative">
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Applica a Cliente</label>
                    <FastAutocomplete 
                      options={[
                        { id: 0, label: 'TUTTI I CLIENTI (0)', searchString: 'tutti i clienti (0)' }, 
                        ...clientiData.map((c:any) => {
                          const ragSoc = c.Ragione_Sociale || c['Ragione Sociale'] || 'Cliente Sconosciuto';
                          return {
                            id: c.ID, 
                            label: ragSoc, 
                            searchString: String(ragSoc).toLowerCase(),
                            originalData: c
                          };
                        })
                      ]} 
                      value={editingRecord?.idcliente || 0} 
                      onChange={(id) => setEditingRecord({...editingRecord, idcliente: Number(id)})} 
                      placeholder="Cerca cliente..." 
                      className="w-full font-bold text-sm border-amber-300 bg-amber-50 text-amber-900 focus:ring-amber-500" 
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Scadenza (Opzionale)</label>
                    <input type="date" value={editingRecord?.scadenza || ''} onChange={e => setEditingRecord({...editingRecord, scadenza: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none" />
                    <p className="text-[10px] text-muted-foreground mt-1">Se impostata, la nota non sarà più stampata superata la data.</p>
                  </div>
                </div>

                <div className="bg-card p-4 rounded-xl border border-border shadow-sm flex flex-col">
                  <label className="block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Testo da Stampare sul Documento *</label>
                  <textarea value={editingRecord?.testo || ''} onChange={e => setEditingRecord({...editingRecord, testo: e.target.value})} className="w-full p-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none flex-1 resize-none min-h-[200px]" placeholder="Scrivi il testo legale o il messaggio da aggiungere in calce al documento..." required />
                </div>
              </div>
            </form>

            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0">
              <div className="w-full sm:w-auto">
                {editingRecord?.id && (
                  <button type="button" onClick={() => setConfirmDelete(editingRecord.id)} disabled={saveMutation.isPending} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors disabled:opacity-50">
                    <Trash2 className="w-4 h-4" /> Elimina
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                <button type="button" onClick={() => setShowModal(false)} disabled={saveMutation.isPending} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 sm:py-2.5 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
                  Annulla
                </button>
                <button type="submit" form="annotazione-form" disabled={saveMutation.isPending} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
                  <Save className="w-4 h-4" /> {editingRecord?.id ? 'Salva Modifiche' : 'Salva Nota'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog isOpen={!!confirmDelete} title="Elimina Annotazione" type="danger" message={<>Sei sicuro di voler eliminare questa annotazione dal sistema?</>} onClose={() => setConfirmDelete(null)} onConfirm={() => deleteMutation.mutate(confirmDelete as number)} isPending={deleteMutation.isPending} />
      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback(p=>({...p, isOpen:false}))} />
    </AppLayout>
  );
}