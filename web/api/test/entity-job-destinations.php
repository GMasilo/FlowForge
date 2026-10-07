<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/DatabaseClient.php';
require_once __DIR__ . '/../lib/EntityJobDestination.php';
use FlowForge\Api\EntityJobDestination;

function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
foreach (['https://attacker.test/x', '//attacker.test', '../secret', '/%2e%2e/secret', '/x\\y'] as $path) {
    try { EntityJobDestination::apiUrl(['baseUrl' => 'https://example.test/api'], $path); throw new LogicException('Unsafe path accepted'); }
    catch (RuntimeException $e) { check(!($e instanceof LogicException), 'Unsafe path accepted'); }
}
check(EntityJobDestination::apiUrl(['baseUrl'=>'https://example.test/api/'], '/imports') === 'https://example.test/api/imports', 'Base path must be preserved');
$file = tempnam(sys_get_temp_dir(), 'ff-job-');
try {
    $pdo = new PDO('sqlite:' . $file);
    $pdo->exec('CREATE TABLE contacts (name TEXT UNIQUE, age INTEGER)');
    $connection = ['provider' => 'sqlite', 'database' => str_replace('\\', '/', $file)];
    $options = ['sqlite_path_allowlist' => [dirname($file)]];
    $data = ['columns' => ['name','age'], 'rows' => [['name'=>"O'Brien", 'age'=>21], ['name'=>'Alice','age'=>null]]];
    check(EntityJobDestination::database($connection, 'contacts', $data, $options) === 2, 'Insert count');
    check($pdo->query('SELECT count(*) FROM contacts')->fetchColumn() == 2, 'Inserted rows');
    check($pdo->query('SELECT age FROM contacts WHERE name = \'Alice\'')->fetchColumn() === null, 'Preserve null');
    try {
        EntityJobDestination::database($connection, 'contacts', ['columns'=>['name'], 'rows'=>[['name'=>'Bob'],['name'=>'Alice']]], $options);
        throw new LogicException('Expected duplicate failure');
    } catch (RuntimeException $e) { check(!($e instanceof LogicException), 'Failure missing'); }
    check($pdo->query('SELECT count(*) FROM contacts')->fetchColumn() == 2, 'Entire failed batch must roll back');
    check(EntityJobDestination::database($connection, 'contacts', ['columns'=>['name'],'rows'=>[]], $options) === 0, 'Empty export');
    echo "Entity destination checks passed: URL confinement, parameterised inserts, nulls and rollback.\n";
} finally {
    $pdo = null;
    if (is_file($file)) unlink($file);
}
