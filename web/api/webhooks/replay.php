<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/bootstrap.php';
require_once dirname(__DIR__) . '/lib/WebhookDelivery.php';
use FlowForge\Api\Security;
use FlowForge\Api\SupabaseRest;
use FlowForge\Api\Response;
use FlowForge\Api\WebhookDelivery;
$boot=flowforge_bootstrap(['POST']);
$body=Security::readJsonBody();
$id=(string)($body['delivery_id']??'');
if(!SupabaseRest::isUuid($id)) Response::error('Valid delivery_id required',400);
$claim=SupabaseRest::rpcAsUser($boot['config'],SupabaseRest::bearerFromRequest(),'claim_webhook_replay',['p_delivery_id'=>$id]);
if(!$claim['ok'] || !is_array($claim['data']??null)) Response::error($claim['error']??'Replay unavailable',409);
$row=$claim['data'];
$result=WebhookDelivery::send($boot['config'],$row['hook'],$row['event'],(array)$row['payload'],true);
SupabaseRest::restPatchAsService($boot['config'],'webhook_replay_claims','delivery_id=eq.'.rawurlencode($id),['result'=>['ok'=>$result['ok'],'status_code'=>$result['status_code']]]);
Response::json($result);
