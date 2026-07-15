import { useState, useEffect, useMemo } from 'react';
import { Filter, RotateCcw } from 'lucide-react';
import { useClienti } from '@/hooks/api/useClienti';
import { useCausali } from '@/hooks/api/useCausali';
import { useTipologieMovimento } from '@/hooks/api/useTipologieMovimento';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';

// IMPORTA IL NUOVO COMPONENTE DI AUTOCOMPLETAMENTO
import FastAutocomplete from '@/components/ui/FastAutocomplete';

export interface ContabilitaFilters {
  dal: string;
  al: string;
  tipoCliFor: number; // 0=Tutti, 1=Cliente(tipocli=1 o 0), 2=Fornitore(tipocli=2 o 0)
  cliente: number;
  causale: number;
  tipoMovimento: number;
  mezzoPagamento: number;
}

const STORAGE_KEY = 'gestionale_contabilita_filters';

// Helpers date
const currentYear = new Date().getFullYear();
const getFirstDayOfYear = () => `${currentYear}-01-01`;
const getLastDayOfYear = () => `${currentYear}-12-31`;

const defaultFilters: ContabilitaFilters = {
  dal: getFirstDayOfYear(),
  al: getLastDayOfYear(),
  tipoCliFor: 0,
  cliente: 0,
  causale: 0,
  tipoMovimento: 0,
  mezzoPagamento: 0,
};

interface Props {
  onApply: (filters: ContabilitaFilters) => void;
}

const FilterContabilita = ({ onApply }: Props) => {
  const [filters, setFilters] = useState<ContabilitaFilters>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultFilters;
  });
  
  const [expanded, setExpanded] = useState(() => {
    try { const s = localStorage.getItem('gestionale_contabilita_filters_expanded'); return s === null ? false : s === 'true'; } catch { return false; }
  });
  
  // --- HOOKS API REALI ---
  const { data: clientiData, isLoading: clientiLoading, isError: clientiError } = useClienti();
  const { data: causaliData = [], isLoading: causaliLoading } = useCausali();
  const { data: tipologieData = [], isLoading: tipologieLoading } = useTipologieMovimento();
  const { data: mezziData = [], isLoading: mezziLoading } = useMezziPagamento();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    onApply(filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: keyof ContabilitaFilters, value: string | number) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value };
      // Se cambio la Causale, resetto il Tipo Movimento per evitare mismatch
      if (key === 'causale') next.tipoMovimento = 0;
      return next;
    });
  };

  const reset = () => {
    setFilters(defaultFilters);
    onApply(defaultFilters);
  };

  // --- PREPARAZIONE AUTOCOMPLETE ---
  const autocompleteOptions = useMemo(() => {
    if (!clientiData) return [];
    
    return clientiData
      // RIMOSSO IL FILTRO ".filter" DEGLI ATTIVI: Ora passano tutti!
      
      // Filtro per Cliente/Fornitore (Regola aziendale: 0=Entrambi, 1=Solo Clienti, 2=Solo Fornitori)
      .filter((c: any) => {
        const t = Number(c.tipocli);
        if (filters.tipoCliFor === 1) return t === 1 || t === 0; // Mostra Clienti e Ibridi
        if (filters.tipoCliFor === 2) return t === 2 || t === 0; // Mostra Fornitori e Ibridi
        return true; // Se filtro = 0 (Tutti), mostra tutti
      })
      .map((c: any) => {
        // Funzione per verificare se è attivo
        const isAttivo = c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1';
        const baseLabel = c.Ragione_Sociale || c['Ragione Sociale'] || '-';
        
        return {
          id: Number(c.ID),
          // Se è disattivato, mostriamo l'icona ⛔ e il testo [DISATTIVATO]
          label: isAttivo ? baseLabel : `⛔ ${baseLabel} [DISATTIVATO]`,
          originalData: c // Portiamo dietro l'oggetto intero per sicurezza
        };
      })
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  }, [clientiData, filters.tipoCliFor]);

  // Filtra i sottoconti (Tipologie) in base alla Causale Mastro selezionata
  const tipiFiltered = filters.causale > 0 
    ? tipologieData.filter((t: any) => Number(t.idcausale) === Number(filters.causale))
    : tipologieData;

  const selectClass = "w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 font-medium";
  const labelClass = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm mb-6 animate-fade-in">
      <button
        onClick={() => { const next = !expanded; setExpanded(next); localStorage.setItem('gestionale_contabilita_filters_expanded', String(next)); }}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground min-h-[48px]"
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" /> {expanded ? '▲ Nascondi filtri' : '▼ Mostra filtri'}
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-border pt-4">
          
          {/* RIGA 1: Date e Anagrafiche */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
            {/* Dal */}
            <div>
              <label className={labelClass}>Dal</label>
              <input type="date" value={filters.dal} onChange={e => update('dal', e.target.value)} className={selectClass} />
            </div>
            
            {/* Al */}
            <div>
              <label className={labelClass}>Al</label>
              <input type="date" value={filters.al} onChange={e => update('al', e.target.value)} className={selectClass} />
            </div>
            
            {/* Tipo Cli/For */}
            <div>
              <label className={labelClass}>Soggetti</label>
              <select value={filters.tipoCliFor} onChange={e => { update('tipoCliFor', +e.target.value); update('cliente', 0); }} className={selectClass}>
                <option value={0}>Tutti</option>
                <option value={1}>Solo Clienti</option>
                <option value={2}>Solo Fornitori</option>
              </select>
            </div>
            
            {/* Ragione Sociale Search - Fast Autocomplete */}
            <div className="col-span-2 sm:col-span-3 lg:col-span-1">
              <label className={labelClass}>Ragione Sociale</label>
              <FastAutocomplete 
                options={autocompleteOptions}
                value={filters.cliente}
                onChange={(id) => update('cliente', Number(id))}
                placeholder={clientiLoading ? 'Caricamento...' : clientiError ? 'Errore anagrafiche' : 'Inizia a digitare...'}
                disabled={clientiLoading || clientiError}
              />
            </div>
          </div>

          {/* RIGA 2: Causali, Sottoconti, Pagamento e Pulsanti */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            
            {/* Causale Contabile */}
            <div>
              <label className={labelClass}>Causale Contabile (Mastro)</label>
              <select value={filters.causale} onChange={e => { update('causale', +e.target.value); update('tipoMovimento', 0); }} className={selectClass}>
                <option value={0}>Tutte</option>
                {causaliLoading && <option value={0}>Caricamento...</option>}
                {!causaliLoading && causaliData.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.suffisso} - {c.Descrizione}</option>
                ))}
              </select>
            </div>
            
            {/* Tipo Movimento */}
            <div>
              <label className={labelClass}>Tipo Movimento (Sottoconto)</label>
              <select value={filters.tipoMovimento} onChange={e => update('tipoMovimento', +e.target.value)} className={selectClass}>
                <option value={0}>Tutti</option>
                {tipologieLoading && <option value={0}>Caricamento...</option>}
                {!tipologieLoading && tipiFiltered.map((t: any) => {
                  const caus = causaliData.find((c: any) => c.id === t.idcausale);
                  return (
                    <option key={t.id} value={t.id}>{caus?.suffisso || ''}/{t.codice} - {t.Descrizione}</option>
                  );
                })}
              </select>
            </div>
            
            {/* Mezzo Pagamento */}
            <div>
              <label className={labelClass}>Mezzo Pagamento</label>
              <select value={filters.mezzoPagamento} onChange={e => update('mezzoPagamento', +e.target.value)} className={selectClass}>
                <option value={0}>Tutti</option>
                {mezziLoading && <option value={0}>Caricamento...</option>}
                {!mezziLoading && mezziData.map((m: any) => (
                  <option key={m.id} value={m.id}>{m.descrizione}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Pulsanti */}
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={reset} className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors w-full sm:w-auto">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={() => onApply(filters)} className="flex items-center justify-center gap-1.5 px-6 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity shadow-sm w-full sm:w-auto">
              <Filter className="w-3.5 h-3.5" /> Applica
            </button>
          </div>
          
        </div>
      )}
    </div>
  );
};

export default FilterContabilita;