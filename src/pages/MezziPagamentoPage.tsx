import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Pencil, Trash2, X, Save, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import { useMenu } from '@/contexts/MenuContext';

const MezziPagamentoPage = () => {
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
  const { data: apiData = [], isLoading, isError, refetch } = useMezziPagamento();

  // --- MUTATIONS ---
  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_mezzo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: record.cod, 
          cod: record.cod, 
          descrizione: record.descrizione,
          speseinc: record.speseinc,
          codfattel: record.codfattel
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['mezzi_pagamento'] }); 
      refetch(); 
      setShowModal(false); 
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'Il Mezzo di Pagamento è stato registrato.' });
    },
    onError: (error: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: error.message })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_mezzo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mezzi_pagamento'] });
      refetch(); 
      setItemToDelete(null);
      setFeedback({ isOpen: true, type: 'success', title: 'Eliminato', msg: 'Il Mezzo di Pagamento è stato rimosso.' });
    },
    onError: (error: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: error.message })
  });

  // --- FILTRI E PAGINAZIONE ---
  const filteredData = useMemo(() => {
    let result = apiData.map((item: any) => ({ ...item, cod: Number(item.id || item.cod) }));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((item: any) => 
        (item.descrizione || '').toLowerCase().includes(q) || 
        (item.codfattel || '').toLowerCase().includes(q)
      );
    }
    return result.sort((a: any, b: any) => a.cod - b.cod);
  }, [apiData, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  // --- SINCRONIZZAZIONE HEADER APP ---
  useEffect(() => {
    setHeaderTitle('Mezzi di Pagamento');
    setPagination({
      page, totalPages, pageSize, totalRecords: filteredData.length,
      onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(0); }
    });
    return () => { setHeaderTitle(''); setPagination(undefined); };
  }, [page, totalPages, pageSize, filteredData.length, setHeaderTitle, setPagination]);

  // --- HANDLERS ---
  const handleNew = () => {
    // Genera il prossimo ID disponibile se si volesse usare un campo manuale (di solito auto-increment, ma diamo un fallback visivo)
    const nextId = apiData.length > 0 ? Math.max(...apiData.map((item: any) => Number(item.id || item.cod))) + 1 : 1;
    setEditingRecord({ 
      cod: nextId, descrizione: '', speseinc: 0, codfattel: 'MP05', _isNewRecord: true 
    });
    setShowModal(true);
  };

  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

  // =========================================================================
  // BLOCCO DI SICUREZZA PER NON AMMINISTRATORI
  // =========================================================================
  if (!auth.username) { window.location.href = '/'; return null; }

  if (!auth.isAdmin) {
    return (
      <AppLayout onLogout={auth.logout}>
        <ConfirmDialog 
          isOpen={true} type="danger" title="Accesso Negato" 
          message="L'accesso alle tabelle di configurazione contabile è strettamente riservato agli Amministratori di sistema." 
          confirmLabel="Torna alla Home" hideCancel={true}
          onClose={() => navigate('/home')} onConfirm={() => navigate('/home')} 
        />
      </AppLayout>
    );
  }

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
              placeholder="Cerca mezzo di pagamento..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold" 
            />
          </div>

          <button onClick={handleNew} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold text-sm shrink-0 w-full sm:w-auto h-[42px] active:scale-95 mt-1 sm:mt-4">
            <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">NUOVO MEZZO</span>
          </button>

        </div>
      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-8">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">Cod</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione Mezzo</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Codice SDI</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Spese Incasso €</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={5} className="p-8 text-center text-destructive font-bold">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && pagedData.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground font-bold">Nessun mezzo trovato.</td></tr>}

            {!isLoading && pagedData.map((item: any, idx: number) => (
              <tr key={item.cod} onClick={() => handleEdit(item)} className={`hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 font-mono font-bold text-muted-foreground">{item.cod}</td>
                <td className="px-4 py-3 font-bold text-foreground">{item.descrizione}</td>
                <td className="px-4 py-3 text-center">
                  <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-mono text-[11px] font-bold">
                    {item.codfattel || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium text-destructive">
                  {Number(item.speseinc) > 0 ? formatCurrency(item.speseinc) : '-'}
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleEdit(item)} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto active:scale-95">
                    <Pencil className="w-3.5 h-3.5" /> MODIFICA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* CARDS MOBILE */}
      <div className="md:hidden grid grid-cols-1 gap-3 pb-8">
        {isLoading && <div className="p-8 text-center text-muted-foreground font-bold">Caricamento in corso...</div>}
        {!isLoading && pagedData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground font-bold">Nessun mezzo trovato.</div>}

        {!isLoading && pagedData.map((item: any) => (
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer" key={item.cod} onClick={() => handleEdit(item)}>
            <div className="flex justify-between items-start mb-2">
              <span className="text-[10px] font-mono font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">ID: {item.cod}</span>
              <span className="bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded font-mono text-[9px] font-bold shadow-sm">
                SDI: {item.codfattel || '-'}
              </span>
            </div>
            
            <h3 className="text-sm font-black text-foreground mb-3">{item.descrizione}</h3>
            
            <div className="flex items-center justify-between text-[11px] text-muted-foreground bg-secondary/30 p-2.5 rounded-lg mb-3 border border-border">
              <span className="uppercase font-bold">Spese Incasso:</span>
              <span className="font-mono font-bold text-destructive text-sm">{formatCurrency(item.speseinc)}</span>
            </div>
            
            <div className="flex justify-end pt-3 border-t border-border/50">
              <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white border border-blue-200 transition-colors text-[10px] font-bold shadow-sm">
                <Pencil className="w-3 h-3" /> MODIFICA
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* MODALE DI INSERIMENTO / MODIFICA */}
      {showModal && (
        <MezzoFormModal 
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

      {/* DIALOG DI CONFERMA ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Mezzo"
        message={<>Stai per eliminare il Mezzo di Pagamento <strong>{itemToDelete?.descrizione}</strong>.<br/><br/>⚠️ Assicurati che non sia utilizzato in fatture o configurazioni (es. Modalità di Pagamento).</>}
        type="danger"
        confirmLabel="Sì, elimina"
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.cod)}
        isPending={deleteMutation.isPending}
      />

      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback({ ...feedback, isOpen: false })} />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO STANDARDIZZATO ---
const MezzoFormModal = ({ record, onSave, isSaving, onClose, onDeleteRequest }: any) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    onSave(form); 
  };
  
  const inputClass = "w-full px-3 py-2.5 rounded-md border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full max-w-lg flex flex-col max-h-[100dvh] sm:max-h-[95vh] animate-fade-up sm:animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sm:rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Mezzo' : 'Nuovo Mezzo di Pagamento'}</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-5 min-h-0 bg-slate-50/50">
          <form id="mezzo-form" onSubmit={handleSubmit}>
            
            <div className="bg-white p-4 rounded-xl border border-border shadow-sm mb-4">
              <label className={labelClass}>Codice ID (Automatico se nuovo)</label>
              <input type="text" value={form.cod || ''} disabled={isEdit} onChange={(e) => setForm({ ...form, cod: e.target.value })} className={`${inputClass} ${isEdit ? 'bg-secondary/50 font-mono text-muted-foreground' : 'font-mono'}`} placeholder="Es. 1" />
            </div>

            <div className="bg-white p-4 rounded-xl border border-border shadow-sm mb-4">
              <label className={labelClass}>Descrizione Mezzo *</label>
              <input 
                type="text" 
                value={form.descrizione || ''} 
                onChange={e => setForm({ ...form, descrizione: e.target.value })} 
                className={`${inputClass} font-bold text-primary`} 
                required 
                placeholder="Es. Bonifico Bancario" 
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white p-4 rounded-xl border border-border shadow-sm">
              <div>
                <label className={labelClass}>Codice SDI (Fatt. Elettr.)</label>
                <input 
                  type="text" 
                  value={form.codfattel || ''} 
                  onChange={e => setForm({ ...form, codfattel: e.target.value.toUpperCase() })} 
                  className={`${inputClass} font-mono`} 
                  placeholder="Es. MP05"
                  maxLength={4}
                />
              </div>
              <div>
                <label className={labelClass}>Spese d'Incasso €</label>
                <input 
                  type="number" step="0.01"
                  value={form.speseinc ?? 0} 
                  onChange={e => setForm({ ...form, speseinc: Number(e.target.value) })} 
                  className={`${inputClass} text-right font-bold text-destructive`} 
                />
              </div>
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
            <button type="submit" form="mezzo-form" disabled={isSaving} className="flex-[2] sm:flex-none flex items-center justify-center gap-2 px-6 py-3 sm:py-2.5 rounded-lg bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-opacity shadow-sm">
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isEdit ? 'Salva Modifiche' : 'Crea Mezzo'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MezziPagamentoPage;