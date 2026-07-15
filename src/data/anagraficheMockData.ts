// Mock data per Agenti e Banche

function seeded(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ===== AGENTI =====
export interface Agente {
  Id: number;
  Nominativo: string;
  Indirizzo: string;
  Telefono: string;
  CF_PIVA: string;
}

const nomiAgenti = [
  'Mario Rossi', 'Luca Bianchi', 'Giuseppe Verdi', 'Andrea Conti', 'Francesco Ferrari',
  'Alessandro Esposito', 'Matteo Romano', 'Lorenzo Colombo', 'Davide Ricci', 'Simone Marino',
  'Marco Greco', 'Antonio Bruno', 'Stefano Gallo', 'Roberto De Luca', 'Paolo Mancini',
  'Giovanni Barbieri', 'Fabio Lombardi', 'Claudio Moretti', 'Massimo Fontana', 'Enrico Santoro',
  'Alberto Mariani', 'Daniele Rinaldi', 'Federico Caruso', 'Cristian Ferrara', 'Nicola Martini',
];

const cittaAgenti = [
  'Milano', 'Roma', 'Napoli', 'Torino', 'Firenze', 'Bologna', 'Genova', 'Palermo',
  'Bari', 'Venezia', 'Verona', 'Padova', 'Brescia', 'Catania', 'Perugia',
];

export const agenti: Agente[] = nomiAgenti.map((nome, i) => ({
  Id: i + 1,
  Nominativo: nome,
  Indirizzo: `Via ${['Roma', 'Garibaldi', 'Dante', 'Mazzini', 'Verdi'][i % 5]} ${Math.floor(seeded(i * 17) * 200) + 1}, ${cittaAgenti[i % cittaAgenti.length]}`,
  Telefono: `0${Math.floor(seeded(i * 13) * 9 + 1)}${Math.floor(seeded(i * 14) * 9000000 + 1000000)}`,
  CF_PIVA: i % 3 === 0
    ? (() => { let cf = ''; const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; for (let j = 0; j < 6; j++) cf += L[Math.floor(seeded(i * 100 + j) * 26)]; cf += String(Math.floor(seeded(i * 106) * 90 + 10)); cf += L[Math.floor(seeded(i * 108) * 26)]; cf += String(Math.floor(seeded(i * 109) * 90 + 10)); cf += L[Math.floor(seeded(i * 111) * 26)]; cf += String(Math.floor(seeded(i * 112) * 900 + 100)); cf += L[Math.floor(seeded(i * 115) * 26)]; return cf; })()
    : (() => { let pi = ''; for (let j = 0; j < 11; j++) pi += Math.floor(seeded(i * 200 + j) * 10); return pi; })(),
}));

// ===== BANCHE =====
export interface Banca {
  iban: string;
  nomebanca: string;
  Note: string;
  TS: string;
}

const nomiBanche = [
  'Intesa Sanpaolo', 'UniCredit', 'BPER Banca', 'Banco BPM', 'Crédit Agricole Italia',
  'Banca Monte dei Paschi di Siena', 'Banca Sella', 'Banca Mediolanum', 'Fineco Bank',
  'CheBanca!', 'Banca Popolare di Sondrio', 'Cassa di Risparmio di Bolzano', 'Banca Carige',
  'Banca di Asti', 'Cassa Centrale Banca', 'Banca Ifis', 'Illimity Bank', 'Banca Generali',
  'Banca Patrimoni Sella', 'Banca Profilo', 'Widiba', 'Banca Valsabbina', 'Banca CR Firenze',
  'Banca di Piacenza', 'Banca Passadore',
];

function genIBAN(seed: number): string {
  let iban = 'IT';
  for (let i = 0; i < 25; i++) {
    if (i < 2) iban += Math.floor(seeded(seed + i) * 10);
    else if (i === 2) iban += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(seeded(seed + i) * 26)];
    else iban += Math.floor(seeded(seed + i) * 10);
  }
  return iban;
}

export const banche: Banca[] = nomiBanche.map((nome, i) => ({
  iban: genIBAN(i * 300),
  nomebanca: nome,
  Note: i % 4 === 0 ? 'Conto operativo principale' : i % 4 === 1 ? 'Conto secondario' : '',
  TS: '2024-01-01 00:00:00',
}));
