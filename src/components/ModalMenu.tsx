import { X, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AreaDef, useMenu } from '@/contexts/MenuContext'; // Assicurati che qui ci sia il context aggiornato nel passaggio precedente

interface ModalMenuProps {
  area: AreaDef;
  onClose: () => void;
}

const ModalMenu = ({ area, onClose }: ModalMenuProps) => {
  const navigate = useNavigate();
  // 1. Aggiungiamo setAccorpamentoOpen estraendolo da useMenu()
  const { setLastArea, setAccorpamentoOpen } = useMenu();

  const handleClick = (path: string) => {
    // 2. INTERCETTIAMO IL CLICK PER L'ACCORPAMENTO
    if (path === '#accorpamento') {
      if (setAccorpamentoOpen) {
        setAccorpamentoOpen(true); // Apriamo il grande modale dell'accorpamento
      }
      onClose(); // Chiudiamo questo piccolo menù "Seleziona area..."
      return; // Interrompiamo la funzione per NON navigare
    }

    // Comportamento standard per tutte le altre voci
    setLastArea(area.id);
    onClose();
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md bg-card rounded-2xl shadow-2xl border-2 overflow-hidden animate-scale-in"
        style={{ borderColor: area.bgHex }}
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: area.bgHex }}>
          <h2 className="text-lg font-bold text-foreground">Seleziona area {area.title}...</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-black/10 transition-colors">
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>
        <div className="p-3 space-y-2 max-h-[60vh] overflow-y-auto">
          {area.items.map((item) => (
            <button
              key={item.label}
              disabled={item.disabled}
              onClick={() => !item.disabled && handleClick(item.path)}
              className={`w-full text-left px-4 py-3.5 rounded-xl text-sm font-medium transition-all flex items-center gap-3 min-h-[48px] ${
                item.disabled
                  ? 'opacity-40 cursor-not-allowed bg-muted/30'
                  : 'hover:scale-[1.02] hover:shadow-md bg-muted/50 hover:bg-muted cursor-pointer'
              }`}
              style={!item.disabled ? { borderLeft: `4px solid ${area.bgHex}` } : {}}
            >
              {item.disabled && <Clock className="w-4 h-4 text-muted-foreground shrink-0" />}
              <span className="text-foreground">{item.label}</span>
              {item.disabled && <span className="ml-auto text-xs text-muted-foreground">⏳</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ModalMenu;