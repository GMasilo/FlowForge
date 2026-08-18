<?php

/**
 * FlowForge API — production config.
 * NEVER commit this file with real secrets.
 *
 * Invite emails also need Apache SetEnv (not stored here):
 *   SetEnv FLOWFORGE_SMTP_HOST smtp.example.com
 *   SetEnv FLOWFORGE_SMTP_PORT 587
 *   SetEnv FLOWFORGE_SMTP_USER ...
 *   SetEnv FLOWFORGE_SMTP_PASSWORD ...
 *   SetEnv FLOWFORGE_SMTP_FROM_EMAIL noreply@example.com
 *   SetEnv FLOWFORGE_SMTP_FROM_NAME FlowForge
 *   SetEnv FLOWFORGE_SMTP_ENCRYPTION starttls
 *   SetEnv FLOWFORGE_APP_URL https://gkjtt.co.za/flowforge
 */

declare(strict_types=1);

return [
    // Project Settings → API → Project URL
    'supabase_url' => 'https://rongygfkvezsgerljqno.supabase.co',

    // Project Settings → API → anon public key (required for /email/invite)
    'supabase_anon_key' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbmd5Z2ZrdmV6c2dlcmxqcW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTE5NzgsImV4cCI6MjEwMTQyNzk3OH0.fSGlYI2_iQbLMF_U_O0fnVJs5-DrTRIknTlC5jar4xo',

    // Optional legacy HS256 only. This is NOT the anon or service_role key.
    // Project Settings → API → JWT Settings → JWT Secret (Legacy).
    // Leave unused if your project uses ECC/ES256 signing (most new projects).
    'supabase_jwt_secret' => 'ZWxudHenQU6MQIH4x+gxtVKRjaYSfnDnW/g/oFu2S+5wgS0RRcR+PeQ8gC1s6i2MbC8MA3LOwBxGD67CtpXrVQ==',

    // Allowed browser origins (CORS). Include both prod and local if needed.
    'allowed_origins' => [
        'https://gkjtt.co.za',
        'https://www.gkjtt.co.za',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],

    // Require HTTPS for the API itself in production
    'force_https' => true,

    // Max outbound HTTP response body size (bytes)
    'http_max_response_bytes' => 1_048_576,

    // Outbound HTTP timeout (seconds)
    'http_timeout_seconds' => 30,

    // Rate limit: max requests per window per user
    'rate_limit_max' => 60,
    'rate_limit_window_seconds' => 60,

    // Directory for rate-limit files (must be writable, outside public ideally)
    'storage_path' => __DIR__ . '/storage',

    // Optional: restrict outbound HTTP to these host suffixes (empty = any public host)
    'http_host_allowlist' => [],
];
