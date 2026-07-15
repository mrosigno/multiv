import { useState } from 'react';
import { FileText, Calculator, Package, Settings } from 'lucide-react';
import { AREAS, AreaDef } from '@/contexts/MenuContext';
import ModalMenu from './ModalMenu';
import AppHeader from './AppHeader';

const areaIcons: Record<string, React.ReactNode> = {
  documenti: <FileText className="w-8 h-8" />,
  contabilita: <Calculator className="w-8 h-8" />,
  magazzino: <Package className="w-8 h-8" />,
  impostazioni: <Settings className="w-8 h-8" />,
};

interface MenuHomeProps {
  onLogout: () => void;
}

const MenuHome = ({ onLogout }: MenuHomeProps) => {
  const [openArea, setOpenArea] = useState<AreaDef | null>(null);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader onLogout={onLogout} />

      <main className="max-w-[900px] mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {AREAS.map(area => (
            <button
              key={area.id}
              onClick={() => setOpenArea(area)}
              className="group rounded-2xl border-2 border-border shadow-sm p-6 flex flex-col items-center justify-center gap-3 min-h-[130px] transition-all duration-200 hover:scale-[1.02] hover:shadow-lg cursor-pointer"
              style={{ backgroundColor: area.bgHex }}
            >
              <span className="text-foreground/70 group-hover:text-foreground transition-colors">
                {areaIcons[area.id]}
              </span>
              <span className="text-base font-bold text-foreground text-center">{area.title}</span>
            </button>
          ))}
        </div>
      </main>

      {openArea && <ModalMenu area={openArea} onClose={() => setOpenArea(null)} />}
    </div>
  );
};

export default MenuHome;
