import { useQuery } from "@tanstack/react-query";
import { Trasferimento } from "@/data/mockData"; // <-- Verifica il nome esatto dell'interfaccia
import { API_HOST } from "@/config";

const fetchTrasferimenti = async (): Promise<Trasferimento[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=trasferimenti`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei trasferimenti");
  }
  return response.json();
};

export const useTrasferimenti = () => {
  return useQuery<Trasferimento[], Error>({
    queryKey: ["trasferimenti"],
    queryFn: fetchTrasferimenti,
  });
};