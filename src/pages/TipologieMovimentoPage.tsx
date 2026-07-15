import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog'; // <-- NUOVO IMPORT
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useCausali } from '@/hooks/api/useCausali';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const TipologieMovimentoPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  const [causaleFiltro, setCausaleFiltro] = useState<number>(0);
  
  // Gestione Modali
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  
  // STATO PER LA MODALE DI ELIMINAZIONE
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const queryClient = useQueryClient();

  const { data: apiData, isLoading, isError } = useTipologieMovimento();
  const { data: causaliData = [], isLoading: causaliLoading } = useCausali();

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_tipologia`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.IdTipo, IdTipo: record.IdTipo, Descrizione: record.Descrizione,
          idcausale: record.idcausale, codice: record.codice
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tipologie_movimento'] }); setShowModal(false); },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_tipologia`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['tipologie_movimento'] }); 
      setItemToDelete(null); // Chiude la modale di eliminazione
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  const filteredData = useMemo(() => {
    if (!apiData) return [];
    let result = apiData.map((item: any) => ({ ...item, IdTipo: Number(item.id || item.IdTipo) }));
    if (causaleFiltro > 0) result = result.filter((item: any) => Number(item.idcausale) === causaleFiltro);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => (item.Descrizione || '').toLowerCase().includes(q) || (item.codice || '').toLowerCase().includes(q));
    }
    return result;
  }, [apiData, searchQuery, causaleFiltro]);

  const getCausaleName = (idcausale: number) => {
    const c = causaliData.find((x: any) => Number(x.id) === Number(idcausale));
    return c ? `${c.suffisso} - ${c.Descrizione}` : '-';
  };

  const handleNew = () => {
    const rawData = apiData || [];
    const nextId = rawData.length > 0 ? Math.max(...rawData.map((item: any) => Number(item.id || item.IdTipo))) + 1 : 1;
    setEditingRecord({ IdTipo: nextId, codice: '', Descrizione: '', idcausale: causaliData.length > 0 ? causaliData[0].id : 0, _isNewRecord: true });
    setShowModal(true);
  };

  const handleEdit = (record: any) => { setEditingRecord({ ...record, _isNewRecord: false }); setShowModal(true); };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      {/* Header & Filtri (Invariato) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tipologie Movimento</h1>
          <p className="text-sm text-muted-foreground">Gestione dei sottoconti e delle tipologie collegate alle causali.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm">
          <Plus className="w-4 h-4" /> Nuova Tipologia
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <select value={causaleFiltro} onChange={(e) => setCausaleFiltro(Number(e.target.value))} className="w-full sm:w-64 px-3 py-2 rounded-lg border border-input text-sm">
            <option value={0}>Tutte le Causali</option>
            {causaliData.map((c: any) => <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" placeholder="Cerca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 py-2 rounded-lg border border-input text-sm" />
          </div>
        </div>
      </div>

      {/* Tabella Desktop */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">IdTipo</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-32">Codice</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Causale Collegata</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredData.map((item: any) => (
              <tr key={item.IdTipo} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{item.IdTipo}</td>
                <td className="px-4 py-3 font-mono font-medium">{item.codice || '-'}</td>
                <td className="px-4 py-3 font-medium">{item.Descrizione}</td>
                <td className="px-4 py-3"><span className="bg-secondary px-2 py-1 rounded-md text-xs">{getCausaleName(item.idcausale)}</span></td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(item)} className="p-1.5 hover:bg-secondary text-primary rounded-md"><Pencil className="w-4 h-4" /></button>
                  {/* AL CLICK DEL CESTINO, IMPOSTIAMO L'OGGETTO DA ELIMINARE */}
                  <button onClick={() => setItemToDelete(item)} className="p-1.5 hover:bg-destructive/10 text-destructive rounded-md"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 pb-24">
        {filteredData.map((item: any) => (
          <div key={item.IdTipo} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-bold mb-2">{item.Descrizione}</h3>
            <span className="bg-secondary px-2 py-1 rounded-md text-xs">{getCausaleName(item.idcausale)}</span>
            <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs font-medium"><Pencil className="w-3.5 h-3.5" /> Modifica</button>
              {/* AL CLICK DEL CESTINO, IMPOSTIAMO L'OGGETTO DA ELIMINARE */}
              <button onClick={() => setItemToDelete(item)} className="flex gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md text-xs font-medium"><Trash2 className="w-3.5 h-3.5" /> Elimina</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && <TipologiaFormModal record={editingRecord} causali={causaliData} onSave={(d) => saveMutation.mutate(d)} isSaving={saveMutation.isPending} onClose={() => setShowModal(false)} />}
      
      {/* LA NOSTRA NUOVA MODALE DI CONFERMA */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Tipologia"
        message={<>Sei sicuro di voler eliminare la tipologia <strong>{itemToDelete?.Descrizione}</strong>?<br/>L'operazione non è reversibile.</>}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.IdTipo)}
        isPending={deleteMutation.isPending}
      />

    </AppLayout>
  );
};

const TipologiaFormModal = ({ record, causali, onSave, isSaving, onClose }: any) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(form); };
  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50";
  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold">{isEdit ? 'Modifica Sottoconto' : 'Nuovo Sottoconto'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1"><form id="tipologia-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">IdTipo</label><input type="text" value={form.IdTipo} disabled className={`${inputClass} bg-secondary/50 font-mono`} /></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Codice</label><input type="text" value={form.codice || ''} onChange={e => setForm({ ...form, codice: e.target.value })} className={inputClass} /></div>
            </div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Descrizione *</label><input type="text" value={form.Descrizione || ''} onChange={e => setForm({ ...form, Descrizione: e.target.value })} className={inputClass} required /></div>
            <div><label className="block text-xs font-medium text-muted-foreground mb-1">Causale *</label><select value={form.idcausale} onChange={e => setForm({ ...form, idcausale: Number(e.target.value) })} className={inputClass} required>{causali.map((c: any) => <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>)}</select></div>
        </form></div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card rounded-b-xl"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm hover:bg-secondary">Annulla</button><button type="submit" form="tipologia-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">{isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{isSaving ? 'Salvataggio...' : 'Salva'}</button></div>
      </div>
    </div>
  );
};

export default TipologieMovimentoPage;