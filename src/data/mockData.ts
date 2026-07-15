// Types matching the exact MySQL DB structure

export interface Cliente {
  ID: number;
  Ragione_Sociale: string;
  Indirizzo: string;
  CAP: string;
  Comune: string;
  Prov: string;
  PI: string;
  CF: string;
  ABI: string;
  CAB: string;
  CC: string;
  CIN: string;
  IBAN: string;
  Note: string;
  Banca: string;
  Mod_Pagamento: number;
  cod_Listino: number;
  cod_agente: number;
  telefono: string;
  fax: string;
  cellulare: string;
  email: string;
  sconto: number;
  TS: string;
  coduff: string;
  PEC: string;
  tipodest: number;
  Nome: string;
  Cognome: string;
  tipocli: number;
  attivo: string;
  idext: number;
  split: number;
  fido: number;
  emaildoc: string;
}

export interface Fattura {
  ID: number;
  IdAzienda: number;
  Num: number;
  Tipo: number;
  key: string;
  datafatt: string;
  IDCliente: number;
  ModPag: number;
  Note: string;
  scad: string;
  Pagata: string;
  datareg: string;
  registrata: number;
  Numprv: number;
  RifDdt: string;
  cod_agente: number;
  provv: number;
  IdRappr: number;
  TS: string;
  magin: number;
  magout: number;
  caricata: number;
  verificato: number;
  accorpa: number;
  fattel: number;
  idcarico: number;
  num_ext: string;
  prot: string;
  impondoc: number;
  ivadoc: number;
  arrot: number;
  filesdi: string;
  codmag: number;
}

export interface FatturaCorpo {
  ID: number;
  IDFatt: number;
  Codart: string;
  Descrzione: string;
  Quant: number;
  ImpUnit: number;
  ttiva: number;
  impon: number;
  imposta: number;
  extra: number;
  peso: number;
  Iva: number;
  Magazz: number;
  sconto: number;
  TS: string;
  codice2: string;
  idtraccia: number;
  unmis: string;
  chknote: number;
  ordine: number;
}

export interface Magazzino {
  cod: number;
  Descrizione: string;
  attivo: number;
  TS: string;
  ultimosc: number;
  ultimafat: number;
  ultimach: number;
  registratore: number;
  cortesia: number;
  lbarcode: number;
  display: number;
  aperto: number;
  tipost: number;
  matricola: string;
  stampante: string;
}

export interface Articolo {
  id: number;
  Codice: string;
  Cod_Prisma: string;
  Descrizione: string;
  UnMis: string;
  esistenza: number;
  ultprzacq: number;
  Listino1: number;
  Listino2: number;
  Listino3: number;
  Listino4: number;
  Listino5: number;
  Listino6: number;
  scorta_minima: number;
  sconto1: number;
  sconto2: number;
  sconto3: number;
  peso: number;
  codiva: number;
  Macro: string;
  magaz: number;
  codice2: string;
  sottocateg: string;
  brand: string;
  macroart: string;
  colore: string;
  taglia: string;
  reparto: number;
  barcode: number;
  prezzare: number;
  rif_esterno: number;
  IS: string;
  ecommerce: number;
  TS: string;
}

export interface Aliquota {
  Id: number;
  descrizione: string;
  aliquota: number;
  TS: string;
  codfattel: string;
}

export interface TipoDocumento {
  id: number;
  descrizione: string;
  suffisso: string;
  ordine_vis: number;
  da: string; // '+' | '-' | ''
  movmagaz: string; // 'C' | 'S' | ''
  clifor: number; // 1=Cliente, 2=Fornitore, 0=nessuno
}

export const tipiDocumento: TipoDocumento[] = [
  { id: 1, descrizione: 'Fattura', suffisso: 'FATT', ordine_vis: 1, da: '+', movmagaz: 'S', clifor: 1 },
  { id: 2, descrizione: 'DDT', suffisso: 'DDT', ordine_vis: 2, da: '+', movmagaz: 'S', clifor: 1 },
  { id: 3, descrizione: 'Nota di Credito', suffisso: 'NCR', ordine_vis: 3, da: '-', movmagaz: 'C', clifor: 1 },
  { id: 4, descrizione: 'Fattura Proforma', suffisso: 'PRO', ordine_vis: 4, da: '+', movmagaz: '', clifor: 1 },
  { id: 5, descrizione: 'Ricevuta', suffisso: 'RIC', ordine_vis: 5, da: '+', movmagaz: 'S', clifor: 1 },
];

export const aliquote: Aliquota[] = [
  { Id: 1, descrizione: '22%', aliquota: 22, TS: '2024-01-01 00:00:00', codfattel: 'N1' },
  { Id: 2, descrizione: '10%', aliquota: 10, TS: '2024-01-01 00:00:00', codfattel: 'N2' },
  { Id: 3, descrizione: '4%', aliquota: 4, TS: '2024-01-01 00:00:00', codfattel: 'N3' },
  { Id: 4, descrizione: 'Esente', aliquota: 0, TS: '2024-01-01 00:00:00', codfattel: 'N4' },
  { Id: 5, descrizione: '5%', aliquota: 5, TS: '2024-01-01 00:00:00', codfattel: 'N5' },
];

export const magazzini: Magazzino[] = [
  { cod: 1, Descrizione: 'PRINCIPALE', attivo: 1, TS: '2024-01-01 00:00:00', ultimosc: 0, ultimafat: 0, ultimach: 0, registratore: 0, cortesia: 0, lbarcode: 0, display: 0, aperto: 1, tipost: 0, matricola: '', stampante: '' },
  { cod: 2, Descrizione: 'SECONDARIO', attivo: 1, TS: '2024-01-01 00:00:00', ultimosc: 0, ultimafat: 0, ultimach: 0, registratore: 0, cortesia: 0, lbarcode: 0, display: 0, aperto: 1, tipost: 0, matricola: '', stampante: '' },
  { cod: 3, Descrizione: 'DEPOSITO EST.', attivo: 1, TS: '2024-01-01 00:00:00', ultimosc: 0, ultimafat: 0, ultimach: 0, registratore: 0, cortesia: 0, lbarcode: 0, display: 0, aperto: 0, tipost: 0, matricola: '', stampante: '' },
];

// Helper functions for generating realistic data
const nomiAziende = [
  'Rossi Costruzioni SRL', 'Bianchi & Figli SPA', 'Verdi Impianti SAS', 'Conti Servizi SRL',
  'Ferrari Meccanica SRL', 'Esposito Trading SPA', 'Romano Edilizia SRL', 'Colombo Elettrica SAS',
  'Ricci Trasporti SRL', 'Marino & Co. SPA', 'Greco Alimentari SRL', 'Bruno Tessuti SAS',
  'Gallo Forniture SRL', 'De Luca Imballaggi SPA', 'Mancini Legno SRL', 'Barbieri Metalli SAS',
  'Lombardi Consulenze SRL', 'Moretti Packaging SPA', 'Fontana Idraulica SRL', 'Santoro Chimica SAS',
  'Mariani Informatica SRL', 'Rinaldi Logistica SPA', 'Caruso Stampa SRL', 'Ferrara Vetri SAS',
  'Martini Arredamenti SRL', 'Leone Sicurezza SPA', 'Longo Pulizie SRL', 'Gentile Trasporti SAS',
  'Martinelli Gomma SRL', 'Vitale Energia SPA', 'Costa Alimentari SRL', 'Giordano Ferramenta SAS',
  'Mazza Ottica SRL', 'Pellegrini Carta SPA', 'Testa Elettronica SRL', 'Farina Abbigliamento SAS',
  'Rizzi Meccanica SRL', 'Sartori Edilizia SPA', 'Neri Impiantistica SRL', 'Marchetti Design SAS',
  'Villa Ceramiche SRL', 'Damiani Mobili SPA', 'Palumbo Acciai SRL', 'Bernardi Tessile SAS',
  'Parisi Automazione SRL', 'Cattaneo Farmaceutica SPA', 'Silvestri Import SRL', 'Benedetti Export SAS',
  'Valenti Servizi SRL', 'Grassi Tecnologia SPA', 'Basile Alimentari SRL', 'Messina Chimica SAS',
  'Sala Packaging SRL', 'D\'Angelo Costruzioni SPA', 'Piras Edilizia SRL'
];

const comuniItaliani = [
  { comune: 'Milano', prov: 'MI', cap: '20100' }, { comune: 'Roma', prov: 'RM', cap: '00100' },
  { comune: 'Napoli', prov: 'NA', cap: '80100' }, { comune: 'Torino', prov: 'TO', cap: '10100' },
  { comune: 'Firenze', prov: 'FI', cap: '50100' }, { comune: 'Bologna', prov: 'BO', cap: '40100' },
  { comune: 'Genova', prov: 'GE', cap: '16100' }, { comune: 'Palermo', prov: 'PA', cap: '90100' },
  { comune: 'Bari', prov: 'BA', cap: '70100' }, { comune: 'Venezia', prov: 'VE', cap: '30100' },
  { comune: 'Verona', prov: 'VR', cap: '37100' }, { comune: 'Padova', prov: 'PD', cap: '35100' },
  { comune: 'Brescia', prov: 'BS', cap: '25100' }, { comune: 'Catania', prov: 'CT', cap: '95100' },
  { comune: 'Perugia', prov: 'PG', cap: '06100' }, { comune: 'Bergamo', prov: 'BG', cap: '24100' },
  { comune: 'Modena', prov: 'MO', cap: '41100' }, { comune: 'Parma', prov: 'PR', cap: '43100' },
  { comune: 'Reggio Emilia', prov: 'RE', cap: '42100' }, { comune: 'Ancona', prov: 'AN', cap: '60100' },
];

const vieItaliane = [
  'Via Roma', 'Via Garibaldi', 'Via Dante', 'Corso Italia', 'Via Mazzini',
  'Via Verdi', 'Via Cavour', 'Via Marconi', 'Via della Repubblica', 'Via XX Settembre',
  'Viale Europa', 'Via San Marco', 'Via Leopardi', 'Via Carducci', 'Via Pascoli',
  'Corso Vittorio Emanuele', 'Via dei Mille', 'Via Colombo', 'Via Galilei', 'Via Leonardo da Vinci',
];

const banche = [
  'Intesa Sanpaolo', 'UniCredit', 'BPER Banca', 'Banco BPM', 'Crédit Agricole Italia',
  'Banca Monte dei Paschi di Siena', 'Banca Sella', 'Banca Mediolanum', 'Fineco Bank', 'CheBanca!',
];

const nomi = ['Marco', 'Luca', 'Giuseppe', 'Andrea', 'Francesco', 'Alessandro', 'Matteo', 'Lorenzo', 'Davide', 'Simone', 'Maria', 'Anna', 'Giulia', 'Sara', 'Elena', 'Laura', 'Chiara', 'Valentina', 'Francesca', 'Silvia'];
const cognomi = ['Rossi', 'Bianchi', 'Verdi', 'Conti', 'Ferrari', 'Esposito', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco', 'Bruno', 'Gallo', 'De Luca', 'Mancini', 'Barbieri', 'Lombardi', 'Moretti', 'Fontana', 'Santoro'];

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function genPI(seed: number): string {
  let pi = '';
  for (let i = 0; i < 11; i++) pi += Math.floor(seededRandom(seed + i) * 10);
  return pi;
}

function genCF(seed: number): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  let cf = '';
  for (let i = 0; i < 6; i++) cf += letters[Math.floor(seededRandom(seed + i) * 26)];
  for (let i = 0; i < 2; i++) cf += digits[Math.floor(seededRandom(seed + i + 6) * 10)];
  cf += letters[Math.floor(seededRandom(seed + 8) * 26)];
  for (let i = 0; i < 2; i++) cf += digits[Math.floor(seededRandom(seed + i + 9) * 10)];
  cf += letters[Math.floor(seededRandom(seed + 11) * 26)];
  for (let i = 0; i < 3; i++) cf += digits[Math.floor(seededRandom(seed + i + 12) * 10)];
  cf += letters[Math.floor(seededRandom(seed + 15) * 26)];
  return cf;
}

function genIBAN(seed: number): string {
  let iban = 'IT';
  for (let i = 0; i < 25; i++) {
    if (i < 2) iban += Math.floor(seededRandom(seed + i) * 10);
    else if (i === 2) iban += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(seededRandom(seed + i) * 26)];
    else iban += Math.floor(seededRandom(seed + i) * 10);
  }
  return iban;
}

// Generate 55 clienti
export const clienti: Cliente[] = nomiAziende.map((nome, i) => {
  const loc = comuniItaliani[i % comuniItaliani.length];
  const via = vieItaliane[i % vieItaliane.length];
  const num = Math.floor(seededRandom(i * 17) * 200) + 1;
  return {
    ID: i + 1,
    Ragione_Sociale: nome,
    Indirizzo: `${via} ${num}`,
    CAP: loc.cap,
    Comune: loc.comune,
    Prov: loc.prov,
    PI: genPI(i * 100),
    CF: genCF(i * 100),
    ABI: String(Math.floor(seededRandom(i * 3) * 90000 + 10000)),
    CAB: String(Math.floor(seededRandom(i * 5) * 90000 + 10000)),
    CC: String(Math.floor(seededRandom(i * 7) * 900000000 + 100000000)),
    CIN: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(seededRandom(i * 11) * 26)],
    IBAN: genIBAN(i * 200),
    Note: '',
    Banca: banche[i % banche.length],
    Mod_Pagamento: (i % 4) + 1,
    cod_Listino: (i % 3) + 1,
    cod_agente: (i % 5) + 1,
    telefono: `0${Math.floor(seededRandom(i * 13) * 9 + 1)}${String(Math.floor(seededRandom(i * 14) * 9000000 + 1000000))}`,
    fax: '',
    cellulare: `3${Math.floor(seededRandom(i * 15) * 9 + 1)}${Math.floor(seededRandom(i * 16) * 9000000 + 1000000)}`,
    email: `info@${nome.toLowerCase().replace(/[^a-z]/g, '').substring(0, 15)}.it`,
    sconto: Math.floor(seededRandom(i * 19) * 20),
    TS: '2024-01-01 00:00:00',
    coduff: `UF${String(i + 1).padStart(5, '0')}`,
    PEC: `pec@${nome.toLowerCase().replace(/[^a-z]/g, '').substring(0, 15)}.it`,
    tipodest: 0,
    Nome: nomi[i % nomi.length],
    Cognome: cognomi[i % cognomi.length],
    tipocli: (i % 3) as 0 | 1 | 2,
    attivo: i < 50 ? 'SI' : 'NO',
    idext: 0,
    split: i % 10 === 0 ? 1 : 0,
    fido: Math.round(seededRandom(i * 21) * 50000 * 100) / 100,
    emaildoc: `doc@${nome.toLowerCase().replace(/[^a-z]/g, '').substring(0, 15)}.it`,
  };
});

// Generate articoli (60+)
const descrizioniArticoli = [
  'Vite M6x20 Acciaio Inox', 'Bullone M8x40 Zincato', 'Dado Esagonale M10', 'Rondella Piana D12',
  'Tubo Rame 22mm 1m', 'Raccordo T 3/4"', 'Valvola Sfera 1/2"', 'Guarnizione OR 25mm',
  'Cavo Elettrico 2.5mm 100m', 'Interruttore Bipolare 16A', 'Presa Schuko Incasso', 'Placca 3 Moduli Bianca',
  'Pannello Truciolare 120x60', 'Mensola Legno Massello 80cm', 'Vite per Legno 4x30', 'Cerniera Anta 35mm',
  'Pittura Lavabile Bianca 5L', 'Stucco Rasante 5kg', 'Nastro Carta 50mm', 'Rullo Antigoccia 25cm',
  'Flessibile Doccia 150cm', 'Sifone Lavabo 1"1/4', 'Rubinetto Cucina Monocomando', 'Cassetta WC Incasso',
  'Lampada LED E27 10W', 'Faretto GU10 5W', 'Striscia LED 5m RGB', 'Alimentatore 12V 60W',
  'Silicone Acetico Trasparente', 'Colla Epossidica 2 Comp.', 'Nastro Isolante 19mm Nero', 'Fascetta Nylon 200mm',
  'Chiave Combinata 13mm', 'Pinza Universale 200mm', 'Giravite PH2x100', 'Metro Avvolgibile 5m',
  'Trapano Avvitatore 18V', 'Set Punte HSS 1-10mm', 'Disco Taglio 125mm', 'Maschera Protezione FFP2',
  'Piastrella Gres 60x60 Grigio', 'Colla per Piastrelle C2 25kg', 'Fugante Grigio 5kg', 'Distanziatori 2mm',
  'Profilo Cartongesso 300cm', 'Lastra Cartongesso 120x200', 'Tassello Fischer 8x40', 'Vite Autofilettante 4.2x32',
  'Griglia Aerazione 15x15', 'Tubo Multistrato 20mm 1m', 'Collare Isofono 50mm', 'Curva 90° PVC 40mm',
  'Centralino 12 Moduli', 'Magnetotermico 2P 16A', 'Differenziale 2P 25A 30mA', 'Canalina 25x16 2m',
  'Termostato Ambiente Digitale', 'Radiatore Alluminio 800/100', 'Detergente Industriale 5L', 'Sacco Nero 110L x10',
];

export const articoli: Articolo[] = descrizioniArticoli.map((desc, i) => {
  const basePrice = Math.round((seededRandom(i * 31) * 200 + 5) * 100) / 100;
  return {
    id: i + 1,
    Codice: String(i + 1).padStart(3, '0'),
    Cod_Prisma: `PR${String(i + 1).padStart(4, '0')}`,
    Descrizione: desc,
    UnMis: ['PZ', 'MT', 'KG', 'LT', 'CF'][i % 5],
    esistenza: Math.floor(seededRandom(i * 33) * 500),
    ultprzacq: Math.round(basePrice * 0.7 * 100) / 100,
    Listino1: basePrice,
    Listino2: Math.round(basePrice * 0.95 * 100) / 100,
    Listino3: Math.round(basePrice * 0.9 * 100) / 100,
    Listino4: Math.round(basePrice * 0.85 * 100) / 100,
    Listino5: Math.round(basePrice * 0.8 * 100) / 100,
    Listino6: Math.round(basePrice * 0.75 * 100) / 100,
    scorta_minima: Math.floor(seededRandom(i * 35) * 20),
    sconto1: 0, sconto2: 0, sconto3: 0,
    peso: Math.round(seededRandom(i * 37) * 10 * 100) / 100,
    codiva: 1,
    Macro: '',
    magaz: 1,
    codice2: '',
    sottocateg: ['Ferramenta', 'Idraulica', 'Elettrico', 'Legno', 'Edilizia'][i % 5],
    brand: ['Fischer', 'Vimar', 'Mapei', 'Bosch', 'Gewiss', 'Caleffi', 'Henkel'][i % 7],
    macroart: '',
    colore: '',
    taglia: '',
    reparto: (i % 5) + 1,
    barcode: 0,
    prezzare: 1,
    rif_esterno: 0,
    IS: 'I',
    ecommerce: 0,
    TS: '2024-01-01 00:00:00',
  };
});

// Generate fatture (60+)
const fatture_data: Fattura[] = [];
const fatturecorpo_data: FatturaCorpo[] = [];
let corpoId = 1;

for (let i = 0; i < 65; i++) {
  const year = 2024 + Math.floor(i / 25);
  const month = (i % 12) + 1;
  const day = Math.floor(seededRandom(i * 41) * 27) + 1;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const tipo = (i % 5) + 1;
  const clienteId = Math.floor(seededRandom(i * 43) * clienti.length) + 1;
  const codmag = Math.floor(seededRandom(i * 45) * 3) + 1;
  
  // Calc totals from corpo
  const numRighe = Math.floor(seededRandom(i * 47) * 5) + 1;
  let totalImpon = 0;
  let totalIva = 0;
  
  const righe: FatturaCorpo[] = [];
  for (let r = 0; r < numRighe; r++) {
    const artIdx = Math.floor(seededRandom(i * 49 + r * 7) * articoli.length);
    const art = articoli[artIdx];
    const quant = Math.floor(seededRandom(i * 51 + r * 11) * 20) + 1;
    const impUnit = art.Listino1;
    const scontoRiga = Math.floor(seededRandom(i * 53 + r * 13) * 15);
    const impon = Math.round(quant * impUnit * (1 - scontoRiga / 100) * 100) / 100;
    const aliId = Math.floor(seededRandom(i * 55 + r * 17) * 2) + 1;
    const ali = aliquote.find(a => a.Id === aliId)!;
    const imposta = Math.round(impon * ali.aliquota / 100 * 100) / 100;
    
    totalImpon += impon;
    totalIva += imposta;
    
    righe.push({
      ID: corpoId++,
      IDFatt: i + 1,
      Codart: art.Codice,
      Descrzione: art.Descrizione,
      Quant: quant,
      ImpUnit: impUnit,
      ttiva: impon + imposta,
      impon: impon,
      imposta: imposta,
      extra: 0,
      peso: Math.round(art.peso * quant * 100) / 100,
      Iva: aliId,
      Magazz: 1,
      sconto: scontoRiga,
      TS: dateStr + ' 00:00:00',
      codice2: '',
      idtraccia: 0,
      unmis: art.UnMis,
      chknote: 0,
      ordine: r + 1,
    });
  }
  
  fatturecorpo_data.push(...righe);
  
  const scadDate = new Date(year, month - 1, day);
  scadDate.setDate(scadDate.getDate() + 30);
  const scadStr = `${scadDate.getFullYear()}-${String(scadDate.getMonth() + 1).padStart(2, '0')}-${String(scadDate.getDate()).padStart(2, '0')}`;
  const isPagata = seededRandom(i * 57) > 0.4;
  
  fatture_data.push({
    ID: i + 1,
    IdAzienda: 1,
    Num: year * 1000 + (i % 25) + 1,
    Tipo: tipo,
    key: `${year}${String(tipo).padStart(2, '0')}${String((i % 25) + 1).padStart(6, '0')}`,
    datafatt: dateStr,
    IDCliente: clienteId,
    ModPag: (i % 4) + 1,
    Note: i % 7 === 0 ? 'Consegna urgente' : '',
    scad: scadStr,
    Pagata: isPagata ? scadStr : '',
    datareg: seededRandom(i * 59) > 0.3 ? dateStr : '',
    registrata: seededRandom(i * 59) > 0.3 ? 1 : 0,
    Numprv: 0,
    RifDdt: tipo === 1 ? `DDT-${year}-${String(Math.floor(seededRandom(i * 61) * 500) + 1).padStart(4, '0')}` : '',
    cod_agente: (i % 5) + 1,
    provv: Math.round(seededRandom(i * 63) * 5 * 100) / 100,
    IdRappr: 0,
    TS: dateStr + ' 00:00:00',
    magin: 0,
    magout: 0,
    caricata: seededRandom(i * 65) > 0.5 ? 1 : 0,
    verificato: seededRandom(i * 67) > 0.4 ? 1 : 0,
    accorpa: 0,
    fattel: 0,
    idcarico: 0,
    num_ext: '',
    prot: '',
    impondoc: Math.round(totalImpon * 100) / 100,
    ivadoc: Math.round(totalIva * 100) / 100,
    arrot: 0,
    filesdi: '',
    codmag: codmag,
  });
}

export const fatture: Fattura[] = fatture_data;
export const fatturecorpo: FatturaCorpo[] = fatturecorpo_data;

// Modal payment data
export interface ModalitaPagamentoItem {
  idmod: number;
  Mod: string;
}

export const modalitaPagamentoList: ModalitaPagamentoItem[] = [
  { idmod: 1, Mod: 'Bonifico Bancario 30gg' },
  { idmod: 2, Mod: 'Rimessa Diretta' },
  { idmod: 3, Mod: 'Ri.Ba. 60gg' },
  { idmod: 4, Mod: 'Contanti' },
  { idmod: 5, Mod: 'Bonifico Bancario 60gg' },
  { idmod: 6, Mod: 'Carta di Credito' },
];

// Backward compat
export const modalitaPagamento: Record<number, string> = Object.fromEntries(modalitaPagamentoList.map(m => [m.idmod, m.Mod]));

export const azienda = [
  {
    id: 1,
    RagioneSociale1: "GL Informatica di Rosignoli Marco",
    RagioneSociale2: "P.IVA 01757030539",
    RagioneSociale3: "Via Bruno Buozzi 74B, Grosseto (GR)",
    RagioneSociale4: "Tel. 0564.411318 | info@glinformatica.it"
  }
];
