import { Articolo } from '@/data/mockData';

export interface Reparto {
  id: number;
  descrizione: string;
}

export const reparti: Reparto[] = [
  { id: 1, descrizione: 'Edilizia' },
  { id: 2, descrizione: 'Ufficio' },
  { id: 3, descrizione: 'Elettronica' },
  { id: 4, descrizione: 'Abbigliamento' },
  { id: 5, descrizione: 'Ferramenta' },
  { id: 6, descrizione: 'Idraulica' },
  { id: 7, descrizione: 'Giardinaggio' },
  { id: 8, descrizione: 'Automotive' },
];

function seeded(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

const brands = ['Fischer', 'Vimar', 'Mapei', 'Bosch', 'Gewiss', 'Caleffi', 'Henkel', 'Hilti', 'Knauf', 'Weber', 'Sika', 'Makita', 'Stanley', 'DeWalt', '3M'];
const categorie = ['CEM', 'ELE', 'IDR', 'FER', 'LEG', 'VER', 'IMP', 'UTE', 'PRO', 'ILL', 'RIV', 'ISO', 'FIX', 'TUB', 'SIC'];
const sottocategorie = ['Sacchi', 'Lastre', 'Tubi', 'Cavi', 'Raccordi', 'Viti', 'Bulloni', 'Collanti', 'Pitture', 'Utensili', 'Protezione', 'Illuminazione', 'Pannelli', 'Guarnizioni', 'Accessori'];
const unita = ['PZ', 'MT', 'KG', 'LT', 'CF', 'MQ', 'ML', 'NR'];

const articoliDescrizioni = [
  'Cemento Portland 25kg', 'Cemento Rapido 5kg', 'Malta Bastarda 25kg', 'Calce Idrata 25kg',
  'Intonaco Premiscelato 30kg', 'Massetto Autolivellante 25kg', 'Colla Piastrelle C2TE 25kg', 'Fugante Cementizio 5kg',
  'Guaina Bituminosa 10mq', 'Pannello XPS 50mm', 'Lana di Roccia 40mm', 'Polistirene EPS 30mm',
  'Cartongesso Standard 13mm', 'Cartongesso Idrofugo 13mm', 'Profilo CW 75/50 3m', 'Profilo UW 75/40 3m',
  'Vite Fosfatata 3.5x25', 'Vite Fosfatata 3.5x35', 'Vite Fosfatata 3.5x45', 'Banda Armata 50mm 90m',
  'Stucco in Pasta 20kg', 'Stucco in Polvere 5kg', 'Nastro Rete 50mm', 'Angolare Paraspigolo 3m',
  'Mattone Forato 8x25x25', 'Mattone Pieno UNI', 'Blocco Cls 20x20x50', 'Tavella 4x25x50',
  'Piastrella Gres 30x30', 'Piastrella Gres 60x60', 'Piastrella Gres 20x120', 'Mosaico Vetro 30x30',
  'Battiscopa Gres 8x60', 'Profilo Jolly Alluminio', 'Distanziatori 2mm x200', 'Distanziatori 3mm x200',
  'Cavo FG7R 3G2.5 100m', 'Cavo FG7R 3G1.5 100m', 'Cavo FG7R 5G2.5 100m', 'Cavo H07VK 1x2.5 100m',
  'Tubo Corrugato 20mm 50m', 'Tubo Corrugato 25mm 50m', 'Scatola Incasso 503', 'Scatola Derivazione 100x100',
  'Interruttore 1P 16A', 'Deviatore 1P 16A', 'Presa 2P+T 16A', 'Presa Bivalente 10/16A',
  'Placca 3M Bianca', 'Placca 3M Antracite', 'Placca 4M Bianca', 'Placca 7M Bianca',
  'Magnetotermico 1P+N C10', 'Magnetotermico 1P+N C16', 'Magnetotermico 1P+N C20', 'Differenziale 2P 25A 30mA',
  'Centralino 8 Moduli', 'Centralino 12 Moduli', 'Centralino 24 Moduli', 'Morsettiera 12P 16mm',
  'Lampada LED E27 10W', 'Lampada LED E27 15W', 'Lampada LED E14 7W', 'Faretto LED GU10 5W',
  'Striscia LED 5m 3000K', 'Striscia LED 5m 4000K', 'Alimentatore LED 12V 60W', 'Profilo Alluminio LED 2m',
  'Tubo Multistrato 16mm', 'Tubo Multistrato 20mm', 'Tubo Multistrato 26mm', 'Tubo Multistrato 32mm',
  'Raccordo a Press. 16x1/2', 'Raccordo a Press. 20x3/4', 'Curva 90° Press. 16', 'Tee Press. 20',
  'Valvola Sfera 1/2"', 'Valvola Sfera 3/4"', 'Valvola Sfera 1"', 'Valvola di Ritegno 1/2"',
  'Rubinetto Lavabo Mono', 'Rubinetto Cucina Mono', 'Miscelatore Doccia Inc.', 'Gruppo Vasca Esterno',
  'Sifone Lavabo 1"1/4', 'Sifone Bidet 1"1/4', 'Piletta Doccia 60mm', 'Flessibile 50cm 1/2"',
  'Cassetta WC Incasso', 'Placca Cassetta Bianca', 'Sedile WC Universale', 'Vaso WC a Pavimento',
  'Bidet a Pavimento', 'Lavabo 60cm', 'Colonna Lavabo', 'Piatto Doccia 80x80',
  'Trapano Avvitatore 18V', 'Avvitatore Impulsi 18V', 'Smerigliatrice 125mm', 'Seghetto Alternativo',
  'Martello Perforatore SDS+', 'Sega Circolare 190mm', 'Levigatrice Orbitale', 'Fresatrice Verticale',
  'Set Punte Muro 5-12mm', 'Set Punte HSS 1-13mm', 'Set Punte Legno 3-10mm', 'Set Inserti PH/PZ 32pz',
  'Disco Diamantato 125mm', 'Disco Taglio Metallo 125', 'Disco Lamellare 125 P60', 'Disco Lamellare 125 P80',
  'Chiave Combinata 10mm', 'Chiave Combinata 13mm', 'Chiave Combinata 17mm', 'Set Chiavi Comb. 6-22',
  'Pinza Universale 180mm', 'Pinza Regolabile 250mm', 'Tronchese 160mm', 'Pinza a Becco Lungo 200',
  'Giravite PH1x80', 'Giravite PH2x100', 'Giravite Taglio 5.5x100', 'Set Giraviti 6pz',
  'Metro Avvolgibile 3m', 'Metro Avvolgibile 5m', 'Metro Avvolgibile 8m', 'Livella Bolla 60cm',
  'Filo a Piombo 200g', 'Squadra Carpentiere 25cm', 'Riga Alluminio 2m', 'Cazzuola Muratore 20cm',
  'Frattazzo Spugna 28x14', 'Spatola Inox 10cm', 'Spatola Inox 20cm', 'Pennello 50mm',
  'Rullo Antigoccia 25cm', 'Secchio 12L', 'Corda Tracciatore 30m', 'Matita Carpentiere',
  'Silicone Acetico Trasp.', 'Silicone Acetico Bianco', 'Silicone Neutro Trasp.', 'Silicone Neutro Bianco',
  'Schiuma Poliuretanica 750', 'Colla Epossidica 2Comp', 'Adesivo PVC 250ml', 'Nastro Teflon 12mm',
  'Nastro Isolante Nero 19mm', 'Nastro Isolante Rosso 19mm', 'Fascetta Nylon 200mm x100', 'Fascetta Nylon 300mm x100',
  'Guanti Lattice M x100', 'Guanti Nitrile L x100', 'Occhiali Protezione', 'Maschera FFP2 x10',
  'Casco Sicurezza Bianco', 'Scarpe Antinf. S3 n.43', 'Gilet Alta Visibilità', 'Tappi Auricolari x50',
  'Tassello Nylon 6x30 x100', 'Tassello Nylon 8x40 x50', 'Tassello Nylon 10x50 x25', 'Tassello Chimico 300ml',
  'Ancorante Pesante M10', 'Ancorante Pesante M12', 'Staffa Regolabile 200mm', 'Mensola Acciaio 250mm',
  'Pittura Lavabile Bianca 5L', 'Pittura Lavabile Bianca 14L', 'Pittura Traspirante 5L', 'Pittura Traspirante 14L',
  'Smalto Acqua Bianco 0.75L', 'Smalto Acqua Bianco 2.5L', 'Fondo Fissativo 5L', 'Impregnante Legno 0.75L',
  'Primer Aggrappante 5L', 'Pittura Termica 5L', 'Colorante Univ. Giallo', 'Colorante Univ. Rosso',
  'Tubo PVC 40mm 2m', 'Tubo PVC 50mm 2m', 'Tubo PVC 100mm 1m', 'Tubo PVC 125mm 1m',
  'Curva 87° PVC 50mm', 'Curva 45° PVC 100mm', 'Tee PVC 100/100', 'Manicotto PVC 50mm',
  'Riduzione PVC 100/50', 'Sifone Bottiglia 50mm', 'Chiusino PP 20x20', 'Pozzetto 30x30 PP',
  'Grondaia PVC 125mm 2m', 'Pluviale PVC 80mm 2m', 'Curva Pluviale 80mm', 'Giunto Grondaia 125mm',
  'Staffa Grondaia Rame 125', 'Scossalina Alluminio 20cm', 'Banda Butilica 10cm 10m', 'Rete Fibra Vetro 50mq',
];

export const articoliMagazzino: Articolo[] = articoliDescrizioni.map((desc, i) => {
  const basePrice = Math.round((seeded(i * 31 + 999) * 300 + 2) * 100) / 100;
  const brandIdx = Math.floor(seeded(i * 37 + 111) * brands.length);
  const catIdx = Math.floor(seeded(i * 41 + 222) * categorie.length);
  const sottocatIdx = Math.floor(seeded(i * 43 + 333) * sottocategorie.length);
  const repIdx = Math.floor(seeded(i * 47 + 444) * reparti.length);
  const umIdx = Math.floor(seeded(i * 53 + 555) * unita.length);

  return {
    id: 1000 + i,
    Codice: `ART${String(i + 1).padStart(3, '0')}`,
    Cod_Prisma: categorie[catIdx],
    Descrizione: desc,
    UnMis: unita[umIdx],
    esistenza: Math.floor(seeded(i * 59 + 666) * 800),
    ultprzacq: Math.round(basePrice * 0.65 * 100) / 100,
    Listino1: basePrice,
    Listino2: Math.round(basePrice * 0.95 * 100) / 100,
    Listino3: Math.round(basePrice * 0.9 * 100) / 100,
    Listino4: Math.round(basePrice * 0.85 * 100) / 100,
    Listino5: Math.round(basePrice * 0.8 * 100) / 100,
    Listino6: Math.round(basePrice * 0.75 * 100) / 100,
    scorta_minima: Math.floor(seeded(i * 61 + 777) * 30),
    sconto1: 0, sconto2: 0, sconto3: 0,
    peso: Math.round(seeded(i * 67 + 888) * 25 * 100) / 100,
    codiva: 1,
    Macro: '',
    magaz: 1,
    codice2: i % 3 === 0 ? `EXT${String(i + 1).padStart(4, '0')}` : '',
    sottocateg: sottocategorie[sottocatIdx],
    brand: brands[brandIdx],
    macroart: '',
    colore: '',
    taglia: '',
    reparto: reparti[repIdx].id,
    barcode: i % 4 === 0 ? 1 : 0,
    prezzare: 1,
    rif_esterno: 0,
    IS: 'I',
    ecommerce: i % 5 === 0 ? 1 : 0,
    TS: '2025-01-01 00:00:00',
  };
});

// ===== CARICHI =====
export interface Carico {
  Id: number;
  Data: string;
  Cod_articolo: string;
  Fornitore: number;
  protocollo: string;
  lotto: string;
  quantita: number;
  Importo: number;
  perc: number;
  TS: string;
  magazzino: number;
  operatore: string;
  inventario: number;
  iddocumento: number;
  reso: number;
  codbuono: string;
  extra: string;
}

export const carichi: Carico[] = Array.from({ length: 30 }, (_, i) => {
  const artIdx = Math.floor(seeded(i * 71 + 100) * articoliDescrizioni.length);
  const day = Math.floor(seeded(i * 73 + 200) * 28) + 1;
  const month = Math.floor(seeded(i * 79 + 300) * 12) + 1;
  const year = seeded(i * 83 + 400) > 0.5 ? 2025 : 2024;
  const qty = Math.floor(seeded(i * 89 + 500) * 200) + 1;
  const price = Math.round((seeded(i * 97 + 600) * 150 + 5) * 100) / 100;
  return {
    Id: i + 1,
    Data: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    Cod_articolo: `ART${String(artIdx + 1).padStart(3, '0')}`,
    Fornitore: Math.floor(seeded(i * 101 + 700) * 20) + 1,
    protocollo: `PROT-${year}-${String(i + 1).padStart(4, '0')}`,
    lotto: i % 3 === 0 ? `LOT${String(i + 1).padStart(3, '0')}` : '',
    quantita: qty,
    Importo: Math.round(qty * price * 100) / 100,
    perc: 0,
    TS: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`,
    magazzino: Math.floor(seeded(i * 103 + 800) * 3) + 1,
    operatore: ['admin', 'operatore1', 'operatore2'][Math.floor(seeded(i * 107 + 900) * 3)],
    inventario: 0,
    iddocumento: 0,
    reso: i % 10 === 0 ? 1 : 0,
    codbuono: '',
    extra: '',
  };
});

// ===== SCARICHI =====
export interface Scarico {
  Id: number;
  Data: string;
  Cod_Cliente: number;
  Riferimento: string;
  IdLavoro: number;
  Cod_articolo: string;
  quantita: number;
  Pr_Unit: number;
  lotto: string;
  perc: number;
  nscontrino: string;
  TS: string;
  idoperatore: string;
  codpagamento: number;
  magazzino: number;
  ncassa: number;
  iddocumento: number;
  nchiusura: number;
  codbuono: string;
  extra: string;
  reso: number;
  lotteria: string;
  idfidelity: number;
}

export const scarichi: Scarico[] = Array.from({ length: 30 }, (_, i) => {
  const artIdx = Math.floor(seeded(i * 109 + 1000) * articoliDescrizioni.length);
  const day = Math.floor(seeded(i * 113 + 1100) * 28) + 1;
  const month = Math.floor(seeded(i * 127 + 1200) * 12) + 1;
  const year = seeded(i * 131 + 1300) > 0.5 ? 2025 : 2024;
  const qty = Math.floor(seeded(i * 137 + 1400) * 50) + 1;
  const prUnit = Math.round((seeded(i * 139 + 1500) * 200 + 3) * 100) / 100;
  return {
    Id: i + 1,
    Data: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    Cod_Cliente: Math.floor(seeded(i * 149 + 1600) * 30) + 1,
    Riferimento: i % 4 === 0 ? `RIF-${i + 1}` : '',
    IdLavoro: 0,
    Cod_articolo: `ART${String(artIdx + 1).padStart(3, '0')}`,
    quantita: qty,
    Pr_Unit: prUnit,
    lotto: '',
    perc: 0,
    nscontrino: i % 5 === 0 ? `SC${String(i + 1).padStart(6, '0')}` : '',
    TS: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`,
    idoperatore: ['admin', 'operatore1', 'operatore2'][Math.floor(seeded(i * 151 + 1700) * 3)],
    codpagamento: Math.floor(seeded(i * 157 + 1800) * 4) + 1,
    magazzino: Math.floor(seeded(i * 163 + 1900) * 3) + 1,
    ncassa: 1,
    iddocumento: 0,
    nchiusura: 0,
    codbuono: '',
    extra: '',
    reso: i % 12 === 0 ? 1 : 0,
    lotteria: '',
    idfidelity: 0,
  };
});

// ===== TRASFERIMENTI =====
export interface Trasferimento {
  id: number;
  data: string;
  codice: string;
  magout: number;
  magin: number;
  operatore: string;
  quant: number;
  TS: string;
}

export const trasferimenti: Trasferimento[] = Array.from({ length: 20 }, (_, i) => {
  const artIdx = Math.floor(seeded(i * 167 + 2000) * articoliDescrizioni.length);
  const day = Math.floor(seeded(i * 173 + 2100) * 28) + 1;
  const month = Math.floor(seeded(i * 179 + 2200) * 12) + 1;
  const year = seeded(i * 181 + 2300) > 0.5 ? 2025 : 2024;
  const magOut = Math.floor(seeded(i * 191 + 2400) * 3) + 1;
  let magIn = Math.floor(seeded(i * 193 + 2500) * 3) + 1;
  if (magIn === magOut) magIn = (magOut % 3) + 1;
  return {
    id: i + 1,
    data: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    codice: `ART${String(artIdx + 1).padStart(3, '0')}`,
    magout: magOut,
    magin: magIn,
    operatore: ['admin', 'operatore1', 'operatore2'][Math.floor(seeded(i * 197 + 2600) * 3)],
    quant: Math.floor(seeded(i * 199 + 2700) * 100) + 1,
    TS: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} 00:00:00`,
  };
});
