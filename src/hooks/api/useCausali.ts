import { useQuery } from "@tanstack/react-query";
import { CausaleContabile } from "@/data/contabilitaMockData";
import { API_HOST } from "@/config";

const fetchCausaliContabili = async (): Promise<CausaleContabile[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=causali`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento delle causali contabili");
  }
  return response.json();
};

export const useCausali = () => {
  return useQuery<CausaleContabile[], Error>({
    queryKey: ["causali_contabili"],
    queryFn: fetchCausaliContabili,
  });
};

