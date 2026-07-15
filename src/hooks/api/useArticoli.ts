import { useQuery } from "@tanstack/react-query";
import { Articolo } from "@/data/mockData";
import { API_HOST } from "@/config";

const fetchArticoli = async (): Promise<Articolo[]> => {
  const response = await fetch(`${API_HOST}/api.php?action=articoli`);
  if (!response.ok) {
    throw new Error("Errore nel caricamento degli articoli");
  }
  return response.json();
};

export const useArticoli = () => {
  return useQuery<Articolo[], Error>({
    queryKey: ["articoli"],
    queryFn: fetchArticoli,
  });
};
export const useCategorieArticoli = () => {
  return useQuery<string[], Error>({
    queryKey: ["categorie_articoli"],
    queryFn: async () => {
      const res = await fetch(`${API_HOST}/api.php?action=categorie_articoli`);
      if (!res.ok) throw new Error("Errore nel caricamento delle categorie");
      return res.json();
    },
  });
};

export const useSottocategorieArticoli = () => {
  return useQuery<string[], Error>({
    queryKey: ["sottocategorie_articoli"],
    queryFn: async () => {
      const res = await fetch(`${API_HOST}/api.php?action=sottocategorie_articoli`);
      if (!res.ok) throw new Error("Errore nel caricamento delle sottocategorie");
      return res.json();
    },
  });
};
export const useUnitaMisuraArticoli = () => {
  return useQuery<string[], Error>({
    queryKey: ["unita_misura_articoli"],
    queryFn: async () => {
      const res = await fetch(`${API_HOST}/api.php?action=unita_misura_articoli`);
      if (!res.ok) throw new Error("Errore nel caricamento delle UM");
      return res.json();
    },
  });
};