<?php
declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Fetch a public URL and extract title / description meta for chat link previews.
 */
final class UrlPreview
{
    /**
     * @return array{ok: bool, url: string, title: ?string, description: ?string, site_name: ?string, icon: ?string, error?: string}
     */
    public static function fetch(string $url, int $timeoutSeconds = 12, int $maxBytes = 524_288): array
    {
        $empty = [
            'ok' => false,
            'url' => $url,
            'title' => null,
            'description' => null,
            'site_name' => null,
            'icon' => null,
        ];

        if (!function_exists('curl_init')) {
            return $empty + ['error' => 'cURL extension is required'];
        }

        $ch = curl_init($url);
        if ($ch === false) {
            return $empty + ['error' => 'Unable to initiate request'];
        }

        curl_setopt_array($ch, [
            CURLOPT_HTTPGET => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_MAXREDIRS => 0,
            CURLOPT_CONNECTTIMEOUT => min(8, $timeoutSeconds),
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTP | CURLPROTO_HTTPS,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_USERAGENT => 'FlowForge-LinkPreview/1.0 (+https://flowforge.app)',
            CURLOPT_HTTPHEADER => [
                'Accept: text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
                'Accept-Language: en-US,en;q=0.8',
            ],
        ]);

        $raw = curl_exec($ch);
        $errno = curl_errno($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $contentType = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
        curl_close($ch);

        if ($errno !== 0 || !is_string($raw) || $raw === '') {
            return $empty + ['error' => 'Could not fetch URL'];
        }

        if ($status < 200 || $status >= 400) {
            return $empty + ['error' => 'URL returned HTTP ' . $status];
        }

        $host = parse_url($url, PHP_URL_HOST);
        $fallbackIcon = self::originFavicon($url);

        if ($contentType !== '' && !preg_match('#^(text/html|application/xhtml\+xml)#i', $contentType)) {
            // Non-HTML still OK for a bare link; no meta to parse
            return [
                'ok' => true,
                'url' => $url,
                'title' => null,
                'description' => null,
                'site_name' => is_string($host) ? $host : null,
                'icon' => $fallbackIcon,
            ];
        }

        if (strlen($raw) > $maxBytes) {
            $raw = substr($raw, 0, $maxBytes);
        }

        $meta = self::parseHtmlMeta($raw, $url);

        return [
            'ok' => true,
            'url' => $url,
            'title' => $meta['title'],
            'description' => $meta['description'],
            'site_name' => $meta['site_name'] ?? (is_string($host) ? $host : null),
            'icon' => $meta['icon'] ?? $fallbackIcon,
        ];
    }

    /**
     * @return array{title: ?string, description: ?string, site_name: ?string, icon: ?string}
     */
    public static function parseHtmlMeta(string $html, string $baseUrl = ''): array
    {
        $title = self::metaProperty($html, 'og:title')
            ?? self::metaName($html, 'twitter:title')
            ?? self::documentTitle($html);

        $description = self::metaProperty($html, 'og:description')
            ?? self::metaName($html, 'twitter:description')
            ?? self::metaName($html, 'description');

        $siteName = self::metaProperty($html, 'og:site_name');
        $icon = $baseUrl !== '' ? self::findIconUrl($html, $baseUrl) : null;

        return [
            'title' => self::cleanText($title),
            'description' => self::cleanText($description),
            'site_name' => self::cleanText($siteName),
            'icon' => $icon,
        ];
    }

    private static function findIconUrl(string $html, string $baseUrl): ?string
    {
        if (!preg_match_all('#<link\b[^>]*>#is', $html, $matches)) {
            return null;
        }

        $bestHref = null;
        $bestScore = -1;

        foreach ($matches[0] as $tag) {
            if (!preg_match('#\brel=["\']([^"\']+)["\']#i', $tag, $relM)) {
                continue;
            }
            $rel = strtolower($relM[1]);
            $isApple = str_contains($rel, 'apple-touch-icon');
            $isIcon = (bool) preg_match('#\bicon\b#', $rel);
            if (!$isApple && !$isIcon) {
                continue;
            }
            if (!preg_match('#\bhref=["\']([^"\']+)["\']#i', $tag, $hrefM)) {
                continue;
            }

            $score = $isApple ? 30 : 20;
            if (preg_match('#\bsizes=["\']([^"\']+)["\']#i', $tag, $sizeM)) {
                $sizes = strtolower($sizeM[1]);
                if ($sizes === 'any') {
                    $score += 16;
                } elseif (preg_match_all('#(\d+)x(\d+)#', $sizes, $dims)) {
                    $maxDim = 0;
                    foreach ($dims[1] as $w) {
                        $maxDim = max($maxDim, (int) $w);
                    }
                    // Prefer ~32–64px favicons over tiny 16px ones
                    $score += min(24, (int) floor($maxDim / 8));
                }
            }
            if (str_contains($rel, 'shortcut')) {
                $score -= 5;
            }

            if ($score > $bestScore) {
                $bestScore = $score;
                $bestHref = $hrefM[1];
            }
        }

        if ($bestHref === null) {
            return null;
        }

        return self::absolutizeUrl($baseUrl, $bestHref);
    }

    private static function originFavicon(string $pageUrl): ?string
    {
        $parts = parse_url($pageUrl);
        if ($parts === false || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }
        $origin = strtolower((string) $parts['scheme']) . '://' . strtolower((string) $parts['host']);
        if (!empty($parts['port'])) {
            $origin .= ':' . $parts['port'];
        }
        return $origin . '/favicon.ico';
    }

    private static function absolutizeUrl(string $baseUrl, string $href): ?string
    {
        $href = trim(html_entity_decode($href, ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        if ($href === '' || str_starts_with($href, 'data:') || str_starts_with($href, 'javascript:')) {
            return null;
        }
        if (preg_match('#^https?://#i', $href)) {
            return $href;
        }
        if (str_starts_with($href, '//')) {
            $scheme = parse_url($baseUrl, PHP_URL_SCHEME) ?: 'https';
            return $scheme . ':' . $href;
        }

        $base = parse_url($baseUrl);
        if ($base === false || empty($base['scheme']) || empty($base['host'])) {
            return null;
        }
        $origin = $base['scheme'] . '://' . $base['host'] . (isset($base['port']) ? ':' . $base['port'] : '');
        if (str_starts_with($href, '/')) {
            return $origin . $href;
        }

        $path = $base['path'] ?? '/';
        $dir = preg_replace('#/[^/]*$#', '/', $path) ?: '/';
        return $origin . $dir . $href;
    }

    private static function documentTitle(string $html): ?string
    {
        if (preg_match('#<title[^>]*>(.*?)</title>#is', $html, $m)) {
            return html_entity_decode(strip_tags($m[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        }
        return null;
    }

    private static function metaProperty(string $html, string $property): ?string
    {
        $quoted = preg_quote($property, '#');
        $patterns = [
            '#<meta[^>]+property=["\']' . $quoted . '["\'][^>]+content=["\'](.*?)["\'][^>]*/?>#is',
            '#<meta[^>]+content=["\'](.*?)["\'][^>]+property=["\']' . $quoted . '["\'][^>]*/?>#is',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }
        return null;
    }

    private static function metaName(string $html, string $name): ?string
    {
        $quoted = preg_quote($name, '#');
        $patterns = [
            '#<meta[^>]+name=["\']' . $quoted . '["\'][^>]+content=["\'](.*?)["\'][^>]*/?>#is',
            '#<meta[^>]+content=["\'](.*?)["\'][^>]+name=["\']' . $quoted . '["\'][^>]*/?>#is',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $html, $m)) {
                return html_entity_decode($m[1], ENT_QUOTES | ENT_HTML5, 'UTF-8');
            }
        }
        return null;
    }

    private static function cleanText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
        if ($value === '') {
            return null;
        }
        if (function_exists('mb_strlen') && mb_strlen($value) > 320) {
            return mb_substr($value, 0, 317) . '…';
        }
        if (strlen($value) > 320) {
            return substr($value, 0, 317) . '…';
        }
        return $value;
    }
}
