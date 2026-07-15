import { X, LogOut } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getAreaForPath, getFormLabel, AREAS, AreaDef } from '@/contexts/MenuContext';
import { useState } from 'react';
import ModalMenu from './ModalMenu';

interface AppHeaderProps {
  onLogout: () => void;
}

const AppHeader = ({ onLogout }: AppHeaderProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  const area = getAreaForPath(location.pathname);
  const formLabel = getFormLabel(location.pathname);
  const [reopenArea, setReopenArea] = useState<AreaDef | null>(null);

  const handleClose = () => {
    if (area) {
      // Reopen the area's modal menu instead of going to main menu
      const areaDef = AREAS.find(a => a.id === area.id);
      if (areaDef) {
        navigate('/');
        // Small delay to ensure we're on home before opening modal
        setTimeout(() => {
          setReopenArea(areaDef);
        }, 50);
        return;
      }
    }
    navigate('/');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
        <div className="max-w-[1400px] mx-auto px-4 flex items-center justify-between h-14">
          {/* Left: Logo */}
          <div className="flex items-center gap-3 shrink-0">
            <img src="/gl_logo.png" alt="GL Informatica" className="h-9 w-auto object-contain" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>

          {/* Center */}
          <div className="flex-1 text-center px-4">
            {isHome ? (
              <span className="text-base sm:text-lg font-bold text-foreground">Multi-V – il Gestionale su misura</span>
            ) : area ? (
              <span
                className="inline-block px-4 py-1 rounded-lg text-sm sm:text-base font-bold text-foreground"
                style={{ backgroundColor: area.bgHex }}
              >
                {area.title} – {formLabel}
              </span>
            ) : (
              <span className="text-base font-bold text-foreground">Multi-V</span>
            )}
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            {!isHome ? (
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors min-h-[48px]"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">CHIUDI</span>
              </button>
            ) : (
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors min-h-[48px]"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">USCITA</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Reopen area modal after navigating home */}
      {reopenArea && (
        <ModalMenu area={reopenArea} onClose={() => setReopenArea(null)} />
      )}
    </>
  );
};

export default AppHeader;
