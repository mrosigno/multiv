import { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type AreaId = 'documenti' | 'contabilita' | 'magazzino' | 'impostazioni';

export interface MenuItem {
  label: string;
  path: string;
  disabled?: boolean;
}

export interface AreaDef {
  id: AreaId;
  title: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  bgHex: string;
  items: MenuItem[];
}

export const AREAS: AreaDef[] = [
  {
    id: 'documenti',
    title: 'Documenti e Fatturazione',
    bgClass: 'bg-area-documenti',
    borderClass: 'border-area-documenti',
    textClass: 'text-area-documenti-fg',
    bgHex: '#E3F2FD',
    items: [
      { label: 'Gestione Documenti', path: '/fatturazione' },
      { label: 'Anagrafica Clienti/Fornitori', path: '/documenti/clienti' },
      { label: 'Anagrafica Agenti', path: '/documenti/agenti' },
      { label: 'Tipologia Documenti', path: '/documenti/tipo-documenti' },
      { label: 'Accorpamento/Fatturazione Differita', path: '#accorpamento' },
	  { label: 'Gestione Flussi SDI', path: '/documenti/flussi-sdi' },
      { label: 'Riepiloghi/Report', path: '#', disabled: true },
    ],
  },
  {
    id: 'contabilita',
    title: 'Contabilità',
    bgClass: 'bg-area-contabilita',
    borderClass: 'border-area-contabilita',
    textClass: 'text-area-contabilita-fg',
    bgHex: '#E8F5E9',
    items: [
      { label: 'Prima Nota e Scadenzario', path: '/contabilita' },
      { label: 'Piano dei Conti – Mastri', path: '/documenti/causali' },
      { label: 'Piano dei Conti – Sottoconti', path: '/documenti/tipologie-movimento' },
      { label: 'Modalità di Pagamento', path: '/documenti/modalita-pagamento' },
      { label: 'Mezzi di Pagamento', path: '/documenti/mezzi-pagamento' },
      { label: 'Aliquote IVA', path: '/documenti/aliquote-iva' },
      { label: 'Elenco Istituti di Credito', path: '/documenti/banche' },
      { label: 'Riepiloghi/Report', path: '#', disabled: true },
    ],
  },
  {
    id: 'magazzino',
    title: 'Magazzino',
    bgClass: 'bg-area-magazzino',
    borderClass: 'border-area-magazzino',
    textClass: 'text-area-magazzino-fg',
    bgHex: '#FFF3E0',
    items: [
      { label: 'Catalogo Prodotti/Listino', path: '/magazzino/catalogo' },
     { label: 'Movimenti di Magazzino', path: '/magazzino/movimenti' },
      { label: 'Inventario', path: '/magazzino/inventario' },
      { label: 'Riepiloghi/Report', path: '#', disabled: true },
    ],
  },
  {
    id: 'impostazioni',
    title: 'Impostazioni e Archivi',
    bgClass: 'bg-area-impostazioni',
    borderClass: 'border-area-impostazioni',
    textClass: 'text-area-impostazioni-fg',
    bgHex: '#F3E5F5',
    items: [
      { label: 'Impostazione Listini', path: '/impostazioni/listini' },
      { label: 'Brand', path: '/impostazioni/brand' },
      { label: 'Reparti', path: '/impostazioni/reparti' },
      { label: 'Gestione Magazzini', path: '/impostazioni/magazzini' },
	  { label: 'Impostazioni Flussi SDI', path: '/impostazioni/sdi' },
	  { label: 'Impostazioni Azienda', path: '/impostazioni/azienda' },
    ],
  },
];

export function getAreaForPath(path: string): AreaDef | undefined {
  for (const area of AREAS) {
    if (area.items.some(item => item.path !== '#' && path.startsWith(item.path))) {
      return area;
    }
  }
  return undefined;
}

export function getFormLabel(path: string): string {
  for (const area of AREAS) {
    const item = area.items.find(i => i.path === path);
    if (item) return item.label;
  }
  return '';
}

// --- NUOVI TIPI PER IL LAYOUT ---
export type PaginationData = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
} | undefined;

interface MenuContextType {
  lastArea: AreaId | null;
  setLastArea: (area: AreaId) => void;
  isAccorpamentoOpen: boolean;
  setAccorpamentoOpen: (isOpen: boolean) => void;
  // --- NUOVI CAMPI LAYOUT ---
  headerTitle: string;
  setHeaderTitle: (title: string) => void;
  pagination: PaginationData;
  setPagination: (data: PaginationData) => void;
}

const MenuContext = createContext<MenuContextType>({ 
  lastArea: null, 
  setLastArea: () => {},
  isAccorpamentoOpen: false,
  setAccorpamentoOpen: () => {},
  headerTitle: '',
  setHeaderTitle: () => {},
  pagination: undefined,
  setPagination: () => {}
});

export const useMenu = () => useContext(MenuContext);

export const MenuProvider = ({ children }: { children: ReactNode }) => {
  const [lastArea, setLastAreaState] = useState<AreaId | null>(() => {
    try {
      return localStorage.getItem('gestionale_last_area') as AreaId | null;
    } catch { return null; }
  });

  const [isAccorpamentoOpen, setAccorpamentoOpen] = useState(false);
  
  // --- NUOVI STATI PER IL LAYOUT ---
  const [headerTitle, setHeaderTitle] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationData>(undefined);

  const setLastArea = useCallback((area: AreaId) => {
    setLastAreaState(area);
    try { localStorage.setItem('gestionale_last_area', area); } catch {}
  }, []);

  return (
    <MenuContext.Provider value={{ 
      lastArea, 
      setLastArea,
      isAccorpamentoOpen,
      setAccorpamentoOpen,
      headerTitle,
      setHeaderTitle,
      pagination,
      setPagination
    }}>
      {children}
    </MenuContext.Provider>
  );
};