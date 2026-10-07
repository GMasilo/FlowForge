<?php
declare(strict_types=1);
namespace FlowForge\Api;

final class EntityJobDestination
{
    public static function apiUrl(array $connection, string $path): string
    {
        $base = rtrim(trim((string) ($connection['baseUrl'] ?? '')), '/');
        $parts = parse_url($base);
        if (!$parts || ($parts['scheme'] ?? '') !== 'https' || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['query']) || isset($parts['fragment'])) {
            throw new \RuntimeException('Use an HTTPS connection base URL without credentials, query or fragment');
        }
        if (preg_match('#^[a-z][a-z0-9+.-]*:|^//|\\\\|[\x00-\x20\x7f]|\.\.|%#i', $path)) {
            throw new \RuntimeException('Use a relative API path without traversal, escapes or spaces');
        }
        return $base . ($path === '' ? '' : '/' . ltrim($path, '/'));
    }

    public static function database(array $connection, string $table, array $data, array $options): int
    {
        $provider = (string) ($connection['provider'] ?? 'postgres');
        if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?$/D', $table)) throw new \RuntimeException('Invalid destination table');
        if (count($data['rows']) > 1000) throw new \RuntimeException('Database exports support up to 1000 records; use an API for larger batches');
        $quote = static fn (string $name): string => $provider === 'mysql' ? '`' . $name . '`' : ($provider === 'mssql' ? '[' . $name . ']' : '"' . $name . '"');
        $columns = []; $placeholders = [];
        foreach ($data['columns'] as $i => $column) {
            if (!preg_match('/^[A-Za-z_][A-Za-z0-9_]*$/D', $column)) throw new \RuntimeException('Database column keys must be simple identifiers');
            $columns[] = $quote($column); $placeholders[] = ':v' . $i;
        }
        if (!$columns) throw new \RuntimeException('Select columns to export');
        $batch = [];
        foreach ($data['rows'] as $row) {
            $params = [];
            foreach ($data['columns'] as $i => $column) $params['v' . $i] = $row[$column] ?? null;
            $batch[] = $params;
        }
        if (!$batch) return 0;
        $sql = 'INSERT INTO ' . implode('.', array_map($quote, explode('.', $table))) . ' (' . implode(',', $columns) . ') VALUES (' . implode(',', $placeholders) . ')';
        $result = DatabaseClient::run($connection, $sql, [], 'execute', $options, $batch);
        if (!$result['ok']) throw new \RuntimeException('Database export failed; check driver, connectivity, table, column types, constraints and write permissions');
        return count($batch);
    }
}
