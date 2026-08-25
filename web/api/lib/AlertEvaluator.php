<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Evaluate instance alert metrics against sessions and monthly quota usage.
 */
final class AlertEvaluator
{
    public const STALE_ACTIVE_SECONDS = 86400;

    /**
     * @param array<string, mixed> $session
     */
    public static function displayStatus(array $session, ?int $now = null): string
    {
        $status = (string) ($session['status'] ?? 'active');
        if ($status !== 'active') {
            return $status;
        }
        $now ??= time();
        $updated = (string) ($session['updated_at'] ?? $session['created_at'] ?? '');
        $ts = $updated !== '' ? strtotime($updated) : false;
        if ($ts !== false && ($now - $ts) >= self::STALE_ACTIVE_SECONDS) {
            return 'abandoned';
        }
        return 'active';
    }

    /**
     * @param list<array<string, mixed>> $sessions
     * @param array{max: float|int, used: float|int} $usage
     * @return array{value: float, unit: string, sampleSize: int}
     */
    public static function metricValue(string $metric, array $sessions, int $windowHours, array $usage, ?int $now = null): array
    {
        $now ??= time();
        $cutoff = $now - max(1, $windowHours) * 3600;
        $window = [];
        foreach ($sessions as $s) {
            $created = (string) ($s['created_at'] ?? '');
            $ts = $created !== '' ? strtotime($created) : false;
            if ($ts !== false && $ts >= $cutoff) {
                $window[] = $s;
            }
        }
        $n = count($window);
        $value = 0.0;
        $unit = '';

        if ($metric === 'abandon_rate') {
            $abandoned = 0;
            foreach ($window as $s) {
                if (self::displayStatus($s, $now) === 'abandoned') {
                    $abandoned++;
                }
            }
            $value = $n > 0 ? ($abandoned / $n) * 100.0 : 0.0;
            $unit = '%';
        } elseif ($metric === 'failed_sessions') {
            foreach ($window as $s) {
                if (($s['status'] ?? '') === 'failed') {
                    $value += 1;
                }
            }
            $unit = '';
        } elseif ($metric === 'completion_rate_below') {
            $completed = 0;
            foreach ($window as $s) {
                if (($s['status'] ?? '') === 'completed') {
                    $completed++;
                }
            }
            $value = $n > 0 ? ($completed / $n) * 100.0 : 100.0;
            $unit = '%';
        } elseif ($metric === 'quota_conversations_pct') {
            $max = (float) ($usage['max'] ?? 0);
            $used = (float) ($usage['used'] ?? 0);
            $value = $max > 0 ? ($used / $max) * 100.0 : 0.0;
            $unit = '%';
        }

        return ['value' => $value, 'unit' => $unit, 'sampleSize' => $n];
    }

    public static function isTriggered(string $metric, float $value, float $threshold): bool
    {
        if ($metric === 'completion_rate_below') {
            return $value <= $threshold;
        }
        return $value >= $threshold;
    }

    /**
     * Weekly KPI rollup for the last 7 days.
     *
     * @param list<array<string, mixed>> $sessions
     * @param array{max: float|int, used: float|int} $usage
     * @return array<string, mixed>
     */
    public static function weeklyDigestStats(array $sessions, array $usage, ?int $now = null): array
    {
        $now ??= time();
        $cutoff = $now - 7 * 86400;
        $window = [];
        foreach ($sessions as $s) {
            $created = (string) ($s['created_at'] ?? '');
            $ts = $created !== '' ? strtotime($created) : false;
            if ($ts !== false && $ts >= $cutoff) {
                $window[] = $s;
            }
        }
        $total = count($window);
        $completed = 0;
        $failed = 0;
        $abandoned = 0;
        foreach ($window as $s) {
            $status = self::displayStatus($s, $now);
            if ($status === 'completed') {
                $completed++;
            } elseif ($status === 'failed') {
                $failed++;
            } elseif ($status === 'abandoned') {
                $abandoned++;
            }
        }
        $completionPct = $total > 0 ? round(($completed / $total) * 100, 1) : 0.0;

        return [
            'sessions' => $total,
            'completed' => $completed,
            'abandoned' => $abandoned,
            'failed' => $failed,
            'completion_pct' => $completionPct,
            'quota_used' => (int) ($usage['used'] ?? 0),
            'quota_max' => (int) ($usage['max'] ?? 0),
        ];
    }
}
