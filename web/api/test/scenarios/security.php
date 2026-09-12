<?php
declare(strict_types=1);

/**
 * Pure unit checks for Security helpers (no network).
 *
 * @param array{base:string,timeout:int} $ctx
 * @return array{passed:int,failed:int,failures:list<string>}
 */
return static function (array $ctx): array {
    unset($ctx);
    fwrite(STDOUT, "\n== Security helper scenarios ==\n");

    \FlowForge\Api\Test\Assert::same(
        'X-Api-Key',
        \FlowForge\Api\Security::sanitizeHeaderName('X-Api-Key'),
        'sanitizeHeaderName keeps valid name',
    );
    \FlowForge\Api\Test\Assert::same(
        null,
        \FlowForge\Api\Security::sanitizeHeaderName("X-Bad\r\nInject"),
        'sanitizeHeaderName rejects CR/LF',
    );
    \FlowForge\Api\Test\Assert::same(
        'ok',
        \FlowForge\Api\Security::sanitizeHeaderValue('ok'),
        'sanitizeHeaderValue keeps plain value',
    );
    \FlowForge\Api\Test\Assert::same(
        null,
        \FlowForge\Api\Security::sanitizeHeaderValue("bad\nvalue"),
        'sanitizeHeaderValue rejects CR/LF',
    );

    return \FlowForge\Api\Test\Assert::summary();
};
