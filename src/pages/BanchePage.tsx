import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useQueryClient, useQuery, useMutation } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const BanchePage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // STATO PER LA MODALE DI ELIMINAZIONE
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const queryClient = useQueryClient();

  // --- FETCH DATI ---
  const { data: apiData, isLoading, isError } = useQuery({
    queryKey: ['banche'],
    queryFn: async () => {
      const res = await fetch(`${API_HOST}/api.php?action=banche`);
      const data = await res.json();
      // Mappiamo subito l'ID per coerenza se l'API restituisce 'iban' come 'id'
      return data.map((item: any) => ({ ...item, id: item.id || item.iban }));
    }
  });

  // --- MUTATIONS REALI ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_banca`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        // Passiamo isNew al backend come richiesto dall'api.php
        body: JSON.stringify({ ...record, isNew: record._isNewRecord })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['banche'] }); 
      setShowModal(false); 
    },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_banca`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['banche'] });
      setItemToDelete(null);
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  // --- FILTRO DATI ---
  const filteredData = useMemo(() => {
    if (!apiData) return [];
    if (!searchQuery) return apiData;
    const q = searchQuery.toLowerCase();
    return apiData.filter((item: any) => 
      (item.nomebanca || '').toLowerCase().includes(q) || 
      (item.id || '').toLowerCase().includes(q)
    );
  }, [apiData, searchQuery]);

  // --- HANDLERS ---
  const handleNew = () => { 
    setEditingRecord({ id: '', nomebanca: '', Note: '', _isNewRecord: true }); 
    setShowModal(true); 
  };
  
  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Istituti di Credito</h1>
          <p className="text-sm text-muted-foreground">Gestione delle banche e degli IBAN aziendali.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nuova Banca
        </button>
      </div>

      {/* Ricerca */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cerca per nome o IBAN..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
          />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-64">IBAN</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Nome Banca</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Note</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={4} className="p-8 text-center text-destructive">Errore di connessione.</td></tr>}
            {!isLoading && !isError && filteredData.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nessuna banca trovata.</td></tr>}

            {!isLoading && filteredData.map((item: any, idx: number) => (
              <tr key={item.id} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 font-mono font-bold text-primary">{item.id}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.nomebanca}</td>
                <td className="px-4 py-3 text-muted-foreground">{item.Note}</td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => setItemToDelete(item)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3 pb-24">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Caricamento in corso...</div>}
        {!isLoading && filteredData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessuna banca trovata.</div>}

        {!isLoading && filteredData.map((item: any) => (
          <div key={item.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md break-all">{item.id}</span>
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">{item.nomebanca}</h3>
            <p className="text-sm text-muted-foreground mb-3">{item.Note || 'Nessuna nota'}</p>
            <div className="flex justify-end gap-2 pt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Modifica
              </button>
              <button onClick={() => setItemToDelete(item)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Elimina
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODALE INSERIMENTO / MODIFICA */}
      {showModal && (
        <BancaFormModal 
          record={editingRecord} 
          onSave={(data) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => setShowModal(false)} 
        />
      )}

      {/* MODALE CONFERMA ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Istituto di Credito"
        message={<>Sei sicuro di voler eliminare la banca <strong>{itemToDelete?.nomebanca}</strong>?<br/>L'operazione non è reversibile.</>}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.id)}
        isPending={deleteMutation.isPending}
      />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO ---
const BancaFormModal = ({ record, onSave, isSaving, onClose }: { record: any, onSave: (r: any) => void, isSaving: boolean, onClose: () => void }) => {
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
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-md flex flex-col max-h-[95vh] animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold">{isEdit ? 'Modifica Banca' : 'Nuova Banca'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <form id="banca-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelClass}>IBAN *</label>
              <input 
                type="text" 
                value={form.id || ''} 
                onChange={e => setForm({ ...form, id: e.target.value })} 
                disabled={isEdit} 
                className={`${inputClass} font-mono font-bold ${isEdit ? 'bg-secondary/50 text-muted-foreground' : ''}`} 
                required 
                placeholder="IT..." 
              />
            </div>
            <div>
              <label className={labelClass}>Nome Banca *</label>
              <input 
                type="text" 
                value={form.nomebanca || ''} 
                onChange={e => setForm({ ...form, nomebanca: e.target.value })} 
                className={inputClass} 
                required 
              />
            </div>
            <div>
              <label className={labelClass}>Note</label>
              <textarea 
                value={form.Note || ''} 
                onChange={e => setForm({ ...form, Note: e.target.value })} 
                rows={4} 
                className={`${inputClass} resize-none`} 
                placeholder="Riferimenti agenzia, contatti..."
              />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
            Annulla
          </button>
          <button 
            type="submit" 
            form="banca-form" 
            disabled={isSaving} 
            className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
          >
            {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BanchePage;