<?php

declare(strict_types=1);

/**
 * Kiess — enregistrement des préinscriptions du site (hébergement Hostinger).
 *
 * Reçoit le POST JSON du formulaire (web/src/beta/submit.ts) et l'enregistre
 * dans la base MySQL / MariaDB du compte Hostinger. Mêmes règles que le module
 * API api/src/pre-registrations (CreatePreRegistrationDto) : les deux doivent
 * rester alignés.
 *
 * Identifiants de la base : fichier `kiess-config.php` placé HORS du dossier
 * public (un niveau au-dessus de public_html), voir web/README.md.
 *
 * Réponses : 201 enregistré · 400 donnée refusée (`message` affiché par le site)
 *            · 429 trop d'essais · 503 base non configurée · 500 erreur.
 * Une adresse déjà préinscrite reçoit la même réponse 201 qu'une nouvelle :
 * le site ne révèle jamais si quelqu'un est inscrit.
 */

const CONSENT_VERSION = '2026-11-07'; // date de la politique de confidentialité acceptée
const MIN_AGE = 18;
const MAX_AGE = 110;
const MAX_BODY_BYTES = 8192;
const RATE_PER_MINUTE = 5;
const RATE_PER_DAY = 30;
const GENDERS = ['un homme', 'une femme', 'non binaire', 'autres'];
const PREFERENCES = ['homme', 'femme', 'nb'];
const ALLOWED_KEYS = [
    'email', 'password', 'gender', 'preferences', 'birthDate',
    'acceptedTerms', 'marketingOptIn', 'website', 'source', 'submittedAt',
];
const MESSAGES = [
    'email' => 'Ton adresse mail ne semble pas valide',
    'password' => 'Ton mot de passe doit contenir au moins 8 caractères, des majuscules et des chiffres',
    'passwordTooLong' => 'Ton mot de passe ne peut pas dépasser 128 caractères',
    'gender' => 'Tu dois choisir ton genre, tu pourras le modifier plus tard',
    'preferences' => 'Choisis au moins une option',
    'birthDate' => 'Ta date de naissance ne semble pas valide (JJ/MM/AAAA)',
    'tooYoung' => 'Tu es trop jeune pour utiliser Kiess',
    'terms' => 'Merci de valider les termes et conditions pour continuer',
    'invalid' => 'Requête invalide',
];

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('X-Robots-Tag: noindex, nofollow');

function respond(int $status, array $body): never
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(int $status, string $message): never
{
    respond($status, ['statusCode' => $status, 'message' => $message]);
}

function textLength(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

/** Ne garde que utm_* et ref, en chaînes courtes (même filtre que l'API). */
function sanitizeSource(mixed $source): ?string
{
    if (!is_array($source) || array_is_list($source)) {
        return null;
    }
    $out = [];
    foreach ($source as $key => $value) {
        if (count($out) >= 10) {
            break;
        }
        if (!is_string($key) || !is_string($value) || !preg_match('/^(utm_[a-z0-9_]{1,40}|ref)$/i', $key)) {
            continue;
        }
        $out[strtolower($key)] = function_exists('mb_substr') ? mb_substr($value, 0, 120, 'UTF-8') : substr($value, 0, 120);
    }
    return $out ? json_encode($out, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;
}

function loadConfig(): ?array
{
    // 1. Recommandé : hors du dossier public (…/domains/<domaine>/kiess-config.php)
    // 2. Repli : à côté de ce script (protégé par api/.htaccess)
    foreach ([dirname(__DIR__, 2) . '/kiess-config.php', __DIR__ . '/config.php'] as $path) {
        if (is_file($path)) {
            $config = require $path;
            return is_array($config) ? $config : null;
        }
    }
    return null;
}

function connect(array $config): PDO
{
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $config['db_host'] ?? 'localhost',
        (int) ($config['db_port'] ?? 3306),
        $config['db_name'] ?? '',
    );
    $pdo = new PDO($dsn, (string) ($config['db_user'] ?? ''), (string) ($config['db_pass'] ?? ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    // Toutes les dates sont écrites en UTC.
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

/** Crée les tables à la première utilisation (aucune manipulation dans phpMyAdmin). */
function ensureSchema(PDO $pdo): void
{
    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS preinscriptions (
          id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
          email            VARCHAR(254) NOT NULL,
          password_hash    VARCHAR(255) NOT NULL COMMENT 'argon2id (ou bcrypt), jamais le mot de passe',
          gender           VARCHAR(20)  NOT NULL COMMENT 'un homme | une femme | non binaire | autres',
          preferences      VARCHAR(40)  NOT NULL DEFAULT '' COMMENT 'homme,femme,nb ; vide = tout le monde',
          birth_date       DATE         NOT NULL,
          marketing_opt_in TINYINT(1)   NOT NULL DEFAULT 0,
          consent_version  VARCHAR(20)  NOT NULL COMMENT 'version de la politique de confidentialité acceptée',
          consented_at     DATETIME     NOT NULL COMMENT 'UTC',
          source           VARCHAR(1500) NULL COMMENT 'paramètres utm_* / ref (JSON)',
          status           VARCHAR(10)  NOT NULL DEFAULT 'pending' COMMENT 'pending | selected | rejected | invited',
          created_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'UTC',
          updated_at       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          UNIQUE KEY uq_preinscriptions_email (email),
          KEY idx_preinscriptions_status_created (status, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        SQL);
    $pdo->exec(<<<'SQL'
        CREATE TABLE IF NOT EXISTS preinscription_limites (
          ip_hash    CHAR(64) NOT NULL COMMENT 'HMAC de l''adresse IP, jamais l''adresse elle-même',
          created_at DATETIME NOT NULL,
          KEY idx_limites_ip_time (ip_hash, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=ascii
        SQL);
}

// ─── Requête ──────────────────────────────────────────────────────────────
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    fail(405, 'Méthode non autorisée');
}

// Même origine uniquement : le formulaire est servi par ce même site.
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin !== '') {
    $originHost = parse_url($origin, PHP_URL_HOST);
    $host = preg_replace('/:\d+$/', '', (string) ($_SERVER['HTTP_HOST'] ?? ''));
    if (!is_string($originHost) || strcasecmp($originHost, (string) $host) !== 0) {
        fail(403, 'Origine non autorisée');
    }
}
if (($_SERVER['HTTP_SEC_FETCH_SITE'] ?? 'same-origin') === 'cross-site') {
    fail(403, 'Origine non autorisée');
}
if (stripos((string) ($_SERVER['CONTENT_TYPE'] ?? ''), 'application/json') !== 0) {
    fail(415, 'Format non supporté');
}

$raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);
if (!is_string($raw) || strlen($raw) > MAX_BODY_BYTES) {
    fail(413, 'Requête trop volumineuse');
}
try {
    $data = json_decode($raw, true, 6, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    fail(400, MESSAGES['invalid']);
}
if (!is_array($data) || ($data !== [] && array_is_list($data))) {
    fail(400, MESSAGES['invalid']);
}
// Champ inconnu = requête forgée (même règle que forbidNonWhitelisted côté API).
foreach (array_keys($data) as $key) {
    if (!in_array($key, ALLOWED_KEYS, true)) {
        fail(400, MESSAGES['invalid']);
    }
}

$config = loadConfig();
if ($config === null) {
    error_log('[kiess] préinscription : kiess-config.php introuvable');
    fail(503, 'Service momentanément indisponible');
}

try {
    $pdo = connect($config);
    ensureSchema($pdo);

    // ─── Anti-abus : 5 envois / minute et 30 / jour par adresse IP ────────
    $now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
    $secret = (string) ($config['secret'] ?? $config['db_pass'] ?? '');
    $ipHash = hash_hmac('sha256', (string) ($_SERVER['REMOTE_ADDR'] ?? ''), $secret);
    $pdo->prepare('DELETE FROM preinscription_limites WHERE created_at < ?')
        ->execute([$now->modify('-1 day')->format('Y-m-d H:i:s')]);
    $count = $pdo->prepare(
        'SELECT COALESCE(SUM(created_at >= ?), 0) AS minute, COUNT(*) AS day FROM preinscription_limites WHERE ip_hash = ?'
    );
    $count->execute([$now->modify('-60 seconds')->format('Y-m-d H:i:s'), $ipHash]);
    $recent = $count->fetch();
    if ((int) $recent['minute'] >= RATE_PER_MINUTE || (int) $recent['day'] >= RATE_PER_DAY) {
        fail(429, 'Trop de tentatives. Patiente quelques minutes avant de réessayer.');
    }
    $pdo->prepare('INSERT INTO preinscription_limites (ip_hash, created_at) VALUES (?, ?)')
        ->execute([$ipHash, $now->format('Y-m-d H:i:s')]);
} catch (PDOException $e) {
    error_log('[kiess] préinscription : base indisponible (' . $e->getCode() . ') ' . $e->getMessage());
    fail(503, 'Service momentanément indisponible');
}

// ─── Pot de miel : un robot reçoit un faux succès, rien n'est enregistré ──
$website = $data['website'] ?? '';
if (!is_string($website)) {
    fail(400, MESSAGES['invalid']);
}
if (trim($website) !== '') {
    respond(201, ['ok' => true]);
}

// ─── Validation (le site valide déjà ; ceci protège la base) ─────────────
$email = $data['email'] ?? null;
$email = is_string($email) ? strtolower(trim($email)) : '';
if ($email === '' || strlen($email) > 254 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    fail(400, MESSAGES['email']);
}

$password = $data['password'] ?? null;
if (!is_string($password) || textLength($password) < 8 || !preg_match('/[A-Z]/', $password) || !preg_match('/\d/', $password)) {
    fail(400, MESSAGES['password']);
}
if (textLength($password) > 128) {
    fail(400, MESSAGES['passwordTooLong']);
}

$gender = $data['gender'] ?? null;
if (!is_string($gender) || !in_array($gender, GENDERS, true)) {
    fail(400, MESSAGES['gender']);
}

$preferences = $data['preferences'] ?? null;
if (!is_array($preferences) || !array_is_list($preferences) || count($preferences) > count(PREFERENCES)) {
    fail(400, MESSAGES['preferences']);
}
foreach ($preferences as $preference) {
    if (!is_string($preference) || !in_array($preference, PREFERENCES, true)) {
        fail(400, MESSAGES['preferences']);
    }
}
if (count(array_unique($preferences)) !== count($preferences)) {
    fail(400, MESSAGES['preferences']);
}

$birthDate = $data['birthDate'] ?? null;
if (!is_string($birthDate) || !preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $birthDate, $m)
    || !checkdate((int) $m[2], (int) $m[3], (int) $m[1])) {
    fail(400, MESSAGES['birthDate']);
}
$today = new DateTimeImmutable('today', new DateTimeZone('UTC'));
$birth = new DateTimeImmutable($birthDate, new DateTimeZone('UTC'));
if ($birth > $today) {
    fail(400, MESSAGES['birthDate']);
}
$age = $birth->diff($today)->y;
if ($age > MAX_AGE) {
    fail(400, MESSAGES['birthDate']);
}
if ($age < MIN_AGE) {
    fail(400, MESSAGES['tooYoung']);
}

if (($data['acceptedTerms'] ?? null) !== true) {
    fail(400, MESSAGES['terms']);
}
$marketing = $data['marketingOptIn'] ?? false;
if (!is_bool($marketing)) {
    fail(400, MESSAGES['invalid']);
}
if (isset($data['submittedAt']) && !is_string($data['submittedAt'])) {
    fail(400, MESSAGES['invalid']);
}

// ─── Enregistrement ───────────────────────────────────────────────────────
// argon2id avec les mêmes réglages que l'app (api/src/auth/password.util.ts),
// pour pouvoir reprendre ces comptes tels quels ; bcrypt si PHP n'a pas argon2.
$hash = defined('PASSWORD_ARGON2ID')
    ? password_hash($password, PASSWORD_ARGON2ID, ['memory_cost' => 19456, 'time_cost' => 2, 'threads' => 1])
    : password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

try {
    $pdo->prepare(
        'INSERT INTO preinscriptions
           (email, password_hash, gender, preferences, birth_date, marketing_opt_in,
            consent_version, consented_at, source, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $email,
        $hash,
        $gender,
        implode(',', $preferences),
        $birthDate,
        $marketing ? 1 : 0,
        CONSENT_VERSION,
        $now->format('Y-m-d H:i:s'),
        sanitizeSource($data['source'] ?? null),
        $now->format('Y-m-d H:i:s'),
        $now->format('Y-m-d H:i:s'),
    ]);
} catch (PDOException $e) {
    // Adresse déjà préinscrite : même réponse qu'un succès (rien n'est modifié).
    if ((int) ($e->errorInfo[1] ?? 0) === 1062) {
        respond(201, ['ok' => true]);
    }
    error_log('[kiess] préinscription : échec d\'enregistrement (' . $e->getCode() . ')');
    fail(500, 'Impossible d’enregistrer ta demande pour le moment.');
}

respond(201, ['ok' => true]);
