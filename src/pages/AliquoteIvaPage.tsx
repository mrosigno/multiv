import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw, AlertTriangle } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useAliquote } from '@/hooks/api/useAliquote';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const AliquoteIvaPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  
  // STATO PER LA MODALE DI ELIMINAZIONE
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { data: apiData, isLoading, isError } = useAliquote();

  // --- MUTATIONS ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_aliquota`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(record),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['aliquote'] }); 
      setShowModal(false); 
    },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_aliquota`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aliquote'] });
      setItemToDelete(null);
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  // FILTRO E ORDINAMENTO
  const filteredData = useMemo(() => {
    if (!apiData) return [];
    
    let result = apiData;
    
    // Filtro di ricerca
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => 
        (item.descrizione || '').toLowerCase().includes(q) ||
        (item.codfattel || '').toLowerCase().includes(q)
      );
    }
    
    // Ordinamento Ascendente per ID
    return result.sort((a: any, b: any) => Number(a.Id) - Number(b.Id));
  }, [apiData, searchQuery]);

  const handleNew = () => {
    const rawData = apiData || [];
    const nextId = rawData.length > 0 ? Math.max(...rawData.map((item: any) => Number(item.Id))) + 1 : 1;
    setEditingRecord({ 
      Id: nextId, 
      descrizione: '', 
      aliquota: 0, 
      codfattel: '', 
      _isNewRecord: true 
    });
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
          <h1 className="text-2xl font-bold text-foreground">Aliquote IVA</h1>
          <p className="text-sm text-muted-foreground">Gestione delle aliquote IVA e codici per fatturazione elettronica.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nuova Aliquota
        </button>
      </div>

      {/* Barra di ricerca */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cerca per descrizione o codice..." 
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
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">ID</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-32">Aliquota %</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Cod. Fatt. Elettr.</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={5} className="p-8 text-center text-destructive">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && filteredData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nessuna aliquota trovata.</td></tr>}

            {!isLoading && filteredData.map((item: any, idx: number) => (
              <tr key={item.Id} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 text-mono text-muted-foreground">{item.Id}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.descrizione}</td>
                <td className="px-4 py-3 text-right text-mono font-bold">{Number(item.aliquota || 0)}%</td>
                <td className="px-4 py-3 text-center text-mono">{item.codfattel || '-'}</td>
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
        {!isLoading && filteredData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessuna aliquota trovata.</div>}

        {!isLoading && filteredData.map((item: any) => (
          <div key={item.Id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md">ID: {item.Id}</span>
              <span className="text-sm font-mono font-bold text-foreground">
                Aliquota: {Number(item.aliquota || 0)}%
              </span>
            </div>
            <h3 className="text-base font-bold text-foreground mb-1">{item.descrizione}</h3>
            <p className="text-xs text-muted-foreground mb-3">Cod. FE: {item.codfattel || '-'}</p>
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

      {/* Modale Inserimento / Modifica */}
      {showModal && (
        <AliquotaFormModal 
          record={editingRecord} 
          existingData={apiData || []} // Passiamo i dati esistenti per il controllo ID
          onSave={(data) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => setShowModal(false)} 
        />
      )}

      {/* MODALE DI CONFERMA ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Aliquota IVA"
        message={<>Sei sicuro di voler eliminare l'aliquota <strong>{itemToDelete?.descrizione}</strong>?<br/>L'operazione non è reversibile.</>}
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.Id)}
        isPending={deleteMutation.isPending}
      />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO ---
const AliquotaFormModal = ({ record, existingData, onSave, isSaving, onClose }: { record: any, existingData: any[], onSave: (r: any) => void, isSaving: boolean, onClose: () => void }) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  // Stato per la modale di conflitto ID
  const [showConflictAlert, setShowConflictAlert] = useState(false);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    
    // CONTROLLO CONFLITTO ID
    const newId = Number(form.Id);
    const isConflict = existingData.some((item: any) => {
      // Se sto modificando e trovo lo stesso record originale, non è un conflitto
      if (isEdit && Number(record.Id) === newId) return false;
      return Number(item.Id) === newId;
    });

    if (isConflict) {
      setShowConflictAlert(true);
      return; // Blocca il salvataggio
    }

    onSave(form); 
  };
  
  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <>
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-md flex flex-col max-h-[95vh] animate-fade-in">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
            <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Aliquota IVA' : 'Nuova Aliquota IVA'}</h3>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
            <form id="aliquota-form" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>ID *</label>
                  <input 
                    type="number" 
                    value={form.Id} 
                    onChange={e => setForm({ ...form, Id: +e.target.value })} 
                    className={`${inputClass} font-mono font-bold`} 
                    required 
                  />
                </div>
                <div>
                  <label className={labelClass}>Aliquota % *</label>
                  <input type="number" step="0.01" value={form.aliquota ?? 0} onChange={e => setForm({ ...form, aliquota: +e.target.value })} className={inputClass} required />
                </div>
              </div>
              
              <div>
                <label className={labelClass}>Descrizione *</label>
                <input type="text" value={form.descrizione || ''} onChange={e => setForm({ ...form, descrizione: e.target.value })} className={inputClass} required />
              </div>
              
              <div>
                <label className={labelClass}>Cod. Fatturazione Elettronica</label>
                <input type="text" value={form.codfattel || ''} onChange={e => setForm({ ...form, codfattel: e.target.value })} className={inputClass} placeholder="Es. N3.2" />
              </div>
            </form>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
              Annulla
            </button>
            <button type="submit" form="aliquota-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>

      {/* MODALE DI AVVISO CONFLITTO ID */}
      {showConflictAlert && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-sm flex flex-col overflow-hidden text-center animate-scale-in">
            <div className="p-6 pt-8 flex flex-col items-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-5">
                <AlertTriangle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-3">Attenzione!</h2>
              <p className="text-sm text-muted-foreground">
                L'ID <strong>{form.Id}</strong> che hai inserito è già utilizzato da un'altra aliquota. Scegli un numero diverso per poter salvare.
              </p>
            </div>
            <div className="px-6 py-4 bg-secondary/30 border-t border-border flex justify-center">
              <button 
                onClick={() => setShowConflictAlert(false)} 
                className="px-8 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity shadow-sm"
              >
                OK, ho capito
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AliquoteIvaPage;