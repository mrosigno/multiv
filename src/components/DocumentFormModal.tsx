import { useState, useEffect } from 'react';
import { X, UserPlus, Pencil, Lock, Info, Save, Eye, XCircle } from 'lucide-react';
import { Fattura } from '@/data/mockData';
import { useClienti } from '@/hooks/api/useClienti';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';
import { useModalitaPagamento } from '@/hooks/api/useModalitaPagamento';
import { useFatture } from '@/hooks/api/useFatture';
import { useAgenti } from '@/hooks/api/useAgenti';
import { useListini } from '@/hooks/api/useListini';
import { useAzienda } from '@/hooks/api/useAzienda';
import ClienteFormModal from './ClienteFormModal';
import FastAutocomplete from '@/components/ui/FastAutocomplete'; 
import { API_HOST } from '@/config'; 
import { useAuthAccess } from '@/hooks/useAuthAccess'; 
import ConfirmDialog from '@/components/ConfirmDialog';

interface Props {
  document: Fattura | null;
  onSave: (doc: Fattura) => void;
  onClose: () => void;
}

const DocumentFormModal = ({ document: doc, onSave, onClose }: Props) => {
  const isEdit = !!doc;
  const today = new Date().toISOString().split('T')[0];
  
  const auth = useAuthAccess();
  
  // REGOLA: Chi può modificare documenti esistenti? (Liv. 2, o >= 4)
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  
  // Sola lettura se è un documento esistente e NON ho i permessi per modificarlo
  const isReadOnly = isEdit && !canEditExisting;

  // Bloccato fisicamente se registrato in contabilità/magazzino
  const isLocked = isEdit && (Number(doc.registrata) !== 0 || Number(doc.caricata) !== 0);

  // BLOCCO TOTALE: Se è in Sola Lettura OPPURE se è Bloccato
  const isCompletelyLocked = isReadOnly || isLocked;

  const [form, setForm] = useState<Partial<Fattura>>(doc ? {
    ...doc,
    provv: doc.provv ? Number(doc.provv) * 100 : 0
  } : {
    IdAzienda: 1, Num: 0, Tipo: 1, key: '', datafatt: today,
    IDCliente: 0, ModPag: 1, Note: '', scad: '', Pagata: '',
    datareg: '', registrata: 0, Numprv: 0, RifDdt: '', cod_agente: 0, provv: 0,
    IdRappr: 0, TS: today + ' 00:00:00', magin: 0, magout: 0, caricata: 0,
    verificato: 0, accorpa: 0, fattel: 0, idcarico: 0, num_ext: '', prot: '',
    impondoc: 0, ivadoc: 0, arrot: 0, filesdi: '', codmag: auth.magId || 1,
  });

  const [showClienteForm, setShowClienteForm] = useState(false);
  const [clientWarning, setClientWarning] = useState<{isOpen: boolean, msg: string}>({ isOpen: false, msg: '' });
  
  const [editingClienteForModal, setEditingClienteForModal] = useState<any>(null);
  
  const { data: clientiData, isLoading: clientiLoading } = useClienti();
  const { data: magazziniData, isLoading: magazziniLoading } = useMagazzini();
  const { data: tipiDocumentoData =[], isLoading: tipiDocLoading } = useTipiDocumento();
  const { data: modalitaPagamentoData =[], isLoading: modPagLoading } = useModalitaPagamento();
  const { data: fattureData =[] } = useFatture();
  const { data: agentiData =[] } = useAgenti();
  const { data: listiniData =[] } = useListini();
  const { data: aziendaData } = useAzienda();

  useEffect(() => {
    if (!isEdit && aziendaData && aziendaData.length > 0) {
      const realId = Number(aziendaData[0].Id || aziendaData[0].id || 100);
      setForm(prev => ({ ...prev, IdAzienda: realId }));
    }
  }, [aziendaData, isEdit]);

  const currentYear = form.datafatt ? form.datafatt.split('-')[0] : new Date().getFullYear();

  useEffect(() => {
    if (!isEdit && form.Tipo && form.datafatt) {
      const fetchNextNumber = async () => {
        try {
          const res = await fetch(`${API_HOST}/api.php?action=get_next_number&tipo=${form.Tipo}&anno=${currentYear}`);
          const data = await res.json();
          if (data.success && data.nextNum) {
             setForm((prev: any) => ({ ...prev, Num: data.nextNum }));
          }
        } catch (e) {}
      };
      fetchNextNumber();
    }
  }, [form.Tipo, currentYear, isEdit]);
  

  // 1. Funzione universale per capire se un cliente è attivo o no
  const isClienteAttivo = (c: any) => {
    return c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1';
  };

  const selectedTipoDoc = tipiDocumentoData.find((t: any) => Number(t.id) === Number(form.Tipo));
  const cliforFilter = selectedTipoDoc ? Number(selectedTipoDoc.clifor) : 0; 

  // 2. Opzioni per la ricerca: Rimosso il filtro di esclusione! Ora mostra tutti.
  const autocompleteOptions = (clientiData || [])
    .filter((c: any) => {
      if (form.IDCliente && Number(c.ID) === Number(form.IDCliente)) return true;
      const t = Number(c.tipocli);
      if (cliforFilter === 1) return t === 1 || t === 0; 
      if (cliforFilter === 2) return t === 2 || t === 0; 
      return true;
    })
    .map((c: any) => {
      const active = isClienteAttivo(c);
      const baseLabel = c.Ragione_Sociale || c['Ragione Sociale'] || '-';
      return {
        id: Number(c.ID),
        // Se è disattivato, aggiungiamo un'icona e un testo evidente nella tendina!
        label: active ? baseLabel : `⛔ ${baseLabel} [DISATTIVATO]`,
        originalData: c 
      };
    })
    .sort((a: any, b: any) => a.label.localeCompare(b.label));

  const update = (key: string, value: string | number) => {
    if (isCompletelyLocked) return;
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleClienteSelect = (id: string | number, option: any) => {
    if (isCompletelyLocked) return;
    const clienteId = Number(id);
    if (clienteId > 0 && option?.originalData) {
      const selectedCli = option.originalData;
      
      // AVVISO ELEGANTE TRAMITE CONFIRM DIALOG
      if (!isClienteAttivo(selectedCli)) {
        setClientWarning({
          isOpen: true,
          msg: `ATTENZIONE!\nL'anagrafica "${selectedCli.Ragione_Sociale || selectedCli['Ragione Sociale']}" risulta DISATTIVATA in archivio.\nControlla prima di procedere.`
        });
      }


      setForm(prev => ({
        ...prev,
        IDCliente: clienteId,
        ModPag: selectedCli.Mod_Pagamento || 1,
        cod_agente: selectedCli.cod_agente || 0,
        provv: selectedCli.provv ? Number(selectedCli.provv) * 100 : 0
      }));
    } else {
      update('IDCliente', 0);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isCompletelyLocked) return;
    const payload = {
      ...form,
      provv: Number(form.provv || 0) / 100
    };
    onSave(payload as Fattura);
  };
  
  const currentCliente = clientiData?.find((c: any) => Number(c.ID) === Number(form.IDCliente));
  const currentListino = listiniData?.find((l: any) => Number(l.id) === Number(currentCliente?.cod_Listino || currentCliente?.Listino || 1));

  // Aggiunto "disabled:opacity-70 disabled:cursor-not-allowed" e sfondo grigio per campi bloccati
  const inputClass = `w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed ${isCompletelyLocked ? 'bg-secondary/30 text-muted-foreground' : 'bg-background text-foreground'}`;
  const labelClass = "block text-xs font-bold text-muted-foreground mb-1.5 uppercase tracking-wider";

  return (
    <>
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-4xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col animate-fade-up sm:animate-fade-in">
          
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card sm:rounded-t-xl shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                {isReadOnly && !isLocked && <Eye className="w-5 h-5 text-blue-500" />}
                {isReadOnly && !isLocked ? 'Dettaglio Documento' : isEdit ? 'Modifica Documento' : 'Nuovo Documento'}
              </h3>
              {isLocked && (
                <span className="bg-destructive/10 text-destructive border border-destructive/20 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Bloccato
                </span>
              )}
              {isReadOnly && !isLocked && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold uppercase rounded border border-blue-200">
                  Sola Lettura
                </span>
              )}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary transition-colors"><X className="w-5 h-5 text-muted-foreground" /></button>
          </div>

          <form id="doc-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar min-h-0 bg-slate-50/50">
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
              <div className="sm:col-span-6">
                <label className={labelClass}>Tipo Documento</label>
                <select value={form.Tipo || 1} onChange={e => update('Tipo', +e.target.value)} className={`${inputClass} font-bold text-primary`} disabled={isCompletelyLocked}>
                  {tipiDocLoading && <option value={form.Tipo || 1}>Caricamento...</option>}
                  {!tipiDocLoading && tipiDocumentoData.map((t: any) => (
                    <option key={t.id} value={t.id}>{t.descrizione}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Data</label>
                <input type="date" value={form.datafatt || ''} onChange={e => update('datafatt', e.target.value)} className={inputClass} required disabled={isCompletelyLocked} />
              </div>
              <div className="sm:col-span-3">
                <label className={labelClass}>Numero</label>
                <input 
                  type="number" 
                  value={form.Num || ''} 
                  onChange={e => update('Num', +e.target.value)} 
                  className={`${inputClass} font-mono font-bold text-center ${!isEdit ? 'bg-secondary/50 text-muted-foreground' : ''}`} 
                  required 
                  disabled={!isEdit || isCompletelyLocked}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
              <div className="sm:col-span-8">
                <label className={labelClass}>Cliente / Fornitore</label>
                <div className="flex gap-2 items-start">
                  
                  <div className="flex-1 min-w-0">
                    <FastAutocomplete 
                      options={autocompleteOptions}
                      value={form.IDCliente || 0}
                      onChange={handleClienteSelect}
                      placeholder={clientiLoading ? 'Caricamento anagrafiche...' : 'Inizia a digitare per cercare...'}
                      disabled={isCompletelyLocked || clientiLoading}
                    />
                  </div>
                  
                  {form.IDCliente ? (
                    <button type="button" disabled={isCompletelyLocked} onClick={() => {
                      const cli = clientiData?.find((c: any) => Number(c.ID) === Number(form.IDCliente));
                      setEditingClienteForModal(cli || null);
                      setShowClienteForm(true);
                    }} className="p-2.5 rounded-lg border border-input hover:bg-secondary transition-colors text-primary disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                      <Pencil className="w-5 h-5" />
                    </button>
                  ) : null}

                  <button type="button" disabled={isCompletelyLocked} onClick={() => { setEditingClienteForModal(null); setShowClienteForm(true); }} className="p-2.5 rounded-lg border border-input hover:bg-secondary transition-colors text-primary disabled:opacity-50 disabled:cursor-not-allowed shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="sm:col-span-4">
                <label className={labelClass}>Magazzino</label>
                <select value={form.codmag || 1} onChange={e => update('codmag', +e.target.value)} className={inputClass} disabled={isCompletelyLocked}>
                  {magazziniLoading && <option value={1}>Caricamento...</option>}
                  {!magazziniLoading && (magazziniData ||[]).filter((m: any) => m.attivo).map((m: any) => (
                    <option key={m.cod} value={m.cod}>{m.Descrizione}</option>
                  ))}
                </select>
              </div>
            </div>

			{currentCliente && (() => {
              const currentAttivo = isClienteAttivo(currentCliente);
              return (
                <div className={`flex flex-col sm:flex-row gap-4 p-4 border rounded-xl items-center shadow-sm transition-colors ${currentAttivo ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-300'}`}>
                  <div className={`flex items-center gap-2 text-sm font-bold shrink-0 ${currentAttivo ? 'text-primary' : 'text-red-600'}`}>
                    {currentAttivo ? <Info className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                    Info Anagrafica {currentAttivo ? '' : '(DISATTIVATA)'}:
                  </div>
                  <div className="flex gap-3">
                    <span className="text-xs bg-white border border-border px-3 py-1.5 rounded-lg shadow-sm">
                      Listino: <strong className="text-foreground">{String(currentListino?.id || 1).padStart(2, '0')}</strong>
                    </span>
                    <span className="text-xs bg-white border border-border px-3 py-1.5 rounded-lg shadow-sm">
                      Sconto: <strong className="text-foreground">{currentCliente.sconto || 0}%</strong>
                    </span>
                  </div>
                </div>
              );
            })()}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 bg-white p-5 rounded-xl border border-border shadow-sm">
              <div className="sm:col-span-6">
                <label className={labelClass}>Mod. Pagamento</label>
                <select value={form.ModPag || 1} onChange={e => update('ModPag', +e.target.value)} className={inputClass} disabled={isCompletelyLocked}>
                  {modPagLoading && <option value={form.ModPag || 1}>Caricamento...</option>}
                  {!modPagLoading && modalitaPagamentoData.map((m: any) => (
                    <option key={m.idmod} value={m.idmod}>{m.Mod}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-4">
                <label className={labelClass}>Agente</label>
                <select value={form.cod_agente || 0} onChange={e => update('cod_agente', +e.target.value)} className={inputClass} disabled={isCompletelyLocked}>
                  <option value={0}>-- Nessuno --</option>
                  {agentiData.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.Nominativo}</option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Provv. %</label>
                <input type="number" step="0.01" value={form.provv ?? 0} onChange={e => update('provv', +e.target.value)} className={inputClass} disabled={isCompletelyLocked} />
              </div>
            </div>

            {isEdit && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-5 border-2 border-dashed border-border rounded-xl bg-white shadow-sm">
                <div>
                  <label className={labelClass}>Imponibile Totale €</label>
                  <input type="number" step="0.01" value={form.impondoc ?? 0} onChange={e => update('impondoc', +e.target.value)} className={`${inputClass} text-right font-mono text-lg font-bold`} disabled={isCompletelyLocked} />
                </div>
                <div>
                  <label className={labelClass}>IVA Totale €</label>
                  <input type="number" step="0.01" value={form.ivadoc ?? 0} onChange={e => update('ivadoc', +e.target.value)} className={`${inputClass} text-right font-mono text-lg font-bold`} disabled={isCompletelyLocked} />
                </div>
              </div>
            )}

            <div className="bg-white p-5 rounded-xl border border-border shadow-sm space-y-4">
              <div>
                <label className={labelClass}>Note Documento</label>
                <textarea value={form.Note || ''} onChange={e => update('Note', e.target.value)} rows={2} className={`${inputClass} resize-none`} disabled={isCompletelyLocked} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Num. Esterno</label>
                  <input type="text" maxLength={40} value={form.num_ext || ''} onChange={e => update('num_ext', e.target.value)} className={inputClass} placeholder="Es. ABC/001" disabled={isCompletelyLocked} />
                </div>
                <div>
                  <label className={labelClass}>Rif. DDT</label>
                  <input type="text" value={form.RifDdt || ''} onChange={e => update('RifDdt', e.target.value)} className={inputClass} disabled={isCompletelyLocked} />
                </div>
              </div>
            </div>
          </form>

          {/* FOOTER FISSATO IN BASSO */}
          <div className={`flex flex-col-reverse sm:flex-row items-center gap-3 px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0 ${isCompletelyLocked ? 'justify-end' : 'justify-between'}`}>
            <button type="button" onClick={onClose} className="w-full sm:w-auto px-6 py-3 sm:py-2.5 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">
              {isCompletelyLocked ? 'Chiudi' : 'Annulla'}
            </button>
            {!isCompletelyLocked && (
              <button type="submit" form="doc-form" className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-md">
                <Save className="w-4 h-4" />
                {isEdit ? 'Salva Modifiche' : 'Crea Documento'}
              </button>
            )}
          </div>

        </div>
      </div>

	 {showClienteForm && (
        <ClienteFormModal
          cliente={editingClienteForModal}
          onSave={(savedCliente) => {
            update('IDCliente', Number(savedCliente.ID));
            setShowClienteForm(false);
          }}
          onClose={() => setShowClienteForm(false)}
        />
      )}

      {/* MODALE AVVISO CLIENTE DISATTIVATO */}
      <ConfirmDialog 
        isOpen={clientWarning.isOpen} 
        type="warning" 
        title="Cliente Disattivato" 
        message={<div className="whitespace-pre-wrap">{clientWarning.msg}</div>} 
        confirmLabel="OK" 
        onClose={() => setClientWarning({ isOpen: false, msg: '' })} 
      />
    </>
  );
};

export default DocumentFormModal;
