// src/config.ts

const getDynamicHost = () => {
  // 1. MODALITÀ SVILUPPO (Quando programmi sul tuo PC con npm run dev)
  if (import.meta.env.DEV) {
    // Qui puoi lasciare fisso l'indirizzo del tuo XAMPP locale.
    // Nessun cliente vedrà mai questo indirizzo, viene usato solo da Vite sul tuo PC.
	return "https://www.pacinigroupsrl.it/multiv"; 
  }

  // 2. MODALITÀ PRODUZIONE (Quando pubblichi sul server remoto)
  // Auto-calcola il dominio in cui si trova il sito (es. https://www.pacinigroupsrl.it)
  const origin = window.location.origin; 
  
  // Auto-calcola la sottocartella in cui si trova il gestionale (es. /multiv/)
  let path = window.location.pathname;

  // Se per caso l'utente accede scrivendo esplicitamente il file (es. /multiv/index.html),
  // tagliamo via "index.html" per tenere solo la cartella.
  if (path.match(/\/[^\/]+\.[^\/]+$/)) {
    path = path.substring(0, path.lastIndexOf('/'));
  }

  // Rimuoviamo l'eventuale slash finale (/) per evitare di creare doppi slash 
  // quando viene unito a "/api.php" nei vari fetch (es. /multiv//api.php)
  path = path.replace(/\/$/, '');

  // Unisce il dominio e la cartella!
  return origin + path;
};

export const API_HOST = getDynamicHost();
