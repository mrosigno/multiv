import { useState } from 'react';
import { X, Save, Trash2, Eye } from 'lucide-react';
import { Cliente } from '@/data/mockData';
import { useAgenti } from '@/hooks/api/useAgenti';
import { useModalitaPagamento } from '@/hooks/api/useModalitaPagamento';
import { useListini } from '@/hooks/api/useListini';
import { useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess'; 

interface Props {
  cliente: Cliente | null;
  onSave: (cliente: Cliente) => void;
  onClose: () => void;
  onDeleteRequest?: (cliente: Cliente) => void;
}

const ClienteFormModal = ({ cliente, onSave, onClose, onDeleteRequest }: Props) => {
  const isEdit = !!cliente;
  const queryClient = useQueryClient();
  const auth = useAuthAccess(); 
  
  // REGOLA: Chi può modificare clienti ESISTENTI? (Liv 2 o >=4)
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  const isReadOnly = isEdit && !canEditExisting;

  const [form, setForm] = useState<Partial<Cliente>>(cliente || {
    Ragione_Sociale: '', Indirizzo: '', CAP: '', Comune: '', Prov: '',
    PI: '', CF: '', telefono: '', email: '', emaildoc: '', PEC: '',
    tipocli: 1, 
    tipodest: 1, 
    Nome: '', Cognome: '', coduff: '', split: 0,
    Mod_Pagamento: 1, IBAN: '', cod_agente: 0, cod_Listino: 1, sconto: 0, idext: 0, fido: 0,
    Note: '', attivo: 'SI'
  });

  const { data: agentiData = [] } = useAgenti();
  const { data: modPagData = [] } = useModalitaPagamento();
  const { data: listiniData = [] } = useListini();

  const update = (key: keyof Cliente | 'emaildoc', value: any) => {
    if (isReadOnly) return;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;

    try {
      const res = await fetch(`${API_HOST}/api.php?action=save_cliente`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        await queryClient.invalidateQueries({ queryKey: ['clienti'] }); 
        onSave({ ...form, ID: data.id || form.ID } as Cliente);
      } else {
        alert("Errore nel salvataggio: " + data.message);
      }
    } catch (err) {
      alert("Errore di connessione al server");
    }
  };
  
  const inputClass = `w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed ${isReadOnly ? 'bg-secondary/30 text-muted-foreground' : 'bg-background text-foreground'}`;
  const labelClass = "block text-[11px] font-bold text-muted-foreground mb-1 uppercase tracking-wider";
  const fieldsetClass = "border border-border rounded-xl p-4 sm:p-5 bg-card/50 shadow-sm relative";
  const legendClass = "text-sm font-bold text-primary px-3 py-1 bg-background rounded-md border border-border shadow-sm flex items-center gap-2";

  return (
    // FIX RESPONSIVE: h-[100dvh] su mobile con flex-col garantisce che header e footer non sfondino i bordi!
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-[350] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-5xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col animate-fade-up sm:animate-fade-in">
        
        {/* Header Fissato */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card sm:rounded-t-2xl shrink-0">
          <div className="flex items-center gap-2 sm:gap-4 truncate">
            <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 truncate">
              {isReadOnly ? <Eye className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 shrink-0" /> : null}
              <span className="truncate">{isReadOnly ? 'Dettaglio Anagrafica' : isEdit ? 'Modifica Anagrafica' : 'Nuova Anagrafica'}</span>
            </h3>
            {isEdit && (
              <span className="hidden sm:inline-flex px-3 py-1 bg-secondary text-secondary-foreground text-xs font-mono font-bold rounded-md border border-border shadow-sm shrink-0">
                ID: {form.ID}
              </span>
            )}
            {isReadOnly && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[9px] sm:text-[10px] font-bold uppercase rounded border border-red-200 shrink-0">
                Sola Lettura
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Form Scorrrevole */}
        <form id="cliente-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5 sm:space-y-6 overflow-y-auto flex-1 custom-scrollbar min-h-0 bg-slate-50/50">
          
          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>Anagrafica Base e Recapiti</legend>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-6">
                <label className={labelClass}>Ragione Sociale *</label>
                <input type="text" disabled={isReadOnly} value={form.Ragione_Sociale || form['Ragione Sociale'] || ''} onChange={e => update('Ragione_Sociale', e.target.value)} className={`${inputClass} font-bold text-primary`} required />
              </div>
              
              <div className="md:col-span-3">
                <label className={labelClass}>Categoria</label>
                <select disabled={isReadOnly} value={form.tipocli ?? 1} onChange={e => update('tipocli', +e.target.value)} className={inputClass}>
                  <option value={0}>Entrambi (0)</option>
                  <option value={1}>Solo Cliente (1)</option>
                  <option value={2}>Solo Fornitore (2)</option>
                </select>
              </div>

              <div className="md:col-span-3">
                <label className={labelClass}>Stato Attività</label>
                <select 
                  disabled={isReadOnly}
                  value={form.attivo || 'SI'} 
                  onChange={e => update('attivo', e.target.value)} 
                  className={`${inputClass} font-bold ${(form.attivo === 'SI' || form.attivo === 1 || form.attivo === '1' || form.attivo === -1 || form.attivo === '-1') ? 'text-green-700 bg-green-50 border-green-200' : 'text-red-700 bg-red-50 border-red-200'}`}
                >
                  <option value="SI">Attivo (SI)</option>
                  <option value="NO">Inattivo (NO)</option>
                </select>
              </div>

              <div className="md:col-span-6">
                <label className={labelClass}>Indirizzo Operativo</label>
                <input type="text" disabled={isReadOnly} value={form.Indirizzo || ''} onChange={e => update('Indirizzo', e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>CAP</label>
                <input type="text" disabled={isReadOnly} value={form.CAP || ''} onChange={e => update('CAP', e.target.value)} className={inputClass} maxLength={5} />
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Città (Comune)</label>
                <input type="text" disabled={isReadOnly} value={form.Comune || ''} onChange={e => update('Comune', e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-1">
                <label className={labelClass}>Prov.</label>
                <input type="text" disabled={isReadOnly} value={form.Prov || ''} onChange={e => update('Prov', e.target.value.toUpperCase())} maxLength={2} className={`${inputClass} text-center`} />
              </div>

              <div className="md:col-span-4">
                <label className={labelClass}>Partita IVA</label>
                <input type="text" disabled={isReadOnly} value={form.PI || ''} onChange={e => update('PI', e.target.value)} className={`${inputClass} font-mono font-bold`} />
              </div>
              <div className="md:col-span-4">
                <label className={labelClass}>Codice Fiscale</label>
                <input type="text" disabled={isReadOnly} value={form.CF || ''} onChange={e => update('CF', e.target.value.toUpperCase())} className={`${inputClass} font-mono`} />
              </div>
              <div className="md:col-span-4">
                <label className={labelClass}>Telefono Principale</label>
                <input type="text" disabled={isReadOnly} value={form.telefono || ''} onChange={e => update('telefono', e.target.value)} className={inputClass} />
              </div>

              <div className="md:col-span-6">
                <label className={labelClass}>Email (Generale)</label>
                <input type="email" disabled={isReadOnly} value={form.email || ''} onChange={e => update('email', e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-6">
                <label className={labelClass}>Email (Invio Documenti)</label>
                <input type="email" disabled={isReadOnly} value={form.emaildoc || ''} onChange={e => update('emaildoc', e.target.value)} className={`${inputClass} border-blue-300 bg-blue-50 focus:ring-blue-500`} placeholder="es. amministrazione@azienda.it" />
              </div>
            </div>
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>Fatturazione Elettronica (SDI)</legend>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4">
                <label className={labelClass}>Tipologia Destinatario</label>
                <select disabled={isReadOnly} value={form.tipodest ?? 1} onChange={e => update('tipodest', +e.target.value)} className={inputClass}>
                  <option value={1}>1 - Azienda / P.IVA B2B</option>
                  <option value={2}>2 - Amministrazione Pubblica (PA)</option>
                  <option value={3}>3 - Persona Fisica Privata B2C</option>
                </select>
              </div>
              
              <div className="md:col-span-4">
                <label className={`${labelClass} ${Number(form.tipodest) !== 3 ? 'opacity-50' : ''}`}>Cognome (se Privato)</label>
                <input type="text" disabled={isReadOnly || Number(form.tipodest) !== 3} value={form.Cognome || ''} onChange={e => update('Cognome', e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-4">
                <label className={`${labelClass} ${Number(form.tipodest) !== 3 ? 'opacity-50' : ''}`}>Nome (se Privato)</label>
                <input type="text" disabled={isReadOnly || Number(form.tipodest) !== 3} value={form.Nome || ''} onChange={e => update('Nome', e.target.value)} className={inputClass} />
              </div>

              <div className="md:col-span-4">
                <label className={labelClass}>Codice Univoco (SDI)</label>
                <input type="text" disabled={isReadOnly} value={form.coduff || ''} onChange={e => update('coduff', e.target.value.toUpperCase())} maxLength={7} className={`${inputClass} font-mono font-bold text-blue-700 bg-blue-50 border-blue-200 focus:ring-blue-500`} placeholder="Es. M5UXCR1 o 0000000" />
              </div>
              <div className="md:col-span-4">
                <label className={labelClass}>Indirizzo PEC</label>
                <input type="email" disabled={isReadOnly} value={form.PEC || ''} onChange={e => update('PEC', e.target.value)} className={inputClass} />
              </div>
              <div className="md:col-span-4 flex items-end pl-2 pb-1.5">
                <label className={`flex items-center gap-2 text-sm font-bold text-foreground select-none ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                  <input type="checkbox" disabled={isReadOnly} checked={Number(form.split) === 1} onChange={e => update('split', e.target.checked ? 1 : 0)} className="w-5 h-5 rounded border-input text-primary focus:ring-ring accent-primary" />
                  Split Payment (Scissione Pag.)
                </label>
              </div>
            </div>
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>Commerciale & Pagamenti</legend>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              
              <div className="md:col-span-6">
                <label className={labelClass}>Modalità di Pagamento</label>
                <select disabled={isReadOnly} value={form.Mod_Pagamento ?? 1} onChange={e => update('Mod_Pagamento', +e.target.value)} className={inputClass}>
                  {modPagData.map((m: any) => <option key={m.idmod} value={m.idmod}>{m.Mod}</option>)}
                </select>
              </div>
              <div className="md:col-span-6">
                <label className={labelClass}>IBAN Bancario</label>
                <input type="text" disabled={isReadOnly} value={form.IBAN || ''} onChange={e => update('IBAN', e.target.value.toUpperCase())} className={`${inputClass} font-mono`} placeholder="IT..." />
              </div>

              <div className="md:col-span-3">
                <label className={labelClass}>Agente di Riferimento</label>
                <select disabled={isReadOnly} value={form.cod_agente ?? 0} onChange={e => update('cod_agente', +e.target.value)} className={inputClass}>
                  <option value={0}>-- Nessun Agente --</option>
                  {agentiData.map((a: any) => <option key={a.id} value={a.id}>{a.Nominativo}</option>)}
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Listino Assegnato</label>
                <select disabled={isReadOnly} value={form.cod_Listino ?? 1} onChange={e => update('cod_Listino', +e.target.value)} className={inputClass}>
                  {listiniData.map((l: any) => <option key={l.id} value={l.id}>Listino {l.id} - {l.Descrizione}</option>)}
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className={labelClass}>Sconto Cassa %</label>
                <input type="number" disabled={isReadOnly} step="0.01" value={form.sconto ?? 0} onChange={e => update('sconto', +e.target.value)} className={`${inputClass} text-right font-mono text-destructive`} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>ID Rif. Esterno</label>
                <input type="number" disabled={isReadOnly} value={form.idext ?? 0} onChange={e => update('idext', +e.target.value)} className={`${inputClass} text-center`} />
              </div>
              <div className="md:col-span-2">
                <label className={`${labelClass} text-primary`} title="Fido massimo concesso">
                  Attivazione Fido €
                </label>
                <input type="number" disabled={isReadOnly} step="0.01" value={form.fido ?? 0} onChange={e => update('fido', +e.target.value)} className={`${inputClass} text-right font-bold`} />
              </div>
            </div>
          </fieldset>

          <div className="w-full">
            <label className={labelClass}>Note Interne</label>
            <textarea 
              disabled={isReadOnly}
              value={form.Note || ''} 
              onChange={e => update('Note', e.target.value)} 
              rows={3} 
              className={`${inputClass} resize-none`} 
              placeholder="Inserisci qui eventuali note o memo sul cliente/fornitore..."
            />
          </div>

        </form>

        {/* Footer Fissato In Basso (Responsivo: Incolonnato su Mobile, Allineato su PC) */}
        <div className={`flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-3 px-4 sm:px-6 py-3 sm:py-4 border-t border-border bg-card sm:rounded-b-2xl shrink-0 w-full overflow-hidden ${isReadOnly ? 'justify-end' : 'justify-between'}`}>
          
          <div className="w-full sm:w-auto">
            {!isReadOnly && isEdit && auth.canDelete && onDeleteRequest && (
              <button type="button" onClick={() => onDeleteRequest(form as Cliente)} className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-3 sm:py-2.5 rounded-lg bg-red-50 text-red-600 text-xs sm:text-sm font-bold hover:bg-red-100 transition-colors border border-red-100 shadow-sm">
                <Trash2 className="w-4 h-4" /> <span className="inline">Elimina Anagrafica</span>
              </button>
            )}
          </div>

          <div className="flex gap-2 w-full sm:w-auto">
            <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 rounded-lg border border-input text-xs sm:text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">
              {isReadOnly ? 'Chiudi Scheda' : 'Annulla'}
            </button>
            
            {!isReadOnly && (
              <button type="submit" form="cliente-form" className="flex-[2] sm:flex-none flex items-center justify-center gap-1.5 px-6 py-3 sm:py-2.5 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-bold hover:bg-blue-700 transition-opacity shadow-sm">
                <Save className="w-4 h-4" /> {isEdit ? 'Salva Modifiche' : 'Crea Anagrafica'}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ClienteFormModal;