<?php
declare(strict_types=1);

/**
 * Export multiple templates as a JSON bundle
 * POST /api/template/export
 * Body: { "template_ids": ["uuid1", "uuid2", ...] }
 * Returns a JSON file with all templates
 */

require_once __DIR__ . '/../bootstrap.php';

use FlowForge\Api\Auth;
use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$templateIds = $input['template_ids'] ?? [];

if (empty($templateIds) || !is_array($templateIds)) {
    Response::error('template_ids array is required', 400);
}

foreach ($templateIds as $id) {
    if (!preg_match('/^[0-9a-f-]{36}$/i', $id)) {
        Response::error('Invalid template ID in list', 400);
    }
}

try {
    $token = Auth::requireAuth();
    $supabase = new SupabaseRest($token);
    
    $templates = [];
    $chatbotId = null;
    
    foreach ($templateIds as $templateId) {
        $template = $supabase->get("chatbot_templates?id=eq.$templateId&deleted_at=is.null&select=*");
        
        if (empty($template)) {
            continue;
        }
        
        $row = $template[0];
        
        if ($chatbotId === null) {
            $chatbotId = $row['chatbot_id'] ?? null;
        }
        
        $currentChatbotId = $row['chatbot_id'] ?? null;
        if ($currentChatbotId !== $chatbotId) {
            Response::error('All templates must belong to the same chatbot', 400);
        }
        
        $templates[] = [
            'id' => $row['id'],
            'key' => $row['key'],
            'name' => $row['name'],
            'description' => $row['description'] ?? null,
            'kind' => $row['kind'],
            'content' => $row['content'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
    }
    
    if (empty($templates)) {
        Response::error('No templates found', 404);
    }
    
    if ($chatbotId) {
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
    }
    
    $exportData = [
        'version' => '1.0',
        'exported_at' => date('c'),
        'templates' => $templates,
    ];
    
    header('Content-Type: application/json');
    header('Content-Disposition: attachment; filename="templates_export_' . date('Y-m-d_His') . '.json"');
    echo json_encode($exportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}
