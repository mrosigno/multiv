// Impostazioni e Archivi - Mock Data

export interface Listino {
  Id: number;
  Descrizione: string;
  provv: number;
  TS: string;
}

export const listini: Listino[] = [
  { Id: 1, Descrizione: 'Base 0%', provv: 0, TS: '2024-01-01 00:00:00' },
  { Id: 2, Descrizione: 'Rivenditori 5%', provv: 5, TS: '2024-01-01 00:00:00' },
  { Id: 3, Descrizione: 'Grossisti 8%', provv: 8, TS: '2024-01-01 00:00:00' },
  { Id: 4, Descrizione: 'Premium 15%', provv: 15, TS: '2024-01-01 00:00:00' },
  { Id: 5, Descrizione: 'Agenti 3%', provv: 3, TS: '2024-01-01 00:00:00' },
  { Id: 6, Descrizione: 'Dipendenti 20%', provv: 20, TS: '2024-01-01 00:00:00' },
  { Id: 7, Descrizione: 'Promozionale 10%', provv: 10, TS: '2024-01-01 00:00:00' },
  { Id: 8, Descrizione: 'E-commerce 7%', provv: 7, TS: '2024-01-01 00:00:00' },
  { Id: 9, Descrizione: 'Fidelity 12%', provv: 12, TS: '2024-01-01 00:00:00' },
  { Id: 10, Descrizione: 'VIP 25%', provv: 25, TS: '2024-01-01 00:00:00' },
  { Id: 11, Descrizione: 'Ente Pubblico 2%', provv: 2, TS: '2024-01-01 00:00:00' },
  { Id: 12, Descrizione: 'Convenzionato 6%', provv: 6, TS: '2024-01-01 00:00:00' },
];

export interface Brand {
  descrizione: string;
  scontabile: number; // -1, 0, 1
  ts: string;
}

export const brands: Brand[] = [
  { descrizione: 'Cemex', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Fassa Bortolo', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Fischer', scontabile: 0, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Mapei', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Bosch', scontabile: -1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Vimar', scontabile: 0, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Gewiss', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Caleffi', scontabile: 0, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Henkel', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Hilti', scontabile: -1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Knauf', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Weber', scontabile: 1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Sika', scontabile: 0, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Makita', scontabile: -1, ts: '2024-01-01 00:00:00' },
  { descrizione: 'Stanley', scontabile: 1, ts: '2024-01-01 00:00:00' },
];

export interface RepartoImpostazione {
  Id: number;
  descrizione: string;
  TS: string;
}

export const repartiImpostazioni: RepartoImpostazione[] = [
  { Id: 1, descrizione: 'Edilizia', TS: '2024-01-01 00:00:00' },
  { Id: 2, descrizione: 'Ufficio', TS: '2024-01-01 00:00:00' },
  { Id: 3, descrizione: 'Elettronica', TS: '2024-01-01 00:00:00' },
  { Id: 4, descrizione: 'Abbigliamento', TS: '2024-01-01 00:00:00' },
  { Id: 5, descrizione: 'Ferramenta', TS: '2024-01-01 00:00:00' },
  { Id: 6, descrizione: 'Idraulica', TS: '2024-01-01 00:00:00' },
  { Id: 7, descrizione: 'Giardinaggio', TS: '2024-01-01 00:00:00' },
  { Id: 8, descrizione: 'Automotive', TS: '2024-01-01 00:00:00' },
  { Id: 9, descrizione: 'Casalinghi', TS: '2024-01-01 00:00:00' },
  { Id: 10, descrizione: 'Colori e Vernici', TS: '2024-01-01 00:00:00' },
  { Id: 11, descrizione: 'Sicurezza', TS: '2024-01-01 00:00:00' },
  { Id: 12, descrizione: 'Illuminazione', TS: '2024-01-01 00:00:00' },
];
