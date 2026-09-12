<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * External database access via PDO (PostgreSQL / MySQL / MSSQL / SQLite).
 */
final class DatabaseClient
{
    private const MAX_ROWS = 1000;

    /**
     * @param array<string, mixed> $connectionConfig
     * @param array<string, mixed> $params
     * @param array{sqlite_path_allowlist?: list<string>} $options
     * @return array{ok: bool, rows?: list<array<string, mixed>>, rowCount?: int, error?: string}
     */
    public static function run(
        array $connectionConfig,
        string $sql,
        array $params,
        string $operation,
        array $options = []
    ): array {
        $provider = strtolower(trim((string) ($connectionConfig['provider'] ?? 'postgres')));
        if (!in_array($provider, ['postgres', 'mysql', 'mssql', 'sqlite'], true)) {
            return ['ok' => false, 'error' => 'Unsupported database provider'];
        }

        $host = trim((string) ($connectionConfig['host'] ?? ''));
        $defaultPort = $provider === 'mysql' ? 3306 : ($provider === 'mssql' ? 1433 : 5432);
        $port = (int) ($connectionConfig['port'] ?? $defaultPort);
        $database = trim((string) ($connectionConfig['database'] ?? ''));
        $username = (string) ($connectionConfig['username'] ?? '');
        $password = (string) ($connectionConfig['password'] ?? '');
        $sslMode = strtolower(trim((string) ($connectionConfig['sslMode'] ?? 'require')));
        if (!in_array($sslMode, ['disable', 'require'], true)) {
            $sslMode = 'require';
        }
        $timeoutMs = (int) ($connectionConfig['timeoutMs'] ?? 15000);
        if ($timeoutMs < 1000) {
            $timeoutMs = 1000;
        }
        if ($timeoutMs > 120000) {
            $timeoutMs = 120000;
        }
        $timeoutSec = max(1, (int) ceil($timeoutMs / 1000));

        if ($provider === 'sqlite') {
            if ($database === '') {
                return ['ok' => false, 'error' => 'SQLite database file path is required'];
            }
            $pathCheck = self::assertSqlitePathAllowed($database, $options['sqlite_path_allowlist'] ?? []);
            if ($pathCheck !== null) {
                return ['ok' => false, 'error' => $pathCheck];
            }
        } elseif ($host === '' || $database === '') {
            return ['ok' => false, 'error' => 'Database host and database name are required'];
        }

        $sql = trim($sql);
        $sqlCheck = self::validateSql($sql);
        if ($sqlCheck !== null) {
            return ['ok' => false, 'error' => $sqlCheck];
        }

        $operation = strtolower(trim($operation));
        if (!in_array($operation, ['query', 'execute'], true)) {
            $operation = 'query';
        }

        $driver = self::resolveDriver($provider);
        if ($driver === null) {
            return ['ok' => false, 'error' => self::missingDriverMessage($provider)];
        }

        try {
            $dsn = self::buildDsn($provider, $driver, $host, $port, $database, $sslMode, $timeoutSec);
            $pdoOptions = [
                \PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION,
                \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC,
                // Named :params are more reliable with emulation on MySQL / SQL Server.
                \PDO::ATTR_EMULATE_PREPARES => $provider === 'mysql' || $provider === 'mssql',
                \PDO::ATTR_TIMEOUT => $timeoutSec,
            ];

            $pdo = $provider === 'sqlite'
                ? new \PDO($dsn, null, null, $pdoOptions)
                : new \PDO($dsn, $username, $password, $pdoOptions);

            try {
                if ($provider === 'mysql') {
                    $pdo->exec('SET SESSION max_execution_time = ' . $timeoutMs);
                } elseif ($provider === 'postgres') {
                    $pdo->exec('SET statement_timeout TO ' . $timeoutMs);
                }
            } catch (\Throwable) {
                // Optional timeout settings; ignore if the server rejects them.
            }

            $bound = self::normalizeParams($params);
            $stmt = $pdo->prepare($sql);
            foreach ($bound as $name => $value) {
                $stmt->bindValue(':' . $name, $value);
            }
            $stmt->execute();

            if ($operation === 'execute') {
                return [
                    'ok' => true,
                    'rowCount' => $stmt->rowCount(),
                    'rows' => [],
                ];
            }

            $rows = [];
            $count = 0;
            while (($row = $stmt->fetch()) !== false) {
                if ($count >= self::MAX_ROWS) {
                    break;
                }
                $rows[] = self::normalizeRow(is_array($row) ? $row : []);
                $count++;
            }

            return [
                'ok' => true,
                'rows' => $rows,
                'rowCount' => count($rows),
            ];
        } catch (\Throwable $e) {
            return ['ok' => false, 'error' => self::safeErrorMessage($e->getMessage())];
        }
    }

    /**
     * @param list<string> $allowlist
     */
    private static function assertSqlitePathAllowed(string $path, array $allowlist): ?string
    {
        if ($path === '' || str_contains($path, "\0")) {
            return 'Invalid SQLite path';
        }
        if (!str_starts_with($path, '/')) {
            return 'SQLite path must be absolute';
        }
        if (preg_match('#(^|/)\.\.(/|$)#', $path)) {
            return 'SQLite path must not contain ..';
        }
        $real = realpath($path);
        if ($real === false) {
            // Allow creating new files only if the parent directory exists and is allowlisted.
            $parent = realpath(dirname($path));
            if ($parent === false) {
                return 'SQLite path parent directory not found';
            }
            $real = $parent . DIRECTORY_SEPARATOR . basename($path);
        }
        $real = str_replace('\\', '/', $real);

        $prefixes = [];
        foreach ($allowlist as $entry) {
            $entry = trim((string) $entry);
            if ($entry === '') {
                continue;
            }
            $resolved = realpath($entry);
            $prefixes[] = str_replace('\\', '/', $resolved !== false ? $resolved : rtrim($entry, '/'));
        }
        if (!$prefixes) {
            return 'SQLite connections are disabled (no sqlite_path_allowlist in API config)';
        }
        foreach ($prefixes as $prefix) {
            if ($real === $prefix || str_starts_with($real, rtrim($prefix, '/') . '/')) {
                return null;
            }
        }
        return 'SQLite path is outside the allowed directories';
    }

    private static function resolveDriver(string $provider): ?string
    {
        $available = \PDO::getAvailableDrivers();
        if ($provider === 'sqlite') {
            return in_array('sqlite', $available, true) || extension_loaded('pdo_sqlite') ? 'sqlite' : null;
        }
        if ($provider === 'mysql') {
            return in_array('mysql', $available, true) || extension_loaded('pdo_mysql') ? 'mysql' : null;
        }
        if ($provider === 'postgres') {
            return in_array('pgsql', $available, true) || extension_loaded('pdo_pgsql') ? 'pgsql' : null;
        }
        if (in_array('sqlsrv', $available, true) || extension_loaded('pdo_sqlsrv')) {
            return 'sqlsrv';
        }
        if (in_array('dblib', $available, true) || extension_loaded('pdo_dblib')) {
            return 'dblib';
        }
        return null;
    }

    private static function missingDriverMessage(string $provider): string
    {
        if ($provider === 'sqlite') {
            return 'PHP pdo_sqlite extension is not available on this server';
        }
        if ($provider === 'mysql') {
            return 'PHP pdo_mysql extension is not available on this server';
        }
        if ($provider === 'postgres') {
            return 'PHP pdo_pgsql extension is not available on this server';
        }
        return 'PHP pdo_sqlsrv (or pdo_dblib) extension is not available on this server';
    }

    private static function buildDsn(
        string $provider,
        string $driver,
        string $host,
        int $port,
        string $database,
        string $sslMode,
        int $timeoutSec
    ): string {
        if ($provider === 'sqlite') {
            return 'sqlite:' . $database;
        }

        if ($provider === 'mysql') {
            return sprintf(
                'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
                $host,
                $port,
                $database
            );
        }

        if ($provider === 'mssql') {
            if ($driver === 'dblib') {
                return sprintf('dblib:host=%s:%d;dbname=%s', $host, $port, $database);
            }
            $encrypt = $sslMode === 'require' ? 'yes' : 'no';
            $trust = $sslMode === 'require' ? 'yes' : 'no';
            return sprintf(
                'sqlsrv:Server=%s,%d;Database=%s;Encrypt=%s;TrustServerCertificate=%s;LoginTimeout=%d',
                $host,
                $port,
                $database,
                $encrypt,
                $trust,
                $timeoutSec
            );
        }

        $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s', $host, $port, $database);
        if ($sslMode === 'require') {
            $dsn .= ';sslmode=require';
        } else {
            $dsn .= ';sslmode=disable';
        }
        return $dsn;
    }

    private static function validateSql(string $sql): ?string
    {
        if ($sql === '') {
            return 'SQL is required';
        }
        if (strlen($sql) > 20000) {
            return 'SQL is too long';
        }
        $stripped = rtrim($sql);
        if (str_ends_with($stripped, ';')) {
            $stripped = rtrim(substr($stripped, 0, -1));
        }
        if (str_contains($stripped, ';')) {
            return 'Multiple SQL statements are not allowed';
        }
        if (preg_match('/--|\/\*|\*\//', $sql)) {
            return 'SQL comments are not allowed';
        }
        return null;
    }

    /**
     * @param array<string, mixed> $params
     * @return array<string, mixed>
     */
    private static function normalizeParams(array $params): array
    {
        $out = [];
        foreach ($params as $key => $value) {
            $name = ltrim(trim((string) $key), ':');
            if ($name === '' || !preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/', $name)) {
                continue;
            }
            if (is_array($value) || is_object($value)) {
                $out[$name] = json_encode($value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            } elseif (is_bool($value)) {
                $out[$name] = $value ? 1 : 0;
            } elseif ($value === null) {
                $out[$name] = null;
            } else {
                $out[$name] = $value;
            }
        }
        return $out;
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private static function normalizeRow(array $row): array
    {
        $out = [];
        foreach ($row as $key => $value) {
            if (is_resource($value)) {
                $out[(string) $key] = stream_get_contents($value);
            } else {
                $out[(string) $key] = $value;
            }
        }
        return $out;
    }

    private static function safeErrorMessage(string $message): string
    {
        $trimmed = trim($message);
        if ($trimmed === '') {
            return 'Database query failed';
        }
        $trimmed = preg_replace('/password=[^\s;]+/i', 'password=***', $trimmed) ?? $trimmed;
        return substr($trimmed, 0, 500);
    }
}
