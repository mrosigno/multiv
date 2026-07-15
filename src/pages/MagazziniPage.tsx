import { useState, useMemo } from 'react';
import { Plus, Search, Pencil, X, Save, RefreshCcw, Trash2, Store } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

// Mappa per la visualizzazione nella tabella
const REGISTRATORI_MAP: Record<number, string> = {
  1: 'RCH - PRINT F',
  2: 'CUSTOM XKUBE II',
  3: 'EPSON FP 81 II',
  4: 'EDIT'
};

const MagazziniPage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);

  const queryClient = useQueryClient();
  const { data: apiData, isLoading, isError } = useMagazzini();

  const saveMutation = useMutation({
    mutationFn: async (record: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=save_magazzino`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(record),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nel salvataggio");
      return data;
    },
    onSuccess: () => { 
      queryClient.invalidateQueries({ queryKey: ['magazzini'] }); 
      setShowModal(false); 
    },
    onError: (error: any) => alert("Errore durante il salvataggio: " + error.message)
  });

  const deleteMutation = useMutation({
    mutationFn: async (cod: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_magazzino`, {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ cod }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Errore nell'eliminazione");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['magazzini'] });
      setItemToDelete(null);
    },
    onError: (error: any) => alert("Errore durante l'eliminazione: " + error.message)
  });

  const filteredData = useMemo(() => {
    if (!apiData) return [];
    if (!searchQuery) return apiData;
    const q = searchQuery.toLowerCase();
    return apiData.filter((item: any) => (item.Descrizione || '').toLowerCase().includes(q));
  }, [apiData, searchQuery]);

  const handleNew = () => { 
    const rawData = apiData || [];
    const nextId = rawData.length > 0 ? Math.max(...rawData.map((item: any) => Number(item.cod))) + 1 : 1;
    
    setEditingRecord({ 
      cod: nextId, 
      Descrizione: '', 
      attivo: 1, 
      aperto: 0,
      registratore: 1,
      display: 0,
      lbarcode: 17,
      tipost: -1, // -1 = CLIENT (di default per tua indicazione)
      matricola: '',
      stampante: '',
      ultimosc: 0,
      ultimafat: 0,
      ultimach: 0,
      _isNewRecord: true 
    }); 
    setShowModal(true); 
  };
  
  const handleEdit = (record: any) => { 
    setEditingRecord({ ...record, _isNewRecord: false }); 
    setShowModal(true); 
  };

  const handleDeleteRequest = (record: any) => {
    setShowModal(false); 
    setItemToDelete(record); 
  };

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Gestione Magazzini</h1>
          <p className="text-sm text-muted-foreground">Archivio Punti Vendita, Registratori di Cassa e progressivi documenti.</p>
        </div>
        <button onClick={handleNew} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity shadow-sm font-medium text-sm shrink-0 w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Nuovo Magazzino
        </button>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-4 p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input 
            type="text" 
            placeholder="Cerca magazzino..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
          />
        </div>
      </div>

      <div className="hidden md:flex md:flex-col bg-card rounded-xl border border-border shadow-sm overflow-hidden mb-20">
        <table className="w-full text-sm text-left">
          <thead className="bg-table-header border-b border-border">
            <tr>
              <th className="px-4 py-3 font-semibold text-muted-foreground w-20">Cod.</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Descrizione Magazzino</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground">Modello Cassa</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Matricola</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center">Stato</th>
              <th className="px-4 py-3 font-semibold text-muted-foreground text-center w-24">Azioni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Caricamento in corso...</td></tr>}
            {isError && !isLoading && <tr><td colSpan={6} className="p-8 text-center text-destructive">Errore di connessione al database.</td></tr>}
            {!isLoading && !isError && filteredData.length === 0 && <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Nessun magazzino trovato.</td></tr>}

            {!isLoading && filteredData.map((item: any, idx: number) => (
              <tr key={item.cod} className={`hover:bg-muted/30 transition-colors ${idx % 2 === 1 ? 'bg-table-stripe' : ''}`}>
                <td className="px-4 py-3 font-mono font-bold text-primary">{item.cod}</td>
                <td className="px-4 py-3 font-bold text-foreground">{item.Descrizione}</td>
                <td className="px-4 py-3 text-muted-foreground">{REGISTRATORI_MAP[item.registratore] || '-'}</td>
                <td className="px-4 py-3 text-center font-mono">{item.matricola || '-'}</td>
                <td className="px-4 py-3 text-center">
                  {Number(item.attivo) !== 0 ? (
                    <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-green-100 text-green-700">ATTIVO</span>
                  ) : (
                    <span className="inline-flex px-2 py-1 rounded text-[10px] font-bold bg-gray-100 text-gray-500">DISABILITATO</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => handleEdit(item)} className="p-1.5 rounded-md hover:bg-secondary text-primary transition-colors mx-auto block" title="Apri / Modifica">
                    <Pencil className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-3 pb-24">
        {isLoading && <div className="p-8 text-center text-muted-foreground">Caricamento...</div>}
        {!isLoading && filteredData.length === 0 && <div className="bg-card rounded-xl border border-border p-8 text-center text-muted-foreground">Nessun magazzino.</div>}

        {!isLoading && filteredData.map((item: any) => (
          <div key={item.cod} className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <div className="flex justify-between items-start mb-3">
              <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">Cod: {item.cod}</span>
              {Number(item.attivo) !== 0 ? (
                <span className="text-xs font-bold text-green-700">Attivo</span>
              ) : (
                <span className="text-xs font-bold text-gray-500">Disabilitato</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">{item.Descrizione}</h3>
            <p className="text-sm text-muted-foreground mb-3">Cassa: {REGISTRATORI_MAP[item.registratore] || 'Non configurata'}</p>
            
            <div className="flex justify-end pt-3 border-t border-border/50">
              <button onClick={() => handleEdit(item)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-colors">
                <Pencil className="w-3.5 h-3.5" /> Modifica
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <MagazzinoFormModal 
          record={editingRecord} 
          onSave={(data) => saveMutation.mutate(data)} 
          isSaving={saveMutation.isPending}
          onClose={() => setShowModal(false)} 
          onDeleteRequest={handleDeleteRequest}
        />
      )}

      <ConfirmDialog 
        isOpen={!!itemToDelete}
        title="Elimina Magazzino / P.Vendita"
        message={
          <>
            Stai per eliminare il magazzino <strong>{itemToDelete?.Descrizione}</strong>.
            <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm text-left leading-snug">
              ⚠️ <strong>ATTENZIONE PERICOLO DATI:</strong><br/>
              L'eliminazione di un magazzino precluderà il corretto calcolo dell'inventario e corromperà lo storico dei movimenti ad esso collegati (Carichi, Scarichi, Fatture).<br/><br/>
              <em>Se il magazzino non è più in uso, ti consigliamo di annullare e impostare semplicemente il campo "Attivo" su "No".</em>
            </div>
          </>
        }
        confirmLabel="Sì, elimina irreversibilmente"
        onClose={() => setItemToDelete(null)}
        onConfirm={() => deleteMutation.mutate(itemToDelete.cod)}
        isPending={deleteMutation.isPending}
      />

    </AppLayout>
  );
};

// --- COMPONENTE MODALE INTERNO (Stile Originale Legacy) ---
const MagazzinoFormModal = ({ record, onSave, isSaving, onClose, onDeleteRequest }: { record: any, onSave: (r: any) => void, isSaving: boolean, onClose: () => void, onDeleteRequest: (r: any) => void }) => {
  const isEdit = !record._isNewRecord;
  const [form, setForm] = useState<any>(record);
  
  const handleSubmit = (e: React.FormEvent) => { 
    e.preventDefault(); 
    onSave(form); 
  };
  
  const inputClass = "w-full px-3 py-2 rounded-md border border-input bg-background text-sm font-medium focus:ring-2 focus:ring-primary/50 outline-none";
  const labelClass = "block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1";
  const helperClass = "block text-[10px] text-destructive font-semibold mt-0.5 leading-tight";

  return (
    <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-xl border border-border shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card rounded-t-xl shrink-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Magazzino' : 'Nuovo Magazzino'}</h3>
            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs font-bold flex items-center gap-1">
              <Store className="w-3.5 h-3.5" /> Punti Vendita
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          <form id="magazzino-form" onSubmit={handleSubmit}>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
              
              {/* RIGA 1 */}
              <div className="md:col-span-2">
                <label className={labelClass}>Cod *</label>
                <input type="text" value={form.cod || ''} disabled className={`${inputClass} bg-secondary/50 text-muted-foreground font-mono font-bold`} />
              </div>
              <div className="md:col-span-7">
                <label className={labelClass}>Descrizione *</label>
                <input type="text" value={form.Descrizione || ''} onChange={e => setForm({ ...form, Descrizione: e.target.value })} className={inputClass} required />
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Attivo</label>
                <select value={Number(form.attivo)} onChange={e => setForm({ ...form, attivo: Number(e.target.value) })} className={inputClass}>
                  <option value={1}>Sì (Abilitato)</option>
                  <option value={0}>No (Disabilitato)</option>
                </select>
                <span className={helperClass}>Abilitato a carico/scarico</span>
              </div>

              {/* RIGA 2 */}
              <div className="md:col-span-2">
                <label className={labelClass}>Aperto</label>
                <select value={Number(form.aperto)} onChange={e => setForm({ ...form, aperto: Number(e.target.value) })} className={inputClass}>
                  <option value={-1}>Sì</option>
                  <option value={0}>No</option>
                </select>
              </div>
              <div className="md:col-span-7">
                <label className={labelClass}>Registratore di Cassa</label>
                <select value={Number(form.registratore)} onChange={e => setForm({ ...form, registratore: Number(e.target.value) })} className={inputClass}>
                  <option value={0}>-- Seleziona --</option>
                  <option value={1}>1 - RCH - PRINT F</option>
                  <option value={2}>2 - CUSTOM XKUBE II</option>
                  <option value={3}>3 - EPSON FP 81 II</option>
                  <option value={4}>4 - EDIT</option>
                </select>
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Display</label>
                <select value={Number(form.display)} onChange={e => setForm({ ...form, display: Number(e.target.value) })} className={inputClass}>
                  <option value={-1}>Sì</option>
                  <option value={0}>No</option>
                </select>
                <span className={helperClass}>Echo su display cassa</span>
              </div>

              {/* RIGA 3 */}
              <div className="md:col-span-2">
                <label className={labelClass}>L.Barcode</label>
                <input type="number" value={form.lbarcode ?? 17} onChange={e => setForm({ ...form, lbarcode: Number(e.target.value) })} className={inputClass} />
                <span className={helperClass}>Max lung. Barcode</span>
              </div>
              <div className="md:col-span-3">
                <label className={labelClass}>Tipo St.</label>
                <select value={Number(form.tipost)} onChange={e => setForm({ ...form, tipost: Number(e.target.value) })} className={inputClass}>
                  <option value={-1}>CLIENT (-1)</option>
                  <option value={0}>SERVER (0)</option>
                </select>
                <span className={helperClass}>Gestione SW Stampa</span>
              </div>
              <div className="md:col-span-7">
                <label className={labelClass}>Matricola Cassa</label>
                <input type="text" value={form.matricola || ''} onChange={e => setForm({ ...form, matricola: e.target.value })} className={inputClass} placeholder="N. Seriale Misuratore Fiscale" />
              </div>

              {/* RIGA 4 */}
              <div className="md:col-span-6">
                <label className={labelClass}>Stampante (Spooler)</label>
                <input type="text" value={form.stampante || ''} onChange={e => setForm({ ...form, stampante: e.target.value })} className={inputClass} placeholder="Nome stampante Windows" />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ultimo Sc.</label>
                <input type="number" value={form.ultimosc ?? 0} onChange={e => setForm({ ...form, ultimosc: Number(e.target.value) })} className={`${inputClass} text-right`} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ultima Fat.</label>
                <input type="number" value={form.ultimafat ?? 0} onChange={e => setForm({ ...form, ultimafat: Number(e.target.value) })} className={`${inputClass} text-right`} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Ultima Ch.</label>
                <input type="number" value={form.ultimach ?? 0} onChange={e => setForm({ ...form, ultimach: Number(e.target.value) })} className={`${inputClass} text-right`} />
              </div>

            </div>
          </form>
        </div>

        {/* FOOTER CON ELIMINA A SINISTRA */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card rounded-b-xl shrink-0">
          <div>
            {isEdit && (
              <button 
                type="button" 
                onClick={() => onDeleteRequest(form)} 
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive/10 text-destructive text-sm font-bold hover:bg-destructive/20 transition-colors"
              >
                <Trash2 className="w-4 h-4" /> Elimina
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
              Annulla
            </button>
            <button type="submit" form="magazzino-form" disabled={isSaving} className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm">
              {isSaving ? <RefreshCcw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isSaving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default MagazziniPage;