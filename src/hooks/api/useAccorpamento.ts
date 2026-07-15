import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { API_HOST } from '@/config';

export const useClientiDaAccorpare = (tipoDoc: number) => {
  return useQuery({
    queryKey: ['clienti_da_accorpare', tipoDoc],
    queryFn: async () => {
      if (!tipoDoc) return [];
      const res = await fetch(`${API_HOST}/api.php?action=get_clienti_da_accorpare&tipoDoc=${tipoDoc}`);
      if (!res.ok) throw new Error('Errore rete');
      return res.json();
    },
    enabled: !!tipoDoc,
  });
};

export const useDocumentiDaAccorpare = (tipoDoc: number, idCliente: number) => {
  return useQuery({
    queryKey: ['documenti_da_accorpare', tipoDoc, idCliente],
    queryFn: async () => {
      if (!tipoDoc || !idCliente) return [];
      const res = await fetch(`${API_HOST}/api.php?action=get_documenti_da_accorpare&tipoDoc=${tipoDoc}&idCliente=${idCliente}`);
      if (!res.ok) throw new Error('Errore rete');
      const data = await res.json();
      
      // FIX FONDAMENTALE: Restituiamo l'oggetto intero assicurandoci che gli ID siano numeri
      return data.map((d: any) => ({
        ...d,
        ID: Number(d.ID),
        IDCliente: Number(d.IDCliente),
        Tipo: Number(d.Tipo)
      }));
    },
    enabled: !!tipoDoc && !!idCliente,
  });
};

export const useEseguiAccorpamento = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`${API_HOST}/api.php?action=esegui_accorpamento`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: () => {
      // Aggiorna tutte le tabelle coinvolte
      queryClient.invalidateQueries({ queryKey: ['fatture'] });
      queryClient.invalidateQueries({ queryKey: ['documenti_da_accorpare'] });
      queryClient.invalidateQueries({ queryKey: ['clienti_da_accorpare'] });
    }
  });
};