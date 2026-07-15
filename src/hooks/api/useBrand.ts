import { useQuery } from "@tanstack/react-query";
import { Brand } from "@/data/impostazioniMockData";
import { API_HOST } from "@/config";

const fetchBrand = async (): Promise<Brand[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=brand`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei brand");
  }
  return response.json();
};

export const useBrand = () => {
  return useQuery<Brand[], Error>({
    queryKey: ["brand"],
    queryFn: fetchBrand,
  });
};
