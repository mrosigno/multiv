import { useState, useMemo } from 'react';
import { X, UserPlus, Trash2, Save, Pencil } from 'lucide-react';
import { useAuthAccess } from '@/hooks/useAuthAccess';
import { fatture } from '@/data/mockData';
import { PrimaNotaCasa } from '@/data/contabilitaMockData';
import { useClienti } from '@/hooks/api/useClienti';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';
import ClienteFormModal from './ClienteFormModal';
import RegistraScadenzaForm from './RegistraScadenzaForm';
import DocumentDetail from './DocumentDetail';
import FastAutocomplete from '@/components/ui/FastAutocomplete'; 

interface Props {
  record: PrimaNotaCasa | null;
  onSave: (record: PrimaNotaCasa) => void;
  onClose: () => void;
  onDelete?: (id: number) => void;
  isScadenzario?: boolean;
  onRegistra?: (record: PrimaNotaCasa, importo: number, data: string) => void;
}

const MovementForm = ({ record, onSave, onClose, onDelete, isScadenzario, onRegistra }: Props) => {
  const isEdit = !!record;
  const auth = useAuthAccess();

  // Regola di blocco: Se stiamo aprendo un record esistente (isEdit) e l'utente 
  // NON è livello 2 o >= 4, blocchiamo tutto in Sola Lettura.
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  const isReadOnly = isEdit && !canEditExisting;
  
  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<Partial<PrimaNotaCasa>>(record || {
    IdAzienda: 1, IdFattura: 0, IdCliente: 0, data: today,
    descrizione: '', Dare: 0, Avere: 0, imponibile: 0, iva: 0, TipoMovimento: 0,
    Categoria: 1, link: '', scadenza: '', datachiusura: '', numdoc: '',
    TS: today + ' 00:00:00', rifinterno: '', 'C-R': 'C', note: '', chiuso: 0,
    mezzopag: 1, oilcausale: '', oiltipo: '', rifrevers: 0,
  });

  const [showClienteForm, setShowClienteForm] = useState(false);
  const [editingClienteForModal, setEditingClienteForModal] = useState<any>(null);
  const [showRegistra, setShowRegistra] = useState(false);
  const [showDocDetail, setShowDocDetail] = useState(false);
  
  const { data: clientiData, isLoading: clientiLoading } = useClienti();
  const { data: causaliData =[], isLoading: causaliLoading } = useCausali();
  const { data: tipologieData =[], isLoading: tipologieLoading } = useTipologieMovimento();
  const { data: mezziData =[], isLoading: mezziLoading } = useMezziPagamento();

  const autocompleteOptions = useMemo(() => {
    if (!clientiData) return [];
    return clientiData
      .filter((c: any) => c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === 0 || c.attivo === '0' || c.attivo === -1 || c.attivo === '-1' || !c.attivo)
      .map((c: any) => ({
        id: Number(c.ID),
        label: c.Ragione_Sociale || c['Ragione Sociale'] || '-',
        originalData: c 
      }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [clientiData]);

  const handleClienteSelect = (id: string | number) => {
    update('IdCliente', Number(id));
  };

  const update = (key: string, value: string | number) => {
    if (isReadOnly) return; // Sicurezza extra
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const tipiFiltered = form.Categoria
    ? tipologieData.filter((t: any) => Number(t.idcausale) === Number(form.Categoria))
    : tipologieData;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return;
    onSave(form as PrimaNotaCasa);
  };

  const handleDeleteRequest = () => {
    if (!record || !onDelete || isReadOnly) return;
    onDelete(record.Id);
  };

  const linkedFattura = form.rifinterno ? fatture.find(f => f.ID === parseInt(form.rifinterno as string, 10)) : null;

  // Applichiamo una sfumatura diversa se è in sola lettura
  const inputClass = `w-full px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed ${isReadOnly ? 'bg-secondary/30' : ''}`;
  const labelClass = "block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider";
  const fieldsetClass = "border border-border rounded-lg p-5 bg-card/50 shadow-sm";
  const legendClass = "text-sm font-bold text-primary px-2 bg-background rounded-md border border-border";

  const formatTS = (ts: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      return d.toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch { return ts; }
  };

  return (
    <>
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col animate-fade-in">
          
          {/* Header */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-card rounded-t-xl shrink-0 gap-2">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 min-w-0">
              <h3 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 truncate">
                {isReadOnly ? 'Dettaglio Movimento' : isEdit ? 'Modifica Movimento' : 'Nuova Registrazione'}
                {isReadOnly && <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase rounded border border-red-200 shrink-0">Sola Lettura</span>}
                <span className="ml-1 sm:ml-2 text-xs sm:text-sm font-normal text-muted-foreground hidden sm:inline">
                  ({isScadenzario ? 'Scadenzario' : 'Prima Nota'})
                </span>
              </h3>
              
              {isEdit && (
                <div className="flex gap-2 text-[10px] sm:text-xs font-mono text-muted-foreground bg-secondary/50 px-2 py-1 rounded-md border border-border w-fit">
                  <span>Id: <strong className="text-foreground">{form.Id}</strong></span>
                  <span className="hidden sm:inline">ult.modifica: <strong className="text-foreground">{formatTS(form.TS || '')}</strong></span>
                  <span className="sm:hidden"><strong className="text-foreground">{formatTS(form.TS || '').split(',')[0]}</strong></span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0 ml-auto">
              {/* Tasto Registra in Scadenzario nascosto se in sola lettura */}
              {!isReadOnly && isEdit && isScadenzario && onRegistra && (
                <button type="button" onClick={() => setShowRegistra(true)} className="px-2 sm:px-3 py-1.5 rounded-lg bg-success text-success-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                  Registra
                </button>
              )}
              {/* Tasto Elimina nascosto se in sola lettura o no permessi */}
              {!isReadOnly && isEdit && onDelete && auth.canDelete && (
                <button type="button" onClick={handleDeleteRequest} className="px-2 sm:px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity">
                  <Trash2 className="w-3.5 h-3.5 sm:mr-1 inline" /> <span className="hidden sm:inline">Elimina</span>
                </button>
              )}
              <button onClick={onClose} className="p-1.5 sm:p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"><X className="w-4 h-4 sm:w-5 sm:h-5" /></button>
            </div>
          </div>

          {/* Body Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
            
            <fieldset className={fieldsetClass}>
              <legend className={legendClass}>Dati Generali</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className={labelClass}>Data</label>
                  <input type="date" disabled={isReadOnly} value={form.data || ''} onChange={e => update('data', e.target.value)} className={inputClass} required />
                </div>
                <div className="md:col-span-5">
                  <label className={labelClass}>Causale Contabile</label>
                  <select disabled={isReadOnly} value={form.Categoria || 1} onChange={e => { update('Categoria', +e.target.value); update('TipoMovimento', 0); }} className={inputClass}>
                    {causaliLoading && <option value={1}>Caricamento...</option>}
                    {!causaliLoading && causaliData.map((c: any) => <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>)}
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className={labelClass}>Tipo Movimento</label>
                  <select disabled={isReadOnly} value={form.TipoMovimento || 0} onChange={e => update('TipoMovimento', +e.target.value)} className={inputClass}>
                    <option value={0}>-- Seleziona --</option>
                    {tipologieLoading && <option value={0}>Caricamento...</option>}
                    {!tipologieLoading && tipiFiltered.map((t: any) => <option key={t.id} value={t.id}>{t.codice} - {t.Descrizione}</option>)}
                  </select>
                </div>

                <div className="md:col-span-6">
                  <label className={labelClass}>Mezzo</label>
                  <select disabled={isReadOnly} value={form.mezzopag || 1} onChange={e => update('mezzopag', +e.target.value)} className={inputClass}>
                    {mezziLoading && <option value={1}>Caricamento...</option>}
                    {!mezziLoading && mezziData.map((m: any) => <option key={m.id} value={m.id}>{m.descrizione}</option>)}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Compet./Residuo</label>
                  <select disabled={isReadOnly} value={form['C-R'] || 'C'} onChange={e => update('C-R', e.target.value)} className={inputClass}>
                    <option value="C">Competenza (C)</option>
                    <option value="R">Residuo (R)</option>
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Num. Protocollo</label>
                  <input type="text" disabled={isReadOnly} value={form.rifinterno || ''} onChange={e => update('rifinterno', e.target.value)} className={inputClass} />
                </div>

                <div className="md:col-span-12">
                  <label className={labelClass}>Committente</label>
                  <div className="flex gap-1 items-start">
                    
                    <div className="flex-1 min-w-0">
                      <FastAutocomplete 
                        options={autocompleteOptions}
                        value={form.IdCliente || 0}
                        onChange={handleClienteSelect}
                        placeholder={clientiLoading ? 'Caricamento anagrafiche...' : 'Inizia a digitare per cercare...'}
                        disabled={clientiLoading || isReadOnly}
                      />
                    </div>
                    
                    {/* Bottoni Clienti Nascosti se Sola Lettura */}
                    {!isReadOnly && form.IdCliente ? (
                      <button type="button" onClick={() => {
                        const cli = clientiData?.find((c: any) => Number(c.ID) === Number(form.IdCliente));
                        setEditingClienteForModal(cli || null);
                        setShowClienteForm(true);
                      }} className="p-2 rounded-md border border-input hover:bg-secondary transition-colors text-primary shrink-0" title="Modifica Anagrafica Selezionata">
                        <Pencil className="w-5 h-5" />
                      </button>
                    ) : null}

                    {!isReadOnly && (
                      <button type="button" onClick={() => { setEditingClienteForModal(null); setShowClienteForm(true); }} className="p-2 rounded-md border border-input hover:bg-secondary transition-colors text-primary shrink-0" title="Nuova Anagrafica">
                        <UserPlus className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </fieldset>

            <fieldset className={fieldsetClass}>
              <legend className={legendClass}>Dettagli e Importi</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-12">
                  <label className={labelClass}>Descrizione</label>
                  <input type="text" disabled={isReadOnly} value={form.descrizione || ''} onChange={e => update('descrizione', e.target.value)} className={inputClass} required />
                </div>
                <div className="md:col-span-12">
                  <label className={labelClass}>Annotazioni</label>
                  <input type="text" disabled={isReadOnly} value={form.note || ''} onChange={e => update('note', e.target.value)} className={inputClass} />
                </div>
                
                <div className="md:col-span-4">
                  <label className={labelClass}>Dare €</label>
                  <input type="number" disabled={isReadOnly} step="0.01" value={form.Dare || ''} onChange={e => update('Dare', +e.target.value)} className={`${inputClass} text-lg font-mono text-right`} />
                </div>
                <div className="md:col-span-4">
                  <label className={labelClass}>Avere €</label>
                  <input type="number" disabled={isReadOnly} step="0.01" value={form.Avere || ''} onChange={e => update('Avere', +e.target.value)} className={`${inputClass} text-lg font-mono text-right`} />
                </div>
                <div className="md:col-span-4 flex items-end pb-2 pl-4">
                  <label className={`flex items-center gap-2 text-sm font-bold text-foreground select-none ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                    <input type="checkbox" disabled={isReadOnly} checked={!!form.chiuso} onChange={e => update('chiuso', e.target.checked ? -1 : 0)} className="w-5 h-5 rounded border-input text-primary focus:ring-ring accent-primary" />
                    Movimento Chiuso
                  </label>
                </div>
              </div>
            </fieldset>

            <fieldset className={fieldsetClass}>
              <legend className={legendClass}>Rifer. Documento</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className={labelClass}>N. Documento</label>
                  <input type="text" disabled={isReadOnly} value={form.numdoc || ''} onChange={e => update('numdoc', e.target.value)} className={inputClass} />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>ID Documento</label>
                  <div className="flex gap-1">
                    <input 
                      type="number" 
                      disabled={isReadOnly}
                      value={form.idFattura ?? (form as any).IdFattura ?? (form as any).idfattura ?? ''} 
                      onChange={e => update('idFattura', +e.target.value)} 
                      className={inputClass} 
                    />
                    {(form.idFattura || (form as any).IdFattura) && linkedFattura && (
                      <button type="button" onClick={() => setShowDocDetail(true)} className="shrink-0 px-2 py-2 rounded-md border border-input hover:bg-secondary transition-colors text-xs font-medium text-primary" title="Apri Dettaglio Documento">
                        👁️
                      </button>
                    )}
                  </div>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Imponibile €</label>
                  <input type="number" disabled={isReadOnly} step="0.01" value={form.imponibile ?? ''} onChange={e => update('imponibile', +e.target.value)} className={`${inputClass} text-right`} />
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Imposta IVA €</label>
                  <input type="number" disabled={isReadOnly} step="0.01" value={form.iva ?? ''} onChange={e => update('iva', +e.target.value)} className={`${inputClass} text-right`} />
                </div>
              </div>
            </fieldset>
            
          </form>

          {/* Footer del Form */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
              {isReadOnly ? 'Chiudi' : 'Annulla'}
            </button>
            {!isReadOnly && (
              <button type="submit" onClick={handleSubmit} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm">
                <Save className="w-4 h-4" />
                {isEdit ? 'Salva Modifiche' : 'Registra Movimento'}
              </button>
            )}
          </div>

        </div>
      </div>

      {showClienteForm && (
        <ClienteFormModal
          cliente={editingClienteForModal}
          onSave={(savedCliente) => {
            update('IdCliente', Number(savedCliente.ID));
            setShowClienteForm(false);
          }}
          onClose={() => setShowClienteForm(false)}
        />
      )}
      
      {showRegistra && record && onRegistra && (
        <RegistraScadenzaForm
          record={record}
          onRegistra={(rec, importo, data) => {
            onRegistra(rec, importo, data);
            setShowRegistra(false);
            onClose();
          }}
          onClose={() => setShowRegistra(false)}
        />
      )}

      {showDocDetail && linkedFattura && (
        <DocumentDetail
          document={linkedFattura}
          onClose={() => setShowDocDetail(false)}
          onEdit={() => {}}
          onToggle={() => {}}
        />
      )}
    </>
  );
};

export default MovementForm;