import { useState, useEffect } from 'react';
import { X, Mail, Plus, Pencil, Trash2, Save, Info } from 'lucide-react';
import { API_HOST } from '@/config';
import ConfirmDialog from './ConfirmDialog';

const areeMap: Record<number, string> = { 1: 'Documenti', 2: 'Contabilità', 3: 'Magazzino', 4: 'Altro' };

export default function ComunicazioniModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  
  const [feedback, setFeedback] = useState<{isOpen: boolean, type: any, title: string, msg: string, onConfirm?: () => void}>({ isOpen: false, type: 'info', title: '', msg: '' });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_HOST}/api.php?action=get_comunicazioni`);
      setList(await res.json());
    } catch(e) {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_HOST}/api.php?action=save_comunicazione`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing)
    });
    setEditing(null);
    loadData();
    setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvato', msg: 'Modello email salvato con successo.' });
  };

  const handleDelete = (item: any) => {
    setFeedback({
      isOpen: true, type: 'danger', title: 'Elimina', msg: `Vuoi eliminare il modello "${item.descrizione}"?`,
      onConfirm: async () => {
        setFeedback(p => ({...p, isOpen: false}));
        await fetch(`${API_HOST}/api.php?action=delete_comunicazione`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id }) });
        loadData();
      }
    });
  };

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* FIX: h-[100dvh] per smartphone, bordo arrotondato solo sopra */}
      <div className="bg-card w-full max-w-4xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-hidden border border-border">
        
        <div className="px-6 py-4 border-b border-border bg-slate-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            <h2 className="text-lg sm:text-xl font-bold truncate">Modelli Comunicazioni Email</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors shrink-0"><X className="w-5 h-5"/></button>
        </div>

        {/* FIX: min-h-0 e flex-1 per scorrimento */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 custom-scrollbar bg-slate-50 min-h-0">
          {!editing ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                <h3 className="font-bold text-foreground">Elenco Modelli Attivi</h3>
                <button onClick={() => setEditing({ area: 1, descrizione: '', oggetto: '', testo: '' })} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-bold text-sm hover:opacity-90 shadow-sm">
                  <Plus className="w-4 h-4"/> Nuovo Modello
                </button>
              </div>

              {/* DESKTOP TABLE */}
              <div className="hidden md:block bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                    <tr><th className="px-4 py-3">Area</th><th className="px-4 py-3">Descrizione</th><th className="px-4 py-3">Oggetto Mail</th><th className="px-4 py-3 text-center">Azioni</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? <tr><td colSpan={4} className="p-8 text-center">Caricamento...</td></tr> : list.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold text-primary">{areeMap[item.area]}</td>
                        <td className="px-4 py-3 font-medium">{item.descrizione}</td>
                        <td className="px-4 py-3 truncate max-w-[300px]">{item.oggetto}</td>
                        <td className="px-4 py-3 text-center flex justify-center gap-2">
                          <button onClick={() => setEditing(item)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Pencil className="w-4 h-4"/></button>
                          <button onClick={() => handleDelete(item)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* MOBILE CARDS */}
              <div className="md:hidden flex flex-col gap-3">
                {loading ? <div className="p-8 text-center text-muted-foreground">Caricamento...</div> : list.map(item => (
                  <div key={item.id} className="bg-white border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded uppercase">{areeMap[item.area]}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(item)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Pencil className="w-3.5 h-3.5"/></button>
                        <button onClick={() => handleDelete(item)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="w-3.5 h-3.5"/></button>
                      </div>
                    </div>
                    <h4 className="font-bold text-foreground mt-1">{item.descrizione}</h4>
                    <div className="text-xs text-muted-foreground bg-secondary/30 p-2 rounded-lg truncate mt-1">Oggetto: {item.oggetto}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form id="mail-form" onSubmit={handleSave} className="bg-white p-4 sm:p-6 rounded-xl border border-border shadow-sm flex flex-col h-full space-y-5 animate-fade-in">
              <div className="flex justify-between items-center border-b border-border pb-3">
                <h3 className="font-bold text-base sm:text-lg text-primary">{editing.id ? 'Modifica Modello' : 'Nuovo Modello'}</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>Area di Riferimento</label>
                  <select value={editing.area} onChange={e => setEditing({...editing, area: +e.target.value})} className={inputClass}>
                    {Object.entries(areeMap).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Descrizione Interna</label>
                  <input type="text" value={editing.descrizione} onChange={e => setEditing({...editing, descrizione: e.target.value})} className={inputClass} placeholder="es. Inoltro Copia Cortesia Fattura" required />
                </div>
              </div>

              <div>
                <label className={labelClass}>Oggetto della Email</label>
                <input type="text" value={editing.oggetto} onChange={e => setEditing({...editing, oggetto: e.target.value})} className={inputClass} placeholder="es. Invio Documento N. da Azienda XYZ" required />
              </div>

              <div className="bg-blue-50/50 p-3 sm:p-4 rounded-xl border border-blue-100 flex-1 flex flex-col min-h-[250px]">
                <div className="flex items-start gap-2 text-blue-800 mb-2 shrink-0">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold">Formattazione Testo e Variabili</p>
                    <p className="hidden sm:block">Usa tag HTML (es. <code>&lt;b&gt;</code>). Inserisci <code className="bg-white px-1 font-bold text-primary">?logo?</code> per far apparire il logo.</p>
                  </div>
                </div>
                <textarea value={editing.testo} onChange={e => setEditing({...editing, testo: e.target.value})} className={`${inputClass} font-mono text-xs flex-1 resize-none h-full`} placeholder="Gentile Cliente,<br>in allegato inviamo..." required />
              </div>
            </form>
          )}
        </div>

        {/* FOOTER FISSATO IN BASSO */}
        {editing && (
          <div className="px-4 sm:px-6 py-4 bg-card border-t border-border flex flex-col sm:flex-row justify-end gap-3 shrink-0">
            <button type="button" onClick={() => setEditing(null)} className="w-full sm:w-auto px-5 py-2.5 bg-secondary text-secondary-foreground text-sm font-bold rounded-lg hover:opacity-80">
              Annulla
            </button>
            <button type="submit" form="mail-form" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md">
              <Save className="w-5 h-5"/> Salva Modello
            </button>
          </div>
        )}

      </div>
      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback(p=>({...p, isOpen:false}))} onConfirm={feedback.onConfirm} />
    </div>
  );
}