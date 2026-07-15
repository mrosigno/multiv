import React, { useState } from 'react';
import { X, Save, Trash2, History, Eye } from 'lucide-react';
import { useBrand } from '@/hooks/api/useBrand';
import { useReparti } from '@/hooks/api/useReparti';
import { useAliquote } from '@/hooks/api/useAliquote';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useCategorieArticoli, useSottocategorieArticoli, useUnitaMisuraArticoli } from '@/hooks/api/useArticoli';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess'; 
import ConfirmDialog from '@/components/ConfirmDialog';

import MovimentiMagazzinoViewerModal from './MovimentiMagazzinoViewerModal'; 

interface Props {
  articolo?: any | null;
  readOnly?: boolean;
  onSave: (articolo: any) => void;
  onClose: () => void;
}

export default function ArticoloFormModal({ articolo, readOnly, onSave, onClose }: Props) {
  const queryClient = useQueryClient();
  const isEdit = !!(articolo && (articolo.id || (articolo as any).ID || articolo.Codice));
  
  const auth = useAuthAccess();
  // Regola di blocco: Se stiamo aprendo un record esistente e NON siamo Livello 2 o >= 4
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  const isReadOnly = isEdit && !canEditExisting;

  const [form, setForm] = useState<any>(articolo || {
    Codice: '', Cod_Prisma: '', Descrizione: '', UnMis: 'PZ',
    esistenza: 0, ultprzacq: 0, Listino1: 0, Listino2: 0, Listino3: 0, Listino4: 0, Listino5: 0, Listino6: 0,
    scorta_minima: 0, sconto1: 0, sconto2: 0, sconto3: 0, peso: 0,
    codiva: 1, magaz: 1, sottocateg: '', brand: '', reparto: 0, barcode: 0, codice2: ''
  });

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showMovimenti, setShowMovimenti] = useState(false); 

  const [feedback, setFeedback] = useState<{
    isOpen: boolean; type: any; title: string; msg: string;
    action?: 'save' | 'delete' | 'cancel' | 'none'; payload?: any;
  }>({ isOpen: false, type: 'info', title: '', msg: '' });

  const handleFeedbackClose = () => {
    const { action, payload } = feedback;
    setFeedback(prev => ({ ...prev, isOpen: false }));
    if (action === 'save') onSave(payload);
    else if (action === 'delete' || action === 'cancel') onClose(); 
  };

  const { data: brandData =[] } = useBrand();
  const { data: repartiData =[] } = useReparti();
  const { data: aliquoteData =[] } = useAliquote();
  const { data: magazziniData =[] } = useMagazzini();
  const { data: categorieData =[] } = useCategorieArticoli();
  const { data: sottocategorieData =[] } = useSottocategorieArticoli();
  const { data: umData =[] } = useUnitaMisuraArticoli();

  const update = (key: string, value: any) => { 
    if (isReadOnly) return; // Blocco sicurezza
    setForm((prev: any) => ({ ...prev, [key]: value })); 
  };

  const saveMutation = useMutation({
    mutationFn: async (formData: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_articolo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['articoli'] });
      queryClient.invalidateQueries({ queryKey: ['categorie_articoli'] });
      queryClient.invalidateQueries({ queryKey: ['sottocategorie_articoli'] });
      queryClient.invalidateQueries({ queryKey: ['unita_misura_articoli'] });
      setFeedback({ isOpen: true, type: 'success-auto', title: 'Salvataggio Completato', msg: 'L\'articolo è stato salvato.', action: 'save', payload: { ...form, id: data.id || form.id } });
    },
    onError: (err: any) => setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message, action: 'none' })
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_articolo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articoli'] });
      setConfirmDelete(false);
      setFeedback({ isOpen: true, type: 'success', title: 'Articolo Eliminato', msg: 'Rimosso definitivamente.', action: 'delete' });
    },
    onError: (err: any) => {
      setConfirmDelete(false);
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: err.message, action: 'none' });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly) return; // Blocco sicurezza
    saveMutation.mutate(form);
  };

  const handleCancelForm = () => { setFeedback({ isOpen: true, type: 'cancel-auto', title: 'Operazione Annullata', msg: '', action: 'cancel' }); };
  const handleCancelDelete = () => { setConfirmDelete(false); setFeedback({ isOpen: true, type: 'cancel-auto', title: 'Eliminazione Annullata', msg: '', action: 'none' }); };
  const handleCloseModal = () => { if (isReadOnly) onClose(); else handleCancelForm(); };

  // Aggiunto effetto visivo di blocco
  const inputClass = `w-full px-3 py-2 rounded-lg border border-input text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-70 disabled:cursor-not-allowed ${isReadOnly ? 'bg-secondary/30 text-muted-foreground' : 'bg-background text-foreground'}`;
  const labelClass = "block text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-1";
  const fieldsetClass = "border border-border rounded-lg p-5 bg-card/50 shadow-sm";
  const legendClass = "text-sm font-bold text-primary px-2 bg-background rounded-md border border-border";
  const umOptions = umData.includes('PZ') ? umData : ['PZ', ...umData];

  return (
    <>
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={handleCloseModal}>
        <div onClick={e => e.stopPropagation()} className="bg-card rounded-t-2xl sm:rounded-xl border border-border shadow-2xl w-full h-[100dvh] sm:h-auto max-w-5xl max-h-[100dvh] sm:max-h-[95vh] flex flex-col animate-fade-up sm:animate-fade-in">
          
          {/* HEADER */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-card sm:rounded-t-xl shrink-0">
            <div className="flex items-center gap-3">
              <h3 className="text-base sm:text-lg font-bold text-foreground truncate mr-2 flex items-center gap-2">
                {isReadOnly && <Eye className="w-5 h-5 text-blue-500" />}
                {isReadOnly ? `Scheda Articolo: ${form.Codice}` : isEdit ? `Modifica: ${form.Codice}` : 'Nuovo Articolo'}
              </h3>
              {isReadOnly && (
                <span className="hidden sm:inline-flex px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase rounded border border-red-200 shrink-0">
                  Sola Lettura
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2 shrink-0">
              {isEdit && (
                <button 
                  type="button" 
                  onClick={() => setShowMovimenti(true)} 
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-600 hover:text-white border border-amber-200 rounded-lg transition-colors text-[10px] sm:text-xs font-bold shadow-sm"
                >
                  <History className="w-4 h-4" /> <span className="hidden sm:inline">MOVIMENTI E RIMANENZE</span><span className="sm:hidden">MOVIMENTI</span>
                </button>
              )}
              <button onClick={handleCloseModal} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <form id="articolo-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 custom-scrollbar min-h-0">
            
            <fieldset className={fieldsetClass} disabled={isReadOnly}>
              <legend className={legendClass}>Anagrafica Base</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className={`${labelClass} text-destructive font-bold`}>Codice / Barcode *</label>
                  <input type="text" value={form.Codice || ''} onChange={e => update('Codice', e.target.value.toUpperCase())} className={`${inputClass} font-mono font-bold text-primary`} required disabled={isReadOnly} />
                </div>
                <div className="md:col-span-6">
                  <label className={labelClass}>Descrizione *</label>
                  <input type="text" value={form.Descrizione || ''} onChange={e => update('Descrizione', e.target.value)} className={inputClass} required disabled={isReadOnly} />
                </div>
                <div className="md:col-span-3">
                  <label className={`${labelClass} text-destructive font-bold`}>Codice Secondario</label>
                  <input type="text" value={form.codice2 || ''} onChange={e => update('codice2', e.target.value)} className={`${inputClass} font-mono`} disabled={isReadOnly} />
                </div>

                <div className="md:col-span-4">
                  <label className={labelClass}>Categoria (Cod. Prisma)</label>
                  <input type="text" list="categorie-list" value={form.Cod_Prisma || ''} onChange={e => update('Cod_Prisma', e.target.value)} className={inputClass} placeholder="Scrivi o seleziona..." disabled={isReadOnly} />
                  <datalist id="categorie-list">
                    {categorieData.map((c: string) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div className="md:col-span-4">
                  <label className={labelClass}>Sottocategoria</label>
                  <input type="text" list="sottocategorie-list" value={form.sottocateg || ''} onChange={e => update('sottocateg', e.target.value)} className={inputClass} placeholder="Scrivi o seleziona..." disabled={isReadOnly} />
                  <datalist id="sottocategorie-list">
                    {sottocategorieData.map((s: string) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div className="md:col-span-4">
                  <label className={labelClass}>Brand</label>
                  <select value={form.brand || ''} onChange={e => update('brand', e.target.value)} className={inputClass} disabled={isReadOnly}>
                    <option value="">-- Nessuno --</option>
                    {brandData.map((b: any) => <option key={b.id} value={b.id}>{b.descrizione}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className={fieldsetClass} disabled={isReadOnly}>
              <legend className={legendClass}>Magazzino e Logistica</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                <div className="md:col-span-2">
                  <label className={labelClass}>UM</label>
                  <input type="text" list="um-list" value={form.UnMis || ''} onChange={e => update('UnMis', e.target.value)} className={inputClass} placeholder="Es. PZ" disabled={isReadOnly} />
                  <datalist id="um-list">
                    {umOptions.map((u: string) => <option key={u} value={u} />)}
                  </datalist>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Magazzino Princ.</label>
                  <select value={form.magaz ?? 1} onChange={e => update('magaz', +e.target.value)} className={inputClass} disabled={isReadOnly}>
                    {magazziniData.map((m: any) => <option key={m.cod} value={m.cod}>{m.Descrizione}</option>)}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Giacenza Iniziale</label>
                  <input type="number" step="0.01" value={form.esistenza ?? 0} onChange={e => update('esistenza', +e.target.value)} className={`${inputClass} text-right font-bold bg-secondary/30`} disabled={isReadOnly} />
                </div>
                <div className="md:col-span-2">
                  <label className={labelClass}>Scorta Min.</label>
                  <input type="number" step="0.01" value={form.scorta_minima ?? 0} onChange={e => update('scorta_minima', +e.target.value)} className={`${inputClass} text-right text-destructive`} disabled={isReadOnly} />
                </div>
                <div className="md:col-span-3 flex items-center pb-2 pl-2">
                  <label className={`flex items-center gap-2 text-sm font-bold text-foreground select-none ${isReadOnly ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}>
                    <input 
                      type="checkbox" 
                      checked={Number(form.barcode) !== 0} 
                      onChange={e => update('barcode', e.target.checked ? -1 : 0)} 
                      className="w-5 h-5 rounded border-input text-primary focus:ring-ring accent-primary" 
                      disabled={isReadOnly}
                    />
                    Stampa Barcode
                  </label>
                </div>
                
                <div className="md:col-span-4 mt-2">
                  <label className={labelClass}>Reparto</label>
                  <select value={form.reparto ?? 0} onChange={e => update('reparto', +e.target.value)} className={inputClass} disabled={isReadOnly}>
                    <option value={0}>-- Nessuno --</option>
                    {repartiData.map((r: any) => <option key={r.id} value={r.id}>{r.descrizione}</option>)}
                  </select>
                </div>
              </div>
            </fieldset>

            <fieldset className={fieldsetClass} disabled={isReadOnly}>
              <legend className={legendClass}>Prezzi e Listini</legend>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-3">
                  <label className={labelClass}>Ultimo Prezzo Acq. €</label>
                  <input type="number" step="0.01" value={form.ultprzacq ?? 0} onChange={e => update('ultprzacq', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} />
                </div>
                <div className="md:col-span-6">
                  <label className={labelClass}>Aliquota IVA *</label>
                  <select value={form.codiva ?? 1} onChange={e => update('codiva', +e.target.value)} className={inputClass} disabled={isReadOnly}>
                    {aliquoteData.map((a: any) => (
                      <option key={a.Id} value={a.Id}>
                        {a.codfattel ? `${a.codfattel} - ` : ''}{a.descrizione}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-3">
                  <label className={labelClass}>Peso Kg</label>
                  <input type="number" step="0.001" value={form.peso ?? 0} onChange={e => update('peso', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} />
                </div>

                <div className="md:col-span-2"><label className={labelClass}>Listino 1 €</label><input type="number" step="0.01" value={form.Listino1 ?? 0} onChange={e => update('Listino1', +e.target.value)} className={`${inputClass} text-right font-bold text-primary`} disabled={isReadOnly} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Listino 2 €</label><input type="number" step="0.01" value={form.Listino2 ?? 0} onChange={e => update('Listino2', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Listino 3 €</label><input type="number" step="0.01" value={form.Listino3 ?? 0} onChange={e => update('Listino3', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Listino 4 €</label><input type="number" step="0.01" value={form.Listino4 ?? 0} onChange={e => update('Listino4', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Listino 5 €</label><input type="number" step="0.01" value={form.Listino5 ?? 0} onChange={e => update('Listino5', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} /></div>
                <div className="md:col-span-2"><label className={labelClass}>Listino 6 €</label><input type="number" step="0.01" value={form.Listino6 ?? 0} onChange={e => update('Listino6', +e.target.value)} className={`${inputClass} text-right`} disabled={isReadOnly} /></div>
              </div>
            </fieldset>

          </form>

          {/* FOOTER A SCOMPARSA DINAMICO */}
          <div className={`flex flex-col-reverse sm:flex-row items-stretch sm:items-center px-6 py-4 border-t border-border bg-card sm:rounded-b-xl shrink-0 gap-4 ${isReadOnly ? 'justify-end' : 'justify-between'}`}>
            
            {/* LATO SINISTRO: Elimina (Nascosto in sola lettura) */}
            <div className="w-full sm:w-auto">
              {!isReadOnly && isEdit && auth.canDelete && (
                <button type="button" onClick={() => setConfirmDelete(true)} className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-3 sm:py-2.5 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors border border-destructive/20">
                  <Trash2 className="w-4 h-4" /> Elimina Articolo
                </button>
              )}
            </div>
            
            {/* LATO DESTRO: Chiudi / Salva */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <button type="button" onClick={handleCloseModal} className="w-full sm:w-auto flex items-center justify-center px-6 py-3 sm:py-2.5 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
                {isReadOnly ? 'Chiudi' : 'Annulla'}
              </button>
              
              {!isReadOnly && (
                <button type="submit" form="articolo-form" disabled={saveMutation.isPending} className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 sm:py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
                  <Save className="w-4 h-4" /> {isEdit ? 'Salva Modifiche' : 'Crea Articolo'}
                </button>
              )}
            </div>
            
          </div>

        </div>
      </div>

      {showMovimenti && (
        <MovimentiMagazzinoViewerModal 
          codiceArticolo={form.Codice} 
          dateFrom="1900-01-01" 
          dateTo="2099-12-31" 
          onClose={() => setShowMovimenti(false)} 
        />
      )}

      <ConfirmDialog isOpen={confirmDelete && !isReadOnly} title="Elimina Articolo" message={<>Sei sicuro di voler eliminare l'articolo <strong className="font-mono">{form.Codice}</strong> - <em>{form.Descrizione}</em>?<br/>L'operazione rimuoverà l'articolo dal catalogo in modo irreversibile.</>} onClose={handleCancelDelete} onConfirm={() => deleteMutation.mutate(form.id as number)} isPending={deleteMutation.isPending} />
      <ConfirmDialog isOpen={feedback.isOpen} type={feedback.type} title={feedback.title} message={feedback.msg} onClose={handleFeedbackClose} />
    </>
  );
}