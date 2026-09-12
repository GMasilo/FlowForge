<?php
declare(strict_types=1);

/**
 * FlowForge API HTTP test runner.
 *
 * Usage:
 *   # Terminal A — mock upstream
 *   php -S 127.0.0.1:8099 web/api/test/mock-upstream.php
 *
 *   # Terminal B — run scenarios
 *   php web/api/test/run.php
 *   php web/api/test/run.php --base=http://127.0.0.1:8099 --only=sign_in_http
 */

$root = dirname(__DIR__);
require_once $root . '/lib/Response.php';
require_once $root . '/lib/Security.php';
require_once $root . '/lib/HttpClient.php';
require_once __DIR__ . '/Assert.php';
require_once __DIR__ . '/signInBody.php';

$opts = getopt('', ['base::', 'only::', 'timeout::', 'help']);
if (isset($opts['help'])) {
    fwrite(STDOUT, <<<TXT
FlowForge API test runner

Options:
  --base=URL       Mock upstream base (default http://127.0.0.1:8099)
  --only=NAME      Run a single scenario file stem (e.g. sign_in_http)
  --timeout=SEC    Per-request timeout (default 5)
  --help           Show this help

Start the mock first:
  php -S 127.0.0.1:8099 web/api/test/mock-upstream.php

TXT);
    exit(0);
}

$base = rtrim((string) ($opts['base'] ?? 'http://127.0.0.1:8099'), '/');
$timeout = max(1, (int) ($opts['timeout'] ?? 5));
$only = isset($opts['only']) ? (string) $opts['only'] : null;

// Probe mock upstream
$probe = @file_get_contents($base . '/health');
if ($probe === false) {
    fwrite(STDERR, "Cannot reach mock upstream at {$base}/health\n");
    fwrite(STDERR, "Start it with:\n  php -S 127.0.0.1:8099 " . str_replace('\\', '/', __DIR__) . "/mock-upstream.php\n");
    exit(2);
}

$scenarioDir = __DIR__ . '/scenarios';
$files = glob($scenarioDir . '/*.php') ?: [];
sort($files);

if (!$files) {
    fwrite(STDERR, "No scenarios found in {$scenarioDir}\n");
    exit(2);
}

$totalPassed = 0;
$totalFailed = 0;
$ran = 0;

fwrite(STDOUT, "FlowForge API tests → {$base}\n");

foreach ($files as $file) {
    $name = basename($file, '.php');
    if ($only !== null && $only !== $name) {
        continue;
    }

    \FlowForge\Api\Test\Assert::reset();
    /** @var callable(array{base:string,timeout:int}):array{passed:int,failed:int,failures:list<string>} $scenario */
    $scenario = require $file;
    if (!is_callable($scenario)) {
        fwrite(STDERR, "Scenario {$name} must return a callable\n");
        $totalFailed++;
        continue;
    }

    $summary = $scenario(['base' => $base, 'timeout' => $timeout]);
    $ran++;
    $totalPassed += (int) ($summary['passed'] ?? 0);
    $totalFailed += (int) ($summary['failed'] ?? 0);
}

if ($ran === 0) {
    fwrite(STDERR, $only !== null ? "No scenario named \"{$only}\"\n" : "No scenarios ran\n");
    exit(2);
}

fwrite(STDOUT, "\n----------------------------\n");
fwrite(STDOUT, "Passed: {$totalPassed}\n");
fwrite(STDOUT, "Failed: {$totalFailed}\n");
fwrite(STDOUT, "Scenarios: {$ran}\n");

exit($totalFailed > 0 ? 1 : 0);
