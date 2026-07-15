import { useState, useMemo } from 'react';
import { X, ArrowRightLeft, TrendingUp, TrendingDown, Package, History, ArrowDownRight, ArrowUpRight, Calculator } from 'lucide-react';
import { useCarichi } from '@/hooks/api/useCarichi';
import { useScarichi } from '@/hooks/api/useScarichi';
import { useTrasferimenti } from '@/hooks/api/useTrasferimenti';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useFatture } from '@/hooks/api/useFatture';
import { useArticoli } from '@/hooks/api/useArticoli';
import DocumentDetail from '@/components/DocumentDetail';
import { API_HOST } from '@/config';

interface Props {
  codiceArticolo: string;
  dateFrom: string;
  dateTo: string;
  onClose: () => void;
}

export default function MovimentiMagazzinoViewerModal({ codiceArticolo, dateFrom, dateTo, onClose }: Props) {
  const [viewDocument, setViewDocument] = useState<any | null>(null);
  const [fetchingDocId, setFetchingDocId] = useState<number | null>(null);

  const { data: articoli = [] } = useArticoli();
  const { data: carichi = [], isLoading: loadC } = useCarichi();
  const { data: scarichi = [], isLoading: loadS } = useScarichi();
  const { data: trasferimenti = [], isLoading: loadT } = useTrasferimenti();
  const { data: magazzini = [], isLoading: loadM } = useMagazzini();
  const { data: fattureData = [], isLoading: loadF } = useFatture();

  const isLoading = loadC || loadS || loadT || loadM || loadF;

  // --- MOTORE CALCOLO TIMELINE E COSTO MEDIO ---
  const { timeline, costoMedio, stat } = useMemo(() => {
    if (isLoading) return { timeline: [], costoMedio: 0, stat: { esistenzaIniziale: 0, totIn: 0, totOut: 0, rimanenzaAttuale: 0 } };
    
    const getMagName = (id: number) => magazzini.find((x: any) => Number(x.cod) === Number(id))?.Descrizione || String(id);
    const art = articoli.find((a: any) => a.Codice === codiceArticolo);

    let history: any[] = [];
    let totQtaAcquisti = 0;
    let totValoreAcquisti = 0;

    const aCarichi = carichi.filter((c: any) => c.Cod_articolo === codiceArticolo);
    const aScarichi = scarichi.filter((s: any) => s.Cod_articolo === codiceArticolo);
    const aTrasfIn = trasferimenti.filter((t: any) => t.codice === codiceArticolo);
    const aTrasfOut = trasferimenti.filter((t: any) => t.codice === codiceArticolo);

    // 1. CARICHI
    aCarichi.forEach((c: any) => {
      const qta = Number(c.quantita || 0);
      const prezzo = Number(c.Importo || 0);
      const sconto = Number(c.perc || 0);
      
      if (c.Data <= dateTo && prezzo > 0) {
        totQtaAcquisti += qta;
        totValoreAcquisti += (qta * (prezzo * (1 - sconto / 100)));
      }

      if (c.Data >= dateFrom && c.Data <= dateTo) {
        history.push({
          id: `C-${c.Id}`, dataReal: c.Data, tipo: Number(c.inventario) !== 0 ? 'Carico (Inventario)' : 'Carico',
          icon: <TrendingUp className="w-4 h-4 text-green-600" />, qta, prezzo, sconto,
          magazzino: getMagName(c.magazzino), doc: c.iddocumento > 0 ? c.iddocumento : null,
          rifTesto: c.protocollo || '', colorClass: 'text-green-700 bg-green-50/50', badgeClass: 'bg-green-100 text-green-700 border-green-200'
        });
      }
    });

    // 2. SCARICHI
    aScarichi.forEach((s: any) => {
      if (s.Data >= dateFrom && s.Data <= dateTo) {
        history.push({
          id: `S-${s.Id}`, dataReal: s.Data, tipo: 'Scarico',
          icon: <TrendingDown className="w-4 h-4 text-red-600" />, qta: -Number(s.quantita),
          prezzo: Number(s.Pr_Unit || 0), sconto: Number(s.perc || 0),
          magazzino: getMagName(s.magazzino), doc: s.iddocumento > 0 ? s.iddocumento : null,
          rifTesto: s.Riferimento || '', colorClass: 'text-red-700 bg-red-50/50', badgeClass: 'bg-red-100 text-red-700 border-red-200'
        });
      }
    });

    // 3. TRASFERIMENTI
    aTrasfIn.forEach((t: any) => {
      if (t.data >= dateFrom && t.data <= dateTo) {
        history.push({
          id: `TI-${t.id}`, dataReal: t.data, tipo: 'Trasf. (In)',
          icon: <ArrowRightLeft className="w-4 h-4 text-blue-600" />, qta: Number(t.quant),
          prezzo: null, sconto: null, magazzino: getMagName(t.magin), doc: t.iddocumento > 0 ? t.iddocumento : null,
          rifTesto: '', colorClass: 'text-blue-700 bg-blue-50/50', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200'
        });
      }
    });
    aTrasfOut.forEach((t: any) => {
      if (t.data >= dateFrom && t.data <= dateTo) {
        history.push({
          id: `TO-${t.id}`, dataReal: t.data, tipo: 'Trasf. (Out)',
          icon: <ArrowRightLeft className="w-4 h-4 text-amber-600" />, qta: -Number(t.quant),
          prezzo: null, sconto: null, magazzino: getMagName(t.magout), doc: t.iddocumento > 0 ? t.iddocumento : null,
          rifTesto: '', colorClass: 'text-amber-700 bg-amber-50/50', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200'
        });
      }
    });

    // --- CALCOLO COSTO MEDIO ---
    let cMedio = totQtaAcquisti > 0 ? (totValoreAcquisti / totQtaAcquisti) : 0;
    if (cMedio === 0 && art) cMedio = Number(art.Listino1 || 0); 

    // --- CALCOLO GIACENZA E STATISTICHE ---
    const calcSum = (arr: any[], field = 'quantita') => arr.reduce((acc, curr) => acc + Number(curr[field] || curr.quant || 0), 0);
    const pastCarichi = calcSum(aCarichi.filter((c: any) => c.Data < dateFrom));
    const pastScarichi = calcSum(aScarichi.filter((s: any) => s.Data < dateFrom));
    const pastTrasfIn = calcSum(aTrasfIn.filter((t: any) => t.data < dateFrom));
    const pastTrasfOut = calcSum(aTrasfOut.filter((t: any) => t.data < dateFrom));
    
    const giacenzaInizialeVal = pastCarichi - pastScarichi + pastTrasfIn - pastTrasfOut;
    const pastInventari = aCarichi.filter((c: any) => c.Data < dateFrom && Number(c.inventario) !== 0).sort((a:any, b:any) => new Date(b.Data).getTime() - new Date(a.Data).getTime());
    
    let dataGiacenzaIniziale = '';
    if (pastInventari.length > 0) {
      dataGiacenzaIniziale = pastInventari[0].Data;
    } else {
      const d = new Date(dateFrom); d.setDate(0); 
      dataGiacenzaIniziale = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    history.push({
      id: 'GIAC-INIZ', dataReal: dataGiacenzaIniziale, tipo: 'Giacenza Iniziale',
      icon: <History className="w-4 h-4 text-foreground" />, qta: giacenzaInizialeVal,
      prezzo: cMedio, sconto: null, magazzino: 'Tutti', doc: null, 
      rifTesto: pastInventari.length > 0 ? 'Da ultimo inventario registrato' : 'Calcolo movimenti pregressi',
      colorClass: 'text-foreground font-black bg-secondary/50', badgeClass: 'bg-secondary text-foreground border-border'
    });

	history.sort((a, b) => {
      // 1. Forza la Giacenza Iniziale SEMPRE come primissima riga in alto
      if (a.id === 'GIAC-INIZ') return -1;
      if (b.id === 'GIAC-INIZ') return 1;
      
      // 2. Ordina il resto dei movimenti dal più recente al più vecchio
      const timeA = new Date(a.dataReal).getTime();
      const timeB = new Date(b.dataReal).getTime();
      return timeB - timeA; 
    });

    // Calcolo Rimanenza per il cruscotto (Totale generale assoluto)
    const esistenzaIniziale = Number(art?.esistenza || 0);
    const totInGlobale = calcSum(aCarichi);
    const totOutGlobale = calcSum(aScarichi);
    const rimanenzaAttuale = esistenzaIniziale + totInGlobale - totOutGlobale;

    return { 
      timeline: history, 
      costoMedio: cMedio, 
      stat: { esistenzaIniziale, totIn: totInGlobale, totOut: totOutGlobale, rimanenzaAttuale } 
    };
  }, [carichi, scarichi, trasferimenti, magazzini, articoli, codiceArticolo, dateFrom, dateTo, isLoading]);

  const formatDate = (d: string) => {
    if (!d) return '-';
    const parts = d.split(' ')[0].split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  };

  const formatCurrency = (n: number | null) => {
    if (n === null) return '-';
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n));
  };

  const handleOpenDoc = async (idDoc: number | null) => {
    if (!idDoc) return;
    let docFound = fattureData.find((f: any) => Number(f.ID) === Number(idDoc));
    if (!docFound) {
      setFetchingDocId(idDoc);
      try {
        const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${idDoc}`);
        const fatturaStorica = await res.json();
        if (fatturaStorica && fatturaStorica.ID) { docFound = fatturaStorica; }
      } catch (e) {
      } finally { setFetchingDocId(null); }
    }
    if (docFound) { setViewDocument(docFound); } else {
      alert(`Il documento originale non è stato trovato.`);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-xl shadow-2xl w-full max-w-5xl flex flex-col border border-border sm:border-amber-500/20 overflow-hidden h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[95vh]">
          
          <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <Package className="w-6 h-6 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold leading-tight">Movimenti e Rimanenza</h2>
                <p className="text-xs text-slate-300 font-mono font-bold tracking-wider">{codiceArticolo}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5"/></button>
          </div>

          {/* CRUSCOTTO RIEPILOGATIVO IN ALTO */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-border border-b border-border shrink-0">
            <div className="bg-card p-3 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Giacenza Iniziale</span>
              <span className="text-lg font-mono font-bold text-foreground">{stat.esistenzaIniziale}</span>
            </div>
            <div className="bg-card p-3 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1 mb-1"><ArrowDownRight className="w-3 h-3"/> Carichi</span>
              <span className="text-lg font-mono font-bold text-emerald-600">+{stat.totIn}</span>
            </div>
            <div className="bg-card p-3 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase font-bold text-destructive flex items-center gap-1 mb-1"><ArrowUpRight className="w-3 h-3"/> Scarichi</span>
              <span className="text-lg font-mono font-bold text-destructive">-{stat.totOut}</span>
            </div>
            <div className="bg-amber-50 p-3 flex flex-col items-center justify-center border-b-2 border-amber-500">
              <span className="text-[10px] uppercase font-black text-amber-800 mb-1">Rimanenza Reale</span>
              <span className="text-xl font-mono font-black text-amber-600">{stat.rimanenzaAttuale}</span>
            </div>
            <div className="bg-blue-50 p-3 flex flex-col items-center justify-center border-b-2 border-blue-500 md:col-span-1 col-span-2">
              <span className="text-[10px] uppercase font-black text-blue-800 mb-1 flex items-center gap-1"><Calculator className="w-3 h-3"/> Prz. Medio Acq.</span>
              <span className="text-lg font-mono font-bold text-blue-600">{formatCurrency(costoMedio)}</span>
            </div>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar bg-secondary/10 min-h-0">
            {isLoading ? (
              <div className="p-12 text-center text-muted-foreground animate-pulse">Recupero movimenti...</div>
            ) : timeline.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground">Nessun movimento.</div>
            ) : (
              <>
                {/* TABELLA DESKTOP */}
                <table className="w-full text-sm text-left hidden md:table">
                  <thead className="bg-secondary/50 border-b border-border sticky top-0 z-10 backdrop-blur-md">
                    <tr>
                      <th className="px-6 py-3 font-semibold text-muted-foreground w-28">Data</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground w-48">Tipo Movimento</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground">Magazzino</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground text-right w-28">Imponibile</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground text-right w-20">Sc. %</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground text-center w-28">Rif. Doc</th>
                      <th className="px-6 py-3 font-semibold text-muted-foreground text-right w-32">Quantità</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {timeline.map((row) => (
                      <tr key={row.id} className="hover:bg-muted/30 transition-colors bg-card">
                        <td className="px-6 py-3 text-foreground font-medium">{formatDate(row.dataReal)}</td>
                        <td className="px-6 py-3">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${row.badgeClass}`}>
                            {row.icon} {row.tipo}
                          </div>
                        </td>
                        <td className="px-6 py-3 text-muted-foreground font-medium truncate max-w-[200px]">{row.magazzino}</td>
                        <td className="px-6 py-3 text-right text-foreground font-mono font-medium">{formatCurrency(row.prezzo)}</td>
                        <td className="px-6 py-3 text-right text-destructive font-mono font-medium">{row.sconto !== null && row.sconto !== 0 ? `${row.sconto}%` : '-'}</td>
                        <td className="px-6 py-3 text-center">
                          {row.doc ? (
                            <span onClick={() => handleOpenDoc(row.doc)} className="inline-flex items-center justify-center px-2.5 py-1 rounded-md text-primary font-bold bg-primary/10 border border-primary/20 hover:bg-primary hover:text-white transition-colors cursor-pointer" title={row.rifTesto ? `Doc: ${row.rifTesto}` : "Apri Documento"}>
                              {row.doc}
                            </span>
                          ) : (
                            <span className="text-muted-foreground cursor-help underline decoration-dotted" title={row.rifTesto || "Nessun documento"}>-</span>
                          )}
                        </td>
                        <td className={`px-6 py-3 text-right font-mono font-black text-base ${row.colorClass}`}>
                          {row.qta > 0 && row.id !== 'GIAC-INIZ' ? '+' : ''}{row.qta.toLocaleString('it-IT')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* CARD MOBILE */}
                <div className="md:hidden flex flex-col gap-3">
                  {timeline.map((row) => (
                    <div key={row.id} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-medium text-muted-foreground">{formatDate(row.dataReal)}</span>
                        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${row.badgeClass}`}>
                          {row.icon} {row.tipo}
                        </div>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground truncate max-w-[150px] mb-1">{row.magazzino}</span>
                          {row.prezzo !== null && <span className="text-xs text-muted-foreground font-mono">Prezzo: <strong className="text-foreground">{formatCurrency(row.prezzo)}</strong> {row.sconto ? `(-${row.sconto}%)` : ''}</span>}
                          {row.doc && (
                            <span onClick={() => handleOpenDoc(row.doc)} className="mt-1.5 text-[11px] font-bold text-primary underline cursor-pointer bg-primary/10 px-2 py-0.5 rounded w-max">
                              {fetchingDocId === row.doc ? 'Caricamento...' : `Apri Doc. ${row.doc}`}
                            </span>
                          )}
                        </div>
                        <span className={`text-lg font-black font-mono px-3 py-1.5 rounded-lg border ${row.colorClass} border-current/20`}>
                          {row.qta > 0 && row.id !== 'GIAC-INIZ' ? '+' : ''}{row.qta.toLocaleString('it-IT')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0">
            <span className="text-sm font-medium text-muted-foreground hidden sm:block">
              Righe movimenti: <strong className="text-foreground">{timeline.length}</strong>
            </span>
            <button onClick={onClose} className="w-full sm:w-auto px-8 py-3 sm:py-2.5 rounded-lg border border-input font-bold text-muted-foreground hover:bg-secondary transition-colors shadow-sm">
              Chiudi
            </button>
          </div>

        </div>
      </div>

      {viewDocument && (
        <div className="fixed inset-0 z-[400]">
          <DocumentDetail document={viewDocument} onClose={() => setViewDocument(null)} onEdit={() => {}} onToggle={() => {}} />
        </div>
      )}
    </>
  );
}