import { useState, useEffect, useCallback } from 'react';
import FilterContabilita, { ContabilitaFilters } from '@/components/FilterContabilita';
import PrimaNotaTable from '@/components/PrimaNotaTable';
import ConfirmDialog from '@/components/ConfirmDialog'; // <-- NUOVO IMPORT
import { PrimaNotaCasa } from '@/data/contabilitaMockData';
import { useClienti } from '@/hooks/api/useClienti';
import { usePrimaNota } from '@/hooks/api/usePrimaNota';
import { useScadenzario } from '@/hooks/api/useScadenzario';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { API_HOST } from '@/config';

const Contabilita = () => {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'primaNota' | 'scadenzario'>('primaNota');
  
  const [primaNotaRecords, setPrimaNotaRecords] = useState<PrimaNotaCasa[]>([]);
  const [scadenzarioRecords, setScadenzarioRecords] = useState<PrimaNotaCasa[]>([]);
  
  const [filteredPN, setFilteredPN] = useState<PrimaNotaCasa[]>([]);
  const [filteredSC, setFilteredSC] = useState<PrimaNotaCasa[]>([]);
  const [lastFilters, setLastFilters] = useState<ContabilitaFilters | null>(null);
  
  // STATO PER LA MODALE DI CONFERMA REGISTRAZIONE
  const [confirmReg, setConfirmReg] = useState<{ isOpen: boolean; record: PrimaNotaCasa | null; importo: number; data: string }>({
    isOpen: false, record: null, importo: 0, data: ''
  });

  const { data: clientiData } = useClienti();
  
  // --- HOOKS API REALI ---
  const { data: apiPrimaNota, isLoading: isLoadingPN } = usePrimaNota();
  const { data: apiScadenzario, isLoading: isLoadingSC } = useScadenzario();

  useEffect(() => {
    if (apiPrimaNota) setPrimaNotaRecords(apiPrimaNota);
  }, [apiPrimaNota]);

  useEffect(() => {
    if (apiScadenzario) setScadenzarioRecords(apiScadenzario);
  }, [apiScadenzario]);

  const applyFilters = useCallback((filters: ContabilitaFilters) => {
    const filterFn = (records: PrimaNotaCasa[]) => records.filter(rec => {
      if (rec.data < filters.dal || rec.data > filters.al) return false;
      if (filters.tipoCliFor && clientiData) {
        const cli = clientiData.find((c: any) => Number(c.ID) === Number(rec.IdCliente));
        if (filters.tipoCliFor === 1 && Number(cli?.tipocli) !== 1) return false;
        if (filters.tipoCliFor === 2 && Number(cli?.tipocli) !== 0) return false;
      }
      if (filters.cliente && Number(rec.IdCliente) !== Number(filters.cliente)) return false;
      if (filters.causale && Number(rec.Categoria) !== Number(filters.causale)) return false;
      if (filters.tipoMovimento && Number(rec.TipoMovimento) !== Number(filters.tipoMovimento)) return false;
      if (filters.mezzoPagamento && Number(rec.mezzopag) !== Number(filters.mezzoPagamento)) return false;
      return true;
    });
    setFilteredPN(filterFn(primaNotaRecords));
    setFilteredSC(filterFn(scadenzarioRecords));
  }, [primaNotaRecords, scadenzarioRecords, clientiData]);

  const handleApply = useCallback((filters: ContabilitaFilters) => {
    setLastFilters(filters);
    applyFilters(filters);
  }, [applyFilters]);

  useEffect(() => {
    if (lastFilters) applyFilters(lastFilters);
  }, [primaNotaRecords, scadenzarioRecords, lastFilters, applyFilters]);

  // --- MUTATION REGISTRAZIONE REALE NEL DATABASE ---
  const registraMutation = useMutation({
    mutationFn: async ({ record, importoRegistrato, dataRegistrazione }: { record: PrimaNotaCasa, importoRegistrato: number, dataRegistrazione: string }) => {
      const importoPrevisto = Number(record.Dare || 0) + Number(record.Avere || 0);
      const isDare = Number(record.Dare || 0) > 0;

      // 1. Nuovo record per la Prima Nota
      const newPN = {
        ...record, Id: 0, data: dataRegistrazione,
        Dare: isDare ? importoRegistrato : 0, Avere: !isDare ? importoRegistrato : 0,
        chiuso: 1, datachiusura: dataRegistrazione, isScadenzario: false
      };

      const resPN = await fetch(`${API_HOST}/api.php?action=save_movimento`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newPN)
      });
      const dataPN = await resPN.json();
      if (!dataPN.success) throw new Error("Errore salvataggio Prima Nota");

      // 2. Aggiorna o Elimina lo Scadenzario
      if (importoRegistrato >= importoPrevisto) {
        await fetch(`${API_HOST}/api.php?action=delete_movimento`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ Id: record.Id, isScadenzario: true })
        });
      } else {
        const remaining = Math.round((importoPrevisto - importoRegistrato) * 100) / 100;
        const updatedScad = {
          ...record, Dare: isDare ? remaining : 0, Avere: !isDare ? remaining : 0, isScadenzario: true
        };
        await fetch(`${API_HOST}/api.php?action=save_movimento`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedScad)
        });
      }
      return true;
    },
    onSuccess: () => {
      // MAGIC: Ricarica i dati senza fare refresh della pagina!
      queryClient.invalidateQueries({ queryKey: ['prima_nota'] });
      queryClient.invalidateQueries({ queryKey: ['scadenzario'] });
      setConfirmReg({ isOpen: false, record: null, importo: 0, data: '' });
    },
    onError: (err: any) => {
      alert("Errore durante la registrazione: " + err.message);
    }
  });

  // Apriamo la modale di conferma invece di fare il fetch diretto
  const handleRegistra = (record: PrimaNotaCasa, importoRegistrato: number, dataRegistrazione: string) => {
    setConfirmReg({ isOpen: true, record, importo: importoRegistrato, data: dataRegistrazione });
  };

  const eseguiRegistrazione = () => {
    if (confirmReg.record) {
      registraMutation.mutate({
        record: confirmReg.record,
        importoRegistrato: confirmReg.importo,
        dataRegistrazione: confirmReg.data
      });
    }
  };

  const tabClass = (active: boolean) =>
    `px-5 py-2.5 text-sm font-semibold rounded-t-lg transition-colors ${
      active
        ? 'bg-card text-primary border border-border border-b-card -mb-px'
        : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
    }`;

  return (
    <div>
      {/* Tabs */}
      <div className="flex gap-1 mb-0 border-b border-border">
        <button className={tabClass(tab === 'primaNota')} onClick={() => setTab('primaNota')}>
          PRIMA NOTA
        </button>
        <button className={tabClass(tab === 'scadenzario')} onClick={() => setTab('scadenzario')}>
          SCADENZARIO
        </button>
      </div>

      <FilterContabilita onApply={handleApply} />

      {(isLoadingPN || isLoadingSC) && (
        <div className="p-8 text-center text-muted-foreground">
          Caricamento dati contabili in corso...
        </div>
      )}

      {!isLoadingPN && !isLoadingSC && (
        tab === 'primaNota' ? (
          <PrimaNotaTable records={filteredPN} onUpdate={setPrimaNotaRecords} label="Prima Nota" />
        ) : (
          <PrimaNotaTable
            records={filteredSC}
            onUpdate={setScadenzarioRecords}
            label="Scadenzario"
            isScadenzario
            onRegistra={handleRegistra}
          />
        )
      )}

      {/* LA NUOVA MODALE PER LA CONFERMA DEL PAGAMENTO */}
      <ConfirmDialog
        isOpen={confirmReg.isOpen}
        type="info"
        title="Registrazione Pagamento"
        confirmLabel="Sì, registra"
        message={<>Sei sicuro di voler registrare il pagamento di <strong>{confirmReg.importo} €</strong>?<br/>L'operazione salderà la riga nello scadenzario e genererà automaticamente un movimento in Prima Nota.</>}
        onClose={() => setConfirmReg({ isOpen: false, record: null, importo: 0, data: '' })}
        onConfirm={eseguiRegistrazione}
        isPending={registraMutation.isPending}
      />

    </div>
  );
};

export default Contabilita;