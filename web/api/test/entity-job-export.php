<?php
declare(strict_types=1);
require_once dirname(__DIR__) . '/lib/EntityJobExport.php';
use FlowForge\Api\EntityJobExport;
function check(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$csv = EntityJobExport::csv(['name','note','missing'], [['name'=>'Zoë, Lee','note'=>"line 1\nline 2"],['name'=>' =1+1','note'=>false]]);
$f = fopen('php://temp', 'w+'); fwrite($f, $csv); rewind($f);
check(fgetcsv($f) === ['name','note','missing'], 'Header order');
check(fgetcsv($f) === ['Zoë, Lee',"line 1\nline 2",''], 'CSV Unicode, quoting, newlines and nulls');
check(fgetcsv($f) === ["' =1+1",'false',''], 'CSV formula neutralisation'); fclose($f);
foreach (['=cmd','+cmd','-cmd','@SUM(1)',"\t=cmd"] as $value) check(strpos(EntityJobExport::csv(['value'],[['value'=>$value]]), "'") !== false, 'Formula prefixes');
$destination = ['bucket'=>'test-bucket','region'=>'af-south-1','access_key_id'=>'EXAMPLE','secret_access_key'=>'not-a-real-secret'];
$request = EntityJobExport::signedRequest($destination,'exports/a b.csv',$csv,'20261006T010000Z');
check($request['url'] === 'https://test-bucket.s3.af-south-1.amazonaws.com/exports/a%20b.csv', 'S3 URL encoding');
check($request['headers']['x-amz-content-sha256'] === hash('sha256',$csv), 'Signed payload hash');
check(strpos($request['headers']['authorization'], '20261006/af-south-1/s3/aws4_request') !== false, 'Credential scope');
check(strpos(json_encode($request), 'not-a-real-secret') === false, 'Signing secret not in headers');
$changed = EntityJobExport::signedRequest($destination,'exports/a b.csv',$csv . 'changed','20261006T010000Z');
check($changed['headers']['authorization'] !== $request['headers']['authorization'], 'Payload changes must change signature');
$token = EntityJobExport::signedRequest($destination+['session_token'=>'session-token'],'x.csv',$csv,'20261006T010000Z');
check(strpos($token['headers']['authorization'],'x-amz-security-token') !== false, 'Session token must be signed');
foreach ([['bucket'=>'https://localhost'],['region'=>"af-south-1\r\nBad: x"],['session_token'=>"a\nb"]] as $bad) {
    try { EntityJobExport::signedRequest(array_merge($destination,$bad),'x.csv','x','20261006T010000Z'); throw new LogicException('Invalid destination accepted'); }
    catch (RuntimeException $expected) {}
}
try { EntityJobExport::csv(['x'],array_fill(0,10001,['x'=>'x'])); throw new LogicException('Row limit ignored'); } catch (RuntimeException $expected) {}
echo "Entity job export checks passed.\n";
