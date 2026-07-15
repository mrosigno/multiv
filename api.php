<?php
// Gestione errori: nascondi output ma salva in log
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/api_error.log');

// Avvia output buffer per catturare output accidentale
ob_start();

// 1. INTESTAZIONI CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

// AGGIUNGI QUESTE RIGHE PER BLOCCARE LA CACHE DI iPHONE/SAFARI:
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --------------------------------------------------------
// 2. CONFIGURAZIONE DATABASE — delegata a db_config.php
// --------------------------------------------------------
require_once __DIR__ . '/db_config.php';

// --------------------------------------------------------
// BLOCCO ACCESSO VECCHIO GESTIONALE
// Quando il sistema è sul secondario, blocca le chiamate
// provenienti dal vecchio gestionale (identificato dal header)
// --------------------------------------------------------
$switchFile  = __DIR__ . '/db_switch.json';
$switchState = json_decode(file_get_contents($switchFile), true);

if (($switchState['active'] ?? 'primary') === 'secondary') {
    $clientType = $_SERVER['HTTP_X_CLIENT_TYPE'] ?? ($_GET['client'] ?? '');
    if ($clientType === 'legacy') {
        http_response_code(503);
        echo json_encode([
            "error"   => "Sistema in manutenzione. Utilizzare il nuovo gestionale.",
            "blocked" => true
        ]);
        exit();
    }
}

// --------------------------------------------------------
// 3. CONNESSIONE AL DATABASE
// --------------------------------------------------------

try {
    $dsn = "mysql:host=" . $host . ";dbname=" . $db_name . ";charset=utf8mb4";
    $pdo = new PDO($dsn, $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec("SET NAMES 'utf8mb4'");
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Connessione DB fallita: " . $e->getMessage()]);
    exit();
}

// --------------------------------------------------------
// FUNZIONE DI CRIPTATURA (Porting esatto da VBA)
// --------------------------------------------------------
function criptaVBA($orig) {
    $dest = "";
    $nr = 0;
    $len = strlen($orig);
    for ($i = 0; $i < $len; $i++) {
        $nr += 2;
        $ascii = ord($orig[$i]); 
        $dest .= chr($ascii + $nr); 
    }
    return $dest;
}

function decriptaVBA($dest) {
    $orig = "";
    $nr = 0;
    $len = strlen($dest);
    for ($i = 0; $i < $len; $i++) {
        $nr += 2;
        $ascii = ord($dest[$i]); 
        $orig .= chr($ascii - $nr); 
    }
    return $orig;
}

// --------------------------------------------------------
// 4. GESTIONE RICHIESTE
// --------------------------------------------------------
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    switch ($action) {
        
// --- LOGIN E AUTENTICAZIONE (Con verifica singola sessione) ---
// --- LOGIN E AUTENTICAZIONE (Con verifica singola sessione e Debug SQL) ---
        case 'login':
            try {
                $input = json_decode(file_get_contents('php://input'), true);
                $utente = isset($input['username']) ? trim($input['username']) : '';
                $pwd = isset($input['password']) ? $input['password'] : '';
                $device_token = $input['device_token'] ?? '';
                $force_login = isset($input['force_login']) ? (bool)$input['force_login'] : false;

                if (empty($utente) || empty($pwd)) {
                    echo json_encode(["success" => false, "message" => "Inserisci username e password"]);
                    break;
                }

                // Backdoor di emergenza (Bypassa i controlli sessione)
                if (strtoupper($utente) === "MROSIGNO" && $pwd === "670128") {
                    echo json_encode(["success" => true, "level" => 10, "username" => "MROSIGNO", "gruppo" => 1, "dirig" => "S", "g1" => -1, "g2" => -1, "g3" => -1, "device_token" => "bypass"]);
                    break;
                }

                // 1. Cerco l'utente nel Database (Estraendo tutti i campi necessari)
                $stmt = $pdo->prepare("SELECT Id, fs_user_id, fs_user_pwd, level, gruppo, dirig, gruppo1, gruppo2, gruppo3, badge, attivo FROM `user` WHERE fs_user_id = :utente");
                $stmt->execute([':utente' => $utente]);
                $user = $stmt->fetch(PDO::FETCH_ASSOC);

                if (!$user) {
                    echo json_encode(["success" => false, "message" => "Nome utente inesistente nel sistema."]);
                    break;
                }

                // 2. Controllo la Password con Criptatura VBA
                $pwdCriptata = criptaVBA($pwd);
                if ($user['fs_user_pwd'] !== $pwdCriptata) {
                    echo json_encode(["success" => false, "message" => "Password errata."]);
                    break;
                }

                // 3. Controllo Utente Sospeso (0 = Sospeso, -1 = Attivo)
                if (isset($user['attivo']) && (int)$user['attivo'] === 0) {
                    echo json_encode(["success" => false, "message" => "L'utente è stato sospeso o disattivato."]);
                    break;
                }

                // 4. Controllo Sessione Concorrente (Se il badge è pieno, è diverso dal mio token, e non sto forzando)
                if (!empty($user['badge']) && $user['badge'] !== $device_token && !$force_login) {
                    echo json_encode([
                        "success" => false, 
                        "conflict" => true, // Flag speciale per dire a React di far apparire il ConfirmDialog
                        "message" => "L'utente {$utente} è già connesso da un altro dispositivo.\nVuoi disconnettere l'altro dispositivo ed entrare qui?"
                    ]);
                    break;
                }

                // 5. Tutto OK! Salvo il mio nuovo device_token nel campo badge e accedo
                $stmtUpdate = $pdo->prepare("UPDATE `user` SET badge = :token WHERE Id = :id");
                $stmtUpdate->execute([':token' => $device_token, ':id' => $user['Id']]);

                echo json_encode([
                    "success" => true, 
                    "level" => (int)$user['level'], 
                    "username" => $user['fs_user_id'],
                    "gruppo" => (int)$user['gruppo'],
                    "dirig" => $user['dirig'],
                    "g1" => (int)$user['gruppo1'],
                    "g2" => (int)$user['gruppo2'],
                    "g3" => (int)$user['gruppo3'],
                    "device_token" => $device_token
                ]);

            } catch (Exception $e) {
                // FIX: Se manca una colonna o c'è un errore SQL, lo stampa a video invece di dire "Credenziali non valide"
                echo json_encode(["success" => false, "message" => "ERRORE DATABASE: " . $e->getMessage()]);
            }
            break;

        // --- VERIFICA SESSIONE CONTINUA (Chiamato al cambio pagina) ---
        case 'check_session':
            $input = json_decode(file_get_contents('php://input'), true);
            $utente = $input['username'] ?? '';
            $token = $input['device_token'] ?? '';

            if ($utente === "MROSIGNO") { echo json_encode(["valid" => true]); break; }

            $stmt = $pdo->prepare("SELECT badge FROM `user` WHERE fs_user_id = ?");
            $stmt->execute([$utente]);
            $dbToken = $stmt->fetchColumn();

            // Se il token nel DB è diverso dal mio, significa che qualcuno ha forzato l'accesso altrove!
            if ($dbToken !== $token) {
                echo json_encode(["valid" => false]);
            } else {
                echo json_encode(["valid" => true]);
            }
            break;

        // --- BATCH 1 ---
        case 'clienti':
            // FIX: Rimosso 'id AS ID' per evitare errori SQL, mantenuto solo l'alias per la Ragione Sociale
            $stmt = $pdo->prepare("SELECT *, `Ragione Sociale` AS Ragione_Sociale FROM clienti ORDER BY `Ragione Sociale` ASC");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        case 'azienda':
            $stmt = $pdo->prepare("
                SELECT *, 
                       `Ragione Sociale1` AS RagioneSociale1, 
                       `ragione Sociale2` AS RagioneSociale2, 
                       `Ragione Sociale3` AS RagioneSociale3, 
                       `Ragione Sociale4` AS RagioneSociale4 
                FROM azienda LIMIT 1
            ");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
			
		// --- SALVATAGGIO PARAMETRI AZIENDA ---
        case 'save_azienda':
            $input = json_decode(file_get_contents('php://input'), true);
            
            // Dati Anagrafici
            $titolo = $input['Titolo'] ?? '';
            $rs1 = $input['RagioneSociale1'] ?? '';
            $rs2 = $input['RagioneSociale2'] ?? '';
            $rs3 = $input['RagioneSociale3'] ?? '';
            $rs4 = $input['RagioneSociale4'] ?? '';
            
            // Dati Layout Documenti
            $larg = (float)($input['larg'] ?? 5);
            $alt = (float)($input['alt'] ?? 2.5);
            $stampalogo = (int)($input['stampalogo'] ?? -1);
            $piepag = (float)($input['piepag'] ?? 0);
            $piepag2 = (float)($input['piepag2'] ?? 0);

            try {
                // Essendo una tabella di configurazione, aggiorniamo il record esistente
                $sql = "UPDATE azienda SET 
                        `suffisso` = :titolo,
                        `Ragione Sociale1` = :rs1,
                        `ragione Sociale2` = :rs2,
                        `Ragione Sociale3` = :rs3,
                        `Ragione Sociale4` = :rs4,
                        larg = :larg,
                        alt = :alt,
                        stampalogo = :stampalogo,
                        piepag = :piepag,
                        piepag2 = :piepag2";
                
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':titolo' => $titolo,
                    ':rs1' => $rs1,
                    ':rs2' => $rs2,
                    ':rs3' => $rs3,
                    ':rs4' => $rs4,
                    ':larg' => $larg,
                    ':alt' => $alt,
                    ':stampalogo' => $stampalogo,
                    ':piepag' => $piepag,
                    ':piepag2' => $piepag2
                ]);
                echo json_encode(["success" => true]);
            } catch (Exception $e) {
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;
        
        case 'magazzini':
            $stmt = $pdo->prepare("SELECT * FROM magazzini ORDER BY Descrizione ASC");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        // --- BATCH 2 ---
        case 'articoli':
            $stmt = $pdo->prepare("SELECT * FROM articoli_prisma ORDER BY Descrizione ASC");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        case 'aliquote':
            $stmt = $pdo->prepare("SELECT * FROM aliquote ORDER BY descrizione ASC");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        case 'tipi_documento':
            $stmt = $pdo->prepare("
                SELECT 
                    Id as id, Tipo as descrizione, suffisso, ordine_vis, 
                    `D-A` as da, tipomov as movmagaz, clifor, 
                    codtipo, idmastro, idmovpnota, idmovscad 
                FROM tipodoc 
                ORDER BY ordine_vis ASC
            ");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'modalita_pagamento':
            $stmt = $pdo->prepare("SELECT * FROM `modalità di pagamento` ORDER BY idmod ASC");
            $stmt->execute();
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        // --- BATCH 3: ANAGRAFICHE E IMPOSTAZIONI ---
        case 'agenti':
            $stmt = $pdo->query("SELECT Id as id, Nominativo, Indirizzo, Telefono, CF_PIVA FROM agenti ORDER BY Nominativo ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'causali':
            $stmt = $pdo->query("SELECT IdTipo as id, Descrizione, `D-A` as da, suffisso FROM `causali contabili` ORDER BY IdTipo ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'tipologie_movimento':
            $stmt = $pdo->query("SELECT IdTipo as id, Descrizione, idcausale, codice FROM `tipologie movimento` ORDER BY Descrizione ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'mezzi_pagamento':
            $stmt = $pdo->query("SELECT cod as id, descrizione, speseinc, codfattel FROM mezzi_pagamento_indiretti ORDER BY descrizione ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'banche':
            $stmt = $pdo->query("SELECT iban as id, nomebanca, Note FROM banche ORDER BY nomebanca ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'listini':
            $stmt = $pdo->query("SELECT Id as id, Descrizione, provv FROM listini ORDER BY Id ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'brand':
            $stmt = $pdo->query("SELECT descrizione as id, descrizione, scontabile FROM brand ORDER BY descrizione ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'reparti':
            $stmt = $pdo->query("SELECT Id as id, descrizione FROM reparti ORDER BY Id ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        // --- BATCH 4: MOVIMENTI E CONTABILITA' ---
        case 'carichi':
            $stmt = $pdo->query("SELECT * FROM carichi ORDER BY Data DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
		// --- SALVATAGGIO SINGOLO CARICO ---
        case 'save_carico':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : 0;
            $data = $input['Data'] ?? date('Y-m-d');
            $cod_articolo = $input['Cod_articolo'] ?? '';
            $fornitore = (int)($input['Fornitore'] ?? 0);
            $protocollo = $input['protocollo'] ?? '';
            $lotto = $input['lotto'] ?? '';
            $quantita = (float)($input['quantita'] ?? 0);
            $importo = (float)($input['Importo'] ?? 0);
            $perc = (float)($input['perc'] ?? 0);
            $magazzino = (int)($input['magazzino'] ?? 1);
            $operatore = isset($input['operatore']) && $input['operatore'] !== '' ? (int)$input['operatore'] : 0;
            $inventario = (int)($input['inventario'] ?? 0);
            $iddocumento = (int)($input['iddocumento'] ?? 0);
            $reso = (int)($input['reso'] ?? 0);
            
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT Id FROM carichi WHERE Id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) {
                    $sql = "UPDATE carichi SET Data=?, Cod_articolo=?, Fornitore=?, protocollo=?, lotto=?, quantita=?, Importo=?, perc=?, magazzino=?, operatore=?, inventario=?, iddocumento=?, reso=? WHERE Id=?";
                    $pdo->prepare($sql)->execute([$data, $cod_articolo, $fornitore, $protocollo, $lotto, $quantita, $importo, $perc, $magazzino, $operatore, $inventario, $iddocumento, $reso, $id]);
                } else {
                    $sql = "INSERT INTO carichi (Id, Data, Cod_articolo, Fornitore, protocollo, lotto, quantita, Importo, perc, magazzino, operatore, inventario, iddocumento, reso, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                    $pdo->prepare($sql)->execute([$id, $data, $cod_articolo, $fornitore, $protocollo, $lotto, $quantita, $importo, $perc, $magazzino, $operatore, $inventario, $iddocumento, $reso]);
                }
            } else {
                $sql = "INSERT INTO carichi (Data, Cod_articolo, Fornitore, protocollo, lotto, quantita, Importo, perc, magazzino, operatore, inventario, iddocumento, reso, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                $pdo->prepare($sql)->execute([$data, $cod_articolo, $fornitore, $protocollo, $lotto, $quantita, $importo, $perc, $magazzino, $operatore, $inventario, $iddocumento, $reso]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_carico':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) {
                $pdo->prepare("DELETE FROM carichi WHERE Id = ?")->execute([$id]);
                echo json_encode(["success" => true]);
            } else { echo json_encode(["success" => false]); }
            break;        
		
		case 'scarichi':
            $stmt = $pdo->query("SELECT * FROM scarichi ORDER BY Data DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'trasferimenti':
            $stmt = $pdo->query("SELECT * FROM trasferimenti ORDER BY data DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'prima_nota':
            $stmt = $pdo->query("SELECT * FROM prima_nota_casa ORDER BY data DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'scadenzario':
            $stmt = $pdo->query("SELECT * FROM scadenzario ORDER BY data ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        // --- BATCH 5: FATTURAZIONE ---
		case 'fatture':
            // Legge l'anno dalla richiesta, altrimenti usa l'anno in corso
            $anno = isset($_GET['anno']) ? (int)$_GET['anno'] : date('Y');
            
            // Estrae SOLO i documenti dell'anno richiesto! (Velocità 100x)
            $stmt = $pdo->prepare("SELECT *, `num-ext` AS num_ext FROM fatture WHERE YEAR(datafatt) = :anno ORDER BY datafatt DESC, Num DESC");
            $stmt->execute([':anno' => $anno]);
            
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;        case 'fatturecorpo':
            $stmt = $pdo->query("SELECT * FROM fatturecorpo ORDER BY IDFatt DESC, ordine ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

// --- CHIAMATA MIRATA PER CHIAVE PRIMARIA (Usata dall'estratto conto magazzino) ---
        case 'get_fattura':
            // Riceviamo l'iddocumento dal frontend (che noi chiamiamo 'id' nella url)
            $idFattura = isset($_GET['id']) ? (int)$_GET['id'] : 0;
            
            if ($idFattura > 0) {
                // Cerchiamo ESATTAMENTE la chiave primaria `ID` nella tabella `fatture`
                $sql = "SELECT *, `num-ext` AS num_ext FROM fatture WHERE ID = :id LIMIT 1";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':id' => $idFattura]);
                
                $doc = $stmt->fetch(PDO::FETCH_ASSOC);
                
                // Se la fattura esiste, la restituiamo a React
                if ($doc) {
                    echo json_encode($doc, JSON_UNESCAPED_UNICODE);
                } else {
                    echo json_encode(["error" => "Documento non trovato nel database"]);
                }
            } else {
                echo json_encode(["error" => "Nessun ID fornito"]);
            }
            break;

		// --- CHIAMATA MIRATA PER LE RIGHE DI UNA SINGOLA FATTURA ---
        case 'get_righe_fattura':
            $idFattura = isset($_GET['id']) ? (int)$_GET['id'] : 0;
            if ($idFattura > 0) {
                $stmt = $pdo->prepare("SELECT * FROM fatturecorpo WHERE IDFatt = :id ORDER BY ordine ASC");
                $stmt->execute([':id' => $idFattura]);
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            } else {
                echo json_encode([]);
            }
            break;
			
		// --- SALVATAGGIO E ELIMINAZIONE (PRIMA NOTA E SCADENZARIO) ---
        case 'save_movimento':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : 0;
            $table = (isset($input['isScadenzario']) && $input['isScadenzario']) ? 'scadenzario' : 'prima_nota_casa';

            $data = $input['data'] ?? date('Y-m-d');
            $descrizione = $input['descrizione'] ?? '';
            $IdCliente = (int)($input['IdCliente'] ?? 0);
            $Categoria = (int)($input['Categoria'] ?? 1);
            $TipoMovimento = (int)($input['TipoMovimento'] ?? 0);
            $mezzopag = (int)($input['mezzopag'] ?? 1);
            $cr = $input['C-R'] ?? 'C';
            $Dare = (float)($input['Dare'] ?? 0);
            $Avere = (float)($input['Avere'] ?? 0);
            $imponibile = (float)($input['imponibile'] ?? 0);
            $iva = (float)($input['iva'] ?? 0);
            $numdoc = $input['numdoc'] ?? '';
            $rifinterno = $input['rifinterno'] ?? '';
            $note = $input['note'] ?? '';
            $chiuso = (int)($input['chiuso'] ?? 0);
            $IdFattura = (int)($input['idFattura'] ?? $input['IdFattura'] ?? $input['idfattura'] ?? 0);

            if ($id > 0) {
                $sql = "UPDATE `$table` SET data=:data, descrizione=:descrizione, IdCliente=:IdCliente, Categoria=:Categoria, TipoMovimento=:TipoMovimento, mezzopag=:mezzopag, `C-R`=:cr, Dare=:Dare, Avere=:Avere, imponibile=:imponibile, iva=:iva, numdoc=:numdoc, rifinterno=:rifinterno, note=:note, chiuso=:chiuso, IdFattura=:IdFattura WHERE Id=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':data'=>$data, ':descrizione'=>$descrizione, ':IdCliente'=>$IdCliente, ':Categoria'=>$Categoria, ':TipoMovimento'=>$TipoMovimento, ':mezzopag'=>$mezzopag, ':cr'=>$cr, ':Dare'=>$Dare, ':Avere'=>$Avere, ':imponibile'=>$imponibile, ':iva'=>$iva, ':numdoc'=>$numdoc, ':rifinterno'=>$rifinterno, ':note'=>$note, ':chiuso'=>$chiuso, ':IdFattura'=>$IdFattura, ':id'=>$id]);
                echo json_encode(["success" => true, "id" => $id]);
            } else {
                $sql = "INSERT INTO `$table` (IdAzienda, data, descrizione, IdCliente, Categoria, TipoMovimento, mezzopag, `C-R`, Dare, Avere, imponibile, iva, numdoc, rifinterno, note, chiuso, IdFattura) VALUES (1, :data, :descrizione, :IdCliente, :Categoria, :TipoMovimento, :mezzopag, :cr, :Dare, :Avere, :imponibile, :iva, :numdoc, :rifinterno, :note, :chiuso, :IdFattura)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':data'=>$data, ':descrizione'=>$descrizione, ':IdCliente'=>$IdCliente, ':Categoria'=>$Categoria, ':TipoMovimento'=>$TipoMovimento, ':mezzopag'=>$mezzopag, ':cr'=>$cr, ':Dare'=>$Dare, ':Avere'=>$Avere, ':imponibile'=>$imponibile, ':iva'=>$iva, ':numdoc'=>$numdoc, ':rifinterno'=>$rifinterno, ':note'=>$note, ':chiuso'=>$chiuso, ':IdFattura'=>$IdFattura]);
                echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
            }
            break;

        case 'delete_movimento':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : 0;
            $table = (isset($input['isScadenzario']) && $input['isScadenzario']) ? 'scadenzario' : 'prima_nota_casa';
            if ($id > 0) {
                $stmt = $pdo->prepare("DELETE FROM `$table` WHERE Id = :id");
                $stmt->execute([':id' => $id]);
                echo json_encode(["success" => true]);
            }
            break;

        // --- SALVATAGGIO IMPOSTAZIONI E ARCHIVI ---
        case 'save_tipodoc':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            $desc = $input['descrizione'] ?? '';
            $suff = $input['suffisso'] ?? '';
            $codtipo = $input['codtipo'] ?? '';
            $ord = (int)($input['ordine_vis'] ?? 0);
            $clifor = (int)($input['clifor'] ?? 0);
            $movmagaz = $input['movmagaz'] ?? '';
            $da = $input['da'] ?? '';
            $idmastro = (int)($input['idmastro'] ?? 0);
            $idmovpnota = (int)($input['idmovpnota'] ?? 0);
            $idmovscad = (int)($input['idmovscad'] ?? 0);

            if ($id > 0) {
                $sql = "UPDATE tipodoc SET Tipo=:desc, suffisso=:suff, codtipo=:codtipo, ordine_vis=:ord, clifor=:clifor, tipomov=:movmagaz, `D-A`=:da, idmastro=:idmastro, idmovpnota=:idmovpnota, idmovscad=:idmovscad WHERE Id=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':desc'=>$desc, ':suff'=>$suff, ':codtipo'=>$codtipo, ':ord'=>$ord, ':clifor'=>$clifor, ':movmagaz'=>$movmagaz, ':da'=>$da, ':idmastro'=>$idmastro, ':idmovpnota'=>$idmovpnota, ':idmovscad'=>$idmovscad, ':id'=>$id]);
                echo json_encode(["success" => true]);
            } else {
                $sql = "INSERT INTO tipodoc (Tipo, suffisso, codtipo, ordine_vis, clifor, tipomov, `D-A`, idmastro, idmovpnota, idmovscad) VALUES (:desc, :suff, :codtipo, :ord, :clifor, :movmagaz, :da, :idmastro, :idmovpnota, :idmovscad)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':desc'=>$desc, ':suff'=>$suff, ':codtipo'=>$codtipo, ':ord'=>$ord, ':clifor'=>$clifor, ':movmagaz'=>$movmagaz, ':da'=>$da, ':idmastro'=>$idmastro, ':idmovpnota'=>$idmovpnota, ':idmovscad'=>$idmovscad]);
                echo json_encode(["success" => true]);
            }
            break;

        case 'delete_tipodoc':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) {
                $stmt = $pdo->prepare("DELETE FROM tipodoc WHERE Id = :id");
                $stmt->execute([':id' => $id]);
                echo json_encode(["success" => true]);
            }
            break;

        // --- SALVATAGGIO BANCHE E MAGAZZINI ---
        case 'save_banca':
            $input = json_decode(file_get_contents('php://input'), true);
            $iban = $input['id'] ?? ''; 
            $nomebanca = $input['nomebanca'] ?? '';
            $note = $input['Note'] ?? '';
            $isNew = isset($input['isNew']) ? $input['isNew'] : false;

            if ($iban) {
                if ($isNew) {
                    $stmt = $pdo->prepare("INSERT INTO banche (iban, nomebanca, Note) VALUES (:iban, :nomebanca, :note)");
                } else {
                    $stmt = $pdo->prepare("UPDATE banche SET nomebanca=:nomebanca, Note=:note WHERE iban=:iban");
                }
                $stmt->execute([':nomebanca'=>$nomebanca, ':note'=>$note, ':iban'=>$iban]);
                echo json_encode(["success" => true]);
            } else {
                echo json_encode(["success" => false, "message" => "IBAN mancante"]);
            }
            break;

        case 'delete_banca':
            $input = json_decode(file_get_contents('php://input'), true);
            $iban = $input['id'] ?? '';
            if ($iban) {
                $stmt = $pdo->prepare("DELETE FROM banche WHERE iban = :iban");
                $stmt->execute([':iban' => $iban]);
                echo json_encode(["success" => true]);
            }
            break;

// --- SALVATAGGIO MAGAZZINI ---
        case 'save_magazzino':
            $input = json_decode(file_get_contents('php://input'), true);
            $cod = isset($input['cod']) ? (int)$input['cod'] : 0;
            $desc = $input['Descrizione'] ?? '';
            $attivo = isset($input['attivo']) ? (int)$input['attivo'] : 1;
            
            // Nuovi campi allineati al tracciato DB reale
            $aperto = (int)($input['aperto'] ?? 0);
            $registratore = (int)($input['registratore'] ?? 1); 
            $display = (int)($input['display'] ?? 0);
            $lbarcode = (int)($input['lbarcode'] ?? 17); 
            $tipost = (int)($input['tipost'] ?? -1); // 0 = SERVER, -1 = CLIENT
            $matricola = $input['matricola'] ?? '';
            $stampante = $input['stampante'] ?? ''; 
            $ultimosc = (int)($input['ultimosc'] ?? 0);
            $ultimafat = (int)($input['ultimafat'] ?? 0);
            $ultimach = (int)($input['ultimach'] ?? 0);

            if ($cod > 0) {
                $stmt = $pdo->prepare("SELECT cod FROM magazzini WHERE cod = ?"); 
                $stmt->execute([$cod]);
                if ($stmt->fetch()) {
                    $sql = "UPDATE magazzini SET Descrizione=?, attivo=?, aperto=?, registratore=?, display=?, lbarcode=?, tipost=?, matricola=?, stampante=?, ultimosc=?, ultimafat=?, ultimach=? WHERE cod=?";
                    $pdo->prepare($sql)->execute([$desc, $attivo, $aperto, $registratore, $display, $lbarcode, $tipost, $matricola, $stampante, $ultimosc, $ultimafat, $ultimach, $cod]);
                } else {
                    $sql = "INSERT INTO magazzini (cod, Descrizione, attivo, aperto, registratore, display, lbarcode, tipost, matricola, stampante, ultimosc, ultimafat, ultimach) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                    $pdo->prepare($sql)->execute([$cod, $desc, $attivo, $aperto, $registratore, $display, $lbarcode, $tipost, $matricola, $stampante, $ultimosc, $ultimafat, $ultimach]);
                }
            } else {
                $sql = "INSERT INTO magazzini (Descrizione, attivo, aperto, registratore, display, lbarcode, tipost, matricola, stampante, ultimosc, ultimafat, ultimach) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $pdo->prepare($sql)->execute([$desc, $attivo, $aperto, $registratore, $display, $lbarcode, $tipost, $matricola, $stampante, $ultimosc, $ultimafat, $ultimach]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_magazzino':
            $input = json_decode(file_get_contents('php://input'), true);
            $cod = isset($input['cod']) ? (int)$input['cod'] : 0;
            if ($cod > 0) {
                $stmt = $pdo->prepare("DELETE FROM magazzini WHERE cod = :cod");
                $stmt->execute([':cod' => $cod]);
                echo json_encode(["success" => true]);
            }
            break;

        // --- SALVATAGGIO FATTURE E AGGIORNAMENTO TOTALI ---
        case 'save_fattura':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            
            $IdAzienda = (int)($input['IdAzienda'] ?? 1);
            $Num = (int)($input['Num'] ?? 0);
            $Tipo = (int)($input['Tipo'] ?? 1);
            $datafatt = $input['datafatt'] ?? date('Y-m-d');
            $IDCliente = (int)($input['IDCliente'] ?? 0);
            $ModPag = (int)($input['ModPag'] ?? 1);
            $codmag = (int)($input['codmag'] ?? 1);
            $cod_agente = (int)($input['cod_agente'] ?? 0);
            $provv = (float)($input['provv'] ?? 0);
            $Note = $input['Note'] ?? '';
            $num_ext = $input['num_ext'] ?? '';
            $RifDdt = $input['RifDdt'] ?? '';
            $impondoc = (float)($input['impondoc'] ?? 0);
            $ivadoc = (float)($input['ivadoc'] ?? 0);

            if ($id > 0) {
                $sql = "UPDATE fatture SET Num=:Num, Tipo=:Tipo, datafatt=:datafatt, IDCliente=:IDCliente, ModPag=:ModPag, codmag=:codmag, cod_agente=:cod_agente, provv=:provv, Note=:Note, `num-ext`=:num_ext, RifDdt=:RifDdt, impondoc=:impondoc, ivadoc=:ivadoc WHERE ID=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':Num'=>$Num, ':Tipo'=>$Tipo, ':datafatt'=>$datafatt, ':IDCliente'=>$IDCliente, ':ModPag'=>$ModPag, ':codmag'=>$codmag, ':cod_agente'=>$cod_agente, ':provv'=>$provv, ':Note'=>$Note, ':num_ext'=>$num_ext, ':RifDdt'=>$RifDdt, ':impondoc'=>$impondoc, ':ivadoc'=>$ivadoc, ':id'=>$id]);
                echo json_encode(["success" => true, "id" => $id]);
            } else {
                $anno = date('Y', strtotime($datafatt)); 
                $key = str_pad($Tipo, 2, "0", STR_PAD_LEFT) . "-" . 
                       str_pad($IdAzienda, 5, "0", STR_PAD_LEFT) . 
                       str_pad($anno, 5, "0", STR_PAD_LEFT) . 
                       str_pad($Num, 5, "0", STR_PAD_LEFT);

                $sql = "INSERT INTO fatture (IdAzienda, Num, Tipo, datafatt, IDCliente, ModPag, codmag, cod_agente, provv, Note, `num-ext`, RifDdt, impondoc, ivadoc, TS, `key`) 
                        VALUES (:IdAzienda, :Num, :Tipo, :datafatt, :IDCliente, :ModPag, :codmag, :cod_agente, :provv, :Note, :num_ext, :RifDdt, :impondoc, :ivadoc, NOW(), :key)";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([
                    ':IdAzienda'=>$IdAzienda, ':Num'=>$Num, ':Tipo'=>$Tipo, ':datafatt'=>$datafatt, 
                    ':IDCliente'=>$IDCliente, ':ModPag'=>$ModPag, ':codmag'=>$codmag, 
                    ':cod_agente'=>$cod_agente, ':provv'=>$provv, ':Note'=>$Note, 
                    ':num_ext'=>$num_ext, ':RifDdt'=>$RifDdt, ':impondoc'=>$impondoc, 
                    ':ivadoc'=>$ivadoc, ':key'=>$key
                ]);
                echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
            }
            break;

        case 'update_fattura_totali':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            $impondoc = (float)($input['impondoc'] ?? 0);
            $ivadoc = (float)($input['ivadoc'] ?? 0);
            
            if ($id > 0) {
                $stmt = $pdo->prepare("UPDATE fatture SET impondoc = :impondoc, ivadoc = :ivadoc WHERE ID = :id");
                $stmt->execute([':impondoc' => $impondoc, ':ivadoc' => $ivadoc, ':id' => $id]);
                echo json_encode(["success" => true]);
            }
            break;
            
        // --- SALVATAGGIO RIGHE FATTURA (FATTURECORPO) ---
        case 'save_fatturacorpo':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            
            $IDFatt = (int)($input['IDFatt'] ?? 0);
            $Codart = $input['Codart'] ?? '';
            $Descrzione = $input['Descrzione'] ?? '';
            $Quant = (float)($input['Quant'] ?? 0);
            $ImpUnit = (float)($input['ImpUnit'] ?? 0);
            $Iva = (int)($input['Iva'] ?? 1);
            $Magazz = (int)($input['Magazz'] ?? 1);
            $ttiva = (float)($input['ttiva'] ?? 0);
            $sconto = (float)($input['sconto'] ?? 0);
            $unmis = $input['unmis'] ?? 'PZ';
            $impon = (float)($input['impon'] ?? 0);
            $imposta = (float)($input['imposta'] ?? 0);
            $ordine = (int)($input['ordine'] ?? 0);

            if ($id > 0) {
                $sql = "UPDATE fatturecorpo SET Codart=:Codart, Descrzione=:Descrzione, Quant=:Quant, ImpUnit=:ImpUnit, Iva=:Iva, Magazz=:Magazz, ttiva=:ttiva, sconto=:sconto, unmis=:unmis, impon=:impon, imposta=:imposta, ordine=:ordine WHERE ID=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':Codart'=>$Codart, ':Descrzione'=>$Descrzione, ':Quant'=>$Quant, ':ImpUnit'=>$ImpUnit, ':Iva'=>$Iva, ':Magazz'=>$Magazz, ':ttiva'=>$ttiva, ':sconto'=>$sconto, ':unmis'=>$unmis, ':impon'=>$impon, ':imposta'=>$imposta, ':ordine'=>$ordine, ':id'=>$id]);
                echo json_encode(["success" => true]);
            } else {
                $sql = "INSERT INTO fatturecorpo (IDFatt, Codart, Descrzione, Quant, ImpUnit, Iva, Magazz, ttiva, sconto, unmis, impon, imposta, ordine, TS) VALUES (:IDFatt, :Codart, :Descrzione, :Quant, :ImpUnit, :Iva, :Magazz, :ttiva, :sconto, :unmis, :impon, :imposta, :ordine, NOW())";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':IDFatt'=>$IDFatt, ':Codart'=>$Codart, ':Descrzione'=>$Descrzione, ':Quant'=>$Quant, ':ImpUnit'=>$ImpUnit, ':Iva'=>$Iva, ':Magazz'=>$Magazz, ':ttiva'=>$ttiva, ':sconto'=>$sconto, ':unmis'=>$unmis, ':impon'=>$impon, ':imposta'=>$imposta, ':ordine'=>$ordine]);
                echo json_encode(["success" => true]);
            }
            break;

        case 'delete_fatturacorpo':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            if ($id > 0) {
                $stmt = $pdo->prepare("DELETE FROM fatturecorpo WHERE ID = :id");
                $stmt->execute([':id' => $id]);
                echo json_encode(["success" => true]);
            }
            break;

		case 'delete_fattura':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            if ($id > 0) {
                // 1. Elimina prima tutte le righe collegate (Integrità referenziale)
                $stmt = $pdo->prepare("DELETE FROM fatturecorpo WHERE IDFatt = :id");
                $stmt->execute([':id' => $id]);
                
                // 2. Elimina la testata del documento
                $stmt = $pdo->prepare("DELETE FROM fatture WHERE ID = :id");
                $stmt->execute([':id' => $id]);
                
                echo json_encode(["success" => true]);
            } else {
                echo json_encode(["success" => false, "message" => "ID mancante"]);
            }
            break;

// --- SALVATAGGIO E ELIMINAZIONE CLIENTI ---
        case 'save_cliente':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            
            $ragione = $input['Ragione_Sociale'] ?? $input['Ragione Sociale'] ?? '';
            $indirizzo = $input['Indirizzo'] ?? '';
            $cap = $input['CAP'] ?? '';
            $comune = $input['Comune'] ?? '';
            $prov = $input['Prov'] ?? '';
            $pi = $input['PI'] ?? '';
            $cf = $input['CF'] ?? '';
            $tel = $input['telefono'] ?? '';
            $email = $input['email'] ?? '';
            $emaildoc = $input['emaildoc'] ?? ''; // <-- FIX: Lettura del nuovo campo
            $pec = $input['PEC'] ?? '';
            $tipocli = (int)($input['tipocli'] ?? 1);
            $tipodest = (int)($input['tipodest'] ?? 1);
            $nome = $input['Nome'] ?? '';
            $cognome = $input['Cognome'] ?? '';
            $coduff = $input['coduff'] ?? '';
            $split = (int)($input['split'] ?? 0);
            $modpag = (int)($input['Mod_Pagamento'] ?? 1);
            $iban = $input['IBAN'] ?? '';
            $agente = (int)($input['cod_agente'] ?? 0);
            $listino = (int)($input['cod_Listino'] ?? 1);
            $sconto = (float)($input['sconto'] ?? 0);
            $fido = (float)($input['fido'] ?? 0);
            $attivo = $input['attivo'] ?? 'SI';
            $note = $input['Note'] ?? '';

            if ($id > 0) {
                // FIX: Aggiunto emaildoc nell'UPDATE
                $sql = "UPDATE clienti SET `Ragione Sociale`=:ragione, Indirizzo=:indirizzo, CAP=:cap, Comune=:comune, Prov=:prov, PI=:pi, CF=:cf, telefono=:tel, email=:email, emaildoc=:emaildoc, PEC=:pec, tipocli=:tipocli, tipodest=:tipodest, Nome=:nome, Cognome=:cognome, coduff=:coduff, split=:split, Mod_Pagamento=:modpag, IBAN=:iban, cod_agente=:agente, cod_Listino=:listino, sconto=:sconto, fido=:fido, attivo=:attivo, Note=:note WHERE ID=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':ragione'=>$ragione, ':indirizzo'=>$indirizzo, ':cap'=>$cap, ':comune'=>$comune, ':prov'=>$prov, ':pi'=>$pi, ':cf'=>$cf, ':tel'=>$tel, ':email'=>$email, ':emaildoc'=>$emaildoc, ':pec'=>$pec, ':tipocli'=>$tipocli, ':tipodest'=>$tipodest, ':nome'=>$nome, ':cognome'=>$cognome, ':coduff'=>$coduff, ':split'=>$split, ':modpag'=>$modpag, ':iban'=>$iban, ':agente'=>$agente, ':listino'=>$listino, ':sconto'=>$sconto, ':fido'=>$fido, ':attivo'=>$attivo, ':note'=>$note, ':id'=>$id]);
                echo json_encode(["success" => true, "id" => $id]);
            } else {
                // FIX: Aggiunto emaildoc nell'INSERT
                $sql = "INSERT INTO clienti (`Ragione Sociale`, Indirizzo, CAP, Comune, Prov, PI, CF, telefono, email, emaildoc, PEC, tipocli, tipodest, Nome, Cognome, coduff, split, Mod_Pagamento, IBAN, cod_agente, cod_Listino, sconto, fido, attivo, Note, TS) VALUES (:ragione, :indirizzo, :cap, :comune, :prov, :pi, :cf, :tel, :email, :emaildoc, :pec, :tipocli, :tipodest, :nome, :cognome, :coduff, :split, :modpag, :iban, :agente, :listino, :sconto, :fido, :attivo, :note, NOW())";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':ragione'=>$ragione, ':indirizzo'=>$indirizzo, ':cap'=>$cap, ':comune'=>$comune, ':prov'=>$prov, ':pi'=>$pi, ':cf'=>$cf, ':tel'=>$tel, ':email'=>$email, ':emaildoc'=>$emaildoc, ':pec'=>$pec, ':tipocli'=>$tipocli, ':tipodest'=>$tipodest, ':nome'=>$nome, ':cognome'=>$cognome, ':coduff'=>$coduff, ':split'=>$split, ':modpag'=>$modpag, ':iban'=>$iban, ':agente'=>$agente, ':listino'=>$listino, ':sconto'=>$sconto, ':fido'=>$fido, ':attivo'=>$attivo, ':note'=>$note]);
                echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
            }
            break;

// --- CONTABILIZZAZIONE DOCUMENTO ---
        case 'contabilizza_documento':
            $input = json_decode(file_get_contents('php://input'), true);
            $docId = (int)($input['docId'] ?? 0);
            $primaNota = $input['primaNota'] ?? [];
            $scadenzario = $input['scadenzario'] ??[];

            if ($docId === 0) {
                echo json_encode(["success" => false, "message" => "ID Documento mancante"]);
                break;
            }

            try {
                // Iniziamo una transazione: o salva tutto, o annulla tutto in caso di errore
                $pdo->beginTransaction();

                // 1. Inserimento movimenti in Prima Nota
                if (count($primaNota) > 0) {
                    $sqlPN = "INSERT INTO prima_nota_casa (IdAzienda, data, descrizione, IdCliente, Categoria, TipoMovimento, mezzopag, `C-R`, Dare, Avere, imponibile, iva, numdoc, rifinterno, chiuso, datachiusura, IdFattura, TS) 
                              VALUES (1, :data, :descrizione, :IdCliente, :Categoria, :TipoMovimento, :mezzopag, :cr, :Dare, :Avere, :imponibile, :iva, :numdoc, :rifinterno, :chiuso, :datachiusura, :IdFattura, NOW())";
                    $stmtPN = $pdo->prepare($sqlPN);
                    foreach ($primaNota as $pn) {
                        $stmtPN->execute([
                            ':data' => $pn['data'], ':descrizione' => $pn['descrizione'], ':IdCliente' => $pn['IdCliente'],
                            ':Categoria' => $pn['Categoria'], ':TipoMovimento' => $pn['TipoMovimento'], ':mezzopag' => $pn['mezzopag'],
                            ':cr' => $pn['C-R'], ':Dare' => $pn['Dare'], ':Avere' => $pn['Avere'], ':imponibile' => $pn['imponibile'],
                            ':iva' => $pn['iva'], ':numdoc' => $pn['numdoc'], ':rifinterno' => $pn['rifinterno'], 
                            ':chiuso' => $pn['chiuso'], ':datachiusura' => $pn['datachiusura'], ':IdFattura' => $pn['IdFattura']
                        ]);
                    }
                }

                // 2. Inserimento movimenti in Scadenzario
                if (count($scadenzario) > 0) {
                    $sqlScad = "INSERT INTO scadenzario (IdAzienda, data, descrizione, IdCliente, Categoria, TipoMovimento, mezzopag, `C-R`, Dare, Avere, imponibile, iva, numdoc, rifinterno, chiuso, idfattura, TS) 
                                VALUES (1, :data, :descrizione, :IdCliente, :Categoria, :TipoMovimento, :mezzopag, :cr, :Dare, :Avere, :imponibile, :iva, :numdoc, :rifinterno, :chiuso, :idfattura, NOW())";
                    $stmtScad = $pdo->prepare($sqlScad);
                    foreach ($scadenzario as $sc) {
                        $stmtScad->execute([
                            ':data' => $sc['data'], ':descrizione' => $sc['descrizione'], ':IdCliente' => $sc['IdCliente'],
                            ':Categoria' => $sc['Categoria'], ':TipoMovimento' => $sc['TipoMovimento'], ':mezzopag' => $sc['mezzopag'],
                            ':cr' => $sc['C-R'], ':Dare' => $sc['Dare'], ':Avere' => $sc['Avere'], ':imponibile' => $sc['imponibile'],
                            ':iva' => $sc['iva'], ':numdoc' => $sc['numdoc'], ':rifinterno' => $sc['rifinterno'], 
                            ':chiuso' => $sc['chiuso'], ':idfattura' => $sc['IdFattura']
                        ]);
                    }
                }

                // 3. Aggiorna lo stato della fattura (registrata = 1, datareg = oggi)
                $stmtFatt = $pdo->prepare("UPDATE fatture SET registrata = -1, datareg = CURDATE() WHERE ID = :id");
                $stmtFatt->execute([':id' => $docId]);

                $pdo->commit();
                echo json_encode(["success" => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;


		// --- MOVIMENTAZIONE MAGAZZINO ---
        case 'movimenta_magazzino':
            $input = json_decode(file_get_contents('php://input'), true);
            $docId = (int)($input['docId'] ?? 0);
            $tipoMov = $input['tipoMov'] ?? ''; // 'C', 'S', 'T'
            $magin = (int)($input['magin'] ?? 0);
            $magout = (int)($input['magout'] ?? 0);
            $righe = $input['righe'] ??[];
            $docData = $input['docData'] ??[];

            if ($docId === 0 || empty($tipoMov) || empty($righe)) {
                echo json_encode(["success" => false, "message" => "Dati mancanti"]);
                break;
            }

            try {
                $pdo->beginTransaction();

                // Formattazione data per la descrizione (es. 10/05/2026)
                $dataFormattata = date('d/m/Y', strtotime($docData['data']));
                $descrizioneDoc = $docData['tipoDesc'] . " n. " . $docData['num'] . " del " . $dataFormattata;

                foreach ($righe as $riga) {
                    $codart = $riga['Codart'];
                    
                    // 1. Verifica se l'articolo esiste realmente in anagrafica
                    $stmtArt = $pdo->prepare("SELECT id FROM articoli_prisma WHERE Codice = :cod LIMIT 1");
                    $stmtArt->execute([':cod' => $codart]);
                    if (!$stmtArt->fetch()) {
                        continue; // Salta la riga se l'articolo non è in anagrafica (es. riga descrittiva)
                    }

                    $qta = (float)$riga['Quant'];
                    
                    // FIX: Calcolo del prezzo netto scontato
                    $prezzoLordo = (float)$riga['ImpUnit'];
                    $sconto = (float)($riga['sconto'] ?? 0);
                    // Calcola il netto e arrotonda a 2 decimali
                    $prezzoNetto = round($prezzoLordo * (1 - ($sconto / 100)), 2);

                    // 2. Inserimento nella tabella corretta usando il PREZZO NETTO
                    if ($tipoMov === 'C') {
                        $sql = "INSERT INTO carichi (Data, Cod_articolo, Fornitore, protocollo, quantita, Importo, magazzino, iddocumento, TS) 
                                VALUES (:data, :codart, :fornitore, :prot, :qta, :imp, :mag, :iddoc, NOW())";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute([
                            ':data' => $docData['data'], ':codart' => $codart, ':fornitore' => $docData['idCliente'],
                            ':prot' => $descrizioneDoc, ':qta' => $qta, 
                            ':imp' => $prezzoNetto, // <-- PREZZO SCONTATO
                            ':mag' => $magin, ':iddoc' => $docId
                        ]);
                    } elseif ($tipoMov === 'S') {
                        $sql = "INSERT INTO scarichi (Data, Cod_Cliente, Riferimento, Cod_articolo, quantita, Pr_Unit, magazzino, iddocumento, TS) 
                                VALUES (:data, :cliente, :rif, :codart, :qta, :prezzo, :mag, :iddoc, NOW())";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute([
                            ':data' => $docData['data'], ':cliente' => $docData['idCliente'], ':rif' => $descrizioneDoc,
                            ':codart' => $codart, ':qta' => $qta, 
                            ':prezzo' => $prezzoNetto, // <-- PREZZO SCONTATO
                            ':mag' => $magout, ':iddoc' => $docId
                        ]);
                    } elseif ($tipoMov === 'T') {
                        $sql = "INSERT INTO trasferimenti (data, codice, magout, magin, quant, iddocumento, TS) 
                                VALUES (:data, :codart, :magout, :magin, :qta, :iddoc, NOW())";
                        $stmt = $pdo->prepare($sql);
                        $stmt->execute([
                            ':data' => $docData['data'], ':codart' => $codart, ':magout' => $magout,
                            ':magin' => $magin, ':qta' => $qta, ':iddoc' => $docId
                        ]);
                    }
                }

                // 3. Aggiorna lo stato della fattura (caricata = 1)
                $stmtFatt = $pdo->prepare("UPDATE fatture SET caricata = -1 WHERE ID = :id");
                $stmtFatt->execute([':id' => $docId]);

                $pdo->commit();
                echo json_encode(["success" => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;

		// --- TOGGLE STATO DOCUMENTO E DOWNGRADE ---
        case 'toggle_document_status':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            $field = $input['field'] ?? '';
            $value = (int)($input['value'] ?? 0); // 0 = Falso, -1 = Vero

            if ($id === 0 || !in_array($field, ['verificato', 'registrata', 'caricata', 'accorpa'])) {
                echo json_encode(["success" => false, "message" => "Dati non validi"]);
                break;
            }

            try {
                $pdo->beginTransaction();

                // DOWNGRADE CONTABILITÀ
                if ($field === 'registrata' && $value === 0) {
                    // Elimina da Prima Nota (chiave: IdFattura)
                    $stmtPN = $pdo->prepare("DELETE FROM prima_nota_casa WHERE IdFattura = :id");
                    $stmtPN->execute([':id' => $id]);
                    
                    // Elimina da Scadenzario (chiave: idfattura)
                    $stmtScad = $pdo->prepare("DELETE FROM scadenzario WHERE idfattura = :id");
                    $stmtScad->execute([':id' => $id]);
                }

                // DOWNGRADE MAGAZZINO
                if ($field === 'caricata' && $value === 0) {
                    // Elimina da Carichi, Scarichi e Trasferimenti (chiave: iddocumento)
                    $pdo->prepare("DELETE FROM carichi WHERE iddocumento = :id")->execute([':id' => $id]);
                    $pdo->prepare("DELETE FROM scarichi WHERE iddocumento = :id")->execute([':id' => $id]);
                    $pdo->prepare("DELETE FROM trasferimenti WHERE iddocumento = :id")->execute([':id' => $id]);
                }
				
				// DOWNGRADE ACCORPAMENTO
                if ($field === 'accorpa' && $value === 0) {
                    // L'id ricevuto è la Fattura Differita. Sganciamo tutti i DDT collegati!
                    $pdo->prepare("UPDATE fatture SET accorpa = 0, idaccorpa = 0 WHERE idaccorpa = :id")->execute([':id' => $id]);
                }

                // Aggiorna lo stato sulla fattura
                $stmt = $pdo->prepare("UPDATE fatture SET `$field` = :val WHERE ID = :id");
                $stmt->execute([':val' => $value, ':id' => $id]);

                $pdo->commit();
                echo json_encode(["success" => true]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;

		// --- OPERAZIONI MASSIVE ---
        case 'mass_movimenta_magazzino':
            $input = json_decode(file_get_contents('php://input'), true);
            $docIds = $input['docIds'] ??[];
            if (empty($docIds)) { echo json_encode(["success" => false, "message" => "Nessun documento selezionato"]); break; }

            $processed =[];
            try {
                $pdo->beginTransaction();
                foreach ($docIds as $docId) {
                    $stmtDoc = $pdo->prepare("SELECT f.*, t.movmagaz, t.Tipo as tipoDesc FROM fatture f JOIN tipodoc t ON f.Tipo = t.Id WHERE f.ID = :id");
                    $stmtDoc->execute([':id' => $docId]);
                    $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);

                    if (!$doc || empty($doc['movmagaz']) || $doc['caricata'] != 0) continue;

                    $tipoMov = $doc['movmagaz'];
                    $magin = $tipoMov === 'C' ? $doc['codmag'] : 1;
                    $magout = ($tipoMov === 'S' || $tipoMov === 'T') ? $doc['codmag'] : 1;
                    $dataFormattata = date('d/m/Y', strtotime($doc['datafatt']));
                    $descrizioneDoc = $doc['tipoDesc'] . " n. " . $doc['Num'] . " del " . $dataFormattata;

                    $stmtRighe = $pdo->prepare("SELECT * FROM fatturecorpo WHERE IDFatt = :id");
                    $stmtRighe->execute([':id' => $docId]);
                    $righe = $stmtRighe->fetchAll(PDO::FETCH_ASSOC);

                    foreach ($righe as $riga) {
                        $codart = $riga['Codart'];
                        $stmtArt = $pdo->prepare("SELECT id FROM articoli_prisma WHERE Codice = :cod LIMIT 1");
                        $stmtArt->execute([':cod' => $codart]);
                        if (!$stmtArt->fetch()) continue;

                        $qta = (float)$riga['Quant'];
                        $prezzoNetto = round((float)$riga['ImpUnit'] * (1 - ((float)($riga['sconto'] ?? 0) / 100)), 2);

                        if ($tipoMov === 'C') {
                            $pdo->prepare("INSERT INTO carichi (Data, Cod_articolo, Fornitore, protocollo, quantita, Importo, magazzino, iddocumento, TS) VALUES (:data, :codart, :fornitore, :prot, :qta, :imp, :mag, :iddoc, NOW())")
                                ->execute([':data' => $doc['datafatt'], ':codart' => $codart, ':fornitore' => $doc['IDCliente'], ':prot' => $descrizioneDoc, ':qta' => $qta, ':imp' => $prezzoNetto, ':mag' => $magin, ':iddoc' => $docId]);
                        } elseif ($tipoMov === 'S') {
                            $pdo->prepare("INSERT INTO scarichi (Data, Cod_Cliente, Riferimento, Cod_articolo, quantita, Pr_Unit, magazzino, iddocumento, TS) VALUES (:data, :cliente, :rif, :codart, :qta, :prezzo, :mag, :iddoc, NOW())")
                                ->execute([':data' => $doc['datafatt'], ':cliente' => $doc['IDCliente'], ':rif' => $descrizioneDoc, ':codart' => $codart, ':qta' => $qta, ':prezzo' => $prezzoNetto, ':mag' => $magout, ':iddoc' => $docId]);
                        } elseif ($tipoMov === 'T') {
                            $pdo->prepare("INSERT INTO trasferimenti (data, codice, magout, magin, quant, iddocumento, TS) VALUES (:data, :codart, :magout, :magin, :qta, :iddoc, NOW())")
                                ->execute([':data' => $doc['datafatt'], ':codart' => $codart, ':magout' => $magout, ':magin' => $magin, ':qta' => $qta, ':iddoc' => $docId]);
                        }
                    }
                    $pdo->prepare("UPDATE fatture SET caricata = -1 WHERE ID = :id")->execute([':id' => $docId]);
                    $processed[] = $doc['Num'];
                }
                $pdo->commit();
                echo json_encode(["success" => true, "processed" => $processed]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;

        case 'mass_contabilizza':
            $input = json_decode(file_get_contents('php://input'), true);
            $docIds = $input['docIds'] ??[];
            if (empty($docIds)) { echo json_encode(["success" => false, "message" => "Nessun documento selezionato"]); break; }

            $processed =[];
            try {
                $pdo->beginTransaction();
                foreach ($docIds as $docId) {
                    $stmtDoc = $pdo->prepare("SELECT f.*, t.Tipo as tipoDesc, t.idmastro, t.idmovpnota, t.idmovscad, t.`D-A` as da, m.nrate, m.t as giorni, m.lock as finemese, m.riba as mezzopag FROM fatture f JOIN tipodoc t ON f.Tipo = t.Id LEFT JOIN `modalità di pagamento` m ON f.ModPag = m.idmod WHERE f.ID = :id");
                    $stmtDoc->execute([':id' => $docId]);
                    $doc = $stmtDoc->fetch(PDO::FETCH_ASSOC);

                    if (!$doc || empty($doc['da']) || $doc['registrata'] != 0) continue;

                    $totaleDoc = (float)$doc['impondoc'] + (float)$doc['ivadoc'] + (float)$doc['arrot'];
                    $isDare = $doc['da'] === '+';
                    $dataFormattata = date('d/m/Y', strtotime($doc['datafatt']));
                    $descrizionePN = $doc['tipoDesc'] . " n. " . $doc['Num'] . " del " . $dataFormattata;

                    // Prima Nota
                    $pdo->prepare("INSERT INTO prima_nota_casa (IdAzienda, data, descrizione, IdCliente, Categoria, TipoMovimento, mezzopag, `C-R`, Dare, Avere, imponibile, iva, numdoc, rifinterno, chiuso, IdFattura, TS) VALUES (1, :data, :descrizione, :IdCliente, :Categoria, :TipoMovimento, :mezzopag, 'C', :Dare, :Avere, :imponibile, :iva, :numdoc, :rifinterno, 0, :IdFattura, NOW())")
                        ->execute([':data' => $doc['datafatt'], ':descrizione' => $descrizionePN, ':IdCliente' => $doc['IDCliente'], ':Categoria' => $doc['idmastro'], ':TipoMovimento' => $doc['idmovpnota'], ':mezzopag' => $doc['mezzopag'] ?: 1, ':Dare' => $isDare ? $totaleDoc : 0, ':Avere' => $isDare ? 0 : $totaleDoc, ':imponibile' => $doc['impondoc'], ':iva' => $doc['ivadoc'], ':numdoc' => $doc['Num'], ':rifinterno' => $doc['ID'], ':IdFattura' => $doc['ID']]);

                    // Scadenzario
                    $nRate = (int)($doc['nrate'] ?: 1);
                    $giorni = (int)($doc['giorni'] ?: 0);
                    $fineMese = (int)$doc['finemese'] === -1;
                    $importoRata = round($totaleDoc / $nRate, 2);
                    $diff = round($totaleDoc - ($importoRata * $nRate), 2);
                    $baseDate = new DateTime($doc['datafatt']);
                    
                    $stmtScad = $pdo->prepare("INSERT INTO scadenzario (IdAzienda, data, descrizione, IdCliente, Categoria, TipoMovimento, mezzopag, `C-R`, Dare, Avere, imponibile, iva, numdoc, rifinterno, chiuso, idfattura, TS) VALUES (1, :data, :descrizione, :IdCliente, :Categoria, :TipoMovimento, :mezzopag, 'C', :Dare, :Avere, :imponibile, :iva, :numdoc, :rifinterno, 0, :idfattura, NOW())");

                    for ($i = 1; $i <= $nRate; $i++) {
                        $d = clone $baseDate;
                        $d->modify("+" . ($giorni * $i) . " days");
                        if ($fineMese) $d->modify('last day of this month');
                        $importo = ($i === $nRate) ? $importoRata + $diff : $importoRata;

                        $stmtScad->execute([':data' => $d->format('Y-m-d'), ':descrizione' => "Scadenza $i/$nRate - $descrizionePN", ':IdCliente' => $doc['IDCliente'], ':Categoria' => $doc['idmastro'], ':TipoMovimento' => $doc['idmovscad'], ':mezzopag' => $doc['mezzopag'] ?: 1, ':Dare' => $isDare ? 0 : $importo, ':Avere' => $isDare ? $importo : 0, ':imponibile' => $doc['impondoc'], ':iva' => $doc['ivadoc'], ':numdoc' => $doc['Num'], ':rifinterno' => $doc['ID'], ':idfattura' => $doc['ID']]);
                    }
                    $pdo->prepare("UPDATE fatture SET registrata = -1, datareg = CURDATE() WHERE ID = :id")->execute([':id' => $docId]);
                    $processed[] = $doc['Num'];
                }
                $pdo->commit();
                echo json_encode(["success" => true, "processed" => $processed]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;

// --- AUDIT: VERIFICA INCONGRUENZE CONTABILITA' ---
        case 'verifica_contabilita':
            $anno = (int)($_GET['anno'] ?? date('Y'));
            $mese = (int)($_GET['mese'] ?? date('m')); // FIX: Mese obbligatorio

            // FIX: Ora la query unisce il Tipo Documento per capire se sommare il Dare (+) o l'Avere (-) in Prima Nota!
            $sql = "SELECT f.ID, f.Num, f.datafatt, f.Tipo, t.Tipo as tipoDesc, c.`Ragione Sociale` as fornitore,
                       ROUND((f.impondoc + f.ivadoc + f.arrot), 2) AS TotDoc,
                       ROUND(IFNULL((
                           SELECT SUM(CASE WHEN t.`D-A` = '+' THEN p.Dare WHEN t.`D-A` = '-' THEN p.Avere ELSE 0 END) 
                           FROM prima_nota_casa p WHERE p.IdFattura = f.ID
                       ), 0), 2) AS TotMov
                FROM fatture f
                LEFT JOIN clienti c ON f.IDCliente = c.ID
                LEFT JOIN tipodoc t ON f.Tipo = t.Id
                WHERE f.registrata = -1 AND YEAR(f.datafatt) = :anno AND MONTH(f.datafatt) = :mese
                HAVING TotDoc != TotMov";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([':anno' => $anno, ':mese' => $mese]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

// --- AUDIT: VERIFICA INCONGRUENZE MAGAZZINO ---
        case 'verifica_magazzino':
            $anno = (int)($_GET['anno'] ?? date('Y'));
            $mese = (int)($_GET['mese'] ?? date('m')); 

            // QUERY SUPER-OTTIMIZZATA:
            // Sostituisce le vecchie 4 Subquery correlate lente (N+1 queries)
            // con delle Tabelle Derivate aggregate (GROUP BY) elaborate 1 sola volta in RAM.
            $sql = "SELECT f.ID, f.Num, f.datafatt, f.Tipo, t.Tipo as tipoDesc, c.`Ragione Sociale` as fornitore,
                           ROUND(IFNULL(sq_doc.QtaDoc, 0), 2) AS TotQtaDoc,
                           ROUND(
                               IFNULL(sq_car.QtaCarichi, 0) +
                               IFNULL(sq_sca.QtaScarichi, 0) +
                               IFNULL(sq_tra.QtaTrasf, 0)
                           , 2) AS TotQtaMov
                    FROM fatture f
                    LEFT JOIN clienti c ON f.IDCliente = c.ID
                    LEFT JOIN tipodoc t ON f.Tipo = t.Id
                    
                    -- Pre-calcolo massivo quantità prevista dai documenti
                    LEFT JOIN (
                        SELECT fc.IDFatt, SUM(fc.Quant) as QtaDoc
                        FROM fatturecorpo fc
                        JOIN articoli_prisma a ON fc.Codart = a.Codice
                        WHERE fc.Codart != ''
                        GROUP BY fc.IDFatt
                    ) sq_doc ON sq_doc.IDFatt = f.ID
                    
                    -- Pre-calcolo massivo quantità in carichi
                    LEFT JOIN (
                        SELECT iddocumento, SUM(quantita) as QtaCarichi
                        FROM carichi
                        WHERE iddocumento > 0
                        GROUP BY iddocumento
                    ) sq_car ON sq_car.iddocumento = f.ID
                    
                    -- Pre-calcolo massivo quantità in scarichi
                    LEFT JOIN (
                        SELECT iddocumento, SUM(quantita) as QtaScarichi
                        FROM scarichi
                        WHERE iddocumento > 0
                        GROUP BY iddocumento
                    ) sq_sca ON sq_sca.iddocumento = f.ID
                    
                    -- Pre-calcolo massivo quantità in trasferimenti
                    LEFT JOIN (
                        SELECT iddocumento, SUM(quant) as QtaTrasf
                        FROM trasferimenti
                        WHERE iddocumento > 0
                        GROUP BY iddocumento
                    ) sq_tra ON sq_tra.iddocumento = f.ID
                    
                    WHERE f.caricata = -1 
                      AND YEAR(f.datafatt) = :anno 
                      AND MONTH(f.datafatt) = :mese
                    HAVING TotQtaDoc != TotQtaMov";

            $stmt = $pdo->prepare($sql);
            $stmt->execute([':anno' => $anno, ':mese' => $mese]);
            
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($result ? $result : [], JSON_UNESCAPED_UNICODE);
            break;

// --- AUDIT: VERIFICA INCONGRUENZE ACCORPAMENTI ---
        case 'verifica_accorpamenti':
            $anno = (int)($_GET['anno'] ?? date('Y'));
            $mese = (int)($_GET['mese'] ?? date('m'));
            
            // Gestione sicura e ottimizzata dei parametri
            $params = [':anno' => $anno];
            $meseSql = "";
            if ($mese > 0) {
                $meseSql = " AND MONTH(dest.datafatt) = :mese ";
                $params[':mese'] = $mese;
            }

            // QUERY OTTIMIZZATA:
            // Anziché fare Sub-Query pesantissime, partiamo dai documenti ORIGINE (sorg)
            // che sono già stati accorpati (accorpa = -1) e li uniamo (INNER JOIN) 
            // ai documenti DESTINAZIONE usando l'id primario.
			$sql = "SELECT dest.ID, dest.Num, dest.datafatt, dest.Tipo, dest.IDCliente, t.Tipo as tipoDesc, c.`Ragione Sociale` as fornitore,
                           ROUND(SUM(sorg.impondoc), 2) AS TotQtaDoc,
                           ROUND(dest.impondoc, 2) AS TotQtaMov
                    FROM fatture sorg
                    INNER JOIN fatture dest ON sorg.idaccorpa = dest.ID
                    LEFT JOIN clienti c ON dest.IDCliente = c.ID
                    LEFT JOIN tipodoc t ON dest.Tipo = t.Id
                    WHERE sorg.accorpa = -1 
                      AND sorg.idaccorpa > 0 
                      AND YEAR(dest.datafatt) = :anno 
                      $meseSql
                    GROUP BY dest.ID, dest.Num, dest.datafatt, dest.Tipo, dest.IDCliente, t.Tipo, c.`Ragione Sociale`, dest.impondoc
                    HAVING TotQtaDoc != TotQtaMov";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
            
            $result = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($result ? $result : [], JSON_UNESCAPED_UNICODE);
            break;


// --- RICALCOLO FORZATO TOTALI FATTURA DA CORPO ---
        case 'ricalcola_totali_fattura':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            if ($id > 0) {
                try {
                    $pdo->prepare("
                        UPDATE fatture f
                        SET f.impondoc = IFNULL((SELECT SUM(impon) FROM fatturecorpo WHERE IDFatt = f.ID), 0),
                            f.ivadoc = IFNULL((SELECT SUM(imposta) FROM fatturecorpo WHERE IDFatt = f.ID), 0)
                        WHERE f.ID = ?
                    ")->execute([$id]);
                    echo json_encode(["success" => true]);
                } catch (Exception $e) {
                    echo json_encode(["success" => false, "message" => $e->getMessage()]);
                }
            } else { echo json_encode(["success" => false]); }
            break;

	// ========================================================
        // AREA ACCORPAMENTO DOCUMENTI
        // ========================================================

        // 1. RECUPERO CLIENTI CON DOCUMENTI DA ACCORPARE
        case 'get_clienti_da_accorpare':
            $tipoDoc = (int)($_GET['tipoDoc'] ?? 0);
            // Estrae solo i clienti che hanno documenti di quel tipo non ancora accorpati
            $sql = "SELECT DISTINCT c.*, c.`Ragione Sociale` AS Ragione_Sociale 
                    FROM clienti c 
                    JOIN fatture f ON c.ID = f.IDCliente 
                    WHERE f.Tipo = :tipo AND f.accorpa = 0 
                    ORDER BY c.`Ragione Sociale` ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':tipo' => $tipoDoc]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        // 2. RECUPERO DOCUMENTI DA ACCORPARE (PER IL CLIENTE SELEZIONATO)
        case 'get_documenti_da_accorpare':
            $tipoDoc = (int)($_GET['tipoDoc'] ?? 0);
            $idCliente = (int)($_GET['idCliente'] ?? 0);
            
            // FIX FONDAMENTALE: Usiamo SELECT * per passare TUTTI i dati a DocumentDetail
            $sql = "SELECT *, `num-ext` AS num_ext FROM fatture 
                    WHERE Tipo = :tipo AND IDCliente = :cliente 
                    AND accorpa = 0 
                    ORDER BY datafatt ASC, Num ASC";
            $stmt = $pdo->prepare($sql);
            $stmt->execute([':tipo' => $tipoDoc, ':cliente' => $idCliente]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

// 3. ESECUZIONE ACCORPAMENTO
        case 'esegui_accorpamento':
            $input = json_decode(file_get_contents('php://input'), true);
            $idCliente = (int)($input['idCliente'] ?? 0);
            $docIds = $input['docIds'] ?? [];
            $targetTipo = (int)($input['targetTipo'] ?? 0);
            $targetData = $input['targetData'] ?? date('Y-m-d');

            if (!$idCliente || empty($docIds) || !$targetTipo) {
                echo json_encode(["success" => false, "message" => "Dati mancanti"]);
                break;
            }

            try {
                $pdo->beginTransaction();

                // 1. Calcola il nuovo Numero Documento
                $anno = date('Y', strtotime($targetData));
                $stmtNum = $pdo->prepare("SELECT MAX(Num) as maxNum FROM fatture WHERE Tipo = :tipo AND YEAR(datafatt) = :anno");
                $stmtNum->execute([':tipo' => $targetTipo, ':anno' => $anno]);
                $maxNum = (int)$stmtNum->fetchColumn();
                $newNum = $maxNum + 1;

                // 2. Recupera i dati del primo documento sorgente per copiare Pagamento, Agente, ecc.
                $stmtFirstDoc = $pdo->prepare("SELECT * FROM fatture WHERE ID = :id");
                $stmtFirstDoc->execute([':id' => $docIds[0]]);
                $firstDoc = $stmtFirstDoc->fetch(PDO::FETCH_ASSOC);

                // Calcola i totali dai documenti sorgente
                $placeholders = implode(',', array_fill(0, count($docIds), '?'));
                $stmtTot = $pdo->prepare("SELECT SUM(impondoc) as totImp, SUM(ivadoc) as totIva FROM fatture WHERE ID IN ($placeholders)");
                $stmtTot->execute($docIds);
                $totali = $stmtTot->fetch(PDO::FETCH_ASSOC);

                // Genera la Key univoca
                $key = str_pad($targetTipo, 2, "0", STR_PAD_LEFT) . "-" . str_pad(1, 5, "0", STR_PAD_LEFT) . str_pad($anno, 5, "0", STR_PAD_LEFT) . str_pad($newNum, 5, "0", STR_PAD_LEFT);

                // 3. Crea il NUOVO documento (Testata)
                $sqlInsert = "INSERT INTO fatture (IdAzienda, Num, Tipo, datafatt, IDCliente, ModPag, codmag, cod_agente, provv, impondoc, ivadoc, TS, `key`) 
                              VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)";
                $pdo->prepare($sqlInsert)->execute([
                    $newNum, $targetTipo, $targetData, $idCliente, 
                    $firstDoc['ModPag'], $firstDoc['codmag'], $firstDoc['cod_agente'], $firstDoc['provv'],
                    $totali['totImp'], $totali['totIva'], $key
                ]);
                $newDocId = $pdo->lastInsertId();

                // 4. INSERIMENTO RIGHE CON INTESTAZIONE DESCRITTIVA
                $ordine = 1; // FIX ASSOLUTO: La prima riga inserita avrà valore ordine = 1 (NON PIU' 10)
                $stmtSrc = $pdo->prepare("SELECT f.Num, f.datafatt, t.Tipo as tipoDesc FROM fatture f JOIN tipodoc t ON f.Tipo = t.Id WHERE f.ID = :id");
                $stmtDesc = $pdo->prepare("INSERT INTO fatturecorpo (IDFatt, Descrzione, Quant, ImpUnit, Iva, Magazz, ttiva, sconto, unmis, impon, imposta, ordine) VALUES (:idfatt, :desc, 0, 0, 1, 1, 0, 0, '', 0, 0, :ordine)");
                $stmtRows = $pdo->prepare("SELECT * FROM fatturecorpo WHERE IDFatt = :id ORDER BY ordine ASC, ID ASC");
                $stmtInsertRow = $pdo->prepare("INSERT INTO fatturecorpo (IDFatt, Codart, Descrzione, Quant, ImpUnit, Iva, Magazz, ttiva, sconto, unmis, impon, imposta, ordine) VALUES (:idfatt, :codart, :desc, :quant, :impunit, :iva, :magazz, :ttiva, :sconto, :unmis, :impon, :imposta, :ordine)");

                foreach ($docIds as $sourceDocId) {
                    // Prende i dati del documento di origine
                    $stmtSrc->execute([':id' => $sourceDocId]);
                    $srcDoc = $stmtSrc->fetch(PDO::FETCH_ASSOC);

                    if ($srcDoc) {
                        $dataFormattata = date('d/m/Y', strtotime($srcDoc['datafatt']));
                        $descRowText = "Rif. " . $srcDoc['tipoDesc'] . " n. " . $srcDoc['Num'] . " del " . $dataFormattata;

                        // Inserisce la riga descrittiva (es. "Rif. DDT n. 1234")
                        $stmtDesc->execute([':idfatt' => $newDocId, ':desc' => $descRowText, ':ordine' => $ordine]);
                        $ordine += 1; // FIX ASSOLUTO: Passa alla riga successiva incrementando solo di +1

                        // Prende le righe del documento di origine e le copia
                        $stmtRows->execute([':id' => $sourceDocId]);
                        $rows = $stmtRows->fetchAll(PDO::FETCH_ASSOC);

                        foreach ($rows as $r) {
                            $stmtInsertRow->execute([
                                ':idfatt' => $newDocId,
                                ':codart' => $r['Codart'],
                                ':desc' => $r['Descrzione'],
                                ':quant' => $r['Quant'],
                                ':impunit' => $r['ImpUnit'],
                                ':iva' => $r['Iva'],
                                ':magazz' => $r['Magazz'],
                                ':ttiva' => $r['ttiva'],
                                ':sconto' => $r['sconto'],
                                ':unmis' => $r['unmis'],
                                ':impon' => $r['impon'],
                                ':imposta' => $r['imposta'],
                                ':ordine' => $ordine
                            ]);
                            $ordine += 1; // FIX ASSOLUTO: Passa alla riga successiva incrementando solo di +1
                        }
                    }
                }

				// 5. Aggiorna i vecchi documenti impostando accorpa = -1 e idaccorpa = Nuovo Documento
                $sqlUpdateOld = "UPDATE fatture SET accorpa = -1, idaccorpa = ? WHERE ID IN ($placeholders)";
                $paramsUpdate = array_merge([$newDocId], $docIds);
                $pdo->prepare($sqlUpdateOld)->execute($paramsUpdate);
				
                $pdo->commit();
                echo json_encode(["success" => true, "newDocId" => $newDocId]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;
			
		case 'get_next_number':
           $tipo = (int)($_GET['tipo'] ?? 0);
           $anno = (int)($_GET['anno'] ?? date('Y'));
           if ($tipo > 0) {
               $stmt = $pdo->prepare("SELECT MAX(Num) as max_num FROM fatture WHERE Tipo = :tipo AND YEAR(datafatt) = :anno");
               $stmt->execute([':tipo' => $tipo, ':anno' => $anno]);
               $row = $stmt->fetch(PDO::FETCH_ASSOC);
               echo json_encode(["success" => true, "nextNum" => (int)($row['max_num'] ?? 0) + 1]);
           } else {
               echo json_encode(["success" => true, "nextNum" => ""]);
           }
           break;

// --- ANNULLA ACCORPAMENTO (Eliminazione totale e svincolo) ---
        case 'annulla_accorpamento':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            
            if ($id > 0) {
                try {
                    $pdo->beginTransaction();
                    
                    // 1. Svincola i documenti origine (es. DDT) impostando accorpa = 0 e idaccorpa = 0
                    $stmtSgancia = $pdo->prepare("UPDATE fatture SET accorpa = 0, idaccorpa = 0 WHERE idaccorpa = :id");
                    $stmtSgancia->execute([':id' => $id]);
                    
                    // 2. Elimina le righe del documento destinazione generato
                    $stmtRighe = $pdo->prepare("DELETE FROM fatturecorpo WHERE IDFatt = :id");
                    $stmtRighe->execute([':id' => $id]);
                    
                    // 3. Elimina l'intestazione del documento destinazione
                    $stmtTesta = $pdo->prepare("DELETE FROM fatture WHERE ID = :id");
                    $stmtTesta->execute([':id' => $id]);
                    
                    $pdo->commit();
                    echo json_encode(["success" => true]);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo json_encode(["success" => false, "message" => $e->getMessage()]);
                }
            } else {
                echo json_encode(["success" => false, "message" => "ID mancante"]);
            }
            break;

// --- SALVATAGGIO E ELIMINAZIONE CLIENTI ---
        case 'save_cliente':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            
            $ragione = $input['Ragione_Sociale'] ?? $input['Ragione Sociale'] ?? '';
            $indirizzo = $input['Indirizzo'] ?? '';
            $cap = $input['CAP'] ?? '';
            $comune = $input['Comune'] ?? '';
            $prov = $input['Prov'] ?? '';
            $pi = $input['PI'] ?? '';
            $cf = $input['CF'] ?? '';
            $tel = $input['telefono'] ?? '';
            $email = $input['email'] ?? '';
            $pec = $input['PEC'] ?? '';
            $tipocli = (int)($input['tipocli'] ?? 1);
            $tipodest = (int)($input['tipodest'] ?? 1);
            $nome = $input['Nome'] ?? '';
            $cognome = $input['Cognome'] ?? '';
            $coduff = $input['coduff'] ?? '';
            $split = (int)($input['split'] ?? 0);
            $modpag = (int)($input['Mod_Pagamento'] ?? 1);
            $iban = $input['IBAN'] ?? '';
            $agente = (int)($input['cod_agente'] ?? 0);
            $listino = (int)($input['cod_Listino'] ?? 1);
            $sconto = (float)($input['sconto'] ?? 0);
            $fido = (float)($input['fido'] ?? 0);
            $attivo = $input['attivo'] ?? 'SI';
            $note = $input['Note'] ?? '';

            if ($id > 0) {
                $sql = "UPDATE clienti SET `Ragione Sociale`=:ragione, Indirizzo=:indirizzo, CAP=:cap, Comune=:comune, Prov=:prov, PI=:pi, CF=:cf, telefono=:tel, email=:email, PEC=:pec, tipocli=:tipocli, tipodest=:tipodest, Nome=:nome, Cognome=:cognome, coduff=:coduff, split=:split, Mod_Pagamento=:modpag, IBAN=:iban, cod_agente=:agente, cod_Listino=:listino, sconto=:sconto, fido=:fido, attivo=:attivo, Note=:note WHERE ID=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':ragione'=>$ragione, ':indirizzo'=>$indirizzo, ':cap'=>$cap, ':comune'=>$comune, ':prov'=>$prov, ':pi'=>$pi, ':cf'=>$cf, ':tel'=>$tel, ':email'=>$email, ':pec'=>$pec, ':tipocli'=>$tipocli, ':tipodest'=>$tipodest, ':nome'=>$nome, ':cognome'=>$cognome, ':coduff'=>$coduff, ':split'=>$split, ':modpag'=>$modpag, ':iban'=>$iban, ':agente'=>$agente, ':listino'=>$listino, ':sconto'=>$sconto, ':fido'=>$fido, ':attivo'=>$attivo, ':note'=>$note, ':id'=>$id]);
                echo json_encode(["success" => true, "id" => $id]);
            } else {
                $sql = "INSERT INTO clienti (`Ragione Sociale`, Indirizzo, CAP, Comune, Prov, PI, CF, telefono, email, PEC, tipocli, tipodest, Nome, Cognome, coduff, split, Mod_Pagamento, IBAN, cod_agente, cod_Listino, sconto, fido, attivo, Note, TS) VALUES (:ragione, :indirizzo, :cap, :comune, :prov, :pi, :cf, :tel, :email, :pec, :tipocli, :tipodest, :nome, :cognome, :coduff, :split, :modpag, :iban, :agente, :listino, :sconto, :fido, :attivo, :note, NOW())";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':ragione'=>$ragione, ':indirizzo'=>$indirizzo, ':cap'=>$cap, ':comune'=>$comune, ':prov'=>$prov, ':pi'=>$pi, ':cf'=>$cf, ':tel'=>$tel, ':email'=>$email, ':pec'=>$pec, ':tipocli'=>$tipocli, ':tipodest'=>$tipodest, ':nome'=>$nome, ':cognome'=>$cognome, ':coduff'=>$coduff, ':split'=>$split, ':modpag'=>$modpag, ':iban'=>$iban, ':agente'=>$agente, ':listino'=>$listino, ':sconto'=>$sconto, ':fido'=>$fido, ':attivo'=>$attivo, ':note'=>$note]);
                echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
            }
            break;

        case 'delete_cliente':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['ID']) ? (int)$input['ID'] : 0;
            if ($id > 0) {
                $stmt = $pdo->prepare("DELETE FROM clienti WHERE ID = :id");
                $stmt->execute([':id' => $id]);
                echo json_encode(["success" => true]);
            } else {
                echo json_encode(["success" => false, "message" => "ID mancante"]);
            }
            break;

// ========================================================
        // SALVATAGGIO TABELLE DI BASE E IMPOSTAZIONI
        // ========================================================

// --- CAUSALI CONTABILI (MASTRI) ---
        case 'save_causale':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['IdTipo']) ? (int)$input['IdTipo'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $desc = $input['Descrizione'] ?? '';
            // Recupera il segno in modo sicuro
            $da = $input['da'] ?? $input['D-A'] ?? '';
            $suff = $input['suffisso'] ?? '';

            try {
                if ($id > 0) {
                    $stmt = $pdo->prepare("SELECT IdTipo FROM `causali contabili` WHERE IdTipo = ?"); 
                    $stmt->execute([$id]);
                    if ($stmt->fetch()) {
                        // UPDATE (Se esiste)
                        $pdo->prepare("UPDATE `causali contabili` SET Descrizione=?, `D-A`=?, suffisso=? WHERE IdTipo=?")
                            ->execute([$desc, $da, $suff, $id]);
                    } else {
                        // INSERT (Nuovo con IdTipo) - AGGIUNTO IL CAMPO TS
                        $pdo->prepare("INSERT INTO `causali contabili` (IdTipo, Descrizione, `D-A`, suffisso, TS) VALUES (?, ?, ?, ?, NOW())")
                            ->execute([$id, $desc, $da, $suff]);
                    }
                } else {
                    // INSERT (Nuovo con Auto Increment) - AGGIUNTO IL CAMPO TS
                    $pdo->prepare("INSERT INTO `causali contabili` (Descrizione, `D-A`, suffisso, TS) VALUES (?, ?, ?, NOW())")
                        ->execute([$desc, $da, $suff]);
                }
                echo json_encode(["success" => true]); 
            } catch (Exception $e) {
                // Catturiamo l'errore SQL e lo inviamo al frontend!
                echo json_encode(["success" => false, "error" => $e->getMessage()]);
            }
            break;
			
        case 'delete_causale':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM `causali contabili` WHERE IdTipo = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

        // --- TIPOLOGIE MOVIMENTO (SOTTOCONTI) ---
        case 'save_tipologia':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['IdTipo']) ? (int)$input['IdTipo'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $desc = $input['Descrizione'] ?? ''; $idcausale = (int)($input['idcausale'] ?? 0); $codice = $input['codice'] ?? '';
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT IdTipo FROM `tipologie movimento` WHERE IdTipo = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE `tipologie movimento` SET Descrizione=?, idcausale=?, codice=? WHERE IdTipo=?")->execute([$desc, $idcausale, $codice, $id]);
                else $pdo->prepare("INSERT INTO `tipologie movimento` (IdTipo, Descrizione, idcausale, codice) VALUES (?, ?, ?, ?)")->execute([$id, $desc, $idcausale, $codice]);
            } else {
                $pdo->prepare("INSERT INTO `tipologie movimento` (Descrizione, idcausale, codice) VALUES (?, ?, ?)")->execute([$desc, $idcausale, $codice]);
            }
            echo json_encode(["success" => true]); 
		break;
		
        case 'delete_tipologia':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM `tipologie movimento` WHERE IdTipo = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

        // --- ALIQUOTE IVA ---
        case 'save_aliquota':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $desc = $input['descrizione'] ?? ''; $aliquota = (float)($input['aliquota'] ?? 0); $codfattel = $input['codfattel'] ?? '';
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT Id FROM aliquote WHERE Id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE aliquote SET descrizione=?, aliquota=?, codfattel=? WHERE Id=?")->execute([$desc, $aliquota, $codfattel, $id]);
                else $pdo->prepare("INSERT INTO aliquote (Id, descrizione, aliquota, codfattel) VALUES (?, ?, ?, ?)")->execute([$id, $desc, $aliquota, $codfattel]);
            } else {
                $pdo->prepare("INSERT INTO aliquote (descrizione, aliquota, codfattel) VALUES (?, ?, ?)")->execute([$desc, $aliquota, $codfattel]);
            }
            echo json_encode(["success" => true]); 
		break;
		
        case 'delete_aliquota':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM aliquote WHERE Id = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

// --- MEZZI DI PAGAMENTO ---
        case 'save_mezzo':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['cod']) ? (int)$input['cod'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $desc = $input['descrizione'] ?? ''; 
            $spese = (float)($input['speseinc'] ?? 0);
            $codfattel = $input['codfattel'] ?? ''; // <-- LETTURA NUOVO CAMPO

            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT cod FROM mezzi_pagamento_indiretti WHERE cod = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) {
                    $pdo->prepare("UPDATE mezzi_pagamento_indiretti SET descrizione=?, speseinc=?, codfattel=? WHERE cod=?")->execute([$desc, $spese, $codfattel, $id]);
                } else {
                    $pdo->prepare("INSERT INTO mezzi_pagamento_indiretti (cod, descrizione, speseinc, codfattel) VALUES (?, ?, ?, ?)")->execute([$id, $desc, $spese, $codfattel]);
                }
            } else {
                $pdo->prepare("INSERT INTO mezzi_pagamento_indiretti (descrizione, speseinc, codfattel) VALUES (?, ?, ?)")->execute([$desc, $spese, $codfattel]);
            }
            echo json_encode(["success" => true]); 
            break;
		
        case 'delete_mezzo':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM mezzi_pagamento_indiretti WHERE cod = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

        // --- MODALITA DI PAGAMENTO ---
        case 'save_modalita':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['idmod']) ? (int)$input['idmod'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $mod = $input['Mod'] ?? ''; $riba = (int)($input['riba'] ?? 0); $t = (int)($input['t'] ?? 0);
            $lock = (int)($input['lock'] ?? 0); $nrate = (int)($input['nrate'] ?? 0); $note_fatt = $input['note_fatt'] ?? '';
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT idmod FROM `modalità di pagamento` WHERE idmod = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE `modalità di pagamento` SET `Mod`=?, riba=?, t=?, `lock`=?, nrate=?, note_fatt=? WHERE idmod=?")->execute([$mod, $riba, $t, $lock, $nrate, $note_fatt, $id]);
                else $pdo->prepare("INSERT INTO `modalità di pagamento` (idmod, `Mod`, riba, t, `lock`, nrate, note_fatt) VALUES (?, ?, ?, ?, ?, ?, ?)")->execute([$id, $mod, $riba, $t, $lock, $nrate, $note_fatt]);
            } else {
                $pdo->prepare("INSERT INTO `modalità di pagamento` (`Mod`, riba, t, `lock`, nrate, note_fatt) VALUES (?, ?, ?, ?, ?, ?)")->execute([$mod, $riba, $t, $lock, $nrate, $note_fatt]);
            }
            echo json_encode(["success" => true]); 
		break;
        
		case 'delete_modalita':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM `modalità di pagamento` WHERE idmod = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

        // --- AGENTI ---
        case 'save_agente':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $nom = $input['Nominativo'] ?? ''; $ind = $input['Indirizzo'] ?? ''; $tel = $input['Telefono'] ?? ''; $cf = $input['CF_PIVA'] ?? '';
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT Id FROM agenti WHERE Id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE agenti SET Nominativo=?, Indirizzo=?, Telefono=?, CF_PIVA=? WHERE Id=?")->execute([$nom, $ind, $tel, $cf, $id]);
                else $pdo->prepare("INSERT INTO agenti (Id, Nominativo, Indirizzo, Telefono, CF_PIVA) VALUES (?, ?, ?, ?, ?)")->execute([$id, $nom, $ind, $tel, $cf]);
            } else {
                $pdo->prepare("INSERT INTO agenti (Nominativo, Indirizzo, Telefono, CF_PIVA) VALUES (?, ?, ?, ?)")->execute([$nom, $ind, $tel, $cf]);
            }
            echo json_encode(["success" => true]); 
		break;
		
        case 'delete_agente':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM agenti WHERE Id = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

        // --- LISTINI ---
        case 'save_listino':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $desc = $input['Descrizione'] ?? ''; $provv = (float)($input['provv'] ?? 0);
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT Id FROM listini WHERE Id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE listini SET Descrizione=?, provv=? WHERE Id=?")->execute([$desc, $provv, $id]);
                else $pdo->prepare("INSERT INTO listini (Id, Descrizione, provv) VALUES (?, ?, ?)")->execute([$id, $desc, $provv]);
            } else {
                $pdo->prepare("INSERT INTO listini (Descrizione, provv) VALUES (?, ?)")->execute([$desc, $provv]);
            }
            echo json_encode(["success" => true]); 
		break;
        
		case 'delete_listino':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM listini WHERE Id = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

        // --- BRAND ---
        case 'save_brand':
            $input = json_decode(file_get_contents('php://input'), true);
            $desc = $input['descrizione'] ?? $input['id'] ?? ''; $scont = (int)($input['scontabile'] ?? -1);
            if ($desc) {
                $stmt = $pdo->prepare("SELECT descrizione FROM brand WHERE descrizione = ?"); $stmt->execute([$desc]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE brand SET scontabile=? WHERE descrizione=?")->execute([$scont, $desc]);
                else $pdo->prepare("INSERT INTO brand (descrizione, scontabile) VALUES (?, ?)")->execute([$desc, $scont]);
                echo json_encode(["success" => true]);
            } else echo json_encode(["success" => false, "message" => "Descrizione mancante"]);
		break;
        
		case 'delete_brand':
            $input = json_decode(file_get_contents('php://input'), true); $desc = $input['id'] ?? '';
            if ($desc) { $pdo->prepare("DELETE FROM brand WHERE descrizione = ?")->execute([$desc]); echo json_encode(["success" => true]); } 
		break;

        // --- REPARTI ---
        case 'save_reparto':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : (isset($input['id']) ? (int)$input['id'] : 0);
            $desc = $input['descrizione'] ?? '';
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT Id FROM reparti WHERE Id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) $pdo->prepare("UPDATE reparti SET descrizione=? WHERE Id=?")->execute([$desc, $id]);
                else $pdo->prepare("INSERT INTO reparti (Id, descrizione) VALUES (?, ?)")->execute([$id, $desc]);
            } else {
                $pdo->prepare("INSERT INTO reparti (descrizione) VALUES (?)")->execute([$desc]);
            }
            echo json_encode(["success" => true]); 
		break;
        case 'delete_reparto':
            $input = json_decode(file_get_contents('php://input'), true); $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) { $pdo->prepare("DELETE FROM reparti WHERE Id = ?")->execute([$id]); echo json_encode(["success" => true]); } 
		break;

		// ========================================================
        // AREA MAGAZZINO (ARTICOLI)
        // ========================================================

        // --- ESTRAZIONE CATEGORIE E SOTTOCATEGORIE RAGGRUPPATE ---
        case 'categorie_articoli':
            $stmt = $pdo->query("SELECT DISTINCT Cod_Prisma FROM articoli_prisma WHERE Cod_Prisma IS NOT NULL AND Cod_Prisma != '' ORDER BY Cod_Prisma ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN), JSON_UNESCAPED_UNICODE);
            break;

        case 'sottocategorie_articoli':
            $stmt = $pdo->query("SELECT DISTINCT sottocateg FROM articoli_prisma WHERE sottocateg IS NOT NULL AND sottocateg != '' ORDER BY sottocateg ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN), JSON_UNESCAPED_UNICODE);
            break;

        case 'unita_misura_articoli':
            // Estrae tutte le UM univoche già usate negli articoli
            $stmt = $pdo->query("SELECT DISTINCT UnMis FROM articoli_prisma WHERE UnMis IS NOT NULL AND UnMis != '' ORDER BY UnMis ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_COLUMN), JSON_UNESCAPED_UNICODE);
            break;
			
		// --- SALVATAGGIO E ELIMINAZIONE ARTICOLI ---
        case 'save_articolo':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            
            $codice = $input['Codice'] ?? '';
            $cod_prisma = $input['Cod_Prisma'] ?? '';
            $descrizione = $input['Descrizione'] ?? '';
            $unmis = $input['UnMis'] ?? 'PZ';
            $esistenza = (float)($input['esistenza'] ?? 0);
            $ultprzacq = (float)($input['ultprzacq'] ?? 0);
            $listino1 = (float)($input['Listino1'] ?? 0);
            $listino2 = (float)($input['Listino2'] ?? 0);
            $listino3 = (float)($input['Listino3'] ?? 0);
            $listino4 = (float)($input['Listino4'] ?? 0);
            $listino5 = (float)($input['Listino5'] ?? 0);
            $listino6 = (float)($input['Listino6'] ?? 0);
            $scorta_minima = (float)($input['scorta_minima'] ?? 0);
            $sconto1 = (float)($input['sconto1'] ?? 0);
            $sconto2 = (float)($input['sconto2'] ?? 0);
            $sconto3 = (float)($input['sconto3'] ?? 0);
            $peso = (float)($input['peso'] ?? 0);
            $codiva = (int)($input['codiva'] ?? 1);
            $magaz = (int)($input['magaz'] ?? 1);
            $sottocateg = $input['sottocateg'] ?? '';
            $brand = $input['brand'] ?? '';
            $reparto = (int)($input['reparto'] ?? 0);
            
            // FIX: barcode è un intero (0 o -1), codice2 è il codice secondario
            $barcode = (int)($input['barcode'] ?? 0);
            $codice2 = $input['codice2'] ?? '';

            if ($id > 0) {
                $sql = "UPDATE articoli_prisma SET Codice=:codice, Cod_Prisma=:cod_prisma, Descrizione=:descrizione, UnMis=:unmis, esistenza=:esistenza, ultprzacq=:ultprzacq, Listino1=:listino1, Listino2=:listino2, Listino3=:listino3, Listino4=:listino4, Listino5=:listino5, Listino6=:listino6, scorta_minima=:scorta_minima, sconto1=:sconto1, sconto2=:sconto2, sconto3=:sconto3, peso=:peso, codiva=:codiva, magaz=:magaz, sottocateg=:sottocateg, brand=:brand, reparto=:reparto, barcode=:barcode, codice2=:codice2 WHERE id=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':codice'=>$codice, ':cod_prisma'=>$cod_prisma, ':descrizione'=>$descrizione, ':unmis'=>$unmis, ':esistenza'=>$esistenza, ':ultprzacq'=>$ultprzacq, ':listino1'=>$listino1, ':listino2'=>$listino2, ':listino3'=>$listino3, ':listino4'=>$listino4, ':listino5'=>$listino5, ':listino6'=>$listino6, ':scorta_minima'=>$scorta_minima, ':sconto1'=>$sconto1, ':sconto2'=>$sconto2, ':sconto3'=>$sconto3, ':peso'=>$peso, ':codiva'=>$codiva, ':magaz'=>$magaz, ':sottocateg'=>$sottocateg, ':brand'=>$brand, ':reparto'=>$reparto, ':barcode'=>$barcode, ':codice2'=>$codice2, ':id'=>$id]);
                echo json_encode(["success" => true, "id" => $id]);
            } else {
                $sql = "INSERT INTO articoli_prisma (Codice, Cod_Prisma, Descrizione, UnMis, esistenza, ultprzacq, Listino1, Listino2, Listino3, Listino4, Listino5, Listino6, scorta_minima, sconto1, sconto2, sconto3, peso, codiva, magaz, sottocateg, brand, reparto, barcode, codice2, TS) VALUES (:codice, :cod_prisma, :descrizione, :unmis, :esistenza, :ultprzacq, :listino1, :listino2, :listino3, :listino4, :listino5, :listino6, :scorta_minima, :sconto1, :sconto2, :sconto3, :peso, :codiva, :magaz, :sottocateg, :brand, :reparto, :barcode, :codice2, NOW())";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':codice'=>$codice, ':cod_prisma'=>$cod_prisma, ':descrizione'=>$descrizione, ':unmis'=>$unmis, ':esistenza'=>$esistenza, ':ultprzacq'=>$ultprzacq, ':listino1'=>$listino1, ':listino2'=>$listino2, ':listino3'=>$listino3, ':listino4'=>$listino4, ':listino5'=>$listino5, ':listino6'=>$listino6, ':scorta_minima'=>$scorta_minima, ':sconto1'=>$sconto1, ':sconto2'=>$sconto2, ':sconto3'=>$sconto3, ':peso'=>$peso, ':codiva'=>$codiva, ':magaz'=>$magaz, ':sottocateg'=>$sottocateg, ':brand'=>$brand, ':reparto'=>$reparto, ':barcode'=>$barcode, ':codice2'=>$codice2]);
                echo json_encode(["success" => true, "id" => $pdo->lastInsertId()]);
            }
            break;

        case 'delete_articolo':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) {
                $stmt = $pdo->prepare("DELETE FROM articoli_prisma WHERE id = :id");
                $stmt->execute([':id' => $id]);
                echo json_encode(["success" => true]);
            } else {
                echo json_encode(["success" => false, "message" => "ID mancante"]);
            }
            break;

		// --- SALVATAGGIO SINGOLO SCARICO ---
        case 'save_scarico':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['Id']) ? (int)$input['Id'] : 0;
            $data = $input['Data'] ?? date('Y-m-d');
            $cod_cliente = (int)($input['Cod_Cliente'] ?? 0);
            $riferimento = $input['Riferimento'] ?? '';
            $cod_articolo = $input['Cod_articolo'] ?? '';
            $quantita = (float)($input['quantita'] ?? 0);
            $pr_unit = (float)($input['Pr_Unit'] ?? 0);
            $perc = (float)($input['perc'] ?? 0);
            $magazzino = (int)($input['magazzino'] ?? 1);
            // Sicurezza per l'operatore (evita stringhe vuote)
            $idoperatore = isset($input['idoperatore']) && $input['idoperatore'] !== '' ? (int)$input['idoperatore'] : 0;
            $iddocumento = (int)($input['iddocumento'] ?? 0);
            $reso = (int)($input['reso'] ?? 0);
            
            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT Id FROM scarichi WHERE Id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) {
                    $sql = "UPDATE scarichi SET Data=?, Cod_Cliente=?, Riferimento=?, Cod_articolo=?, quantita=?, Pr_Unit=?, perc=?, magazzino=?, idoperatore=?, iddocumento=?, reso=? WHERE Id=?";
                    $pdo->prepare($sql)->execute([$data, $cod_cliente, $riferimento, $cod_articolo, $quantita, $pr_unit, $perc, $magazzino, $idoperatore, $iddocumento, $reso, $id]);
                } else {
                    $sql = "INSERT INTO scarichi (Id, Data, Cod_Cliente, Riferimento, Cod_articolo, quantita, Pr_Unit, perc, magazzino, idoperatore, iddocumento, reso, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                    $pdo->prepare($sql)->execute([$id, $data, $cod_cliente, $riferimento, $cod_articolo, $quantita, $pr_unit, $perc, $magazzino, $idoperatore, $iddocumento, $reso]);
                }
            } else {
                $sql = "INSERT INTO scarichi (Data, Cod_Cliente, Riferimento, Cod_articolo, quantita, Pr_Unit, perc, magazzino, idoperatore, iddocumento, reso, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                $pdo->prepare($sql)->execute([$data, $cod_cliente, $riferimento, $cod_articolo, $quantita, $pr_unit, $perc, $magazzino, $idoperatore, $iddocumento, $reso]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_scarico':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) {
                $pdo->prepare("DELETE FROM scarichi WHERE Id = ?")->execute([$id]);
                echo json_encode(["success" => true]);
            } else { echo json_encode(["success" => false]); }
            break;

		// --- SALVATAGGIO SINGOLO TRASFERIMENTO ---
        case 'save_trasferimento':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            $data = $input['data'] ?? date('Y-m-d');
            $codice = $input['codice'] ?? '';
            $magout = (int)($input['magout'] ?? 1);
            $magin = (int)($input['magin'] ?? 2);
            $quant = (float)($input['quant'] ?? 0);
            $iddocumento = (int)($input['iddocumento'] ?? 0);
            $operatore = isset($input['operatore']) && $input['operatore'] !== '' ? (int)$input['operatore'] : 0;

            if ($id > 0) {
                $stmt = $pdo->prepare("SELECT id FROM trasferimenti WHERE id = ?"); $stmt->execute([$id]);
                if ($stmt->fetch()) {
                    $sql = "UPDATE trasferimenti SET data=?, codice=?, magout=?, magin=?, quant=?, iddocumento=?, operatore=? WHERE id=?";
                    $pdo->prepare($sql)->execute([$data, $codice, $magout, $magin, $quant, $iddocumento, $operatore, $id]);
                } else {
                    $sql = "INSERT INTO trasferimenti (id, data, codice, magout, magin, quant, iddocumento, operatore, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                    $pdo->prepare($sql)->execute([$id, $data, $codice, $magout, $magin, $quant, $iddocumento, $operatore]);
                }
            } else {
                $sql = "INSERT INTO trasferimenti (data, codice, magout, magin, quant, iddocumento, operatore, TS) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())";
                $pdo->prepare($sql)->execute([$data, $codice, $magout, $magin, $quant, $iddocumento, $operatore]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_trasferimento':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = isset($input['id']) ? (int)$input['id'] : 0;
            if ($id > 0) {
                $pdo->prepare("DELETE FROM trasferimenti WHERE id = ?")->execute([$id]);
                echo json_encode(["success" => true]);
            } else { echo json_encode(["success" => false]); }
            break;			

// ========================================================
        // AREA FATTURAZIONE ELETTRONICA (FLUSSI SDI)
        // ========================================================
        
        // Lettura dell'unico record dei parametri
        case 'fattpaparam':
            $stmt = $pdo->query("SELECT * FROM fattpaparam LIMIT 1");
            $data = $stmt->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($data, JSON_UNESCAPED_UNICODE);
            break;

// Salvataggio dinamico del record
        case 'save_fattpaparam':
            $input = json_decode(file_get_contents('php://input'), true);
            
            $check = $pdo->query("SELECT COUNT(*) FROM fattpaparam")->fetchColumn();
            if ($check == 0) {
                $pdo->query("INSERT INTO fattpaparam (`IdPaese_1-1-1-1`, `IdCodice_1-1-1-2`) VALUES ('IT', '00000000000')");
            }

            unset($input['TS']); 

            $setFields = [];
            $values = [];
            
            // Elenco dei campi che sul DB accettano NULL se vuoti
            $nullableFields = ['AlCassa', 'AliquotaRitenuta', 'ultimoinvio', 'datibollo', 'AliquotaIVA', 'Natura', 'TipoRitenuta', 'CausalePagamento', 'TipoCassa'];

            foreach ($input as $key => $val) {
                $setFields[] = "`$key` = ?";
                
                // Se è un campo nullable ed è vuoto o nullo, forziamo il NULL per MySQL
                if (in_array($key, $nullableFields) && ($val === '' || $val === null)) {
                    $values[] = null;
                } else {
                    $values[] = $val !== null ? $val : '';
                }
            }

            if (!empty($setFields)) {
                $sql = "UPDATE fattpaparam SET " . implode(', ', $setFields);
                $stmt = $pdo->prepare($sql);
                $stmt->execute($values);
            }
            echo json_encode(["success" => true]);
            break;

// ========================================================
        // AREA FATTURAZIONE ELETTRONICA (UPLOAD E GESTIONE SDI)
        // ========================================================

        // 1. RICEZIONE E PARSING FILE XML / P7M
        case 'upload_xml_sdi':
            try {
                if (!isset($_FILES['xml_files'])) {
                    throw new Exception("Nessun file ricevuto dal server. Verifica le dimensioni massime di upload.");
                }

                $importedCount = 0;
                $skippedCount = 0;
                $pdo->beginTransaction();

                $files = $_FILES['xml_files'];
                
                // Normalizza l'array (se è un file singolo o multiplo)
                $fileCount = is_array($files['name']) ? count($files['name']) : 1;

                // Prepara le query
                $sqlTesta = "INSERT INTO fattpafornit (nomefile, tipodoc, numdoc, data, idfiscale, fornitore, Indirizzo, NumeroCivico, CAP, Comune, Provincia, imponibile, imposta, totaledoc, CondizioniPagamento, ModalitaPagamento, DataScadenzaPagamento, IBAN, status, carico, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, NOW())";
                $stmtT = $pdo->prepare($sqlTesta);

                $sqlRiga = "INSERT INTO dettaglioxml (IdFatt, Codart, Descrizione, Quantita, UnitaMisura, PrezzoUnitario, sconto, Importo, PrezzoTotale, AliquotaIVA, Natura, TS) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())";
                $stmtR = $pdo->prepare($sqlRiga);

                for ($i = 0; $i < $fileCount; $i++) {
                    $tmpFilePath = is_array($files['tmp_name']) ? $files['tmp_name'][$i] : $files['tmp_name'];
                    $nomeFileOriginale = is_array($files['name']) ? $files['name'][$i] : $files['name'];

                    // CONTROLLO ANTI-DUPLICATO (Se il file è già in DB, lo salta)
                    $chk = $pdo->prepare("SELECT COUNT(*) FROM fattpafornit WHERE nomefile = ?");
                    $chk->execute([$nomeFileOriginale]);
                    if ($chk->fetchColumn() > 0) {
                        $skippedCount++;
                        continue;
                    }

                    if ($tmpFilePath != "") {
                        $xmlString = file_get_contents($tmpFilePath);
                        
                        // Pulizia base64 per file p7m
                        if (strpos(strtolower($nomeFileOriginale), '.p7m') !== false) {
                            $inizioXml = strpos($xmlString, '<?xml');
                            if ($inizioXml !== false) {
                                $xmlString = substr($xmlString, $inizioXml);
                            }
                        }

                        // Pulizia Namespace
                        $xmlString = preg_replace('/(<\/?)([^:>\s]*:)/', '$1', $xmlString); 
                        $xml = @simplexml_load_string($xmlString);

                        if (!$xml) continue; 

                        $header = $xml->FatturaElettronicaHeader;
                        $body = $xml->FatturaElettronicaBody; 
                        if (is_array($body) || is_object($body)) {
                            $body = $body[0] ?? $body;
                        }

                        $cp = $header->CedentePrestatore;
                        $fornitore = (string)($cp->DatiAnagrafici->Anagrafica->Denominazione ?? ($cp->DatiAnagrafici->Anagrafica->Nome . ' ' . $cp->DatiAnagrafici->Anagrafica->Cognome));
                        $piva = (string)($cp->DatiAnagrafici->IdFiscaleIVA->IdCodice ?? $cp->DatiAnagrafici->CodiceFiscale);
                        
                        $sede = $cp->Sede;
                        $ind = (string)($sede->Indirizzo ?? '');
                        $civ = (string)($sede->NumeroCivico ?? '');
                        $cap = (string)($sede->CAP ?? '');
                        $com = (string)($sede->Comune ?? '');
                        $prov = (string)($sede->Provincia ?? '');

                        $datiGen = $body->DatiGenerali->DatiGeneraliDocumento;
                        $tipoDoc = (string)$datiGen->TipoDocumento;
                        $numDoc = (string)$datiGen->Numero;
                        $dataDoc = (string)$datiGen->Data;

                        $pagamento = isset($body->DatiPagamento->DettaglioPagamento) ? $body->DatiPagamento->DettaglioPagamento : null;
                        $condPag = isset($body->DatiPagamento->CondizioniPagamento) ? (string)$body->DatiPagamento->CondizioniPagamento : '';
                        $modPag = $pagamento ? (string)$pagamento->ModalitaPagamento : '';
                        $iban = $pagamento && isset($pagamento->IBAN) ? (string)$pagamento->IBAN : '';
                        $scadenza = $pagamento && isset($pagamento->DataScadenzaPagamento) ? (string)$pagamento->DataScadenzaPagamento : null;

                        $imponibile = 0; $imposta = 0;
                        if (isset($body->DatiBeniServizi->DatiRiepilogo)) {
                            foreach($body->DatiBeniServizi->DatiRiepilogo as $riep) {
                                $imponibile += (float)$riep->ImponibileImporto;
                                $imposta += (float)$riep->Imposta;
                            }
                        }
                        $totaleDoc = (float)($datiGen->ImportoTotaleDocumento ?? ($imponibile + $imposta));

                        // INSERIMENTO TESTATA IN STAGING (Status 1)
                        $stmtT->execute([$nomeFileOriginale, $tipoDoc, $numDoc, $dataDoc, $piva, $fornitore, $ind, $civ, $cap, $com, $prov, $imponibile, $imposta, $totaleDoc, $condPag, $modPag, $scadenza, $iban]);
                        $idFatt = $pdo->lastInsertId();

                        // INSERIMENTO RIGHE IN STAGING
                        if (isset($body->DatiBeniServizi->DettaglioLinee)) {
                            foreach ($body->DatiBeniServizi->DettaglioLinee as $linea) {
                                $desc = (string)$linea->Descrizione;
                                $qta = (float)($linea->Quantita ?? 1);
                                $um = (string)($linea->UnitaMisura ?? 'PZ');
                                $prezzo = (float)($linea->PrezzoUnitario ?? 0);
                                $pTotale = (float)($linea->PrezzoTotale ?? ($qta * $prezzo));
                                $alIva = (string)$linea->AliquotaIVA;
                                $natura = (string)($linea->Natura ?? '');
                                
                                $codart = '';
                                if (isset($linea->CodiceArticolo)) {
                                    $codart = (string)$linea->CodiceArticolo[0]->CodiceValore;
                                }

                                $sconto = 0;
                                if (isset($linea->ScontoMaggiorazione)) {
                                    foreach ($linea->ScontoMaggiorazione as $sm) {
                                        if ((string)$sm->Tipo === 'SC' && isset($sm->Percentuale)) {
                                            $sconto = (float)$sm->Percentuale; break;
                                        }
                                    }
                                }

                                $stmtR->execute([$idFatt, $codart, $desc, $qta, $um, $prezzo, $sconto, $pTotale, $pTotale, $alIva, $natura]);
                            }
                        }
                        $importedCount++;
                    }
                }
                
                $pdo->commit();
                echo json_encode(["success" => true, "imported" => $importedCount, "skipped" => $skippedCount]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;

        // 2. RECUPERA LE FATTURE IN STAGING
        case 'get_staging_xml':
            $stmt = $pdo->query("SELECT * FROM fattpafornit WHERE status = 1 ORDER BY data ASC");
            $docs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $stmtRighe = $pdo->prepare("SELECT * FROM dettaglioxml WHERE IdFatt = ?");
            foreach ($docs as &$doc) {
                $stmtRighe->execute([$doc['id']]);
                $doc['righe'] = $stmtRighe->fetchAll(PDO::FETCH_ASSOC);
                
                $stmtF = $pdo->prepare("SELECT COUNT(*) FROM clienti WHERE PI = ? OR CF = ?");
                $stmtF->execute([$doc['idfiscale'], $doc['idfiscale']]);
                $doc['is_fornitore_new'] = ($stmtF->fetchColumn() == 0);
            }
            echo json_encode($docs, JSON_UNESCAPED_UNICODE);
            break;

		// 3. IMPORTAZIONE DEFINITIVA DA STAGING A MULTI-V
        case 'import_xml_to_multiv':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            if (!$id) { echo json_encode(["success" => false, "message" => "ID Flusso mancante"]); break; }

            try {
                $pdo->beginTransaction();

                $stmt = $pdo->prepare("SELECT * FROM fattpafornit WHERE id = ?");
                $stmt->execute([$id]);
                $flusso = $stmt->fetch(PDO::FETCH_ASSOC);
                if (!$flusso) throw new Exception("Documento non trovato.");

                $piva = $flusso['idfiscale'];
                $stmtCli = $pdo->prepare("SELECT ID FROM clienti WHERE PI = ? OR CF = ? LIMIT 1");
                $stmtCli->execute([$piva, $piva]);
                $idCliente = $stmtCli->fetchColumn();

                if (!$idCliente) {
                    $sqlCli = "INSERT INTO clienti (`Ragione Sociale`, Indirizzo, CAP, Comune, Prov, PI, CF, tipocli, attivo, TS) VALUES (?, ?, ?, ?, ?, ?, ?, 2, 'SI', NOW())";
                    $pdo->prepare($sqlCli)->execute([
                        $flusso['fornitore'], $flusso['Indirizzo'], $flusso['CAP'], $flusso['Comune'], $flusso['Provincia'], $piva, $piva
                    ]);
                    $idCliente = $pdo->lastInsertId();
                }

				// --- LETTURA RIGOROSA TIPO DOCUMENTO (NO FALLBACK) ---
                $codiceSDI = trim(strtoupper($flusso['tipodoc'])); // Es. "TD04"
                
                // FIX: Aggiunto il filtro `D-A` = 'D' per assicurarsi che sia un documento di Acquisto/Fornitore!
                $stmtTipo = $pdo->prepare("SELECT Id FROM tipodoc WHERE TRIM(UPPER(codtipo)) = ? AND `clifor` = '2' LIMIT 1");
                $stmtTipo->execute([$codiceSDI]);
                $tipoAcquisto = $stmtTipo->fetchColumn();

                if (!$tipoAcquisto) {
                    // Nessuna corrispondenza: Blocchiamo tutto e personalizziamo l'avviso
                    throw new Exception("Codice documento SDI ({$codiceSDI}) non riconosciuto per l'area Acquisti.\n\nVai in 'Impostazioni -> Tipologia Documenti', apri la scheda del documento FORNITORE corretto e inserisci la sigla '{$codiceSDI}' nel campo 'codtipo'.");
                }

                $anno = date('Y', strtotime($flusso['data']));
                $stmtNum = $pdo->prepare("SELECT MAX(Num) FROM fatture WHERE Tipo = ? AND YEAR(datafatt) = ?");
                $stmtNum->execute([$tipoAcquisto, $anno]);
                $newNum = (int)$stmtNum->fetchColumn() + 1;

                $key = str_pad($tipoAcquisto, 2, "0", STR_PAD_LEFT) . "-00001" . str_pad($anno, 5, "0", STR_PAD_LEFT) . str_pad($newNum, 5, "0", STR_PAD_LEFT);

                $sqlFatt = "INSERT INTO fatture (IdAzienda, Num, Tipo, datafatt, IDCliente, ModPag, codmag, impondoc, ivadoc, `num-ext`, TS, `key`) VALUES (1, ?, ?, ?, ?, 1, 1, ?, ?, ?, NOW(), ?)";
                $pdo->prepare($sqlFatt)->execute([
                    $newNum, $tipoAcquisto, $flusso['data'], $idCliente, $flusso['imponibile'], $flusso['imposta'], $flusso['numdoc'], $key
                ]);
                $idFatturaMultiV = $pdo->lastInsertId();

                $stmtRighe = $pdo->prepare("SELECT * FROM dettaglioxml WHERE IdFatt = ?");
                $stmtRighe->execute([$id]);
                $righeXML = $stmtRighe->fetchAll(PDO::FETCH_ASSOC);

                $sqlRiga = "INSERT INTO fatturecorpo (IDFatt, Codart, Descrzione, Quant, ImpUnit, Iva, Magazz, sconto, unmis, impon, imposta, ordine) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)";
                $stmtInsertRiga = $pdo->prepare($sqlRiga);

                $ordine = 10;
                $aliquoteMap = $pdo->query("SELECT Id, aliquota FROM aliquote")->fetchAll(PDO::FETCH_KEY_PAIR);

                foreach ($righeXML as $r) {
                    $idIva = 1; 
                    foreach ($aliquoteMap as $aId => $aVal) {
                        if ((float)$aVal == (float)$r['AliquotaIVA']) { $idIva = $aId; break; }
                    }

                    $imponRiga = (float)$r['PrezzoTotale'];
                    $impostaRiga = round($imponRiga * ((float)$r['AliquotaIVA'] / 100), 2);

                    $stmtInsertRiga->execute([
                        $idFatturaMultiV, $r['Codart'], $r['Descrizione'], $r['Quantita'], $r['PrezzoUnitario'], $idIva, $r['sconto'], $r['UnitaMisura'], $imponRiga, $impostaRiga, $ordine
                    ]);
                    $ordine += 10;
                }

                $pdo->prepare("UPDATE fattpafornit SET status = 0 WHERE id = ?")->execute([$id]);

                $pdo->commit();
                echo json_encode(["success" => true, "id_multi_v" => $idFatturaMultiV]);
            } catch (Exception $e) {
                $pdo->rollBack();
                echo json_encode(["success" => false, "message" => $e->getMessage()]);
            }
            break;

        // 4. SCARTA (ELIMINA) UN FLUSSO XML
        case 'delete_flusso_sdi':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            if ($id > 0) {
                try {
                    $pdo->beginTransaction();
                    $pdo->prepare("DELETE FROM dettaglioxml WHERE IdFatt = ?")->execute([$id]);
                    $pdo->prepare("DELETE FROM fattpafornit WHERE id = ?")->execute([$id]);
                    $pdo->commit();
                    echo json_encode(["success" => true]);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo json_encode(["success" => false, "message" => $e->getMessage()]);
                }
            } else { echo json_encode(["success" => false]); }
            break;

        // 5. CAMBIA STATUS AL FLUSSO (1 = Da caricare, 0 = Caricato)
        case 'toggle_flusso_status':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            $status = (int)($input['status'] ?? 0);
            if ($id > 0) {
                $pdo->prepare("UPDATE fattpafornit SET status = ? WHERE id = ?")->execute([$status, $id]);
                echo json_encode(["success" => true]);
            }
            break;

        // 6. RECUPERA TUTTI I FLUSSI (Per l'elenco Gestione Flussi)
        case 'get_tutti_flussi_sdi':
            $stmt = $pdo->query("SELECT * FROM fattpafornit ORDER BY data DESC");
            $docs = $stmt->fetchAll(PDO::FETCH_ASSOC);
            
            $stmtRighe = $pdo->prepare("SELECT * FROM dettaglioxml WHERE IdFatt = ?");
            foreach ($docs as &$doc) {
                $stmtRighe->execute([$doc['id']]);
                $doc['righe'] = $stmtRighe->fetchAll(PDO::FETCH_ASSOC);
            }
            echo json_encode($docs, JSON_UNESCAPED_UNICODE);
            break;

        // 7. SALVATAGGIO DELLE MODIFICHE MANUALI (Gestione Flussi)
        case 'update_flusso_sdi':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            
            if ($id > 0) {
                try {
                    $pdo->beginTransaction();
                    
                    // 1. Aggiorna Testata
                    $sqlT = "UPDATE fattpafornit SET fornitore=?, idfiscale=?, numdoc=?, data=?, totaledoc=? WHERE id=?";
                    $pdo->prepare($sqlT)->execute([
                        $input['fornitore'], $input['idfiscale'], $input['numdoc'], $input['data'], $input['totaledoc'], $id
                    ]);
                    
                    // 2. Aggiorna Righe
                    if (!empty($input['righe'])) {
                        $sqlR = "UPDATE dettaglioxml SET Descrizione=?, Quantita=?, PrezzoUnitario=?, sconto=?, AliquotaIVA=? WHERE ID=?";
                        $stmtR = $pdo->prepare($sqlR);
                        foreach ($input['righe'] as $r) {
                            $stmtR->execute([
                                $r['Descrizione'], $r['Quantita'], $r['PrezzoUnitario'], $r['sconto'], $r['AliquotaIVA'], $r['ID']
                            ]);
                        }
                    }
                    
                    $pdo->commit();
                    echo json_encode(["success" => true]);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo json_encode(["success" => false, "message" => $e->getMessage()]);
                }
            } else { echo json_encode(["success" => false]); }
            break;

// ========================================================
        // TABELLE DI SUPPORTO PER LA FATTURAZIONE ELETTRONICA
        // ========================================================
        case 'fattparegimi':
            echo json_encode($pdo->query("SELECT * FROM fattparegimi ORDER BY codice ASC")->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'tipo_cassa':
            echo json_encode($pdo->query("SELECT * FROM tipo_cassa ORDER BY codice ASC")->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'fattpanatura':
            echo json_encode($pdo->query("SELECT * FROM fattpanatura ORDER BY codice ASC")->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'causali_ritenute':
            echo json_encode($pdo->query("SELECT * FROM causali_ritenute ORDER BY codice ASC")->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

// --- BROWSER CARTELLE DI SISTEMA (Per Configurazione SDI) ---
        case 'browse_directory':
            $path = $_GET['path'] ?? 'C:\\'; // Partiamo da C: di default su Windows
            $path = rtrim($path, '\\/'); 
            
            // Se il percorso non esiste o non è una cartella, torniamo alla root di C
            if (!file_exists($path) || !is_dir($path)) {
                $path = 'C:';
            }

            $folders = [];
            if (is_readable($path)) {
                $items = @scandir($path);
                if ($items !== false) {
                    foreach ($items as $item) {
                        if ($item === '.' || $item === '..') continue;
                        $fullPath = $path . DIRECTORY_SEPARATOR . $item;
                        // Restituiamo solo le cartelle
                        if (is_dir($fullPath)) {
                            $folders[] = $item;
                        }
                    }
                }
            }
            
            $parent = dirname($path);
            if ($parent === $path || $path === 'C:' || $path === 'C:\\') {
                $parent = ''; // Siamo nella root, non si sale oltre
            }
            
            echo json_encode(['success' => true, 'current' => $path, 'parent' => $parent, 'folders' => $folders]);
            break;

        case 'test_directory':
            $input = json_decode(file_get_contents('php://input'), true);
            $path = $input['path'] ?? '';
            
            if (empty($path)) {
                echo json_encode(['success' => false, 'message' => 'Nessun percorso inserito.']);
            } else if (!is_dir($path)) {
                echo json_encode(['success' => false, 'message' => 'La cartella non esiste o il percorso è errato.']);
            } else if (!is_readable($path)) {
                echo json_encode(['success' => false, 'message' => 'La cartella esiste ma Apache/PHP NON ha i permessi di lettura.']);
            } else {
                echo json_encode(['success' => true, 'message' => 'Cartella valida e accessibile!']);
            }
            break;
			
			// 7. SALVATAGGIO DELLE MODIFICHE MANUALI (Gestione Flussi)
        case 'update_flusso_sdi':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            
            if ($id > 0) {
                try {
                    $pdo->beginTransaction();
                    
                    // 1. Aggiorna Testata
                    $sqlT = "UPDATE fattpafornit SET fornitore=?, idfiscale=?, numdoc=?, data=?, totaledoc=? WHERE id=?";
                    $pdo->prepare($sqlT)->execute([
                        $input['fornitore'], $input['idfiscale'], $input['numdoc'], $input['data'], $input['totaledoc'], $id
                    ]);
                    
                    // 2. Aggiorna Righe
                    if (!empty($input['righe'])) {
                        $sqlR = "UPDATE dettaglioxml SET Descrizione=?, Quantita=?, PrezzoUnitario=?, sconto=?, AliquotaIVA=? WHERE ID=?";
                        $stmtR = $pdo->prepare($sqlR);
                        foreach ($input['righe'] as $r) {
                            $stmtR->execute([
                                $r['Descrizione'], $r['Quantita'], $r['PrezzoUnitario'], $r['sconto'], $r['AliquotaIVA'], $r['ID']
                            ]);
                        }
                    }
                    
                    $pdo->commit();
                    echo json_encode(["success" => true]);
                } catch (Exception $e) {
                    $pdo->rollBack();
                    echo json_encode(["success" => false, "message" => $e->getMessage()]);
                }
            } else { echo json_encode(["success" => false]); }
            break;


// ========================================================
        // AREA TRASPORTO / LOGISTICA (DDT, Destinazioni, Vettori)
        // ========================================================

        // --- DDT (Dati storici di trasporto per cliente) ---
        case 'get_ddt':
            $idCliente = (int)($_GET['idcliente'] ?? 0);
            $stmt = $pdo->prepare("SELECT * FROM ddt WHERE Idcliente = ? LIMIT 1");
            $stmt->execute([$idCliente]);
            echo json_encode($stmt->fetch(PDO::FETCH_ASSOC) ?: [], JSON_UNESCAPED_UNICODE);
            break;

        case 'save_ddt':
            $input = json_decode(file_get_contents('php://input'), true);
            $idCliente = (int)($input['Idcliente'] ?? 0);
            if ($idCliente > 0) {
                $sql = "INSERT INTO ddt (Idcliente, porto, causale, Destinazione1, Destinazione2, Destinazione3, vettore, aspetto, rif_interno) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
                        ON DUPLICATE KEY UPDATE 
                        porto=VALUES(porto), causale=VALUES(causale), Destinazione1=VALUES(Destinazione1), Destinazione2=VALUES(Destinazione2), Destinazione3=VALUES(Destinazione3), vettore=VALUES(vettore), aspetto=VALUES(aspetto), rif_interno=VALUES(rif_interno)";
                $pdo->prepare($sql)->execute([
                    $idCliente, $input['porto'] ?? '', $input['causale'] ?? '', $input['Destinazione1'] ?? '', $input['Destinazione2'] ?? '', $input['Destinazione3'] ?? '', $input['vettore'] ?? '', $input['aspetto'] ?? '', $input['rif_interno'] ?? ''
                ]);
                echo json_encode(["success" => true]);
            } else { echo json_encode(["success" => false]); }
            break;

        // --- DESTINAZIONI MERCE (Elenco per cliente) ---
        case 'get_destinazioni':
            $idCliente = (int)($_GET['idcliente'] ?? 0);
            $stmt = $pdo->prepare("SELECT * FROM destinazioni WHERE idcliente = ? ORDER BY id DESC");
            $stmt->execute([$idCliente]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        case 'save_destinazione':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            $idcliente = (int)($input['idcliente'] ?? 0);
            $d1 = $input['destinazione1'] ?? ''; $d2 = $input['destinazione2'] ?? ''; $d3 = $input['destinazione3'] ?? '';
            
            if ($id > 0) {
                $pdo->prepare("UPDATE destinazioni SET destinazione1=?, destinazione2=?, destinazione3=? WHERE id=?")->execute([$d1, $d2, $d3, $id]);
            } else if ($idcliente > 0) {
                $pdo->prepare("INSERT INTO destinazioni (idcliente, destinazione1, destinazione2, destinazione3) VALUES (?, ?, ?, ?)")->execute([$idcliente, $d1, $d2, $d3]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_destinazione':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            if ($id > 0) $pdo->prepare("DELETE FROM destinazioni WHERE id=?")->execute([$id]);
            echo json_encode(["success" => true]);
            break;

// --- VETTORI E CAUSALI TRASPORTO ---
        case 'get_vettori':
            try {
                // FIX: Uso della colonna "Decrizione"
                $stmt = $pdo->query("SELECT * FROM vettori ORDER BY Decrizione ASC");
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE); 
            } catch (Exception $e) {
                echo json_encode([]);
            }
            break;
            
        case 'save_vettore':
            $input = json_decode(file_get_contents('php://input'), true);
            // Il backend ora accetta qualsiasi variante gli mandi React e usa la colonna corretta
            $descrizione = trim($input['descrizione'] ?? $input['Descrizione'] ?? $input['Decrizione'] ?? '');
            if (!empty($descrizione)) {
                $pdo->prepare("INSERT INTO vettori (Decrizione) VALUES (?)")->execute([$descrizione]);
            }
            echo json_encode(["success" => true]); 
            break;
            
        case 'delete_vettore':
            $input = json_decode(file_get_contents('php://input'), true);
            $descrizione = $input['descrizione'] ?? $input['Descrizione'] ?? $input['Decrizione'] ?? '';
            if (!empty($descrizione)) {
                $pdo->prepare("DELETE FROM vettori WHERE Decrizione=?")->execute([$descrizione]);
            }
            echo json_encode(["success" => true]); 
            break;

        case 'get_causali_trasporto':
            try {
                // FIX: Uso della colonna "Decrizione"
                $stmt = $pdo->query("SELECT * FROM causali ORDER BY Decrizione ASC");
                echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE); 
            } catch (Exception $e) {
                echo json_encode([]);
            }
            break;
            
        case 'save_causale_trasporto':
            $input = json_decode(file_get_contents('php://input'), true);
            $descrizione = trim($input['descrizione'] ?? $input['Descrizione'] ?? $input['Decrizione'] ?? '');
            if (!empty($descrizione)) {
                $pdo->prepare("INSERT INTO causali (Decrizione) VALUES (?)")->execute([$descrizione]);
            }
            echo json_encode(["success" => true]); 
            break;
            
        case 'delete_causale_trasporto':
            $input = json_decode(file_get_contents('php://input'), true);
            $descrizione = $input['descrizione'] ?? $input['Descrizione'] ?? $input['Decrizione'] ?? '';
            if (!empty($descrizione)) {
                $pdo->prepare("DELETE FROM causali WHERE Decrizione=?")->execute([$descrizione]);
            }
            echo json_encode(["success" => true]); 
            break;

// ========================================================
        // AREA COMUNICAZIONI (MODELLI EMAIL)
        // ========================================================
        case 'get_comunicazioni':
            echo json_encode($pdo->query("SELECT * FROM comunicazioni ORDER BY area ASC, descrizione ASC")->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'save_comunicazione':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            $area = (int)($input['area'] ?? 1);
            $descrizione = $input['descrizione'] ?? '';
            $oggetto = $input['oggetto'] ?? '';
            $testo = $input['testo'] ?? '';

            if ($id > 0) {
                $pdo->prepare("UPDATE comunicazioni SET area=?, descrizione=?, oggetto=?, testo=? WHERE id=?")->execute([$area, $descrizione, $oggetto, $testo, $id]);
            } else {
                $pdo->prepare("INSERT INTO comunicazioni (area, descrizione, oggetto, testo) VALUES (?, ?, ?, ?)")->execute([$area, $descrizione, $oggetto, $testo]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_comunicazione':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!empty($input['id'])) $pdo->prepare("DELETE FROM comunicazioni WHERE id=?")->execute([$input['id']]);
            echo json_encode(["success" => true]);
            break;

        // ========================================================
        // AREA GESTIONE UTENTI (E SMTP PERSONALE)
        // ========================================================
        case 'get_users':
            $users = $pdo->query("SELECT * FROM `user` ORDER BY fs_user_id ASC")->fetchAll(PDO::FETCH_ASSOC);
            foreach ($users as &$u) {
                // Decriptiamo la password per farla vedere in chiaro nella Form React
                $u['fs_user_pwd_clear'] = decriptaVBA($u['fs_user_pwd'] ?? '');
            }
            echo json_encode($users, JSON_UNESCAPED_UNICODE);
            break;

        case 'save_user':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['Id'] ?? 0);
            
            $fs_user_id = $input['fs_user_id'] ?? '';
            // Criptiamo la password prima di scriverla!
            $pwd_clear = $input['fs_user_pwd_clear'] ?? '';
            $fs_user_pwd = criptaVBA($pwd_clear);

            $gruppo = (int)($input['gruppo'] ?? 1); // Magazzino di competenza
            $level = (int)($input['level'] ?? 1);
            $dirig = $input['dirig'] ?? 'N';
            $attivo = (int)($input['attivo'] ?? -1);
            
            // Permessi Aree
            $g1 = (int)($input['gruppo1'] ?? 0);
            $g2 = (int)($input['gruppo2'] ?? 0);
            $g3 = (int)($input['gruppo3'] ?? 0);

            // Dati SMTP
            $smtp_host = $input['smtp_host'] ?? '';
            $smtp_port = (int)($input['smtp_port'] ?? 465);
            $smtp_user = $input['smtp_user'] ?? '';
            $smtp_pass = $input['smtp_pass'] ?? '';
            $smtp_from = $input['smtp_from'] ?? '';
            $smtp_bcc = $input['smtp_bcc'] ?? '';

            if ($id > 0) {
                $sql = "UPDATE `user` SET fs_user_id=?, fs_user_pwd=?, gruppo=?, `level`=?, dirig=?, attivo=?, gruppo1=?, gruppo2=?, gruppo3=?, smtp_host=?, smtp_port=?, smtp_user=?, smtp_pass=?, smtp_from=?, smtp_bcc=? WHERE Id=?";
                $pdo->prepare($sql)->execute([$fs_user_id, $fs_user_pwd, $gruppo, $level, $dirig, $attivo, $g1, $g2, $g3, $smtp_host, $smtp_port, $smtp_user, $smtp_pass, $smtp_from, $smtp_bcc, $id]);
            } else {
                // Per sicurezza, se l'Id non è Autoincrement, calcoliamo il MAX
                $maxId = $pdo->query("SELECT COALESCE(MAX(Id),0)+1 FROM `user`")->fetchColumn();
                $sql = "INSERT INTO `user` (Id, fs_user_id, fs_user_pwd, gruppo, `level`, dirig, attivo, gruppo1, gruppo2, gruppo3, smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from, smtp_bcc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
                $pdo->prepare($sql)->execute([$maxId, $fs_user_id, $fs_user_pwd, $gruppo, $level, $dirig, $attivo, $g1, $g2, $g3, $smtp_host, $smtp_port, $smtp_user, $smtp_pass, $smtp_from, $smtp_bcc]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_user':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!empty($input['id'])) $pdo->prepare("DELETE FROM `user` WHERE Id=?")->execute([$input['id']]);
            echo json_encode(["success" => true]);
            break;

// ========================================================
        // AREA INVIO EMAIL (CON PHPMAILER)
        // ========================================================
        case 'send_email':
            $contentType = $_SERVER['CONTENT_TYPE'] ?? ($_SERVER['HTTP_CONTENT_TYPE'] ?? '');

            $username = '';
            $to = '';
            $subject = '';
            $body = '';
            $filename = 'Documento.pdf';
            $pdfBase64 = '';
            $pdfBinary = null;
            $uploadError = null;

            $isMultipart = (!empty($_FILES) || !empty($_POST) || stripos($contentType, 'multipart/form-data') !== false);

            if ($isMultipart) {
                $username = $_POST['username'] ?? '';
                $to = $_POST['to'] ?? '';
                $subject = $_POST['subject'] ?? '';
                $body = $_POST['body'] ?? '';
                $filename = $_POST['filename'] ?? ($_FILES['pdf']['name'] ?? 'Documento.pdf');

                if (!empty($_FILES['pdf'])) {
                    $uploadError = $_FILES['pdf']['error'] ?? null;
                    if ($uploadError === UPLOAD_ERR_OK && !empty($_FILES['pdf']['tmp_name']) && is_uploaded_file($_FILES['pdf']['tmp_name'])) {
                        $pdfBinary = file_get_contents($_FILES['pdf']['tmp_name']);
                    }
                }
            } else {
                $input = json_decode(file_get_contents('php://input'), true);
                if (!is_array($input)) $input = [];
                $username = $input['username'] ?? '';
                $to = $input['to'] ?? '';
                $subject = $input['subject'] ?? '';
                $body = $input['body'] ?? '';
                $filename = $input['filename'] ?? 'Documento.pdf';
                $pdfBase64 = $input['pdfBase64'] ?? '';
            }

            if (empty($to) || (empty($pdfBase64) && empty($pdfBinary))) {
                $postKeys = array_keys($_POST ?? []);
                $fileKeys = array_keys($_FILES ?? []);
                $pdfInfo = null;
                if (!empty($_FILES['pdf'])) {
                    $pdfInfo = [
                        "name" => $_FILES['pdf']['name'] ?? '',
                        "type" => $_FILES['pdf']['type'] ?? '',
                        "size" => (int)($_FILES['pdf']['size'] ?? 0),
                        "error" => $_FILES['pdf']['error'] ?? null,
                    ];
                }
                $debugLines = [
                    "contentType=" . ($contentType !== '' ? $contentType : '(vuoto)'),
                    "contentLength=" . (string)($_SERVER['CONTENT_LENGTH'] ?? ''),
                    "isMultipart=" . ($isMultipart ? 'true' : 'false'),
                    "postKeys=" . (count($postKeys) ? implode(',', $postKeys) : '(vuoto)'),
                    "fileKeys=" . (count($fileKeys) ? implode(',', $fileKeys) : '(vuoto)'),
                    "pdfFile=" . ($pdfInfo ? json_encode($pdfInfo, JSON_UNESCAPED_UNICODE) : '(assente)'),
                    "ini.post_max_size=" . (string)ini_get('post_max_size'),
                    "ini.upload_max_filesize=" . (string)ini_get('upload_max_filesize'),
                    "ini.file_uploads=" . (string)ini_get('file_uploads'),
                ];
                $msg = "Dati mancanti per l'invio (destinatario o PDF).";
                if ($isMultipart && empty($_POST) && empty($_FILES)) {
                    $msg .= "\nRichiesta multipart ma PHP non ha popolato POST/FILES (possibile limite post_max_size/upload_max_filesize o blocco proxy).";
                } elseif ($isMultipart && $uploadError !== null && $uploadError !== UPLOAD_ERR_OK) {
                    $msg .= "\nErrore upload PDF: " . (string)$uploadError;
                }
                $msg .= "\n\nDebug:\n" . implode("\n", $debugLines);
                echo json_encode(["success" => false, "message" => $msg]);
                break;
            }

            $smtpData = null;

            // 1. Provo a prendere l'SMTP dell'utente collegato
            if (!empty($username)) {
                $stmt = $pdo->prepare("SELECT * FROM `user` WHERE (fs_user_id = ? OR Id = ?) AND smtp_host IS NOT NULL AND smtp_host != '' LIMIT 1");
                $stmt->execute([$username, $username]);
                $userSmtp = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($userSmtp) {
                    $smtpData = $userSmtp;
                }
            }

            // 2. Se non lo trovo, provo con l'SMTP generale dell'Azienda
            if (!$smtpData) {
                $stmtAz = $pdo->query("SELECT * FROM azienda LIMIT 1");
                $azSmtp = $stmtAz->fetch(PDO::FETCH_ASSOC);
                if ($azSmtp && !empty($azSmtp['smtp_host'])) {
                    $smtpData = $azSmtp;
                }
            }

            // 3. FALLBACK ESTREMO ANTI-ERRORE: Prendo IL PRIMO utente nel DB che ha configurato un SMTP!
            if (!$smtpData) {
                $stmtFall = $pdo->query("SELECT * FROM `user` WHERE smtp_host IS NOT NULL AND smtp_host != '' LIMIT 1");
                $fallSmtp = $stmtFall->fetch(PDO::FETCH_ASSOC);
                if ($fallSmtp) {
                    $smtpData = $fallSmtp;
                }
            }

            // Se dopo questi 3 controlli a cascata non ho nulla, restituisco l'errore chiaro
            if (!$smtpData) {
                echo json_encode(["success" => false, "message" => "Nessun Server SMTP configurato nel sistema.\n(Utente in sessione: '$username').\nConfigura un SMTP in 'Gestione Operatori' o in 'Parametri Aziendali'."]);
                break;
            }

            try {
                $smtpHost = trim((string)($smtpData['smtp_host'] ?? ''));
                $smtpUser = trim((string)($smtpData['smtp_user'] ?? ''));
                $smtpPass = (string)($smtpData['smtp_pass'] ?? '');
                $smtpPort = (int)($smtpData['smtp_port'] ?? 465);
                $smtpFrom = trim((string)($smtpData['smtp_from'] ?? ''));
                $smtpBcc  = trim((string)($smtpData['smtp_bcc'] ?? ''));

                if ($smtpHost === '' || $smtpUser === '' || $smtpPass === '') {
                    echo json_encode([
                        "success" => false,
                        "message" => "Configurazione SMTP incompleta per l'utente '$username'.\nVerifica smtp_host, smtp_user e smtp_pass in Gestione Operatori."
                    ]);
                    break;
                }

                $phpMailerException = __DIR__ . '/phpmailer/Exception.php';
                $phpMailerMain = __DIR__ . '/phpmailer/PHPMailer.php';
                $phpMailerSmtp = __DIR__ . '/phpmailer/SMTP.php';

                if (!file_exists($phpMailerException) || !file_exists($phpMailerMain) || !file_exists($phpMailerSmtp)) {
                    echo json_encode([
                        "success" => false,
                        "message" => "Librerie PHPMailer mancanti sul server.\nPercorso atteso:\n" . __DIR__ . "/phpmailer/"
                    ]);
                    break;
                }

                // Includere le classi di PHPMailer
                require_once $phpMailerException;
                require_once $phpMailerMain;
                require_once $phpMailerSmtp;

                $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                
                // Configurazione Server SMTP trovato
                $mail->isSMTP();
                $mail->Host       = $smtpHost;
                $mail->SMTPAuth   = true;
                $mail->Username   = $smtpUser;
                $mail->Password   = $smtpPass;
                // Default sicurezza sempre attiva: SMTPS su 465, STARTTLS sulle altre porte
                $mail->SMTPSecure = $smtpPort === 465 ? \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS : \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port       = $smtpPort > 0 ? $smtpPort : 465;
                
                // Molti SMTP consentono l'invio solo se il mittente coincide con l'utenza autenticata.
                // Per evitare il blocco "Sender not allowed", il From tecnico resta sempre smtp_user.
                $mail->setFrom($smtpUser, 'Multi-V Gestionale');
                $mail->Sender = $smtpUser;
                if ($smtpFrom !== '' && strcasecmp($smtpFrom, $smtpUser) !== 0) {
                    $mail->addReplyTo($smtpFrom);
                }
                
                // Destinatario Principale
                $mail->addAddress($to);
                
                // Copia Conoscenza Nascosta (BCC) all'utente per archivio storico
                if ($smtpBcc !== '') {
                    $mail->addBCC($smtpBcc);
                }

                if ($pdfBinary !== null && $pdfBinary !== '') {
                    $pdfData = $pdfBinary;
                } else {
                    $base64 = (string)$pdfBase64;
                    $pos = stripos($base64, 'base64,');
                    if ($pos !== false) {
                        $base64 = substr($base64, $pos + 7);
                    } elseif (stripos($base64, 'data:') === 0) {
                        $comma = strpos($base64, ',');
                        if ($comma !== false) {
                            $base64 = substr($base64, $comma + 1);
                        }
                    }
                    $base64 = preg_replace('/\s+/', '', $base64);
                    $pdfData = base64_decode($base64, true);
                }

                if ($pdfData === false || $pdfData === '' || strncmp($pdfData, '%PDF', 4) !== 0) {
                    echo json_encode([
                        "success" => false,
                        "message" => "PDF non valido o non decodificabile."
                    ]);
                    break;
                }

                $mail->addStringAttachment($pdfData, $filename, 'base64', 'application/pdf');

                // Trasformazione del Testo (Sostituzione ?logo? con l'immagine inline)
                $mail->isHTML(true);
                $mail->Subject = $subject;
                
                $bodyHtml = nl2br(htmlspecialchars($body)); // Mantiene gli a capo corretti
                
                if (strpos($bodyHtml, '?logo?') !== false) {
                    $logoPath = __DIR__ . '/logo.png'; 
                    if (file_exists($logoPath)) {
                        $mail->addEmbeddedImage($logoPath, 'logo_cid', 'logo.png');
                        $bodyHtml = str_replace('?logo?', '<br><img src="cid:logo_cid" alt="Logo Azienda" style="max-height: 80px;" /><br>', $bodyHtml);
                    } else {
                        $bodyHtml = str_replace('?logo?', '', $bodyHtml); // Se il logo non c'è, pulisce la parola
                    }
                }
                
                $mail->Body = "<div style='font-family: Arial, sans-serif; color: #333; line-height: 1.5; font-size: 14px;'>{$bodyHtml}</div>";

                $mail->send();
                echo json_encode(["success" => true]);

            } catch (\PHPMailer\PHPMailer\Exception $e) {
                echo json_encode(["success" => false, "message" => "Errore del server di posta (PHPMailer):\n" . $e->getMessage() . "\nMailer Error: " . ($mail->ErrorInfo ?? '')]);
            } catch (\Throwable $e) {
                echo json_encode(["success" => false, "message" => "Errore interno invio mail:\n" . $e->getMessage()]);
            }
            break;

// ========================================================
        // AREA STORICO PREZZI ARTICOLI (F3)
        // ========================================================
        case 'get_storico_prezzi':
            $codart = trim($_GET['codart'] ?? '');
            $idcliente = (int)($_GET['idcliente'] ?? 0);
            $iddoc = (int)($_GET['iddoc'] ?? 0); // FIX: Riceve l'ID del documento corrente
            
            if ($codart !== '' && $idcliente > 0) {
                try {
                    // FIX: "AND f.ID != :iddoc" esclude il documento aperto
                    // L'ordinamento è già corretto (ORDER BY f.datafatt DESC, f.Num DESC)
                    $sql = "SELECT f.datafatt, f.Num, t.Tipo as tipoDesc, fc.Quant, fc.ImpUnit, fc.sconto 
                            FROM fatturecorpo fc
                            JOIN fatture f ON fc.IDFatt = f.ID
                            JOIN tipodoc t ON f.Tipo = t.Id
                            WHERE TRIM(fc.Codart) = :codart 
                              AND f.IDCliente = :idcliente
                              AND f.ID != :iddoc
                              AND (t.`D-A` = '+' OR t.`D-A` = '-')
                            ORDER BY f.datafatt DESC, f.Num DESC";
                            
                    $stmt = $pdo->prepare($sql);
                    $stmt->execute([':codart' => $codart, ':idcliente' => $idcliente, ':iddoc' => $iddoc]);
                    
                    $risultati = $stmt->fetchAll(PDO::FETCH_ASSOC);
                    echo json_encode($risultati ?: [], JSON_UNESCAPED_UNICODE);
                    
                } catch (Exception $e) {
                    echo json_encode([]);
                }
            } else {
                echo json_encode([]);
            }
            break;

// ========================================================
        // AREA ANNOTAZIONI (NOTE STAMPA DINAMICHE)
        // ========================================================
        case 'get_annotazioni':
            echo json_encode($pdo->query("SELECT * FROM annotazioni ORDER BY id DESC")->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
            
        case 'save_annotazione':
            $input = json_decode(file_get_contents('php://input'), true);
            $id = (int)($input['id'] ?? 0);
            $idtipodoc = (int)($input['idtipodoc'] ?? 0);
            $idcliente = (int)($input['idcliente'] ?? 0);
            $titolo = $input['titolo'] ?? '';
            $testo = $input['testo'] ?? '';
            $scadenza = !empty($input['scadenza']) ? $input['scadenza'] : null;

            if ($id > 0) {
                $sql = "UPDATE annotazioni SET idtipodoc=?, idcliente=?, titolo=?, testo=?, scadenza=? WHERE id=?";
                $pdo->prepare($sql)->execute([$idtipodoc, $idcliente, $titolo, $testo, $scadenza, $id]);
            } else {
                $sql = "INSERT INTO annotazioni (idtipodoc, idcliente, titolo, testo, scadenza) VALUES (?, ?, ?, ?, ?)";
                $pdo->prepare($sql)->execute([$idtipodoc, $idcliente, $titolo, $testo, $scadenza]);
            }
            echo json_encode(["success" => true]);
            break;

        case 'delete_annotazione':
            $input = json_decode(file_get_contents('php://input'), true);
            if (!empty($input['id'])) $pdo->prepare("DELETE FROM annotazioni WHERE id=?")->execute([$input['id']]);
            echo json_encode(["success" => true]);
            break;

// --- LOGOUT (Rilascia il Token di Sessione) ---
        case 'logout':
            $input = json_decode(file_get_contents('php://input'), true);
            $username = $input['username'] ?? '';
            
            if (!empty($username) && $username !== 'MROSIGNO') {
                try {
                    // Svuotiamo il campo badge per permettere futuri login senza conflitti
                    $stmt = $pdo->prepare("UPDATE `user` SET badge = NULL WHERE fs_user_id = ?");
                    $stmt->execute([$username]);
                    echo json_encode(["success" => true]);
                } catch (Exception $e) {
                    echo json_encode(["success" => false]);
                }
            } else {
                echo json_encode(["success" => true]);
            }
            break;
			
        // IL DEFAULT DEVE STARE ALLA FINE
        default:
            echo json_encode(["message" => "API Multi-V Attiva. Endpoint non riconosciuto."]);
        break;
    }   	
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Errore Query API: " . $e->getMessage()]);
} catch(Throwable $e) {
    http_response_code(500);
    echo json_encode(["error" => "Errore Server: " . $e->getMessage()]);
}

// Ottieni l'output completo dal buffer
$output = ob_get_clean();

// Verifica che l'output sia JSON valido
$decoded = json_decode($output, true);
if (json_last_error() === JSON_ERROR_NONE && $decoded !== null) {
    // Output valido, invia
    echo $output;
} else {
    // Output non valido: invia un JSON di errore
    http_response_code(500);
    echo json_encode(["success" => false, "message" => "Errore interno del server, controlla api_error.log per dettagli"]);
}
?>
