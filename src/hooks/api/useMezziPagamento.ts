import { useQuery } from "@tanstack/react-query";
import { MezzoPagamentoIndiretto } from "@/data/contabilitaMockData";
import { API_HOST } from "@/config";

const fetchMezziPagamento = async (): Promise<MezzoPagamentoIndiretto[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=mezzi_pagamento`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei mezzi di pagamento");
  }
  return response.json();
};

export const useMezziPagamento = () => {
  return useQuery<MezzoPagamentoIndiretto[], Error>({
    queryKey: ["mezzi_pagamento"],
    queryFn: fetchMezziPagamento,
  });
};

