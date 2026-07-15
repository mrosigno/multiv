import { useQuery } from "@tanstack/react-query";
import { Aliquota } from "@/data/mockData";
import { API_HOST } from "@/config";

const fetchAliquote = async (): Promise<Aliquota[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=aliquote`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento delle aliquote IVA");
  }
  return response.json();
};

export const useAliquote = () => {
  return useQuery<Aliquota[], Error>({
    queryKey: ["aliquote"],
    queryFn: fetchAliquote,
  });
};

