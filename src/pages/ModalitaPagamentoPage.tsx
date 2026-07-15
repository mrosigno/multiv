import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog'; // <-- NUOVO IMPORT
import { useModalitaPagamento } from '@/hooks/api/useModalitaPagamento';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const ModalitaPagamentoPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  
  // STATO PER LA MODALE DI ELIMINAZIONE
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { data: apiData, isLoading, isError } = useModalitaPagamento();
  const { data: mezziData = [] } = useMezziPagamento();

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_modalita`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['modalita_pagamento'] }); setShowModal(false); },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (idmod: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_modalita`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idmod }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['modalita_pagamento'] }); 
      setItemToDelete(null); // Chiude la modale di eliminazione
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  const filteredData = useMemo(() => {
    if (!apiData) return [];
    if (!searchQuery) return apiData;
    const q = searchQuery.toLowerCase();
    return apiData.filter((item: any) => (item.Mod || '').toLowerCase().includes(q));
  }, [apiData, searchQuery]);

  const getMezzoName = (cod: number) => {
    const m = mezziData.find((x: any) => Number(x.id || x.cod) === Number(cod));
    return m ? m.descrizione : '-';
  };

  const handleNew = () => {
    const rawData = apiData || [];
    const nextId = rawData.length > 0 ? Math.max(...rawData.map((item: any) => Number(item.idmod))) + 1 : 1;
    setEditingRecord({ idmod: nextId, Mod: '', riba: mezziData.length > 0 ? (mezziData[0].id || mezziData[0].cod) : 1, nrate: 0, t: 0, lock: 0, note_fatt: '', _isNewRecord: true });
    setShowModal(true);
  };

  const handleEdit = (record: any) => { setEditingRecord({ ...record, _isNewRecord: false }); setShowModal(true); };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      {/* Header & Filtro */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Modalità di Pagamento</h1>
          <p className="text-sm text-muted-foreground">Gestione delle condizioni di pagamento e rateazioni.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 font-medium text-sm">
          <Plus className="w-4 h-4" /> Nuova Modalità
        </button>
      </div>
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Cerca..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 py-2 rounded-lg border border-input text-sm focus:ring-primary/50" />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">ID</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione (Mod)</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Mezzo Collegato</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Rate</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredData.map((item: any) => (
              <tr key={item.idmod} className="hover:bg-muted/30">
                <td className="px-4 py-3 text-muted-foreground">{item.idmod}</td>
                <td className="px-4 py-3 font-medium">{item.Mod}</td>
                <td className="px-4 py-3"><span className="bg-secondary px-2 py-1 rounded-md text-xs">{getMezzoName(item.riba)}</span></td>
                <td className="px-4 py-3 text-center text-mono">{item.nrate || 0}</td>
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
          <div key={item.idmod} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <h3 className="font-bold mb-2">{item.Mod}</h3>
            <span className="bg-secondary px-2 py-1 rounded-md text-xs">{getMezzoName(item.riba)}</span>
            <div className="flex justify-end gap-2 pt-3 mt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-md text-xs font-medium"><Pencil className="w-3.5 h-3.5" /> Modifica</button>
              {/* AL CLICK DEL CESTINO, IMPOSTIAMO L'OGGETTO DA ELIMINARE */}
              <button onClick={() => setItemToDelete(item)} className="flex gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive rounded-md text-xs font-medium"><Trash2 className="w-3.5 h-3.5" /> Elimina</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && <ModalitaFormModal record={editingRecord} mezzi={mezziData} onSave={(d) => saveMutation.mutate(d)} isSaving={saveMutation.isPending} onClose={() => setShowModal(false)} />}
      
      {/* LA NOSTRA NUOVA MODALE DI CONFERMA */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Modalità"
        message={<>Sei sicuro di voler eliminare la modalità di pagamento <strong>{itemToDelete?.Mod}</strong>?<br/>L'operazione non è reversibile.</>}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.idmod)}
        isPending={deleteMutation.isPending}
      />

    </AppLayout>
  );
};

const ModalitaFormModal = ({ record, mezzi, onSave, isSaving, onClose }: any) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(form); };
  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";
  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold">{isEdit ? 'Modifica Modalità' : 'Nuova Modalità'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar"><form id="modalita-form" onSubmit={handleSubmit}>
            <fieldset className="border border-border rounded-lg p-5 bg-card/50 shadow-sm mb-4">
              <legend className="text-sm font-bold text-primary px-2 bg-background border border-border rounded-md">Dati Generali</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-2"><label className={labelClass}>ID (Auto)</label><input type="text" value={form.idmod} disabled className={`${inputClass} bg-secondary/50 font-mono`} /></div>
                <div className="md:col-span-10"><label className={labelClass}>Descrizione *</label><input type="text" value={form.Mod || ''} onChange={e => setForm({ ...form, Mod: e.target.value })} className={inputClass} required /></div>
                <div className="md:col-span-12"><label className={labelClass}>Mezzo Collegato</label><select value={form.riba ?? 1} onChange={e => setForm({ ...form, riba: Number(e.target.value) })} className={inputClass}>{mezzi.map((m: any) => <option key={m.id || m.cod} value={m.id || m.cod}>{m.descrizione}</option>)}</select></div>
              </div>
            </fieldset>
            <fieldset className="border border-border rounded-lg p-5 bg-card/50 shadow-sm mb-4">
              <legend className="text-sm font-bold text-primary px-2 bg-background border border-border rounded-md">Rateazione</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4"><label className={labelClass}>Num. Rate</label><input type="number" value={form.nrate ?? 0} onChange={e => setForm({ ...form, nrate: Number(e.target.value) })} className={inputClass} /></div>
                <div className="md:col-span-4"><label className={labelClass}>Tempo in gg</label><input type="number" value={form.t ?? 0} onChange={e => setForm({ ...form, t: Number(e.target.value) })} className={inputClass} /></div>
                <div className="md:col-span-4"><label className={labelClass}>Fine Mese</label><select value={form.lock ?? 0} onChange={e => setForm({ ...form, lock: Number(e.target.value) })} className={inputClass}><option value={0}>NO (0)</option><option value={-1}>SI (-1)</option></select></div>
                <div className="md:col-span-12"><label className={labelClass}>Note in Fattura</label><textarea value={form.note_fatt || ''} onChange={e => setForm({ ...form, note_fatt: e.target.value })} rows={2} className={`${inputClass} resize-none`} /></div>
              </div>
            </fieldset>
        </form></div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card rounded-b-xl"><button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm hover:bg-secondary">Annulla</button><button type="submit" form="modalita-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">{isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{isSaving ? 'Salvataggio...' : 'Salva'}</button></div>
      </div>
    </div>
  );
};

export default ModalitaPagamentoPage;