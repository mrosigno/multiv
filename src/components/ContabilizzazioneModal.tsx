import { useState, useEffect } from 'react';
import { X, CheckCircle, Wallet, FastForward, StopCircle, Receipt } from 'lucide-react';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';
import { API_HOST } from '@/config';

export default function ContabilizzazioneModal({ doc, tipoDoc, cliente, modPag, onClose, onSuccess, massInfo }: any) {
  const { data: causaliData =[] } = useCausali();
  const { data: tipologieData =[] } = useTipologieMovimento();
  const { data: mezziData = [] } = useMezziPagamento();

  const [loading, setLoading] = useState(false);
  const [confirmImmediate, setConfirmImmediate] = useState(false);

  const totaleDoc = Number(doc.impondoc || 0) + Number(doc.ivadoc || 0) + Number(doc.arrot || 0);
  const isDare = tipoDoc.da === '+';

  const [pnForm, setPnForm] = useState({
    Categoria: Number(tipoDoc.idmastro) || 0,
    TipoMovimento: Number(tipoDoc.idmovpnota) || 0,
    descrizione: `${tipoDoc.descrizione} n. ${doc.Num} del ${doc.datafatt.split('-').reverse().join('/')}`
  });

  const [scadForm, setScadForm] = useState({
    Categoria: Number(tipoDoc.idmastro) || 0,
    TipoMovimento: Number(tipoDoc.idmovscad) || 0,
    mezzopag: Number(modPag?.riba) || 1
  });

  const [nRate, setNRate] = useState(Number(modPag?.nrate) || 1);
  const [giorni, setGiorni] = useState(Number(modPag?.t) || 0);
  const [fineMese, setFineMese] = useState(Number(modPag?.lock) === -1);
  const [rate, setRate] = useState<any[]>([]);

  useEffect(() => {
    const rateCount = nRate > 0 ? nRate : 1;
    const importoRata = Math.round((totaleDoc / rateCount) * 100) / 100;
    let diff = Math.round((totaleDoc - (importoRata * rateCount)) * 100) / 100;

    const nuoveRate =[];
    let baseDate = new Date(doc.datafatt);

    for (let i = 1; i <= rateCount; i++) {
      let d = new Date(baseDate);
      d.setDate(d.getDate() + (giorni * i));
      
      if (fineMese) {
        d = new Date(d.getFullYear(), d.getMonth() + 1, 0); 
      }

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');

      nuoveRate.push({
        data: `${yyyy}-${mm}-${dd}`,
        importo: i === rateCount ? importoRata + diff : importoRata 
      });
    }
    setRate(nuoveRate);
  },[nRate, giorni, fineMese, doc.datafatt, totaleDoc]);


  const handleContabilizzaClick = () => {
    if (rate.length === 1 && giorni === 0) setConfirmImmediate(true);
    else executeContabilizzazione(false);
  };

  const executeContabilizzazione = async (isPagamentoImmediato: boolean) => {
    setConfirmImmediate(false);
    const primaNotaRecords = [];
    const scadenzarioRecords =[];

    primaNotaRecords.push({
      data: doc.datafatt, descrizione: pnForm.descrizione, IdCliente: doc.IDCliente,
      Categoria: pnForm.Categoria, TipoMovimento: pnForm.TipoMovimento, mezzopag: scadForm.mezzopag,
      'C-R': 'C', Dare: isDare ? totaleDoc : 0, Avere: isDare ? 0 : totaleDoc,
      imponibile: doc.impondoc, iva: doc.ivadoc, numdoc: doc.Num.toString(),
      rifinterno: doc.ID.toString(), IdFattura: doc.ID, chiuso: 0, datachiusura: null
    });

    rate.forEach((r, index) => {
      const recordPagamento = {
        data: r.data, descrizione: `Scadenza ${index + 1}/${rate.length} - ${pnForm.descrizione}`,
        IdCliente: doc.IDCliente, Categoria: scadForm.Categoria, TipoMovimento: scadForm.TipoMovimento,
        mezzopag: scadForm.mezzopag, 'C-R': 'C', Dare: isDare ? 0 : r.importo, Avere: isDare ? r.importo : 0,
        imponibile: doc.impondoc, iva: doc.ivadoc, numdoc: doc.Num.toString(), rifinterno: doc.ID.toString(),
        IdFattura: doc.ID, chiuso: isPagamentoImmediato ? -1 : 0, datachiusura: isPagamentoImmediato ? r.data : null
      };
      if (isPagamentoImmediato) primaNotaRecords.push({ ...recordPagamento, descrizione: `Pagamento - ${pnForm.descrizione}` });
      else scadenzarioRecords.push(recordPagamento);
    });

    setLoading(true);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=contabilizza_documento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docId: doc.ID, primaNota: primaNotaRecords, scadenzario: scadenzarioRecords })
      });
      const result = await res.json();
      if (result.success) onSuccess();
      else alert("Errore: " + result.message);
    } catch (e) { alert("Errore di connessione"); } 
    finally { setLoading(false); }
  };

  const inputClass = "w-full px-2 py-1.5 rounded border border-input bg-background text-sm font-semibold focus:ring-2 focus:ring-blue-500/50 text-blue-700";
  const labelClass = "block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5";

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      
      {/* Contenitore dinamico per max visibilità su Mobile */}
      <div className="bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col border border-border sm:border-blue-500/30 overflow-hidden h-[90dvh] sm:h-auto sm:max-h-[95vh]">
        
        {/* HEADER COMPATTO */}
        <div className="bg-blue-600/10 px-4 py-3 border-b border-blue-600/20 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-black text-blue-600 uppercase tracking-wider">Contabilizza</h2>
            </div>
            {massInfo && <p className="text-[10px] font-bold text-blue-800 uppercase mt-0.5">MASSIVO: Doc {massInfo.current} di {massInfo.total}</p>}
          </div>
          {!massInfo && (
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* SUB-HEADER DATI DOCUMENTO (Sottile) */}
        <div className="bg-background px-4 py-2 border-b border-border flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-4 shrink-0 shadow-sm z-10">
          <span className="text-xs font-bold text-primary truncate" title={cliente?.Ragione_Sociale || cliente?.['Ragione Sociale']}>
            {cliente?.Ragione_Sociale || cliente?.['Ragione Sociale'] || 'Cliente Sconosciuto'}
          </span>
          <span className="text-[11px] font-medium text-muted-foreground whitespace-nowrap">
            {tipoDoc.descrizione} <strong className="text-foreground">#{doc.Num}</strong> del <strong className="text-foreground">{doc.datafatt.split('-').reverse().join('/')}</strong>
          </span>
        </div>

        {/* CORPO MODALE */}
		    <div className="p-3 sm:p-5 space-y-3 sm:space-y-4 overflow-y-auto flex-1 custom-scrollbar bg-secondary/5 min-h-0">
          
          {/* SEZIONE 1: PRIMA NOTA */}
          <div className="bg-background p-3 rounded-xl border border-border shadow-sm">
            <h3 className="text-xs font-bold text-primary mb-2 border-b border-border pb-1">Prima Nota</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              <div>
                <label className={labelClass}>Causale Contab./Mastro</label>
                <select value={pnForm.Categoria} onChange={e => setPnForm({...pnForm, Categoria: +e.target.value})} className={inputClass}>
                  {causaliData.map((c:any) => <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Tipo Movimento/Mastrino</label>
                <select value={pnForm.TipoMovimento} onChange={e => setPnForm({...pnForm, TipoMovimento: +e.target.value})} className={inputClass}>
                  {tipologieData.filter((t:any) => Number(t.idcausale) === pnForm.Categoria).map((t:any) => <option key={t.id} value={t.id}>{t.codice} - {t.Descrizione}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className={labelClass}>Descrizione Registrazione</label>
              <input type="text" value={pnForm.descrizione} onChange={e => setPnForm({...pnForm, descrizione: e.target.value})} className={inputClass} />
            </div>
          </div>

          {/* SEZIONE 2: SCADENZE E PAGAMENTO */}
          <div className="bg-background p-3 rounded-xl border border-border shadow-sm">
            <h3 className="text-xs font-bold text-primary mb-2 border-b border-border pb-1">Dati Scadenzario</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              <div>
                <label className={labelClass}>Mastro Scadenzario</label>
                <select value={scadForm.Categoria} onChange={e => setScadForm({...scadForm, Categoria: +e.target.value})} className={inputClass}>
                  {causaliData.map((c:any) => <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Mastrino Scadenzario</label>
                <select value={scadForm.TipoMovimento} onChange={e => setScadForm({...scadForm, TipoMovimento: +e.target.value})} className={inputClass}>
                  {tipologieData.filter((t:any) => Number(t.idcausale) === scadForm.Categoria).map((t:any) => <option key={t.id} value={t.id}>{t.codice} - {t.Descrizione}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Condizione (Anagrafica)</label>
                <input type="text" value={modPag?.Mod || ''} disabled className="w-full px-2 py-1.5 rounded border border-input bg-secondary/50 text-sm font-semibold text-muted-foreground" />
              </div>
              <div>
                <label className={labelClass}>Mezzo Pagamento (Riba, Bonifico...)</label>
                <select value={scadForm.mezzopag} onChange={e => setScadForm({...scadForm, mezzopag: +e.target.value})} className={inputClass}>
                  {mezziData.map((m:any) => <option key={m.id} value={m.id}>{m.descrizione}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* SEZIONE 3: RATE */}
          <div className="bg-background p-3 rounded-xl border border-border shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 border-b border-border pb-2 gap-2">
              <h3 className="text-xs font-bold text-primary">Generazione Rate</h3>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground">N° Rate:</label>
                  <input type="number" min="1" max="24" value={nRate} onChange={e => setNRate(+e.target.value)} className="w-12 px-1 py-1 border border-input rounded text-center font-bold text-primary text-xs" />
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-bold text-muted-foreground">Giorni:</label>
                  <input type="number" step="30" value={giorni} onChange={e => setGiorni(+e.target.value)} className="w-12 px-1 py-1 border border-input rounded text-center text-xs" />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-foreground cursor-pointer">
                  <input type="checkbox" checked={fineMese} onChange={e => setFineMese(e.target.checked)} className="w-3.5 h-3.5 rounded text-primary border-input" />
                  Fine Mese
                </label>
              </div>
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {rate.map((r, i) => (
                <div key={i} className="bg-secondary/20 p-2 rounded-lg border border-border text-center">
                  <div className="text-[9px] font-bold text-muted-foreground mb-1">RATA {i+1}</div>
                  <input type="date" value={r.data} onChange={(e) => {
                    const newRate = [...rate]; newRate[i].data = e.target.value; setRate(newRate);
                  }} className="w-full text-[11px] p-1 border border-input rounded mb-1 text-center bg-white" />
                  <input type="number" step="0.01" value={r.importo} onChange={(e) => {
                    const newRate = [...rate]; newRate[i].importo = +e.target.value; setRate(newRate);
                  }} className="w-full text-xs font-mono font-bold text-primary p-1 border border-input rounded text-center bg-white" />
                </div>
              ))}
            </div>
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
              
              <button onClick={handleContabilizzaClick} disabled={loading} className="flex-[1.5] sm:flex-[2] flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1.5 px-2 py-2 sm:py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm">
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-[11px] sm:text-sm font-black uppercase tracking-wider">{loading ? '...' : 'Conferma'}</span>
              </button>
            </div>
          ) : (
            <div className="flex w-full gap-3">
              <button onClick={onClose} disabled={loading} className="flex-1 px-4 py-2.5 rounded-xl border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
                Annulla
              </button>
              <button onClick={handleContabilizzaClick} disabled={loading} className="flex-[2] flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-black hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-sm">
                <CheckCircle className="w-5 h-5" /> {loading ? '...' : 'CONTABILIZZA'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODALE SCELTA PAGAMENTO IMMEDIATO (z-index maggiore e bottoni affiancati) */}
      {confirmImmediate && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[350] flex items-center justify-center p-4 animate-fade-in" onClick={() => setConfirmImmediate(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden border border-border">
            <div className="p-5 flex flex-col items-center text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Wallet className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-2">Pagamento Immediato</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Le condizioni di pagamento prevedono 1 rata a 0 giorni.<br/><br/>
                Vuoi registrare l'incasso in <strong>Prima Nota</strong> chiudendo la scadenza, o mantenerlo aperto nello <strong>Scadenzario</strong>?
              </p>
            </div>
            
            <div className="bg-secondary/30 p-3 border-t border-border flex flex-col gap-2">
              <div className="flex gap-2 w-full">
                <button onClick={() => executeContabilizzazione(false)} className="flex-1 px-2 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/80 transition-colors border border-border">
                  Scadenzario
                </button>
                <button onClick={() => executeContabilizzazione(true)} className="flex-1 px-2 py-2 rounded-lg bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                  Prima Nota
                </button>
              </div>
              <button onClick={() => setConfirmImmediate(false)} className="w-full px-4 py-2 rounded-lg border border-transparent text-xs font-bold text-muted-foreground hover:bg-secondary transition-colors underline underline-offset-2">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}