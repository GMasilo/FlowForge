<?php
declare(strict_types=1);

/**
 * View a template by ID
 * GET /api/template/view?id=<uuid>
 * Returns the full template data including content
 */

require_once __DIR__ . '/../bootstrap.php';

use FlowForge\Api\Auth;
use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$templateId = $_GET['id'] ?? '';
if (!$templateId || !preg_match('/^[0-9a-f-]{36}$/i', $templateId)) {
    Response::error('Invalid template ID', 400);
}

try {
    $token = Auth::requireAuth();
    $supabase = new SupabaseRest($token);
    
    $template = $supabase->get("chatbot_templates?id=eq.$templateId&deleted_at=is.null&select=*");
    
    if (empty($template)) {
        Response::error('Template not found', 404);
    }
    
    $row = $template[0];
    
    $chatbotId = $row['chatbot_id'] ?? null;
    if (!$chatbotId) {
        Response::error('Invalid template data', 500);
    }
    
    $chatbot = $supabase->get("chatbots?id=eq.$chatbotId&select=instance_id");
    if (empty($chatbot)) {
        Response::error('Associated chatbot not found', 404);
    }
    
    $instanceId = $chatbot[0]['instance_id'] ?? null;
    if (!$instanceId) {
        Response::error('Invalid chatbot data', 500);
    }
    
    $membership = $supabase->get("instance_members?instance_id=eq.$instanceId&select=role");
    if (empty($membership)) {
        Response::error('Access denied', 403);
    }
    
    Response::success([
        'template' => $row,
        'chatbot_id' => $chatbotId,
        'instance_id' => $instanceId,
    ]);
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}
