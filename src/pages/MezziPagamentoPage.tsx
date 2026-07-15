import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const MezziPagamentoPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  
  // STATO PER LA MODALE DI ELIMINAZIONE
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { data: apiData, isLoading, isError } = useMezziPagamento();

  // --- MUTATIONS ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_mezzo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['mezzi_pagamento'] }); 
      setShowModal(false); 
    },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (cod: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_mezzo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: cod }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mezzi_pagamento'] });
      setItemToDelete(null);
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  const filteredData = useMemo(() => {
    if (!apiData) return [];
    let result = apiData.map((item: any) => ({ ...item, cod: Number(item.id || item.cod) }));
    if (!searchQuery) return result;
    const q = searchQuery.toLowerCase();
    return result.filter((item: any) => (item.descrizione || '').toLowerCase().includes(q));
  }, [apiData, searchQuery]);

  const handleNew = () => {
    const rawData = apiData || [];
    const nextId = rawData.length > 0 ? Math.max(...rawData.map((item: any) => Number(item.id || item.cod))) + 1 : 1;
    // FIX: Aggiunto codfattel vuoto di default per i nuovi inserimenti
    setEditingRecord({ cod: nextId, descrizione: '', speseinc: 0, codfattel: '', _isNewRecord: true });
    setShowModal(true);
  };

  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Mezzi di Pagamento</h1>
          <p className="text-sm text-muted-foreground">Gestione dei mezzi di pagamento indiretti.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nuovo Mezzo
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Cerca per descrizione..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {/* Desktop Table (Senza Cestino) */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">Cod</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione</th>
              {/* FIX: Nuova colonna per il codice SDI */}
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-32">Codice SDI</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-32">Spese Incasso €</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>}
            {!isLoading && filteredData.map((item, idx) => (
              <tr key={item.cod} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 text-mono text-muted-foreground">{item.cod}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.descrizione}</td>
                {/* Visualizza il codice fatturazione elettronica in modo chiaro */}
                <td className="px-4 py-3 text-center text-muted-foreground font-mono">{item.codfattel || '-'}</td>
                <td className="px-4 py-3 text-right text-mono">{Number(item.speseinc || 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors mx-auto block" title="Modifica Mezzo">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (Senza Cestino) */}
      <div className="md:hidden space-y-3 pb-24">
        {!isLoading && filteredData.map(item => (
          <div key={item.cod} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">Cod: {item.cod}</span>
              <span className="text-sm font-mono font-bold text-foreground">Spese: € {Number(item.speseinc || 0).toFixed(2)}</span>
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">{item.descrizione}</h3>
            {/* Visualizzazione Codice SDI su mobile */}
            <p className="text-xs text-muted-foreground mb-3">Codice SDI: <span className="font-mono">{item.codfattel || '-'}</span></p>
            <div className="flex justify-end pt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Modifica Mezzo
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <MezzoFormModal 
          record={editingRecord} 
          onSave={(data) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => setShowModal(false)} 
          onDeleteRequest={(cod) => {
            setShowModal(false);
            setItemToDelete(cod);
          }}
        />
      )}

      {/* MODALE DI CONFERMA ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Mezzo di Pagamento"
        message={<>Sei sicuro di voler eliminare questo mezzo di pagamento?<br/>L'operazione non è reversibile.</>}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete)}
        isPending={deleteMutation.isPending}
      />
    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO ---
const MezzoFormModal = ({ record, onSave, isSaving, onClose, onDeleteRequest }: { record: any, onSave: (r: any) => void, isSaving: boolean, onClose: () => void, onDeleteRequest: (cod: number) => void }) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    onSave(form); 
  };
  
  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Mezzo' : 'Nuovo Mezzo'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="mezzo-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Cod (Auto)</label>
                <input type="text" value={form.cod || 'Auto'} disabled className={`${inputClass} bg-secondary/50 font-mono text-muted-foreground`} />
              </div>
              <div>
                <label className={labelClass}>Codice SDI (XML)</label>
                {/* FIX: Se il DB ha null o vuoto, fallback su stringa vuota per la select */}
                <select value={form.codfattel || ''} onChange={e => setForm({ ...form, codfattel: e.target.value })} className={`${inputClass} font-mono`}>
                  <option value="">-- Seleziona --</option>
                  <option value="MP01">MP01 - Contanti</option>
                  <option value="MP02">MP02 - Assegno</option>
                  <option value="MP05">MP05 - Bonifico</option>
                  <option value="MP08">MP08 - Carta di pagamento</option>
                  <option value="MP09">MP09 - RID</option>
                  <option value="MP12">MP12 - Ri.Ba.</option>
                  <option value="MP22">MP22 - Trattenuta su somme già riscosse</option>
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Descrizione *</label>
              <input type="text" value={form.descrizione || ''} onChange={e => setForm({ ...form, descrizione: e.target.value })} className={inputClass} required />
            </div>
            <div>
              <label className={labelClass}>Spese Incasso €</label>
              <input type="number" step="0.01" value={form.speseinc ?? 0} onChange={e => setForm({ ...form, speseinc: +e.target.value })} className={inputClass} />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
          <div>
            {isEdit && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(form.cod)} 
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Elimina
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
              Annulla
            </button>
            <button type="submit" form="mezzo-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Salvataggio...' : 'Salva Mezzo'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MezziPagamentoPage;