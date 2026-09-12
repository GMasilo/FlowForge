<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';
require_once __DIR__ . '/lib/OpenApiSpec.php';

use FlowForge\Api\OpenApiSpec;
use FlowForge\Api\Response;

$boot = flowforge_bootstrap_public(['GET']);
unset($boot);

header('Access-Control-Allow-Origin: *');
Response::json(OpenApiSpec::document());
