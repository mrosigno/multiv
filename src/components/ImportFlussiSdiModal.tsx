import React, { useState, useRef } from 'react';
import { X, Inbox, RefreshCcw, CheckCircle2, FileText, UploadCloud, Building2, CheckCircle, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento'; 
import DocumentDetail from '@/components/DocumentDetail'; // <--- IMPORT DEL PONTE

interface Props { onClose: () => void; }

export default function ImportFlussiSdiModal({ onClose }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { data: tipiDocData = [] } = useTipiDocumento();
  
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Stati per Modali di Sicurezza e Feedback
  const [confirmImport, setConfirmImport] = useState<any | null>(null);
  const [docToDiscard, setDocToDiscard] = useState<any | null>(null);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean, title: string, msg: string, newDocId?: number }>({ isOpen: false, title: '', msg: '' });

  // Stato per il documento in dettaglio
  const [viewImportedDoc, setViewImportedDoc] = useState<any | null>(null);

  // AGGIUNGIAMO LO STATO PER IL POPUP DI ERRORE BLOCCANTE
  const [feedback, setFeedback] = useState<{ isOpen: boolean, type: any, title: string, msg: string }>({ isOpen: false, type: 'info', title: '', msg: '' });

 // FUNZIONE AGGIORNATA CON LA TUA REGOLA (clifor = 2)
  const getMappedTipoDoc = (tdCode: string) => {
    if (!tdCode) return 'Mancante';
    const code = tdCode.trim().toUpperCase();
    // FIX: Cerca il codice TDxx e si assicura che il documento sia impostato per i Fornitori (clifor = 2)
    const match = tipiDocData.find((t: any) => (t.codtipo || '').trim().toUpperCase() === code && Number(t.clifor) === 2);
    return match ? match.descrizione : '⚠️ NON CONFIGURATO';
  };
  
  const { data: stagingDocs = [], isLoading: isLoadingDocs, refetch } = useQuery({
    queryKey: ['staging_xml'],
    queryFn: async () => (await fetch(`${API_HOST}/api.php?action=get_staging_xml`)).json()
  });

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList | File[]) => {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) { formData.append('xml_files[]', files[i]); }
      const res = await fetch(`${API_HOST}/api.php?action=upload_xml_sdi`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      let msg = `Letti e importati ${data.imported} documenti XML validi.`;
      if (data.skipped > 0) msg += `\n\nAttenzione: ${data.skipped} file sono stati ignorati perché già caricati in precedenza!`;
      
      setSuccessModal({ isOpen: true, title: 'Upload Completato', msg });
      queryClient.invalidateQueries({ queryKey: ['xml_pending'] });
      refetch();
    },
    onError: (err: any) => alert("Errore durante l'upload: " + err.message)
  });

  const discardMutation = useMutation({
    mutationFn: async (idFatt: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=delete_flusso_sdi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idFatt })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      setDocToDiscard(null);
      setSelectedDoc(null);
      setSuccessModal({ isOpen: true, title: 'Scarto Eseguito', msg: "Il documento XML è stato scartato ed eliminato dall'area di attesa." });
      queryClient.invalidateQueries({ queryKey: ['xml_pending'] });
      refetch();
    },
    onError: (err: any) => alert("Errore durante l'eliminazione: " + err.message)
  });

  const importToMultiVMutation = useMutation({
    mutationFn: async (idFatt: number) => {
      const res = await fetch(`${API_HOST}/api.php?action=import_xml_to_multiv`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: idFatt })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tutti_flussi'] });
      queryClient.invalidateQueries({ queryKey: ['fatture'] });
      queryClient.invalidateQueries({ queryKey: ['clienti'] });
      
      setConfirmImport(null);
      setSelectedDoc(null);
      
      // Apriamo il modal di successo con l'ID restituito!
      setSuccessModal({ 
        isOpen: true, 
        title: 'Importazione Completata', 
        msg: `Documento importato correttamente nell'Archivio Contabile Multi-V!\n\nVuoi aprirlo subito per lavorarlo (Contabilizzazione, Stampa PDF, ecc)?`, 
        newDocId: data.id_multi_v 
      });
      refetch();
    },
    onError: (err: any) => alert("ATTENZIONE: " + err.message)
  });

  // FUNZIONE PER APRIRE IL DOCUMENTO DIRETTAMENTE DA QUI
  const handleOpenImportedDoc = async (id: number) => {
    setSuccessModal({ isOpen: false, title: '', msg: '' });
    try {
      const res = await fetch(`${API_HOST}/api.php?action=get_fattura&id=${id}`);
      const doc = await res.json();
      if (doc && doc.ID) {
        setViewImportedDoc(doc);
      } else {
        alert("Impossibile caricare il documento generato.");
      }
    } catch (e) {
      alert("Errore di connessione.");
    }
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) uploadMutation.mutate(e.dataTransfer.files);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) { uploadMutation.mutate(e.target.files); e.target.value = ''; }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value));
  const formatDate = (d: string) => { if (!d) return '-'; const parts = d.split('-'); return `${parts[2]}/${parts[1]}/${parts[0]}`; };

  return (
    <>
      <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[100] flex items-center justify-center p-0 animate-fade-in" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="fixed inset-0 flex flex-col bg-slate-50 w-full h-[100svh] sm:h-[95vh] overflow-hidden animate-fade-in">
        
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0 shadow-sm">
          <div className="w-24 md:w-32"></div>
          <div className="flex items-center justify-center">
            <div className="bg-amber-50 text-amber-700 px-6 py-2 rounded-full font-semibold text-sm md:text-base border border-amber-200 flex items-center gap-2 shadow-sm">
              <Inbox className="w-5 h-5" /> Importazione Flussi SDI
            </div>
          </div>
          <div className="flex justify-end w-24 md:w-32">
            <button onClick={onClose} className="flex items-center gap-2 text-red-600 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-md font-medium transition-colors text-sm">
              <X className="w-4 h-4" /> CHIUDI
            </button>
          </div>
        </div>
		
	    {/* AREA DRAG & DROP E ISTRUZIONI (Compatta su Mobile) */}
        <div className="p-3 md:px-6 shrink-0">
          <div className="bg-white p-2 md:p-3 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-2 items-stretch">
            
            {/* Testo Istruzioni: VISIBILE SOLO SU DESKTOP E TABLET GRANDI */}
            <div className="hidden md:flex text-sm text-gray-600 bg-amber-50 p-4 rounded-xl border border-amber-100 w-1/3 shrink-0 flex-col justify-center">
              <div className="flex items-center gap-2 mb-2 font-bold text-amber-700">
                <Inbox className="w-5 h-5" /> Istruzioni
              </div>
              <p className="leading-relaxed text-xs lg:text-sm">
                <strong>Fase 1:</strong> Trascina i file XML nel riquadro a destra (i duplicati verranno ignorati).<br/>
                <strong>Fase 2:</strong> Seleziona un documento in basso e clicca su "IMPORTA IN MULTI-V".
              </p>
            </div>

            {/* ZONA UPLOAD (Compatta su Mobile, Estesa su PC) */}
            <div 
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop} onClick={() => fileInputRef.current?.click()}
              className={`flex-1 border-2 border-dashed rounded-xl py-3 px-4 md:p-4 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${  
                isDragging ? 'border-amber-500 bg-amber-50' : 'border-gray-300 hover:bg-gray-50 hover:border-amber-400'
              }`}
            >
              {uploadMutation.isPending ? (
                <div className="flex flex-col items-center text-amber-600">
                  <RefreshCcw className="w-5 h-5 md:w-6 md:h-6 animate-spin mb-1 md:mb-2" />
                  <span className="font-bold text-xs md:text-sm">Upload e Lettura...</span>
                </div>
              ) : (
                // SU MOBILE L'ICONA E IL TESTO SI AFFIANCANO PER SALVARE SPAZIO IN ALTEZZA
                <div className="flex flex-row md:flex-col items-center justify-center gap-3 md:gap-0 w-full">
                  <UploadCloud className={`w-6 h-6 md:w-8 md:h-8 md:mb-2 shrink-0 ${isDragging ? 'text-amber-500' : 'text-gray-400'}`} />
                  <div>
                    <h3 className="text-xs sm:text-sm md:text-base font-bold text-gray-700 mb-0.5">
                      {/* TESTI DINAMICI */}
                      <span className="hidden md:inline">Trascina qui i file XML o P7M</span>
                      <span className="md:hidden text-amber-700 uppercase tracking-wider">Tocca qui per selezionare i file XML</span>
                    </h3>
                    <p className="text-[10px] md:text-xs text-gray-500 hidden md:block">Oppure clicca per selezionare dal PC.</p>
                  </div>
                </div>
              )}
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept=".xml,.p7m" className="hidden" />
            </div>

          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0 gap-4 px-4 md:px-6 pb-4 overflow-hidden">
          
          <div className="w-full md:w-1/3 flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[40vh] md:h-full">
            <div className="bg-gray-50/80 px-4 py-3 border-b border-gray-200 flex justify-between items-center shrink-0">
              <h3 className="font-bold text-gray-800">Documenti in Attesa</h3>
              <span className="bg-amber-100 text-amber-800 border border-amber-200 text-xs py-1 px-2.5 rounded-full font-bold">{stagingDocs.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
              {isLoadingDocs ? <div className="p-8 text-center text-gray-400 animate-pulse">Caricamento...</div> : stagingDocs.length === 0 ? <div className="p-8 text-center text-gray-400">Nessun documento in staging. Esegui l'upload.</div> : stagingDocs.map((doc: any) => (
                <div key={doc.id} onClick={() => setSelectedDoc(doc)} className={`flex flex-col gap-1 p-3 mb-2 rounded-lg cursor-pointer transition-all border ${selectedDoc?.id === doc.id ? 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-400' : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}>
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-sm text-foreground truncate max-w-[200px]" title={doc.fornitore}>{doc.fornitore}</span>
                    <span className="text-[10px] font-mono font-bold bg-secondary px-1.5 py-0.5 rounded border border-border">Doc: {doc.numdoc}</span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-muted-foreground">{formatDate(doc.data)}</span>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(Number(doc.totaledoc))}</span>
                  </div>
                  {doc.is_fornitore_new && <div className="mt-2 text-[10px] font-bold text-amber-700 bg-amber-100 border border-amber-200 px-2 py-1 rounded w-fit flex items-center gap-1"><Building2 className="w-3 h-3" /> Anagrafica Nuova!</div>}
                </div>
              ))}
            </div>
          </div>

			<div className="hidden md:flex w-full md:w-2/3 flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden md:h-full">
            <div className="flex-1 overflow-y-auto p-0 md:p-4 scrollbar-thin">
              {!selectedDoc ? <div className="h-full flex flex-col items-center justify-center text-gray-400"><FileText className="w-16 h-16 mb-4 text-gray-300" /><p className="text-base">Seleziona un documento</p></div> : (
                <div className="space-y-6">
                  
                  {/* FIX SPIA VISIVA: Aggiunto il controllo del TIPO Multi-V con il codice TDxx */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50 border border-gray-200 p-4 rounded-lg items-center">
                    <div className="col-span-2"><span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Fornitore</span><span className="font-bold text-foreground leading-tight truncate block" title={selectedDoc.fornitore}>{selectedDoc.fornitore}</span></div>
                    <div><span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">P.IVA / CF</span><span className="font-mono text-foreground text-sm truncate block">{selectedDoc.idfiscale}</span></div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Documento</span>
                      <span className="font-bold text-foreground text-sm block">N. {selectedDoc.numdoc} <br/><span className="text-muted-foreground font-normal">del {formatDate(selectedDoc.data)}</span></span>
                    </div>
                    <div className="text-right"><span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Totale Fattura</span><span className="font-black text-primary text-lg">{formatCurrency(Number(selectedDoc.totaledoc))}</span></div>
                    
                    {/* SECONDA RIGA: TIPO DOC */}
                    <div className="col-span-full pt-3 border-t border-gray-200 flex items-center gap-3">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Multi-V:</span>
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded text-[10px] border border-blue-200 shrink-0">
                        {selectedDoc.tipodoc}
                      </span>
                      <span className={`text-xs font-bold uppercase truncate ${getMappedTipoDoc(selectedDoc.tipodoc).includes('⚠️') ? 'text-red-600' : 'text-primary'}`}>
                        {getMappedTipoDoc(selectedDoc.tipodoc)}
                      </span>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[11px] font-bold text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3">Descrizione Riga (XML)</th><th className="px-4 py-3 text-right">Q.tà</th><th className="px-4 py-3 text-right">Pr. Unitario</th><th className="px-4 py-3 text-right">Sconto</th><th className="px-4 py-3 text-right">IVA %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {selectedDoc.righe?.map((r: any) => (
                          <tr key={r.ID} className="bg-white hover:bg-gray-50">
                            <td className="px-4 py-2 font-medium"><span className="block text-foreground">{r.Descrizione}</span>{r.Codart && <span className="block text-[10px] font-mono text-muted-foreground mt-0.5">Cod: {r.Codart}</span>}</td>
                            <td className="px-4 py-2 text-right font-mono">{Number(r.Quantita)} <span className="text-[10px] text-muted-foreground">{r.UnitaMisura}</span></td>
                            <td className="px-4 py-2 text-right font-mono">{formatCurrency(Number(r.PrezzoUnitario))}</td>
                            <td className="px-4 py-2 text-right font-mono text-destructive">{Number(r.sconto) > 0 ? `${Number(r.sconto)}%` : '-'}</td>
                            <td className="px-4 py-2 text-right font-mono">{r.AliquotaIVA}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          
		  {/* ========================================================= */}
          {/* COLONNA DESTRA VERSIONE MOBILE (Apre a Schermo Intero)      */}
          {/* ========================================================= */}
          {selectedDoc && (
            <div className="md:hidden fixed inset-0 z-[300] bg-slate-50 flex flex-col animate-fade-up">
              
              <div className="bg-slate-800 px-4 py-3 flex justify-between items-center text-white shrink-0 shadow-md">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-400" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Dettaglio XML</h3>
                </div>
                <button onClick={() => setSelectedDoc(null)} className="p-1.5 rounded-lg hover:bg-white/20 transition-colors"><X className="w-5 h-5" /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50">
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 bg-white border border-gray-200 p-4 rounded-xl shadow-sm">
                    <div className="col-span-2"><span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Fornitore</span><span className="font-bold text-foreground text-sm">{selectedDoc.fornitore}</span></div>
                    <div><span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">P.IVA / CF</span><span className="font-mono text-foreground text-xs">{selectedDoc.idfiscale}</span></div>
                    <div><span className="block text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Doc. / Data</span><span className="font-bold text-foreground text-xs">N. {selectedDoc.numdoc} <br/><span className="text-muted-foreground font-normal">del {formatDate(selectedDoc.data)}</span></span></div>
                    <div className="col-span-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Totale Fattura</span>
                      <span className="font-black text-primary text-xl">{formatCurrency(Number(selectedDoc.totaledoc))}</span>
                    </div>
                    
                    <div className="col-span-2 pt-2 border-t border-gray-100 flex flex-col gap-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground">Tipo Multi-V:</span>
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 font-bold rounded text-[10px] border border-blue-200 shrink-0">{selectedDoc.tipodoc}</span>
                        <span className={`text-[11px] font-bold uppercase truncate ${getMappedTipoDoc(selectedDoc.tipodoc).includes('⚠️') ? 'text-red-600' : 'text-primary'}`}>
                          {getMappedTipoDoc(selectedDoc.tipodoc)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
                    <div className="bg-gray-50 px-3 py-2 border-b border-gray-200"><span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Righe XML</span></div>
                    <div className="divide-y divide-gray-100">
                      {selectedDoc.righe?.map((r: any) => (
                        <div key={r.ID} className="p-3">
                          <span className="block text-sm font-medium text-foreground mb-1 leading-tight">{r.Descrizione}</span>
                          {r.Codart && <span className="block text-[10px] font-mono text-muted-foreground mb-2">Cod: {r.Codart}</span>}
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-muted-foreground">Q.tà: <strong className="text-foreground">{Number(r.Quantita)} {r.UnitaMisura}</strong></span>
                            <span className="text-muted-foreground">Prezzo: <strong className="text-foreground font-mono">{formatCurrency(Number(r.PrezzoUnitario))}</strong></span>
                            <span className="text-muted-foreground">IVA: <strong className="text-foreground">{r.AliquotaIVA}%</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER MOBILE: SCARTA E IMPORTA */}
              <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-[0_-4px_15px_rgba(0,0,0,0.05)] pb-safe flex gap-2">
                <button 
                  onClick={() => setDocToDiscard(selectedDoc)}
                  className="flex-1 flex flex-col items-center justify-center gap-1 py-2 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold rounded-lg transition-colors shadow-sm"
                >
                  <Trash2 className="w-5 h-5" /> <span className="text-[10px] uppercase">Scarta</span>
                </button>
                <button 
                  onClick={() => {
                    const isConfigured = !getMappedTipoDoc(selectedDoc.tipodoc).includes('⚠️');
                    if (!isConfigured) {
                      setFeedback({ isOpen: true, type: 'danger', title: 'Importazione Bloccata', msg: `Codice SDI (${selectedDoc.tipodoc}) non riconosciuto.\nConfiguralo nelle Impostazioni.` });
                      return;
                    }
                    setConfirmImport(selectedDoc);
                  }}
                  disabled={importToMultiVMutation.isPending}
                  className="flex-[2] flex flex-col items-center justify-center gap-1 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-md disabled:opacity-50"
                >
                  {importToMultiVMutation.isPending ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} 
                  <span className="text-[10px] uppercase">Importa XML</span>
                </button>
              </div>

            </div>
          )}
		
		</div>

        {/* FOOTER CON TASTO SCARTA */}
        <div className="bg-white border-t border-gray-200 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 flex justify-between items-center">
          <div>
            {selectedDoc && (
              <button 
                onClick={() => setDocToDiscard(selectedDoc)}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 font-bold rounded-lg transition-colors shadow-sm"
                title="Scarta ed elimina definitivamente questo XML dalle tabelle di attesa."
              >
                <Trash2 className="w-5 h-5" /> SCARTA
              </button>
            )}
          </div>

		<button 
            onClick={() => {
              // 1. Verifichiamo se il documento è configurato
              const isConfigured = !getMappedTipoDoc(selectedDoc.tipodoc).includes('⚠️');
              
              if (!isConfigured) {
                // 2. Se non lo è, BLOCCIAMO TUTTO e mostriamo l'avviso!
                setFeedback({
                  isOpen: true,
                  type: 'danger',
                  title: 'Importazione Bloccata',
                  msg: `Codice documento SDI (${selectedDoc.tipodoc}) non riconosciuto per l'area Acquisti.\n\nVai in 'Impostazioni -> Tipologia Documenti', apri la scheda del documento FORNITORE corretto e inserisci la sigla '${selectedDoc.tipodoc}' nel campo 'codtipo'.`
                });
                return;
              }
              
              // 3. Altrimenti, procediamo con la conferma
              setConfirmImport(selectedDoc);
            }}
            disabled={!selectedDoc || importToMultiVMutation.isPending}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importToMultiVMutation.isPending ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />} IMPORTA IN MULTI-V
          </button>
		  
        </div>
      </div>
      </div>

      <ConfirmDialog 
        isOpen={!!confirmImport} type="info" confirmLabel="Sì, Importa Documento" title="Conferma Importazione Multi-V"
        message={<>Confermi di voler registrare la fattura <strong>n. {confirmImport?.numdoc} del {formatDate(confirmImport?.data)}</strong> in Multi-V?</>}
        onClose={() => setConfirmImport(null)}
        onConfirm={() => importToMultiVMutation.mutate(confirmImport.id)}
        isPending={importToMultiVMutation.isPending}
      />

      <ConfirmDialog 
        isOpen={!!docToDiscard} title="Scarta Documento XML" type="danger"
        message={<>Sei sicuro di voler scartare la fattura <strong>{docToDiscard?.numdoc}</strong> di <strong>{docToDiscard?.fornitore}</strong>?<br/>Il file verrà eliminato dalle tabelle di attesa e non verrà importato nel gestionale.</>}
        onClose={() => setDocToDiscard(null)}
        onConfirm={() => discardMutation.mutate(docToDiscard.id)}
        isPending={discardMutation.isPending}
      />

      {/* MODALE DI SUCCESSO (VERDE) CON OPZIONI */}
      {successModal.isOpen && (
        <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden animate-scale-in text-center border border-border">
            <div className="p-6 pt-8 flex flex-col items-center">
              <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-5"><CheckCircle className="w-12 h-12 text-success" /></div>
              <h2 className="text-xl font-black text-foreground mb-3">{successModal.title}</h2>
              <p className="text-sm text-muted-foreground leading-relaxed font-medium whitespace-pre-wrap">{successModal.msg}</p>
            </div>
            
            <div className="px-6 py-4 bg-secondary/30 border-t border-border flex flex-col gap-2 justify-center">
              {successModal.newDocId && (
                <button 
                  onClick={() => handleOpenImportedDoc(successModal.newDocId!)} 
                  className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" /> APRI DOCUMENTO
                </button>
              )}
              <button 
                onClick={() => setSuccessModal({ isOpen: false, title: '', msg: '' })} 
                className={`w-full px-4 py-3 rounded-xl font-bold transition-opacity shadow-sm ${successModal.newDocId ? 'border border-input text-muted-foreground hover:bg-secondary' : 'bg-success text-success-foreground hover:opacity-90'}`}
              >
                {successModal.newDocId ? "Torna all'elenco Flussi" : 'CHIUDI'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* APERTURA DIRETTA DEL DOCUMENTO IMPORTATO (Mantiene lo sfondo di ImportFlussiSdiModal attivo) */}
      {viewImportedDoc && (
        <div className="fixed z-[9999]">
          <DocumentDetail
            document={viewImportedDoc}
            onClose={() => setViewImportedDoc(null)} 
            onEdit={() => {}}
            onToggle={(field: any) => {
              setViewImportedDoc((prev: any) => prev ? { ...prev, [field]: -1 } : prev);
            }}
          />
        </div>
      )}
	  
	  {/* MODALE DI ERRORE BLOCCANTE */}
      <ConfirmDialog 
        isOpen={feedback.isOpen}
        type={feedback.type}
        title={feedback.title}
        message={<div className="whitespace-pre-wrap leading-relaxed">{feedback.msg}</div>}
        confirmLabel="Ho capito"
        hideCancel={true}
        onClose={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
        onConfirm={() => setFeedback(prev => ({ ...prev, isOpen: false }))}
      />
    </>
  );
}

