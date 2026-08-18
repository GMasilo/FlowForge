<?php

/**
 * FlowForge API — copy to config.php and fill in production values.
 * NEVER commit config.php with real secrets.
 */

declare(strict_types=1);

return [
    // Required for modern Supabase (ES256 user tokens).
    // Project Settings → API → Project URL
    'supabase_url' => 'https://YOUR_PROJECT.supabase.co',

    // Project Settings → API → anon public key (used by /email/invite to call RPCs as the user)
    'supabase_anon_key' => 'REPLACE_WITH_SUPABASE_ANON_KEY',

    // Project Settings → API → service_role key (server-only; never expose to the browser)
    // Used for public-chat connection resolve, webhook listing, and conversation file uploads.
    'supabase_service_role_key' => 'REPLACE_WITH_SUPABASE_SERVICE_ROLE_KEY',

    // Optional legacy HS256 only. This is NOT the anon or service_role key.
    // Project Settings → API → JWT Settings → JWT Secret (often under "Legacy")
    // Leave as placeholder if your project uses ECC/ES256 signing (most new projects).
    'supabase_jwt_secret' => 'REPLACE_WITH_SUPABASE_JWT_SECRET',

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
    'public_api_url' => '',

    /*
     * Invite email SMTP is NOT stored here — use Apache SetEnv:
     *   SetEnv DEFAULT_SYSTEM_SMTP_SERVER smtp.example.com
     *   SetEnv DEFAULT_SYSTEM_SMTP_PORT 465
     *   SetEnv DEFAULT_SYSTEM_SMTP_USERNAME noreply@example.com
     *   SetEnv DEFAULT_SYSTEM_SMTP_PASSWORD ...
     *   SetEnv DEFAULT_SYSTEM_SMTP_NAME FlowForge
     *   SetEnv DEFAULT_SYSTEM_SMTP_SECURE ssl
     *   SetEnv DEFAULT_SYSTEM_APP_URL https://gkjtt.co.za/flowforge
     *
     * SECURE values: ssl (port 465), tls/starttls (port 587), none
     */
];
