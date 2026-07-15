import { useState, useMemo } from 'react';
import { Search, Plus, ChevronUp, ChevronDown, Pencil, Trash2, Save, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';

export interface ColumnDef {
  key: string;
  label: string;
  sortable?: boolean;
  type?: 'text' | 'number' | 'readonly';
  required?: boolean;
  hidden?: boolean;
  options?: { value: string | number; label: string }[];
  showTotal?: boolean;
}

interface CrudListPageProps {
  title: string;
  data: any[];
  columns: ColumnDef[];
  idKey: string;
  searchKeys: string[];
  searchPlaceholder?: string;
  onSave: (items: any[]) => void;
  defaultPageSize?: number;
}

const CrudListPage = ({
  title, data, columns, idKey, searchKeys,
  searchPlaceholder = 'Cerca...', onSave, defaultPageSize = 20,
}: CrudListPageProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [page, setPage] = useState(0);
  const [editItem, setEditItem] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);

  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(item =>
        searchKeys.some(k => String(item[k] ?? '').toLowerCase().includes(s))
      );
    }
    if (sortCol) {
      result.sort((a, b) => {
        const va = a[sortCol] ?? '';
        const vb = b[sortCol] ?? '';
        const cmp = typeof va === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  }, [data, search, sortCol, sortDir, searchKeys]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  const totals = useMemo(() => {
    const result: Record<string, number> = {};
    columns.forEach(col => {
      if (col.showTotal && col.type === 'number') {
        result[col.key] = filtered.reduce((s, item) => s + (Number(item[col.key]) || 0), 0);
      }
    });
    return result;
  }, [filtered, columns]);

  const hasTotals = Object.keys(totals).length > 0;

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const handleNew = () => {
    const empty: any = {};
    columns.forEach(c => { empty[c.key] = c.type === 'number' ? 0 : ''; });
    setEditItem(empty);
    setIsNew(true);
  };

  const handleEdit = (item: any) => {
    setEditItem({ ...item });
    setIsNew(false);
  };

  const handleDelete = (item: any) => {
    if (!confirm('Eliminare questo record?')) return;
    const newData = data.filter(d => d[idKey] !== item[idKey]);
    onSave(newData);
    toast({ title: 'Record eliminato' });
  };

  const handleSaveItem = () => {
    if (!editItem) return;
    const missing = columns.filter(c => c.required && !editItem[c.key] && editItem[c.key] !== 0);
    if (missing.length) {
      toast({ title: 'Campi obbligatori mancanti', description: missing.map(c => c.label).join(', '), variant: 'destructive' });
      return;
    }
    if (isNew) {
      if (data.some(d => d[idKey] === editItem[idKey]) && editItem[idKey]) {
        toast({ title: `${idKey} già esistente`, variant: 'destructive' });
        return;
      }
      onSave([...data, editItem]);
    } else {
      onSave(data.map(d => d[idKey] === editItem[idKey] ? editItem : d));
    }
    toast({ title: isNew ? 'Record creato' : 'Record salvato' });
    setEditItem(null);
    setIsNew(false);
  };

  const visibleColumns = columns.filter(c => !c.hidden);

  const getOptionLabel = (col: ColumnDef, value: any) => {
    if (!col.options) return null;
    const opt = col.options.find(o => String(o.value) === String(value));
    return opt ? opt.label : String(value);
  };

  const formatNumber = (col: ColumnDef, value: number) => {
    const k = col.key.toLowerCase();
    const hasDecimals = k.includes('prz') || k.includes('listino') || k.includes('aliquota') || k.includes('spese') || k.includes('importo') || k.includes('fido') || k.includes('sconto') || k.includes('provv');
    return value.toLocaleString('it-IT', { minimumFractionDigits: hasDecimals ? 2 : 0 });
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Search & actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>
            <select
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value={20}>20 / pag</option>
              <option value={50}>50 / pag</option>
              <option value={100}>100 / pag</option>
            </select>
            <Button onClick={handleNew} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Nuovo
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Edit form - MODAL centered */}
      {editItem && (
        <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-50 flex items-center justify-center p-4" onClick={() => { setEditItem(null); setIsNew(false); }}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fade-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <h3 className="text-lg font-bold text-foreground">{isNew ? 'Nuovo Record' : 'Modifica Record'}</h3>
              <button onClick={() => { setEditItem(null); setIsNew(false); }} className="p-2 rounded-lg hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {columns.map(col => (
                  <div key={col.key}>
                    <label className="text-xs font-medium text-muted-foreground">
                      {col.label}{col.required ? ' *' : ''}
                    </label>
                    {col.options ? (
                      <select
                        value={editItem[col.key] ?? ''}
                        onChange={e => setEditItem({ ...editItem, [col.key]: col.type === 'number' ? Number(e.target.value) : e.target.value })}
                        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">-- Seleziona --</option>
                        {col.options.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    ) : (
                      <Input
                        type={col.type === 'number' ? 'number' : 'text'}
                        value={editItem[col.key] ?? ''}
                        onChange={e => setEditItem({ ...editItem, [col.key]: col.type === 'number' ? Number(e.target.value) : e.target.value })}
                        disabled={col.type === 'readonly' && !isNew}
                        className="mt-1"
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleSaveItem} size="sm">
                  <Save className="w-4 h-4 mr-1" /> Salva
                </Button>
                {!isNew && (
                  <Button variant="destructive" size="sm" onClick={() => { handleDelete(editItem); setEditItem(null); }}>
                    <Trash2 className="w-4 h-4 mr-1" /> Elimina
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {visibleColumns.map(col => (
                    <TableHead
                      key={col.key}
                      className={col.sortable !== false ? 'cursor-pointer select-none hover:bg-muted/50' : ''}
                      onClick={() => col.sortable !== false && handleSort(col.key)}
                    >
                      <div className="flex items-center gap-1">
                        {col.label}
                        {sortCol === col.key && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="w-20">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((item, idx) => (
                  <TableRow key={item[idKey] ?? idx} className="cursor-pointer hover:bg-muted/30" onClick={() => handleEdit(item)}>
                    {visibleColumns.map(col => (
                      <TableCell key={col.key} className="text-sm">
                        {col.options
                          ? getOptionLabel(col, item[col.key])
                          : col.type === 'number' && typeof item[col.key] === 'number'
                            ? formatNumber(col, item[col.key])
                            : String(item[col.key] ?? '')}
                      </TableCell>
                    ))}
                    <TableCell>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <button className="p-1 hover:text-primary" onClick={() => handleEdit(item)}><Pencil className="w-3.5 h-3.5" /></button>
                        <button className="p-1 hover:text-destructive" onClick={() => handleDelete(item)}><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {paged.length === 0 && (
                  <TableRow><TableCell colSpan={visibleColumns.length + 1} className="text-center text-muted-foreground py-8">Nessun record trovato</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Fixed Footer with totals */}
          <div className="fixed bottom-0 left-0 right-0 bg-background border-t-2 border-border shadow-[0_-4px_12px_rgba(0,0,0,0.12)] p-3 text-sm z-50" style={{ maxHeight: '70px' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium text-muted-foreground">{filtered.length} record</span>
              {hasTotals && (
                <div className="flex flex-wrap gap-4">
                  {columns.filter(c => c.showTotal && totals[c.key] !== undefined).map(col => (
                    <span key={col.key} className="font-bold text-green-700">
                      Tot {col.label}: {col.key.toLowerCase().includes('importo') || col.key.toLowerCase().includes('fido') || col.key.toLowerCase().includes('prz')
                        ? `€ ${totals[col.key].toLocaleString('it-IT', { minimumFractionDigits: 2 })}`
                        : totals[col.key].toLocaleString('it-IT')}
                    </span>
                  ))}
                </div>
              )}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button>
                  <span className="px-2">{page + 1} / {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>→</Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default CrudListPage;
