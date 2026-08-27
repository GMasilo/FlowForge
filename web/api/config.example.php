<?php

/**
 * FlowForge API — copy to config.php and fill in production values.
 * NEVER commit config.php with real secrets.
 */

declare(strict_types=1);

return [
    // Required for modern Supabase (ES256 user tokens).
    // Project Settings → API → Project URL
    'supabase_url' => 'https://rongygfkvezsgerljqno.supabase.co',

    // Project Settings → API → anon public key (used by /email/invite to call RPCs as the user)
    'supabase_anon_key' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbmd5Z2ZrdmV6c2dlcmxqcW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTE5NzgsImV4cCI6MjEwMTQyNzk3OH0.fSGlYI2_iQbLMF_U_O0fnVJs5-DrTRIknTlC5jar4xo',

    // Project Settings → API → service_role key (server-only; never expose to the browser)
    // Used for public-chat connection resolve, webhook listing, and conversation file uploads.
    'supabase_service_role_key' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbmd5Z2ZrdmV6c2dlcmxqcW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTg1MTk3OCwiZXhwIjoyMTAxNDI3OTc4fQ.0Y45CY1J65kH_9rGH4YTDL4DTZBA7BjUfhtjO523yk0',

    // Optional legacy HS256 only. This is NOT the anon or service_role key.
    // Project Settings → API → JWT Settings → JWT Secret (often under "Legacy")
    // Leave as placeholder if your project uses ECC/ES256 signing (most new projects).
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

    // Instance uploads: files/{instanceId}/{chatbotId}/media|conversations
    'files_path' => __DIR__ . '/files',
    'files_max_bytes' => 10_485_760,

    // Optional: restrict outbound HTTP to these host suffixes (empty = any public host)
    // Example: ['api.example.com', 'hooks.zapier.com']
    'http_host_allowlist' => [],

    // Optional absolute URL of this API, used as PayFast notify_url.
    // Example: 'https://gkjtt.co.za/flowforge/api'
    'public_api_url' => 'https://gkjtt.co.za/flowforge/api',

    // Secret for POST /alerts/run (cron). Use a long random string.
    // curl -X POST -H "Authorization: Bearer …" https://…/flowforge/api/alerts/run
    'alerts_cron_secret' => 'aubibcnueoeirejf9c8a340etyujgwmvrwi0jgv940grv8hneiv430v3miorepvm',

    /*
     * Invite email SMTP — prefer Apache SetEnv DEFAULT_SYSTEM_*:
     *   SetEnv DEFAULT_SYSTEM_SMTP_SERVER smtp.example.com
     *   SetEnv DEFAULT_SYSTEM_SMTP_PORT 465
     *   SetEnv DEFAULT_SYSTEM_SMTP_USERNAME noreply@example.com
     *   SetEnv DEFAULT_SYSTEM_SMTP_PASSWORD ...
     *   SetEnv DEFAULT_SYSTEM_SMTP_NAME FlowForge
     *   SetEnv DEFAULT_SYSTEM_SMTP_SECURE ssl
     *   SetEnv DEFAULT_SYSTEM_APP_URL https://gkjtt.co.za/flowforge
     *
     * SECURE values: ssl (port 465), tls/starttls (port 587), none
     *
     * Optional fallbacks when SetEnv is unavailable:
     */
    'app_url' => 'https://gkjtt.co.za/flowforge',
    'platform_smtp' => [
        // 'smtpHost' => 'smtp.example.com',
        // 'smtpPort' => 465,
        // 'username' => 'noreply@example.com',
        // 'password' => '...',
        // 'fromEmail' => 'noreply@example.com',
        // 'fromName' => 'FlowForge',
        // 'encryption' => 'ssl',
    ],
];
