<?php
declare(strict_types=1);

/**
 * Download a template as JSON file
 * GET /api/template/download?id=<uuid>&format=json|txt
 * Returns the template as a downloadable file
 */

require_once __DIR__ . '/../bootstrap.php';

use FlowForge\Api\Auth;
use FlowForge\Api\Response;
use FlowForge\Api\SupabaseRest;

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    Response::error('Method not allowed', 405);
}

$templateId = $_GET['id'] ?? '';
$format = $_GET['format'] ?? 'json';

if (!$templateId || !preg_match('/^[0-9a-f-]{36}$/i', $templateId)) {
    Response::error('Invalid template ID', 400);
}

if (!in_array($format, ['json', 'txt'], true)) {
    Response::error('Invalid format. Use json or txt', 400);
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
    
    $name = preg_replace('/[^a-z0-9_-]/i', '_', $row['name'] ?? 'template');
    $key = $row['key'] ?? 'template';
    
    if ($format === 'json') {
        $exportData = [
            'id' => $row['id'],
            'key' => $row['key'],
            'name' => $row['name'],
            'description' => $row['description'] ?? null,
            'kind' => $row['kind'],
            'content' => $row['content'],
            'created_at' => $row['created_at'],
            'updated_at' => $row['updated_at'],
        ];
        
        header('Content-Type: application/json');
        header("Content-Disposition: attachment; filename=\"{$name}_{$key}.json\"");
        echo json_encode($exportData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    } else {
        $content = $row['content'];
        $text = renderTemplateAsText($row['kind'], $content);
        
        header('Content-Type: text/plain; charset=utf-8');
        header("Content-Disposition: attachment; filename=\"{$name}_{$key}.txt\"");
        echo $text;
    }
    
    exit;
} catch (Exception $e) {
    Response::error($e->getMessage(), 500);
}

function renderTemplateAsText(string $kind, $content): string
{
    if (!is_array($content)) {
        $content = json_decode(json_encode($content), true);
    }
    
    switch ($kind) {
        case 'email':
            $subject = $content['subject'] ?? '';
            $html = $content['html'] ?? '';
            $plain = strip_tags($html);
            return "Subject: $subject\n\n$plain";
            
        case 'faq':
            $intro = $content['intro'] ?? '';
            $items = $content['items'] ?? [];
            $lines = [$intro, ''];
            foreach ($items as $item) {
                $q = $item['question'] ?? '';
                $a = $item['answer'] ?? '';
                if ($q || $a) {
                    $lines[] = "Q: $q";
                    $lines[] = "A: $a";
                    $lines[] = '';
                }
            }
            return implode("\n", $lines);
            
        case 'cart':
            $storeName = $content['storeName'] ?? '';
            $intro = $content['intro'] ?? '';
            $products = $content['products'] ?? [];
            $currency = $content['currency'] ?? 'USD';
            $lines = [];
            if ($storeName) {
                $lines[] = $storeName;
                $lines[] = '';
            }
            if ($intro) {
                $lines[] = $intro;
                $lines[] = '';
            }
            foreach ($products as $product) {
                $name = $product['name'] ?? '';
                $price = $product['price'] ?? 0;
                $desc = $product['description'] ?? '';
                if ($name) {
                    $lines[] = "$name - $currency $price";
                    if ($desc) {
                        $lines[] = "  $desc";
                    }
                }
            }
            return implode("\n", $lines);
            
        case 'menu':
            $title = $content['title'] ?? '';
            $items = $content['items'] ?? [];
            $lines = [$title, ''];
            foreach ($items as $item) {
                $label = $item['label'] ?? '';
                $desc = $item['description'] ?? '';
                if ($label) {
                    $lines[] = "• $label" . ($desc ? " - $desc" : '');
                }
            }
            return implode("\n", $lines);
            
        case 'message':
            return $content['text'] ?? '';
            
        case 'hours':
            $timezone = $content['timezone'] ?? '';
            $note = $content['note'] ?? '';
            $days = $content['days'] ?? [];
            $lines = [];
            if ($timezone) {
                $lines[] = "Timezone: $timezone";
                $lines[] = '';
            }
            foreach ($days as $day) {
                $dayName = $day['day'] ?? '';
                $open = $day['open'] ?? '';
                $close = $day['close'] ?? '';
                $closed = $day['closed'] ?? false;
                if ($dayName) {
                    $lines[] = $closed ? "$dayName: Closed" : "$dayName: $open - $close";
                }
            }
            if ($note) {
                $lines[] = '';
                $lines[] = $note;
            }
            return implode("\n", $lines);
            
        case 'legal':
            $title = $content['title'] ?? '';
            $body = $content['body'] ?? '';
            return "$title\n\n$body";
            
        case 'receipt':
            $title = $content['title'] ?? '';
            $intro = $content['intro'] ?? '';
            $footer = $content['footer'] ?? '';
            return "$title\n\n$intro\n\n$footer";
            
        default:
            return json_encode($content, JSON_PRETTY_PRINT);
    }
}
