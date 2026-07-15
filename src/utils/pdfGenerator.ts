import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { API_HOST } from '@/config';

const formatCurrency = (n: number) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
const formatDataPDF = (d: string) => { if (!d) return '-'; const p = d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };

export const generateSuperPDF = async (options: any) => {
  const { mode, transportData, doc, cliente, righe, aliquoteData, mezziData, modPagObj, azienda, tipoDocObj, printWindow: providedPrintWindow } = options;

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const marginX = 10; 
  const usableW = pageW - marginX * 2;

  let printWindow: Window | null = null;
  if (mode === 'print') {
    printWindow = (providedPrintWindow as Window | null) || null;
    if (!printWindow) {
      try {
        printWindow = window.open('about:blank', '_blank');
      } catch {
        printWindow = null;
      }
    }
    if (printWindow && printWindow.document) {
      try {
        printWindow.document.open();
        printWindow.document.write("<!doctype html><html><head><meta charset='utf-8'/><meta name='viewport' content='width=device-width,initial-scale=1'/><title>PDF</title></head><body style='font-family:Arial,sans-serif;padding:16px'>Generazione PDF in corso...</body></html>");
        printWindow.document.close();
      } catch {}
    }
  }

  const showLogo = mode === 'pdf' || Number(azienda?.stampalogo) === -1;
  const logoW = Number(azienda?.larg || 5) * 10; 
  const logoH = Number(azienda?.alt || 2.5) * 10; 
  const marginInches = mode === 'print' ? Number(azienda?.piepag || 0) : Number(azienda?.piepag2 || 0);
  const bottomMarginMM = marginInches * 25.4;

  const docYear = doc.datafatt ? doc.datafatt.split('-')[0] : new Date().getFullYear();
  const docSuffix = tipoDocObj?.suffisso ? `/${tipoDocObj.suffisso.trim()}` : '';
  const fullNumDoc = `${doc.Num}${docSuffix} / ${docYear}`; 

  // --- CARICAMENTO IMMAGINI ---
  let imgLogo: HTMLImageElement | null = null;
  let imgSottoLogo: HTMLImageElement | null = null;
  try {
    const loadImg = (path: string) => new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image(); img.src = path;
      img.onload = () => resolve(img); img.onerror = () => reject();
    });
    const promises = [];
    if (showLogo) {
      promises.push(loadImg(import.meta.env.BASE_URL + 'logo.png').then(i => imgLogo = i).catch(()=>{}));
      promises.push(loadImg(import.meta.env.BASE_URL + 'sotto_logo.png').then(i => imgSottoLogo = i).catch(()=>{}));
    }
    await Promise.all(promises);
  } catch (e) {}

  // --- FUNZIONE: DISEGNO GRIGLIE INTESTAZIONE ---
  const drawMiniTable = (y: number, heads: string[], body: string[], widths: number[]) => {
    const fitText = (text: string, maxW: number, fontSize: number, fontStyle: 'normal' | 'bold') => {
      const raw = (text ?? '').toString();
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', fontStyle);
      if (raw === '') return '';
      if (pdf.getTextWidth(raw) <= maxW) return raw;
      let t = raw;
      while (t.length > 0 && pdf.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1);
      return t.length > 0 ? `${t}…` : '…';
    };

    pdf.setDrawColor(0); pdf.setLineWidth(0.2);
    pdf.setFillColor(240, 240, 240);
    pdf.rect(marginX, y, usableW, 5, 'FD'); 
    pdf.rect(marginX, y + 5, usableW, 6, 'S'); 

    let currentX = marginX;
    for (let i = 0; i < heads.length; i++) {
      pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
      pdf.text(fitText(heads[i], widths[i] - 2, 7, 'bold'), currentX + widths[i] / 2, y + 3.5, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.text(fitText(body[i] || '', widths[i] - 2, 7, 'normal'), currentX + widths[i] / 2, y + 9, { align: 'center' });

      if (i < heads.length - 1) {
        currentX += widths[i];
        pdf.line(currentX, y, currentX, y + 11);
      }
    }
    return y + 11;
  };

  // --- HEADER GLOBALE (Ripetuto su ogni pagina) ---
  const drawHeader = (data?: any) => {
    if (imgLogo) {
      pdf.addImage(imgLogo, 'PNG', marginX, 10, logoW, logoH);
    }

    const boxX = 100;
    const boxW = pageW - boxX - marginX; 
    const boxH = 25; 
    pdf.setDrawColor(0); pdf.setLineWidth(0.2);

    const destY = 10; 
    const spettY = destY + boxH + 4; 

    let hasDestinazione = transportData && (transportData.Destinazione1 || transportData.Destinazione2 || transportData.Destinazione3);

    if (hasDestinazione) {
      pdf.rect(boxX, destY, boxW, boxH); 
      pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
      pdf.text('Destinazione Merce', boxX + 3, destY + 5); 
      pdf.setFont('helvetica', 'normal');
      let dy = destY + 10;
      if (transportData.Destinazione1) { pdf.text(transportData.Destinazione1, boxX + 3, dy); dy += 4; }
      if (transportData.Destinazione2) { pdf.text(transportData.Destinazione2, boxX + 3, dy); dy += 4; }
      if (transportData.Destinazione3) { pdf.text(transportData.Destinazione3, boxX + 3, dy); }
    }

    pdf.rect(boxX, spettY, boxW, boxH);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
    pdf.text('Spett.le', boxX + 3, spettY + 5); 
    pdf.setFontSize(9);
    pdf.text(cliente.Ragione_Sociale, boxX + 3, spettY + 11);
    pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
    pdf.text(cliente.Indirizzo, boxX + 3, spettY + 16);
    pdf.text(`${cliente.CAP} - ${cliente.Comune} (${cliente.Prov})`, boxX + 3, spettY + 20);

    const isFiscale = tipoDocObj?.da === '+' || tipoDocObj?.da === '-';
    const docTitle = (isFiscale && transportData) ? 'FATTURA ACCOMPAGNATORIA' : (tipoDocObj?.descrizione || 'DOCUMENTO').toUpperCase();
    
    let yCursor = Math.max(10 + logoH, spettY + boxH) + 6; 
    
    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold'); pdf.setTextColor(0);
    pdf.text(docTitle, marginX, yCursor);
    
    const pageNum = data ? data.pageNumber : pdf.internal.getNumberOfPages();
    pdf.setFontSize(8);
    pdf.text(`Pag. ${pageNum} di {total_pages_count_string}`, pageW - marginX, yCursor, { align: 'right' });
    yCursor += 3;

    const calcWidth = (text: string, fontSize: number, minW: number, maxW: number) => {
      const raw = (text ?? '').toString();
      pdf.setFontSize(fontSize);
      pdf.setFont('helvetica', 'normal');
      const w = (raw ? pdf.getTextWidth(raw) : 0) + 6;
      return Math.max(minW, Math.min(maxW, w));
    };

    let wNum = 25;
    let wData = 20;
    let wRif = 20;
    const wPiva = calcWidth(String(cliente.PI || ''), 7, 22, 30);
    const wCf = calcWidth(String(cliente.CF || ''), 7, 26, 40);
    let wNote = usableW - (wNum + wData + wRif + wPiva + wCf);
    if (wNote < 40) {
      const reducible = Math.max(0, wRif - 16);
      const delta = Math.min(40 - wNote, reducible);
      wRif -= delta;
      wNote += delta;
    }
    const w1 = [wNum, wData, wRif, wPiva, wCf, wNote];
    yCursor = drawMiniTable(yCursor, 
      ['Num', 'Data', 'Rif. DDT', 'Part. IVA', 'Cod. Fiscale', 'Note'], 
      [fullNumDoc, formatDataPDF(doc.datafatt), doc.RifDdt || '', cliente.PI, cliente.CF, doc.Note || ''], 
      w1
    );

    const bancaDesc = mezziData.find((m: any) => Number(m.cod) === Number(modPagObj?.riba))?.descrizione || '';
    const w2 = [50, 60, usableW - 110];
    yCursor = drawMiniTable(yCursor + 2, 
      ['Modalità di Pagamento', 'Banca d\'appoggio', 'IBAN'], 
      [modPagObj?.Mod || '', bancaDesc, doc.IBAN || '-'], 
      w2
    );

    return yCursor + 4; 
  };

  // --- FOOTER GLOBALE (Ripetuto su ogni pagina) ---
  const hSottoLogo = imgSottoLogo ? 15 : 0;
  const hBaseFooter = hSottoLogo; 

  const drawBaseFooter = () => {
    if (imgSottoLogo) {
      try {
        pdf.addImage(imgSottoLogo, 'PNG', marginX, pageH - bottomMarginMM - hSottoLogo, usableW, hSottoLogo);
      } catch (e) {}
    }
  };

  // --- DOWNLOAD E PRECALCOLO ANNOTAZIONI DINAMICHE ---
  let annotazioniText = '';
  try {
    const resAnn = await fetch(`${API_HOST}/api.php?action=get_annotazioni`);
    const dataAnn = await resAnn.json();
    
    if (Array.isArray(dataAnn)) {
      const activeAnnotations = dataAnn.filter(a => {
        const matchTipo = Number(a.idtipodoc) === 0 || Number(a.idtipodoc) === Number(doc.Tipo);
        const matchCliente = Number(a.idcliente) === 0 || Number(a.idcliente) === Number(doc.IDCliente);
        const isSenzaScadenza = !a.scadenza || String(a.scadenza).trim() === '' || a.scadenza === '0000-00-00';
        const matchScadenza = isSenzaScadenza || new Date(a.scadenza) >= new Date(doc.datafatt);
        return matchTipo && matchCliente && matchScadenza;
      });
      annotazioniText = activeAnnotations.map(a => a.testo).join('\n\n');
    }
  } catch (e) {
    console.error("Errore recupero annotazioni:", e);
  }

  const finalLegalText = annotazioniText !== '' ? annotazioniText : '';

  pdf.setFontSize(7.5); pdf.setFont('helvetica', 'italic');
  const hLegalText = finalLegalText !== '' ? pdf.getTextDimensions(finalLegalText, { maxWidth: usableW }).h : 0;

  // 1. INIZIALIZZAZIONE PRIMA PAGINA E CORPO DOCUMENTO
  const startY = drawHeader();

  const totalImpon = righe.reduce((s: number, r: any) => s + Number(r.impon || 0), 0);
  const totalImposta = righe.reduce((s: number, r: any) => s + Number(r.imposta || 0), 0);

  const tableBody = righe.map((r: any) => {
    const ali = aliquoteData.find((a: any) => Number(a.Id) === Number(r.Iva));
    return [
      r.Descrzione, 
      `${Number(r.Quant).toLocaleString('it-IT', { minimumFractionDigits: 2 })} ${(r.unmis || '').toLowerCase()}`,
      formatCurrency(Number(r.ImpUnit)).replace('€', '').trim(), 
      Number(r.sconto) > 0 ? `${r.sconto}%` : '', 
      ali?.aliquota || '0', 
      formatCurrency(Number(r.impon)).replace('€', '').trim(), 
      formatCurrency(Number(r.imposta)).replace('€', '').trim(), 
      formatCurrency(Number(r.ttiva)).replace('€', '').trim()
    ];
  });

  autoTable(pdf, {
    startY: startY,
    margin: { top: startY, left: marginX, right: marginX, bottom: bottomMarginMM + hBaseFooter + 8 }, 
    theme: 'plain', 
    headStyles: { fillColor: [255, 255, 255], textColor: 0, fontStyle: 'bold', fontSize: 7, cellPadding: 1 },
    bodyStyles: { fontSize: 7, cellPadding: 1 }, 
    columnStyles: { 
      0: { cellWidth: 'auto' }, 
      1: { cellWidth: 15, halign: 'right' }, 
      2: { cellWidth: 16, halign: 'right' }, 
      3: { cellWidth: 10, halign: 'center' }, 
      4: { cellWidth: 10, halign: 'center' }, 
      5: { cellWidth: 18, halign: 'right' }, 
      6: { cellWidth: 15, halign: 'right' }, 
      7: { cellWidth: 18, halign: 'right', fontStyle: 'bold' } 
    },
    head: [['Descrizione', 'Q.tà', 'Prezzo', 'sc%', 'Iva', 'Impon.', 'Iva €', 'Totali']],
    body: tableBody,
    didParseCell: function(data) {
      if (data.section === 'head' && data.column.index >= 1) data.cell.styles.halign = 'right';
    },
    willDrawCell: function(data) {
      pdf.setDrawColor(0); pdf.setLineWidth(0.2);
      if (data.section === 'head') {
        pdf.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y);
        pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    },
    didDrawPage: function(data) {
      if (data.pageNumber > 1) {
        drawHeader(data);
      }
      drawBaseFooter();
    }
  });


  // =========================================================================
  // 2. CALCOLO DINAMICO SPAZI FINALI (TRASPORTO E RIEPILOGO IVA)
  // =========================================================================

  // FIX: hasNote deve dipendere ESCLUSIVAMENTE dalla presenza della nota, ignorando il mode!
  const hasNote = transportData && transportData.noteExtra && transportData.noteExtra.trim() !== '';
  const hTrasporto = transportData ? (hasNote ? 36 : 28) : 0;

  // PRE-CALCOLO RIGHE IVA
  const vatSummary: Record<string, { imponibile: number, imposta: number, totale: number }> = {};
  righe.forEach((r: any) => {
    const ali = aliquoteData.find((a: any) => Number(a.Id) === Number(r.Iva));
    const vatName = ali ? `${ali.aliquota}%` : '0%';
    if (!vatSummary[vatName]) vatSummary[vatName] = { imponibile: 0, imposta: 0, totale: 0 };
    vatSummary[vatName].imponibile += Number(r.impon || 0);
    vatSummary[vatName].imposta += Number(r.imposta || 0);
    vatSummary[vatName].totale += Number(r.ttiva || 0);
  });

  const vatBody = Object.entries(vatSummary).map(([name, vals]) => [
    name, 
    formatCurrency(vals.imponibile).replace('€', '').trim(), 
    formatCurrency(vals.imposta).replace('€', '').trim(), 
    formatCurrency(vals.totale).replace('€', '').trim()
  ]);
  vatBody.push(['Totali', formatCurrency(totalImpon).replace('€', '').trim(), formatCurrency(totalImposta).replace('€', '').trim(), formatCurrency(totalImpon + totalImposta).replace('€', '').trim()]);

  // FIX ALTEZZA DINAMICA INFALLIBILE
  // Usando cellPadding 0.6, calcoliamo altezza di ogni riga e aggiungiamo lo spazio titoli
  const hRiepilogo = ((vatBody.length + 1) * 4.2) + 4; 
  
  const requiredLastPageSpace = hTrasporto + hRiepilogo + 5;

  // --- STAMPA DELLE ANNOTAZIONI DINAMICHE ---
  let finalY = (pdf as any).lastAutoTable.finalY + 5; 
  if (finalLegalText !== '') {
    const available = pageH - bottomMarginMM - hBaseFooter - 2 - finalY;
    if (available < (hLegalText + requiredLastPageSpace + 2)) {
      pdf.addPage();
      const headerY = drawHeader({ pageNumber: pdf.internal.getNumberOfPages() });
      drawBaseFooter();
      finalY = headerY + 2;
    }
    pdf.setFontSize(7.5); pdf.setFont('helvetica', 'italic'); pdf.setTextColor(60, 60, 60);
    pdf.text(finalLegalText, marginX, finalY, { maxWidth: usableW });
    pdf.setTextColor(0);
    finalY += hLegalText;
  }

  // --- CALCOLO SPAZIO PER IL FOOTER FINALE ---
  if (pageH - bottomMarginMM - hBaseFooter - finalY < requiredLastPageSpace) {
    pdf.addPage();
    drawHeader();
    drawBaseFooter();
  }

  let currentBottomY = pageH - bottomMarginMM - hBaseFooter - 2;

  // --- STAMPA TRASPORTO ---
  if (transportData) {
    currentBottomY -= hTrasporto;
    const tY = currentBottomY;

    pdf.setDrawColor(0); pdf.setLineWidth(0.2);
    pdf.rect(marginX, tY, usableW, hTrasporto);

    pdf.line(75, tY, 75, tY + (hasNote ? 28 : hTrasporto)); 
    pdf.line(140, tY, 140, tY + (hasNote ? 28 : hTrasporto)); 
    pdf.line(marginX, tY + 16, 140, tY + 16); 
    if (hasNote) pdf.line(marginX, tY + 28, pageW - marginX, tY + 28); 

    const lbl = (txt: string, x: number, y: number) => { pdf.setFontSize(5); pdf.setFont('helvetica', 'bold'); pdf.text(txt, x, y); };
    const val = (txt: string, x: number, y: number) => { pdf.setFontSize(7); pdf.setFont('helvetica', 'bold'); pdf.text(txt, x, y); };
    const valN = (txt: string, x: number, y: number) => { pdf.setFontSize(7); pdf.setFont('helvetica', 'normal'); pdf.text(txt, x, y); };

    lbl('VETTORE', marginX + 2, tY + 4); valN(transportData.vettore, marginX + 2, tY + 7.5);
    lbl('PORTO', marginX + 2, tY + 11.5); valN(transportData.porto, marginX + 2, tY + 14.5);
    lbl('N. COLLI', marginX + 2, tY + 20); val(transportData.colli, marginX + 15, tY + 22);
    lbl('PESO', 35, tY + 20); val(transportData.peso, 45, tY + 22);

    lbl('ASPETTO ESTERIORE DEI BENI', 77, tY + 4); valN(transportData.aspetto, 77, tY + 7.5);
    lbl('DATA E ORA INIZIO TRASPORTO', 77, tY + 20); val(`${formatDataPDF(transportData.dataRitiro)} ${transportData.oraRitiro}`, 115, tY + 22);

    lbl('FIRMA CONDUCENTE / INCARICATO', 142, tY + 4);
    if (transportData.firma) val(transportData.firma, 142, tY + 7.5);
    lbl('FIRMA DESTINATARIO', 142, tY + 14);

    if (hasNote) {
      lbl('NOTE EXTRA', marginX + 2, tY + 31); valN(transportData.noteExtra || '', marginX + 20, tY + 33.5);
    }

    currentBottomY -= 3; 
  }

  // --- RIEPILOGO IVA E SCADENZE ---
  currentBottomY -= hRiepilogo;
  const yRiepilogo = currentBottomY;

  pdf.setFontSize(8); pdf.setFont('helvetica', 'bold');
  pdf.text('Riepilogo Documento', marginX, yRiepilogo - 1);

  autoTable(pdf, {
    startY: yRiepilogo,
    margin: { left: marginX + 90 }, 
    tableWidth: usableW - 90,
    theme: 'plain', 
    // FIX PADDING: Aumentato a 0.6
    headStyles: { textColor: 0, fontStyle: 'bold', halign: 'center', fontSize: 7, cellPadding: 0.6 },
    bodyStyles: { halign: 'right', fontSize: 7, cellPadding: 0.6 },
    columnStyles: { 0: { halign: 'center' } },
    head: [['Riep.IVA', 'Imponib.', 'Iva', 'Totali']],
    body: vatBody,
    willDrawCell: function(data) { 
      if (data.row.index === vatBody.length - 1) pdf.setFont('helvetica', 'bold'); 
      pdf.setDrawColor(0); pdf.setLineWidth(0.2);
      pdf.line(data.cell.x, data.cell.y, data.cell.x, data.cell.y + data.cell.height); 
      if (data.column.index === data.table.columns.length - 1) {
        pdf.line(data.cell.x + data.cell.width, data.cell.y, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
      if (data.section === 'head') {
        pdf.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y); 
        pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); 
      }
      if (data.section === 'body' && data.row.index === vatBody.length - 1) {
        pdf.line(data.cell.x, data.cell.y, data.cell.x + data.cell.width, data.cell.y); 
        pdf.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height); 
      }
    }
  });
  
  const vatFinalY = (pdf as any).lastAutoTable.finalY;
  const vatHeight = vatFinalY - yRiepilogo;
  
  // BOX SCADENZE
  pdf.setDrawColor(0); pdf.setLineWidth(0.2);
  pdf.rect(marginX, yRiepilogo, 85, vatHeight); 
  pdf.setFontSize(7); pdf.setFont('helvetica', 'bold');
  pdf.text('Scadenze:', marginX + 2, yRiepilogo + 3.5);
  
  const nRate = Number(modPagObj?.nrate) > 0 ? Number(modPagObj?.nrate) : 1;
  const giorniStep = Number(modPagObj?.t) || 0;
  const isFineMese = Number(modPagObj?.lock) === -1;
  const totDaPagare = totalImpon + totalImposta + Number(doc.arrot || 0);
  const rataBase = Math.round((totDaPagare / nRate) * 100) / 100;
  const rataUltima = Math.round((totDaPagare - (rataBase * (nRate - 1))) * 100) / 100;

  pdf.setFont('helvetica', 'normal');
  const maxCols = 5; 
  const colWidth = 16; 
  const startX = marginX + 2;
  const dateY = yRiepilogo + 8;
  const amountY = dateY + 4;

  for (let i = 1; i <= nRate; i++) {
    if (i > maxCols) break; 
    let importo = (i === nRate) ? rataUltima : rataBase;
    let d = new Date(doc.datafatt);
    d.setDate(d.getDate() + (giorniStep * i));
    if (isFineMese) { d.setMonth(d.getMonth() + 1); d.setDate(0); }
    
    let cx = startX + ((i - 1) * colWidth);
    pdf.text(formatDataPDF(d.toISOString().split('T')[0]), cx, dateY);
    pdf.text(formatCurrency(importo).replace('€', '').trim(), cx, amountY);
  }

  if (typeof pdf.putTotalPages === 'function') {
    pdf.putTotalPages('{total_pages_count_string}');
  }

  // =================================================================
  // FIX DEFINITIVO PER IOS SAFARI (NSURLErrorDomain) E PC
  // Convertiamo in Base64 (DataURI) per bypassare le restrizioni Blob
  // =================================================================
  const safeSuffix = tipoDocObj?.suffisso ? `_${tipoDocObj.suffisso.trim()}` : '';
  const filename = `Fattura_${doc.Num}${safeSuffix}_${docYear}.pdf`;

  if (mode === 'print') {
    const base64Data = pdf.output('datauristring'); // Usiamo Base64 invece di Blob
    const targetWin = printWindow || null;

    if (targetWin && targetWin.document) {
      try {
        targetWin.document.open();
        // Disegniamo una bella UI HTML che carica il base64. iOS Safari accetta il Base64 negli iframe!
        targetWin.document.write(
          "<!doctype html><html><head><meta charset='utf-8'/>" +
            "<meta name='viewport' content='width=device-width,initial-scale=1'/>" +
            "<title>Visualizzatore PDF</title></head>" +
            "<body style='margin:0;font-family:system-ui,sans-serif;background-color:#525659;'>" +
              "<div style='padding:10px 16px;border-bottom:1px solid #333;background:#323639;color:#fff;display:flex;justify-content:space-between;align-items:center;'>" +
                "<div><div style='font-size:14px;font-weight:700'>Documento pronto</div>" +
                "<div style='font-size:11px;color:#aaa;margin-top:2px;'>" + filename + "</div></div>" +
                "<a href='" + base64Data + "' download='" + filename + "' style='padding:8px 12px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:12px'>Scarica/Stampa</a>" +
              "</div>" +
              "<iframe src='" + base64Data + "' style='width:100%;height:calc(100vh - 60px);border:0' title='PDF'></iframe>" +
            "</body></html>"
        );
        targetWin.document.close();
        try { targetWin.focus(); } catch {}
      } catch (e) {
        // Fallback estremo se document.write fallisce
        pdf.save(filename);
      }
    } else {
      // Se il popup originale era bloccato, forziamo download
      pdf.save(filename);
    }
    return null;
  } else {
    // Modalità inoltro Mail
    const base64Data = pdf.output('datauristring');
    return { filename, base64Data };
  }
};