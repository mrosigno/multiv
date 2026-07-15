import React, { useEffect, useRef } from 'react';
import { AlertTriangle, RefreshCcw, Info, CheckCircle, XCircle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message?: React.ReactNode;
  onConfirm?: () => void;
  onClose: () => void;
  isPending?: boolean;
  type?: 'danger' | 'info' | 'success' | 'success-auto' | 'cancel-auto' | 'warning';
  confirmLabel?: string;
  showCancel?: boolean;
  hideCancel?: boolean;
}

export default function ConfirmDialog({ 
  isOpen, title, message, onConfirm, onClose, isPending, type = 'danger', confirmLabel = 'Sì, procedi', showCancel, hideCancel 
}: ConfirmDialogProps) {
  
  const timerRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isOpen && (type === 'success-auto' || type === 'cancel-auto')) {
      timerRef.current = setTimeout(() => { onClose(); }, 1200);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, type]);

  if (!isOpen) return null;

  if (type === 'success-auto' || type === 'cancel-auto') {
    const isCancel = type === 'cancel-auto';
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-foreground/10 backdrop-blur-[2px] animate-fade-in pointer-events-none p-4">
        <div className="bg-card rounded-2xl shadow-2xl p-6 flex flex-col items-center border border-border animate-scale-in text-center w-full max-w-[300px]">
          {isCancel ? <XCircle className="w-16 h-16 text-muted-foreground mb-3" /> : <CheckCircle className="w-16 h-16 text-success mb-3" />}
          <h2 className="text-xl font-black text-foreground">{title}</h2>
          {message && <div className="text-sm text-muted-foreground mt-2 font-medium whitespace-pre-wrap">{message}</div>}
        </div>
      </div>
    );
  }

  const isDanger = type === 'danger';
  const isSuccessOk = type === 'success'; 
  const isSingleButton = isSuccessOk || onConfirm === undefined || hideCancel;

  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-foreground/40 backdrop-blur-sm animate-fade-in" onClick={!isPending && !isSingleButton ? onClose : undefined}>
      {/* FIX: max-h-[90vh] flex flex-col per evitare che il modale esca dallo schermo! */}
      <div onClick={e => e.stopPropagation()} className="bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-2xl w-full max-w-sm flex flex-col max-h-[90vh] overflow-hidden animate-scale-in text-center">
        
        {/* FIX: flex-1 overflow-y-auto permette lo scroll del testo se troppo lungo */}
        <div className="p-6 pt-8 flex flex-col items-center flex-1 overflow-y-auto custom-scrollbar">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 shrink-0 ${isDanger ? 'bg-destructive/10' : isSuccessOk ? 'bg-success/10' : 'bg-primary/10'}`}>
            {isDanger ? <AlertTriangle className="w-8 h-8 text-destructive" /> : 
             isSuccessOk ? <CheckCircle className="w-8 h-8 text-success" /> : 
             <Info className="w-8 h-8 text-primary" />}
          </div>
          <h2 className="text-xl font-bold text-foreground mb-3">{title}</h2>
          {message && <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{message}</div>}
        </div>

        {/* FIX: flex-col-reverse su mobile mette il bottone Annulla sotto e l'azione principale sopra */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-3 px-6 py-4 bg-secondary/30 border-t border-border shrink-0">
          {isSingleButton ? (
            <button onClick={onClose} className={`w-full px-4 py-3 sm:py-2.5 rounded-xl text-white font-bold hover:opacity-90 transition-opacity shadow-sm ${isSuccessOk ? 'bg-success' : isDanger ? 'bg-destructive' : 'bg-primary'}`}>
              OK
            </button>
          ) : (
            <>
              <button onClick={onClose} disabled={isPending} className="w-full sm:w-auto flex-1 px-4 py-3 sm:py-2.5 rounded-xl border border-input bg-background font-bold text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50">
                Annulla
              </button>
              <button onClick={onConfirm} disabled={isPending} className={`w-full sm:w-auto flex-1 px-4 py-3 sm:py-2.5 rounded-xl font-bold transition-opacity flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm ${isDanger ? 'bg-destructive text-destructive-foreground hover:opacity-90' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
                {isPending ? <RefreshCcw className="w-4 h-4 animate-spin" /> : null}
                {confirmLabel}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}