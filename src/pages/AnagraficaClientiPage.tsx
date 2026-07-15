import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Pencil, Eye } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { Cliente } from '@/data/mockData';
import { useClienti } from '@/hooks/api/useClienti';
import ClienteFormModal from '@/components/ClienteFormModal';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useMenu } from '@/contexts/MenuContext'; 
import { useAuthAccess } from '@/hooks/useAuthAccess'; // <--- IMPORTIAMO I PERMESSI

const AnagraficaClientiPage = () => {
  const queryClient = useQueryClient(); 
  const auth = useAuthAccess(); // <--- INIZIALIZZIAMO I PERMESSI
  const [data, setData] = useState<Cliente[]>([]);
  
  const { setHeaderTitle, setPagination } = useMenu();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState(0); 
  const [tipoDestFiltro, setTipoDestFiltro] = useState(0); 
  const [soloAttivi, setSoloAttivi] = useState(true);
  
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  useEffect(() => {
    setPage(0);
  }, [searchQuery, tipoFiltro, tipoDestFiltro, soloAttivi]);
  
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [itemToDelete, setItemToDelete] = useState<Cliente | null>(null);
  
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ 
    isOpen: false, type: 'info', title: '', msg: '' 
  });

  const { data: clientiData, isLoading, isError } = useClienti();

  useEffect(() => {
    if (clientiData) {
      setData(clientiData);
    }
  }, [clientiData]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_cliente`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ID: id })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clienti'] });
      setItemToDelete(null);
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Anagrafica Eliminata', msg: "Il cliente/fornitore è stato rimosso." });
    },
    onError: (error: any) => {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore Eliminazione', msg: error.message });
    }
  });

  const filteredData = useMemo(() => {
    let result = data;

    if (soloAttivi) {
      result = result.filter(c => c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1');
    }

    if (tipoFiltro === 1) result = result.filter(c => Number(c.tipocli) === 1 || Number(c.tipocli) === 0);
    if (tipoFiltro === 2) result = result.filter(c => Number(c.tipocli) === 2 || Number(c.tipocli) === 0);
    if (tipoDestFiltro > 0) result = result.filter(c => Number(c.tipodest) === tipoDestFiltro);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c => (c.Ragione_Sociale || c['Ragione Sociale'] || '').toLowerCase().includes(q));
    }
    
    return result;
  }, [data, searchQuery, tipoFiltro, tipoDestFiltro, soloAttivi]);

  const totalPages = Math.ceil(filteredData.length / pageSize) || 1;
  const pagedData = filteredData.slice(page * pageSize, (page + 1) * pageSize);

  useEffect(() => {
    setHeaderTitle('Anagrafica Clienti e Fornitori');
    setPagination({
      page,
      totalPages,
      pageSize,
      totalRecords: filteredData.length,
      onPageChange: (newPage: number) => setPage(newPage),
      onPageSizeChange: (newSize: number) => { setPageSize(newSize); setPage(0); }
    });

    return () => {
      setHeaderTitle('');
      setPagination(undefined);
    };
  }, [page, totalPages, pageSize, filteredData.length, setHeaderTitle, setPagination]);

  const handleNew = () => {
    setEditingCliente(null);
    setShowModal(true);
  };

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setShowModal(true);
  };

  const handleSave = () => {
    setShowModal(false);
    setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'Anagrafica aggiornata correttamente.' });
  };

  // Protezione base
  if (!auth.username) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
	{/* ======================================================== */}
      {/* PANNELLO DI CONTROLLO STICKY (Restano sempre in alto!)   */}
      {/* ======================================================== */}
      <div className="sticky top-14 sm:top-0 z-30 pt-1 pb-3 sm:pb-4 bg-slate-100">
        <div className="bg-card rounded-xl border border-border shadow-md p-2.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3">
          
          <div className="flex flex-col lg:flex-row gap-2.5 sm:gap-3 items-end justify-between">
            
            {/* Gruppo Filtri */}
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 w-full lg:w-auto">
              
              <div className="relative flex-1 sm:w-64 shrink-0">
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Ricerca Veloce</label>
                <Search className="absolute left-3 top-7 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Ragione Sociale..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-bold"
                />
              </div>

              <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex-1 sm:w-36 shrink-0">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Categoria</label>
                  <select value={tipoFiltro} onChange={(e) => setTipoFiltro(Number(e.target.value))} className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold cursor-pointer">
                    <option value={0}>Tutti (Cli/For)</option>
                    <option value={1}>Clienti</option>
                    <option value={2}>Fornitori</option>
                  </select>
                </div>

                <div className="flex-1 sm:w-40 shrink-0">
                  <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Tipologia</label>
                  <select value={tipoDestFiltro} onChange={(e) => setTipoDestFiltro(Number(e.target.value))} className="w-full px-1.5 sm:px-2 py-2 rounded-lg border border-input bg-background text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-semibold cursor-pointer">
                    <option value={0}>Tutti i Tipi</option>
                    <option value={1}>Azienda / B2B</option>
                    <option value={2}>Ammin. Pubblica</option>
                    <option value={3}>Privato / B2C</option>
                  </select>
                </div>
              </div>

            </div>

            {/* Gruppo Spunte e Nuovo Pulsante */}
            <div className="flex flex-row items-center justify-between lg:justify-end gap-2 sm:gap-4 w-full lg:w-auto border-t border-border lg:border-none pt-2.5 lg:pt-0 mt-0.5 lg:mt-0">
              <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer text-[10px] sm:text-xs font-bold text-foreground select-none shrink-0 bg-secondary/30 px-2.5 sm:px-3 py-2 rounded-lg border border-border">
                <input type="checkbox" checked={soloAttivi} onChange={(e) => setSoloAttivi(e.target.checked)} className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded text-primary" />
                Solo Attivi
              </label>

              {/* FIX: Testo abbreviato su smartphone per evitare rotture del layout */}
              {auth.canCreate && (
                <button onClick={handleNew} className="flex flex-1 sm:flex-none items-center justify-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold text-[11px] sm:text-sm shrink-0 active:scale-95">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" /> 
                  <span className="hidden sm:inline">NUOVA ANAGRAFICA</span>
                  <span className="sm:hidden">NUOVO</span>
                </button>
              )}
            </div>

          </div>
        </div>
      </div>
      {/* ======================================================== */}

      <div className="hidden lg:flex lg:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-table-header border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-16">ID</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Ragione Sociale</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">P.IVA / C.F.</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Città</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Telefono</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Stato</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground font-bold">Caricamento anagrafiche in corso...</td></tr>}
              {isError && !isLoading && <tr><td colSpan={7} className="p-8 text-center text-destructive font-bold">Errore di connessione.</td></tr>}
              {!isLoading && !isError && pagedData.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground font-bold">Nessun cliente trovato con i filtri attuali.</td></tr>}
              
			        {!isLoading && !isError && pagedData.map((c, idx) => {
                const isAttivo = c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1';
                return (
                  <tr 
                    key={c.ID} 
                    onClick={() => handleEdit(c)} 
                    className={`hover:bg-muted/30 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-table-stripe' : ''} ${!isAttivo ? 'opacity-60 grayscale-[50%]' : ''}`}
                  >
                    <td className="px-4 py-2 text-mono text-muted-foreground text-xs">{c.ID}</td>
                    <td className="px-4 py-2 font-bold text-foreground">{c.Ragione_Sociale || c['Ragione Sociale']}</td>
                    <td className="px-4 py-2 text-mono font-medium">{c.PI || c.CF || '-'}</td>
                    <td className="px-4 py-2 font-medium">{c.Comune} {c.Prov ? `(${c.Prov})` : ''}</td>
                    <td className="px-4 py-2 font-medium">{c.telefono || '-'}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${isAttivo ? 'bg-badge-success/20 text-success border border-success/30' : 'bg-badge-error/20 text-destructive border border-destructive/30'}`}>
                        {isAttivo ? 'ATTIVO' : 'DISABILITATO'}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center" onClick={e => e.stopPropagation()}>
                      {/* FIX: Se l'utente non ha permessi di modifica, mostriamo l'occhio invece della matita */}
                      <button 
                        onClick={() => handleEdit(c)} 
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto active:scale-95" 
                        title={auth.canEdit ? "Modifica Scheda" : "Visualizza Scheda"}
                      >
                        {auth.canEdit ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {auth.canEdit ? 'APRI' : 'VEDI'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
        {isLoading && <div className="col-span-full p-8 text-center text-muted-foreground font-bold">Caricamento in corso...</div>}
        {!isLoading && pagedData.length === 0 && (
          <div className="col-span-full bg-card rounded-xl border border-border p-8 text-center text-muted-foreground font-bold">Nessun cliente trovato con i filtri attuali.</div>
        )}
        {!isLoading && pagedData.map(c => {
          const isAttivo = c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1';
          return (
            <div 
              key={c.ID} 
              onClick={() => handleEdit(c)} 
              className={`bg-card rounded-xl border border-border p-4 shadow-sm active:scale-[0.98] transition-all cursor-pointer animate-fade-in flex flex-col justify-center ${!isAttivo ? 'opacity-60 grayscale-[50%]' : 'hover:border-primary/30 hover:shadow-md'}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-mono font-bold text-muted-foreground bg-secondary px-2 py-0.5 rounded shrink-0 border border-border">ID: {c.ID}</span>
                <span className={`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${isAttivo ? 'bg-badge-success/20 text-success' : 'bg-badge-error/20 text-destructive'}`}>
                  {isAttivo ? 'ATTIVO' : 'DISABILITATO'}
                </span>
                
                <button 
                  onClick={(e) => { e.stopPropagation(); handleEdit(c); }} 
                  className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm shrink-0"
                >
                  {auth.canEdit ? <Pencil className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {auth.canEdit ? 'APRI' : 'VEDI'}
                </button>
              </div>
              
              <h3 className="text-base font-black text-foreground mb-3 leading-snug line-clamp-2">{c.Ragione_Sociale || c['Ragione Sociale']}</h3>
              
              <div className="flex justify-between items-center text-xs text-muted-foreground bg-secondary/30 p-2.5 rounded-lg mt-auto border border-border/50">
                <div className="flex items-center gap-1.5 font-medium">
                  📍 <span className="truncate max-w-[120px]">{c.Comune} {c.Prov ? `(${c.Prov})` : ''}</span>
                </div>
                <span className="font-mono font-bold text-primary shrink-0">{c.PI || c.CF || '-'}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* SOTTO-MODALE INSERIMENTO/MODIFICA */}
      {showModal && (
        <ClienteFormModal
          cliente={editingCliente}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setFeedback({ isOpen: true, type: 'cancel-auto', title: 'Operazione Annullata', msg: '' });
          }}
          onDeleteRequest={(cliente) => {
            setShowModal(false);
            setItemToDelete(cliente);
          }}
        />
      )}

      {/* MODALE CONFERMA ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Anagrafica"
        message={
          <>
            Sei sicuro di voler eliminare definitivamente <strong>{itemToDelete?.Ragione_Sociale || itemToDelete?.['Ragione Sociale']}</strong>?<br/><br/>
            ⚠️ Questa operazione è irreversibile e potrebbe causare errori se ci sono documenti collegati.<br/>
            <em>Consiglio: Se vuoi solo nasconderlo, clicca su "Annulla", riapri la scheda e disabilita il campo "Stato Attivo".</em>
          </>
        }
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete?.ID as number)}
        isPending={deleteMutation.isPending}
      />

      <ConfirmDialog 
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.msg}
        onClose={() => setFeedback({ ...feedback, isOpen: false })}
      />

    </AppLayout>
  );
};

export default AnagraficaClientiPage;