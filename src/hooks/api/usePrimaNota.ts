import { useQuery } from "@tanstack/react-query";
import { PrimaNota } from "@/data/mockData"; // <-- Verifica il nome esatto dell'interfaccia
import { API_HOST } from "@/config";

const fetchPrimaNota = async (): Promise<PrimaNota[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=prima_nota`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento della prima nota");
  }
  return response.json();
};

export const usePrimaNota = () => {
  return useQuery<PrimaNota[], Error>({
    queryKey:["prima_nota"],
    queryFn: fetchPrimaNota,
  });
};