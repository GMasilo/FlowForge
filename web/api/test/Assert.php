<?php
declare(strict_types=1);

namespace FlowForge\Api\Test;

/**
 * Tiny assertion helpers for CLI scenario scripts (no PHPUnit dependency).
 */
final class Assert
{
    private static int $passed = 0;
    private static int $failed = 0;

    /** @var list<string> */
    private static array $failures = [];

    public static function reset(): void
    {
        self::$passed = 0;
        self::$failed = 0;
        self::$failures = [];
    }

    public static function true(bool $condition, string $message): void
    {
        if ($condition) {
            self::$passed++;
            fwrite(STDOUT, "  ✓ {$message}\n");
            return;
        }
        self::$failed++;
        self::$failures[] = $message;
        fwrite(STDOUT, "  ✗ {$message}\n");
    }

    public static function same(mixed $expected, mixed $actual, string $message): void
    {
        self::true($expected === $actual, $message . ' (expected ' . self::export($expected) . ', got ' . self::export($actual) . ')');
    }

    public static function notEmpty(mixed $value, string $message): void
    {
        self::true($value !== null && $value !== '' && $value !== [], $message);
    }

    /** @return array{passed:int,failed:int,failures:list<string>} */
    public static function summary(): array
    {
        return [
            'passed' => self::$passed,
            'failed' => self::$failed,
            'failures' => self::$failures,
        ];
    }

    private static function export(mixed $value): string
    {
        if (is_string($value)) {
            return json_encode($value, JSON_UNESCAPED_UNICODE) ?: '""';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if ($value === null) {
            return 'null';
        }
        if (is_scalar($value)) {
            return (string) $value;
        }
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[unserializable]';
    }
}
