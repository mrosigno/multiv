import { useQuery } from "@tanstack/react-query";
import { Banca } from "@/data/anagraficheMockData";
import { API_HOST } from "@/config";

const fetchBanche = async (): Promise<Banca[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=banche`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento delle banche");
  }
  return response.json();
};

export const useBanche = () => {
  return useQuery<Banca[], Error>({
    queryKey: ["banche"],
    queryFn: fetchBanche,
  });
};

