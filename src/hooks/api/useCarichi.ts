import { useQuery } from "@tanstack/react-query";
import { Carico } from "@/data/mockData"; // <-- Verifica il nome esatto dell'interfaccia
import { API_HOST } from "@/config";

const fetchCarichi = async (): Promise<Carico[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=carichi`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei carichi");
  }
  return response.json();
};

export const useCarichi = () => {
  return useQuery<Carico[], Error>({
    queryKey: ["carichi"],
    queryFn: fetchCarichi,
  });
};