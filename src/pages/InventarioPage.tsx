import { useState, useMemo } from 'react';
import { Filter, RotateCcw, FileText, FileSpreadsheet } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useMagazzini } from '@/hooks/api/useMagazzini';
import { useAzienda } from '@/hooks/api/useAzienda';
import { useArticoli } from '@/hooks/api/useArticoli';
import { useCarichi } from '@/hooks/api/useCarichi';
import { useScarichi } from '@/hooks/api/useScarichi';
import { useTrasferimenti } from '@/hooks/api/useTrasferimenti';
import { useQueryClient } from '@tanstack/react-query';

import ArticoloFormModal from '@/components/ArticoloFormModal';
import MovimentiMagazzinoViewerModal from '@/components/MovimentiMagazzinoViewerModal';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);
const months = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'];

const InventarioPage = () => {
  const [authenticated] = useState(() => !!localStorage.getItem('gestionale_auth'));
  
  const [anno, setAnno] = useState(currentYear);
  const [meseDal, setMeseDal] = useState(1);
  const [meseAl, setMeseAl] = useState(12);
  const [puntoVendita, setPuntoVendita] = useState(0);
  const [brand, setBrand] = useState('');
  const [categoria, setCategoria] = useState('');
  
  const [expanded, setExpanded] = useState(() => {
    try { const s = localStorage.getItem('gestionale_inventario_filters_expanded'); return s === 'true'; } catch { return false; }
  });
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(0);

  const [editingArticolo, setEditingArticolo] = useState<any | null>(null);
  const [viewMovementsArt, setViewMovementsArt] = useState<string | null>(null);

  const { data: aziendaData } = useAzienda();
  const { data: magazziniData, isLoading: isMagazziniLoading } = useMagazzini();
  const { data: articoliData = [], isLoading: isArticoliLoading } = useArticoli();
  const { data: carichiData = [], isLoading: isCarichiLoading } = useCarichi();
  const { data: scarichiData = [], isLoading: isScarichiLoading } = useScarichi();
  const { data: trasferimentiData = [], isLoading: isTrasferimentiLoading } = useTrasferimenti();

  const isDataLoading = isArticoliLoading || isCarichiLoading || isScarichiLoading || isTrasferimentiLoading;

  const brands = useMemo(() => [...new Set(articoliData.map((a: any) => a.brand).filter(Boolean))].sort(), [articoliData]);
  const categorie = useMemo(() => [...new Set(articoliData.map((a: any) => a.Cod_Prisma).filter(Boolean))].sort(), [articoliData]);

  const dateFrom = `${anno}-${String(meseDal).padStart(2, '0')}-01`;
  const lastDay = new Date(anno, meseAl, 0).getDate();
  const dateTo = `${anno}-${String(meseAl).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // --- MOTORE DI CALCOLO INVENTARIO E COSTO MEDIO ---
  const inventario = useMemo(() => {
    if (isDataLoading) return [];

    let arts = articoliData;
    if (brand) arts = arts.filter((a: any) => a.brand === brand);
    if (categoria) arts = arts.filter((a: any) => a.Cod_Prisma === categoria);

    const calcSum = (arr: any[], field = 'quantita') => arr.reduce((acc, curr) => acc + Number(curr[field] || curr.quant || 0), 0);

    return arts.map((art: any) => {
      const cod = art.Codice;
      const magFilt = (mag: number) => puntoVendita === 0 || Number(mag) === puntoVendita;

      const aCarichi = carichiData.filter((c: any) => c.Cod_articolo === cod && magFilt(c.magazzino));
      const aScarichi = scarichiData.filter((s: any) => s.Cod_articolo === cod && magFilt(s.magazzino));
      const aTrasfIn = trasferimentiData.filter((t: any) => t.codice === cod && magFilt(t.magin));
      const aTrasfOut = trasferimentiData.filter((t: any) => t.codice === cod && magFilt(t.magout));

      // GIACENZA PREGRESSA (Ignoro esistenza statica)
      const pastCarichi = calcSum(aCarichi.filter((c: any) => c.Data < dateFrom));
      const pastScarichi = calcSum(aScarichi.filter((s: any) => s.Data < dateFrom));
      const pastTrasfIn = calcSum(aTrasfIn.filter((t: any) => t.data < dateFrom));
      const pastTrasfOut = calcSum(aTrasfOut.filter((t: any) => t.data < dateFrom));
      const esistenzaStorica = pastCarichi - pastScarichi + pastTrasfIn - pastTrasfOut;

      // MOVIMENTI NEL PERIODO
      const qtyCarichi = calcSum(aCarichi.filter((c: any) => c.Data >= dateFrom && c.Data <= dateTo));
      const qtyScarichi = calcSum(aScarichi.filter((s: any) => s.Data >= dateFrom && s.Data <= dateTo));
      const qtyTrasfIn = calcSum(aTrasfIn.filter((t: any) => t.data >= dateFrom && t.data <= dateTo));
      const qtyTrasfOut = calcSum(aTrasfOut.filter((t: any) => t.data >= dateFrom && t.data <= dateTo));

      const giacenza = esistenzaStorica + qtyCarichi - qtyScarichi + qtyTrasfIn - qtyTrasfOut;

      // COSTO MEDIO PONDERATO DI ACQUISTO 
      const carichiFinoAData = carichiData.filter((c: any) => c.Cod_articolo === cod && c.Data <= dateTo && Number(c.Importo || 0) > 0);
      let costoMedio = 0;
      
      if (carichiFinoAData.length > 0) {
        const totCostoAcquisti = carichiFinoAData.reduce((sum: number, c: any) => {
          const qta = Number(c.quantita || 0);
          const prezzo = Number(c.Importo || 0);
          const scontoPerc = Number(c.perc || 0);
          return sum + (qta * (prezzo * (1 - (scontoPerc / 100))));
        }, 0);
        const totQtaAcquisti = calcSum(carichiFinoAData);
        costoMedio = totQtaAcquisti > 0 ? (totCostoAcquisti / totQtaAcquisti) : 0;
      }
      
      if (costoMedio === 0) costoMedio = Number(art.Listino1 || 0);

      // REGOLA: Giacenza negativa = 0 Valore
      const valore = giacenza > 0 ? Math.round(giacenza * costoMedio * 100) / 100 : 0;

      return { 
        codice: cod, descrizione: art.Descrizione, brand: art.brand, categoria: art.Cod_Prisma, 
        esistenza: esistenzaStorica, carichi: qtyCarichi, scarichi: qtyScarichi, trasfIn: qtyTrasfIn, trasfOut: qtyTrasfOut, 
        giacenza, valore, _rawArt: art 
      };
    }).filter((r: any) => r.esistenza !== 0 || r.carichi !== 0 || r.scarichi !== 0 || r.trasfIn !== 0 || r.trasfOut !== 0 || r.giacenza !== 0);
  }, [articoliData, carichiData, scarichiData, trasferimentiData, isDataLoading, anno, meseDal, meseAl, puntoVendita, brand, categoria, dateFrom, dateTo]);

  const totEsistenza = inventario.reduce((s, r) => s + r.esistenza, 0);
  const totCarichi = inventario.reduce((s, r) => s + r.carichi, 0);
  const totScarichi = inventario.reduce((s, r) => s + r.scarichi, 0);
  const totTrasfIn = inventario.reduce((s, r) => s + r.trasfIn, 0);
  const totTrasfOut = inventario.reduce((s, r) => s + r.trasfOut, 0);
  const totGiacenza = inventario.reduce((s, r) => s + r.giacenza, 0);
  const totValore = inventario.reduce((s, r) => s + r.valore, 0);

  const totalPages = Math.ceil(inventario.length / pageSize);
  const paged = inventario.slice(page * pageSize, (page + 1) * pageSize);

  const handleLogout = () => { localStorage.removeItem('gestionale_auth'); window.location.href = '/'; };
  if (!authenticated) { window.location.href = '/'; return null; }

  const exportPDF = () => {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const az = aziendaData && aziendaData.length > 0 ? aziendaData[0] : null;
    doc.setFontSize(14);
    const title = az ? `${az.RagioneSociale1} - Inventario di Magazzino (Costo Medio)` : 'Inventario (Costo Medio)';
    doc.text(title, 14, 15);
    doc.setFontSize(9);
    doc.text(`Periodo: ${months[meseDal - 1]} - ${months[meseAl - 1]} ${anno} | Stampato: ${new Date().toLocaleDateString('it-IT')}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [['Codice', 'Descrizione', 'Brand', 'Esistenza', 'Carichi', 'Scarichi', 'Trasf.In', 'Trasf.Out', 'Giacenza', 'Valore €']],
      body: inventario.map(r => [
        r.codice, r.descrizione, r.brand || '', r.esistenza, r.carichi || '-', r.scarichi || '-', r.trasfIn || '-', r.trasfOut || '-',
        r.giacenza, r.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 }),
      ]),
      foot: [['', '', 'TOTALI:', totEsistenza.toLocaleString('it-IT'), totCarichi.toLocaleString('it-IT'), totScarichi.toLocaleString('it-IT'), totTrasfIn.toLocaleString('it-IT'), totTrasfOut.toLocaleString('it-IT'), totGiacenza.toLocaleString('it-IT'), `€ ${totValore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`]],
      styles: { fontSize: 7 }, headStyles: { fillColor: [41, 98, 255] }, footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      columnStyles: { 3:{halign:'right'}, 4:{halign:'right'}, 5:{halign:'right'}, 6:{halign:'right'}, 7:{halign:'right'}, 8:{halign:'right'}, 9:{halign:'right'} }
    });
    doc.save(`Inventario_${anno}_${String(meseDal).padStart(2, '0')}-${String(meseAl).padStart(2, '0')}.pdf`);
  };

  const exportXLS = () => {
    const wsData = [
      ['Codice', 'Descrizione', 'Brand', 'Esistenza', 'Carichi', 'Scarichi', 'Trasf. In', 'Trasf. Out', 'Giacenza', 'Valore €'],
      ...inventario.map(r => [r.codice, r.descrizione, r.brand, r.esistenza, r.carichi, r.scarichi, r.trasfIn, r.trasfOut, r.giacenza, r.valore]),
      ['', '', 'TOTALI', totEsistenza, totCarichi, totScarichi, totTrasfIn, totTrasfOut, totGiacenza, totValore],
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Inventario');
    XLSX.writeFile(wb, `Inventario_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const tdLinkClass = "text-sm text-right cursor-pointer hover:underline hover:bg-muted/50 transition-colors";

  return (
    <AppLayout onLogout={handleLogout}>
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Inventario e Valorizzazione Magazzino</h1>
          <p className="text-sm text-muted-foreground">Calcolo giacenze nel periodo e valorizzazione al Costo Medio d'Acquisto.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={exportPDF} size="sm" variant="outline" className="flex-1 sm:flex-none text-blue-600 border-blue-300 hover:bg-blue-50"><FileText className="w-4 h-4 mr-2" /> PDF</Button>
          <Button onClick={exportXLS} size="sm" variant="outline" className="flex-1 sm:flex-none text-green-600 border-green-300 hover:bg-green-50"><FileSpreadsheet className="w-4 h-4 mr-2" /> XLS</Button>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-border shadow-sm mb-4">
        <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-foreground">
          <span className="flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Filtri Inventario</span>
          <span className="text-xs text-muted-foreground">{expanded ? 'Nascondi' : 'Mostra'}</span>
        </button>
        {expanded && (
          <div className="px-5 pb-5 space-y-3 border-t border-border pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Anno</label><select value={anno} onChange={e => { setAnno(+e.target.value); setPage(0); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Mese Dal</label><select value={meseDal} onChange={e => { setMeseDal(+e.target.value); setPage(0); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Mese Al</label><select value={meseAl} onChange={e => { setMeseAl(+e.target.value); setPage(0); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">{months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Punto Vendita</label><select value={puntoVendita} onChange={e => { setPuntoVendita(+e.target.value); setPage(0); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value={0}>Tutti</option>{!isMagazziniLoading && (magazziniData || []).filter((m: any) => m.attivo).map((m: any) => <option key={m.cod} value={m.cod}>{m.Descrizione}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Brand</label><select value={brand} onChange={e => { setBrand(e.target.value); setPage(0); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Tutti</option>{brands.map(b => <option key={b as string} value={b as string}>{b as string}</option>)}</select></div>
              <div><label className="block text-xs font-medium text-muted-foreground mb-1">Categoria (Prisma)</label><select value={categoria} onChange={e => { setCategoria(e.target.value); setPage(0); }} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="">Tutti</option>{categorie.map(c => <option key={c as string} value={c as string}>{c as string}</option>)}</select></div>
            </div>
            <div className="flex justify-end"><Button variant="outline" size="sm" onClick={() => { setAnno(currentYear); setMeseDal(1); setMeseAl(12); setPuntoVendita(0); setBrand(''); setCategoria(''); setPage(0); }}><RotateCcw className="w-3.5 h-3.5 mr-1" /> Reset Filtri</Button></div>
          </div>
        )}
      </div>

      <Card className="mb-32">
        <CardContent className="p-0">
          <div className="overflow-x-auto hidden md:block">
            <Table className="whitespace-nowrap">
              <TableHeader className="bg-secondary/50">
                <TableRow>
                  <TableHead className="font-bold">Codice</TableHead>
                  <TableHead className="font-bold min-w-[200px] max-w-[250px]">Descrizione</TableHead>
                  <TableHead className="font-bold">Brand</TableHead>
                  <TableHead className="text-right font-bold text-gray-600 bg-gray-50/50">Esistenza</TableHead>
                  <TableHead className="text-right font-bold text-green-700 bg-green-50/50">Carichi</TableHead>
                  <TableHead className="text-right font-bold text-red-700 bg-red-50/50">Scarichi</TableHead>
                  <TableHead className="text-right font-bold text-blue-700 bg-blue-50/50">Trasf. In</TableHead>
                  <TableHead className="text-right font-bold text-amber-700 bg-amber-50/50">Trasf. Out</TableHead>
                  <TableHead className="text-right font-black text-primary">Giacenza</TableHead>
                  <TableHead className="text-right font-bold">Valore</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isDataLoading && <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-12">Calcolo giacenze in corso...</TableCell></TableRow>}
                {!isDataLoading && paged.map(r => (
                  <TableRow key={r.codice} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-mono font-bold text-primary cursor-pointer hover:underline" title="Modifica Anagrafica" onClick={() => setEditingArticolo(r._rawArt)}>
                      {r.codice}
                    </TableCell>
                    <TableCell className="text-sm font-medium max-w-[250px] truncate" title={r.descrizione}>{r.descrizione}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.brand || '-'}</TableCell>
                    
                    <TableCell className={`${tdLinkClass} bg-gray-50/30 text-gray-700`} title="Vedi Movimenti" onClick={() => setViewMovementsArt(r.codice)}>{r.esistenza}</TableCell>
                    <TableCell className={`${tdLinkClass} text-green-600 bg-green-50/30`} title="Vedi Movimenti" onClick={() => setViewMovementsArt(r.codice)}>{r.carichi || '-'}</TableCell>
                    <TableCell className={`${tdLinkClass} text-red-600 bg-red-50/30`} title="Vedi Movimenti" onClick={() => setViewMovementsArt(r.codice)}>{r.scarichi || '-'}</TableCell>
                    <TableCell className={`${tdLinkClass} text-blue-600 bg-blue-50/30`} title="Vedi Movimenti" onClick={() => setViewMovementsArt(r.codice)}>{r.trasfIn || '-'}</TableCell>
                    <TableCell className={`${tdLinkClass} text-amber-600 bg-amber-50/30`} title="Vedi Movimenti" onClick={() => setViewMovementsArt(r.codice)}>{r.trasfOut || '-'}</TableCell>
                    <TableCell className={`${tdLinkClass} text-base font-black text-foreground`} title="Vedi Movimenti" onClick={() => setViewMovementsArt(r.codice)}>{r.giacenza}</TableCell>
                    
                    <TableCell className="text-sm text-right text-foreground font-semibold">€ {r.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* CARD MOBILE */}
          <div className="md:hidden flex flex-col gap-3 p-3 bg-secondary/10">
            {paged.map(r => (
              <div key={r.codice} className="bg-card border border-border rounded-xl p-4 shadow-sm flex flex-col gap-2">
                <div className="flex justify-between items-start mb-1">
                  <span onClick={() => setEditingArticolo(r._rawArt)} className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded-md cursor-pointer underline">{r.codice}</span>
                  <span className="text-lg font-black text-primary bg-primary/10 px-2 py-0.5 rounded">Giac: {r.giacenza}</span>
                </div>
                <span className="text-sm font-bold text-foreground mb-1 leading-tight">{r.descrizione}</span>
                <div className="grid grid-cols-4 gap-1 text-[10px] text-center font-mono font-bold mt-2" onClick={() => setViewMovementsArt(r.codice)}>
                   <div className="bg-green-50 text-green-700 p-1 rounded border border-green-100">+{r.carichi}</div>
                   <div className="bg-red-50 text-red-700 p-1 rounded border border-red-100">-{r.scarichi}</div>
                   <div className="bg-blue-50 text-blue-700 p-1 rounded border border-blue-100">+{r.trasfIn}</div>
                   <div className="bg-amber-50 text-amber-700 p-1 rounded border border-amber-100">-{r.trasfOut}</div>
                </div>
                <div className="flex justify-between items-center pt-2 mt-2 border-t border-border">
                  <span className="text-xs text-muted-foreground cursor-pointer underline" onClick={() => setViewMovementsArt(r.codice)}>Vedi Movimenti</span>
                  <span className="text-sm font-bold text-foreground">Valore: € {r.valore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t-2 border-primary/20 shadow-[0_-8px_30px_rgba(0,0,0,0.12)] z-40">
        <div className="max-w-[1500px] mx-auto px-4 sm:px-6 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-start">
            <span className="text-muted-foreground font-medium text-sm shrink-0">{inventario.length} articoli</span>
            <div className="flex items-center gap-2">
              <select value={pageSize} onChange={e => { setPageSize(+e.target.value); setPage(0); }} className="h-8 rounded border border-input bg-background px-2 text-xs"><option value={20}>20</option><option value={50}>50</option><option value={100}>100</option></select>
              {totalPages > 1 && <div className="flex items-center gap-1"><Button variant="outline" size="sm" className="h-8 px-2" disabled={page === 0} onClick={() => setPage(p => p - 1)}>←</Button><span className="px-2 text-xs font-mono">{page + 1}/{totalPages}</span><Button variant="outline" size="sm" className="h-8 px-2" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>→</Button></div>}
            </div>
          </div>
          <div className="w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0">
            <div className="flex items-center gap-6 md:gap-8 min-w-max px-1">
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-gray-500 uppercase mb-0.5">Tot. Esistenza</span><span className="text-sm font-mono font-bold text-gray-700">{totEsistenza.toLocaleString('it-IT')}</span></div>
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-green-600 uppercase mb-0.5">Tot. Carichi</span><span className="text-sm font-mono font-bold text-green-700">{totCarichi.toLocaleString('it-IT')}</span></div>
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-red-600 uppercase mb-0.5">Tot. Scarichi</span><span className="text-sm font-mono font-bold text-red-700">{totScarichi.toLocaleString('it-IT')}</span></div>
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-blue-600 uppercase mb-0.5">Tot. Trasf In</span><span className="text-sm font-mono font-bold text-blue-700">{totTrasfIn.toLocaleString('it-IT')}</span></div>
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-amber-600 uppercase mb-0.5">Tot. Trasf Out</span><span className="text-sm font-mono font-bold text-amber-700">{totTrasfOut.toLocaleString('it-IT')}</span></div>
              <div className="h-8 w-px bg-border hidden md:block mx-2"></div>
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-primary uppercase mb-0.5">Tot. Giacenza</span><span className="text-lg font-mono font-black text-primary">{totGiacenza.toLocaleString('it-IT')}</span></div>
              <div className="flex flex-col items-end"><span className="text-[10px] font-bold text-primary uppercase mb-0.5">Valore Magazzino</span><span className="text-lg font-mono font-black text-primary bg-primary/10 px-2 py-0.5 rounded">€ {totValore.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>
        </div>
      </div>

      {editingArticolo && <ArticoloFormModal articolo={editingArticolo} onSave={() => setEditingArticolo(null)} onClose={() => setEditingArticolo(null)} />}
      {viewMovementsArt && <MovimentiMagazzinoViewerModal codiceArticolo={viewMovementsArt} dateFrom={dateFrom} dateTo={dateTo} onClose={() => setViewMovementsArt(null)} />}
    </AppLayout>
  );
};

export default InventarioPage;