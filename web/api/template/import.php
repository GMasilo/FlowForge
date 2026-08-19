<?php
declare(strict_types=1);

/**
 * Import templates from a JSON bundle
 * POST /api/template/import
 * Body: { "chatbot_id": "uuid", "templates": [...], "overwrite": false }
 * Returns the imported template IDs
 */

require_once __DIR__ . '/../bootstrap.php';

use FlowForge\Api\Auth;
use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Method not allowed', 405);
}

$input = json_decode(file_get_contents('php://input'), true);
$chatbotId = $input['chatbot_id'] ?? '';
$templates = $input['templates'] ?? [];
$overwrite = $input['overwrite'] ?? false;

if (!$chatbotId || !preg_match('/^[0-9a-f-]{36}$/i', $chatbotId)) {
    Response::error('Invalid chatbot_id', 400);
}

if (empty($templates) || !is_array($templates)) {
    Response::error('templates array is required', 400);
}

try {
    $token = Auth::requireAuth();
    $supabase = new SupabaseRest($token);
    
    $chatbot = $supabase->get("chatbots?id=eq.$chatbotId&select=instance_id");
    if (empty($chatbot)) {
        Response::error('Chatbot not found', 404);
    }
    
    $instanceId = $chatbot[0]['instance_id'] ?? null;
    if (!$instanceId) {
        Response::error('Invalid chatbot data', 500);
    }
    
    $membership = $supabase->get("instance_members?instance_id=eq.$instanceId&select=role");
    if (empty($membership)) {
        Response::error('Access denied', 403);
    }
    
    $role = $membership[0]['role'] ?? '';
    if (!in_array($role, ['owner', 'admin', 'editor'], true)) {
        Response::error('Insufficient permissions', 403);
    }
    
    $existingTemplates = $supabase->get("chatbot_templates?chatbot_id=eq.$chatbotId&deleted_at=is.null&select=id,key");
    $existingKeys = array_column($existingTemplates, 'key', 'id');
    
    $imported = [];
    $skipped = [];
    $errors = [];
    
    foreach ($templates as $template) {
        $key = $template['key'] ?? '';
        $name = $template['name'] ?? '';
        $kind = $template['kind'] ?? '';
        $content = $template['content'] ?? null;
        
        if (!$key || !$name || !$kind || $content === null) {
            $errors[] = "Invalid template data for key: $key";
            continue;
        }
        
        if (!preg_match('/^[A-Za-z][A-Za-z0-9_]*$/', $key)) {
            $errors[] = "Invalid key format: $key";
            continue;
        }
        
        $existingId = array_search($key, $existingKeys, true);
        
        if ($existingId !== false && !$overwrite) {
            $skipped[] = $key;
            continue;
        }
        
        try {
            if ($existingId !== false && $overwrite) {
                $supabase->patch("chatbot_templates?id=eq.$existingId", [
                    'name' => $name,
                    'description' => $template['description'] ?? null,
                    'content' => $content,
                ]);
                $imported[] = ['id' => $existingId, 'key' => $key, 'action' => 'updated'];
            } else {
                $result = $supabase->post('chatbot_templates', [
                    'chatbot_id' => $chatbotId,
                    'key' => $key,
                    'name' => $name,
                    'description' => $template['description'] ?? null,
                    'kind' => $kind,
                    'content' => $content,
                ]);
                
                if (!empty($result)) {
                    $imported[] = ['id' => $result[0]['id'] ?? null, 'key' => $key, 'action' => 'created'];
                }
            }
        } catch (Exception $e) {
            $errors[] = "Failed to import $key: " . $e->getMessage();
        }
    }
    
    Response::success([
        'imported' => $imported,
        'skipped' => $skipped,
        'errors' => $errors,
        'total' => count($templates),
        'success_count' => count($imported),
    ]);
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}
