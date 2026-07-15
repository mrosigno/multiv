import React, { createContext, useContext, useState } from 'react';

// Definiamo la struttura della paginazione
type PaginationData = {
  page: number;
  totalPages: number;
  pageSize: number;
  totalRecords: number;
  onPageChange: (newPage: number) => void;
  onPageSizeChange: (newPageSize: number) => void;
} | undefined;

// Creiamo il contesto
const LayoutContext = createContext<any>(null);

// Esportiamo il Provider (che avvolgerà l'App)
export const LayoutProvider = ({ children }: { children: React.ReactNode }) => {
  const [title, setTitle] = useState<string>('');
  const [pagination, setPagination] = useState<PaginationData>(undefined);

  return (
    <LayoutContext.Provider value={{ title, setTitle, pagination, setPagination }}>
      {children}
    </LayoutContext.Provider>
  );
};

// Esportiamo l'Hook personalizzato per usarlo facilmente nelle pagine
export const useLayout = () => useContext(LayoutContext);