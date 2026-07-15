import { useState, useEffect } from 'react';
import { X, Send, Paperclip, AlertTriangle, RefreshCcw } from 'lucide-react';
import { API_HOST } from '@/config';
import ConfirmDialog from './ConfirmDialog';

interface Props {
  pdfData: { filename: string; base64Data: string };
  cliente: any;
  tipoDoc: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EmailSenderModal({ pdfData, cliente, tipoDoc, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    to: '',
    subject: '',
    body: ''
  });

  const [warningMsg, setWarningMsg] = useState('');
  const [feedback, setFeedback] = useState<{isOpen: boolean, type: any, title: string, msg: string}>({ isOpen: false, type: 'info', title: '', msg: '' });
  
  // --- STATI PER LA GESTIONE DEI MODELLI ---
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);
  
  const writeDebugLog = (phase: string, details: Record<string, unknown>) => {
    try {
      const payload = {
        ts: new Date().toISOString(),
        phase,
        details,
      };
      sessionStorage.setItem('multiv_email_debug_last', JSON.stringify(payload, null, 2));
      localStorage.setItem('multiv_email_debug_last', JSON.stringify(payload, null, 2));
    } catch {
      // Best effort only: do not block sending if storage is unavailable.
    }
  };

  useEffect(() => {
    // 1. Gestione Indirizzo Email (Priorità a emaildoc, fallback su email normale)
    let targetEmail = cliente.emaildoc?.trim();
    if (!targetEmail) {
      targetEmail = cliente.email?.trim();
      if (targetEmail) {
        setWarningMsg(`ATTENZIONE: Il campo 'Email Documenti' è vuoto. È stata inserita l'email generale del cliente (${targetEmail}).`);
      } else {
        setWarningMsg(`ATTENZIONE: Nessun indirizzo email presente nell'anagrafica del cliente! Inseriscilo manualmente.`);
      }
    }
    
	// 2. Caricamento Modello Comunicazione (Area 1 = Documenti)
    const loadTemplate = async () => {
      try {
        const res = await fetch(`${API_HOST}/api.php?action=get_comunicazioni`);
        const data = await res.json();
        
        if (Array.isArray(data)) {
          // Filtriamo tutti i modelli dell'Area 1
          const areaTemplates = data.filter((d: any) => Number(d.area) === 1);
          setTemplates(areaTemplates);
          
          if (areaTemplates.length > 0) {
            // Seleziona il primo modello di default
            setSelectedTemplateIndex(0);
            setForm(prev => ({
              ...prev,
              to: targetEmail,
              subject: areaTemplates[0].oggetto,
              body: areaTemplates[0].testo
            }));
            return; // Usciamo, il modello è stato caricato
          }
        }
        
        // Fallback se l'array è vuoto o non ci sono modelli per l'area 1
        setForm(prev => ({
          ...prev,
          to: targetEmail,
          subject: `Invio Documento: ${tipoDoc?.descrizione || 'Fattura'}`,
          body: `Gentile Cliente,\n\nin allegato inviamo copia del documento in oggetto.\n\nCordiali Saluti.\n\n?logo?`
        }));
      } catch (e) {
        // Fallback in caso di errore API
        setForm(prev => ({ 
          ...prev, 
          to: targetEmail, 
          subject: `Invio Documento`, 
          body: `In allegato il documento.\n\n?logo?` 
        }));
      }
    };

    loadTemplate();
  }, [cliente, tipoDoc]); // Assicurati di mantenere le tue dipendenze originali del useEffect

  const handleSend = async () => {
    if (!form.to) {
      setFeedback({ isOpen: true, type: 'danger', title: 'Errore', msg: "Inserisci l'indirizzo email del destinatario." });
      return;
    }
    
    setLoading(true);
    try {
      // FIX: Lettura universale dell'utente loggato per passarlo a PHP
      let username = '';
      try {
        const raw = localStorage.getItem('gestionale_auth');
        if (raw === 'true') {
          username = 'MROSIGNO'; // Fallback per backdoor
        } else {
          const authData = JSON.parse(raw || '{}');
          username = authData.username || authData.fs_user_id || authData.Id || raw || '';
        }
      } catch (e) {
        username = localStorage.getItem('gestionale_auth') || '';
      }

      const validationErrors: string[] = [];
      if (!username || !String(username).trim()) validationErrors.push("Utente in sessione non rilevato");
      if (!form.to || !String(form.to).trim()) validationErrors.push("Destinatario email mancante");
      if (!form.subject || !String(form.subject).trim()) validationErrors.push("Oggetto mancante");
      if (!pdfData?.filename || !String(pdfData.filename).trim()) validationErrors.push("Nome file PDF mancante");
      if (!pdfData?.base64Data || String(pdfData.base64Data).trim().length < 100) validationErrors.push("Contenuto PDF mancante o incompleto");

      const debugBase = {
        apiHost: API_HOST,
        endpoint: `${API_HOST}/api.php?action=send_email`,
        pageOrigin: window.location.origin,
        username,
        to: form.to,
        subject: form.subject,
        filename: pdfData?.filename || '',
        pdfLength: pdfData?.base64Data?.length || 0,
      };

      if (validationErrors.length > 0) {
        writeDebugLog('validation_error', { ...debugBase, validationErrors });
        setFeedback({
          isOpen: true,
          type: 'danger',
          title: 'Parametri Mancanti',
          msg: `${validationErrors.join('\n')}\n\nEndpoint previsto:\n${debugBase.endpoint}`,
        });
        return;
      }

      writeDebugLog('before_fetch', debugBase);

      const endpoint = `${API_HOST}/api.php?action=send_email`;

      const dataUri = String(pdfData.base64Data || '');
      const comma = dataUri.indexOf(',');
      const b64 = (comma >= 0 ? dataUri.slice(comma + 1) : dataUri).replace(/\s+/g, '');
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

      const fd = new FormData();
      fd.append('username', username);
      fd.append('to', form.to);
      fd.append('subject', form.subject);
      fd.append('body', form.body);
      fd.append('filename', pdfData.filename);
      fd.append('pdf', pdfBlob, pdfData.filename);

      const res = await fetch(endpoint, { method: 'POST', body: fd });
      const rawText = await res.text();
      writeDebugLog('after_fetch', {
        ...debugBase,
        httpStatus: res.status,
        ok: res.ok,
        responsePreview: rawText.slice(0, 1200),
      });

      if (!res.ok) {
        setFeedback({
          isOpen: true,
          type: 'danger',
          title: 'Errore Server',
          msg: `HTTP ${res.status}\nEndpoint:\n${endpoint}\n\nRisposta:\n${rawText.slice(0, 1200) || '(vuota)'}`,
        });
        return;
      }

      let data: any;
      try {
        data = JSON.parse(rawText);
      } catch {
        setFeedback({
          isOpen: true,
          type: 'danger',
          title: 'Risposta Non Valida',
          msg: `Il server ha risposto con un contenuto non JSON.\n\nEndpoint:\n${endpoint}\n\nAnteprima risposta:\n${rawText.slice(0, 1200) || '(vuota)'}`,
        });
        return;
      }
      
      if (data.success) {
        writeDebugLog('success', { ...debugBase, response: data });
        onSuccess(); 
      } else {
        writeDebugLog('backend_error', { ...debugBase, response: data });
        setFeedback({ isOpen: true, type: 'danger', title: 'Errore Invio Mail', msg: data.message });
      }
    } catch (e: any) {
      const usernameFromStorage = (() => {
        try {
          const raw = localStorage.getItem('gestionale_auth');
          if (!raw) return '';
          if (raw === 'true') return 'MROSIGNO';
          const parsed = JSON.parse(raw);
          return parsed.username || parsed.fs_user_id || parsed.Id || '';
        } catch {
          return '';
        }
      })();

      const endpoint = `${API_HOST}/api.php?action=send_email`;
      const errorMessage = e?.message || 'Errore sconosciuto';
      writeDebugLog('network_error', {
        apiHost: API_HOST,
        endpoint,
        pageOrigin: window.location.origin,
        username: usernameFromStorage,
        to: form.to,
        filename: pdfData?.filename || '',
        pdfLength: pdfData?.base64Data?.length || 0,
        errorMessage,
      });
      setFeedback({
        isOpen: true,
        type: 'danger',
        title: 'Errore di Rete',
        msg: `Impossibile contattare il server.\n\nDettaglio:\n${errorMessage}\n\nEndpoint:\n${endpoint}\n\nLog locale salvato in:\nlocalStorage/sessionStorage -> multiv_email_debug_last`,
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Cambia l'oggetto e il testo quando l'utente seleziona un modello diverso
  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    setSelectedTemplateIndex(idx);
    const selected = templates[idx];
    if (selected) {
      setForm(prev => ({
        ...prev,
        subject: selected.oggetto,
        body: selected.testo
      }));
    }
  };  

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-card w-full sm:max-w-2xl max-h-[100svh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
        
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border bg-slate-800 text-white flex justify-between items-center shrink-0">
          <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">Nuovo Messaggio</h2>
          <button onClick={onClose} disabled={loading} className="hover:bg-white/20 p-2 rounded-full transition-colors disabled:opacity-50"><X className="w-5 h-5"/></button>
        </div>

        <div className="p-4 sm:p-6 space-y-3 sm:space-y-4 flex-1 overflow-y-auto">
          
          {warningMsg && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm font-bold shadow-sm">
              <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" /> <span className="leading-snug">{warningMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-4 border-b border-border pb-2">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground w-12 sm:w-16">A:</span>
            <input type="email" value={form.to} onChange={e => setForm({...form, to: e.target.value})} disabled={loading} className="flex-1 bg-transparent border-none focus:ring-0 text-xs sm:text-sm font-bold text-foreground outline-none" placeholder="email@cliente.it" />
          </div>

		  {/* RIGA OGGETTO E SELETTORE MODELLO */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className={`flex-1 w-full`}>
              <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Oggetto</label>
              <input 
                type="text" 
                value={form.subject} 
                onChange={e => setForm({ ...form, subject: e.target.value })} 
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" 
                required 
              />
            </div>
            
            {/* Mostriamo la tendina solo se ci sono almeno 2 modelli tra cui scegliere */}
            {templates.length > 1 && (
              <div className="w-full sm:w-1/3 shrink-0">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 text-primary">Modello</label>
                <select 
                  value={selectedTemplateIndex} 
                  onChange={handleTemplateChange}
                  className="w-full px-3 py-2 border border-blue-200 rounded-lg bg-blue-50 text-blue-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-bold cursor-pointer"
                >
                  {templates.map((t, idx) => (
                    // Uso il campo 'titolo', 'descrizione' o 'oggetto' in base a cosa usi nel DB. Fallback su Modello 1, 2, ecc.
                    <option key={idx} value={idx}>
                      {t.titolo || t.descrizione || `Modello ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 border-b border-border pb-2">
            <span className="text-xs sm:text-sm font-bold text-muted-foreground w-12 sm:w-16">Allegati:</span>
            <div className="flex items-center gap-1.5 px-3 py-1 bg-secondary rounded-full text-[11px] sm:text-xs font-bold text-foreground border border-border max-w-[70%] sm:max-w-none">
              <Paperclip className="w-3.5 h-3.5 shrink-0" /> <span className="truncate">{pdfData.filename}</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col h-44 sm:h-64">
            <textarea 
              value={form.body} 
              onChange={e => setForm({...form, body: e.target.value})} 
              disabled={loading}
              className="flex-1 w-full bg-transparent border border-border rounded-xl p-3 sm:p-4 text-xs sm:text-sm focus:ring-2 focus:ring-primary/50 outline-none resize-none custom-scrollbar"
            />
            <p className="text-[10px] text-muted-foreground mt-2 px-1 leading-snug">
              Nota: Il tag <strong>?logo?</strong> verrà sostituito in automatico dal sistema con il logo dell'azienda all'interno della mail.
            </p>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3 sm:py-4 bg-secondary/30 border-t border-border flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 shrink-0">
          <button onClick={onClose} disabled={loading} className="w-full sm:w-auto px-4 sm:px-5 py-2 rounded-lg border border-input text-muted-foreground font-bold hover:bg-background transition-colors disabled:opacity-50 text-sm">
            Annulla
          </button>
          <button onClick={handleSend} disabled={loading} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 sm:px-8 py-2 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 shadow-md transition-colors disabled:opacity-50 text-sm">
            {loading ? <RefreshCcw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            {loading ? 'Invio in corso...' : 'Invia Email'}
          </button>
        </div>

      </div>

      <ConfirmDialog 
        isOpen={feedback.isOpen} 
        type={feedback.type} 
        title={feedback.title} 
        message={<div className="whitespace-pre-line leading-relaxed">{feedback.msg}</div>} 
        onClose={() => setFeedback(p=>({...p, isOpen:false}))} 
      />
    </div>
  );
}
