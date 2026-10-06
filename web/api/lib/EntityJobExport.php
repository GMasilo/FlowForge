<?php
declare(strict_types=1);
namespace FlowForge\Api;

/** CSV generation and AWS SigV4 for the server-owned, instance-scoped destinations. */
final class EntityJobExport
{
    public static function csv(array $columns, array $rows): string
    {
        if (!$columns || count($rows) > 10000) throw new \RuntimeException('Export exceeds the row limit or has no columns');
        $stream = fopen('php://temp', 'w+');
        $cell = static function ($value): string {
            $text = is_array($value) || is_object($value) ? json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR) : (is_bool($value) ? ($value ? 'true' : 'false') : (string) ($value ?? ''));
            // CSV quoting does not prevent spreadsheet formula execution.
            return preg_match('/^[\x00-\x20]*[=+@-]/u', $text) ? "'" . $text : $text;
        };
        fputcsv($stream, array_map($cell, $columns), ',', '"', '');
        foreach ($rows as $row) {
            fputcsv($stream, array_map(static function ($key) use ($row, $cell) { return $cell($row[$key] ?? null); }, $columns), ',', '"', '');
            if (ftell($stream) > 20000000) { fclose($stream); throw new \RuntimeException('CSV exceeds the 20 MB export limit'); }
        }
        rewind($stream); $csv = stream_get_contents($stream); fclose($stream);
        return $csv;
    }

    public static function signedRequest(array $destination, string $key, string $body, string $timestamp): array
    {
        $bucket = (string) ($destination['bucket'] ?? ''); $region = (string) ($destination['region'] ?? '');
        // AWS commercial-region hostnames only. No caller-controlled URL or redirect.
        if (!preg_match('/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/D', $bucket) || !preg_match('/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/D', $region)) throw new \RuntimeException('Invalid S3 bucket or region configuration');
        $access = (string) ($destination['access_key_id'] ?? ''); $secret = (string) ($destination['secret_access_key'] ?? '');
        if ($access === '' || $secret === '' || preg_match('/[\r\n]/', $access . $secret)) throw new \RuntimeException('S3 credentials are not configured');
        $host = $bucket . '.s3.' . $region . '.amazonaws.com';
        $path = '/' . implode('/', array_map('rawurlencode', explode('/', $key)));
        $headers = ['content-type' => 'text/csv; charset=utf-8', 'host' => $host, 'x-amz-content-sha256' => hash('sha256', $body), 'x-amz-date' => $timestamp];
        $token = (string) ($destination['session_token'] ?? '');
        if (preg_match('/[\r\n]/', $token)) throw new \RuntimeException('Invalid S3 session token');
        if ($token !== '') $headers['x-amz-security-token'] = $token;
        ksort($headers); $canonical = '';
        foreach ($headers as $name => $value) $canonical .= $name . ':' . trim($value) . "\n";
        $signed = implode(';', array_keys($headers)); $date = substr($timestamp, 0, 8);
        $scope = $date . '/' . $region . '/s3/aws4_request';
        $request = "PUT\n" . $path . "\n\n" . $canonical . "\n" . $signed . "\n" . hash('sha256', $body);
        $signing = hash_hmac('sha256', $date, 'AWS4' . $secret, true);
        foreach ([$region, 's3', 'aws4_request'] as $part) $signing = hash_hmac('sha256', $part, $signing, true);
        $signature = hash_hmac('sha256', "AWS4-HMAC-SHA256\n" . $timestamp . "\n" . $scope . "\n" . hash('sha256', $request), $signing);
        $headers['authorization'] = 'AWS4-HMAC-SHA256 Credential=' . $access . '/' . $scope . ', SignedHeaders=' . $signed . ', Signature=' . $signature;
        return ['url' => 'https://' . $host . $path, 'headers' => $headers];
    }

    public static function upload(array $destination, string $key, string $csv): void
    {
        $request = self::signedRequest($destination, $key, $csv, gmdate('Ymd\THis\Z'));
        $headers = [];
        foreach ($request['headers'] as $name => $value) $headers[] = $name . ': ' . $value;
        $curl = curl_init($request['url']);
        curl_setopt_array($curl, [CURLOPT_CUSTOMREQUEST => 'PUT', CURLOPT_POSTFIELDS => $csv, CURLOPT_HTTPHEADER => $headers,
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 90,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
        $response = curl_exec($curl); $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE); $errno = curl_errno($curl); curl_close($curl);
        if ($response === false) throw new \RuntimeException('S3 network/TLS request failed (code ' . $errno . ')');
        if ($status < 200 || $status >= 300) {
            $code = preg_match('/<Code>([A-Za-z0-9]+)<\/Code>/', $response, $m) ? $m[1] : 'Unknown';
            throw new \RuntimeException('S3 returned HTTP ' . $status . ' (' . $code . ')');
        }
    }
}
