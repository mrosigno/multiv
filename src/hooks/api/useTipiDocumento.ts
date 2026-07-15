import { useQuery } from "@tanstack/react-query";
import { TipoDocumento } from "@/data/mockData";
import { API_HOST } from "@/config";

const fetchTipiDocumento = async (): Promise<TipoDocumento[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=tipi_documento`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento dei tipi documento");
  }
  return response.json();
};

export const useTipiDocumento = () => {
  return useQuery<TipoDocumento[], Error>({
    queryKey: ["tipi_documento"],
    queryFn: fetchTipiDocumento,
  });
};

