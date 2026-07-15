import { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Pencil, Package } from 'lucide-react';
import { Articolo } from '@/data/mockData';
import { reparti } from '@/data/magazzinoMockData';

interface Props {
  articoli: Articolo[];
  onSelect: (art: Articolo) => void;
}

type SortKey = 'Codice' | 'codice2' | 'Descrizione' | 'Cod_Prisma' | 'sottocateg' | 'brand' | 'ultprzacq' | 'Listino1';
type SortDir = 'asc' | 'desc';

const SORT_STORAGE = 'gestionale_magazzino_sort';

const formatCurrency = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const ArticoliTable = ({ articoli, onSelect }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey>(() => {
    try { return (JSON.parse(localStorage.getItem(SORT_STORAGE) || '{}').key) || 'Codice'; } catch { return 'Codice'; }
  });
  const [sortDir, setSortDir] = useState<SortDir>(() => {
    try { return (JSON.parse(localStorage.getItem(SORT_STORAGE) || '{}').dir) || 'asc'; } catch { return 'asc'; }
  });

  const toggleSort = (key: SortKey) => {
    const newDir = sortKey === key ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    localStorage.setItem(SORT_STORAGE, JSON.stringify({ key, dir: newDir }));
  };

  const sorted = useMemo(() => {
    return [...articoli].sort((a, b) => {
      const va = a[sortKey] ?? '';
      const vb = b[sortKey] ?? '';
      const cmp = typeof va === 'number' ? va - (vb as number) : String(va).localeCompare(String(vb), 'it');
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [articoli, sortKey, sortDir]);

  const totArticoli = sorted.length;
  const totValoreMagazzino = useMemo(() => articoli.reduce((s, a) => s + a.esistenza * a.Listino1, 0), [articoli]);

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-primary" /> : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const thClass = "h-10 px-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer select-none hover:text-foreground transition-colors";
  const repartoDesc = (id: number) => reparti.find(r => r.id === id)?.descrizione || String(id);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm flex flex-col">
      {/* Desktop */}
      <div className="hidden md:block overflow-auto flex-1">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 sticky top-0 z-10">
            <tr>
              <th className={thClass} onClick={() => toggleSort('Codice')}>
                <span className="flex items-center gap-1">Codice <SortIcon col="Codice" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('codice2')}>
                <span className="flex items-center gap-1">Cod.2 <SortIcon col="codice2" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('Descrizione')}>
                <span className="flex items-center gap-1">Descrizione <SortIcon col="Descrizione" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('Cod_Prisma')}>
                <span className="flex items-center gap-1">Categoria <SortIcon col="Cod_Prisma" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('sottocateg')}>
                <span className="flex items-center gap-1">Sottocateg. <SortIcon col="sottocateg" /></span>
              </th>
              <th className={thClass} onClick={() => toggleSort('brand')}>
                <span className="flex items-center gap-1">Brand <SortIcon col="brand" /></span>
              </th>
              <th className={thClass + " text-right"} onClick={() => toggleSort('ultprzacq')}>
                <span className="flex items-center gap-1 justify-end">Prz.Acq. <SortIcon col="ultprzacq" /></span>
              </th>
              <th className={thClass + " text-right"} onClick={() => toggleSort('Listino1')}>
                <span className="flex items-center gap-1 justify-end">Prz.Vendita <SortIcon col="Listino1" /></span>
              </th>
              <th className="h-10 px-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(art => (
              <tr key={art.id} className="border-b border-border hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSelect(art)}>
                <td className="px-3 py-2.5 font-mono text-xs font-medium text-primary">{art.Codice}</td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{art.codice2 || '—'}</td>
                <td className="px-3 py-2.5 font-medium text-foreground">{art.Descrizione}</td>
                <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full text-xs bg-accent text-accent-foreground">{art.Cod_Prisma}</span></td>
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{art.sottocateg}</td>
                <td className="px-3 py-2.5 text-xs">{art.brand}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs">{formatCurrency(art.ultprzacq)}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold">{formatCurrency(art.Listino1)}</td>
                <td className="px-3 py-2.5 text-center">
                  <button onClick={e => { e.stopPropagation(); onSelect(art); }} className="p-1 rounded hover:bg-secondary transition-colors">
                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">Nessun articolo trovato</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden divide-y divide-border flex-1 overflow-auto">
        {sorted.map(art => (
          <div key={art.id} className="p-3 hover:bg-muted/30 transition-colors cursor-pointer" onClick={() => onSelect(art)}>
            <div className="flex items-start justify-between">
              <div>
                <span className="font-mono text-xs text-primary font-medium">{art.Codice}</span>
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-accent text-accent-foreground">{art.Cod_Prisma}</span>
              </div>
              <span className="font-mono text-sm font-semibold">{formatCurrency(art.Listino1)}</span>
            </div>
            <p className="text-sm font-medium text-foreground mt-1">{art.Descrizione}</p>
            <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
              <span>{art.brand}</span>
              <span>{art.sottocateg}</span>
              <span>Acq. {formatCurrency(art.ultprzacq)}</span>
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">Nessun articolo trovato</div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 bg-muted/80 backdrop-blur border-t border-border px-4 py-2.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Package className="w-4 h-4" />
          <span className="font-medium">{totArticoli} articoli</span>
        </div>
        <div className="font-semibold text-foreground">
          Valore magazzino: <span className="font-mono">{formatCurrency(totValoreMagazzino)}</span>
        </div>
      </div>
    </div>
  );
};

export default ArticoliTable;
