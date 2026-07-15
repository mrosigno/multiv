import { useQuery } from "@tanstack/react-query";
import { API_HOST } from "@/config";

export interface Azienda {
  id: number;
  RagioneSociale1: string;
  RagioneSociale2: string;
  RagioneSociale3: string;
  RagioneSociale4: string;
}

const fetchAzienda = async (): Promise<Azienda[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=azienda`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei dati azienda");
  }
  return response.json();
};

export const useAzienda = () => {
  return useQuery<Azienda[], Error>({
    queryKey: ["azienda"],
    queryFn: fetchAzienda,
  });
};
