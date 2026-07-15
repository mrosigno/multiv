import { useQuery } from "@tanstack/react-query";
import { RepartoImpostazione } from "@/data/impostazioniMockData";
import { API_HOST } from "@/config";

const fetchReparti = async (): Promise<RepartoImpostazione[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=reparti`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei reparti");
  }
  return response.json();
};

export const useReparti = () => {
  return useQuery<RepartoImpostazione[], Error>({
    queryKey: ["reparti"],
    queryFn: fetchReparti,
  });
};
