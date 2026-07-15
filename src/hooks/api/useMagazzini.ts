import { useQuery } from "@tanstack/react-query";
import { Magazzino } from "@/data/mockData";
import { API_HOST } from "@/config";

const fetchMagazzini = async (): Promise<Magazzino[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=magazzini`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei magazzini");
  }
  return response.json();
};

export const useMagazzini = () => {
  return useQuery<Magazzino[], Error>({
    queryKey: ["magazzini"],
    queryFn: fetchMagazzini,
  });
};
