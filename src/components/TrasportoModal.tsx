import { useState, useEffect } from 'react';
import { X, Truck, MapPin, Trash2, CheckCircle2, Package, Plus, Save } from 'lucide-react';
import { API_HOST } from '@/config';
import ConfirmDialog from '@/components/ConfirmDialog';

interface Props {
  doc: any;
  cliente: any;
  onClose: () => void;
  onConfirm: (transportData: any) => void; 
}

const portoOptions = ['FRANCO', 'DESTINATARIO', 'FRANCO CON ADDEBITO'];
const aspettoOptions = ['A VISTA', 'SCATOLA', 'CARTONE', 'SACCO', 'BANCALE', 'PALLET', 'SFUSO'];

const TrasportoModal = ({ doc, cliente, onClose, onConfirm }: Props) => {
  const [loading, setLoading] = useState(true);
  const [proceeding, setProceeding] = useState(false);
  
  const [ddtForm, setDdtForm] = useState({
    Idcliente: doc.IDCliente, 
    porto: 'FRANCO',
    causale: 'VENDITA',
    Destinazione1: '',
    Destinazione2: '',
    Destinazione3: '',
    vettore: 'MITTENTE',
    aspetto: 'A VISTA',
    rif_interno: ''
  });

  const [volatili, setVolatili] = useState({
    colli: '1',
    peso: '',
    dataRitiro: new Date().toISOString().split('T')[0],
    oraRitiro: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    firma: '',
    noteExtra: ''
  });

  const [destinazioniList, setDestinazioniList] = useState<any[]>([]);
  const [vettoriList, setVettoriList] = useState<any[]>([]);
  const [causaliList, setCausaliList] = useState<any[]>([]);

  const [subModal, setSubModal] = useState<'destinazioni' | 'vettori' | 'causali' | null>(null);
  const [newItemDesc, setNewItemDesc] = useState('');
  const [newDestinazione, setNewDestinazione] = useState({ d1: '', d2: '', d3: '' });
  
  const [feedback, setFeedback] = useState<{
    isOpen: boolean; type: any; title: string; msg: string; confirmLabel?: string; onConfirm?: () => void;
  }>({ isOpen: false, type: 'info', title: '', msg: '' });

  const loadAllArchivi = async () => {
    try {
      const [resDest, resVet, resCaus] = await Promise.all([
        fetch(`${API_HOST}/api.php?action=get_destinazioni&idcliente=${doc.IDCliente}`).then(r => r.json()).catch(() => []),
        fetch(`${API_HOST}/api.php?action=get_vettori`).then(r => r.json()).catch(() => []),
        fetch(`${API_HOST}/api.php?action=get_causali_trasporto`).then(r => r.json()).catch(() => [])
      ]);
      
      setDestinazioniList(Array.isArray(resDest) ? resDest : []);
      setVettoriList(Array.isArray(resVet) ? resVet : []);
      setCausaliList(Array.isArray(resCaus) ? resCaus : []);
    } catch (e) {
      console.error("Errore fetch archivi", e);
    }
  };

  useEffect(() => {
    fetch(`${API_HOST}/api.php?action=get_ddt&idcliente=${doc.IDCliente}`)
      .then(res => res.json())
      .then(data => {
        if (data && data.Idcliente) {
          setDdtForm(prev => ({
            ...prev,
            ...data,
            porto: data.porto || 'FRANCO',
            causale: data.causale || 'VENDITA',
            Destinazione1: data.Destinazione1 || '',
            Destinazione2: data.Destinazione2 || '',
            Destinazione3: data.Destinazione3 || '',
            vettore: data.vettore || 'MITTENTE',
            aspetto: data.aspetto || 'A VISTA',
            rif_interno: data.rif_interno || ''
          }));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));

    loadAllArchivi();
  }, [doc.IDCliente]);

  const openSubModal = (type: 'destinazioni' | 'vettori' | 'causali') => {
    setSubModal(type);
    setNewItemDesc('');
    setNewDestinazione({ d1: '', d2: '', d3: '' });
  };

  const handleAddItem = async () => {
    if (!newItemDesc.trim()) return;
    let url = subModal === 'vettori' ? 'save_vettore' : 'save_causale_trasporto';
    await fetch(`${API_HOST}/api.php?action=${url}`, {
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ descrizione: newItemDesc })
    });
    setNewItemDesc('');
    await loadAllArchivi(); 
    setFeedback({ isOpen: true, type: 'success-auto', title: 'Archivio Aggiornato', msg: 'La voce è stata aggiunta con successo.' });
  };

  const saveCurrentDestinazioneToArchive = async () => {
    if (!(ddtForm.Destinazione1 || '').trim()) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Dati Incompleti', msg: 'Scrivi almeno la prima riga della destinazione per poterla salvare in archivio.' });
      return;
    }
    await fetch(`${API_HOST}/api.php?action=save_destinazione`, { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        idcliente: doc.IDCliente, 
        destinazione1: ddtForm.Destinazione1, 
        destinazione2: ddtForm.Destinazione2, 
        destinazione3: ddtForm.Destinazione3 
      }) 
    });
    await loadAllArchivi();
    setFeedback({ isOpen: true, type: 'success-auto', title: 'Destinazione Salvata', msg: 'Nuova destinazione archiviata per usi futuri.' });
  };

  const requestDelete = (item: any) => {
    const isDestinazione = subModal === 'destinazioni';
    const nomeVoce = isDestinazione ? item.destinazione1 : (item.descrizione || item.Descrizione || item.Decrizione);
    const payload = isDestinazione ? { id: item.id || item.Id || item.ID } : { descrizione: item.descrizione || item.Descrizione || item.Decrizione };

    setFeedback({
      isOpen: true, type: 'danger', title: 'Conferma Eliminazione',
      msg: `Sei sicuro di voler eliminare definitivamente "${nomeVoce}" dall'archivio?`,
      confirmLabel: 'Sì, Elimina',
      onConfirm: async () => {
        setFeedback(p => ({ ...p, isOpen: false }));
        let url = isDestinazione ? 'delete_destinazione' : subModal === 'vettori' ? 'delete_vettore' : 'delete_causale_trasporto';
        await fetch(`${API_HOST}/api.php?action=${url}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        await loadAllArchivi();
      }
    });
  };

  const triggerProceed = async () => {
    if (proceeding) return;
    setProceeding(true);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=save_ddt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...ddtForm, Idcliente: doc.IDCliente })
      });
      const rawText = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(rawText);
      } catch {
        data = null;
      }

      if (!res.ok || (data && data.success === false)) {
        const msg = (data && data.message) ? String(data.message) : (rawText || `Errore salvataggio dati trasporto (HTTP ${res.status})`);
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg });
        return;
      }

      const payloadCompleto = { ...ddtForm, ...volatili };
      onConfirm(payloadCompleto);
    } catch (e: any) {
      setFeedback({
        isOpen: true,
        type: 'danger',
        title: 'Errore',
        msg: e?.message ? String(e.message) : 'Errore imprevisto durante il salvataggio dei dati di trasporto.'
      });
    } finally {
      setProceeding(false);
    }
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:ring-2 focus:ring-primary/50 outline-none transition-all";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  if (loading) return null;

  const currentSubList = subModal === 'destinazioni' ? destinazioniList : subModal === 'vettori' ? vettoriList : causaliList;

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[250] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      
      {/* SOTTO-MODALE ARCHIVI */}
      {subModal && (
        <div className="fixed inset-0 z-[260] bg-black/40 flex items-center justify-center p-4" onClick={() => setSubModal(null)}>
          <div className="bg-card w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] animate-fade-in border border-border" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border bg-secondary/30 flex justify-between items-center">
              <h3 className="font-bold text-lg uppercase tracking-wider">Archivio {subModal}</h3>
              <button onClick={() => setSubModal(null)} className="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              
              {subModal !== 'destinazioni' && (
                <div className="flex gap-2 mb-4 bg-secondary/20 p-3 rounded-xl border border-border">
                  <input type="text" placeholder={`Inserisci nuova voce...`} value={newItemDesc} onChange={e => setNewItemDesc(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddItem()} className={inputClass} />
                  <button onClick={handleAddItem} className="px-4 py-2 bg-primary text-white font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm">
                    <Plus className="w-5 h-5"/>
                  </button>
                </div>
              )}

              <div className="space-y-2">
                {currentSubList.map((item: any, idx: number) => {
                  const itemKey = subModal === 'destinazioni' ? (item.id || item.Id || item.ID) : (item.descrizione || item.Descrizione || item.Decrizione || idx);
                  const itemDesc = item.descrizione || item.Descrizione || item.Decrizione;

                  return (
                    <div key={itemKey} className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-secondary/40 group transition-colors cursor-pointer"
                        onDoubleClick={() => {
                          if (subModal === 'destinazioni') {
                            setDdtForm(p => ({ ...p, Destinazione1: item.destinazione1 || '', Destinazione2: item.destinazione2 || '', Destinazione3: item.destinazione3 || '' }));
                          } else if (subModal === 'vettori') {
                            setDdtForm(p => ({ ...p, vettore: itemDesc || '' }));
                          } else {
                            setDdtForm(p => ({ ...p, causale: itemDesc || '' }));
                          }
                          setSubModal(null);
                          setFeedback({ isOpen: true, type: 'success-auto', title: 'Selezionato', msg: 'La voce è stata applicata al documento.' });
                        }} title="Doppio clic per selezionare e applicare">
                      <div className="flex-1">
                        {subModal === 'destinazioni' ? (
                          <div className="text-sm font-medium"><span className="text-primary font-bold">{item.destinazione1}</span> {item.destinazione2 ? `- ${item.destinazione2}` : ''} {item.destinazione3 ? `- ${item.destinazione3}` : ''}</div>
                        ) : (
                          <span className="text-sm font-bold">{itemDesc}</span>
                        )}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); requestDelete(item); }} className="p-1.5 text-destructive/40 hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-0 group-hover:opacity-100" title="Elimina voce">
                        <Trash2 className="w-4 h-4"/>
                      </button>
                    </div>
                  );
                })}
                {currentSubList.length === 0 && <div className="text-center text-muted-foreground p-8 border border-dashed border-border rounded-xl">Nessun dato in archivio.</div>}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODALE PRINCIPALE TRASPORTO */}
      <div className="bg-card w-full max-w-4xl sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh] border border-border">
        
        <div className="bg-slate-800 text-white px-6 py-4 flex justify-between items-center sm:rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg"><Truck className="w-6 h-6 text-white" /></div>
            <div>
              <h2 className="text-xl font-bold tracking-wide">Dati Spedizione e Trasporto</h2>
              <p className="text-slate-300 text-xs font-medium">DOCUMENTO N. {doc.Num} DEL {doc.datafatt.split('-').reverse().join('/')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-6 h-6"/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl">
              <h4 className="text-[10px] font-black text-blue-500 uppercase tracking-wider mb-2">Cliente Intestatario</h4>
              <p className="font-bold text-blue-900 text-lg">{cliente.Ragione_Sociale}</p>
              <p className="text-sm text-blue-800/80 mt-1">{cliente.Indirizzo}</p>
              <p className="text-sm text-blue-800/80">{cliente.CAP} - {cliente.Comune} ({cliente.Prov})</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl relative group">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Destinazione Merce</h4>
                <button onClick={() => openSubModal('destinazioni')} className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-800 text-xs font-bold rounded-md transition-colors flex items-center gap-1 shadow-sm">
                  <MapPin className="w-3 h-3" /> Archivio...
                </button>
              </div>
              <div className="space-y-2">
                <input type="text" className="w-full bg-white border border-amber-200 rounded px-2 py-1.5 text-sm font-bold text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500" value={ddtForm.Destinazione1 || ''} onChange={e => setDdtForm(p => ({ ...p, Destinazione1: e.target.value }))} placeholder="Riga 1 (obbligatoria se vuoi salvare)..." />
                <input type="text" className="w-full bg-white border border-amber-200 rounded px-2 py-1.5 text-sm text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500" value={ddtForm.Destinazione2 || ''} onChange={e => setDdtForm(p => ({ ...p, Destinazione2: e.target.value }))} placeholder="Riga 2..." />
                <input type="text" className="w-full bg-white border border-amber-200 rounded px-2 py-1.5 text-sm text-amber-900 focus:outline-none focus:ring-1 focus:ring-amber-500" value={ddtForm.Destinazione3 || ''} onChange={e => setDdtForm(p => ({ ...p, Destinazione3: e.target.value }))} placeholder="Riga 3..." />
                
                {(ddtForm.Destinazione1 || '').trim() !== '' && (
                  <button onClick={saveCurrentDestinazioneToArchive} className="mt-2 w-full py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded text-xs font-bold transition-colors flex items-center justify-center gap-1">
                    <Save className="w-3.5 h-3.5" /> Salva in Archivio per il futuro
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-secondary/20 p-5 rounded-xl border border-border grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className={labelClass}>Causale</label>
                <button onClick={() => openSubModal('causali')} className="text-[10px] bg-secondary border border-border px-1.5 py-0.5 rounded hover:bg-primary hover:text-white transition-colors">Gestisci...</button>
              </div>
              <select value={ddtForm.causale || ''} onChange={e => setDdtForm(p => ({...p, causale: e.target.value}))} className={`${inputClass} font-bold text-primary cursor-pointer`}>
                {ddtForm.causale && !causaliList.some(c => (c.Descrizione || c.descrizione || c.Decrizione) === ddtForm.causale) && (
                  <option value={ddtForm.causale}>{ddtForm.causale}</option>
                )}
                {causaliList.map((c, i) => {
                  const desc = c.Descrizione || c.descrizione || c.Decrizione;
                  return <option key={`caus-${i}`} value={desc}>{desc}</option>;
                })}
              </select>
            </div>

            <div>
              <label className={labelClass}>Porto</label>
              <select value={ddtForm.porto || ''} onChange={e => setDdtForm(p => ({...p, porto: e.target.value}))} className={`${inputClass} font-bold cursor-pointer`}>
                {portoOptions.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-end mb-1.5">
                <label className={labelClass}>Vettore / A Cura Di</label>
                <button onClick={() => openSubModal('vettori')} className="text-[10px] bg-secondary border border-border px-1.5 py-0.5 rounded hover:bg-primary hover:text-white transition-colors">Gestisci...</button>
              </div>
              <select value={ddtForm.vettore || ''} onChange={e => setDdtForm(p => ({...p, vettore: e.target.value}))} className={`${inputClass} font-bold cursor-pointer`}>
                {ddtForm.vettore && !vettoriList.some(v => (v.Descrizione || v.descrizione || v.Decrizione) === ddtForm.vettore) && (
                  <option value={ddtForm.vettore}>{ddtForm.vettore}</option>
                )}
                {vettoriList.map((v, i) => {
                  const desc = v.Descrizione || v.descrizione || v.Decrizione;
                  return <option key={`vet-${i}`} value={desc}>{desc}</option>;
                })}
              </select>
            </div>
          </div>

          <div className="border-2 border-red-200/50 bg-red-50/30 rounded-xl p-5">
            <h4 className="text-xs font-black text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2"><Package className="w-4 h-4"/> Dettagli della singola spedizione (Non salvati in anagrafica)</h4>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className={labelClass}>Aspetto Beni</label>
                <select value={ddtForm.aspetto || ''} onChange={e => setDdtForm(p => ({...p, aspetto: e.target.value}))} className={`${inputClass} cursor-pointer`}>
                  {aspettoOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Num. Colli</label>
                <input type="number" value={volatili.colli} onChange={e => setVolatili(p => ({...p, colli: e.target.value}))} className={`${inputClass} text-center font-bold`} />
              </div>
              <div>
                <label className={labelClass}>Peso (Kg)</label>
                <input type="text" value={volatili.peso} onChange={e => setVolatili(p => ({...p, peso: e.target.value}))} className={`${inputClass} text-center`} />
              </div>
              <div>
                <label className={labelClass}>Data Ritiro</label>
                <input type="date" value={volatili.dataRitiro} onChange={e => setVolatili(p => ({...p, dataRitiro: e.target.value}))} className={`${inputClass} cursor-pointer`} />
              </div>
              <div>
                <label className={labelClass}>Ora Ritiro</label>
                <input type="time" value={volatili.oraRitiro} onChange={e => setVolatili(p => ({...p, oraRitiro: e.target.value}))} className={`${inputClass} cursor-pointer`} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Firma Auto / Nominativo</label>
                <input type="text" value={volatili.firma} onChange={e => setVolatili(p => ({...p, firma: e.target.value}))} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Note Extra (Solo Stampa)</label>
                <input type="text" value={volatili.noteExtra} onChange={e => setVolatili(p => ({...p, noteExtra: e.target.value}))} className={inputClass} />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Note / Riferimenti Interni Fissi</label>
            <textarea value={ddtForm.rif_interno || ''} onChange={e => setDdtForm(p => ({...p, rif_interno: e.target.value}))} rows={2} className={`${inputClass} text-blue-700 font-bold resize-none`} placeholder="Testo libero fisso per questo cliente..." />
          </div>

        </div>

        <div className="p-4 sm:px-6 sm:py-4 border-t border-border bg-card sm:rounded-b-2xl flex flex-col-reverse sm:flex-row justify-end gap-3 shrink-0">
          <button onClick={onClose} disabled={proceeding} className="px-5 py-2.5 rounded-lg border border-input text-muted-foreground font-bold hover:bg-secondary transition-colors w-full sm:w-auto disabled:opacity-50">
            Annulla Stampa
          </button>
          <button onClick={triggerProceed} disabled={proceeding} className="px-8 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-md flex items-center justify-center gap-2 w-full sm:w-auto disabled:opacity-50">
            <CheckCircle2 className="w-5 h-5" /> {proceeding ? 'Generazione...' : 'Procedi alla Generazione'}
          </button>
        </div>

      </div>

      <ConfirmDialog 
        isOpen={feedback.isOpen} 
        title={feedback.title} 
        type={feedback.type} 
        message={<div className="whitespace-pre-line">{feedback.msg}</div>} 
        confirmLabel={feedback.confirmLabel}
        onClose={() => setFeedback(p => ({ ...p, isOpen: false }))} 
        onConfirm={() => {
          if (feedback.onConfirm) feedback.onConfirm();
          else setFeedback(p => ({ ...p, isOpen: false }));
        }} 
      />
    </div>
  );
}

export default TrasportoModal;
