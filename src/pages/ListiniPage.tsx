import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useListini } from '@/hooks/api/useListini';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const ListiniPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { data: apiData, isLoading, isError } = useListini();

  // --- CONTROLLO LIMITE 6 LISTINI ---
  const isMaxListiniReached = (apiData || []).length >= 6;

  // --- MUTATION PER SALVATAGGIO REALE ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_listino`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          Id: record.Id,
          Descrizione: record.Descrizione,
          provv: record.provv
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['listini'] }); 
      setShowModal(false); 
    },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  // --- FILTRO DATI ---
  const filteredData = useMemo(() => {
    if (!apiData) return [];
    
    // Assicuriamoci che l'ID sia un numero (il PHP aliasa Id in id)
    let result = apiData.map((item: any) => ({
      ...item,
      Id: Number(item.id || item.Id)
    }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => (item.Descrizione || '').toLowerCase().includes(q));
    }

    return result.sort((a: any, b: any) => a.Id - b.Id);
  }, [apiData, searchQuery]);

  // --- HANDLERS ---
  const handleNew = () => {
    const rawData = apiData || [];
    
    // Doppio controllo di sicurezza (anche se il pulsante è disabilitato)
    if (rawData.length >= 6) {
      alert("Limite massimo raggiunto: è possibile gestire al massimo 6 listini.");
      return;
    }

    const nextId = rawData.length > 0 ? Math.max(...rawData.map((item: any) => Number(item.id || item.Id))) + 1 : 1;

    setEditingRecord({ 
      Id: nextId, 
      Descrizione: '', 
      provv: 0, 
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
          <h1 className="text-2xl font-bold text-foreground">Impostazione Listini</h1>
          <p className="text-sm text-muted-foreground">Definizione dei listini di vendita e relative provvigioni per gli agenti.</p>
        </div>
        
        {/* Pulsante Nuovo (Si disabilita se >= 6) */}
        <button 
          onClick={handleNew} 
          disabled={isMaxListiniReached}
          title={isMaxListiniReached ? "Limite massimo di 6 listini raggiunto" : "Nuovo Listino"}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center ${
            isMaxListiniReached 
              ? 'bg-secondary text-muted-foreground cursor-not-allowed opacity-70' 
              : 'bg-primary text-primary-foreground hover:opacity-90'
          }`}
        >
          <Plus className="w-4 h-4" /> Nuovo Listino
        </button>
      </div>

      {/* Ricerca */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cerca per descrizione..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
          />
        </div>
      </div>

      {/* Desktop Table (Senza azione elimina) */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">ID Listino</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione Listino</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-32">Provvigione %</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Modifica</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={4} className="p-8 text-center text-destructive">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && filteredData.length === 0 && <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Nessun listino trovato.</td></tr>}

            {!isLoading && filteredData.map((item: any, idx: number) => (
              <tr key={item.Id} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 font-mono font-bold text-primary">Listino {item.Id}</td>
                <td className="px-4 py-3 font-medium text-foreground">{item.Descrizione}</td>
                <td className="px-4 py-3 text-right font-mono font-bold">{Number(item.provv || 0)}%</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors mx-auto block" title="Modifica Listino">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards (Senza azione elimina) */}
      <div className="md:hidden space-y-3 pb-24">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Caricamento in corso...</div>}
        {!isLoading && filteredData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessun listino trovato.</div>}

        {!isLoading && filteredData.map((item: any) => (
          <div key={item.Id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">Listino {item.Id}</span>
              <span className="text-sm font-mono font-bold text-foreground bg-secondary/50 px-2 py-1 rounded-md border border-border">
                Provv: {Number(item.provv || 0)}%
              </span>
            </div>
            <h3 className="text-base font-bold text-foreground mb-3">{item.Descrizione}</h3>
            
            <div className="flex justify-end pt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Modifica Listino
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODALE INSERIMENTO / MODIFICA */}
      {showModal && (
        <ListinoFormModal 
          record={editingRecord} 
          onSave={(data) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => setShowModal(false)} 
        />
      )}

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO ---
const ListinoFormModal = ({ record, onSave, isSaving, onClose }: { record: any, onSave: (r: any) => void, isSaving: boolean, onClose: () => void }) => {
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
          <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Listino' : 'Nuovo Listino'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Box Informativo */}
          <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
            I Listini da 1 a 6 sono collegati direttamente all'anagrafica articoli. 
            Non è possibile eliminarli per mantenere l'integrità del database.
          </div>

          <form id="listino-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>ID Listino (Generato)</label>
                <input type="text" value={`Listino ${form.Id}`} disabled className={`${inputClass} bg-secondary/50 font-mono font-bold text-muted-foreground`} />
              </div>
              <div>
                <label className={labelClass}>Provvigione Agente %</label>
                <input type="number" step="0.01" value={form.provv ?? 0} onChange={e => setForm({ ...form, provv: +e.target.value })} className={inputClass} />
              </div>
            </div>
            
            <div>
              <label className={labelClass}>Descrizione Listino *</label>
              <input type="text" value={form.Descrizione || ''} onChange={e => setForm({ ...form, Descrizione: e.target.value })} className={inputClass} required placeholder="Es. Dettaglio, Ingrosso..." />
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
            Annulla
          </button>
          <button type="submit" form="listino-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
            {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isSaving ? 'Salvataggio...' : 'Salva Listino'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default ListiniPage;