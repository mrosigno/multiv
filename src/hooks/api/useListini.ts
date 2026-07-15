import { useQuery } from "@tanstack/react-query";
import { Listino } from "@/data/impostazioniMockData";
import { API_HOST } from "@/config";

const fetchListini = async (): Promise<Listino[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=listini`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei listini");
  }
  return response.json();
};

export const useListini = () => {
  return useQuery<Listino[], Error>({
    queryKey: ["listini"],
    queryFn: fetchListini,
  });
};
