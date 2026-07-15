import { useQuery } from "@tanstack/react-query";
import { Fattura } from "@/data/mockData";
import { API_HOST } from "@/config";

// Ora l'hook richiede l'anno in ingresso
export const useFatture = (anno: number) => {
  return useQuery<Fattura[], Error>({
    // La chiave della cache include l'anno!
    queryKey: ["fatture", anno], 
    queryFn: async () => {
      // Passiamo l'anno all'API
      const res = await fetch(`${API_HOST}/api.php?action=fatture&anno=${anno}`);
      if (!res.ok) throw new Error("Errore nel caricamento delle fatture");
      const data = await res.json();
      
      return data.map((f: any) => ({
        ...f,
        ID: Number(f.ID),
        IDCliente: Number(f.IDCliente)
      }));
    },
  });
};