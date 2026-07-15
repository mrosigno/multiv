import { useState, useMemo, useEffect } from 'react';
import { Plus, Pencil, Eye, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import MagazzinoFilters, { MagazzinoFiltersState } from '@/components/MagazzinoFilters';
import ArticoloFormModal from '@/components/ArticoloFormModal';
import { useArticoli } from '@/hooks/api/useArticoli';
import { useReparti } from '@/hooks/api/useReparti';
import { useAuthAccess } from '@/hooks/useAuthAccess'; 
import { useMenu } from '@/contexts/MenuContext'; // <-- IMPORT CONTESTO HEADER

type SortCol = 'Codice' | 'Descrizione';
type SortDir = 'asc' | 'desc';

const MagazzinoPage = () => {
  const auth = useAuthAccess(); 
  const { setHeaderTitle, setPagination } = useMenu(); // <-- HOOK PER PAGINAZIONE IN ALTO

  // REGOLA: Chi può modificare articoli ESISTENTI? (Liv 2 o >=4)
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  
  const [isLogged] = useState(() => !!localStorage.getItem('gestionale_auth'));
  
  const [activeFilters, setActiveFilters] = useState<MagazzinoFiltersState | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingArticolo, setEditingArticolo] = useState<any | null>(null);

  const [sortCol, setSortCol] = useState<SortCol>('Codice');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  const { data: apiData = [], isLoading, isError } = useArticoli();
  const { data: repartiData = [] } = useReparti();

  const toggleSort = (col: SortCol) => {
    if (sortCol === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const getRepartoName = (id: number) => {
    const rep = repartiData.find((r: any) => Number(r.id) === Number(id));
    return rep ? rep.descrizione : '-';
  };

  const filteredAndSortedData = useMemo(() => {
    let result = [...apiData];
    if (activeFilters) {
      if (activeFilters.search) {
        const q = activeFilters.search.toLowerCase();
        result = result.filter((a: any) => (a.Codice || '').toLowerCase().includes(q) || (a.Descrizione || '').toLowerCase().includes(q));
      }
      if (activeFilters.barcode) {
        const searchBarcode = activeFilters.barcode.toLowerCase();
        result = result.filter((a: any) => 
          String(a.barcode || '').toLowerCase().includes(searchBarcode) || 
          String(a.Codice || '').toLowerCase().includes(searchBarcode)
        );
      }
      if (activeFilters.brand) result = result.filter((a: any) => a.brand === activeFilters.brand);
      if (activeFilters.categoria) result = result.filter((a: any) => a.Cod_Prisma === activeFilters.categoria);
      if (activeFilters.sottocategoria) result = result.filter((a: any) => a.sottocateg === activeFilters.sottocategoria);
      if (activeFilters.reparto > 0) result = result.filter((a: any) => Number(a.reparto) === activeFilters.reparto);
    }
    result.sort((a, b) => {
      const valA = String(a[sortCol] || '').toLowerCase();
      const valB = String(b[sortCol] || '').toLowerCase();
      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [apiData, activeFilters, sortCol, sortDir]);

  useEffect(() => { setPage(0); }, [activeFilters, sortCol, sortDir]);

  const totalPages = Math.ceil(filteredAndSortedData.length / pageSize) || 1; 
  const pagedData = filteredAndSortedData.slice(page * pageSize, (page + 1) * pageSize);

  // --- TRASMISSIONE AL SOTTO-HEADER GLOBALE ---
  useEffect(() => {
    setHeaderTitle('Catalogo Prodotti e Listino');
    setPagination({
      page,
      totalPages,
      pageSize,
      totalRecords: filteredAndSortedData.length,
      onPageChange: (newPage: number) => setPage(newPage),
      onPageSizeChange: (newSize: number) => { setPageSize(newSize); setPage(0); }
    });

    return () => {
      setHeaderTitle('');
      setPagination(undefined);
    };
  }, [page, totalPages, pageSize, filteredAndSortedData.length, setHeaderTitle, setPagination]);

  const handleNew = () => { setEditingArticolo(null); setShowModal(true); };
  
  const handleOpen = (articolo: any) => {
    setEditingArticolo(articolo);
    setShowModal(true);
  };
  
  const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />;
  };

  if (!isLogged) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      {/* PANNELLO AZIONI E FILTRI IN CIMA */}
      <div className="flex flex-col sm:flex-row items-end justify-between gap-4 mb-4">
        
        {/* Filtri */}
        <div className="w-full sm:flex-1">
          <MagazzinoFilters onApply={setActiveFilters} />
        </div>

        {/* Bottone Nuovo (Nascosto se l'utente non può creare) */}
        {auth.canCreate && (
          <button onClick={handleNew} className="flex items-center justify-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-bold text-sm shrink-0 w-full sm:w-auto h-[42px] active:scale-95">
            <Plus className="w-4 h-4 shrink-0" /> <span className="truncate">Nuovo Articolo</span>
          </button>
        )}

      </div>

      {/* TABELLA DESKTOP */}
      <div className="hidden lg:flex lg:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-table-header border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-40 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('Codice')}>
                  <span className="flex items-center gap-1">Codice <SortIcon col="Codice" /></span>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort('Descrizione')}>
                  <span className="flex items-center gap-1">Descrizione <SortIcon col="Descrizione" /></span>
                </th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-16 text-center">UM</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground w-40">Reparto</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right w-28">Listino 1</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-28">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Caricamento articoli...</td></tr>}
              {isError && !isLoading && <tr><td colSpan={6} className="p-8 text-center text-destructive">Errore di connessione al database.</td></tr>}
              {!isLoading && !isError && pagedData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nessun articolo trovato.</td></tr>}
              
              {!isLoading && !isError && pagedData.map((item: any, idx: number) => (
                <tr 
                  key={item.id || item.Codice} 
                  onClick={() => handleOpen(item)}
                  className={`hover:bg-muted/30 cursor-pointer transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}
                >
                  <td className="px-4 py-3 font-mono font-bold text-primary">{item.Codice}</td>
                  <td className="px-4 py-3 font-medium text-foreground">{item.Descrizione}</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">{item.UnMis}</td>
                  <td className="px-4 py-3 text-muted-foreground truncate max-w-[150px]">{getRepartoName(item.reparto)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">{formatCurrency(item.Listino1)}</td>
                  <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                    
                    {/* BOTTONE DINAMICO: MATITA o OCCHIETTO IN BASE AI PERMESSI */}
                    <button 
                      onClick={() => handleOpen(item)} 
                      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-[10px] font-bold shadow-sm mx-auto active:scale-95 ${canEditExisting ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-700 hover:text-white'}`} 
                      title={canEditExisting ? "Modifica Articolo" : "Visualizza Articolo"}
                    >
                      {canEditExisting ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span className="hidden lg:inline">{canEditExisting ? 'MODIFICA' : 'VEDI'}</span>
                    </button>

                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* CARDS MOBILE/TABLET */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-2 pb-8">
        {isLoading && <div className="col-span-full p-8 text-center text-muted-foreground">Caricamento articoli...</div>}
        {!isLoading && pagedData.length === 0 && <div className="col-span-full bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessun articolo trovato.</div>}
        
        {!isLoading && pagedData.map((item: any) => (
          <div 
            key={item.id || item.Codice} 
            onClick={() => handleOpen(item)}
            className="bg-card rounded-xl border border-border p-3 shadow-sm hover:shadow-md active:scale-[0.98] cursor-pointer transition-all animate-fade-in flex flex-col justify-center"
          >
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 border border-primary/20">{item.Codice}</span>
              <span className="text-[10px] text-muted-foreground font-bold shrink-0">{item.UnMis}</span>
              <span className="text-[10px] text-muted-foreground truncate shrink-0 max-w-[120px] bg-secondary/50 px-1.5 py-0.5 rounded border border-border">{getRepartoName(item.reparto)}</span>
              
              {/* BOTTONE DINAMICO SPORTO A DESTRA */}
              <button 
                onClick={(e) => { e.stopPropagation(); handleOpen(item); }} 
                className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-colors text-[10px] font-bold shadow-sm shrink-0 active:scale-95 ${canEditExisting ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-700 hover:text-white'}`}
              >
                {canEditExisting ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{canEditExisting ? 'MODIFICA' : 'VEDI'}</span>
              </button>

            </div>

            <div className="flex items-center justify-between gap-3 bg-secondary/10 p-2.5 rounded-lg border border-border/50">
              <h3 className="text-xs font-bold text-foreground leading-snug line-clamp-2 flex-1" title={item.Descrizione}>{item.Descrizione}</h3>
              <span className="text-sm font-mono font-black text-foreground shrink-0">{formatCurrency(item.Listino1)}</span>
            </div>
          </div>
        ))}
      </div>

      {/* MODALE INSERIMENTO/MODIFICA ARTICOLO */}
      {showModal && (
        <ArticoloFormModal
          articolo={editingArticolo}
          onSave={() => setShowModal(false)}
          onClose={() => setShowModal(false)}
        />
      )}

    </AppLayout>
  );
};

export default MagazzinoPage;