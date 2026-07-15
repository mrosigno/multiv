import { useState, useEffect } from 'react';
import { Filter, RotateCcw, Search } from 'lucide-react';
import { useBrand } from '@/hooks/api/useBrand';
import { useReparti } from '@/hooks/api/useReparti';
import { useCategorieArticoli, useSottocategorieArticoli } from '@/hooks/api/useArticoli';

export interface MagazzinoFiltersState {
  search: string;
  brand: string;
  categoria: string;
  sottocategoria: string;
  reparto: number;
  barcode: string;
}

const defaultFilters: MagazzinoFiltersState = {
  search: '', brand: '', categoria: '', sottocategoria: '', reparto: 0, barcode: '',
};

interface Props {
  onApply: (filters: MagazzinoFiltersState) => void;
}

const MagazzinoFilters = ({ onApply }: Props) => {
  const [filters, setFilters] = useState<MagazzinoFiltersState>(defaultFilters);
  const [expanded, setExpanded] = useState(false);

  // --- HOOKS API REALI ---
  const { data: brandData =[] } = useBrand();
  const { data: repartiData =[] } = useReparti();
  const { data: categorieData =[] } = useCategorieArticoli();
  const { data: sottocategorieData =[] } = useSottocategorieArticoli();

  // Applica i filtri iniziali al caricamento
  useEffect(() => {
    onApply(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: keyof MagazzinoFiltersState, value: string | number) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onApply(filters);
  };

  const reset = () => {
    setFilters(defaultFilters);
    onApply(defaultFilters);
  };

  const inputClass = "w-full px-2 py-1.5 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelClass = "block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1";

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm mb-4 animate-fade-in">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground min-h-[48px]"
      >
        <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> {expanded ? '▲ Nascondi filtri' : '▼ Mostra filtri'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          
          {/* LAYOUT FLEX: Su PC (xl) sta tutto su una riga, su Mobile si impila */}
          <div className="flex flex-col xl:flex-row items-end gap-3">
            
            {/* Ricerca Libera */}
            <div className="w-full xl:flex-1">
              <label className={labelClass}>Ricerca Libera</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input type="text" placeholder="Codice o descr..." value={filters.search} onChange={(e) => update('search', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApply()} className={`${inputClass} pl-8`} />
              </div>
            </div>

            {/* Barcode */}
            <div className="w-full xl:w-32 shrink-0">
              <label className={labelClass}>Barcode</label>
              <input type="text" placeholder="Lettore..." value={filters.barcode} onChange={(e) => update('barcode', e.target.value)} onKeyDown={e => e.key === 'Enter' && handleApply()} className={inputClass} />
            </div>

            {/* Brand */}
            <div className="w-full xl:w-32 shrink-0">
              <label className={labelClass}>Brand</label>
              <select value={filters.brand} onChange={e => update('brand', e.target.value)} className={inputClass}>
                <option value="">Tutti</option>
                {brandData.map((b: any) => <option key={b.id} value={b.id}>{b.descrizione}</option>)}
              </select>
            </div>

            {/* Categoria */}
            <div className="w-full xl:w-32 shrink-0">
              <label className={labelClass}>Categoria</label>
              <select value={filters.categoria} onChange={e => update('categoria', e.target.value)} className={inputClass}>
                <option value="">Tutte</option>
                {categorieData.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            {/* Sottocategoria (Molto stretta) */}
            <div className="w-full xl:w-20 shrink-0">
              <label className={labelClass}>SottoCat.</label>
              <select value={filters.sottocategoria} onChange={e => update('sottocategoria', e.target.value)} className={inputClass}>
                <option value="">Tutte</option>
                {sottocategorieData.map((s: string) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Reparto */}
            <div className="w-full xl:w-32 shrink-0">
              <label className={labelClass}>Reparto</label>
              <select value={filters.reparto} onChange={e => update('reparto', +e.target.value)} className={inputClass}>
                <option value={0}>Tutti</option>
                {repartiData.map((r: any) => <option key={r.id} value={r.id}>{r.descrizione}</option>)}
              </select>
            </div>

            {/* Pulsanti */}
            <div className="flex gap-2 w-full xl:w-auto shrink-0 mt-2 xl:mt-0">
              <button onClick={reset} className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors h-[34px]">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={handleApply} className="flex-1 xl:flex-none flex items-center justify-center gap-1.5 px-4 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity h-[34px]">
                <Filter className="w-3.5 h-3.5" /> Applica
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default MagazzinoFilters;