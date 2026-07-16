import { useEffect, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, AlertTriangle } from 'lucide-react';

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onScan, onClose }: Props) {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Controllo di Sicurezza HTTPS/Localhost
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("Fotocamera bloccata dal browser.\nÈ richiesta una connessione sicura HTTPS per accedere all'obiettivo.");
      return;
    }

    try {
      // Inizializza lo scanner con parametri OTTIMIZZATI per smartphone
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 20, // Raddoppiata la frequenza di scansione per renderlo più reattivo
          
          // Riquadro Dinamico: si adatta anche agli schermi piccoli come iPhone SE
          qrbox: (width) => {
            const size = Math.min(width * 0.9, 300); // 90% della larghezza, massimo 300px
            return { width: size, height: 120 }; // Rettangolo basso e largo
          },
          
          // false = Permette al motore di leggere i barcode anche se sono a testa in giù!
          disableFlip: false,
          
          // Aspect Ratio quadrato (1.0) forza la fotocamera a prendere la massima risoluzione centrale
          aspectRatio: 1.0 
        },
        false // disabilita i log di debug in console
      );

      scanner.render(
        (decodedText) => {
          // =========================================================
          // QUESTO È L'EVENTO "EMULATORE TASTIERA"
          // Appena legge un codice: SUONA/VIBRA, PULISCE E CHIUDE!
          // =========================================================
          if (navigator.vibrate) navigator.vibrate(100); // Vibra su Android (su iOS è limitato)
          scanner.clear();
          onScan(decodedText);
        },
        (error) => {
          // Ignoriamo i log continui quando non inquadra nulla
        }
      );

      // Spegne la fotocamera quando si preme la X
      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    } catch (e: any) {
      setErrorMsg("Errore durante l'avvio della fotocamera: " + e.message);
    }
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[11000] bg-black/95 flex flex-col animate-fade-in">
      
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 bg-slate-900 text-white shadow-md pb-safe shrink-0">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Camera className="w-5 h-5 text-amber-500" />
          Scannerizza Codice a Barre
        </div>
        <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-red-500 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      {/* AREA FOTOCAMERA E CONSIGLI */}
      <div className="flex-1 flex flex-col items-center justify-center bg-black p-4">
        {errorMsg ? (
          <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl text-center flex flex-col items-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
            <p className="text-white font-bold mb-2">Impossibile avviare lo scanner</p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{errorMsg}</p>
          </div>
        ) : (
          <div className="w-full max-w-md flex flex-col gap-4">
            
            {/* Box della libreria Html5QrcodeScanner */}
            <div id="reader" className="w-full bg-white rounded-2xl overflow-hidden shadow-2xl border-4 border-slate-800"></div>
            
            {/* Istruzioni per l'utente */}
            <div className="text-center text-slate-400 text-xs font-medium bg-slate-900/50 p-3 rounded-lg border border-slate-800">
              💡 <strong className="text-amber-500">Suggerimento:</strong> Tieni il telefono a circa 10-15 cm di distanza per permettere la messa a fuoco. 
              La lettura è automatica.
            </div>

          </div>
        )}
      </div>
    </div>
  );
}