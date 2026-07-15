import { useState, useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import CrudListPage, { ColumnDef } from '@/components/CrudListPage';
import { Agente } from '@/data/anagraficheMockData';
import { useAgenti } from '@/hooks/api/useAgenti';

const columns: ColumnDef[] = [
  { key: 'Id', label: 'ID', type: 'number', required: true },
  { key: 'Nominativo', label: 'Nominativo', required: true },
  { key: 'Indirizzo', label: 'Indirizzo' },
  { key: 'Telefono', label: 'Telefono' },
  { key: 'CF_PIVA', label: 'CF / P.IVA' },
];

const AgentiPage = () => {
  const [data, setData] = useState<Agente[]>([]);
  const [auth] = useState(() => !!localStorage.getItem('gestionale_auth'));
  const { data: apiData, isLoading, isError } = useAgenti();

  useEffect(() => {
    if (apiData) {
      setData(apiData);
    }
  }, [apiData]);

  if (!auth) { window.location.href = '/'; return null; }

  return (
    <AppLayout onLogout={() => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; }}>
      {isLoading && <p className="text-sm text-muted-foreground">Caricamento agenti...</p>}
      {isError && !isLoading && <p className="text-sm text-destructive">Errore nel caricamento degli agenti</p>}
      {!isLoading && !isError && (
        <CrudListPage
          title="Agenti"
          data={data}
          columns={columns}
          idKey="Id"
          searchKeys={['Nominativo', 'CF_PIVA', 'Indirizzo']}
          searchPlaceholder="Cerca per nominativo, CF/PIVA..."
          onSave={setData as any}
        />
      )}
    </AppLayout>
  );
};

export default AgentiPage;
