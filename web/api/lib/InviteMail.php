<?php

declare(strict_types=1);

namespace FlowForge\Api;

/**
 * Organisation invite emails via platform SMTP and/or Supabase Auth invite.
 */
final class InviteMail
{
    /**
     * @param array<string, mixed> $config
     * @return array{ok: bool, error?: string, message_id?: string|null, via?: string}
     */
    public static function sendSignupInvite(
        array $config,
        string $jwt,
        string $inviteId,
        string $email,
        string $token,
        string $orgName,
        string $displayName = '',
    ): array {
        $appUrl = PlatformMail::appUrl($config);
        if ($appUrl === '') {
            return ['ok' => false, 'error' => 'App URL is not configured (DEFAULT_SYSTEM_APP_URL or config app_url)'];
        }

        $smtp = PlatformMail::smtpConfig($config);
        if (trim((string) ($smtp['smtpHost'] ?? '')) === '' || trim((string) ($smtp['fromEmail'] ?? '')) === '') {
            return ['ok' => false, 'error' => 'SMTP is not configured (DEFAULT_SYSTEM_* env or config platform_smtp)'];
        }

        $greeting = trim($displayName) !== '' ? trim($displayName) : 'there';
        $signupUrl = $appUrl . '/signup?invite=' . rawurlencode($token);
        $subject = 'You are invited to ' . $orgName . ' on FlowForge';
        $message = implode("\n", [
            'Hi ' . $greeting . ',',
            '',
            'You have been invited to join "' . $orgName . '" on FlowForge.',
            '',
            'Create your account using this link (opens the sign-up page with your email filled in):',
            $signupUrl,
            '',
            'If you were not expecting this email, you can ignore it.',
            '',
            '— FlowForge',
        ]);

        $result = Mailer::send($smtp, $email, $subject, $message);
        if (!$result['ok']) {
            $err = (string) ($result['error'] ?? 'Failed to send invite email');
            SupabaseRest::rpcAsUser($config, $jwt, 'mark_invite_email_status', [
                'p_invite_id' => $inviteId,
                'p_ok' => false,
                'p_error' => $err,
            ]);
            return ['ok' => false, 'error' => $err, 'via' => 'smtp'];
        }

        SupabaseRest::rpcAsUser($config, $jwt, 'mark_invite_email_status', [
            'p_invite_id' => $inviteId,
            'p_ok' => true,
            'p_error' => null,
        ]);

        return [
            'ok' => true,
            'message_id' => $result['message_id'] ?? null,
            'via' => 'smtp',
        ];
    }

    /**
     * Invite via Supabase Auth (uses project email settings). Creates auth user;
     * handle_new_user claims matching organisation invites.
     *
     * @param array<string, mixed> $config
     * @param array<string, mixed> $userMetadata
     * @return array{ok: bool, error?: string, user_id?: string|null, via?: string}
     */
    public static function sendAuthInvite(
        array $config,
        string $email,
        string $redirectTo,
        array $userMetadata = [],
    ): array {
        $result = SupabaseRest::authInviteUserByEmail($config, $email, $redirectTo, $userMetadata);
        if (!$result['ok']) {
            return [
                'ok' => false,
                'error' => $result['error'] ?? 'Supabase Auth invite failed',
                'via' => 'supabase',
            ];
        }

        $userId = null;
        if (is_array($result['data'] ?? null)) {
            $user = $result['data']['id'] ?? ($result['data']['user']['id'] ?? null);
            $userId = is_string($user) ? $user : null;
        }

        return [
            'ok' => true,
            'user_id' => $userId,
            'via' => 'supabase',
        ];
    }

    /**
     * Resend invite for an auth user who has not signed in yet.
     *
     * @param array<string, mixed> $config
     * @return array{ok: bool, error?: string, via?: string}
     */
    public static function resendAuthInvite(array $config, string $email, string $redirectTo): array
    {
        $link = SupabaseRest::authGenerateLink($config, 'invite', $email, $redirectTo);
        if ($link['ok'] && is_array($link['data'] ?? null)) {
            $actionLink = (string) ($link['data']['action_link'] ?? $link['data']['properties']['action_link'] ?? '');
            if ($actionLink !== '') {
                $smtp = PlatformMail::smtpConfig($config);
                if (trim((string) ($smtp['smtpHost'] ?? '')) !== '' && trim((string) ($smtp['fromEmail'] ?? '')) !== '') {
                    $subject = 'Your FlowForge invitation';
                    $message = implode("\n", [
                        'Hi,',
                        '',
                        'Here is your invitation link to join FlowForge:',
                        $actionLink,
                        '',
                        'If you were not expecting this email, you can ignore it.',
                        '',
                        '— FlowForge',
                    ]);
                    $sent = Mailer::send($smtp, $email, $subject, $message);
                    if ($sent['ok']) {
                        return ['ok' => true, 'via' => 'smtp_link'];
                    }
                }
            }
        }

        // Fall back to Auth invite (works when user is still in invited state)
        $invite = self::sendAuthInvite($config, $email, $redirectTo);
        if ($invite['ok']) {
            return $invite;
        }

        return [
            'ok' => false,
            'error' => $invite['error'] ?? ($link['error'] ?? 'Could not resend invite'),
            'via' => 'supabase',
        ];
    }
}
