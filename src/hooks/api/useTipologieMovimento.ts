import { useQuery } from "@tanstack/react-query";
import { TipologiaMovimento } from "@/data/contabilitaMockData";
import { API_HOST } from "@/config";

const fetchTipologieMovimento = async (): Promise<TipologiaMovimento[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=tipologie_movimento`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento delle tipologie movimento");
  }
  return response.json();
};

export const useTipologieMovimento = () => {
  return useQuery<TipologiaMovimento[], Error>({
    queryKey: ["tipologie_movimento"],
    queryFn: fetchTipologieMovimento,
  });
};

