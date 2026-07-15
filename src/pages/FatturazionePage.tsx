import { useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import FilterBar, { Filters } from '@/components/FilterBar';
import DocumentList from '@/components/DocumentList';
import { useFatture } from '@/hooks/api/useFatture';

const FatturazionePage = () => {
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  
  // Memorizziamo l'ultimo stato dei filtri (che parte con i default di FilterBar)
  const [lastFilters, setLastFilters] = useState<Filters | null>(null);

  // Determiniamo l'anno attivo (se l'utente non ha ancora filtrato, usiamo quello corrente)
  const activeYear = lastFilters ? Number(lastFilters.anno) : new Date().getFullYear();

  // --- HOOK API REALE (Passiamo l'anno!) ---
  const { data: apiFatture = [], isLoading, isError } = useFatture(activeYear);

  // --- FILTRO IN TEMPO REALE ---
  // Grazie a useMemo non c'è NESSUN LOOP. Filtra i dati in memoria all'istante.
  // Nota: l'Anno non è qui dentro, perché lo abbiamo già filtrato alla radice nel database!
  const filtered = useMemo(() => {
    if (!lastFilters || apiFatture.length === 0) return [];

    return apiFatture.filter((doc: any) => {
      if (!doc.datafatt) return false;
      const date = new Date(doc.datafatt);
      const month = date.getMonth() + 1;
      
      // Filtri base
      if (month < Number(lastFilters.meseDal) || month > Number(lastFilters.meseAl)) return false;
      if (lastFilters.tipo && Number(doc.Tipo) !== Number(lastFilters.tipo)) return false;
      if (lastFilters.puntoVendita && Number(doc.codmag) !== Number(lastFilters.puntoVendita)) return false;
      if (lastFilters.cliente && Number(doc.IDCliente) !== Number(lastFilters.cliente)) return false;
      
      // Filtri checkbox negativi
      if (lastFilters.soloVerificati && Number(doc.verificato) !== 0) return false;
      if (lastFilters.soloRegistrati && Number(doc.registrata) !== 0) return false;
      if (lastFilters.soloCaricati && Number(doc.caricata) !== 0) return false;
      
      return true;
    });
  }, [apiFatture, lastFilters]);

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      
      {/* Quando l'utente clicca Applica, cambiamo i filtri. Se cambia l'anno, React Query scaricherà i nuovi dati! */}
      <FilterBar onApply={setLastFilters} />
      
      {isLoading && (
        <div className="p-8 text-center text-muted-foreground animate-pulse">
          Caricamento documenti dal database in corso...
        </div>
      )}
      
      {isError && !isLoading && (
        <div className="p-8 text-center text-destructive font-semibold">
          Errore di connessione al database.
        </div>
      )}
      
      {!isLoading && !isError && (
        <DocumentList 
          documents={filtered} 
          // onUpdate non ci serve più: se modifichiamo/salviamo un doc, React Query ricarica la cache da solo!
          onUpdate={() => {}} 
        />
      )}

    </AppLayout>
  );
};

export default FatturazionePage;