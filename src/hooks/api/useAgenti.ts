import { useQuery } from "@tanstack/react-query";
import { Agente } from "@/data/anagraficheMockData";
import { API_HOST } from "@/config";

const fetchAgenti = async (): Promise<Agente[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=agenti`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento degli agenti");
  }
  return response.json();
};

export const useAgenti = () => {
  return useQuery<Agente[], Error>({
    queryKey: ["agenti"],
    queryFn: fetchAgenti,
  });
};

