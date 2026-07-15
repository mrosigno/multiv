import { X } from 'lucide-react';
import { usePrimaNota } from '@/hooks/api/usePrimaNota';
import { useScadenzario } from '@/hooks/api/useScadenzario';
import { useCarichi } from '@/hooks/api/useCarichi';
import { useScarichi } from '@/hooks/api/useScarichi';
import { useTrasferimenti } from '@/hooks/api/useTrasferimenti';

export default function MovimentiViewerModal({ doc, type, onClose }: any) {
  // Carichiamo tutti i dati necessari in background
  const { data: pnData =[], isLoading: pnLoading } = usePrimaNota();
  const { data: scadData =[], isLoading: scadLoading } = useScadenzario();
  const { data: carichiData =[], isLoading: carLoading } = useCarichi();
  const { data: scarichiData =[], isLoading: scarLoading } = useScarichi();
  const { data: trasfData =[], isLoading: trasfLoading } = useTrasferimenti();

  const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
  const formatDate = (d: string) => { if (!d) return '-'; const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };

  let content = null;
  let isLoading = false;

  if (type === 'contabilita') {
    isLoading = pnLoading || scadLoading;
    // Filtriamo i movimenti collegati a questo ID Fattura
    const pn = pnData.filter((r: any) => Number(r.IdFattura) === Number(doc.ID));
    const scad = scadData.filter((r: any) => Number(r.idfattura) === Number(doc.ID));

    content = (
      <div className="space-y-6">
        {pn.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-border pb-1">Movimenti in Prima Nota</h4>
            
            {/* VERSIONE DESKTOP: Tabella */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Descrizione</th><th className="px-3 py-2 text-right">Dare</th><th className="px-3 py-2 text-right">Avere</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pn.map((r: any) => (
                    <tr key={r.Id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{formatDate(r.data)}</td>
                      <td className="px-3 py-2">{r.descrizione}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.Dare)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(r.Avere)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VERSIONE MOBILE: Cards */}
            <div className="md:hidden flex flex-col gap-3">
              {pn.map((r: any) => (
                <div key={r.Id} className="bg-card border border-border rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs text-muted-foreground font-medium">
                    <span>{formatDate(r.data)}</span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{r.descrizione}</p>
                  <div className="flex justify-between pt-2 border-t border-border/50 text-sm">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Dare</span>
                      <span className="font-mono font-bold text-foreground">{formatCurrency(r.Dare)}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Avere</span>
                      <span className="font-mono font-bold text-foreground">{formatCurrency(r.Avere)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}

        {scad.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-primary mb-3 border-b border-border pb-1">Movimenti in Scadenzario</h4>
            
            {/* VERSIONE DESKTOP: Tabella */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr><th className="px-3 py-2">Scadenza</th><th className="px-3 py-2">Descrizione</th><th className="px-3 py-2 text-right">Importo</th><th className="px-3 py-2 text-center">Stato</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {scad.map((r: any) => (
                    <tr key={r.Id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">{formatDate(r.data)}</td>
                      <td className="px-3 py-2">{r.descrizione}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCurrency(Number(r.Dare) > 0 ? r.Dare : r.Avere)}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${Number(r.chiuso) !== 0 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning-foreground'}`}>
                          {Number(r.chiuso) !== 0 ? 'Pagato' : 'Aperto'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VERSIONE MOBILE: Cards */}
            <div className="md:hidden flex flex-col gap-3">
              {scad.map((r: any) => (
                <div key={r.Id} className="bg-card border border-border rounded-xl p-3 shadow-sm flex flex-col gap-2">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-muted-foreground">Scad: {formatDate(r.data)}</span>
                    <span className={`px-2 py-0.5 rounded font-bold ${Number(r.chiuso) !== 0 ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning-foreground'}`}>
                      {Number(r.chiuso) !== 0 ? 'Pagato' : 'Aperto'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-tight">{r.descrizione}</p>
                  <div className="flex justify-end pt-2 border-t border-border/50 text-sm">
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Importo Rata</span>
                      <span className="font-mono font-bold text-foreground text-base">{formatCurrency(Number(r.Dare) > 0 ? r.Dare : r.Avere)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>
        )}
        {pn.length === 0 && scad.length === 0 && !isLoading && <p className="text-center text-muted-foreground py-4">Nessun movimento contabile trovato.</p>}
      </div>
    );
  } else if (type === 'magazzino') {
    isLoading = carLoading || scarLoading || trasfLoading;
    const car = carichiData.filter((r: any) => Number(r.iddocumento) === Number(doc.ID));
    const scar = scarichiData.filter((r: any) => Number(r.iddocumento) === Number(doc.ID));
    const trasf = trasfData.filter((r: any) => Number(r.iddocumento) === Number(doc.ID));

    const allMovs = [
      ...car.map((r:any) => ({ ...r, _tipo: 'Carico' })),
      ...scar.map((r:any) => ({ ...r, _tipo: 'Scarico' })),
      ...trasf.map((r:any) => ({ ...r, _tipo: 'Trasferimento' }))
    ];

    content = (
      <div className="space-y-4">
        {allMovs.length > 0 ? (
          <>
            {/* VERSIONE DESKTOP: Tabella */}
            <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground">
                  <tr><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Articolo</th><th className="px-3 py-2 text-right">Q.tà</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {allMovs.map((r: any, i: number) => (
                    <tr key={i} className="hover:bg-muted/30">
                      <td className="px-3 py-2 font-bold text-primary">{r._tipo}</td>
                      <td className="px-3 py-2">{formatDate(r.Data || r.data)}</td>
                      <td className="px-3 py-2 font-mono">{r.Cod_articolo || r.codice}</td>
                      <td className="px-3 py-2 text-right font-mono">{r.quantita || r.quant}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* VERSIONE MOBILE: Cards */}
            <div className="md:hidden flex flex-col gap-3">
              {allMovs.map((r: any, i: number) => (
                <div key={i} className="bg-card border border-border rounded-xl p-3 shadow-sm flex flex-col gap-2 border-l-4 border-l-amber-500">
                  <div className="flex justify-between items-center text-xs font-medium">
                    <span className="text-primary font-bold uppercase">{r._tipo}</span>
                    <span className="text-muted-foreground">{formatDate(r.Data || r.data)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border/50">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Articolo</span>
                      <span className="font-mono font-bold text-foreground">{r.Cod_articolo || r.codice}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] uppercase text-muted-foreground font-bold">Quantità</span>
                      <span className="font-mono font-black text-foreground text-base">{r.quantita || r.quant}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          !isLoading && <p className="text-center text-muted-foreground py-4">Nessun movimento di magazzino trovato.</p>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-fade-up sm:animate-fade-in border border-border max-h-[90vh]">
        <div className="bg-secondary/30 px-5 py-4 border-b border-border flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {type === 'contabilita' ? 'Dettaglio Movimenti Contabili' : 'Dettaglio Movimenti Magazzino'}
            </h3>
            <p className="text-sm text-muted-foreground">Doc. n. {doc.Num} del {formatDate(doc.datafatt)}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-50/50">
          {isLoading ? <div className="text-center text-muted-foreground py-8">Ricerca movimenti in corso...</div> : content}
        </div>
      </div>
    </div>
  );
}