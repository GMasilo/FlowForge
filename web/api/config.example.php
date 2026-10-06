<?php

/**
 * FlowForge API — copy to config.php and fill in production values.
 * NEVER commit config.php with real secrets.
 */

declare(strict_types=1);

return [
    'supabase_url' => 'https://rongygfkvezsgerljqno.supabase.co',
    'supabase_anon_key' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbmd5Z2ZrdmV6c2dlcmxqcW5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4NTE5NzgsImV4cCI6MjEwMTQyNzk3OH0.fSGlYI2_iQbLMF_U_O0fnVJs5-DrTRIknTlC5jar4xo',
    'supabase_service_role_key' => 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvbmd5Z2ZrdmV6c2dlcmxqcW5vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTg1MTk3OCwiZXhwIjoyMTAxNDI3OTc4fQ.0Y45CY1J65kH_9rGH4YTDL4DTZBA7BjUfhtjO523yk0',
    'supabase_jwt_secret' => 'ZWxudHenQU6MQIH4x+gxtVKRjaYSfnDnW/g/oFu2S+5wgS0RRcR+PeQ8gC1s6i2MbC8MA3LOwBxGD67CtpXrVQ==',

    'allowed_origins' => [
        'https://gkjtt.co.za',
        'https://www.gkjtt.co.za',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
    ],

    'force_https' => true,
    'http_max_response_bytes' => 1_048_576,
    'http_timeout_seconds' => 30,
    'rate_limit_max' => 60,
    'rate_limit_window_seconds' => 60,
    'storage_path' => __DIR__ . '/storage',
    'files_path' => __DIR__ . '/files',
    'files_max_bytes' => 10_485_760,
    'http_host_allowlist' => [],
    'sqlite_path_allowlist' => [],

    'public_api_url' => 'https://gkjtt.co.za/flowforge/api',

    // Microsoft Entra ID — platform OAuth for Connect Microsoft (Graph: Outlook, OneDrive, …).
    // Redirect URI must be: {public_api_url}/oauth/microsoft/callback
    // Delegated permissions: openid, profile, offline_access, User.Read, Mail.Send, Files.ReadWrite, …
    'microsoft_oauth' => [
        // 'client_id' => '',
        // 'client_secret' => '',
        // 'tenant' => 'common',
        // 'redirect_uri' => 'https://gkjtt.co.za/flowforge/api/oauth/microsoft/callback',
        // 'scopes' => ['openid','profile','offline_access','User.Read','Mail.Send','Files.ReadWrite'],
        // 'state_secret' => '',
    ],

    'intent_service_url' => 'http://127.0.0.1:8091',

    'alerts_cron_secret' => 'aubibcnueoeirejf9c8a340etyujgwmvrwi0jgv940grv8hneiv430v3miorepvm',
    'entity_jobs_cron_secret' => '',
    'entity_job_s3_destinations' => [],
    'retention_cron_secret' => 'aubibcnueoeirejf9c8a340etyujgwmvrwi0jgv940grv8hneiv430v3miorepvm',

    'app_url' => 'https://gkjtt.co.za/flowforge',
    'platform_smtp' => [],
];
