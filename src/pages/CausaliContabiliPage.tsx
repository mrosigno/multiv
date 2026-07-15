import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

// --- HELPER PER IL SEGNO D/A ---
// Accetta sia il vecchio standard (+/-) che il nuovo (A/D) per compatibilità assoluta
const getSegnoLabel = (val: string) => {
  if (val === 'A' || val === '+') return 'A (Avere)';
  if (val === 'D' || val === '-') return 'D (Dare)';
  return 'Nessuno';
};

const getSegnoClass = (val: string) => {
  if (val === 'A' || val === '+') return 'bg-green-100 text-green-700 border border-green-200';
  if (val === 'D' || val === '-') return 'bg-red-100 text-red-700 border border-red-200';
  return 'bg-gray-100 text-gray-500 border border-gray-200';
};

const CausaliContabiliPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ 
    isOpen: false, type: 'info', title: '', msg: '' 
  });

  const { data: apiData = [], isLoading, isError, refetch } = useCausali();
  const { data: tipologieData = [] } = useTipologieMovimento(); 

  const relatedSottocontiCount = useMemo(() => {
    if (!itemToDelete || !tipologieData) return 0;
    return tipologieData.filter((t: any) => Number(t.idcausale) === Number(itemToDelete.IdTipo)).length;
  }, [itemToDelete, tipologieData]);

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      // Catturiamo il segno letto dalla form, assicurandoci che vada a buon fine
      const segnoReale = record.da || record['D-A'] || '';
      
      const res = await fetch(`${API_HOST}/api.php?action=save_causale`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          id: record.IdTipo,
          IdTipo: record.IdTipo,
          Descrizione: record.Descrizione,
          suffisso: record.suffisso,
          'D-A': segnoReale,
          da: segnoReale
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
   onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['causali'] }); 
      refetch(); // <-- FORZA IL RICARICAMENTO DELLA TABELLA
      setShowModal(false); 
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'La Causale è stata registrata correttamente.' });
    },
    onError: (error: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: error.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_causale`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
  onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['causali'] });
      refetch(); // <-- FORZA IL RICARICAMENTO DELLA TABELLA
      setItemToDelete(null);
      setFeedback({ isOpen: true, type: 'success', title: 'Causale Eliminata', msg: 'La Causale Contabile è stata rimossa definitivamente.' });
    },
    onError: (error: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: error.message })
  });

  const filteredData = useMemo(() => {
    let result = apiData.map((item: any) => ({
      ...item,
      IdTipo: Number(item.id || item.IdTipo)
    }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => 
        (item.Descrizione || '').toLowerCase().includes(q) ||
        (item.suffisso || '').toLowerCase().includes(q)
      );
    }
    return result.sort((a: any, b: any) => a.IdTipo - b.IdTipo);
  }, [apiData, searchQuery]);

  const handleNew = () => {
    const nextId = apiData.length > 0 ? Math.max(...apiData.map((item: any) => Number(item.id || item.IdTipo))) + 1 : 1;
    setEditingRecord({ 
      IdTipo: nextId, 
      Descrizione: '', 
      suffisso: '',
      da: '', 
      'D-A': '',
      _isNewRecord: true 
    });
    setShowModal(true);
  };

  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  const handleDeleteRequest = (record: any) => {
    setShowModal(false); 
    setItemToDelete(record); 
  };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Piano dei Conti - Mastri</h1>
          <p className="text-sm text-muted-foreground">Gestione delle Causali Contabili principali (Mastri).</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nuova Causale Mastro
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cerca per descrizione o suffisso..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
          />
        </div>
      </div>

      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">ID</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-32">Suffisso</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione (Mastro)</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-32">Segno</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={5} className="p-8 text-center text-destructive">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && filteredData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Nessuna causale trovata.</td></tr>}

            {!isLoading && filteredData.map((item: any, idx: number) => {
              const segno = item.da || item['D-A'] || ''; // Legge il dato reale dal database
              return (
                <tr key={item.IdTipo} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                  <td className="px-4 py-3 font-mono font-bold text-muted-foreground">{item.IdTipo}</td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">{item.suffisso || '-'}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.Descrizione}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm ${getSegnoClass(segno)}`}>
                      {getSegnoLabel(segno)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors mx-auto block" title="Apri / Modifica">
                      <Pencil className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3 pb-24">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Caricamento in corso...</div>}
        {!isLoading && filteredData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessuna causale trovata.</div>}

        {!isLoading && filteredData.map((item: any) => {
          const segno = item.da || item['D-A'] || '';
          return (
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm" key={item.IdTipo}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">ID: {item.IdTipo}</span>
                <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold shadow-sm ${getSegnoClass(segno)}`}>
                  Segno: {getSegnoLabel(segno)}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground mb-1">{item.Descrizione}</h3>
              <p className="text-xs font-mono text-muted-foreground mb-3">Suffisso: {item.suffisso || '-'}</p>
              
              <div className="flex justify-end pt-3 border-t border-border/50">
                <button onClick={() => handleEdit(item)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                  <Pencil className="w-3.5 h-3.5" /> Modifica Causale
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <CausaleFormModal 
          record={editingRecord} 
          onSave={(data: any) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => {
            setShowModal(false);
            setFeedback({ isOpen: true, type: 'cancel-auto', title: 'Operazione Annullata', msg: '' });
          }} 
          onDeleteRequest={handleDeleteRequest}
        />
      )}

      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Causale Mastro"
        message={
          <>
            Stai per eliminare la Causale <strong>{itemToDelete?.suffisso} - {itemToDelete?.Descrizione}</strong>.<br/>
            {relatedSottocontiCount > 0 ? (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-left leading-snug">
                ⚠️ <strong>ATTENZIONE:</strong> Ci sono <strong>{relatedSottocontiCount} Tipologie/Sottoconti</strong> collegati a questa Causale. Procedendo, perderanno il loro mastro di riferimento.
              </div>
            ) : (
              <div className="mt-2 text-muted-foreground">Nessun sottoconto associato. L'operazione non è reversibile.</div>
            )}
          </>
        }
        confirmLabel="Sì, elimina irreversibilmente"
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.IdTipo)}
        isPending={deleteMutation.isPending}
      />

      <ConfirmDialog 
        isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
      />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO ---
const CausaleFormModal = ({ record, onSave, isSaving, onClose, onDeleteRequest }: any) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    onSave(form); 
  };
  
  const inputClass = "w-full px-3 py-2.5 rounded-md border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh] animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Causale Mastro' : 'Nuova Causale Mastro'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <form id="causale-form" onSubmit={handleSubmit}>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
              <div>
                <label className={labelClass}>ID (Auto)</label>
                <input type="text" value={form.IdTipo} disabled className={`${inputClass} bg-secondary/50 font-mono text-muted-foreground`} />
              </div>
              <div>
                <label className={labelClass}>Suffisso (Breve)</label>
                <input 
                  type="text" 
                  value={form.suffisso || ''} 
                  onChange={e => setForm({ ...form, suffisso: e.target.value.toUpperCase() })} 
                  className={`${inputClass} font-mono font-bold text-primary uppercase`} 
                  placeholder="Es. FA" 
                  maxLength={5}
                />
              </div>
            </div>

            <div className="mb-5">
              <label className={labelClass}>Descrizione (Nome Mastro) *</label>
              <input 
                type="text" 
                value={form.Descrizione || ''} 
                onChange={e => setForm({ ...form, Descrizione: e.target.value })} 
                className={inputClass} 
                required 
                placeholder="Es. FATTURA VENDITA" 
              />
            </div>

            <div>
              <label className={labelClass}>Segno Dare/Avere (D-A)</label>
              <select 
                value={form.da || form['D-A'] || ''} 
                onChange={e => setForm({ ...form, da: e.target.value, 'D-A': e.target.value })} 
                className={inputClass}
              >
                <option value="">-- Nessuno --</option>
                <option value="A">A (Avere)</option>
                <option value="D">D (Dare)</option>
              </select>
            </div>

          </form>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0">
          <div className="order-2 sm:order-1 flex justify-center sm:justify-start">
            {isEdit && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(form)} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Elimina
              </button>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 order-1 sm:order-2 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-4 py-2.5 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">
              Annulla
            </button>
            <button type="submit" form="causale-form" disabled={isSaving} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Salva Modifiche' : 'Crea Mastro'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CausaliContabiliPage;