<?php
declare(strict_types=1);

/**
 * FlowForge connection lab — public demo backends on this host.
 *
 * Base URL (production): https://gkjtt.co.za/flowforge/demo
 *
 * Routes (JSON unless noted):
 *   GET  /health
 *   GET  /customers
 *   GET  /customers/{id}
 *   GET  /orders?customer_id=
 *   GET  /orders/{id}
 *   POST /echo
 *   POST /email/sink     — records a fake send (for HTTP demos of mail payloads)
 *   GET  /email/inbox    — last recorded emails (cap 50)
 *   POST /seed           — recreate SQLite sample data (safe to re-run)
 *   GET  /banking/products
 *   GET  /banking/balance?account=
 *   POST /banking/loan-quote
 *   GET  /health/services
 *   POST /health/appointments
 *   GET  /education/programmes
 *   GET  /mining/sites
 *   GET  /retail/orders/{ref}
 *   GET  /government/cases/{ref}
 *   GET  /crm/pipeline
 *   GET  /crm/accounts?email=
 *   GET  /crm/accounts/{id}
 *   GET  /crm/deals/{ref}
 *   GET  /crm/products
 *   POST /crm/leads
 *   POST /crm/tickets
 *   POST /crm/meetings
 *   POST /industry/submit
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-API-Key');
if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$dataDir = __DIR__ . '/data';
$dbPath = $dataDir . '/demo.sqlite';
$inboxPath = $dataDir . '/email-inbox.json';

if (!is_dir($dataDir)) {
    mkdir($dataDir, 0755, true);
}

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
foreach (['/flowforge/demo', '/demo'] as $prefix) {
    if (strncmp($path, $prefix, strlen($prefix)) === 0) {
        $path = substr($path, strlen($prefix)) ?: '/';
        break;
    }
}
$path = '/' . trim($path, '/');
if ($path === '/') {
    // keep
} elseif (!str_starts_with($path, '/')) {
    $path = '/' . $path;
}
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
$raw = file_get_contents('php://input') ?: '';
$json = json_decode($raw, true);
$body = is_array($json) ? $json : [];

$respond = static function (int $status, array $payload) use ($method, $path): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(
        array_merge(
            [
                '_demo' => true,
                '_request' => ['method' => $method, 'path' => $path],
            ],
            $payload,
        ),
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE,
    );
    exit;
};

$pdo = static function () use ($dbPath): PDO {
    $pdo = new PDO('sqlite:' . $dbPath, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    return $pdo;
};

$seed = static function (PDO $db): void {
    $db->exec('DROP TABLE IF EXISTS orders');
    $db->exec('DROP TABLE IF EXISTS customers');
    $db->exec('DROP TABLE IF EXISTS industry_submissions');
    $db->exec('DROP TABLE IF EXISTS crm_deals');
    $db->exec('DROP TABLE IF EXISTS crm_accounts');
    $db->exec(
        'CREATE TABLE customers (
            id INTEGER PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT NOT NULL,
            city TEXT NOT NULL,
            status TEXT NOT NULL
        )'
    );
    $db->exec(
        'CREATE TABLE orders (
            id INTEGER PRIMARY KEY,
            customer_id INTEGER NOT NULL,
            reference TEXT NOT NULL UNIQUE,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            status TEXT NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES customers(id)
        )'
    );
    $db->exec(
        'CREATE TABLE industry_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            industry TEXT NOT NULL,
            service TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at TEXT NOT NULL
        )'
    );
    $db->exec(
        'CREATE TABLE crm_accounts (
            id INTEGER PRIMARY KEY,
            account_code TEXT NOT NULL UNIQUE,
            company TEXT NOT NULL,
            contact_name TEXT NOT NULL,
            email TEXT NOT NULL,
            tier TEXT NOT NULL,
            owner TEXT NOT NULL,
            arr REAL NOT NULL,
            city TEXT NOT NULL,
            status TEXT NOT NULL
        )'
    );
    $db->exec(
        'CREATE TABLE crm_deals (
            id INTEGER PRIMARY KEY,
            deal_ref TEXT NOT NULL UNIQUE,
            account_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            stage TEXT NOT NULL,
            amount REAL NOT NULL,
            currency TEXT NOT NULL,
            close_date TEXT NOT NULL,
            FOREIGN KEY (account_id) REFERENCES crm_accounts(id)
        )'
    );
    $customers = [
        [1, 'ada@example.com', 'Ada Lovelace', 'London', 'active'],
        [2, 'grace@example.com', 'Grace Hopper', 'New York', 'active'],
        [3, 'alan@example.com', 'Alan Turing', 'Manchester', 'inactive'],
        [4, 'client@ledgerbank.example', 'Demo Client', 'Johannesburg', 'active'],
        [5, 'patient@careflow.example', 'Demo Patient', 'Cape Town', 'active'],
        [6, 'rep@pulsecrm.example', 'Demo Rep', 'Sandton', 'active'],
    ];
    $insC = $db->prepare('INSERT INTO customers (id, email, name, city, status) VALUES (?, ?, ?, ?, ?)');
    foreach ($customers as $row) {
        $insC->execute($row);
    }
    $orders = [
        [101, 1, 'ORD-1001', 120.5, 'ZAR', 'paid'],
        [102, 1, 'ORD-1002', 45.0, 'ZAR', 'pending'],
        [103, 2, 'ORD-2001', 990.0, 'ZAR', 'paid'],
        [104, 3, 'ORD-3001', 15.25, 'ZAR', 'cancelled'],
        [105, 4, 'NL-45821', 1899.0, 'ZAR', 'out_for_delivery'],
        [106, 5, 'CA-2026-1188', 850.0, 'ZAR', 'in_progress'],
    ];
    $insO = $db->prepare(
        'INSERT INTO orders (id, customer_id, reference, amount, currency, status) VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($orders as $row) {
        $insO->execute($row);
    }
    $accounts = [
        [1, 'ACC-100', 'Northwind Traders', 'Pat Coleman', 'pat@northwind.example', 'Growth', 'Aisha N.', 186000, 'Johannesburg', 'customer'],
        [2, 'ACC-210', 'Summit Labs', 'Kai Mendes', 'kai@summitlabs.example', 'Enterprise', 'Jordan P.', 420000, 'Cape Town', 'customer'],
        [3, 'ACC-330', 'Harbour Retail', 'Sam Okeke', 'sam@harbour.example', 'Starter', 'Aisha N.', 48000, 'Durban', 'prospect'],
        [4, 'ACC-DEMO', 'PulseCRM Demo Co', 'Demo Rep', 'rep@pulsecrm.example', 'Growth', 'Jordan P.', 96000, 'Sandton', 'customer'],
    ];
    $insA = $db->prepare(
        'INSERT INTO crm_accounts (id, account_code, company, contact_name, email, tier, owner, arr, city, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($accounts as $row) {
        $insA->execute($row);
    }
    $deals = [
        [1, 'DEAL-2026-0042', 1, 'Northwind expansion seats', 'Negotiation', 72000, 'ZAR', '2026-10-15'],
        [2, 'DEAL-2026-0110', 2, 'Summit Labs annual renewal', 'Proposal', 420000, 'ZAR', '2026-11-01'],
        [3, 'DEAL-2026-0188', 3, 'Harbour Retail pilot', 'Qualification', 24000, 'ZAR', '2026-09-30'],
        [4, 'DEAL-2026-0201', 4, 'PulseCRM Demo Co add-ons', 'Closed Won', 18000, 'ZAR', '2026-08-12'],
    ];
    $insD = $db->prepare(
        'INSERT INTO crm_deals (id, deal_ref, account_id, name, stage, amount, currency, close_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($deals as $row) {
        $insD->execute($row);
    }
};

if ($method === 'GET' && ($path === '/' || $path === '/index.php')) {
    $respond(200, [
        'ok' => true,
        'service' => 'flowforge-connection-lab',
        'endpoints' => [
            'GET /health',
            'GET /customers',
            'GET /customers/{id}',
            'GET /orders?customer_id=',
            'GET /orders/{id}',
            'POST /echo',
            'POST /email/sink',
            'GET /email/inbox',
            'POST /seed',
            'GET /banking/products',
            'GET /banking/balance?account=',
            'POST /banking/loan-quote',
            'GET /health/services',
            'POST /health/appointments',
            'GET /education/programmes',
            'GET /mining/sites',
            'GET /retail/orders/{ref}',
            'GET /government/cases/{ref}',
            'GET /crm/pipeline',
            'GET /crm/accounts?email=',
            'GET /crm/accounts/{id}',
            'GET /crm/deals/{ref}',
            'GET /crm/products',
            'POST /crm/leads',
            'POST /crm/tickets',
            'POST /crm/meetings',
            'POST /industry/submit',
        ],
        'database_file' => $dbPath,
        'docs' => 'See CONNECTIONS.md in this folder',
    ]);
}

if ($method === 'GET' && $path === '/health') {
    $respond(200, ['ok' => true, 'service' => 'flowforge-connection-lab', 'time' => gmdate('c')]);
}

if ($method === 'POST' && $path === '/seed') {
    $seed($pdo());
    $respond(200, ['ok' => true, 'seeded' => true, 'database' => $dbPath]);
}

if ($method === 'POST' && $path === '/echo') {
    $respond(200, [
        'ok' => true,
        'received' => $body,
        'query' => $_GET,
        'headers' => [
            'authorization' => $_SERVER['HTTP_AUTHORIZATION'] ?? null,
            'x-api-key' => $_SERVER['HTTP_X_API_KEY'] ?? null,
        ],
    ]);
}

if ($method === 'POST' && $path === '/email/sink') {
    $to = trim((string) ($body['to'] ?? $_POST['to'] ?? ''));
    $subject = (string) ($body['subject'] ?? $_POST['subject'] ?? '');
    $message = (string) ($body['body'] ?? $body['message'] ?? $_POST['body'] ?? '');
    if ($to === '' || $subject === '') {
        $respond(400, ['ok' => false, 'error' => 'to and subject are required']);
    }
    $inbox = [];
    if (is_file($inboxPath)) {
        $decoded = json_decode((string) file_get_contents($inboxPath), true);
        if (is_array($decoded)) {
            $inbox = $decoded;
        }
    }
    array_unshift($inbox, [
        'id' => bin2hex(random_bytes(6)),
        'at' => gmdate('c'),
        'to' => $to,
        'subject' => $subject,
        'body' => $message,
    ]);
    $inbox = array_slice($inbox, 0, 50);
    file_put_contents($inboxPath, json_encode($inbox, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
    $respond(200, [
        'ok' => true,
        'message_id' => $inbox[0]['id'],
        'to' => $to,
        'subject' => $subject,
        'body' => $message,
    ]);
}

if ($method === 'GET' && $path === '/email/inbox') {
    $inbox = [];
    if (is_file($inboxPath)) {
        $decoded = json_decode((string) file_get_contents($inboxPath), true);
        if (is_array($decoded)) {
            $inbox = $decoded;
        }
    }
    $respond(200, ['ok' => true, 'messages' => $inbox, 'count' => count($inbox)]);
}

if (!is_file($dbPath)) {
    $seed($pdo());
}

$db = $pdo();

if ($method === 'GET' && $path === '/customers') {
    $rows = $db->query('SELECT id, email, name, city, status FROM customers ORDER BY id')->fetchAll();
    $respond(200, ['ok' => true, 'data' => $rows, 'count' => count($rows)]);
}

if ($method === 'GET' && preg_match('#^/customers/(\d+)$#', $path, $m)) {
    $stmt = $db->prepare('SELECT id, email, name, city, status FROM customers WHERE id = :id');
    $stmt->execute(['id' => (int) $m[1]]);
    $row = $stmt->fetch();
    if (!$row) {
        $respond(404, ['ok' => false, 'error' => 'customer_not_found']);
    }
    $respond(200, ['ok' => true, 'data' => $row]);
}

if ($method === 'GET' && $path === '/orders') {
    $customerId = trim((string) ($_GET['customer_id'] ?? ''));
    if ($customerId !== '') {
        $stmt = $db->prepare(
            'SELECT id, customer_id, reference, amount, currency, status FROM orders WHERE customer_id = :cid ORDER BY id'
        );
        $stmt->execute(['cid' => (int) $customerId]);
        $rows = $stmt->fetchAll();
    } else {
        $rows = $db->query(
            'SELECT id, customer_id, reference, amount, currency, status FROM orders ORDER BY id'
        )->fetchAll();
    }
    $respond(200, ['ok' => true, 'data' => $rows, 'count' => count($rows)]);
}

if ($method === 'GET' && preg_match('#^/orders/(\d+)$#', $path, $m)) {
    $stmt = $db->prepare(
        'SELECT id, customer_id, reference, amount, currency, status FROM orders WHERE id = :id'
    );
    $stmt->execute(['id' => (int) $m[1]]);
    $row = $stmt->fetch();
    if (!$row) {
        $respond(404, ['ok' => false, 'error' => 'order_not_found']);
    }
    $respond(200, ['ok' => true, 'data' => $row]);
}

// --- Industry demo routes (used by use-case chatbot packs) ---

if ($method === 'GET' && $path === '/banking/products') {
    $respond(200, [
        'ok' => true,
        'data' => [
            ['code' => 'CHQ', 'name' => 'Everyday cheque', 'monthly_fee' => 59],
            ['code' => 'SAV', 'name' => 'Savings', 'monthly_fee' => 0],
            ['code' => 'YTH', 'name' => 'Youth / student', 'monthly_fee' => 0],
            ['code' => 'BIZ', 'name' => 'Business starter', 'monthly_fee' => 149],
        ],
    ]);
}

if ($method === 'GET' && $path === '/banking/balance') {
    $account = trim((string) ($_GET['account'] ?? 'Cheque ···· 4821'));
    $balances = [
        'Cheque ···· 4821' => ['available' => 12480.55, 'pending' => 320.0, 'currency' => 'ZAR'],
        'Savings ···· 0193' => ['available' => 48200.0, 'pending' => 0.0, 'currency' => 'ZAR'],
        'Credit card ···· 7740' => ['available' => 8500.0, 'pending' => 1200.0, 'currency' => 'ZAR'],
    ];
    $row = $balances[$account] ?? ['available' => 1000.0, 'pending' => 0.0, 'currency' => 'ZAR'];
    $respond(200, [
        'ok' => true,
        'account' => $account,
        'data' => $row,
        'as_of' => gmdate('c'),
    ]);
}

if ($method === 'POST' && $path === '/banking/loan-quote') {
    $amount = (float) ($body['amount'] ?? $body['loan_amount'] ?? 0);
    $termMonths = (int) preg_replace('/\D+/', '', (string) ($body['term'] ?? $body['loan_term'] ?? '36')) ?: 36;
    if ($amount <= 0) {
        $respond(400, ['ok' => false, 'error' => 'amount is required']);
    }
    $rate = $amount >= 100000 ? 0.129 : 0.149;
    $monthly = round(($amount * (1 + $rate * ($termMonths / 12))) / $termMonths, 2);
    $respond(200, [
        'ok' => true,
        'quote_id' => 'LQ-' . substr(bin2hex(random_bytes(4)), 0, 8),
        'amount' => $amount,
        'term_months' => $termMonths,
        'indicative_rate' => $rate,
        'estimated_monthly' => $monthly,
        'currency' => 'ZAR',
        'decision' => $amount > 500000 ? 'manual_review' : 'pre_approved_demo',
    ]);
}

if ($method === 'GET' && $path === '/health/services') {
    $respond(200, [
        'ok' => true,
        'data' => [
            ['code' => 'GP-01', 'name' => 'General practice', 'wait_mins' => 25],
            ['code' => 'PED-02', 'name' => 'Paediatrics', 'wait_mins' => 40],
            ['code' => 'TEL-10', 'name' => 'Telehealth triage', 'wait_mins' => 10],
            ['code' => 'VAX-03', 'name' => 'Nurse / vaccinations', 'wait_mins' => 15],
        ],
    ]);
}

if ($method === 'POST' && $path === '/health/appointments') {
    $respond(200, [
        'ok' => true,
        'booking_id' => 'CF-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
        'received' => $body,
        'status' => 'confirmed_demo',
    ]);
}

if ($method === 'GET' && $path === '/education/programmes') {
    $respond(200, [
        'ok' => true,
        'data' => [
            ['code' => 'BCOM', 'name' => 'BCom Business Management', 'faculty' => 'Commerce', 'seats' => 80],
            ['code' => 'BENG', 'name' => 'BEng Civil Engineering', 'faculty' => 'Engineering', 'seats' => 40],
            ['code' => 'NURS', 'name' => 'BSc Nursing', 'faculty' => 'Health', 'seats' => 35],
            ['code' => 'BA', 'name' => 'BA Digital Media', 'faculty' => 'Arts', 'seats' => 50],
        ],
    ]);
}

if ($method === 'GET' && $path === '/mining/sites') {
    $respond(200, [
        'ok' => true,
        'data' => [
            ['code' => 'PIT-A', 'name' => 'Pit A', 'induction_slots' => 12],
            ['code' => 'PLT-B', 'name' => 'Plant B', 'induction_slots' => 8],
            ['code' => 'WKS-C', 'name' => 'Workshop C', 'induction_slots' => 6],
            ['code' => 'CMP-D', 'name' => 'Camp D', 'induction_slots' => 20],
        ],
    ]);
}

if ($method === 'GET' && preg_match('#^/retail/orders/([^/]+)$#', $path, $m)) {
    $ref = urldecode($m[1]);
    $stmt = $db->prepare(
        'SELECT id, customer_id, reference, amount, currency, status FROM orders WHERE reference = :ref'
    );
    $stmt->execute(['ref' => $ref]);
    $row = $stmt->fetch();
    if (!$row) {
        $respond(200, [
            'ok' => true,
            'data' => [
                'reference' => $ref,
                'status' => 'out_for_delivery',
                'eta' => '15:00–18:00',
                'amount' => 1899,
                'currency' => 'ZAR',
                'simulated' => true,
            ],
        ]);
    }
    $respond(200, ['ok' => true, 'data' => $row]);
}

if ($method === 'GET' && preg_match('#^/government/cases/([^/]+)$#', $path, $m)) {
    $ref = urldecode($m[1]);
    $respond(200, [
        'ok' => true,
        'data' => [
            'case_ref' => $ref,
            'status' => 'in_progress',
            'department' => 'Roads',
            'last_update' => 'yesterday',
            'simulated' => true,
        ],
    ]);
}

// --- CRM demo routes ---

if ($method === 'GET' && $path === '/crm/pipeline') {
    $respond(200, [
        'ok' => true,
        'currency' => 'ZAR',
        'data' => [
            ['stage' => 'Qualification', 'deals' => 8, 'pipeline_value' => 186000],
            ['stage' => 'Proposal', 'deals' => 5, 'pipeline_value' => 540000],
            ['stage' => 'Negotiation', 'deals' => 3, 'pipeline_value' => 210000],
            ['stage' => 'Closed Won', 'deals' => 12, 'pipeline_value' => 980000],
        ],
        'as_of' => gmdate('c'),
    ]);
}

if ($method === 'GET' && $path === '/crm/products') {
    $respond(200, [
        'ok' => true,
        'data' => [
            ['sku' => 'PC-SEATS', 'name' => 'Extra seats (10-pack)', 'price' => 2400],
            ['sku' => 'PC-AI', 'name' => 'AI insight add-on', 'price' => 8900],
            ['sku' => 'PC-SSO', 'name' => 'SSO / SCIM pack', 'price' => 12000],
            ['sku' => 'PC-SUCCESS', 'name' => 'Success hours (5)', 'price' => 6500],
        ],
    ]);
}

if ($method === 'GET' && $path === '/crm/accounts') {
    $email = strtolower(trim((string) ($_GET['email'] ?? '')));
    $db = $pdo();
    try {
        if ($email !== '') {
            $stmt = $db->prepare(
                'SELECT id, account_code, company, contact_name, email, tier, owner, arr, city, status
                 FROM crm_accounts WHERE lower(email) = :email LIMIT 1'
            );
            $stmt->execute(['email' => $email]);
            $row = $stmt->fetch();
            if (!$row) {
                $respond(200, [
                    'ok' => true,
                    'found' => false,
                    'data' => null,
                    'hint' => 'Try rep@pulsecrm.example',
                ]);
            }
            $respond(200, ['ok' => true, 'found' => true, 'data' => $row]);
        }
        $rows = $db->query(
            'SELECT id, account_code, company, contact_name, email, tier, owner, arr, city, status
             FROM crm_accounts ORDER BY id'
        )->fetchAll();
        $respond(200, ['ok' => true, 'data' => $rows, 'count' => count($rows)]);
    } catch (Throwable $e) {
        $respond(200, [
            'ok' => true,
            'found' => $email === 'rep@pulsecrm.example',
            'data' => $email === 'rep@pulsecrm.example'
                ? [
                    'id' => 4,
                    'account_code' => 'ACC-DEMO',
                    'company' => 'PulseCRM Demo Co',
                    'contact_name' => 'Demo Rep',
                    'email' => 'rep@pulsecrm.example',
                    'tier' => 'Growth',
                    'owner' => 'Jordan P.',
                    'arr' => 96000,
                    'city' => 'Sandton',
                    'status' => 'customer',
                ]
                : null,
            'simulated' => true,
        ]);
    }
}

if ($method === 'GET' && preg_match('#^/crm/accounts/(\d+)$#', $path, $m)) {
    $db = $pdo();
    try {
        $stmt = $db->prepare(
            'SELECT id, account_code, company, contact_name, email, tier, owner, arr, city, status
             FROM crm_accounts WHERE id = :id'
        );
        $stmt->execute(['id' => (int) $m[1]]);
        $row = $stmt->fetch();
        if (!$row) {
            $respond(404, ['ok' => false, 'error' => 'account_not_found']);
        }
        $respond(200, ['ok' => true, 'data' => $row]);
    } catch (Throwable $e) {
        $respond(404, ['ok' => false, 'error' => 'account_not_found']);
    }
}

if ($method === 'GET' && preg_match('#^/crm/deals/([^/]+)$#', $path, $m)) {
    $ref = urldecode($m[1]);
    $db = $pdo();
    try {
        $stmt = $db->prepare(
            'SELECT d.deal_ref, d.name, d.stage, d.amount, d.currency, d.close_date,
                    a.company, a.account_code, a.owner, a.tier
             FROM crm_deals d
             JOIN crm_accounts a ON a.id = d.account_id
             WHERE d.deal_ref = :ref'
        );
        $stmt->execute(['ref' => $ref]);
        $row = $stmt->fetch();
        if ($row) {
            $respond(200, ['ok' => true, 'data' => $row]);
        }
    } catch (Throwable $e) {
        // fall through to simulated
    }
    $respond(200, [
        'ok' => true,
        'data' => [
            'deal_ref' => $ref,
            'name' => 'Demo opportunity',
            'stage' => 'Negotiation',
            'amount' => 72000,
            'currency' => 'ZAR',
            'close_date' => '2026-10-15',
            'company' => 'Northwind Traders',
            'account_code' => 'ACC-100',
            'owner' => 'Aisha N.',
            'tier' => 'Growth',
            'simulated' => true,
        ],
        'hint' => 'Try DEAL-2026-0042 after seeding',
    ]);
}

if ($method === 'POST' && $path === '/crm/leads') {
    $company = trim((string) ($body['company'] ?? $body['account'] ?? 'New lead'));
    $respond(200, [
        'ok' => true,
        'lead_id' => 'LEAD-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
        'score' => (int) ($body['score'] ?? 72),
        'status' => 'new',
        'owner' => (string) ($body['owner'] ?? 'Unassigned queue'),
        'company' => $company,
        'received' => $body,
    ]);
}

if ($method === 'POST' && $path === '/crm/tickets') {
    $priority = trim((string) ($body['priority'] ?? 'Normal'));
    $respond(200, [
        'ok' => true,
        'ticket_id' => 'TKT-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
        'priority' => $priority,
        'sla_hours' => stripos($priority, 'critical') !== false || stripos($priority, 'high') !== false ? 4 : 24,
        'status' => 'open',
        'received' => $body,
    ]);
}

if ($method === 'POST' && $path === '/crm/meetings') {
    $respond(200, [
        'ok' => true,
        'meeting_id' => 'MTG-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6)),
        'status' => 'scheduled_demo',
        'calendar_link' => 'https://example.com/calendar/demo',
        'received' => $body,
    ]);
}

if ($method === 'POST' && $path === '/industry/submit') {
    $industry = trim((string) ($body['industry'] ?? 'general'));
    $service = trim((string) ($body['service'] ?? 'enquiry'));
    $payload = json_encode($body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    try {
        $stmt = $db->prepare(
            'INSERT INTO industry_submissions (industry, service, payload, created_at) VALUES (:i, :s, :p, :t)'
        );
        $stmt->execute([
            'i' => $industry,
            's' => $service,
            'p' => $payload ?: '{}',
            't' => gmdate('c'),
        ]);
        $id = (int) $db->lastInsertId();
    } catch (Throwable $e) {
        $id = 0;
    }
    $respond(200, [
        'ok' => true,
        'submission_id' => $id ?: ('SUB-' . substr(bin2hex(random_bytes(4)), 0, 8)),
        'industry' => $industry,
        'service' => $service,
        'received' => $body,
    ]);
}

$respond(404, ['ok' => false, 'error' => 'not_found', 'path' => $path]);
