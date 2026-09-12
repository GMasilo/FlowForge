<?php
declare(strict_types=1);

/**
 * Export OpenAPI + Postman artifacts for the SPA public folder (and optional API copies).
 *
 *   php web/api/tools/export-openapi.php
 */

$apiRoot = dirname(__DIR__);
$webRoot = dirname($apiRoot);
require_once $apiRoot . '/lib/OpenApiSpec.php';
require_once $apiRoot . '/lib/PostmanCollection.php';

use FlowForge\Api\OpenApiSpec;
use FlowForge\Api\PostmanCollection;

$spec = OpenApiSpec::document();
$collection = PostmanCollection::fromOpenApi($spec);
$environment = PostmanCollection::environment();

$flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT;

$targets = [
    $webRoot . '/public/openapi.json' => $spec,
    $webRoot . '/public/postman/FlowForge-Platform-API.postman_collection.json' => $collection,
    $webRoot . '/public/postman/FlowForge-Platform-API.postman_environment.json' => $environment,
];

foreach ($targets as $path => $payload) {
    $dir = dirname($path);
    if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) {
        fwrite(STDERR, "Failed to create {$dir}\n");
        exit(1);
    }
    $json = json_encode($payload, $flags);
    if ($json === false) {
        fwrite(STDERR, "Failed to encode {$path}\n");
        exit(1);
    }
    if (file_put_contents($path, $json . "\n") === false) {
        fwrite(STDERR, "Failed to write {$path}\n");
        exit(1);
    }
    fwrite(STDOUT, "Wrote {$path} (" . number_format(strlen($json)) . " bytes)\n");
}

$pathCount = is_array($spec['paths'] ?? null) ? count($spec['paths']) : 0;
$itemCount = 0;
foreach ($collection['item'] as $folder) {
    $itemCount += is_array($folder['item'] ?? null) ? count($folder['item']) : 0;
}
fwrite(STDOUT, "OpenAPI paths: {$pathCount}; Postman requests: {$itemCount}\n");
