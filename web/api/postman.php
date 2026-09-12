<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/OpenApiSpec.php';
require_once __DIR__ . '/lib/PostmanCollection.php';

use FlowForge\Api\OpenApiSpec;
use FlowForge\Api\PostmanCollection;
use FlowForge\Api\Response;

$boot = flowforge_bootstrap_public(['GET']);
$config = $boot['config'];

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$which = str_contains($path, 'environment') ? 'environment' : 'collection';

header('Access-Control-Allow-Origin: *');
header('Content-Disposition: attachment; filename="' . (
    $which === 'environment'
        ? 'FlowForge-Platform-API.postman_environment.json'
        : 'FlowForge-Platform-API.postman_collection.json'
) . '"');

if ($which === 'environment') {
    $base = flowforge_public_api_url($config);
    Response::json(PostmanCollection::environment($base !== '' ? $base : 'https://gkjtt.co.za/flowforge/api'));
}

Response::json(PostmanCollection::fromOpenApi(OpenApiSpec::document()));
