import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter , Routes, Route } from "react-router-dom";
import { MenuProvider } from "@/contexts/MenuContext";

import Index from "./pages/Index";
import HomePage from "./pages/HomePage";

import FatturazionePage from "./pages/FatturazionePage";
import ContabilitaPage from "./pages/ContabilitaPage";
import MagazzinoPage from "./pages/MagazzinoPage";
// FIX: Unica importazione per i movimenti di magazzino!
import MovimentiMagazzinoPage from "./pages/MovimentiMagazzinoPage";
import InventarioPage from "./pages/InventarioPage";

import AnagraficaClientiPage from "./pages/AnagraficaClientiPage";
import AgentiPage from "./pages/AgentiPage";
import TipoDocumentiPage from "./pages/TipoDocumentiPage";
import ModalitaPagamentoPage from "./pages/ModalitaPagamentoPage";
import MezziPagamentoPage from "./pages/MezziPagamentoPage";
import AliquoteIvaPage from "./pages/AliquoteIvaPage";
import BanchePage from "./pages/BanchePage";
import CausaliContabiliPage from "./pages/CausaliContabiliPage";
import TipologieMovimentoPage from "./pages/TipologieMovimentoPage";
import FlussiSdiPage from "./pages/FlussiSdiPage";

import ListiniPage from "./pages/ListiniPage";
import BrandPage from "./pages/BrandPage";
import RepartiPage from "./pages/RepartiPage";
import MagazziniPage from "./pages/MagazziniPage";
import NotFound from "./pages/NotFound";
import ConfigurazioneSdiPage from "./pages/ConfigurazioneSdiPage";
import ImpostazioniAziendaPage from './pages/ImpostazioniAziendaPage';
import AnnotazioniPage from "./pages/AnnotazioniPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 10,
      refetchOnWindowFocus: false, 
      retry: 1,
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <MenuProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/home" element={<HomePage />} />
            
            <Route path="/fatturazione" element={<FatturazionePage />} />
            <Route path="/contabilita" element={<ContabilitaPage />} />
            
            <Route path="/magazzino/catalogo" element={<MagazzinoPage />} />
            {/* FIX: Unica Rotta per tutti i movimenti logistici */}
            <Route path="/magazzino/movimenti" element={<MovimentiMagazzinoPage />} />
            <Route path="/magazzino/inventario" element={<InventarioPage />} />
            
            <Route path="/documenti/clienti" element={<AnagraficaClientiPage />} />
            <Route path="/documenti/agenti" element={<AgentiPage />} />
            <Route path="/documenti/tipo-documenti" element={<TipoDocumentiPage />} />
            <Route path="/documenti/modalita-pagamento" element={<ModalitaPagamentoPage />} />
            <Route path="/documenti/mezzi-pagamento" element={<MezziPagamentoPage />} />
            <Route path="/documenti/aliquote-iva" element={<AliquoteIvaPage />} />
            <Route path="/documenti/banche" element={<BanchePage />} />
            <Route path="/documenti/causali" element={<CausaliContabiliPage />} />
            <Route path="/documenti/tipologie-movimento" element={<TipologieMovimentoPage />} />
            <Route path="/documenti/flussi-sdi" element={<FlussiSdiPage />} />
            
            <Route path="/impostazioni/listini" element={<ListiniPage />} />
            <Route path="/impostazioni/brand" element={<BrandPage />} />
            <Route path="/impostazioni/reparti" element={<RepartiPage />} />
            <Route path="/impostazioni/magazzini" element={<MagazziniPage />} />
            <Route path="/impostazioni/sdi" element={<ConfigurazioneSdiPage />} />
            <Route path="/impostazioni/azienda" element={<ImpostazioniAziendaPage />} />
            <Route path="/impostazioni/annotazioni" element={<AnnotazioniPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </MenuProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;