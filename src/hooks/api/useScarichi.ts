import { useQuery } from "@tanstack/react-query";
import { Scarico } from "@/data/mockData"; // <-- Verifica il nome esatto dell'interfaccia
import { API_HOST } from "@/config";

const fetchScarichi = async (): Promise<Scarico[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=scarichi`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento degli scarichi");
  }
  return response.json();
};

export const useScarichi = () => {
  return useQuery<Scarico[], Error>({
    queryKey: ["scarichi"],
    queryFn: fetchScarichi,
  });
};