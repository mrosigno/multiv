// Contabilità mock data - struttura identica al DB MySQL

import { clienti, fatture } from './mockData';

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// ===== CAUSALI CONTABILI =====
export interface CausaleContabile {
  IdTipo: number;
  Descrizione: string;
  TS: string;
  descrestesa: string;
  'D-A': string;
  suffisso: string;
}

export const causaliContabili: CausaleContabile[] = [
  { IdTipo: 1, suffisso: 'BAN', Descrizione: 'Banca c/c', 'D-A': 'D', descrestesa: 'Movimento bancario su conto corrente', TS: '2024-01-01 00:00:00' },
  { IdTipo: 2, suffisso: 'CAS', Descrizione: 'Cassa contanti', 'D-A': 'D', descrestesa: 'Movimento di cassa contanti', TS: '2024-01-01 00:00:00' },
  { IdTipo: 3, suffisso: 'FAT', Descrizione: 'Fattura emessa', 'D-A': 'D', descrestesa: 'Registrazione fattura emessa', TS: '2024-01-01 00:00:00' },
  { IdTipo: 4, suffisso: 'FAR', Descrizione: 'Fattura ricevuta', 'D-A': 'A', descrestesa: 'Registrazione fattura ricevuta', TS: '2024-01-01 00:00:00' },
  { IdTipo: 5, suffisso: 'NCR', Descrizione: 'Nota di credito', 'D-A': 'A', descrestesa: 'Nota di credito emessa', TS: '2024-01-01 00:00:00' },
  { IdTipo: 6, suffisso: 'GIR', Descrizione: 'Giroconto', 'D-A': 'D', descrestesa: 'Giroconto tra conti', TS: '2024-01-01 00:00:00' },
  { IdTipo: 7, suffisso: 'RIB', Descrizione: 'Ri.Ba.', 'D-A': 'D', descrestesa: 'Ricevuta bancaria', TS: '2024-01-01 00:00:00' },
  { IdTipo: 8, suffisso: 'SPE', Descrizione: 'Spese generali', 'D-A': 'A', descrestesa: 'Spese generali aziendali', TS: '2024-01-01 00:00:00' },
  { IdTipo: 9, suffisso: 'STI', Descrizione: 'Stipendi', 'D-A': 'A', descrestesa: 'Pagamento stipendi dipendenti', TS: '2024-01-01 00:00:00' },
  { IdTipo: 10, suffisso: 'IVA', Descrizione: 'Liquidazione IVA', 'D-A': 'A', descrestesa: 'Liquidazione periodica IVA', TS: '2024-01-01 00:00:00' },
];

// ===== TIPOLOGIE MOVIMENTO =====
export interface TipologiaMovimento {
  IdTipo: number;
  Descrizione: string;
  TS: string;
  idcausale: number;
  codice: string;
}

export const tipologieMovimento: TipologiaMovimento[] = [
  { IdTipo: 10, idcausale: 1, codice: 'INC', Descrizione: 'Incasso bonifico', TS: '2024-01-01 00:00:00' },
  { IdTipo: 11, idcausale: 1, codice: 'PAG', Descrizione: 'Pagamento bonifico', TS: '2024-01-01 00:00:00' },
  { IdTipo: 12, idcausale: 1, codice: 'COM', Descrizione: 'Commissioni bancarie', TS: '2024-01-01 00:00:00' },
  { IdTipo: 20, idcausale: 2, codice: 'INC', Descrizione: 'Incasso contanti', TS: '2024-01-01 00:00:00' },
  { IdTipo: 21, idcausale: 2, codice: 'PAG', Descrizione: 'Pagamento contanti', TS: '2024-01-01 00:00:00' },
  { IdTipo: 22, idcausale: 2, codice: 'PRE', Descrizione: 'Prelievo cassa', TS: '2024-01-01 00:00:00' },
  { IdTipo: 30, idcausale: 3, codice: 'EMI', Descrizione: 'Emissione fattura', TS: '2024-01-01 00:00:00' },
  { IdTipo: 31, idcausale: 3, codice: 'STO', Descrizione: 'Storno fattura', TS: '2024-01-01 00:00:00' },
  { IdTipo: 40, idcausale: 4, codice: 'RIC', Descrizione: 'Ricezione fattura fornitore', TS: '2024-01-01 00:00:00' },
  { IdTipo: 41, idcausale: 4, codice: 'STO', Descrizione: 'Storno fattura fornitore', TS: '2024-01-01 00:00:00' },
  { IdTipo: 50, idcausale: 5, codice: 'EMI', Descrizione: 'Emissione nota credito', TS: '2024-01-01 00:00:00' },
  { IdTipo: 60, idcausale: 6, codice: 'TRA', Descrizione: 'Trasferimento fondi', TS: '2024-01-01 00:00:00' },
  { IdTipo: 70, idcausale: 7, codice: 'PRE', Descrizione: 'Presentazione Ri.Ba.', TS: '2024-01-01 00:00:00' },
  { IdTipo: 71, idcausale: 7, codice: 'INC', Descrizione: 'Incasso Ri.Ba.', TS: '2024-01-01 00:00:00' },
  { IdTipo: 72, idcausale: 7, codice: 'INS', Descrizione: 'Insoluto Ri.Ba.', TS: '2024-01-01 00:00:00' },
  { IdTipo: 80, idcausale: 8, codice: 'AFF', Descrizione: 'Affitto locali', TS: '2024-01-01 00:00:00' },
  { IdTipo: 81, idcausale: 8, codice: 'UTN', Descrizione: 'Utenze', TS: '2024-01-01 00:00:00' },
  { IdTipo: 82, idcausale: 8, codice: 'ASS', Descrizione: 'Assicurazioni', TS: '2024-01-01 00:00:00' },
  { IdTipo: 90, idcausale: 9, codice: 'NET', Descrizione: 'Stipendio netto', TS: '2024-01-01 00:00:00' },
  { IdTipo: 91, idcausale: 9, codice: 'CON', Descrizione: 'Contributi INPS', TS: '2024-01-01 00:00:00' },
  { IdTipo: 100, idcausale: 10, codice: 'LIQ', Descrizione: 'Liquidazione IVA periodica', TS: '2024-01-01 00:00:00' },
  { IdTipo: 101, idcausale: 10, codice: 'ACC', Descrizione: 'Acconto IVA', TS: '2024-01-01 00:00:00' },
];

// ===== MEZZI PAGAMENTO INDIRETTI =====
export interface MezzoPagamentoIndiretto {
  cod: number;
  descrizione: string;
  speseinc: number;
  TS: string;
  codfattel: string;
}

export const mezziPagamento: MezzoPagamentoIndiretto[] = [
  { cod: 1, descrizione: 'Bonifico', speseinc: 2.50, TS: '2024-01-01 00:00:00', codfattel: 'MP05' },
  { cod: 2, descrizione: 'Contanti', speseinc: 0, TS: '2024-01-01 00:00:00', codfattel: 'MP01' },
  { cod: 3, descrizione: 'Assegno', speseinc: 1.50, TS: '2024-01-01 00:00:00', codfattel: 'MP02' },
  { cod: 4, descrizione: 'Ri.Ba.', speseinc: 3.00, TS: '2024-01-01 00:00:00', codfattel: 'MP12' },
  { cod: 5, descrizione: 'Carta di credito', speseinc: 1.80, TS: '2024-01-01 00:00:00', codfattel: 'MP08' },
  { cod: 6, descrizione: 'POS / Bancomat', speseinc: 0.80, TS: '2024-01-01 00:00:00', codfattel: 'MP08' },
  { cod: 7, descrizione: 'MAV', speseinc: 2.00, TS: '2024-01-01 00:00:00', codfattel: 'MP09' },
  { cod: 8, descrizione: 'Compensazione', speseinc: 0, TS: '2024-01-01 00:00:00', codfattel: 'MP17' },
];

// ===== PRIMA NOTA CASA =====
export interface PrimaNotaCasa {
  Id: number;
  IdAzienda: number;
  IdFattura: number;
  IdCliente: number;
  data: string;
  descrizione: string;
  Dare: number;
  Avere: number;
  imponibile: number;
  iva: number;
  TipoMovimento: number;
  Categoria: number;
  link: string;
  scadenza: string;
  datachiusura: string;
  numdoc: string;
  TS: string;
  rifinterno: string;
  'C-R': string;
  note: string;
  chiuso: number;
  mezzopag: number;
  oilcausale: string;
  oiltipo: string;
  rifrevers: number;
}

const descrizioniMovimenti = [
  'Incasso fattura', 'Pagamento fornitore', 'Commissioni bancarie', 'Incasso contanti vendita',
  'Pagamento affitto locale', 'Pagamento utenze elettriche', 'Pagamento utenze gas',
  'Stipendio dipendente', 'Contributi INPS', 'Liquidazione IVA trimestrale',
  'Acconto IVA dicembre', 'Nota credito cliente', 'Giroconto interno',
  'Incasso Ri.Ba.', 'Presentazione effetti', 'Pagamento assicurazione',
  'Acquisto materiale', 'Pagamento consulenza', 'Incasso acconto', 'Pagamento F24',
];

const primaNotaData: PrimaNotaCasa[] = [];

for (let i = 0; i < 120; i++) {
  const year = i < 50 ? 2025 : 2026;
  const month = (i % 12) + 1;
  const day = Math.floor(seededRandom(i * 71) * 27) + 1;
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const causaleIdx = Math.floor(seededRandom(i * 73) * causaliContabili.length);
  const causale = causaliContabili[causaleIdx];
  const tipiPerCausale = tipologieMovimento.filter(t => t.idcausale === causale.IdTipo);
  const tipoMov = tipiPerCausale[Math.floor(seededRandom(i * 75) * tipiPerCausale.length)];

  const clienteIdx = Math.floor(seededRandom(i * 77) * clienti.length);
  const cliente = clienti[clienteIdx];

  const importo = Math.round((seededRandom(i * 79) * 4950 + 50) * 100) / 100;
  const isDare = causale['D-A'] === 'D';
  const aliquotaIva = seededRandom(i * 81) > 0.3 ? 22 : (seededRandom(i * 83) > 0.5 ? 10 : 0);
  const imponibile = Math.round(importo / (1 + aliquotaIva / 100) * 100) / 100;
  const ivaAmount = Math.round((importo - imponibile) * 100) / 100;

  // Link some records to fatture
  const linkedFattura = seededRandom(i * 85) > 0.5 ? fatture[Math.floor(seededRandom(i * 87) * fatture.length)] : null;
  const mezzopag = Math.floor(seededRandom(i * 89) * mezziPagamento.length) + 1;

  const scadDate = new Date(year, month - 1, day);
  scadDate.setDate(scadDate.getDate() + 30);
  const scadStr = `${scadDate.getFullYear()}-${String(scadDate.getMonth() + 1).padStart(2, '0')}-${String(scadDate.getDate()).padStart(2, '0')}`;
  const chiuso = seededRandom(i * 91) > 0.35 ? 1 : 0;

  primaNotaData.push({
    Id: i + 1,
    IdAzienda: 1,
    IdFattura: linkedFattura?.ID || 0,
    IdCliente: cliente.ID,
    data: dateStr,
    descrizione: `${descrizioniMovimenti[i % descrizioniMovimenti.length]} - ${cliente.Ragione_Sociale.substring(0, 25)}`,
    Dare: isDare ? importo : 0,
    Avere: isDare ? 0 : importo,
    imponibile,
    iva: ivaAmount,
    TipoMovimento: tipoMov?.IdTipo || 10,
    Categoria: causale.IdTipo,
    link: linkedFattura ? `FAT-${linkedFattura.Num}` : '',
    scadenza: scadStr,
    datachiusura: chiuso ? scadStr : '',
    numdoc: linkedFattura ? String(linkedFattura.Num) : `MOV${String(i + 1).padStart(5, '0')}`,
    TS: dateStr + ' 00:00:00',
    rifinterno: linkedFattura ? String(linkedFattura.ID).padStart(5, '0') : '',
    'C-R': isDare ? 'D' : 'C',
    note: i % 5 === 0 ? 'Registrazione automatica' : '',
    chiuso,
    mezzopag,
    oilcausale: '',
    oiltipo: '',
    rifrevers: 0,
  });
}

export const primaNotaCasa: PrimaNotaCasa[] = primaNotaData;

// ===== SCADENZARIO (30% di prima_nota_casa con date future e chiuso=0) =====
export const scadenzario: PrimaNotaCasa[] = primaNotaData
  .filter((_, i) => seededRandom(i * 93) > 0.7)
  .map((record, idx) => {
    const futureDate = new Date(2026, Math.floor(seededRandom(idx * 95) * 12), Math.floor(seededRandom(idx * 97) * 27) + 1);
    const dateStr = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;
    const scadDate = new Date(futureDate);
    scadDate.setDate(scadDate.getDate() + 30);
    const scadStr = `${scadDate.getFullYear()}-${String(scadDate.getMonth() + 1).padStart(2, '0')}-${String(scadDate.getDate()).padStart(2, '0')}`;
    return {
      ...record,
      Id: 1000 + idx + 1,
      data: dateStr,
      scadenza: scadStr,
      datachiusura: '',
      chiuso: 0,
      TS: dateStr + ' 00:00:00',
    };
  });
