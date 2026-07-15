import { useState, useEffect, useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useClienti } from '@/hooks/api/useClienti';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';

// IMPORTA IL NUOVO COMPONENTE DI AUTOCOMPLETAMENTO
import FastAutocomplete from '@/components/ui/FastAutocomplete';

export interface Filters {
  anno: number;
  meseDal: number;
  meseAl: number;
  tipo: number;
  puntoVendita: number;
  cliente: number;
  soloVerificati: boolean;
  soloRegistrati: boolean;
  soloCaricati: boolean;
}

const STORAGE_KEY = 'gestionale_filters';

const currentYear = new Date().getFullYear();
const defaultFilters: Filters = {
  anno: currentYear,
  meseDal: 1,
  meseAl: 12,
  tipo: 0,
  puntoVendita: 0,
  cliente: 0,
  soloVerificati: false,
  soloRegistrati: false,
  soloCaricati: false,
};

interface FilterBarProps {
  onApply: (filters: Filters) => void;
}

const FilterBar = ({ onApply }: FilterBarProps) => {
  const [filters, setFilters] = useState<Filters>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultFilters;
  });
  
  const [expanded, setExpanded] = useState(() => {
    try { const s = localStorage.getItem('gestionale_filters_expanded'); return s === null ? false : s === 'true'; } catch { return false; }
  });
  
  // --- HOOKS API REALI ---
  const { data: magazziniData, isLoading: magazziniLoading, isError: magazziniError } = useMagazzini();
  const { data: clientiData, isLoading: clientiLoading } = useClienti();
  const { data: tipiDocData =[], isLoading: tipiLoading } = useTipiDocumento();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    onApply(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const update = (key: keyof Filters, value: number | boolean) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const reset = () => {
    setFilters(defaultFilters);
    onApply(defaultFilters);
  };

  // --- PREPARAZIONE AUTOCOMPLETE (Mappiamo i Clienti) ---
  const autocompleteOptions = useMemo(() => {
    if (!clientiData) return [];
    
    return clientiData
      // RIMOSSO IL FILTRO ".filter": Ora includiamo anche le anagrafiche disattivate!
      .map((c: any) => {
        // Logica universale per verificare se è attivo
        const isAttivo = c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1';
        const baseLabel = c.Ragione_Sociale || c['Ragione Sociale'] || '-';
        
        return {
          id: Number(c.ID),
          // Se è disattivato, mostriamo l'icona ⛔ e il testo [DISATTIVATO]
          label: isAttivo ? baseLabel : `⛔ ${baseLabel} [DISATTIVATO]`,
          originalData: c // Manteniamo i dati originali per sicurezza
        };
      })
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [clientiData]);

  const selectClass = "px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm mb-6 animate-fade-in">
      <button
        onClick={() => { const next = !expanded; setExpanded(next); localStorage.setItem('gestionale_filters_expanded', String(next)); }}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground min-h-[48px]"
      >
        <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> {expanded ? '▲ Nascondi filtri' : '▼ Mostra filtri'}</span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
			
            {/* Anno */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Anno</label>
              <select value={filters.anno} onChange={e => update('anno', +e.target.value)} className={selectClass + ' w-full'}>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1, currentYear + 2].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>            
            
            {/* Mese Dal */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Mese Dal</label>
              <select value={filters.meseDal} onChange={e => update('meseDal', +e.target.value)} className={selectClass + ' w-full'}>
                {['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'].map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            
            {/* Mese Al */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Mese Al</label>
              <select value={filters.meseAl} onChange={e => update('meseAl', +e.target.value)} className={selectClass + ' w-full'}>
                {['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'].map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            
            {/* Tipo */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Tipo Documento</label>
              <select value={filters.tipo} onChange={e => update('tipo', +e.target.value)} className={selectClass + ' w-full'}>
                <option value={0}>Tutti</option>
                {tipiLoading && <option value={0}>Caricamento...</option>}
                {!tipiLoading && tipiDocData.map((t: any) => <option key={t.id} value={t.id}>{t.descrizione}</option>)}
              </select>
            </div>
            
            {/* Punto Vendita */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Punto Vendita</label>
              <select value={filters.puntoVendita} onChange={e => update('puntoVendita', +e.target.value)} className={selectClass + ' w-full'}>
                <option value={0}>Tutti</option>
                {magazziniLoading && <option value={0}>Caricamento...</option>}
                {magazziniError && !magazziniLoading && <option value={0}>Errore caricamento</option>}
                {!magazziniLoading && !magazziniError && (magazziniData ||[]).filter((m: any) => m.attivo).map((m: any) => (
                  <option key={m.cod} value={m.cod}>{m.Descrizione}</option>
                ))}
              </select>
            </div>
            
            {/* Cliente - Fast Autocomplete */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Cliente / Fornitore</label>
              <FastAutocomplete 
                options={autocompleteOptions}
                value={filters.cliente}
                onChange={(id) => update('cliente', Number(id))}
                placeholder={clientiLoading ? 'Caricamento...' : 'Cerca anagrafica...'}
                disabled={clientiLoading}
              />
            </div>
          </div>

		      {/* Checkboxes e Pulsanti */}
          <div className="flex flex-wrap items-center gap-5 mt-4">
            <CheckboxFilter label="Solo NON Verificati" checked={filters.soloVerificati} onChange={v => update('soloVerificati', v)} />
            <CheckboxFilter label="Solo NON Registrati" checked={filters.soloRegistrati} onChange={v => update('soloRegistrati', v)} />
            <CheckboxFilter label="Solo NON Caricati" checked={filters.soloCaricati} onChange={v => update('soloCaricati', v)} />

            <div className="flex gap-2 ml-auto">
              <button onClick={reset} className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
                <RotateCcw className="w-3.5 h-3.5" /> Reset
              </button>
              <button onClick={() => onApply(filters)} className="flex items-center gap-1.5 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-sm">
                Applica Filtri
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const CheckboxFilter = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground select-none">
    <input
      type="checkbox"
      checked={checked}
      onChange={e => onChange(e.target.checked)}
      className="w-4 h-4 rounded border-input text-primary focus:ring-ring accent-primary"
    />
    {label}
  </label>
);

export default FilterBar;