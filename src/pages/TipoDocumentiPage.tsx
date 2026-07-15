import { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Pencil, Trash2, X, Save } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import ConfirmDialog from '@/components/ConfirmDialog';

const TipoDocumentiPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [data, setData] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{isOpen: boolean, type: any, title: string, msg: string}>({ isOpen: false, type: 'info', title: '', msg: '' });

  const { data: apiData, isLoading, isError } = useTipiDocumento();
  const { data: causaliData =[] } = useCausali();
  const { data: tipologieData =[] } = useTipologieMovimento();

  useEffect(() => {
    if (apiData) setData(apiData);
  }, [apiData]);

  const filteredData = useMemo(() => {
    if (!searchQuery) return data;
    const q = searchQuery.toLowerCase();
    return data.filter(item => (item.descrizione || '').toLowerCase().includes(q) || (item.suffisso || '').toLowerCase().includes(q));
  },[data, searchQuery]);

  const handleNew = () => { setEditingRecord(null); setShowModal(true); };
  const handleEdit = (record: any) => { setEditingRecord(record); setShowModal(true); };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_tipodoc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Errore durante l'eliminazione");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['tipi_documento'] });
      setShowModal(false);
      setConfirmDelete(null);
      setFeedback({ isOpen: true, type: 'success', title: 'Eliminato', msg: 'Tipo documento rimosso con successo.' });
    },
    onError: (err: any) => {
      setConfirmDelete(null);
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message });
    }
  });

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_tipodoc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(record)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || "Errore durante il salvataggio");
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey:['tipi_documento'] });
      setShowModal(false);
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvato', msg: 'Tipo documento salvato correttamente.' });
    },
    onError: (err: any) => {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message });
    }
  });

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tipi Documento</h1>
          <p className="text-sm text-muted-foreground">Gestione dei documenti e automazione contabile.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-bold text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-5 h-5" /> Nuovo Tipo Documento
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-6 p-4 animate-fade-in">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Cerca per descrizione o suffisso..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-input bg-background text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50" />
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:flex lg:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20 animate-fade-in" style={{ animationDelay: '100ms' }}>
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-16">ID</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-24">Suffisso</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-28">Cli/For</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">D/A</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-28">Magazzino</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-32">Azione</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Caricamento...</td></tr>}
            {!isLoading && filteredData.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Nessun tipo documento trovato.</td></tr>}
            {!isLoading && filteredData.map((item, idx) => (
              <tr 
                key={item.id} 
                onClick={() => handleEdit(item)} // Intera riga cliccabile
                className={`hover:bg-muted/40 transition-colors cursor-pointer ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}
              >
                <td className="px-4 py-3 text-mono text-muted-foreground font-bold">{item.id}</td>
                <td className="px-4 py-3 font-mono font-bold text-primary"><span className="bg-primary/10 px-2 py-0.5 rounded">{item.suffisso || '-'}</span></td>
                <td className="px-4 py-3 font-medium text-foreground">{item.descrizione}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-secondary text-secondary-foreground">
                    {Number(item.clifor) === 1 ? 'CLIENTE' : Number(item.clifor) === 2 ? 'FORNITORE' : 'NESSUNO'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${item.da === '+' ? 'bg-emerald-100 text-emerald-700' : item.da === '-' ? 'bg-red-100 text-red-700' : 'bg-secondary text-muted-foreground'}`}>
                    {item.da === '+' ? '+ (DARE)' : item.da === '-' ? '- (AVERE)' : 'NESSUNO'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`inline-flex px-2 py-1 rounded text-[10px] font-bold ${item.movmagaz === 'C' ? 'bg-emerald-100 text-emerald-700' : item.movmagaz === 'S' ? 'bg-red-100 text-red-700' : 'bg-secondary text-muted-foreground'}`}>
                    {item.movmagaz === 'C' ? 'CARICO' : item.movmagaz === 'S' ? 'SCARICO' : 'NESSUNO'}
                  </span>
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleEdit(item)} className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm mx-auto">
                    <Pencil className="w-3.5 h-3.5" /> MODIFICA
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile / Tablet Cards (Stile Compatto Flex) */}
      <div className="lg:hidden grid grid-cols-1 md:grid-cols-2 gap-3 pb-24">
        {!isLoading && filteredData.map(item => (
          <div 
            key={item.id} 
            onClick={() => handleEdit(item)}
            className="bg-card rounded-xl border border-border p-4 shadow-sm hover:shadow-md active:scale-[0.98] transition-all cursor-pointer animate-fade-in flex flex-col justify-center"
          >
            {/* RIGA 1: ID, Suffisso e Modifica */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-mono text-muted-foreground bg-secondary px-1.5 py-0.5 rounded shrink-0">ID: {item.id}</span>
              <span className="text-[12px] font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0">{item.suffisso || '-'}</span>
              
              <button onClick={(e) => { e.stopPropagation(); handleEdit(item); }} className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors text-[10px] font-bold shadow-sm shrink-0">
                <Pencil className="w-3 h-3" /> MODIFICA
              </button>
            </div>
            
            {/* RIGA 2: Descrizione */}
            <h3 className="text-sm font-bold text-foreground mb-3 leading-snug line-clamp-2">{item.descrizione}</h3>
            
            {/* RIGA 3: Badges */}
            <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-border/50">
              <span className="text-[10px] font-bold bg-secondary px-2 py-0.5 rounded text-muted-foreground">
                {Number(item.clifor) === 1 ? 'CLIENTE' : Number(item.clifor) === 2 ? 'FORNITORE' : 'NO CLI/FOR'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.da === '+' ? 'bg-emerald-100 text-emerald-700' : item.da === '-' ? 'bg-red-100 text-red-700' : 'bg-secondary text-muted-foreground'}`}>
                {item.da === '+' ? '+ (DARE)' : item.da === '-' ? '- (AVERE)' : 'NO D/A'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.movmagaz === 'C' ? 'bg-emerald-100 text-emerald-700' : item.movmagaz === 'S' ? 'bg-red-100 text-red-700' : 'bg-secondary text-muted-foreground'}`}>
                {item.movmagaz === 'C' ? 'CARICO' : item.movmagaz === 'S' ? 'SCARICO' : 'NO MAGAZZ.'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <TipoDocFormModal 
          record={editingRecord} 
          causali={causaliData} 
          tipologie={tipologieData} 
          onSave={(rec) => saveMutation.mutate(rec)} 
          onClose={() => setShowModal(false)}
          onDeleteRequest={(id) => setConfirmDelete(id)}
          isSaving={saveMutation.isPending}
        />
      )}

      {/* CONFIRM ELIMINAZIONE */}
      <ConfirmDialog 
        isOpen={!!confirmDelete} 
        title="Elimina Tipo Documento" 
        type="danger" 
        message={<>Sei sicuro di voler eliminare questo tipo di documento dall'archivio?<br/>L'operazione non è reversibile.</>} 
        onClose={() => setConfirmDelete(null)} 
        onConfirm={() => deleteMutation.mutate(confirmDelete as number)} 
        isPending={deleteMutation.isPending} 
      />

      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback(p=>({...p, isOpen:false}))} />
    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO (Ridisegnato e "Shrink-0") ---
const TipoDocFormModal = ({ record, causali, tipologie, onSave, onClose, onDeleteRequest, isSaving }: any) => {
  const isEdit = !!record;
  const [form, setForm] = useState<any>(record || {
    id: '', descrizione: '', suffisso: '', codtipo: '', ordine_vis: 1,
    clifor: 0, movmagaz: '', da: '', idmastro: 0, idmovpnota: 0, idmovscad: 0
  });

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(form); };

  const tipologieFiltrate = form.idmastro 
    ? tipologie.filter((t: any) => Number(t.idcausale) === Number(form.idmastro))
    : tipologie;

  const inputClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  // ELENCO UFFICIALE CODICI SDI (AGENZIA DELLE ENTRATE)
  const codiciSDI = [
    { code: 'TD01', desc: 'Fattura' },
    { code: 'TD02', desc: 'Acconto/Anticipo su fattura' },
    { code: 'TD03', desc: 'Acconto/Anticipo su parcella' },
    { code: 'TD04', desc: 'Nota di Credito' },
    { code: 'TD05', desc: 'Nota di Debito' },
    { code: 'TD06', desc: 'Parcella' },
    { code: 'TD16', desc: 'Integrazione fattura reverse charge' },
    { code: 'TD17', desc: 'Integrazione/Autofattura acquisto servizi estero' },
    { code: 'TD18', desc: 'Integrazione acquisto beni art.17' },
    { code: 'TD19', desc: 'Integrazione/Autofattura acquisto beni art.17' },
    { code: 'TD20', desc: 'Autofattura regolarizzazione splafonamento' },
    { code: 'TD24', desc: 'Fattura differita (art.21 c.4 lett. a)' },
    { code: 'TD25', desc: 'Fattura differita triangolare (art.21 c.4 lett. b)' },
    { code: 'TD26', desc: 'Cessione di beni ammortizzabili' },
    { code: 'TD27', desc: 'Fattura autoconsumo / cessioni gratuite' }
  ];
  
  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-4xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col animate-fade-up sm:animate-fade-in">
        
        {/* HEADER MODALE */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-slate-800 text-white sm:rounded-t-xl shrink-0">
          <h3 className="text-lg font-bold tracking-wide">{isEdit ? `Modifica Tipo: ${form.descrizione}` : 'Nuovo Tipo Documento'}</h3>
          <button onClick={onClose} disabled={isSaving} className="p-2 rounded-full hover:bg-white/20 transition-colors disabled:opacity-50"><X className="w-5 h-5" /></button>
        </div>
        
        {/* CORPO MODALE */}
        <form id="tipodoc-form" onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-8 min-h-0 bg-slate-50/50">
          
          <div className="space-y-6 bg-card p-5 rounded-xl border border-border shadow-sm">
            <h4 className="font-bold text-primary border-b border-border pb-2 text-sm uppercase tracking-wider">Identificazione</h4>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="w-full sm:w-20 shrink-0">
                <label className={labelClass}>ID *</label>
                <input type="text" value={form.id || 'Auto'} disabled className={`${inputClass} bg-secondary/50 font-mono font-bold text-center text-muted-foreground`} />
              </div>
              <div className="w-full sm:flex-1">
                <label className={labelClass}>Descrizione *</label>
                <input type="text" value={form.descrizione || ''} onChange={e => setForm({ ...form, descrizione: e.target.value })} className={inputClass} placeholder="es. Fattura Accompagnatoria" required />
              </div>
              <div className="w-full sm:w-24 shrink-0">
                <label className={labelClass}>Suffisso</label>
                <input type="text" value={form.suffisso || ''} onChange={e => setForm({ ...form, suffisso: e.target.value })} className={`${inputClass} border-primary/50 text-center font-bold`} />
              </div>

			<div className="w-full sm:w-64 shrink-0">
              <label className={`${labelClass} text-blue-600 truncate`} title="Codice Identificativo SDI (Es. TD01)">Cod. SDI (Fatt.Elettr)</label>
              <select 
                value={form.codtipo || ''} 
                onChange={e => setForm({ ...form, codtipo: e.target.value })} 
                className={`${inputClass} border-blue-300 bg-blue-50 font-bold cursor-pointer text-blue-900`}
              >
                <option value="">-- NESSUNO (Non Elettronico) --</option>
                {codiciSDI.map(sdi => (
                  <option key={sdi.code} value={sdi.code}>
                    {sdi.code} - {sdi.desc}
                  </option>
                ))}
              </select>
            </div>

              <div className="w-full sm:w-24 shrink-0">
                <label className={labelClass}>Ordine Vis.</label>
                <input type="number" value={form.ordine_vis ?? 1} onChange={e => setForm({ ...form, ordine_vis: +e.target.value })} className={`${inputClass} text-center`} />
              </div>
            </div>
          </div>

          <div className="space-y-6 bg-card p-5 rounded-xl border border-border shadow-sm">
            <h4 className="font-bold text-primary border-b border-border pb-2 text-sm uppercase tracking-wider">Comportamento</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Anagrafica Richiesta (Cli/For)</label>
                <select value={Number(form.clifor) || 0} onChange={e => setForm({ ...form, clifor: +e.target.value })} className={inputClass}>
                  <option value={0}>0 - Nessuna Anagrafica Specifica</option>
                  <option value={1}>1 - Solo Cliente</option>
                  <option value={2}>2 - Solo Fornitore</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Movimento di Magazzino Automatico</label>
                <select value={form.movmagaz || ''} onChange={e => setForm({ ...form, movmagaz: e.target.value })} className={inputClass}>
                  <option value="">-- Non Movimenta Magazzino --</option>
                  <option value="C">C - Genera un CARICO</option>
                  <option value="S">S - Genera uno SCARICO</option>
                </select>
              </div>
            </div>
          </div>

          <fieldset className="border border-emerald-200 rounded-xl p-5 bg-emerald-50/30 shadow-sm">
            <legend className="text-sm font-bold text-emerald-700 px-3 py-1 bg-emerald-100 rounded-lg border border-emerald-200 uppercase tracking-wider">Automazione Contabilità</legend>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              <div>
                <label className={labelClass}>Registrazione (D-A)</label>
                <select value={form.da || ''} onChange={e => setForm({ ...form, da: e.target.value })} className={`${inputClass} font-bold ${form.da === '+' ? 'text-emerald-700' : form.da === '-' ? 'text-red-700' : ''}`}>
                  <option value="">Non va in Contabilità</option>
                  <option value="+">+ (Segno DARE)</option>
                  <option value="-">- (Segno AVERE)</option>
                </select>
              </div>
              <div className={`${!form.da ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className={labelClass}>Mastro Contabile</label>
                <select value={Number(form.idmastro) || 0} onChange={e => setForm({ ...form, idmastro: +e.target.value, idmovpnota: 0, idmovscad: 0 })} className={inputClass}>
                  <option value={0}>-- Seleziona Mastro --</option>
                  {causali.map((c: any) => <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>)}
                </select>
              </div>
              <div className={`${!form.idmastro ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className={labelClass}>Sottoconto Prima Nota</label>
                <select value={Number(form.idmovpnota) || 0} onChange={e => setForm({ ...form, idmovpnota: +e.target.value })} className={inputClass}>
                  <option value={0}>-- Seleziona Sottoconto --</option>
                  {tipologieFiltrate.map((t: any) => <option key={t.id} value={t.id}>{t.codice} - {t.Descrizione}</option>)}
                </select>
              </div>
              <div className={`${!form.idmastro ? 'opacity-50 pointer-events-none' : ''}`}>
                <label className={labelClass}>Sottoconto Scadenzario</label>
                <select value={Number(form.idmovscad) || 0} onChange={e => setForm({ ...form, idmovscad: +e.target.value })} className={inputClass}>
                  <option value={0}>-- Seleziona Sottoconto --</option>
                  {tipologieFiltrate.map((t: any) => <option key={t.id} value={t.id}>{t.codice} - {t.Descrizione}</option>)}
                </select>
              </div>
            </div>
          </fieldset>

        </form>

        {/* FOOTER MODALE (Pulsantiera Professionale come richiesto) */}
        <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-4 px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0">
          
          <div className="w-full sm:w-auto">
            {isEdit && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(form.id)} 
                disabled={isSaving}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> Elimina
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            <button 
              type="button" 
              onClick={onClose} 
              disabled={isSaving}
              className="w-full sm:w-auto flex items-center justify-center px-6 py-3 sm:py-2.5 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
            >
              Annulla
            </button>
            <button 
              type="submit" 
              form="tipodoc-form" 
              disabled={isSaving} 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
            >
              <Save className="w-4 h-4" />
              {isEdit ? 'Salva Modifiche' : 'Crea Tipo'}
            </button>
          </div>
          
        </div>

      </div>
    </div>
  );
};

export default TipoDocumentiPage;