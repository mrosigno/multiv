import { useState, useEffect } from 'react';
import { Save, Building2, Printer, Image as ImageIcon, Mail, Users } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import ComunicazioniModal from '@/components/ComunicazioniModal';
import UtentiModal from '@/components/UtentiModal';
import { useAzienda } from '@/hooks/api/useAzienda';
import { useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

export default function ImpostazioniAziendaPage() {
  const queryClient = useQueryClient();
  const { data: aziendaData, isLoading } = useAzienda();
  
  const [form, setForm] = useState({
    Titolo: '', RagioneSociale1: '', RagioneSociale2: '', RagioneSociale3: '', RagioneSociale4: '',
    larg: 5.0, alt: 2.5, stampalogo: -1, piepag: 0.0, piepag2: 0.0
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showMailModal, setShowMailModal] = useState(false);
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [feedback, setFeedback] = useState({ isOpen: false, type: 'success-auto', title: '', msg: '' });

  useEffect(() => {
    if (aziendaData && aziendaData.length > 0) {
      const az = aziendaData[0];
      setForm({
        Titolo: az.Titolo || az.suffisso || '',
        RagioneSociale1: az.RagioneSociale1 || '', RagioneSociale2: az.RagioneSociale2 || '',
        RagioneSociale3: az.RagioneSociale3 || '', RagioneSociale4: az.RagioneSociale4 || '',
        larg: Number(az.larg) || 5.0, alt: Number(az.alt) || 2.5,
        stampalogo: Number(az.stampalogo), piepag: Number(az.piepag) || 0, piepag2: Number(az.piepag2) || 0
      });
    }
  }, [aziendaData]);

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch(`${API_HOST}/api.php?action=save_azienda`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['azienda'] });
        setFeedback({ isOpen: true, type: 'success-auto', title: 'Impostazioni Salvate', msg: 'Parametri aggiornati correttamente.' });
      } else setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: data.message });
    } catch (e) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: 'Impossibile contattare il server.' });
    } finally { setIsSaving(false); }
  };

  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5";

  if (isLoading) return <AppLayout onLogout={() => {}}><div className="flex items-center justify-center h-64 text-muted-foreground">Caricamento impostazioni...</div></AppLayout>;

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
{/* HEADER CON I DUE NUOVI BOTTONI E IL SALVA */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Parametri Aziendali</h1>
          <p className="text-sm text-muted-foreground hidden sm:block">Gestisci anagrafica, operatori e comunicazioni.</p>
        </div>
        
        {/* FIX: Griglia a 2 colonne su mobile, flex in linea su Desktop. Testi accorciati su schermi piccoli */}
        <div className="grid grid-cols-2 md:flex items-center justify-end gap-2 w-full md:w-auto">
          <button onClick={() => setShowUsersModal(true)} className="w-full md:w-auto flex items-center justify-center gap-1.5 px-3 py-2.5 bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold rounded-lg hover:bg-emerald-100 transition-colors shadow-sm text-xs sm:text-sm">
            <Users className="w-4 h-4" /> <span className="hidden sm:inline">Gestione </span>Operatori
          </button>
          
          <button onClick={() => setShowMailModal(true)} className="w-full md:w-auto flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 text-blue-700 border border-blue-200 font-bold rounded-lg hover:bg-blue-100 transition-colors shadow-sm text-xs sm:text-sm">
            <Mail className="w-4 h-4" /> Modelli<span className="hidden sm:inline"> Email</span>
          </button>

          <button onClick={handleSave} disabled={isSaving} className="col-span-2 md:col-span-1 w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity shadow-sm disabled:opacity-50 text-xs sm:text-sm">
            <Save className="w-4 h-4 shrink-0" /> {isSaving ? 'Salvataggio...' : 'Salva Impostazioni'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
        
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col h-full animate-fade-in">
          <div className="bg-secondary/30 px-6 py-4 border-b border-border flex items-center gap-3">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">Anagrafica Intestazione</h2>
          </div>
          <div className="p-6 space-y-5 flex-1">
            <div><label className={labelClass}>Titolo / Ragione Sociale Breve</label><input type="text" value={form.Titolo} onChange={e => update('Titolo', e.target.value)} className={`${inputClass} font-bold text-base`} placeholder="es. * G.L. *" /></div>
            <div><label className={labelClass}>Ragione Sociale Completa (Riga 1)</label><input type="text" value={form.RagioneSociale1} onChange={e => update('RagioneSociale1', e.target.value)} className={inputClass} placeholder="es. G.L. Informatica..." /></div>
            <div><label className={labelClass}>Indirizzo e Sede (Riga 2)</label><input type="text" value={form.RagioneSociale2} onChange={e => update('RagioneSociale2', e.target.value)} className={inputClass} placeholder="es. Via Bruno Buozzi, 74B" /></div>
            <div><label className={labelClass}>Contatti Telefonici / Mail (Riga 3)</label><input type="text" value={form.RagioneSociale3} onChange={e => update('RagioneSociale3', e.target.value)} className={inputClass} placeholder="es. tel 0564... MAIL: info@..." /></div>
            <div><label className={labelClass}>Partita IVA e Codice Fiscale (Riga 4)</label><input type="text" value={form.RagioneSociale4} onChange={e => update('RagioneSociale4', e.target.value)} className={inputClass} placeholder="es. P.IVA 0123... - Cod.Fisc. ..." /></div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col h-full animate-fade-in" style={{ animationDelay: '100ms' }}>
          <div className="bg-secondary/30 px-6 py-4 border-b border-border flex items-center gap-3">
            <Printer className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold text-foreground">Layout Documenti (Stampa / PDF)</h2>
          </div>
          <div className="p-6 space-y-5 flex-1">
            <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl flex items-start gap-3 text-blue-800">
              <ImageIcon className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold mb-1">Gestione File Grafici</p>
                <ul className="list-disc pl-4 font-mono text-xs space-y-0.5">
                  <li><strong>logo.png</strong> (Testata del documento)</li><li><strong>sotto_logo.png</strong> (Piè di pagina, sempre in PDF)</li>
                </ul>
                <p className="mt-2 text-[11px] opacity-80">Inserire fisicamente nella cartella <code className="bg-white/50 px-1 rounded">public</code> della Web-App.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className={labelClass}>Larghezza Logo (cm)</label><input type="number" step="0.1" value={form.larg} onChange={e => update('larg', +e.target.value)} className={`${inputClass} font-mono`} /></div>
              <div><label className={labelClass}>Altezza Logo (cm)</label><input type="number" step="0.1" value={form.alt} onChange={e => update('alt', +e.target.value)} className={`${inputClass} font-mono`} /></div>
            </div>
            <div className="pt-2 border-t border-border">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-secondary/50 transition-colors border border-transparent hover:border-border">
                <input type="checkbox" checked={form.stampalogo === -1} onChange={e => update('stampalogo', e.target.checked ? -1 : 0)} className="w-5 h-5 text-primary rounded border-input cursor-pointer" />
                <div><span className="block text-sm font-bold text-foreground">Stampa Logo su Carta</span><span className="block text-xs text-muted-foreground">Includi il logo e sottologo durante la stampa diretta.</span></div>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
              <div><label className={labelClass}>Pie Pagina Carta (Pollici)</label><input type="number" step="0.01" value={form.piepag} onChange={e => update('piepag', +e.target.value)} className={`${inputClass} font-mono`} /></div>
              <div><label className={labelClass}>Pie Pagina PDF (Pollici)</label><input type="number" step="0.01" value={form.piepag2} onChange={e => update('piepag2', +e.target.value)} className={`${inputClass} font-mono`} /></div>
            </div>
          </div>
        </div>

      </div>

      {showMailModal && <ComunicazioniModal onClose={() => setShowMailModal(false)} />}
      {showUsersModal && <UtentiModal onClose={() => setShowUsersModal(false)} />}
      
      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={() => setFeedback({ ...feedback, isOpen: false })} />
    </AppLayout>
  );
}