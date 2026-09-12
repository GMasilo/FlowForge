<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

$boot = flowforge_bootstrap_public(['GET']);
unset($boot);

$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
$apiBase = (string) preg_replace('#/docs/?$#', '', $path);
$apiBase = rtrim($apiBase, '/');
$specUrl = $apiBase . '/openapi.json';
$collectionUrl = $apiBase . '/postman.json';
$envUrl = $apiBase . '/postman-environment.json';

header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Frame-Options: SAMEORIGIN');

$title = 'FlowForge Platform API';
$specUrlJson = htmlspecialchars($specUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$collectionUrlJson = htmlspecialchars($collectionUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
$envUrlJson = htmlspecialchars($envUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');

echo <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{$title}</title>
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif; }
    .bar {
      display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px;
      padding: 12px 20px; border-bottom: 1px solid #d7e2e0;
      background: #f4faf8; position: sticky; top: 0; z-index: 4;
    }
    .bar h1 { margin: 0; font-size: 16px; font-weight: 650; }
    .bar p { margin: 0; font-size: 13px; color: #4b5c59; }
    .bar a {
      font-size: 13px; font-weight: 600; color: #0f5c55; text-decoration: none;
      border: 1px solid #9ad0c8; background: #fff; border-radius: 8px; padding: 6px 10px;
    }
    .bar a:hover { background: #e7f6f2; }
    redoc { display: block; }
  </style>
</head>
<body>
  <div class="bar">
    <div>
      <h1>{$title}</h1>
      <p>OpenAPI 3.0 — import into Postman, Insomnia, Bruno, or Swagger UI</p>
    </div>
    <a href="{$specUrlJson}" download="flowforge-openapi.json">OpenAPI JSON</a>
    <a href="{$collectionUrlJson}">Postman collection</a>
    <a href="{$envUrlJson}">Postman environment</a>
  </div>
  <redoc spec-url="{$specUrlJson}" hide-download-button="true"></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
HTML
;
