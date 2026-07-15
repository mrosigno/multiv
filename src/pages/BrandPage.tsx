import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, X, Save, RefreshCcw, Trash2, Info } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useBrand } from '@/hooks/api/useBrand';
import { useArticoli } from '@/hooks/api/useArticoli';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const BrandPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  // STATO PER LA MODALE DI CONFERMA ELIMINAZIONE
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);

const queryClient = useQueryClient();
  const { data: apiData, isLoading, isError } = useBrand();
  const { data: articoliData } = useArticoli(); // <-- RECUPERA GLI ARTICOLI

  // CONTA GLI ARTICOLI COLLEGATI AL BRAND CHE STIAMO ELIMINANDO
  const relatedArticlesCount = useMemo(() => {
    if (!itemToDelete || !articoliData) return 0;
    return articoliData.filter((a: any) => a.brand === itemToDelete).length;
  }, [itemToDelete, articoliData]);

  // --- MUTATIONS REALI ---

  // --- MUTATIONS REALI ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_brand`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          id: record.descrizione, // il PHP usa 'id' o 'descrizione' come chiave
          descrizione: record.descrizione,
          scontabile: Number(record.scontabile)
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['brand'] }); 
      setShowModal(false); 
    },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_brand`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brand'] });
      setItemToDelete(null);
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  // --- FILTRO DATI ---
  const filteredData = useMemo(() => {
    if (!apiData) return [];
    if (!searchQuery) return apiData;
    const q = searchQuery.toLowerCase();
    return apiData.filter((item: any) => (item.descrizione || '').toLowerCase().includes(q));
  }, [apiData, searchQuery]);

  // --- HANDLERS ---
  const handleNew = () => { 
    setEditingRecord({ descrizione: '', scontabile: -1, _isNewRecord: true }); 
    setShowModal(true); 
  };
  
  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  const handleDeleteRequest = (descrizione: string) => {
    setShowModal(false); // Chiude il form di modifica
    setItemToDelete(descrizione); // Apre la modale di conferma
  };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brand</h1>
          <p className="text-sm text-muted-foreground">Gestione dei marchi e regole di scontistica in cassa.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nuovo Brand
        </button>
      </div>

      {/* Ricerca */}
      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cerca brand..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
          />
        </div>
      </div>

      {/* Desktop Table (Senza Cestino) */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Nome Brand</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-40">Regola Cassa</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={3} className="p-8 text-center text-destructive">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && filteredData.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-muted-foreground">Nessun brand trovato.</td></tr>}

            {!isLoading && filteredData.map((item: any, idx: number) => (
              <tr key={item.descrizione} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 font-bold text-foreground">{item.descrizione}</td>
                <td className="px-4 py-3 text-center">
                  {Number(item.scontabile) !== 0 ? (
                    <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-green-100 text-green-700 border border-green-200">Scontabile</span>
                  ) : (
                    <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Non Scontabile</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors mx-auto block" title="Apri / Modifica">
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
        {isLoading && <div className="p-8 text-center text-muted-foreground">Caricamento in corso...</div>}
        {!isLoading && filteredData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessun brand trovato.</div>}

        {!isLoading && filteredData.map((item: any) => (
          <div key={item.descrizione} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <h3 className="text-lg font-bold text-foreground">{item.descrizione}</h3>
              {Number(item.scontabile) !== 0 ? (
                <span className="inline-flex px-2 py-1 rounded text-xs font-bold bg-green-100 text-green-700">Scontabile</span>
              ) : (
                <span className="inline-flex px-2 py-1 rounded text-xs font-bold bg-gray-100 text-gray-600">Non Scontabile</span>
              )}
            </div>
            
            <div className="flex justify-end pt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Modifica Brand
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODALE INSERIMENTO / MODIFICA */}
      {showModal && (
        <BrandFormModal 
          record={editingRecord} 
          onSave={(data) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => setShowModal(false)} 
          onDeleteRequest={handleDeleteRequest}
        />
      )}

{/* MODALE CONFERMA ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Brand"
        message={
          <>
            Sei sicuro di voler eliminare il brand <strong>{itemToDelete}</strong>?
            {relatedArticlesCount > 0 ? (
              <span className="block mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm leading-snug">
                ⚠️ <strong>ATTENZIONE:</strong> Nel magazzino ci sono <strong>{relatedArticlesCount} articoli</strong> associati a questo brand. <br/>Proseguendo, il collegamento andrà perso.
              </span>
            ) : (
              <span className="block mt-2">Nessun articolo associato. L'operazione non è reversibile.</span>
            )}
          </>
        }
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete as string)}
        isPending={deleteMutation.isPending}
      />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO E MIGLIORATO ---
const BrandFormModal = ({ record, onSave, isSaving, onClose, onDeleteRequest }: { record: any, onSave: (r: any) => void, isSaving: boolean, onClose: () => void, onDeleteRequest: (id: string) => void }) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    onSave(form); 
  };
  
  const inputClass = "w-full px-4 py-3 rounded-md border border-input bg-background text-base font-medium focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Brand' : 'Nuovo Brand'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <form id="brand-form" onSubmit={handleSubmit}>
            
            {/* CAMPO NOME BRAND (TUTTA LARGHEZZA) */}
            <div className="mb-6">
              <label className={labelClass}>Nome Brand *</label>
              <input 
                type="text" 
                value={form.descrizione || ''} 
                onChange={e => setForm({ ...form, descrizione: e.target.value.toUpperCase() })} 
                disabled={isEdit} 
                className={`${inputClass} ${isEdit ? 'bg-secondary/50 text-muted-foreground cursor-not-allowed' : 'text-primary uppercase'}`} 
                required 
                placeholder="Es. NIKE" 
              />
              {isEdit && <p className="text-xs text-muted-foreground mt-1.5">Il nome del brand non può essere modificato. Se errato, eliminalo e ricrealo.</p>}
            </div>

            {/* RIQUADRO SCONTABILE CON SPIEGAZIONE */}
            <div className={`p-5 rounded-xl border-2 transition-colors ${Number(form.scontabile) !== 0 ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <Info className={`w-6 h-6 shrink-0 mt-0.5 ${Number(form.scontabile) !== 0 ? 'text-blue-600' : 'text-gray-400'}`} />
                <div className="flex-1">
                  <label className="block text-sm font-bold text-foreground mb-1">Regola Vendita in Cassa</label>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    Imposta se gli articoli appartenenti a questo brand possono subire sconti percentuali o manuali durante la vendita al registratore di cassa.
                  </p>
                  <select 
                    value={Number(form.scontabile)} 
                    onChange={e => setForm({ ...form, scontabile: Number(e.target.value) })} 
                    className="w-full px-3 py-2 rounded-md border border-input bg-white text-sm font-bold focus:ring-2 focus:ring-blue-500 shadow-sm outline-none"
                  >
                    <option value={-1}>SÌ - Consenti Sconti in Cassa</option>
                    <option value={0}>NO - Blocca Sconti in Cassa</option>
                  </select>
                </div>
              </div>
            </div>

          </form>
        </div>

        {/* FOOTER CON ELIMINA A SINISTRA */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
          <div>
            {isEdit && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(form.descrizione)} 
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
            <button type="submit" form="brand-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Salvataggio...' : 'Salva Brand'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default BrandPage;