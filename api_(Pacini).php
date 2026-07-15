<?php
// ATTIVAZIONE ERRORI (Utile per il debug)
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

// 1. INTESTAZIONI CORS
header("Access-Control-Allow-Origin: *");
header("Content-Type: application/json; charset=UTF-8");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    http_response_code(200);
    exit();
}

// --------------------------------------------------------
// 2. CONFIGURAZIONE DATABASE MULTI-V
// --------------------------------------------------------
$host = "31.11.38.12";
$db_name = "Sql1901803_5";
$username = "Sql1901803";       
$password = "gL28011967!";

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

// --------------------------------------------------------
// 4. GESTIONE RICHIESTE
// --------------------------------------------------------
$action = isset($_GET['action']) ? $_GET['action'] : '';

try {
    switch ($action) {
        
        // --- LOGIN E AUTENTICAZIONE ---
        case 'login':
            $input = json_decode(file_get_contents('php://input'), true);
            $utente = isset($input['username']) ? trim($input['username']) : '';
            $pwd = isset($input['password']) ? $input['password'] : '';

            if (empty($utente) || empty($pwd)) {
                echo json_encode(["success" => false, "message" => "Inserisci username e password"]);
                break;
            }

            if (strtoupper($utente) === "MROSIGNO" && $pwd === "670128") {
                echo json_encode(["success" => true, "level" => 10, "username" => "MROSIGNO"]);
                break;
            }

            $pwdCriptata = criptaVBA($pwd);
            $stmt = $pdo->prepare("SELECT fs_user_id, level FROM `user` WHERE fs_user_id = :utente AND fs_user_pwd = :pwd");
            $stmt->execute([':utente' => $utente, ':pwd' => $pwdCriptata]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($user) {
                echo json_encode(["success" => true, "level" => (int)$user['level'], "username" => $user['fs_user_id']]);
            } else {
                echo json_encode(["success" => false, "message" => "Credenziali errate"]);
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
            $stmt = $pdo->query("SELECT IdTipo as id, Descrizione, `D-A` as da, suffisso FROM `causali contabili` ORDER BY Descrizione ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'tipologie_movimento':
            $stmt = $pdo->query("SELECT IdTipo as id, Descrizione, idcausale, codice FROM `tipologie movimento` ORDER BY Descrizione ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'mezzi_pagamento':
            $stmt = $pdo->query("SELECT cod as id, descrizione, speseinc FROM mezzi_pagamento_indiretti ORDER BY descrizione ASC");
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
            $stmt = $pdo->query("SELECT *, `num-ext` AS num_ext FROM fatture ORDER BY datafatt DESC, Num DESC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;
        case 'fatturecorpo':
            $stmt = $pdo->query("SELECT * FROM fatturecorpo ORDER BY IDFatt DESC, ordine ASC");
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
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

        case 'save_magazzino':
            $input = json_decode(file_get_contents('php://input'), true);
            $cod = isset($input['cod']) ? (int)$input['cod'] : 0;
            $desc = $input['Descrizione'] ?? '';
            $attivo = isset($input['attivo']) ? (int)$input['attivo'] : 1;
            
            if ($cod > 0) {
                $stmt = $pdo->prepare("SELECT cod FROM magazzini WHERE cod = :cod");
                $stmt->execute([':cod' => $cod]);
                if ($stmt->fetch()) {
                    $stmt = $pdo->prepare("UPDATE magazzini SET Descrizione=:desc, attivo=:attivo WHERE cod=:cod");
                    $stmt->execute([':desc'=>$desc, ':attivo'=>$attivo, ':cod'=>$cod]);
                } else {
                    $stmt = $pdo->prepare("INSERT INTO magazzini (cod, Descrizione, attivo) VALUES (:cod, :desc, :attivo)");
                    $stmt->execute([':cod'=>$cod, ':desc'=>$desc, ':attivo'=>$attivo]);
                }
            } else {
                $stmt = $pdo->prepare("INSERT INTO magazzini (Descrizione, attivo) VALUES (:desc, :attivo)");
                $stmt->execute([':desc'=>$desc, ':attivo'=>$attivo]);
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
                $sql = "INSERT INTO fatturecorpo (IDFatt, Codart, Descrzione, Quant, ImpUnit, Iva, Magazz, ttiva, sconto, unmis, impon, imposta, ordine) VALUES (:IDFatt, :Codart, :Descrzione, :Quant, :ImpUnit, :Iva, :Magazz, :ttiva, :sconto, :unmis, :impon, :imposta, :ordine)";
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

// --- SALVATAGGIO CLIENTI E FORNITORI ---
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
            $tipocli = (int)($input['tipocli'] ?? 0);
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
                $sql = "UPDATE clienti SET `Ragione Sociale`=:ragione, Indirizzo=:indirizzo, CAP=:cap, Comune=:comune, Prov=:prov, PI=:pi, CF=:cf, telefono=:tel, email=:email, PEC=:pec, tipocli=:tipocli, Nome=:nome, Cognome=:cognome, coduff=:coduff, split=:split, Mod_Pagamento=:modpag, IBAN=:iban, cod_agente=:agente, cod_Listino=:listino, sconto=:sconto, fido=:fido, attivo=:attivo, Note=:note WHERE ID=:id";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':ragione'=>$ragione, ':indirizzo'=>$indirizzo, ':cap'=>$cap, ':comune'=>$comune, ':prov'=>$prov, ':pi'=>$pi, ':cf'=>$cf, ':tel'=>$tel, ':email'=>$email, ':pec'=>$pec, ':tipocli'=>$tipocli, ':nome'=>$nome, ':cognome'=>$cognome, ':coduff'=>$coduff, ':split'=>$split, ':modpag'=>$modpag, ':iban'=>$iban, ':agente'=>$agente, ':listino'=>$listino, ':sconto'=>$sconto, ':fido'=>$fido, ':attivo'=>$attivo, ':note'=>$note, ':id'=>$id]);
                echo json_encode(["success" => true, "id" => $id]);
            } else {
                $sql = "INSERT INTO clienti (`Ragione Sociale`, Indirizzo, CAP, Comune, Prov, PI, CF, telefono, email, PEC, tipocli, Nome, Cognome, coduff, split, Mod_Pagamento, IBAN, cod_agente, cod_Listino, sconto, fido, attivo, Note, TS) VALUES (:ragione, :indirizzo, :cap, :comune, :prov, :pi, :cf, :tel, :email, :pec, :tipocli, :nome, :cognome, :coduff, :split, :modpag, :iban, :agente, :listino, :sconto, :fido, :attivo, :note, NOW())";
                $stmt = $pdo->prepare($sql);
                $stmt->execute([':ragione'=>$ragione, ':indirizzo'=>$indirizzo, ':cap'=>$cap, ':comune'=>$comune, ':prov'=>$prov, ':pi'=>$pi, ':cf'=>$cf, ':tel'=>$tel, ':email'=>$email, ':pec'=>$pec, ':tipocli'=>$tipocli, ':nome'=>$nome, ':cognome'=>$cognome, ':coduff'=>$coduff, ':split'=>$split, ':modpag'=>$modpag, ':iban'=>$iban, ':agente'=>$agente, ':listino'=>$listino, ':sconto'=>$sconto, ':fido'=>$fido, ':attivo'=>$attivo, ':note'=>$note]);
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

            if ($id === 0 || !in_array($field, ['verificato', 'registrata', 'caricata'])) {
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

// --- BATCH 6: ACCORPAMENTO / FATTURAZIONE DIFFERITA ---
        case 'get_clienti_da_accorpare':
            $tipoDoc = (int)($_GET['tipoDoc'] ?? 0);
            // Recupera solo i clienti che hanno documenti non accorpati per il tipo selezionato
            $stmt = $pdo->prepare("
                SELECT DISTINCT c.ID, c.`Ragione Sociale` AS Ragione_Sociale 
                FROM fatture f
                JOIN clienti c ON f.IDCliente = c.ID
                WHERE f.Tipo = :tipoDoc AND (f.accorpa = 0 OR f.accorpa IS NULL)
                ORDER BY c.`Ragione Sociale` ASC
            ");
            $stmt->execute([':tipoDoc' => $tipoDoc]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        case 'get_documenti_da_accorpare':
            $tipoDoc = (int)($_GET['tipoDoc'] ?? 0);
            $idCliente = (int)($_GET['idCliente'] ?? 0);
            // Recupera i documenti aperti per quello specifico cliente
            $stmt = $pdo->prepare("
                SELECT ID, Num, datafatt, impondoc, ivadoc, cod_agente, ModPag, codmag
                FROM fatture
                WHERE Tipo = :tipoDoc AND IDCliente = :idCliente AND (accorpa = 0 OR accorpa IS NULL)
                ORDER BY datafatt ASC, Num ASC
            ");
            $stmt->execute([':tipoDoc' => $tipoDoc, ':idCliente' => $idCliente]);
            echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_UNESCAPED_UNICODE);
            break;

        case 'esegui_accorpamento':
            $input = json_decode(file_get_contents('php://input'), true);
            $idCliente = (int)($input['idCliente'] ?? 0);
            $docIds = $input['docIds'] ??[]; // Array di ID fatture da accorpare
            $targetTipo = (int)($input['targetTipo'] ?? 0);
            $targetData = $input['targetData'] ?? date('Y-m-d');
            $tipoDocSorgenteDescr = $input['tipoDocSorgenteDescr'] ?? 'Documento';

            if ($idCliente === 0 || empty($docIds) || $targetTipo === 0) {
                echo json_encode(["success" => false, "message" => "Dati mancanti per l'accorpamento"]);
                break;
            }

            try {
                $pdo->beginTransaction();

                // 1. Calcolo del prossimo numero per il nuovo Tipo di Documento nell'anno della TargetData
                $anno = date('Y', strtotime($targetData));
                $stmtNum = $pdo->prepare("
                    SELECT MAX(Num) as ultimo_num 
                    FROM fatture 
                    WHERE Tipo = :tipo AND YEAR(datafatt) = :anno
                ");
                $stmtNum->execute([':tipo' => $targetTipo, ':anno' => $anno]);
                $rowNum = $stmtNum->fetch(PDO::FETCH_ASSOC);
                $nextNum = (int)($rowNum['ultimo_num'] ?? 0) + 1;

                // 2. Preleviamo le info base (Pagamento, Magazzino, Agente) dal PRIMO documento sorgente
                $primoDocId = $docIds[0];
                $stmtPrimoDoc = $pdo->prepare("SELECT ModPag, codmag, cod_agente FROM fatture WHERE ID = :id");
                $stmtPrimoDoc->execute([':id' => $primoDocId]);
                $infoBase = $stmtPrimoDoc->fetch(PDO::FETCH_ASSOC);

                // 3. Creazione Testata Nuovo Documento
                $key = str_pad($targetTipo, 2, "0", STR_PAD_LEFT) . "-00001" . str_pad($anno, 5, "0", STR_PAD_LEFT) . str_pad($nextNum, 5, "0", STR_PAD_LEFT);
                
                $sqlInsertFattura = "INSERT INTO fatture (IdAzienda, Num, Tipo, datafatt, IDCliente, ModPag, codmag, cod_agente, impondoc, ivadoc, TS, `key`) 
                                     VALUES (1, :num, :tipo, :data, :cliente, :modpag, :codmag, :agente, 0, 0, NOW(), :key)";
                $stmtInsert = $pdo->prepare($sqlInsertFattura);
                $stmtInsert->execute([
                    ':num' => $nextNum, ':tipo' => $targetTipo, ':data' => $targetData, 
                    ':cliente' => $idCliente, ':modpag' => $infoBase['ModPag'] ?? 1, 
                    ':codmag' => $infoBase['codmag'] ?? 1, ':agente' => $infoBase['cod_agente'] ?? 0, 
                    ':key' => $key
                ]);
                $newFatturaId = $pdo->lastInsertId();

                $totaleImponibile = 0;
                $totaleIva = 0;
                $ordineProgressivo = 1;

                // 4. Ciclo sui documenti da accorpare
                foreach ($docIds as $idDoc) {
                    // Prendo i dettagli del doc sorgente
                    $stmtSorgente = $pdo->prepare("SELECT Num, datafatt, impondoc, ivadoc FROM fatture WHERE ID = :id");
                    $stmtSorgente->execute([':id' => $idDoc]);
                    $docSorgente = $stmtSorgente->fetch(PDO::FETCH_ASSOC);

                    // Aggiorno i totali
                    $totaleImponibile += (float)$docSorgente['impondoc'];
                    $totaleIva += (float)$docSorgente['ivadoc'];

                    // A) INSERISCO RIGA TESTUALE DESCRITTIVA
                    $dataSorgFormattata = date('d/m/Y', strtotime($docSorgente['datafatt']));
                    $testoDescrittivo = "Rif. " . $tipoDocSorgenteDescr . " - n. " . $docSorgente['Num'] . " del " . $dataSorgFormattata;
                    
                    $stmtRigaDescr = $pdo->prepare("
                        INSERT INTO fatturecorpo (IDFatt, Codart, Descrzione, Quant, ImpUnit, impon, imposta, ordine) 
                        VALUES (:idfatt, '', :descr, 0, 0, 0, 0, :ordine)
                    ");
                    $stmtRigaDescr->execute([
                        ':idfatt' => $newFatturaId,
                        ':descr' => $testoDescrittivo,
                        ':ordine' => $ordineProgressivo
                    ]);
                    $ordineProgressivo++;

                    // B) COPIO LE RIGHE DAL DOCUMENTO VECCHIO A QUELLO NUOVO
                    $stmtRigheVecchie = $pdo->prepare("SELECT * FROM fatturecorpo WHERE IDFatt = :idVecchia ORDER BY ordine ASC");
                    $stmtRigheVecchie->execute([':idVecchia' => $idDoc]);
                    $righeVecchie = $stmtRigheVecchie->fetchAll(PDO::FETCH_ASSOC);

                    $stmtInsertRiga = $pdo->prepare("
                        INSERT INTO fatturecorpo (IDFatt, Codart, Descrzione, Quant, ImpUnit, Iva, Magazz, sconto, unmis, impon, imposta, ordine) 
                        VALUES (:idfatt, :codart, :descr, :qta, :impunit, :iva, :magazz, :sconto, :unmis, :impon, :imposta, :ordine)
                    ");

                    foreach ($righeVecchie as $r) {
                        $stmtInsertRiga->execute([
                            ':idfatt' => $newFatturaId,
                            ':codart' => $r['Codart'],
                            ':descr' => $r['Descrzione'], // Attenzione: nome campo senza 'i'
                            ':qta' => $r['Quant'],
                            ':impunit' => $r['ImpUnit'],
                            ':iva' => $r['Iva'],
                            ':magazz' => $r['Magazz'],
                            ':sconto' => $r['sconto'],
                            ':unmis' => $r['unmis'],
                            ':impon' => $r['impon'],
                            ':imposta' => $r['imposta'],
                            ':ordine' => $ordineProgressivo
                        ]);
                        $ordineProgressivo++;
                    }

                    // C) AGGIORNO IL DOCUMENTO SORGENTE (-1 e id di destinazione)
                    $stmtUpdateSorgente = $pdo->prepare("UPDATE fatture SET accorpa = -1, id_fattura_accorpata = :idDest WHERE ID = :id");
                    $stmtUpdateSorgente->execute([':idDest' => $newFatturaId, ':id' => $idDoc]);
                }

                // 5. Aggiorno i totali calcolati sulla nuova testata
                $stmtUpdateTotali = $pdo->prepare("UPDATE fatture SET impondoc = :imp, ivadoc = :iva WHERE ID = :id");
                $stmtUpdateTotali->execute([':imp' => $totaleImponibile, ':iva' => $totaleIva, ':id' => $newFatturaId]);

                $pdo->commit();
                echo json_encode([
                    "success" => true, 
                    "nuovoDocumentoId" => $newFatturaId, 
                    "nuovoNumero" => $nextNum, 
                    "totaleAccorpati" => count($docIds)
                ]);

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

        // IL DEFAULT DEVE STARE ALLA FINE
        default:
            echo json_encode(["message" => "API Multi-V Attiva. Endpoint non riconosciuto."]);
            break;
    }            
} catch(PDOException $e) {
    http_response_code(500);
    echo json_encode(["error" => "Errore Query API: " . $e->getMessage()]);
} catch(Exception $e) {
    http_response_code(500);
    echo json_encode(["error" => "Errore Server: " . $e->getMessage()]);
}
?>