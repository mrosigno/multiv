import { useState, useEffect } from 'react';
import { X, Users, Plus, Pencil, Trash2, Save, Key, Server, Mail, Building2 } from 'lucide-react';
import { API_HOST } from '@/config';
import ConfirmDialog from './ConfirmDialog';
import { useMagazzini } from '@/hooks/api/useMagazzini';

const livelliAuth = {
  1: "Sola lettura", 2: "Lettura e modifica", 3: "Lettura e nuova registrazione",
  4: "Operazioni Base", 8: "Tutte le operazioni", 9: "Tutte op. + Verifiche Audit", 10: "Amministratore Totale"
};

export default function UtentiModal({ onClose }: { onClose: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: magazziniData = [] } = useMagazzini();
  const [feedback, setFeedback] = useState<{isOpen: boolean, type: any, title: string, msg: string, onConfirm?: () => void}>({ isOpen: false, type: 'info', title: '', msg: '' });

  const loadData = async () => {
    try {
      const res = await fetch(`${API_HOST}/api.php?action=get_users`);
      setList(await res.json());
    } catch(e) {} finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${API_HOST}/api.php?action=save_user`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing)
    });
    setEditing(null); loadData();
    setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvato', msg: 'Utente aggiornato con successo.' });
  };

  const handleDelete = (item: any) => {
    setFeedback({
      isOpen: true, type: 'danger', title: 'Elimina', msg: `Vuoi eliminare l'utente "${item.fs_user_id}"?`,
      onConfirm: async () => {
        setFeedback(p => ({...p, isOpen: false}));
        await fetch(`${API_HOST}/api.php?action=delete_user`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.Id }) });
        loadData();
      }
    });
  };

  const update = (k: string, v: any) => setEditing({ ...editing, [k]: v });
  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-card w-full max-w-5xl rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[90vh] overflow-hidden border border-border">
        
        <div className="px-5 py-4 border-b border-border bg-slate-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
            <h2 className="text-lg sm:text-xl font-bold truncate">Gestione Operatori</h2>
          </div>
          <button onClick={onClose} className="hover:bg-white/20 p-2 rounded-full transition-colors shrink-0"><X className="w-5 h-5"/></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 flex flex-col gap-4 sm:gap-6 custom-scrollbar bg-slate-50 min-h-0">
          {!editing ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-2">
                <h3 className="font-bold text-foreground">Elenco Operatori</h3>
                <button onClick={() => setEditing({ fs_user_id: '', fs_user_pwd_clear: '', attivo: -1, level: 1, dirig: 'N', gruppo1: 0, gruppo2: 0, gruppo3: 0, gruppo: 1, smtp_port: 465 })} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold text-sm hover:bg-emerald-700 shadow-sm">
                  <Plus className="w-4 h-4"/> Nuovo Operatore
                </button>
              </div>
              
              {/* DESKTOP TABLE */}
              <div className="hidden md:block bg-white rounded-xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-secondary/50 text-muted-foreground border-b border-border">
                    <tr><th className="px-4 py-3">Username</th><th className="px-4 py-3">Livello</th><th className="px-4 py-3 text-center">Amministratore</th><th className="px-4 py-3 text-center">Stato</th><th className="px-4 py-3 text-center">Azioni</th></tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loading ? <tr><td colSpan={5} className="p-8 text-center">Caricamento...</td></tr> : list.map(item => (
                      <tr key={item.Id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-bold text-primary uppercase">{item.fs_user_id}</td>
                        <td className="px-4 py-3 text-xs">{item.level} - {livelliAuth[item.level as keyof typeof livelliAuth] || 'Custom'}</td>
                        <td className="px-4 py-3 text-center">{item.dirig === 'S' ? '⭐ SI' : '-'}</td>
                        <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded text-xs font-bold ${Number(item.attivo) !== 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{Number(item.attivo) !== 0 ? 'Attivo' : 'Sospeso'}</span></td>
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
                  <div key={item.Id} className="bg-white border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="text-base font-black text-primary uppercase">{item.fs_user_id}</span>
                      <div className="flex gap-2">
                        <button onClick={() => setEditing(item)} className="p-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100"><Pencil className="w-4 h-4"/></button>
                        <button onClick={() => handleDelete(item)} className="p-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    </div>
                    <div className="text-xs font-medium text-slate-500">{item.level} - {livelliAuth[item.level as keyof typeof livelliAuth] || 'Custom'}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${Number(item.attivo) !== 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{Number(item.attivo) !== 0 ? 'ATTIVO' : 'SOSPESO'}</span>
                      {item.dirig === 'S' && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">⭐ AMMINISTRATORE</span>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <form id="user-form" onSubmit={handleSave} className="space-y-6">
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* BLOCCO SICUREZZA */}
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-border shadow-sm space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><Key className="w-4 h-4"/> Credenziali e Ruolo</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><label className={labelClass}>Username</label><input type="text" value={editing.fs_user_id} onChange={e => update('fs_user_id', e.target.value)} className={`${inputClass} uppercase font-bold`} required /></div>
                    <div><label className={labelClass}>Password in Chiaro</label><input type="text" value={editing.fs_user_pwd_clear} onChange={e => update('fs_user_pwd_clear', e.target.value)} className={`${inputClass} font-mono`} required /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className={labelClass}>Livello Operativo</label>
                      <select value={editing.level} onChange={e => update('level', +e.target.value)} className={inputClass}>
                        {Object.entries(livelliAuth).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelClass}>Dirigente</label>
                      <select value={editing.dirig} onChange={e => update('dirig', e.target.value)} className={inputClass}><option value="N">No</option><option value="S">Sì, Dirigente</option></select>
                    </div>
                  </div>
                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer p-3 bg-secondary/30 rounded-lg border border-transparent">
                      <input type="checkbox" checked={Number(editing.attivo) !== 0} onChange={e => update('attivo', e.target.checked ? -1 : 0)} className="w-5 h-5 text-emerald-600 rounded cursor-pointer" />
                      <span className="text-sm font-bold">Utente Attivo (Login Consentito)</span>
                    </label>
                  </div>
                </div>

                {/* BLOCCO AREE E FILIALE */}
                <div className="bg-white p-4 sm:p-6 rounded-xl border border-border shadow-sm space-y-4">
                  <h4 className="font-bold text-primary flex items-center gap-2 border-b border-border pb-2"><Building2 className="w-4 h-4"/> Permessi Aree e Magazzino</h4>
                  <div>
                    <label className={labelClass}>Magazzino di Default (Filiale)</label>
                    <select value={editing.gruppo} onChange={e => update('gruppo', +e.target.value)} className={inputClass}>
                      {magazziniData.map((m: any) => <option key={m.cod} value={m.cod}>{m.Descrizione}</option>)}
                    </select>
                  </div>
                  <div className="pt-3 space-y-3">
                    <label className={labelClass}>Aree Multi-V Abilitate</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={Number(editing.gruppo1) !== 0} onChange={e => update('gruppo1', e.target.checked ? -1 : 0)} className="w-4 h-4 text-primary rounded" /> <span className="text-sm">Area 1: Documenti e Vendite</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={Number(editing.gruppo2) !== 0} onChange={e => update('gruppo2', e.target.checked ? -1 : 0)} className="w-4 h-4 text-primary rounded" /> <span className="text-sm">Area 2: Contabilità e Finanza</span></label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={Number(editing.gruppo3) !== 0} onChange={e => update('gruppo3', e.target.checked ? -1 : 0)} className="w-4 h-4 text-primary rounded" /> <span className="text-sm">Area 3: Magazzino e Logistica</span></label>
                  </div>
                </div>
              </div>

              {/* BLOCCO EMAIL SMTP */}
              <div className="bg-emerald-50/50 p-4 sm:p-6 rounded-xl border border-emerald-200 shadow-sm space-y-4">
                <h4 className="font-bold text-emerald-800 flex items-center gap-2 border-b border-emerald-200 pb-2"><Mail className="w-4 h-4"/> Configurazione Invio Email (SMTP Personale)</h4>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="sm:col-span-3"><label className={labelClass}>Server SMTP</label><div className="relative"><Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input type="text" value={editing.smtp_host} onChange={e => update('smtp_host', e.target.value)} className={`${inputClass} pl-9 font-mono`} placeholder="es. mail.miodominio.it" /></div></div>
                  <div className="sm:col-span-1"><label className={labelClass}>Porta</label><input type="number" value={editing.smtp_port} onChange={e => update('smtp_port', +e.target.value)} className={`${inputClass} font-mono`} /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div><label className={labelClass}>Utente (Email)</label><input type="text" value={editing.smtp_user} onChange={e => update('smtp_user', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Password SMTP</label><input type="password" value={editing.smtp_pass} onChange={e => update('smtp_pass', e.target.value)} className={inputClass} placeholder="••••••••" /></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div><label className={labelClass}>Mittente (Da:)</label><input type="text" value={editing.smtp_from} onChange={e => update('smtp_from', e.target.value)} className={inputClass} placeholder="Nome Utente <info@...>" /></div>
                  <div><label className={labelClass}>Email Copia Nascosta (BCC/CCN)</label><input type="text" value={editing.smtp_bcc} onChange={e => update('smtp_bcc', e.target.value)} className={inputClass} placeholder="Tua email per archivio invii" /></div>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* FOOTER FISSATO IN BASSO */}
        {editing && (
          <div className="px-4 sm:px-6 py-4 bg-card border-t border-border flex flex-col sm:flex-row justify-end gap-3 shrink-0">
            <button type="button" onClick={() => setEditing(null)} className="w-full sm:w-auto px-5 py-2.5 bg-secondary text-secondary-foreground text-sm font-bold rounded-lg hover:opacity-80 transition-opacity">
              Annulla
            </button>
            <button type="submit" form="user-form" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-2.5 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 shadow-md transition-colors">
              <Save className="w-5 h-5"/> Salva Operatore
            </button>
          </div>
        )}

      </div>
      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback(p=>({...p, isOpen:false}))} onConfirm={feedback.onConfirm} />
    </div>
  );
}