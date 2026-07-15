import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, XCircle, Pencil, Trash2, Plus, FileText, Lock, Truck, Printer, Mail, Info, History, Eye, ChevronUp, ChevronDown, FastForward, StopCircle, RefreshCcw, Search } from 'lucide-react';
import { Fattura, FatturaCorpo } from '@/data/mockData';
import { useClienti } from '@/hooks/api/useClienti';
import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useAliquote } from '@/hooks/api/useAliquote';
import { useTipiDocumento } from '@/hooks/api/useTipiDocumento';
import { useModalitaPagamento } from '@/hooks/api/useModalitaPagamento';
import { useMezziPagamento } from '@/hooks/api/useMezziPagamento';
import { useArticoli } from '@/hooks/api/useArticoli';
import { useReparti } from '@/hooks/api/useReparti';
import { useAzienda } from '@/hooks/api/useAzienda';
import { useListini } from '@/hooks/api/useListini';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { API_HOST } from '@/config';
import { useAuthAccess } from '@/hooks/useAuthAccess'; 

import ArticoloFormModal from './ArticoloFormModal';
import ContabilizzazioneModal from './ContabilizzazioneModal';
import MovimentazioneMagazzinoModal from './MovimentazioneMagazzinoModal';
import FastAutocomplete from '@/components/ui/FastAutocomplete';
import ConfirmDialog from '@/components/ConfirmDialog';
import TrasportoModal from './TrasportoModal';
import EmailSenderModal from './EmailSenderModal';

import { generateSuperPDF } from '@/utils/pdfGenerator';

interface Props {
  document: Fattura;
  onClose: () => void;
  onEdit: () => void;
  onToggle: (field: 'verificato' | 'registrata' | 'caricata') => void;
  onDeleteDocument?: (docId: number) => void;
  autoTriggerAction?: 'contabilizza' | 'movimenta' | null;
  massWizardInfo?: any;
}

const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const formatNumber = (n: number) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);

const InfoField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <span className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</span>
    <div className="text-sm font-medium text-foreground flex items-center gap-1.5 overflow-hidden">
      {value}
    </div>
  </div>
);

const DocumentDetail = ({ document: doc, onClose, onEdit, onToggle, onDeleteDocument, autoTriggerAction, massWizardInfo }: Props) => {
  const queryClient = useQueryClient();
  const auth = useAuthAccess(); 
  
  const { data: clientiData } = useClienti();
  const { data: magazziniData } = useMagazzini();
  const { data: aliquoteData =[] } = useAliquote();
  const { data: tipiDocumentoData =[] } = useTipiDocumento();
  const { data: modalitaPagamentoData =[] } = useModalitaPagamento();
  const { data: mezziData =[] } = useMezziPagamento();
  const { data: listiniData =[] } = useListini();
  
  const { data: righeApiData = [], isLoading: righeLoading, isFetching: righeFetching } = useQuery({
    queryKey: ['righe_fattura', doc.ID],
    queryFn: async () => {
      const res = await fetch(`${API_HOST}/api.php?action=get_righe_fattura&id=${doc.ID}`);
      return res.json();
    }
  });
  
  const { data: aziendaData } = useAzienda();
  const azienda = aziendaData?.[0];

  const { data: fattpaData } = useQuery({ queryKey: ['fattpaparam'], queryFn: async () => (await fetch(`${API_HOST}/api.php?action=fattpaparam`)).json() });
  const fattpa = fattpaData?.[0] || {};

  const isLocked = Number(doc.registrata) !== 0 || Number(doc.caricata) !== 0;
  // REGOLA: Chi può aggiungere/modificare RIGHE su un documento esistente? (Liv. 2 o >= 4)
  const canEditExisting = auth.isAdmin || auth.level === 2 || auth.level >= 4;
  const canEditDoc = canEditExisting && !isLocked;
  const canDeleteDoc = auth.canDelete && !isLocked;

  const getCliente = (id: number) => (clientiData ||[]).find((c: any) => Number(c.ID) === Number(id));
  const clienteRaw = getCliente(doc.IDCliente) as any;

  // --- NUOVA LOGICA: Controllo se è disattivato ---
  const isClienteAttivo = (c: any) => {
    if (!c) return true;
    return c.attivo === 'SI' || c.attivo === 1 || c.attivo === '1' || c.attivo === -1 || c.attivo === '-1';
  };
  const clienteDisattivato = !isClienteAttivo(clienteRaw);
  const cliente = {
    Ragione_Sociale: clienteRaw ? (clienteRaw.Ragione_Sociale || clienteRaw['Ragione Sociale'] || 'Cliente Senza Nome') : '-',
    Indirizzo: clienteRaw?.Indirizzo || '', CAP: clienteRaw?.CAP || '', Comune: clienteRaw?.Comune || '',
    Prov: clienteRaw?.Prov || '', PI: clienteRaw?.PI || '-', CF: clienteRaw?.CF || '-',
    PEC: clienteRaw?.PEC || '-', email: clienteRaw?.email || '', emaildoc: clienteRaw?.emaildoc || '', coduff: clienteRaw?.coduff || '0000000'
  };

  const [listinoNum, setListinoNum] = useState<number>(1);
  const [scontoCli, setScontoCli] = useState<number>(0);

  useEffect(() => {
    if (clienteRaw) {
      setListinoNum(Number(clienteRaw.cod_Listino || 1));
      setScontoCli(Number(clienteRaw.sconto || 0));
    }
  }, [clienteRaw?.ID]);

  const [righe, setRighe] = useState<FatturaCorpo[]>([]);
  const [editingRow, setEditingRow] = useState<FatturaCorpo | null>(null);
  const [showRowForm, setShowRowForm] = useState(false);
  const [showContabilizza, setShowContabilizza] = useState(false);
  const [showMovimentaMagazzino, setShowMovimentaMagazzino] = useState(false);
  
  const [printActionOpen, setPrintActionOpen] = useState(false);
  const [selectedPrintMode, setSelectedPrintMode] = useState<'print' | 'pdf' | null>(null);
  const [pdfPromptOpen, setPdfPromptOpen] = useState(false);
  const [showTrasportoModal, setShowTrasportoModal] = useState(false);
  const [emailData, setEmailData] = useState<{ filename: string, base64Data: string } | null>(null);

  const [rowToDelete, setRowToDelete] = useState<number | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [xmlSuccessModal, setXmlSuccessModal] = useState<{isOpen: boolean, link: string}>({ isOpen: false, link: '' });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [articoloModalConfig, setArticoloModalConfig] = useState<{ isOpen: boolean; articolo: any | null; onSuccess?: (art: any) => void; }>({ isOpen: false, articolo: null });
  const [historyModal, setHistoryModal] = useState<{ isOpen: boolean, codart: string }>({ isOpen: false, codart: '' });
  const [showFooter, setShowFooter] = useState(false);
  
  const hasAutoOpenedFor = useRef<number | null>(null);

  useEffect(() => {
    if (righeApiData && aliquoteData.length > 0) {
      const filtered = righeApiData.filter((r: any) => Number(r.IDFatt) === Number(doc.ID));
      const ricalcolate = filtered.map((r: any) => {
        const quant = Number(r.Quant) || 0; const impUnit = Number(r.ImpUnit) || 0; const sconto = Number(r.sconto) || 0;
        const impon = Math.round(quant * impUnit * (1 - (sconto / 100)) * 100) / 100;
        const ali = aliquoteData.find((a: any) => Number(a.Id) === Number(r.Iva || 1));
        const imposta = Math.round(impon * (Number(ali?.aliquota) || 0) / 100 * 100) / 100;
        return { ...r, impon, imposta, ttiva: impon + imposta };
      });
      setRighe(prev => JSON.stringify(prev) === JSON.stringify(ricalcolate) ? prev : ricalcolate);
    } else if (righeApiData) {
      const filtered = righeApiData.filter((r: any) => Number(r.IDFatt) === Number(doc.ID));
      setRighe(prev => JSON.stringify(prev) === JSON.stringify(filtered) ? prev : filtered);
    }
  }, [righeApiData, doc.ID, aliquoteData]);

  const sortedRighe = [...righe].sort((a, b) => {
    const ordA = Number(a.ordine || 0); const ordB = Number(b.ordine || 0);
    if (ordA !== ordB) return ordA - ordB;
    return Number(a.ID || 0) - Number(b.ID || 0); 
  });


	useEffect(() => {
    // FIX: Tolto isFetching, usiamo solo righeLoading per evitare blocchi
    if (righeLoading || !autoTriggerAction) return;

    if (hasAutoOpenedFor.current === doc.ID) return;

    const currRighe = righeApiData ? righeApiData.filter((r: any) => Number(r.IDFatt) === Number(doc.ID)) : [];
    
    if (autoTriggerAction === 'movimenta' && currRighe.length === 0) {
      if (massWizardInfo) massWizardInfo.onNext(); 
      return;
    }

    hasAutoOpenedFor.current = doc.ID;
    
    const timer = setTimeout(() => {
      if (autoTriggerAction === 'contabilizza') setShowContabilizza(true);
      if (autoTriggerAction === 'movimenta') setShowMovimentaMagazzino(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [righeLoading, autoTriggerAction, doc.ID, righeApiData]);

  const totalImpon = righe.reduce((s, r) => s + Number(r.impon || 0), 0);
  const totalImposta = righe.reduce((s, r) => s + Number(r.imposta || 0), 0);

  const tipoDocObj = tipiDocumentoData.find((t: any) => Number(t.id) === Number(doc.Tipo));
  const tipo = tipoDocObj?.descrizione || '?';
  
  const isFiscale = tipoDocObj && (tipoDocObj.da === '+' || tipoDocObj.da === '-');
  
  const mag = (magazziniData ||[]).find((m: any) => Number(m.cod) === Number(doc.codmag));
  const modPagObj = modalitaPagamentoData.find((m: any) => Number(m.idmod) === Number(doc.ModPag));

  const handleOpenArticolo = (articolo: any, onSuccess?: (art: any) => void) => { setArticoloModalConfig({ isOpen: true, articolo, onSuccess }); };
  const handleOpenHistory = (codart: string) => { if (codart && codart.trim() !== '') { setHistoryModal({ isOpen: true, codart: codart.trim() }); } };

  const handleDeleteDocument = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteDocument = async () => {
    try {
      setShowDeleteConfirm(false);
      await fetch(`${API_HOST}/api.php?action=delete_fattura`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ID: doc.ID }) });
      await queryClient.invalidateQueries({ queryKey: ['fatture'] });
      onDeleteDocument?.(doc.ID); 
      onClose();
    } catch (e) { alert("Errore di connessione"); }
  };

  const handleCloseAndSync = async () => {
    try {
      if (canEditDoc) {
        await fetch(`${API_HOST}/api.php?action=update_fattura_totali`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ID: doc.ID, impondoc: totalImpon, ivadoc: totalImposta }) });
        await queryClient.invalidateQueries({ queryKey: ['fatture'] });
      }
    } catch (e) {}
    onClose();
  };

  const confirmDeletionRow = async () => {
    if (!rowToDelete) return;
    try {
      const res = await fetch(`${API_HOST}/api.php?action=delete_fatturacorpo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ID: rowToDelete }) });
      const data = await res.json();
      if (data.success) { await queryClient.invalidateQueries({ queryKey: ['righe_fattura', doc.ID] }); setRowToDelete(null); setShowSuccess(true); } else alert("Errore: " + data.message);
    } catch (e) { alert("Errore"); }
  };

  const handleSaveRow = async (row: FatturaCorpo) => {
    try {
      const res = await fetch(`${API_HOST}/api.php?action=save_fatturacorpo`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
      const data = await res.json();
      if (data.success) { await queryClient.invalidateQueries({ queryKey: ['righe_fattura', doc.ID] }); setShowRowForm(false); setEditingRow(null); } else alert("Errore: " + data.message);
    } catch (e) { alert("Errore"); }
  };

  const handleInitialPrintClick = () => { setPrintActionOpen(true); };

  const handleSelectPrintMode = (mode: 'print' | 'pdf') => {
    setSelectedPrintMode(mode);
    setPrintActionOpen(false);
    const isMagazzino = tipoDocObj && ['C', 'S', 'T'].includes(tipoDocObj.movmagaz);

    if (isMagazzino) {
      if (!isFiscale) {
        setShowTrasportoModal(true); 
      } else {
        setPdfPromptOpen(true); 
      }
    } else {
      callPdfGenerator(mode, null); 
    }
  };

  const callPdfGenerator = async (mode: 'print' | 'pdf', transportData: any) => {
    let printWindow: Window | null = null;
    if (mode === 'print') {
      try {
        printWindow = window.open('about:blank', '_blank');
        if (printWindow && printWindow.document) {
          printWindow.document.open();
          printWindow.document.write("<!doctype html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>PDF</title></head><body style='font-family:Arial,sans-serif;padding:16px'>Generazione PDF...</body></html>");
          printWindow.document.close();
        }
      } catch {
        printWindow = null;
      }
    }

    const result = await generateSuperPDF({
      mode, transportData, doc, cliente, righe: sortedRighe,
      aliquoteData, mezziData, modPagObj, azienda, tipoDocObj,
      printWindow
    });

    if (mode === 'pdf' && result) {
      setEmailData(result);
    }
  };

  const generateXML = () => {
    const docSuffix = tipoDocObj?.suffisso ? `/${tipoDocObj.suffisso.trim()}` : '';
    const xmlNum = `${doc.Num}${docSuffix}`;

    const ivaGroups: any = {};
    sortedRighe.forEach((r: any) => {
      const ali = aliquoteData.find((a: any) => Number(a.Id) === Number(r.Iva));
      const aliquota = Number(ali?.aliquota || 0).toFixed(2);
      const natura = ali?.codfattel || ''; 
      if (!ivaGroups[aliquota]) { ivaGroups[aliquota] = { imponibile: 0, imposta: 0, natura }; }
      ivaGroups[aliquota].imponibile += Number(r.impon || 0);
      ivaGroups[aliquota].imposta += Number(r.imposta || 0);
    });

    const datiRiepilogoXML = Object.keys(ivaGroups).map(aliq => {
      const gr = ivaGroups[aliq];
      return `<DatiRiepilogo><AliquotaIVA>${aliq}</AliquotaIVA>${Number(aliq) === 0 ? `<Natura>${gr.natura || 'N2.2'}</Natura>` : ''}<ImponibileImporto>${gr.imponibile.toFixed(2)}</ImponibileImporto><Imposta>${gr.imposta.toFixed(2)}</Imposta><EsigibilitaIVA>I</EsigibilitaIVA></DatiRiepilogo>`;
    }).join('');

    const nRate = Number(modPagObj?.nrate) > 0 ? Number(modPagObj?.nrate) : 1;
    const giorniStep = Number(modPagObj?.t) || 0;
    const isFineMese = Number(modPagObj?.lock) === -1;
    
    const mezzoObj = mezziData.find((m: any) => Number(m.cod) === Number(modPagObj?.riba));
    const modalitaPagamentoSDI = mezzoObj?.codfattel || fattpa['ModalitaPagamento_2-4-2-2'] || 'MP05';
    
    const totaleDocFinale = totalImpon + totalImposta + Number(doc.arrot || 0);
    const importoRataBase = Math.round((totaleDocFinale / nRate) * 100) / 100;
    const differenzaUltimaRata = Math.round((totaleDocFinale - (importoRataBase * (nRate - 1))) * 100) / 100;
    
    const condizionePagamento = nRate > 1 ? 'TP01' : 'TP02';
    let dettaglioPagamentoXML = '';

    for (let i = 1; i <= nRate; i++) {
      const importoAttuale = (i === nRate) ? differenzaUltimaRata : importoRataBase;
      const d = new Date(doc.datafatt);
      d.setDate(d.getDate() + (giorniStep * i)); 
      if (isFineMese) { d.setMonth(d.getMonth() + 1); d.setDate(0); }

      const yyyy = d.getFullYear(); const mm = String(d.getMonth() + 1).padStart(2, '0'); const dd = String(d.getDate()).padStart(2, '0');
      
      dettaglioPagamentoXML += `<DettaglioPagamento><ModalitaPagamento>${modalitaPagamentoSDI}</ModalitaPagamento><DataScadenzaPagamento>${yyyy}-${mm}-${dd}</DataScadenzaPagamento><ImportoPagamento>${importoAttuale.toFixed(2)}</ImportoPagamento>${fattpa['IBAN_2-4-2-13'] ? `<IBAN>${fattpa['IBAN_2-4-2-13']}</IBAN>` : ''}</DettaglioPagamento>`;
    }

    const codiceSDI = tipoDocObj?.codtipo?.trim() || 'TD01';

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="${fattpa['FormatoTrasmissione_1-1-3'] || 'FPR12'}" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2">
  <FatturaElettronicaHeader>
    <DatiTrasmissione>
      <IdTrasmittente><IdPaese>${fattpa['IdPaese_1-1-1-1'] || 'IT'}</IdPaese><IdCodice>${fattpa['IdCodice_1-1-1-2'] || '00000000000'}</IdCodice></IdTrasmittente>
      <ProgressivoInvio>${String(doc.Num).padStart(5, '0')}</ProgressivoInvio>
      <FormatoTrasmissione>${fattpa['FormatoTrasmissione_1-1-3'] || 'FPR12'}</FormatoTrasmissione>
      <CodiceDestinatario>${cliente.coduff || '0000000'}</CodiceDestinatario>
      ${cliente.PEC !== '-' ? `<PECDestinatario>${cliente.PEC}</PECDestinatario>` : ''}
    </DatiTrasmissione>
    <CedentePrestatore>
      <DatiAnagrafici>
        <IdFiscaleIVA><IdPaese>${fattpa['IdPaese_1-2-1-1-1'] || 'IT'}</IdPaese><IdCodice>${fattpa['IdCodice_1-2-1-1-2'] || '00000000000'}</IdCodice></IdFiscaleIVA>
        ${fattpa['CodiceFiscale_1-2-1-2'] ? `<CodiceFiscale>${fattpa['CodiceFiscale_1-2-1-2']}</CodiceFiscale>` : ''}
        <Anagrafica><Denominazione>${fattpa['Denominazione_1-2-1-3-1'] || 'Azienda Prestatrice'}</Denominazione></Anagrafica>
        <RegimeFiscale>${fattpa['RegimeFiscale_1-2-1-8'] || 'RF01'}</RegimeFiscale>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${fattpa['Indirizzo_1-2-2-1'] || ''}</Indirizzo>
        ${fattpa['NumeroCivico_1-2-2-2-'] ? `<NumeroCivico>${fattpa['NumeroCivico_1-2-2-2-']}</NumeroCivico>` : ''}
        <CAP>${fattpa['CAP_1-2-2-3'] || ''}</CAP>
        <Comune>${fattpa['Comune_1-2-2-4'] || ''}</Comune>
        <Provincia>${fattpa['Provincia_1-2-2-5'] || ''}</Provincia>
        <Nazione>${fattpa['Nazione_1-2-2-6'] || 'IT'}</Nazione>
      </Sede>
    </CedentePrestatore>
    <CessionarioCommittente>
      <DatiAnagrafici>
        ${cliente.PI && cliente.PI !== '-' ? `<IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${cliente.PI}</IdCodice></IdFiscaleIVA>` : ''}
        <CodiceFiscale>${cliente.CF !== '-' ? cliente.CF : cliente.PI}</CodiceFiscale>
        <Anagrafica><Denominazione>${cliente.Ragione_Sociale}</Denominazione></Anagrafica>
      </DatiAnagrafici>
      <Sede>
        <Indirizzo>${cliente.Indirizzo}</Indirizzo><CAP>${cliente.CAP}</CAP><Comune>${cliente.Comune}</Comune><Provincia>${cliente.Prov}</Provincia><Nazione>IT</Nazione>
      </Sede>
    </CessionarioCommittente>
  </FatturaElettronicaHeader>
  <FatturaElettronicaBody>
    <DatiGenerali>
      <DatiGeneraliDocumento><TipoDocumento>${codiceSDI}</TipoDocumento><Divisa>EUR</Divisa><Data>${doc.datafatt}</Data><Numero>${xmlNum}</Numero><ImportoTotaleDocumento>${totaleDocFinale.toFixed(2)}</ImportoTotaleDocumento></DatiGeneraliDocumento>
    </DatiGenerali>
    <DatiBeniServizi>
      ${sortedRighe.map((r, i) => {
        const ali = aliquoteData.find((a: any) => Number(a.Id) === Number(r.Iva));
        const scontoVal = Number(r.sconto || 0);
        const scontoXML = scontoVal > 0 ? `<ScontoMaggiorazione><Tipo>SC</Tipo><Percentuale>${scontoVal.toFixed(2)}</Percentuale></ScontoMaggiorazione>` : '';
        return `<DettaglioLinee><NumeroLinea>${i + 1}</NumeroLinea>${r.Codart ? `<CodiceArticolo><CodiceTipo>INT</CodiceTipo><CodiceValore>${r.Codart}</CodiceValore></CodiceArticolo>` : ''}<Descrizione><![CDATA[${r.Descrzione}]]></Descrizione><Quantita>${Number(r.Quant || 0).toFixed(2)}</Quantita><PrezzoUnitario>${Number(r.ImpUnit || 0).toFixed(2)}</PrezzoUnitario>${scontoXML}<PrezzoTotale>${Number(r.impon || 0).toFixed(2)}</PrezzoTotale><AliquotaIVA>${Number(ali?.aliquota || 0).toFixed(2)}</AliquotaIVA></DettaglioLinee>`;
      }).join('')}
      ${datiRiepilogoXML}
    </DatiBeniServizi>
    <DatiPagamento><CondizioniPagamento>${condizionePagamento}</CondizioniPagamento>${dettaglioPagamentoXML}</DatiPagamento>
  </FatturaElettronicaBody>
</p:FatturaElettronica>`;

    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    let filePrefix = 'Fattura';
    if (codiceSDI === 'TD04') filePrefix = 'NotaCredito';
    else if (codiceSDI === 'TD05') filePrefix = 'NotaDebito';
    else if (codiceSDI === 'TD06') filePrefix = 'Parcella';
    const safeSuffix = tipoDocObj?.suffisso ? `_${tipoDocObj.suffisso.trim()}` : '';
    a.download = `${filePrefix}_${doc.Num}${safeSuffix}_${doc.datafatt}.xml`;

    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setXmlSuccessModal({ isOpen: true, link: fattpa.linkupload || '' });
  };

  return (
	<div className="fixed inset-0 bg-foreground/40 backdrop-blur-[6px] z-[100] flex items-center justify-center p-0 sm:p-4 animate-fade-in" onClick={handleCloseAndSync}>
      <div onClick={e => e.stopPropagation()} className="bg-card sm:rounded-2xl border border-border shadow-2xl w-full h-[100svh] sm:h-[95vh] sm:w-[95vw] sm:max-w-[1600px] flex flex-col relative overflow-hidden">
        
        <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-4 border-b border-border bg-card sm:rounded-t-2xl shrink-0 w-full gap-2">
          
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0 flex-1">
            <h3 className="text-xs sm:text-lg font-black text-foreground truncate">{tipo} <span className="text-blue-600">#{doc.Num}</span></h3>
            
            {isLocked && (
              <span className="bg-red-50 text-red-600 border border-red-200 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0" title="Documento Bloccato">
                <Lock className="w-3 h-3" /> <span className="hidden md:inline">Bloccato</span>
              </span>
            )}
            {!canEditDoc && !isLocked && (
              <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0" title="Sola Lettura">
                <Eye className="w-3 h-3" /> <span className="hidden md:inline">Sola Lettura</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button onClick={handleInitialPrintClick} className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm" title="Stampa o PDF">
              <Printer className="w-4 h-4 sm:w-4 sm:h-4" /> <span className="hidden sm:inline text-xs font-bold">Stampa</span>
            </button>
            
            {isFiscale && (
              <button onClick={generateXML} className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-600 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm" title="Genera XML">
                <FileText className="w-4 h-4" /> <span className="hidden sm:inline text-xs font-bold">XML</span>
              </button>
            )}
            
            {canEditDoc && (
              <button onClick={onEdit} className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-600 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm" title="Modifica Intestazione">
                <Pencil className="w-4 h-4" /> <span className="hidden sm:inline text-xs font-bold">Testa</span>
              </button>
            )}
            
            {canDeleteDoc && onDeleteDocument && (
              <button onClick={handleDeleteDocument} className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white transition-colors flex items-center gap-1.5 shadow-sm" title="Elimina Documento">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            
            <div className="w-px h-5 bg-border mx-0.5 sm:mx-1"></div>

            <button onClick={handleCloseAndSync} className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors flex items-center gap-1.5" title="Chiudi Documento">
              <X className="w-5 h-5 sm:w-5 sm:h-5" /> <span className="hidden sm:inline text-xs font-bold">Chiudi</span>
            </button>
          </div>
        </div>


        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar min-h-0">
          
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm bg-secondary/20 p-4 rounded-xl border border-border/50">
          <InfoField 
              label="Cliente" 
              value={
                <>
                  <span className="truncate">{cliente.Ragione_Sociale}</span>
                  {clienteDisattivato && (
                    <span className="bg-red-100 text-red-600 border border-red-200 text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 uppercase" title="L'anagrafica di questo cliente è disattivata">
                      DISATTIVATO
                    </span>
                  )}
                </>
              } 
            />  
			
            <InfoField label="P.IVA / CF" value={cliente.PI || cliente.CF} />
            <InfoField label="Mod. Pagamento" value={modPagObj?.Mod || '-'} />
            <InfoField label="Magazzino" value={mag?.Descrizione || '-'} />
			
			<div>
              <span className={`block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${clienteDisattivato ? 'text-muted-foreground' : 'text-primary'}`}>Listino (Sessione)</span>
              <select 
                value={listinoNum} 
                onChange={e => setListinoNum(+e.target.value)} 
                disabled={!canEditDoc || clienteDisattivato} 
                className="w-full bg-white border border-blue-200 rounded px-2 py-1 text-xs font-bold text-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {listiniData.map((l:any) => (
                  <option key={l.id} value={l.id}>{String(l.id).padStart(2, '0')} - {l.Descrizione}</option>
                ))}
              </select>
            </div>
            <div>
              <span className={`block text-[10px] font-bold uppercase tracking-wider mb-0.5 ${clienteDisattivato ? 'text-muted-foreground' : 'text-destructive'}`}>Sconto % (Sessione)</span>
              <input 
                type="number" 
                step="0.01" 
                value={scontoCli} 
                onChange={e => setScontoCli(+e.target.value)} 
                disabled={!canEditDoc || clienteDisattivato} 
                className="w-full bg-white border border-red-200 rounded px-2 py-1 text-xs font-bold text-destructive text-right focus:outline-none focus:ring-1 focus:ring-destructive shadow-sm disabled:opacity-50 disabled:cursor-not-allowed" 
              />
            </div>

          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-bold text-foreground">Righe Documento</h4>
              <div className="flex gap-2">
                {canEditDoc && (
                  <>
                    <button onClick={() => handleOpenArticolo(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-accent text-accent-foreground hover:opacity-80 transition-opacity shadow-sm">
                      <Plus className="w-4 h-4" /> Nuovo Articolo
                    </button>
                    <button onClick={() => { setEditingRow(null); setShowRowForm(true); }} className="md:hidden flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-primary text-primary-foreground hover:opacity-90 transition-opacity shadow-sm">
                      <Plus className="w-4 h-4" /> Aggiungi Riga
                    </button>
                  </>
                )}
              </div>
            </div>

            <div className="hidden md:block overflow-x-auto rounded-xl border border-border shadow-sm pb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-table-header text-muted-foreground text-left border-b border-border">
                    <th className="px-2 py-3 font-semibold w-10 text-center">Ord.</th>
                    <th className="px-2 py-3 font-semibold w-52">Articolo <span className="text-[9px] bg-secondary px-1 py-0.5 rounded ml-1 hidden md:inline">F3 = Storico</span></th>
                    <th className="px-2 py-3 font-semibold flex-1 min-w-[200px]">Descrizione</th>
                    <th className="px-2 py-3 font-semibold text-right w-20">Q.tà</th>
                    <th className="px-2 py-3 font-semibold w-12">UM</th>
                    <th className="px-2 py-3 font-semibold text-right w-24">Prezzo</th>
                    <th className="px-2 py-3 font-semibold text-right w-16">Sc.%</th>
                    <th className="px-2 py-3 font-semibold text-right w-24">Impon.</th>
                    <th className="px-2 py-3 font-semibold text-right w-16">IVA</th>
                    <th className="px-2 py-3 font-semibold text-right w-24">Totale</th>
                    <th className="px-2 py-3 font-semibold text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {righeLoading && <tr><td colSpan={11} className="px-2 py-6 text-center text-muted-foreground">Caricamento righe...</td></tr>}
                  
                  {!righeLoading && sortedRighe.map((r) => (
                    <DesktopInlineRow 
                      key={r.ID} row={r} docId={doc.ID} aliquoteList={aliquoteData} 
                      onSave={handleSaveRow} onDelete={(id: number) => setRowToDelete(id)} 
                      isNew={false} listinoNum={listinoNum} scontoCli={scontoCli} 
                      canEdit={canEditDoc} isLocked={isLocked}
                      onOpenArticolo={handleOpenArticolo} onOpenHistory={handleOpenHistory}
                    />
                  ))}

                  {!righeLoading && canEditDoc && (
                    <DesktopInlineRow 
                      key="new-row" row={null} docId={doc.ID} aliquoteList={aliquoteData} 
                      onSave={handleSaveRow} onDelete={(id: number) => setRowToDelete(id)} 
                      isNew={true} nextOrdine={sortedRighe.length > 0 ? Math.max(...sortedRighe.map(r => Number(r.ordine || 0))) + 1 : 1}
                      listinoNum={listinoNum} scontoCli={scontoCli} 
                      canEdit={canEditDoc} isLocked={false}
                      onOpenArticolo={handleOpenArticolo} onOpenHistory={handleOpenHistory}
                    />
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-3 pb-6">
              {sortedRighe.length === 0 && <div className="p-6 text-center text-muted-foreground bg-secondary/20 rounded-xl border border-border">Nessuna riga presente</div>}
              {sortedRighe.map((r) => {
                const ali = aliquoteData.find((a: any) => Number(a.Id) === Number(r.Iva));
                return (
                  <div key={r.ID} onClick={() => { if(canEditDoc) { setEditingRow(r); setShowRowForm(true); } }} className={`bg-card rounded-xl border border-border p-4 shadow-sm transition-transform ${isLocked ? 'opacity-80' : canEditDoc ? 'active:scale-[0.98] cursor-pointer' : ''}`}>
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{r.Codart}</span>
                      <span className="text-sm font-mono font-bold text-foreground">{formatCurrency(Number(r.ttiva || 0))}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-tight mb-2">{r.Descrzione}</p>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Q.tà: <strong className="text-foreground">{r.Quant} {r.unmis}</strong></span>
                      <span>Prezzo: <strong className="text-foreground">{formatCurrency(Number(r.ImpUnit))}</strong></span>
                      <span>IVA: <strong className="text-foreground">{ali?.aliquota || 0}%</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

		{/* INIZIO FOOTER RESPONSIVE A SCOMPARSA */}
        <div className="bg-card border-t-2 border-primary/20 shrink-0 z-10 sm:rounded-b-2xl shadow-[0_-8px_30px_rgba(0,0,0,0.12)] flex flex-col">
          
          <button 
            onClick={() => setShowFooter(!showFooter)} 
            className="xl:hidden w-full flex items-center justify-center gap-2 py-2.5 bg-secondary/80 text-[11px] tracking-widest font-black text-foreground hover:bg-secondary transition-colors border-b border-border shadow-inner"
          >
            {showFooter ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            {showFooter ? 'NASCONDI TOTALI E AZIONI' : 'VISUALIZZA TOTALI E AZIONI'}
          </button>

          <div className={`${showFooter ? 'flex' : 'hidden'} xl:flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4 p-4 overflow-y-auto max-h-[35vh] xl:max-h-none custom-scrollbar`}>
		
            <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2">
              {tipoDocObj && (tipoDocObj.da === '+' || tipoDocObj.da === '-') && auth.canEdit && (
                <button 
                  onClick={() => setShowContabilizza(true)} disabled={Number(doc.registrata) !== 0}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-sm shadow-sm transition-all ${Number(doc.registrata) !== 0 ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border' : 'bg-blue-600 text-white hover:bg-blue-700 border-2 border-blue-700'}`}
                >
                  {Number(doc.registrata) !== 0 ? '✓ CONTABILIZZATO' : 'CONTABILIZZA DOC.'}
                </button>
              )}
              {tipoDocObj && (tipoDocObj.movmagaz === 'C' || tipoDocObj.movmagaz === 'S' || tipoDocObj.movmagaz === 'T') && auth.canEdit && (
                <button 
                  onClick={() => setShowMovimentaMagazzino(true)} disabled={Number(doc.caricata) !== 0}
                  className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-black text-sm shadow-sm transition-all ${Number(doc.caricata) !== 0 ? 'bg-secondary text-muted-foreground cursor-not-allowed border border-border' : 'bg-amber-500 text-white hover:bg-amber-600 border-2 border-amber-600'}`}
                >
                  {Number(doc.caricata) !== 0 ? '✓ MOVIMENTATO' : 'MOVIMENTA MAGAZZINO'}
                </button>
              )}
            </div>

            <div className="flex items-center gap-6 bg-secondary/30 px-5 py-2 rounded-xl border border-border shadow-sm w-full sm:w-auto justify-between sm:justify-start">
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">Imponibile</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatCurrency(totalImpon)}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-0.5">IVA</span>
                <span className="text-sm font-mono font-bold text-foreground">{formatCurrency(totalImposta)}</span>
              </div>
              <div className="h-8 w-px bg-border hidden sm:block mx-1"></div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider mb-0.5">Tot. Documento</span>
                <span className="text-lg font-mono font-black text-primary">{formatCurrency(totalImpon + totalImposta)}</span>
              </div>
            </div>
            
          </div>
        </div>
        {/* FINE FOOTER RESPONSIVE A SCOMPARSA */}

        {articoloModalConfig.isOpen && canEditDoc && (
          <ArticoloFormModal articolo={articoloModalConfig.articolo} onSave={(savedArt: any) => { setArticoloModalConfig({ isOpen: false, articolo: null }); if (articoloModalConfig.onSuccess) articoloModalConfig.onSuccess(savedArt); }} onClose={() => setArticoloModalConfig({ isOpen: false, articolo: null })} />
        )}

		{showRowForm && canEditDoc && (
          <RowEditForm 
            row={editingRow} 
            docId={doc.ID} 
            aliquoteList={aliquoteData} 
            nextOrdine={sortedRighe.length > 0 ? Math.max(...sortedRighe.map(r => Number(r.ordine || 0))) + 1 : 1} 
            onSave={handleSaveRow} 
            onClose={() => { setShowRowForm(false); setEditingRow(null); }} 
            listinoNum={listinoNum} 
            scontoCli={scontoCli} 
            onOpenArticolo={handleOpenArticolo} 
            onOpenHistory={handleOpenHistory} 
            // AGGIUNTO: Passiamo la funzione che chiude il form e innesca la conferma!
            onDelete={(id: number) => { 
              setShowRowForm(false); 
              setEditingRow(null); 
              setRowToDelete(id); 
            }} 
          />
        )}

		{showContabilizza && tipoDocObj && auth.canEdit && (
          <ContabilizzazioneModal doc={doc} tipoDoc={tipoDocObj} cliente={cliente} modPag={modPagObj} massInfo={massWizardInfo} onClose={() => setShowContabilizza(false)} onSuccess={() => { setShowContabilizza(false); queryClient.invalidateQueries({ queryKey: ['fatture'] }); onToggle('registrata'); setShowSuccess(true); if (massWizardInfo) massWizardInfo.onNext(); }} />
        )}
        
        {showMovimentaMagazzino && tipoDocObj && auth.canEdit && (
          <MovimentazioneMagazzinoModal doc={doc} tipoDoc={tipoDocObj} righe={sortedRighe} cliente={cliente} massInfo={massWizardInfo} onClose={() => setShowMovimentaMagazzino(false)} onSuccess={() => { setShowMovimentaMagazzino(false); queryClient.invalidateQueries({ queryKey:['fatture'] }); queryClient.invalidateQueries({ queryKey:['carichi'] }); queryClient.invalidateQueries({ queryKey: ['scarichi'] }); queryClient.invalidateQueries({ queryKey:['trasferimenti'] }); onToggle('caricata'); setShowSuccess(true); if (massWizardInfo) massWizardInfo.onNext(); }} />
        )}

        {printActionOpen && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col items-center text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">Opzioni di Stampa</h3>
              <p className="text-muted-foreground text-sm mb-6">Come desideri produrre il documento?</p>
              <div className="grid grid-cols-2 gap-4 w-full mb-4">
                <button onClick={() => handleSelectPrintMode('print')} className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-primary/20 hover:border-primary hover:bg-primary/5 transition-all text-primary">
                  <Printer className="w-10 h-10" />
                  <span className="font-bold text-sm">Stampa Diretta</span>
                </button>
                <button onClick={() => handleSelectPrintMode('pdf')} className="flex flex-col items-center gap-3 p-4 rounded-xl border-2 border-amber-500/20 hover:border-amber-500 hover:bg-amber-500/5 transition-all text-amber-600">
                  <Mail className="w-10 h-10" />
                  <span className="font-bold text-sm">PDF / Inoltra</span>
                </button>
              </div>
              <button onClick={() => setPrintActionOpen(false)} className="w-full text-muted-foreground hover:text-foreground font-bold text-sm underline-offset-4 hover:underline transition-colors py-2">
                Annulla
              </button>
            </div>
          </div>
        )}

        {pdfPromptOpen && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-card rounded-xl shadow-2xl w-full max-w-md p-6 flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Truck className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">Dati di Spedizione</h3>
              <p className="text-muted-foreground text-sm mb-6">Questo documento prevede la movimentazione merce.<br/>Vuoi compilare i dati del vettore e della destinazione?</p>
              <div className="flex flex-col gap-3 w-full">
                <button onClick={() => { setPdfPromptOpen(false); setShowTrasportoModal(true); }} className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold shadow-md transition-colors">
                  Sì, Aggiungi Dati di Trasporto
                </button>
                <button onClick={() => { setPdfPromptOpen(false); callPdfGenerator(selectedPrintMode!, null); }} className="w-full px-4 py-3 bg-secondary text-secondary-foreground border border-border rounded-lg hover:bg-secondary/80 font-bold transition-colors">
                  Procedi Senza Dati (Standard)
                </button>
                <button onClick={() => setPdfPromptOpen(false)} className="w-full mt-2 text-muted-foreground hover:text-foreground font-bold text-sm underline-offset-4 hover:underline transition-colors">
                  Annulla Operazione
                </button>
              </div>
            </div>
          </div>
        )}

        {showTrasportoModal && (
          <TrasportoModal 
            doc={doc} 
            cliente={cliente} 
            onClose={() => setShowTrasportoModal(false)} 
            onConfirm={(data: any) => {
              setShowTrasportoModal(false);
              callPdfGenerator(selectedPrintMode!, data);
            }} 
          />
        )}

        {emailData && (
          <EmailSenderModal
            pdfData={emailData}
            cliente={cliente}
            tipoDoc={tipoDocObj}
            onClose={() => setEmailData(null)}
            onSuccess={() => {
              setEmailData(null);
              setShowSuccess(true);
            }}
          />
        )}

        {historyModal.isOpen && (
          <StoricoPrezziModal 
            codart={historyModal.codart} 
            idCliente={doc.IDCliente} 
            docId={doc.ID}
            ragioneSociale={cliente.Ragione_Sociale} 
            onClose={() => setHistoryModal({ isOpen: false, codart: '' })} 
          />
        )}

        <ConfirmDialog isOpen={!!rowToDelete} title="Elimina Riga" type="danger" message={<>Sei sicuro di voler rimuovere questa riga dal documento? L'operazione non è reversibile.</>} onClose={() => setRowToDelete(null)} onConfirm={confirmDeletionRow} />
        <ConfirmDialog 
          isOpen={showDeleteConfirm} 
          title="Elimina Documento" 
          type="danger" 
          message={<>Eliminare completamente questo documento e tutte le sue righe? L'operazione non è reversibile.</>} 
          onClose={() => setShowDeleteConfirm(false)} 
          onConfirm={confirmDeleteDocument} 
          confirmLabel="Sì, elimina"
        />
        <ConfirmDialog isOpen={showSuccess} type="success-auto" title="Operazione Completata" onClose={() => setShowSuccess(false)} />

        {xmlSuccessModal.isOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/60 backdrop-blur-sm p-4 animate-fade-in">
             <div className="bg-card rounded-2xl shadow-2xl p-6 text-center border border-border">
                <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
                <h2 className="text-xl font-bold mb-4">XML Generato!</h2>
                <div className="flex gap-4">
                  <button onClick={() => setXmlSuccessModal({ isOpen: false, link: '' })} className="px-4 py-2 bg-secondary rounded-lg">Chiudi</button>
                  <button onClick={() => { window.open(xmlSuccessModal.link, '_blank'); setXmlSuccessModal({ isOpen: false, link: '' }); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg">Apri Portale</button>
                </div>
             </div>
          </div>
        )}

      </div>
    </div>
  );
};

const DesktopInlineRow = ({ row, docId, aliquoteList, onSave, onDelete, isNew, nextOrdine, listinoNum, scontoCli, isLocked, canEdit, onOpenArticolo, onOpenHistory }: any) => {
  const { data: articoliData =[] } = useArticoli();
  const { data: repartiData =[] } = useReparti();
  const trRef = useRef<HTMLTableRowElement>(null);
  
  const [form, setForm] = useState<any>(row || { IDFatt: docId, Codart: '', Descrzione: '', Quant: 1, ImpUnit: 0, sconto: 0, Iva: 1, unmis: 'PZ', ordine: nextOrdine, impon: 0, imposta: 0, ttiva: 0 });

  // --- STATI PER IL MODALE DI RICERCA VELOCE ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (!isNew && row) { setForm(row); } }, [row, isNew]);
  useEffect(() => { if (isNew) setForm((prev: any) => ({ ...prev, ordine: nextOrdine })); }, [nextOrdine, isNew]);

  // Focus automatico sulla barra di ricerca
  useEffect(() => {
    if (isSearchOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else {
      setSearchQuery('');
    }
  }, [isSearchOpen]);

  // Motore di ricerca rapido
  const filteredArticoli = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return articoliData.filter((a: any) =>
      (a.Codice || '').toLowerCase().includes(q) ||
      (a.Descrizione || '').toLowerCase().includes(q) ||
      String(a.barcode || '').toLowerCase().includes(q)
    ).slice(0, 50); // Limite a 50 risultati per fluidità
  }, [searchQuery, articoliData]);

  const recalc = (f: any) => {
    const quant = Number(f.Quant) || 0; const impUnit = Number(f.ImpUnit) || 0; const sconto = Number(f.sconto) || 0;
    const impon = Math.round(quant * impUnit * (1 - sconto / 100) * 100) / 100;
    const ali = aliquoteList.find((a: any) => Number(a.Id) === Number(f.Iva || 1));
    const imposta = Math.round(impon * (Number(ali?.aliquota) || 0) / 100 * 100) / 100;
    return { ...f, impon, imposta, ttiva: impon + imposta };
  };

  const update = (key: string, value: any) => setForm((prev: any) => recalc({ ...prev, [key]: value }));

  const handleArticleSelect = (art: any) => {
    if (!art) { 
      update('Codart', ''); 
      if (isNew) update('Descrzione', ''); 
      return; 
    }
    if (isNew) {
      const listinoKey = `Listino${listinoNum}`;
      const prezzo = Number(art[listinoKey] || art.Listino1 || 0);
      const ivaId = art.codiva || aliquoteList.find((a:any) => a.aliquota === 22)?.Id || 1;
      setForm((prev: any) => recalc({ 
        ...prev, Codart: art.Codice, Descrzione: art.Descrizione, Quant: 1, ImpUnit: prezzo, sconto: scontoCli, Iva: ivaId, unmis: art.UnMis || 'PZ' 
      }));
    } else {
      setForm((prev: any) => recalc({ ...prev, Codart: art.Codice }));
    }
  };

  const handleRowBlur = (e: React.FocusEvent) => {
    // Non salvare se stiamo interagendo con il modale di ricerca
    if (isSearchOpen) return;
    if (trRef.current && !trRef.current.contains(e.relatedTarget as Node)) {
      if (form.Descrzione && form.Descrzione.trim() !== '') {
        if (JSON.stringify(form) !== JSON.stringify(row)) {
          onSave(form);
          if (isNew) setForm({ IDFatt: docId, Codart: '', Descrzione: '', Quant: 1, ImpUnit: 0, sconto: 0, Iva: 1, unmis: 'PZ', ordine: nextOrdine + 1, impon: 0, imposta: 0, ttiva: 0 });
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F3') {
      e.preventDefault(); 
      if (form.Codart) onOpenHistory(form.Codart);
    }
  };

  const handleCodeInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const val = (form.Codart || '').trim();
      if (!val) return;
      
      // Cerca corrispondenza esatta per Codice o Barcode
      const match = articoliData.find((a: any) => 
        (a.Codice || '').toUpperCase() === val.toUpperCase() || 
        String(a.barcode || '') === val
      );

      if (match) {
        handleArticleSelect(match);
        if (e.key === 'Enter') e.preventDefault(); // Evita di far scattare altri eventi
      } else {
        // Se non trovato, apre il modale passando il testo per la ricerca
        e.preventDefault();
        setSearchQuery(val);
        setIsSearchOpen(true);
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (form.Codart) onOpenHistory(form.Codart);
    }
  };  
  
 const inputClass = `w-full bg-transparent border-b border-transparent ${isLocked || !canEdit ? '' : 'hover:border-input focus:border-primary'} focus:outline-none px-1 py-1.5 text-sm sm:text-base transition-colors`;

  return (
    <>
      <tr ref={trRef} onBlur={isLocked || !canEdit ? undefined : handleRowBlur} onKeyDown={handleKeyDown} className={`group ${isLocked || !canEdit ? '' : 'hover:bg-muted/30'} transition-colors relative`}>
        <td className="px-2 py-1"><input type="number" value={form.ordine || ''} onChange={e => update('ordine', +e.target.value)} tabIndex={-1} disabled={isLocked || !canEdit} className={`${inputClass} text-center text-xs text-muted-foreground`} /></td>
        
        <td className="px-2 py-1 relative">
          <div className="flex items-center gap-1">
            
		  {/* CELLA DI RICERCA CON INPUT MISTO BARCODE / MODALE */}
            <div className="flex-1 min-w-0 relative">
              <input
                type="text"
                value={form.Codart || ''}
                onChange={e => update('Codart', e.target.value.toUpperCase())}
                onKeyDown={handleCodeInputKey}
                disabled={isLocked || !canEdit}
                placeholder={isNew && canEdit ? "Codice o Barcode..." : "-"}
                className={`w-full pl-2 pr-8 py-1.5 rounded-md border text-sm font-mono font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${!isLocked && canEdit ? 'bg-white text-primary border-blue-300 hover:border-blue-500' : 'bg-transparent border-transparent text-muted-foreground'}`}
              />
              {!isLocked && canEdit && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSearchQuery(form.Codart || ''); setIsSearchOpen(true); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-blue-500 hover:text-blue-700 bg-white rounded cursor-pointer"
                  title="Apri Ricerca Avanzata"
                >
                  <Search className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

           {!isLocked && canEdit && (
              <button type="button" onClick={(e) => { e.stopPropagation(); const currentCode = (form.Codart || '').trim().toLowerCase(); const art = articoliData.find((a: any) => (a.Codice || '').trim().toLowerCase() === currentCode) || null; onOpenArticolo(art, (savedArt: any) => handleArticleSelect(savedArt)); }} className="p-1.5 rounded-md bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white transition-colors shrink-0 shadow-sm" title="Apri Scheda Articolo">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </td>
        
        <td className="px-2 py-1"><input type="text" value={form.Descrzione || ''} onChange={e => update('Descrzione', e.target.value)} disabled={isLocked || !canEdit} className={`${inputClass} font-medium`} placeholder={isNew && canEdit ? "Descrizione manuale..." : ""} /></td>
        <td className="px-2 py-1"><input type="number" step="0.01" value={form.Quant || ''} onChange={e => update('Quant', +e.target.value)} disabled={isLocked || !canEdit} className={`${inputClass} text-right font-mono font-bold`} /></td>
        <td className="px-2 py-1"><select value={form.unmis || 'PZ'} onChange={e => update('unmis', e.target.value)} tabIndex={-1} disabled={isLocked || !canEdit} className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer text-muted-foreground appearance-none">{['PZ', 'MT', 'KG', 'LT', 'CF', 'MQ', 'ML', 'NR'].map(u => <option key={u}>{u}</option>)}</select></td>
        <td className="px-2 py-1"><input type="number" step="0.01" value={form.ImpUnit || ''} onChange={e => update('ImpUnit', +e.target.value)} disabled={isLocked || !canEdit} className={`${inputClass} text-right font-mono`} /></td>
        <td className="px-2 py-1"><input type="number" step="0.01" value={form.sconto || ''} onChange={e => update('sconto', +e.target.value)} disabled={isLocked || !canEdit} className={`${inputClass} text-right font-mono text-destructive`} /></td>
        <td className="px-2 py-1 text-right text-mono text-muted-foreground">{formatCurrency(form.impon || 0)}</td>
        <td className="px-2 py-1"><select value={form.Iva || 1} onChange={e => update('Iva', +e.target.value)} tabIndex={-1} disabled={isLocked || !canEdit} className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer w-full text-muted-foreground text-right appearance-none">{aliquoteList.map((a: any) => <option key={a.Id} value={a.Id}>{a.aliquota}%</option>)}</select></td>
        <td className="px-2 py-1 text-right text-mono font-bold text-foreground">{formatCurrency(form.ttiva || 0)}</td>
        <td className="px-2 py-1 text-center">{!isNew && !isLocked && canEdit && <button onClick={() => onDelete(form.ID)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive opacity-0 group-hover:opacity-100 transition-opacity" title="Elimina Riga"><Trash2 className="w-4 h-4" /></button>}</td>
      </tr>

      {/* MODALE DI RICERCA ARTICOLO (PORTAL) */}
      {isSearchOpen && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4 animate-fade-in" onClick={() => setIsSearchOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden border border-border animate-scale-in" onClick={e => e.stopPropagation()}>
            
            <div className="p-4 border-b border-border bg-slate-50 flex items-center gap-3">
              <Search className="w-6 h-6 text-blue-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredArticoli.length > 0) { handleArticleSelect(filteredArticoli[0]); setIsSearchOpen(false); }
                  }
                  if (e.key === 'Escape') setIsSearchOpen(false);
                }}
                placeholder="Cerca per Codice, Barcode o Descrizione (Premi Invio per selezionare il primo risultato)..."
                className="flex-1 bg-transparent border-none focus:outline-none text-base sm:text-lg font-medium text-slate-800 placeholder:text-slate-400"
              />
              <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-red-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400 hover:text-red-500" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
              {searchQuery.trim().length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-2">
                  <Search className="w-10 h-10 opacity-20" />
                  Inizia a digitare per cercare nel catalogo...
                </div>
              ) : filteredArticoli.length === 0 ? (
                <div className="p-12 text-center text-red-400 font-medium">Nessun articolo corrispondente trovato.</div>
              ) : (
			  
			  <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm text-[10px] sm:text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Codice</th>
                      <th className="px-4 py-2">Descrizione</th>
                      <th className="px-4 py-2 text-center hidden sm:table-cell">Reparto</th>
                      <th className="px-4 py-2 text-right">Prezzo (List. {listinoNum})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredArticoli.map((art: any) => {
                      // Legge dinamicamente il prezzo in base al listino assegnato al cliente
                      const prezzoListino = Number(art[`Listino${listinoNum}`] || art.Listino1 || 0);
                      
                      return (
                        <tr key={art.id || art.Codice} onClick={() => { handleArticleSelect(art); setIsSearchOpen(false); }} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                          <td className="px-4 py-3 font-mono font-bold text-blue-700 group-hover:text-blue-800">{art.Codice}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 leading-tight">{art.Descrizione}</td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500 hidden sm:table-cell">{repartiData.find((r:any) => Number(r.id) === Number(art.reparto))?.descrizione || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(prezzoListino)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
			  
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const RowEditForm = ({ row, docId, aliquoteList, nextOrdine, onSave, onClose, listinoNum, scontoCli, onOpenArticolo, onOpenHistory, onDelete }: any) => {
  const isEdit = !!row;
  const { data: articoliData = [] } = useArticoli();
  const { data: repartiData = [] } = useReparti();

  const [form, setForm] = useState<any>(row || { IDFatt: docId, Codart: '', Descrzione: '', Quant: 1, ImpUnit: 0, sconto: 0, Iva: 1, unmis: 'PZ', ordine: nextOrdine, impon: 0, imposta: 0, ttiva: 0, Magazz: 1 });

  // --- STATI RICERCA ---
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
    else setSearchQuery('');
  }, [isSearchOpen]);

  const filteredArticoli = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return articoliData.filter((a: any) =>
      (a.Codice || '').toLowerCase().includes(q) ||
      (a.Descrizione || '').toLowerCase().includes(q) ||
      String(a.barcode || '').toLowerCase().includes(q)
    ).slice(0, 50); 
  }, [searchQuery, articoliData]);

  const recalc = (f: any) => {
    const quant = Number(f.Quant) || 0; const impUnit = Number(f.ImpUnit) || 0; const sconto = Number(f.sconto) || 0;
    const impon = Math.round(quant * impUnit * (1 - sconto / 100) * 100) / 100;
    const ali = aliquoteList.find((a: any) => Number(a.Id) === Number(f.Iva || 1));
    const imposta = Math.round(impon * (Number(ali?.aliquota) || 0) / 100 * 100) / 100;
    return { ...f, impon, imposta, ttiva: impon + imposta };
  };

  const update = (key: string, value: any) => setForm((prev: any) => recalc({ ...prev, [key]: value }));

  const handleArticleSelect = (art: any) => {
    if (!art) { 
      update('Codart', ''); 
      if (!isEdit) update('Descrzione', ''); 
      return; 
    }
    if (!isEdit) {
      const listinoKey = `Listino${listinoNum}`;
      const prezzo = Number(art[listinoKey] || art.Listino1 || 0);
      const ivaId = art.codiva || aliquoteList.find((a:any) => a.aliquota === 22)?.Id || 1;
      setForm((prev: any) => recalc({ 
        ...prev, Codart: art.Codice, Descrzione: art.Descrizione, Quant: 1, ImpUnit: prezzo, sconto: scontoCli, Iva: ivaId, unmis: art.UnMis || 'PZ' 
      }));
    } else {
      setForm((prev: any) => recalc({ ...prev, Codart: art.Codice }));
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(recalc(form)); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F3') {
      e.preventDefault(); 
      if (form.Codart) onOpenHistory(form.Codart);
    }
  };

  const handleCodeInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      const val = (form.Codart || '').trim();
      if (!val) return;
      
      const match = articoliData.find((a: any) => 
        (a.Codice || '').toUpperCase() === val.toUpperCase() || 
        String(a.barcode || '') === val
      );

      if (match) {
        handleArticleSelect(match);
        if (e.key === 'Enter') e.preventDefault(); 
      } else {
        e.preventDefault();
        setSearchQuery(val);
        setIsSearchOpen(true);
      }
    } else if (e.key === 'F3') {
      e.preventDefault();
      if (form.Codart) onOpenHistory(form.Codart);
    }
  };
  
  
  
  const inputClass = "w-full px-3 py-2.5 rounded-lg border border-input bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50";

  return (
    <>
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
        <div onClick={e => e.stopPropagation()} className="bg-card sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-fade-up sm:animate-fade-in">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
            <h3 className="text-lg font-bold text-foreground">{isEdit ? 'Modifica Riga' : 'Nuova Riga'}</h3>
            <button onClick={onClose} className="p-2 rounded-full bg-secondary hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"><X className="w-5 h-5" /></button>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="p-6 space-y-5 overflow-y-auto flex-1 custom-scrollbar">
            
            <div className="relative">
              <div className="flex justify-between items-end mb-1.5">
                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider">Articolo <span className="text-[9px] bg-secondary px-1 py-0.5 rounded ml-1 text-primary">F3 = Storico</span></label>
                
                <div className="flex gap-2">
                  {form.Codart && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenHistory(form.Codart); }} className="flex items-center gap-1 text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-1.5 py-0.5 rounded hover:bg-purple-600 hover:text-white transition-colors shadow-sm">
                      <History className="w-3 h-3" /> STORICO (F3)
                    </button>
                  )}
                  <button type="button" onClick={(e) => { e.stopPropagation(); const currentCode = (form.Codart || '').trim().toLowerCase(); const art = articoliData.find((a: any) => (a.Codice || '').trim().toLowerCase() === currentCode) || null; onOpenArticolo(art, (savedArt: any) => handleArticleSelect(savedArt)); }} className="flex items-center gap-1 text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded hover:bg-blue-600 hover:text-white transition-colors shadow-sm">
                    <Pencil className="w-3 h-3" /> APRI SCHEDA
                  </button>
                </div>
              </div>
              
			 {/* CAMPO DI RICERCA CON INPUT MISTO BARCODE / MODALE */}
              <div className="relative w-full">
                <input
                  type="text"
                  value={form.Codart || ''}
                  onChange={e => update('Codart', e.target.value.toUpperCase())}
                  onKeyDown={handleCodeInputKey}
                  placeholder="Codice o Barcode (Invio/Tab per caricare, oppure clicca la lente)..."
                  className="w-full pl-3 pr-10 py-2.5 rounded-lg border border-blue-300 bg-white text-primary text-sm font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 hover:border-blue-500 transition-colors shadow-sm"
                />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSearchQuery(form.Codart || ''); setIsSearchOpen(true); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md cursor-pointer transition-colors"
                  title="Apri Ricerca Avanzata"
                >
                  <Search className="w-4 h-4" />
                </button>
              </div>

            </div>

            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Codice</label><input type="text" value={form.Codart || ''} onChange={e => update('Codart', e.target.value)} className={`${inputClass} font-mono font-bold`} /></div>
              <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">UM</label><select value={form.unmis || 'PZ'} onChange={e => update('unmis', e.target.value)} className={inputClass}>{['PZ', 'MT', 'KG', 'LT', 'CF', 'MQ', 'ML', 'NR'].map(u => <option key={u}>{u}</option>)}</select></div>
            </div>
            <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Descrizione</label><input type="text" value={form.Descrzione || ''} onChange={e => update('Descrzione', e.target.value)} className={inputClass} required /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Quantità</label><input type="number" step="0.01" value={form.Quant ?? 1} onChange={e => update('Quant', +e.target.value)} className={`${inputClass} text-right font-mono font-bold text-lg`} /></div>
              <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Prezzo Unit.</label><input type="number" step="0.01" value={form.ImpUnit ?? 0} onChange={e => update('ImpUnit', +e.target.value)} className={`${inputClass} text-right font-mono`} /></div>
              <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Sconto %</label><input type="number" step="0.01" value={form.sconto ?? 0} onChange={e => update('sconto', +e.target.value)} className={`${inputClass} text-right font-mono text-destructive`} /></div>
              <div><label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Aliquota IVA</label><select value={form.Iva ?? 1} onChange={e => update('Iva', +e.target.value)} className={inputClass}>{aliquoteList.map((a: any) => <option key={a.Id} value={a.Id}>{a.aliquota}%</option>)}</select></div>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 mt-2">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Imponibile</span><span className="font-mono font-medium">{formatCurrency(form.impon || 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Imposta</span><span className="font-mono font-medium">{formatCurrency(form.imposta || 0)}</span></div>
              <div className="flex justify-between text-base border-t border-primary/20 pt-2 mt-2"><span className="font-bold uppercase tracking-wider">Totale</span><span className="font-mono font-black text-primary">{formatCurrency(form.ttiva || 0)}</span></div>
            </div>

			{/* FOOTER DEL MODALE CON TASTO ELIMINA */}
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 pt-5 mt-2 border-t border-border">
              
              {/* LATO SINISTRO: Tasto Elimina (Visibile solo se la riga esiste già) */}
              <div className="w-full sm:w-auto">
                {isEdit && onDelete && (
                  <button 
                    type="button" 
                    onClick={() => onDelete(form.ID)} 
                    className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg bg-red-50 text-red-600 text-sm font-bold hover:bg-red-100 transition-colors border border-red-200 shadow-sm"
                  >
                    <Trash2 className="w-4 h-4" /> Elimina Riga
                  </button>
                )}
              </div>
              
              {/* LATO DESTRO: Annulla e Salva */}
              <div className="flex gap-2 w-full sm:w-auto">
                <button type="button" onClick={onClose} className="flex-1 sm:flex-none px-5 py-2.5 rounded-lg border border-input text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">
                  Annulla
                </button>
                <button type="submit" className="flex-[2] sm:flex-none px-6 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity shadow-sm">
                  Salva Riga
                </button>
              </div>

            </div>

          </form>
        </div>
      </div>

      {/* MODALE DI RICERCA ARTICOLO PER LA VERSIONE MOBILE (PORTAL) */}
      {isSearchOpen && createPortal(
        <div className="fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-16 sm:pt-24 p-4 animate-fade-in" onClick={() => setIsSearchOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden border border-border animate-scale-in" onClick={e => e.stopPropagation()}>
            
            <div className="p-4 border-b border-border bg-slate-50 flex items-center gap-3">
              <Search className="w-6 h-6 text-blue-500 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (filteredArticoli.length > 0) { handleArticleSelect(filteredArticoli[0]); setIsSearchOpen(false); }
                  }
                  if (e.key === 'Escape') setIsSearchOpen(false);
                }}
                placeholder="Cerca per Codice, Barcode o Descrizione (Invio seleziona il primo)..."
                className="flex-1 bg-transparent border-none focus:outline-none text-base sm:text-lg font-medium text-slate-800 placeholder:text-slate-400"
              />
              <button onClick={() => setIsSearchOpen(false)} className="p-2 hover:bg-red-100 rounded-xl transition-colors">
                <X className="w-6 h-6 text-slate-400 hover:text-red-500" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto custom-scrollbar bg-white">
              {searchQuery.trim().length === 0 ? (
                <div className="p-12 text-center text-slate-400 font-medium flex flex-col items-center gap-2">
                  <Search className="w-10 h-10 opacity-20" />
                  Inizia a digitare per cercare nel catalogo...
                </div>
              ) : filteredArticoli.length === 0 ? (
                <div className="p-12 text-center text-red-400 font-medium">Nessun articolo corrispondente trovato.</div>
              ) : (

			  <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 shadow-sm text-[10px] sm:text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-2">Codice</th>
                      <th className="px-4 py-2">Descrizione</th>
                      <th className="px-4 py-2 text-center hidden sm:table-cell">Reparto</th>
                      <th className="px-4 py-2 text-right">Prezzo (List. {listinoNum})</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredArticoli.map((art: any) => {
                      const prezzoListino = Number(art[`Listino${listinoNum}`] || art.Listino1 || 0);
                      
                      return (
                        <tr key={art.id || art.Codice} onClick={() => { handleArticleSelect(art); setIsSearchOpen(false); }} className="hover:bg-blue-50 cursor-pointer transition-colors group">
                          <td className="px-4 py-3 font-mono font-bold text-blue-700 group-hover:text-blue-800">{art.Codice}</td>
                          <td className="px-4 py-3 font-medium text-slate-700 leading-tight">{art.Descrizione}</td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500 hidden sm:table-cell">{repartiData.find((r:any) => Number(r.id) === Number(art.reparto))?.descrizione || '-'}</td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">{formatCurrency(prezzoListino)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
			  
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const StoricoPrezziModal = ({ codart, idCliente, docId, ragioneSociale, onClose }: any) => {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_HOST}/api.php?action=get_storico_prezzi&codart=${encodeURIComponent(codart)}&idcliente=${idCliente}&iddoc=${docId}`);
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : []);
      } catch (e) {
      } finally { setLoading(false); }
    };
    load();
  }, [codart, idCliente, docId]);

  const formatDate = (d: string) => { if (!d) return '-'; const p = d.split('-'); return p.length >= 3 ? `${p[2]}/${p[1]}/${p[0]}` : d; };

  return (
    <div className="fixed inset-0 bg-foreground/60 backdrop-blur-sm z-[400] flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-card w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-border" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border bg-slate-800 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/20 p-2 rounded-lg"><History className="w-5 h-5 text-blue-300" /></div>
            <div>
              <h3 className="text-lg font-bold">Storico Prezzi: <span className="text-blue-300 uppercase">{codart}</span></h3>
              <p className="text-xs text-slate-300 font-medium truncate max-w-xs sm:max-w-md">{ragioneSociale}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors"><X className="w-5 h-5"/></button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-0 custom-scrollbar bg-slate-50">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground font-bold">Ricerca storico in corso...</div>
          ) : history.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
              Nessun movimento precedente trovato per questo articolo.
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground font-bold sticky top-0 border-b border-border shadow-sm">
                <tr>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Documento</th>
                  <th className="px-4 py-3 text-right">Q.tà</th>
                  <th className="px-4 py-3 text-right">Prezzo Unit.</th>
                  <th className="px-4 py-3 text-right">Sconto</th>
                  <th className="px-4 py-3 text-right text-primary">Netto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h, i) => {
                  const netto = Number(h.ImpUnit) * (1 - (Number(h.sconto) || 0) / 100);
                  return (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-2.5 font-medium whitespace-nowrap">{formatDate(h.datafatt)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{h.tipoDesc} n. {h.Num}</td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold">{Number(h.Quant).toLocaleString('it-IT')}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">{formatCurrency(h.ImpUnit)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-destructive">{Number(h.sconto) > 0 ? `${h.sconto}%` : '-'}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-primary font-bold">{formatCurrency(netto)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default DocumentDetail;