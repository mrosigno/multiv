import { useEffect, useState } from 'react';
// FIX: Importiamo esplicitamente i formati supportati (EAN, CODE128, ecc.)
import { Html5QrcodeScanner, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { X, Camera, AlertTriangle } from 'lucide-react';

interface Props {
  onScan: (decodedText: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ onScan, onClose }: Props) {
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Controllo di Sicurezza 1: Siamo in HTTPS o Localhost?
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg("Fotocamera bloccata dal browser.\nÈ richiesta una connessione sicura HTTPS.");
      return;
    }

    try {
      // Inizializza lo scanner
      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          // FIX: Usiamo un rettangolo lungo e stretto (perfetto per i Barcode dei prodotti)
          qrbox: { width: 320, height: 120 },
          aspectRatio: 1.777778, // Formato 16:9 dei cellulari
          
          // FIX: Diciamo al motore di cercare ESPRESSAMENTE i Barcode lineari oltre ai QR
          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.ITF,
            Html5QrcodeSupportedFormats.QR_CODE
          ]
        },
        false
      );

      scanner.render(
        (decodedText) => {
          // Quando legge un codice con successo, pulisce la memoria e chiude la fotocamera
          scanner.clear();
          onScan(decodedText);
        },
        (error) => {
          // Ignoriamo i continui log di errore di "Codice non inquadrato" in background
        }
      );

      return () => {
        scanner.clear().catch(error => console.error("Failed to clear scanner", error));
      };
    } catch (e: any) {
      setErrorMsg("Errore durante l'avvio della fotocamera: " + e.message);
    }
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-[11000] bg-black flex flex-col animate-fade-in">
      <div className="flex items-center justify-between p-4 bg-slate-900 text-white shadow-md pb-safe shrink-0">
        <div className="flex items-center gap-2 font-bold text-sm">
          <Camera className="w-5 h-5 text-amber-500" />
          Inquadra il Codice a Barre nel riquadro
        </div>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20 transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center bg-black p-4">
        {errorMsg ? (
          <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-xl text-center flex flex-col items-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-3" />
            <p className="text-white font-bold mb-2">Impossibile avviare lo scanner</p>
            <p className="text-slate-300 text-sm whitespace-pre-wrap">{errorMsg}</p>
          </div>
        ) : (
          // Il div "reader" verrà popolato dalla libreria
          <div id="reader" className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl"></div>
        )}
      </div>
    </div>
  );
}