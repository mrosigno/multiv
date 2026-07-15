import { useQuery } from "@tanstack/react-query";
import { FatturaCorpo } from "@/data/mockData";
import { API_HOST } from "@/config";

export const useFattureCorpo = () => {
  return useQuery<FatturaCorpo[], Error>({
    queryKey: ["fatturecorpo"],
    queryFn: async () => {
      const res = await fetch(`${API_HOST}/api.php?action=fatturecorpo`);
      if (!res.ok) throw new Error("Errore nel caricamento delle righe fattura");
      const data = await res.json();
      
      return data.map((r: any) => ({
        ...r,
        ID: Number(r.ID),
        IDFatt: Number(r.IDFatt),
        ordine: Number(r.ordine || 0) // <-- FORZATURA DEL TINYINT
      }));
    },
  });
};