import { useQuery } from "@tanstack/react-query";
import { Cliente } from "@/data/mockData";
import { API_HOST } from "@/config";

const fetchClienti = async (): Promise<Cliente[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=clienti`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei clienti");
  }
  return response.json();
};

export const useClienti = () => {
  return useQuery<Cliente[], Error>({
    queryKey: ["clienti"],
    queryFn: fetchClienti,
  });
};
