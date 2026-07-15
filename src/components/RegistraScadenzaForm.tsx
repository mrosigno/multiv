import { useState } from 'react';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';
import { PrimaNotaCasa } from '@/data/contabilitaMockData';

interface Props {
  record: PrimaNotaCasa;
  onRegistra: (record: PrimaNotaCasa, importo: number, data: string) => void;
  onClose: () => void;
}

export default function RegistraScadenzaForm({ record, onRegistra, onClose }: Props) {
  // Calcola l'importo atteso (il maggiore tra Dare e Avere)
  const importoAtteso = Number(record.Dare || 0) + Number(record.Avere || 0);
  
  const [importo, setImporto] = useState<number>(importoAtteso);
  const [dataReg, setDataReg] = useState<string>(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (importo <= 0) {
      setError("L'importo deve essere maggiore di zero.");
      return;
    }

    // 1. BLOCCO: Importo superiore al previsto
    if (importo > importoAtteso) {
      setError(`L'importo inserito (€ ${importo}) supera il totale della scadenza (€ ${importoAtteso}).`);
      return;
    }

    // 2. AVVISO: Importo inferiore (Acconto)
    if (importo < importoAtteso) {
      const conferma = window.confirm(
        `ATTENZIONE: Stai registrando un incasso/pagamento parziale (€ ${importo} su € ${importoAtteso}).\n\n` +
        `La scadenza rimarrà aperta nello scadenzario per la differenza (€ ${Math.round((importoAtteso - importo)*100)/100}).\n\nVuoi procedere?`
      );
      if (!conferma) return;
    }

    // Se tutto ok, passa i dati al componente padre per il salvataggio
    onRegistra(record, importo, dataReg);
  };

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[300] flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-md flex flex-col border-2 border-primary/20 overflow-hidden animate-fade-in">
        
        <div className="bg-primary/10 px-6 py-4 border-b border-primary/20 flex justify-between items-center">
          <h3 className="text-lg font-bold text-primary">Registra Pagamento</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          
          <div className="bg-secondary/30 p-3 rounded-lg border border-border text-sm text-center">
            Stai registrando il saldo per il documento:<br/>
            <strong className="text-foreground">{record.descrizione}</strong>
          </div>

          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg border border-destructive/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Data Registrazione</label>
            <input 
              type="date" 
              value={dataReg} 
              onChange={e => setDataReg(e.target.value)} 
              className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground focus:ring-2 focus:ring-primary/50" 
              required 
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Importo da Registrare (€)</label>
            <input 
              type="number" 
              step="0.01" 
              value={importo || ''} 
              onChange={e => {
                setImporto(Number(e.target.value));
                setError(''); // Pulisce l'errore se l'utente cambia cifra
              }} 
              className="w-full px-3 py-3 rounded-lg border border-input bg-background text-foreground text-xl font-mono font-bold text-center focus:ring-2 focus:ring-primary/50" 
              required 
            />
            <p className="text-xs text-muted-foreground text-center mt-2">
              Importo atteso: <strong className="text-foreground">€ {importoAtteso.toFixed(2)}</strong>
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-input text-sm font-bold text-muted-foreground hover:bg-secondary transition-colors">
              Annulla
            </button>
            <button type="submit" className="flex items-center gap-2 px-6 py-2 rounded-lg bg-success text-success-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-sm">
              <CheckCircle className="w-4 h-4" /> Conferma
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}