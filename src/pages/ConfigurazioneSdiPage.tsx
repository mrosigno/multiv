import { useState, useEffect } from 'react';
import { Save, RefreshCcw, FileCode2, Send, Building2, MapPin, Landmark, Settings, Calculator, FolderSearch, CheckCircle2, Folder, ChevronLeft, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { API_HOST } from '@/config';
import ConfirmDialog from '@/components/ConfirmDialog';

const ConfigurazioneSdiPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>({});
  
  // --- STATO PER LA MODALE DI FEEDBACK ---
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ 
    isOpen: false, type: 'success-auto', title: '', msg: '' 
  });

  const [browserConfig, setBrowserConfig] = useState<{ isOpen: boolean; field: string; currentPath: string }>({
    isOpen: false, field: '', currentPath: 'C:\\'
  });
  
  // --- FUNZIONE DI FETCH 100% PROTETTA ---
  const fetchSafeArray = async (action: string) => {
    try {
      const res = await fetch(`${API_HOST}/api.php?action=${action}`);
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  // --- FETCH DATI PRINCIPALI (Fattura PA Param) ---
  const { data, isLoading, isError } = useQuery({
    queryKey: ['fattpaparam'],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_HOST}/api.php?action=fattpaparam`);
        const json = await res.json();
        return Array.isArray(json) && json.length > 0 ? json[0] : null;
      } catch {
        return null;
      }
    }
  });

  // --- FETCH TABELLE SUPPORTO (Isolate e protette) ---
  const { data: aliquoteData } = useQuery({ queryKey: ['sdi_aliquote'], queryFn: () => fetchSafeArray('aliquote') });
  const { data: bancheData } = useQuery({ queryKey: ['sdi_banche'], queryFn: () => fetchSafeArray('banche') });
  const { data: regimiData } = useQuery({ queryKey: ['sdi_regimi'], queryFn: () => fetchSafeArray('fattparegimi') });
  const { data: cassaData } = useQuery({ queryKey: ['sdi_cassa'], queryFn: () => fetchSafeArray('tipo_cassa') });
  const { data: naturaData } = useQuery({ queryKey: ['sdi_natura'], queryFn: () => fetchSafeArray('fattpanatura') });
  const { data: causaliRitData } = useQuery({ queryKey: ['sdi_causali_rit'], queryFn: () => fetchSafeArray('causali_ritenute') });

useEffect(() => {
    // FIX: Diciamo a React di prendere il primo elemento dell'Array (la riga 0)
 if (data) {
      setForm(data);
    }
  }, [data]);

  // --- MUTATION DI SALVATAGGIO ---
  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      const payload = { ...formData };
      if (payload.AlCassa === '') payload.AlCassa = null;
      if (payload.AliquotaRitenuta === '') payload.AliquotaRitenuta = null;
      if (payload.AliquotaIVA === '') payload.AliquotaIVA = null;

      const res = await fetch(`${API_HOST}/api.php?action=save_fattpaparam`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Errore di salvataggio");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fattpaparam'] });
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'Parametri SDI aggiornati con successo!' });
    },
    onError: (error: any) => {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore di salvataggio', msg: error.message });
    }
  });

  const update = (key: string, value: any) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); saveMutation.mutate(form); };

  const testPath = async (path: string) => {
    if (!path) {
      setFeedback({ isOpen: true, type: 'info', title: 'Attenzione', msg: "Inserisci un percorso prima di testare." });
      return;
    }
    try {
      const res = await fetch(`${API_HOST}/api.php?action=test_directory`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path })
      });
      const result = await res.json();
      setFeedback({ isOpen: true, type: result.success ? 'success' : 'danger', title: 'Test Percorso', msg: result.message });
    } catch (e) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore Server', msg: "Errore di connessione durante il test." });
    }
  };

  if (!auth) { window.location.href = '/'; return null; }

  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1";
  const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
      <div className="p-1.5 bg-primary/10 rounded-md text-primary"><Icon className="w-4 h-4" /></div>
      <h2 className="text-sm font-bold text-foreground">{title}</h2>
    </div>
  );

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <FileCode2 className="w-7 h-7 text-primary" /> Configurazione Flussi SDI
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Gestione globale dei parametri per la Fatturazione Elettronica XML.</p>
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-muted-foreground animate-pulse">Caricamento parametri in corso...</div>
      ) : isError ? (
        <div className="p-12 text-center text-destructive font-bold">Errore di connessione al database.</div>
      ) : (
        <form id="sdi-form" onSubmit={handleSubmit} className="pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* COLONNA SINISTRA */}
            <div className="space-y-6">
              
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <SectionHeader icon={Send} title="1.1 Dati Trasmissione" />
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>Id Paese</label><input type="text" value={form['IdPaese_1-1-1-1'] || ''} onChange={e => update('IdPaese_1-1-1-1', e.target.value)} className={inputClass} maxLength={2} /></div>
                  <div><label className={labelClass}>Id Codice (P.IVA Trans.)</label><input type="text" value={form['IdCodice_1-1-1-2'] || ''} onChange={e => update('IdCodice_1-1-1-2', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Ultimo Invio N.</label><input type="number" value={form.ultimoinvio ?? 0} onChange={e => update('ultimoinvio', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Ultimo Destinatario</label><input type="text" value={form.ultimodestinatario || ''} onChange={e => update('ultimodestinatario', e.target.value)} className={inputClass} maxLength={7} /></div>
                  <div><label className={labelClass}>Formato Trasm.</label><input type="text" value={form['FormatoTrasmissione_1-1-3'] || ''} onChange={e => update('FormatoTrasmissione_1-1-3', e.target.value)} className={`${inputClass} font-mono font-bold text-primary`} /></div>
                  <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div><label className={labelClass}>Telefono Trasm.</label><input type="text" value={form['Telefono_1-1-5-1'] || ''} onChange={e => update('Telefono_1-1-5-1', e.target.value)} className={inputClass} /></div>
                    <div><label className={labelClass}>Email Trasm.</label><input type="email" value={form['Email_1-1-5-2'] || ''} onChange={e => update('Email_1-1-5-2', e.target.value)} className={inputClass} /></div>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <SectionHeader icon={Building2} title="1.2 Cedente / Prestatore" />
                <div className="grid grid-cols-2 gap-4">
                  <div><label className={labelClass}>Id Paese</label><input type="text" value={form['IdPaese_1-2-1-1-1'] || ''} onChange={e => update('IdPaese_1-2-1-1-1', e.target.value)} className={inputClass} maxLength={2} /></div>
                  <div><label className={labelClass}>Id Codice (P.IVA Ced.)</label><input type="text" value={form['IdCodice_1-2-1-1-2'] || ''} onChange={e => update('IdCodice_1-2-1-1-2', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Codice Fiscale</label><input type="text" value={form['CodiceFiscale_1-2-1-2'] || ''} onChange={e => update('CodiceFiscale_1-2-1-2', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Codice EORI</label><input type="text" value={form['CodEORI_1-2-1-3-5'] || ''} onChange={e => update('CodEORI_1-2-1-3-5', e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2"><label className={labelClass}>Denominazione Azienda</label><input type="text" value={form['Denominazione_1-2-1-3-1'] || ''} onChange={e => update('Denominazione_1-2-1-3-1', e.target.value)} className={`${inputClass} font-bold`} /></div>
                  <div><label className={labelClass}>Nome (Pers. Fisica)</label><input type="text" value={form['Nome_1-2-1-3-2'] || ''} onChange={e => update('Nome_1-2-1-3-2', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Cognome (Pers. Fisica)</label><input type="text" value={form['Cognome_1-2-1-3-3'] || ''} onChange={e => update('Cognome_1-2-1-3-3', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Titolo</label><input type="text" value={form['Titolo_1-2-1-3-4'] || ''} onChange={e => update('Titolo_1-2-1-3-4', e.target.value)} className={inputClass} /></div>
                  <div>
                    <label className={labelClass}>Spese Bollo</label>
                    <select value={form.datibollo ?? 2} onChange={e => update('datibollo', +e.target.value)} className={inputClass}>
                      <option value={0}>0 - VIRTUALE</option>
                      <option value={1}>1 - A CARICO CLIENTE</option>
                      <option value={2}>2 - ESENTE</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Regime Fiscale</label>
                    <select value={form['RegimeFiscale_1-2-1-8'] || ''} onChange={e => update('RegimeFiscale_1-2-1-8', e.target.value)} className={inputClass}>
                      <option value="">-- Seleziona Regime --</option>
                      {/* BLINDATURA ARRAY */}
                      {(Array.isArray(regimiData) ? regimiData : []).map((r: any) => (
                        <option key={r.codice} value={r.codice}>{r.codice} - {r.Descrizione}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

            </div>

            {/* COLONNA DESTRA */}
            <div className="space-y-6">
              
              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <SectionHeader icon={MapPin} title="1.2.2 Sede Operativa" />
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-4"><label className={labelClass}>Indirizzo</label><input type="text" value={form['Indirizzo_1-2-2-1'] || ''} onChange={e => update('Indirizzo_1-2-2-1', e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2"><label className={labelClass}>Num. Civico</label><input type="text" value={form['NumeroCivico_1-2-2-2-'] || ''} onChange={e => update('NumeroCivico_1-2-2-2-', e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2"><label className={labelClass}>CAP</label><input type="text" value={form['CAP_1-2-2-3'] || ''} onChange={e => update('CAP_1-2-2-3', e.target.value)} className={inputClass} maxLength={5} /></div>
                  <div className="col-span-4"><label className={labelClass}>Comune</label><input type="text" value={form['Comune_1-2-2-4'] || ''} onChange={e => update('Comune_1-2-2-4', e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2"><label className={labelClass}>Provincia</label><input type="text" value={form['Provincia_1-2-2-5'] || ''} onChange={e => update('Provincia_1-2-2-5', e.target.value)} className={inputClass} maxLength={2} /></div>
                  <div className="col-span-4"><label className={labelClass}>Nazione</label><input type="text" value={form['Nazione_1-2-2-6'] || ''} onChange={e => update('Nazione_1-2-2-6', e.target.value)} className={inputClass} maxLength={2} /></div>
                  <div className="col-span-2"><label className={labelClass}>Telefono</label><input type="text" value={form['Telefono_1-2-5-1'] || ''} onChange={e => update('Telefono_1-2-5-1', e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2"><label className={labelClass}>Fax</label><input type="text" value={form['Fax_1-2-5-2'] || ''} onChange={e => update('Fax_1-2-5-2', e.target.value)} className={inputClass} /></div>
                  <div className="col-span-2"><label className={labelClass}>Email Sede</label><input type="email" value={form['Email_1-2-5-3'] || ''} onChange={e => update('Email_1-2-5-3', e.target.value)} className={inputClass} /></div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <SectionHeader icon={Landmark} title="2.4 Dati Pagamento (Predefiniti XML)" />
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2"><label className={labelClass}>Beneficiario (se diverso)</label><input type="text" value={form['Beneficiario_2-4-2-1'] || ''} onChange={e => update('Beneficiario_2-4-2-1', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Mod. Pagamento</label><input type="text" value={form['ModalitaPagamento_2-4-2-2'] || ''} onChange={e => update('ModalitaPagamento_2-4-2-2', e.target.value)} className={inputClass} placeholder="es. MP05" /></div>
                  <div>
                    <label className={labelClass}>IBAN Predefinito</label>
                    <select value={form['IBAN_2-4-2-13'] || ''} onChange={e => update('IBAN_2-4-2-13', e.target.value)} className={`${inputClass} font-mono`}>
                      <option value="">-- Nessun IBAN --</option>
                      {/* BLINDATURA ARRAY */}
                      {(Array.isArray(bancheData) ? bancheData : []).map((b: any) => (
                        <option key={b.id || b.iban} value={b.id || b.iban}>{b.id || b.iban} ({b.nomebanca})</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
                <SectionHeader icon={Calculator} title="2.5 Gestione Previdenziale e Ritenuta" />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Tipo Cassa</label>
                    <select value={form.TipoCassa || ''} onChange={e => update('TipoCassa', e.target.value)} className={inputClass}>
                      <option value="">-- Nessuna --</option>
                      {/* BLINDATURA ARRAY */}
                      {(Array.isArray(cassaData) ? cassaData : []).map((c: any) => (
                        <option key={c.codice} value={c.codice}>{c.codice} - {c.descrizione}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelClass}>Aliq. Cassa %</label><input type="number" step="0.01" value={form.AlCassa ?? ''} onChange={e => update('AlCassa', e.target.value)} className={inputClass} /></div>
                    <div>
                      <label className={labelClass}>Aliquota IVA</label>
                      <select value={form.AliquotaIVA || ''} onChange={e => update('AliquotaIVA', e.target.value)} className={inputClass}>
                        <option value="">--</option>
                        {/* BLINDATURA ARRAY */}
                        {(Array.isArray(aliquoteData) ? aliquoteData : []).map((a: any) => (
                          <option key={a.Id} value={a.aliquota}>{a.Id} - {a.descrizione}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Tipo Ritenuta</label>
                    <select value={form.TipoRitenuta || ''} onChange={e => update('TipoRitenuta', e.target.value)} className={inputClass}>
                      <option value="">&lt;&lt; Nessuna &gt;&gt;</option>
                      <option value="RT01">RT01 - Pers. Fisiche</option>
                      <option value="RT02">RT02 - Pers. Giuridiche</option>
                      <option value="RT03">RT03 - Contrib. INPS</option>
                      <option value="RT04">RT04 - Contrib. ENASARCO</option>
                      <option value="RT05">RT05 - Contrib. ENPAM</option>
                      <option value="RT06">RT06 - Altro contrib. previd.</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelClass}>Aliq. Rit. %</label><input type="number" step="0.01" value={form.AliquotaRitenuta ?? ''} onChange={e => update('AliquotaRitenuta', e.target.value)} className={inputClass} /></div>
                    <div>
                      <label className={labelClass}>Causale Pag.</label>
                      <select value={form.CausalePagamento || ''} onChange={e => update('CausalePagamento', e.target.value)} className={inputClass}>
                        <option value="">--</option>
                        {/* BLINDATURA ARRAY */}
                        {(Array.isArray(causaliRitData) ? causaliRitData : []).map((c: any) => (
                          <option key={c.codice} value={c.codice}>{c.codice} - {c.Descrizione}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <label className={labelClass}>Natura Esenz. (se IVA zero)</label>
                    <select value={form.Natura || ''} onChange={e => update('Natura', e.target.value)} className={inputClass}>
                      <option value="">-- Nessuna --</option>
                      {/* BLINDATURA ARRAY */}
                      {(Array.isArray(naturaData) ? naturaData : []).map((n: any) => (
                        <option key={n.codice} value={n.codice}>{n.codice} - {n.Descrizione}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-5 shadow-sm">
                <SectionHeader icon={Settings} title="Parametri di Sistema (Cartelle e Link)" />
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className={labelClass}>Cartella XML in Uscita</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.cartellaxml || ''} onChange={e => update('cartellaxml', e.target.value)} className={`${inputClass} flex-1`} placeholder="Es. C:\XML\OUT" />
                      <button type="button" onClick={() => setBrowserConfig({ isOpen: true, field: 'cartellaxml', currentPath: form.cartellaxml || 'C:\\' })} className="px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md border border-blue-200 transition-colors" title="Sfoglia cartelle Server">
                        <FolderSearch className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => testPath(form.cartellaxml)} className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors" title="Verifica Accesso Cartella">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}>Cartella XML in Entrata</label>
                    <div className="flex gap-2">
                      <input type="text" value={form.cartellaxml_in || ''} onChange={e => update('cartellaxml_in', e.target.value)} className={`${inputClass} flex-1`} placeholder="Es. C:\XML\IN" />
                      <button type="button" onClick={() => setBrowserConfig({ isOpen: true, field: 'cartellaxml_in', currentPath: form.cartellaxml_in || 'C:\\' })} className="px-3 py-2 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-md border border-blue-200 transition-colors" title="Sfoglia cartelle Server">
                        <FolderSearch className="w-4 h-4" />
                      </button>
                      <button type="button" onClick={() => testPath(form.cartellaxml_in)} className="px-3 py-2 bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-md border border-gray-200 transition-colors" title="Verifica Accesso Cartella">
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div><label className={labelClass}>Cartella Import Files Esterni</label><input type="text" value={form.cartella_import || ''} onChange={e => update('cartella_import', e.target.value)} className={inputClass} /></div>
                  <div><label className={labelClass}>Link Web Upload Fatture (Aruba/SDI)</label><input type="text" value={form.linkupload || ''} onChange={e => update('linkupload', e.target.value)} className={`${inputClass} text-blue-600 font-mono`} /></div>
                  <div>
                    <label className={labelClass}>Profilo SW (Export Fatture Ricevute)</label>
                    <select value={form.profilosw || 1} onChange={e => update('profilosw', +e.target.value)} className={inputClass}>
                      <option value={1}>1 - Formato Standard Multi-V</option>
                      <option value={2}>2 - Formato Avanzato</option>
                    </select>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-40">
            <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground font-medium">I parametri salvati verranno applicati immediatamente a tutte le nuove fatture generate.</span>
              <button 
                type="submit" 
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 px-8 py-3 rounded-lg bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-md"
              >
                {saveMutation.isPending ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                {saveMutation.isPending ? 'Salvataggio in corso...' : 'SALVA CONFIGURAZIONE SDI'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* --- MODALE DI CONFERMA / SUCCESSO --- */}
      <ConfirmDialog 
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={feedback.msg}
        onClose={() => {
          setFeedback({ ...feedback, isOpen: false });
          if (feedback.type === 'success-auto') {
            navigate('/');
          }
        }}
      />

      {/* --- MODALE BROWSER RISORSE SERVER --- */}
      {browserConfig.isOpen && (
        <ServerFolderBrowser 
          initialPath={browserConfig.currentPath}
          onSelect={(selectedPath) => {
            update(browserConfig.field, selectedPath);
            setBrowserConfig({ isOpen: false, field: '', currentPath: '' });
          }}
          onClose={() => setBrowserConfig({ isOpen: false, field: '', currentPath: '' })}
          onError={(msg) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore Server', msg })}
        />
      )}

    </AppLayout>
  );
};

const ServerFolderBrowser = ({ initialPath, onSelect, onClose, onError }: { initialPath: string, onSelect: (p: string) => void, onClose: () => void, onError: (msg: string) => void }) => {
  const [currentPath, setCurrentPath] = useState(initialPath || 'C:\\');
  const [parentPath, setParentPath] = useState('');
  const [folders, setFolders] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFolders = async (path: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=browse_directory&path=${encodeURIComponent(path)}`);
      const data = await res.json();
      if (data.success) {
        setCurrentPath(data.current || '');
        setParentPath(data.parent || '');
        setFolders(Array.isArray(data.folders) ? data.folders : []);
      } else {
        onError("Errore nella lettura della cartella dal server.");
      }
    } catch (e) {
      onError("Errore di connessione al server.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFolders(currentPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-lg flex flex-col overflow-hidden animate-fade-in">
        <div className="px-6 py-4 bg-secondary/50 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground flex items-center gap-2">
            <FolderSearch className="w-5 h-5 text-primary" /> Esplora Risorse Server
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-destructive"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 bg-background border-b border-border">
          <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Percorso Attuale</label>
          <div className="flex gap-2">
            <input type="text" value={currentPath} onChange={e => setCurrentPath(e.target.value)} className="w-full px-3 py-2 text-sm font-mono border border-input rounded-md outline-none focus:border-primary" />
            <button onClick={() => fetchFolders(currentPath)} className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md font-bold text-sm border border-border hover:bg-secondary/80">VAI</button>
          </div>
        </div>
        <div className="p-2 overflow-y-auto max-h-[40vh] custom-scrollbar bg-background">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground animate-pulse">Caricamento...</div>
          ) : (
            <div className="flex flex-col gap-1">
              {parentPath && (
                <button onClick={() => fetchFolders(parentPath)} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary rounded-lg text-left transition-colors font-bold text-primary">
                  <ChevronLeft className="w-5 h-5" /> [ Livello Superiore ]
                </button>
              )}
              {/* BLINDATURA FINALE */}
              {(Array.isArray(folders) ? folders : []).length === 0 && <div className="p-4 text-center text-muted-foreground text-sm">Nessuna sottocartella trovata.</div>}
              {(Array.isArray(folders) ? folders : []).map(folder => (
                <button key={folder} onClick={() => fetchFolders(`${currentPath}\\${folder}`)} className="flex items-center gap-3 px-4 py-2 hover:bg-secondary rounded-lg text-left transition-colors">
                  <Folder className="w-5 h-5 text-amber-500 fill-amber-200" /> <span className="font-medium">{folder}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="px-6 py-4 bg-secondary/50 border-t border-border flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-muted-foreground hover:bg-background border border-transparent hover:border-input">Annulla</button>
          <button onClick={() => onSelect(currentPath)} className="px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 shadow-sm">Seleziona questa cartella</button>
        </div>
      </div>
    </div>
  );
};

export default ConfigurazioneSdiPage;