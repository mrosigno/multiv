import { useState } from 'react';
import { X, PackageCheck, FastForward, StopCircle } from 'lucide-react';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { API_HOST } from '@/config';

export default function MovimentazioneMagazzinoModal({ doc, tipoDoc, righe, cliente, onClose, onSuccess, massInfo }: any) {
  const { data: magazziniData =[], isLoading } = useMagazzini();
  const [loading, setLoading] = useState(false);

  const tipoMov = tipoDoc.movmagaz; 
  const [magin, setMagin] = useState(tipoMov === 'C' ? doc.codmag : 1);
  const [magout, setMagout] = useState(tipoMov === 'S' || tipoMov === 'T' ? doc.codmag : 1);

  const handleMovimenta = async () => {
    if (tipoMov === 'T' && magin === magout) {
      alert("Il magazzino di carico e scarico devono essere diversi per un trasferimento.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        docId: doc.ID,
        tipoMov: tipoMov,
        magin: magin,
        magout: magout,
        righe: righe,
        docData: {
          data: doc.datafatt,
          num: doc.Num,
          tipoDesc: tipoDoc.descrizione,
          idCliente: doc.IDCliente
        }
      };

      const res = await fetch(`${API_HOST}/api.php?action=movimenta_magazzino`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (result.success) {
        onSuccess();
      } else {
        alert("Errore: " + result.message);
      }
    } catch (e) {
      alert("Errore di connessione al server");
    } finally {
      setLoading(false);
    }
  };

  const selectClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-amber-500/50 font-bold text-amber-700";
  const labelClass = "block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1";

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      
      {/* Contenitore dinamico per max visibilità su Mobile */}
      <div className="bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-border sm:border-amber-500/30 overflow-hidden h-[85dvh] sm:h-auto sm:max-h-[90vh]">

        {/* HEADER */}
        <div className="bg-amber-500/10 px-4 py-3 border-b border-amber-500/20 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-amber-600" />
              <h2 className="text-base font-black text-amber-600 uppercase tracking-wider">Movimenta</h2>
            </div>
            {massInfo && <p className="text-[10px] font-bold text-amber-800 uppercase mt-0.5">MASSIVO: Doc {massInfo.current} di {massInfo.total}</p>}
          </div>
          {!massInfo && (
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* CORPO MODALE */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 custom-scrollbar bg-secondary/5 min-h-0">
          
          <div className="bg-background p-3 rounded-xl border border-border shadow-sm">
            <span className="block text-[10px] text-muted-foreground uppercase font-bold mb-0.5">Riepilogo</span>
            <span className="font-bold text-sm block">{tipoDoc.descrizione} n. {doc.Num}</span>
            <span className="text-xs text-primary font-medium mt-0.5 block truncate" title={cliente?.Ragione_Sociale || cliente?.['Ragione Sociale']}>
              {cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || 'Cliente Sconosciuto'}
            </span>
          </div>

          <div className="space-y-3">
            {(tipoMov === 'S' || tipoMov === 'T') && (
              <div>
                <label className={labelClass}>Magazzino di Scarico</label>
                <select value={magout} onChange={e => setMagout(+e.target.value)} className={selectClass}>
                  {isLoading && <option>Caricamento...</option>}
                  {magazziniData.filter((m:any) => m.attivo).map((m:any) => (
                    <option key={m.cod} value={m.cod}>{m.Descrizione}</option>
                  ))}
                </select>
              </div>
            )}

            {(tipoMov === 'C' || tipoMov === 'T') && (
              <div>
                <label className={labelClass}>Magazzino di Carico</label>
                <select value={magin} onChange={e => setMagin(+e.target.value)} className={selectClass}>
                  {isLoading && <option>Caricamento...</option>}
                  {magazziniData.filter((m:any) => m.attivo).map((m:any) => (
                    <option key={m.cod} value={m.cod}>{m.Descrizione}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="bg-amber-50 text-[11px] text-amber-800 p-2.5 rounded-lg border border-amber-200/50 text-center leading-tight">
            Le righe puramente descrittive (senza codice articolo) saranno automaticamente ignorate.
          </div>
        </div>

        {/* FOOTER ULTRA-COMPATTO MASSIVO */}
        <div className="bg-card p-2 sm:p-4 border-t border-border flex justify-between items-center gap-2 shrink-0 pb-safe">
          {massInfo ? (
            <div className="flex w-full gap-2">
              <button onClick={massInfo.onAbort} disabled={loading} className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 py-2 sm:py-2.5 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
                <StopCircle className="w-4 h-4 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Stop</span>
              </button>
              
              <button onClick={massInfo.onSkip} disabled={loading} className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-1 py-2 sm:py-2.5 rounded-xl border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50">
                <FastForward className="w-4 h-4 sm:w-4 sm:h-4" />
                <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider">Salta</span>
              </button>
              
              <button onClick={handleMovimenta} disabled={loading} className="flex-[1.5] sm:flex-[2] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 py-2 sm:py-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm">
                <PackageCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[11px] sm:text-sm font-black uppercase tracking-wider">{loading ? '...' : 'Conferma'}</span>
              </button>
            </div>
          ) : (
            <div className="flex w-full gap-3">
              <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
                Annulla
              </button>
              <button onClick={handleMovimenta} disabled={loading} className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-black hover:bg-amber-600 transition-colors disabled:opacity-50 shadow-sm">
                <PackageCheck className="w-5 h-5" /> {loading ? '...' : 'MOVIMENTA'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}