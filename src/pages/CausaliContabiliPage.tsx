import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import { useMenu } from '@/contexts/MenuContext';

// --- HELPER PER IL SEGNO D/A ---
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
  const navigate = useNavigate();
  const auth = useAuthAccess();
  const { setHeaderTitle, setPagination } = useMenu();
  const queryClient = useQueryClient();

  // --- STATI RICERCA E PAGINAZIONE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  useEffect(() => { setPage(0); }, [searchQuery]);
  
  // --- STATI MODALI ---
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ 
    isOpen: false, type: 'info', title: '', msg: '' 
  });

  // --- HOOKS API ---
  const { data: apiData = [], isLoading, isError, refetch } = useCausali();
  const { data: tipologieData = [] } = useTipologieMovimento(); 

  // --- MUTATIONS ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const segnoReale = record.da || record['D-A'] || '';
      const res = await fetch(`${API_HOST}/api.php?action=save_causale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({
          id: record.IdTipo, IdTipo: record.IdTipo, Descrizione: record.Descrizione,
          suffisso: record.suffisso, 'D-A': segnoReale, da: segnoReale
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['causali'] }); 
      refetch(); 
      setShowModal(false); 
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'La Causale è stata registrata.' });
    },
    onError: (error: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: error.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_causale`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['causali'] });
      refetch(); 
      setItemToDelete(null);
      setFeedback({ isOpen: true, type: 'success', title: 'Causale Eliminata', msg: 'La Causale è stata rimossa.' });
    },
    onError: (error: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: error.message })
  });

  // --- FILTRI E PAGINAZIONE ---
  const filteredData = useMemo(() => {
    let result = apiData.map((item: any) => ({ ...item, IdTipo: Number(item.id || item.IdTipo) }));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => (item.Descrizione || '').toLowerCase().includes(q) || (item.suffisso || '').toLowerCase().includes(q));
    }
    return result.sort((a: any, b: any) => a.IdTipo - b.IdTipo);
  }, [apiData, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  const relatedSottocontiCount = useMemo(() => {
    if (!itemToDelete || !tipologieData) return 0;
    return tipologieData.filter((t: any) => Number(t.idcausale) === Number(itemToDelete.IdTipo)).length;
  }, [itemToDelete, tipologieData]);

  // --- SINCRONIZZAZIONE HEADER APP ---
  useEffect(() => {
    setHeaderTitle('Piano dei Conti - Mastri');
    setPagination({
      page, totalPages, pageSize, totalRecords: filteredData.length,
      onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(0); }
    });
    return () => { setHeaderTitle(''); setPagination(undefined); };
  }, [page, totalPages, pageSize, filteredData.length, setHeaderTitle, setPagination]);

  // --- HANDLERS ---
  const handleNew = () => {
    const nextId = apiData.length > 0 ? Math.max(...apiData.map((item: any) => Number(item.id || item.IdTipo))) + 1 : 1;
    setEditingRecord({ IdTipo: nextId, Descrizione: '', suffisso: '', da: '', 'D-A': '', _isNewRecord: true });
    setShowModal(true);
  };

  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  // =========================================================================
  // BLOCCO DI SICUREZZA PER NON AMMINISTRATORI
  // =========================================================================
  if (!auth.username) { window.location.href = '/'; return null; }

  if (!auth.isAdmin) {
    return (
      <AppLayout onLogout={auth.logout}>
        <ConfirmDialog 
          isOpen={true} 
          type="danger" 
          title="Accesso Negato" 
          message="L'accesso alle tabelle di configurazione contabile è strettamente riservato agli Amministratori di sistema. Le modifiche non autorizzate possono compromettere i bilanci aziendali." 
          confirmLabel="Torna alla Home" 
          hideCancel={true}
          onClose={() => navigate('/home')} 
          onConfirm={() => navigate('/home')} 
        />
      </AppLayout>
    );
  }

  // Se l'utente è admin, renderizza normalmente la pagina
  return (
    <AppLayout onLogout={auth.logout}>
      
      {/* PANNELLO RICERCA E NUOVO STICKY */}
      <div className="sticky top-14 sm:top-0 z-30 pt-1 pb-4 bg-slate-100">
        <div className="bg-card rounded-xl border border-border shadow-md p-3 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          <div className="relative w-full sm:max-w-md shrink-0">
            <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ricerca Veloce</label>
            <Search className="absolute left-3 top-7 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Descrizione o suffisso..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold" 
            />
          </div>

          <button onClick={handleNew} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold text-sm shrink-0 w-full sm:w-auto h-[42px] active:scale-95 mt-1 sm:mt-4">
            <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">NUOVO MASTRO</span>
          </button>

        </div>
      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-8">
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
            {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={5} className="p-8 text-center text-destructive font-bold">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && pagedData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">Nessuna causale trovata.</td></tr>}

            {!isLoading && pagedData.map((item: any, idx: number) => {
              const segno = item.da || item['D-A'] || '';
              return (
                <tr key={item.IdTipo} onClick={() => handleEdit(item)} className={`hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                  <td className="px-4 py-3 font-mono font-bold text-muted-foreground">{item.IdTipo}</td>
                  <td className="px-4 py-3 font-mono font-bold text-primary">{item.suffisso || '-'}</td>
                  <td className="px-4 py-3 font-bold text-foreground">{item.Descrizione}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-1 rounded-md text-[11px] font-bold shadow-sm ${getSegnoClass(segno)}`}>
                      {getSegnoLabel(segno)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleEdit(item)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto active:scale-95" title="Apri / Modifica">
                      <Pencil className="w-3.5 h-3.5" /> MODIFICA
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* CARDS MOBILE */}
      <div className="md:hidden grid grid-cols-1 gap-3 pb-8">
        {isLoading && <div className="p-8 text-center text-muted-foreground font-bold">Caricamento in corso...</div>}
        {!isLoading && pagedData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground font-bold">Nessuna causale trovata.</div>}

        {!isLoading && pagedData.map((item: any) => {
          const segno = item.da || item['D-A'] || '';
          return (
            <div className="bg-card rounded-xl border border-border p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer" key={item.IdTipo} onClick={() => handleEdit(item)}>
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">ID: {item.IdTipo}</span>
                  <span className="text-[11px] font-mono font-bold text-primary border border-primary/20 bg-primary/5 px-2 py-0.5 rounded">{item.suffisso || '-'}</span>
                </div>
                <span className={`inline-flex px-2 py-0.5 rounded text-[9px] font-bold shadow-sm border ${getSegnoClass(segno)}`}>
                  {getSegnoLabel(segno)}
                </span>
              </div>
              <h3 className="text-sm font-black text-foreground mb-3">{item.Descrizione}</h3>
              
              <div className="flex justify-end pt-3 border-t border-border/50">
                <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 transition-colors text-[10px] font-bold shadow-sm">
                  <Pencil className="w-3 h-3" /> MODIFICA
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALE DI INSERIMENTO / MODIFICA */}
      {showModal && (
        <CausaleFormModal 
          record={editingRecord} 
          onSave={(data: any) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => {
            setShowModal(false);
            setFeedback({ isOpen: true, type: 'cancel-auto', title: 'Operazione Annullata', msg: '' });
          }} 
          onDeleteRequest={(record: any) => {
            setShowModal(false); 
            setItemToDelete(record);
          }}
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
        type="danger"
        confirmLabel="Sì, elimina irreversibilmente"
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.IdTipo)}
        isPending={deleteMutation.isPending}
      />

      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback({ ...feedback, isOpen: false })} />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO (Senza readOnly perché se entri qui sei Admin!) ---
const CausaleFormModal = ({ record, onSave, isSaving, onClose, onDeleteRequest }: any) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    onSave(form); 
  };
  
  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[100dvh] sm:max-h-[95vh] animate-fade-up sm:animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sm:rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Causale Mastro' : 'Nuova Causale Mastro'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 min-h-0 bg-slate-50/50">
          <form id="causale-form" onSubmit={handleSubmit}>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
                <label className={labelClass}>ID (Automatico)</label>
                <input type="text" value={form.IdTipo} disabled className={`${inputClass} bg-secondary/50 font-mono text-muted-foreground`} />
              </div>
              <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
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

            <div className="bg-white p-4 rounded-xl border border-border shadow-sm mb-5">
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

            <div className="bg-white p-4 rounded-xl border border-border shadow-sm">
              <label className={labelClass}>Segno Dare/Avere (D-A)</label>
              <select 
                value={form.da || form['D-A'] || ''} 
                onChange={e => setForm({ ...form, da: e.target.value, 'D-A': e.target.value })} 
                className={`${inputClass} font-bold ${form.da === 'A' || form.da === '+' ? 'text-green-600' : form.da === 'D' || form.da === '-' ? 'text-red-600' : 'text-foreground'}`}
              >
                <option value="">-- Nessuno --</option>
                <option value="A">A (Avere)</option>
                <option value="D">D (Dare)</option>
              </select>
            </div>

          </form>
        </div>

        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 px-4 sm:px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0 pb-safe">
          <div className="order-2 sm:order-1 flex justify-center sm:justify-start">
            {isEdit && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(form)} 
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 sm:py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors border border-destructive/20 shadow-sm"
              >
                <Trash2 className="w-4 h-4" /> Elimina
              </button>
            )}
          </div>
          
          <div className="flex gap-2 order-1 sm:order-2 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">
              Annulla
            </button>
            <button type="submit" form="causale-form" disabled={isSaving} className="flex-[2] sm:flex-none flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-opacity shadow-sm">
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