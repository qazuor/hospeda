/**
 * @file check-env-rules.test.ts
 * @description Fixture-driven unit tests for the `pnpm env:check:rules`
 * three-state cross-check rule evaluator (HOS-79 T-010). Covers AC-3
 * (`fail` when values differ, `partial` — non-failing — when only one side
 * is set, `pass` when equal) plus the missing-dotenv-file and
 * appliesTo-filtering edge cases, all via in-memory fixtures.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import type { CrossCheckRule } from '../../packages/config/src/env-cross-checks.js';
import type { AppId } from '../../packages/config/src/env-registry-types.js';
import { readDotenvFile } from '../check-env-local.js';
import {
    evaluateCrossCheckRule,
    evaluateLocalRules,
    loadAllLocalValues
} from '../check-env-rules.js';

/** Minimal fixture rule: api and web must hold the same value for KEY. */
function buildRule(overrides?: Partial<CrossCheckRule>): CrossCheckRule {
    return {
        id: 'fixture-rule',
        description: 'Fixture rule for tests.',
        appliesTo: ['local', 'coolify'],
        comparator: 'equals',
        compare: [
            { app: 'api', key: 'HOSPEDA_FIXTURE_SECRET' },
            { app: 'web', key: 'HOSPEDA_FIXTURE_SECRET' }
        ],
        ...overrides
    };
}

describe('evaluateCrossCheckRule', () => {
    it('should report "pass" (AC-3) when all referenced values are present and equal', () => {
        // Arrange
        const rule = buildRule();
        const values: Record<string, string> = {
            'api:HOSPEDA_FIXTURE_SECRET': 'same-value',
            'web:HOSPEDA_FIXTURE_SECRET': 'same-value'
        };

        // Act
        const result = evaluateCrossCheckRule({
            rule,
            getValue: (app, key) => values[`${app}:${key}`]
        });

        // Assert
        expect(result).toEqual({
            ruleId: 'fixture-rule',
            status: 'pass',
            detail: expect.stringContaining('pass')
        });
    });

    it('should report "fail" (AC-3) when all referenced values are present but differ', () => {
        // Arrange
        const rule = buildRule();
        const values: Record<string, string> = {
            'api:HOSPEDA_FIXTURE_SECRET': 'value-a',
            'web:HOSPEDA_FIXTURE_SECRET': 'value-b'
        };

        // Act
        const result = evaluateCrossCheckRule({
            rule,
            getValue: (app, key) => values[`${app}:${key}`]
        });

        // Assert
        expect(result.ruleId).toBe('fixture-rule');
        expect(result.status).toBe('fail');
        expect(result.detail).toContain('api:HOSPEDA_FIXTURE_SECRET');
        expect(result.detail).toContain('web:HOSPEDA_FIXTURE_SECRET');
    });

    it('should report "partial" (AC-3, non-failing) when only one side is set', () => {
        // Arrange
        const rule = buildRule();
        const values: Record<string, string> = {
            'api:HOSPEDA_FIXTURE_SECRET': 'value-a'
            // web side intentionally unset
        };

        // Act
        const result = evaluateCrossCheckRule({
            rule,
            getValue: (app, key) => values[`${app}:${key}`]
        });

        // Assert
        expect(result.status).toBe('partial');
        expect(result.detail).toContain('web:HOSPEDA_FIXTURE_SECRET');
    });

    it('should report "partial" when NEITHER side is set', () => {
        // Arrange
        const rule = buildRule();

        // Act
        const result = evaluateCrossCheckRule({ rule, getValue: () => undefined });

        // Assert
        expect(result.status).toBe('partial');
    });

    it('should treat an empty string as unset (partial, not a value)', () => {
        // Arrange
        const rule = buildRule();
        const values: Record<string, string> = {
            'api:HOSPEDA_FIXTURE_SECRET': '',
            'web:HOSPEDA_FIXTURE_SECRET': 'value-a'
        };

        // Act
        const result = evaluateCrossCheckRule({
            rule,
            getValue: (app, key) => values[`${app}:${key}`]
        });

        // Assert
        expect(result.status).toBe('partial');
    });

    it('should support a rule with more than 2 compare targets, passing only when ALL match', () => {
        // Arrange
        const rule = buildRule({
            compare: [
                { app: 'api', key: 'HOSPEDA_FIXTURE_SECRET' },
                { app: 'web', key: 'HOSPEDA_FIXTURE_SECRET' },
                { app: 'admin', key: 'HOSPEDA_FIXTURE_SECRET' }
            ]
        });
        const values: Record<string, string> = {
            'api:HOSPEDA_FIXTURE_SECRET': 'same',
            'web:HOSPEDA_FIXTURE_SECRET': 'same',
            'admin:HOSPEDA_FIXTURE_SECRET': 'different'
        };

        // Act
        const result = evaluateCrossCheckRule({
            rule,
            getValue: (app, key) => values[`${app}:${key}`]
        });

        // Assert
        expect(result.status).toBe('fail');
    });
});

describe('evaluateLocalRules', () => {
    it('should only evaluate rules whose appliesTo includes "local"', () => {
        // Arrange
        const localOnlyRule = buildRule({ id: 'local-rule', appliesTo: ['local'] });
        const coolifyOnlyRule = buildRule({ id: 'coolify-rule', appliesTo: ['coolify'] });
        const localValues: Record<AppId, Record<string, string>> = {
            api: { HOSPEDA_FIXTURE_SECRET: 'x' },
            web: { HOSPEDA_FIXTURE_SECRET: 'x' },
            admin: {},
            mobile: {},
            docker: {},
            seed: {}
        };

        // Act
        const results = evaluateLocalRules({
            localValues,
            rules: [localOnlyRule, coolifyOnlyRule]
        });

        // Assert
        expect(results).toHaveLength(1);
        expect(results[0]?.ruleId).toBe('local-rule');
        expect(results[0]?.status).toBe('pass');
    });

    it('should return an empty array when no rule applies to "local"', () => {
        // Arrange
        const coolifyOnlyRule = buildRule({ appliesTo: ['coolify'] });
        const localValues: Record<AppId, Record<string, string>> = {
            api: {},
            web: {},
            admin: {},
            mobile: {},
            docker: {},
            seed: {}
        };

        // Act
        const results = evaluateLocalRules({ localValues, rules: [coolifyOnlyRule] });

        // Assert
        expect(results).toEqual([]);
    });
});

describe('loadAllLocalValues', () => {
    const createdDirs: string[] = [];

    afterEach(() => {
        for (const dir of createdDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('should map docker and seed (no .env.local of their own) to empty objects', () => {
        // Act
        const values = loadAllLocalValues();

        // Assert
        expect(values.docker).toEqual({});
        expect(values.seed).toEqual({});
    });

    it('should never crash when an app has no .env.local file (treated as everything absent)', () => {
        // Act & Assert (real repo checkout may or may not have .env.local files —
        // this just asserts the call never throws and always returns an object per app)
        expect(() => loadAllLocalValues()).not.toThrow();
        const values = loadAllLocalValues();
        for (const appId of ['api', 'web', 'admin', 'mobile'] as const) {
            expect(typeof values[appId]).toBe('object');
        }
    });
});

describe('end-to-end: fixture dotenv files feed the pass/fail/partial states (AC-3)', () => {
    const createdDirs: string[] = [];

    afterEach(() => {
        for (const dir of createdDirs.splice(0)) {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it('should resolve to "pass" when both fixture dotenv files hold the same real value, read from disk', () => {
        // Arrange
        const dir = mkdtempSync(join(tmpdir(), 'hos79-rules-check-'));
        createdDirs.push(dir);
        const apiPath = join(dir, 'api.local');
        const webPath = join(dir, 'web.local');
        writeFileSync(apiPath, 'HOSPEDA_REVALIDATION_SECRET=shared-secret-value-x\n');
        writeFileSync(webPath, 'HOSPEDA_REVALIDATION_SECRET=shared-secret-value-x\n');

        const localValues: Record<AppId, Record<string, string>> = {
            api: readDotenvFile({ filePath: apiPath }),
            web: readDotenvFile({ filePath: webPath }),
            admin: {},
            mobile: {},
            docker: {},
            seed: {}
        };

        // Act
        const results = evaluateLocalRules({ localValues });

        // Assert
        expect(results.some((r) => r.status === 'fail')).toBe(false);
        const revalidationResult = results.find(
            (r) => r.ruleId === 'revalidation-secret-api-web-match'
        );
        expect(revalidationResult?.status).toBe('pass');
    });

    it('should resolve to "fail" when the fixture dotenv files hold DIFFERENT real values, read from disk', () => {
        // Arrange
        const dir = mkdtempSync(join(tmpdir(), 'hos79-rules-check-'));
        createdDirs.push(dir);
        const apiPath = join(dir, 'api.local');
        const webPath = join(dir, 'web.local');
        writeFileSync(apiPath, 'HOSPEDA_REVALIDATION_SECRET=secret-on-api-side\n');
        writeFileSync(webPath, 'HOSPEDA_REVALIDATION_SECRET=secret-on-web-side\n');

        const localValues: Record<AppId, Record<string, string>> = {
            api: readDotenvFile({ filePath: apiPath }),
            web: readDotenvFile({ filePath: webPath }),
            admin: {},
            mobile: {},
            docker: {},
            seed: {}
        };

        // Act
        const results = evaluateLocalRules({ localValues });

        // Assert
        const revalidationResult = results.find(
            (r) => r.ruleId === 'revalidation-secret-api-web-match'
        );
        expect(revalidationResult?.status).toBe('fail');
    });

    /**
     * HOS-1153 regression. {@link evaluateCrossCheckRule} short-circuits to
     * `partial` — explicitly "not a failure" — as soon as ANY referenced side
     * is unset. So widening an existing rule with a third app does not merely
     * extend its coverage: it DISABLES the rule for as long as that third side
     * has no value.
     *
     * The window is real and HOS-1153 creates it: the admin's
     * `HOSPEDA_INTERNAL_REQUEST_SECRET` is unset until an operator sets it in
     * Coolify. An api/web divergence landing inside that window is exactly the
     * HOS-155 incident (2026-07-13) — the bypass breaks silently, all SSR
     * traffic collapses onto the public per-IP bucket, and the site mass-429s.
     *
     * The rule SET must therefore keep api↔web strict no matter what the admin
     * side holds. How that is arranged (two rules, an optional side, ...) is
     * left open on purpose: this test constrains the behaviour, not the shape.
     */
    it('keeps failing on an api/web internal-secret divergence while the admin side is unset (HOS-1153)', () => {
        // Arrange: api and web disagree; admin has no value at all.
        const dir = mkdtempSync(join(tmpdir(), 'env-rules-hos1153-'));
        createdDirs.push(dir);
        const apiPath = join(dir, 'api.local');
        const webPath = join(dir, 'web.local');
        writeFileSync(apiPath, 'HOSPEDA_INTERNAL_REQUEST_SECRET=rotated-on-api-side-only\n');
        writeFileSync(webPath, 'HOSPEDA_INTERNAL_REQUEST_SECRET=stale-value-on-web-side\n');

        const localValues: Record<AppId, Record<string, string>> = {
            api: readDotenvFile({ filePath: apiPath }),
            web: readDotenvFile({ filePath: webPath }),
            // The post-merge / pre-configuration state HOS-1153 explicitly expects.
            admin: {},
            mobile: {},
            docker: {},
            seed: {}
        };

        // Act
        const results = evaluateLocalRules({ localValues });
        const internalSecretResults = results.filter((r) =>
            r.ruleId.startsWith('internal-request-secret-')
        );

        // Assert
        expect(
            internalSecretResults.length,
            'no internal-request-secret cross-check rule is registered at all'
        ).toBeGreaterThan(0);
        expect(
            internalSecretResults.some((r) => r.status === 'fail'),
            `An api/web internal-secret divergence went undetected because the admin side is unset. Statuses: ${internalSecretResults
                .map((r) => `${r.ruleId}=${r.status}`)
                .join(
                    ', '
                )}. A missing side must never void the comparison of the sides that ARE set (HOS-1153 / HOS-155).`
        ).toBe(true);
    });
});
