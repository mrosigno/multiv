import { useQuery } from "@tanstack/react-query";
import { Scadenza } from "@/data/mockData"; // <-- Verifica il nome esatto dell'interfaccia
import { API_HOST } from "@/config";

const fetchScadenzario = async (): Promise<Scadenza[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=scadenzario`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dello scadenzario");
  }
  return response.json();
};

export const useScadenzario = () => {
  return useQuery<Scadenza[], Error>({
    queryKey: ["scadenzario"],
    queryFn: fetchScadenzario,
  });
};