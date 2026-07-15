import { useQuery } from "@tanstack/react-query";
import { ModalitaPagamentoItem } from "@/data/mockData";
import { API_HOST } from "@/config";

const fetchModalitaPagamento = async (): Promise<ModalitaPagamentoItem[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=modalita_pagamento`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento delle modalità di pagamento");
  }
  return response.json();
};

export const useModalitaPagamento = () => {
  return useQuery<ModalitaPagamentoItem[], Error>({
    queryKey: ["modalita_pagamento"],
    queryFn: fetchModalitaPagamento,
  });
};

