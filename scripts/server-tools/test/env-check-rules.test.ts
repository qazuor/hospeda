/**
 * Unit tests for `src/commands/env-check-rules.ts` — the pure four-state
 * (`pass | fail | partial | skipped`) Coolify cross-check rule evaluator
 * (HOS-79 T-016, AC-3 three-state contract + AC-5 per-rule resilience).
 *
 * Only the exported pure helpers are covered here (`selectCoolifyRules`,
 * `evaluateCoolifyCrossCheckRule`, `evaluateCoolifyCrossCheckRules`); the
 * command wrapper does Coolify network I/O and container lookup and is not
 * exercised — no test in this suite ever makes a network call.
 */

import { describe, expect, it } from 'bun:test';
import {
    evaluateCoolifyCrossCheckRule,
    evaluateCoolifyCrossCheckRules,
    selectCoolifyRules
} from '../src/commands/env-check-rules.ts';
import type { RegistryCrossCheckRule } from '../src/lib/repo-root.ts';

const RULE: RegistryCrossCheckRule = {
    id: 'revalidation-secret-api-web-match',
    description: 'must match between api and web',
    appliesTo: ['local', 'coolify'],
    comparator: 'equals',
    compare: [
        { app: 'api', key: 'HOSPEDA_REVALIDATION_SECRET' },
        { app: 'web', key: 'HOSPEDA_REVALIDATION_SECRET' }
    ]
};

const LOCAL_ONLY_RULE: RegistryCrossCheckRule = {
    id: 'local-only-rule',
    description: 'only applies locally',
    appliesTo: ['local'],
    comparator: 'equals',
    compare: [
        { app: 'api', key: 'SOME_KEY' },
        { app: 'web', key: 'SOME_KEY' }
    ]
};

const THREE_APP_RULE: RegistryCrossCheckRule = {
    id: 'three-app-rule',
    description: 'spans api, web, and mobile',
    appliesTo: ['coolify'],
    comparator: 'equals',
    compare: [
        { app: 'api', key: 'SHARED_KEY' },
        { app: 'web', key: 'SHARED_KEY' },
        { app: 'mobile', key: 'SHARED_KEY' }
    ]
};

describe('selectCoolifyRules()', () => {
    it('excludes rules whose appliesTo does not include coolify', () => {
        const selected = selectCoolifyRules({ rules: [RULE, LOCAL_ONLY_RULE] });
        expect(selected.map((r) => r.id)).toEqual(['revalidation-secret-api-web-match']);
    });

    it('with no appFilter, includes every coolify-applicable rule', () => {
        const selected = selectCoolifyRules({ rules: [RULE, THREE_APP_RULE] });
        expect(selected).toHaveLength(2);
    });

    it('with an appFilter, only includes rules that reference that app', () => {
        const selected = selectCoolifyRules({ rules: [RULE, THREE_APP_RULE], appFilter: 'mobile' });
        expect(selected.map((r) => r.id)).toEqual(['three-app-rule']);
    });

    it('appFilter matching neither rule yields an empty list', () => {
        const selected = selectCoolifyRules({ rules: [RULE], appFilter: 'admin' });
        expect(selected).toEqual([]);
    });
});

describe('evaluateCoolifyCrossCheckRule()', () => {
    it('passes when all sides are present and equal', () => {
        const result = evaluateCoolifyCrossCheckRule({
            rule: RULE,
            getValue: () => 'same-secret',
            unreachableApps: new Set()
        });
        expect(result.status).toBe('pass');
    });

    it('fails when all sides are present but differ', () => {
        const result = evaluateCoolifyCrossCheckRule({
            rule: RULE,
            getValue: (app) => (app === 'api' ? 'secret-a' : 'secret-b'),
            unreachableApps: new Set()
        });
        expect(result.status).toBe('fail');
        expect(result.detail).toContain('differ');
    });

    it('is partial (non-failing) when one side is unset', () => {
        const result = evaluateCoolifyCrossCheckRule({
            rule: RULE,
            getValue: (app) => (app === 'api' ? 'secret-a' : undefined),
            unreachableApps: new Set()
        });
        expect(result.status).toBe('partial');
    });

    it('is skipped when a referenced app is in unreachableApps (AC-5)', () => {
        const result = evaluateCoolifyCrossCheckRule({
            rule: RULE,
            getValue: () => 'irrelevant — should not be reached for the unreachable side',
            unreachableApps: new Set(['web'])
        });
        expect(result.status).toBe('skipped');
        expect(result.detail).toContain('web');
    });

    it('skipped takes priority over a value mismatch (unreachable side is not evaluated)', () => {
        const result = evaluateCoolifyCrossCheckRule({
            rule: RULE,
            getValue: (app) => (app === 'api' ? 'secret-a' : 'secret-b'),
            unreachableApps: new Set(['api'])
        });
        expect(result.status).toBe('skipped');
    });
});

describe('evaluateCoolifyCrossCheckRules() — AC-5 per-rule resilience', () => {
    it('one unreachable app only skips the rules touching it — others still evaluate', () => {
        const okRule: RegistryCrossCheckRule = {
            id: 'admin-only-rule',
            description: 'only touches admin, unaffected by an api outage',
            appliesTo: ['coolify'],
            comparator: 'equals',
            compare: [
                { app: 'admin', key: 'SOME_KEY' },
                { app: 'admin', key: 'SOME_KEY_2' }
            ]
        };

        const values: Record<string, Record<string, string>> = {
            admin: { SOME_KEY: 'x', SOME_KEY_2: 'x' }
        };
        const getValue = (app: string, key: string): string | undefined => values[app]?.[key];

        const results = evaluateCoolifyCrossCheckRules({
            rules: [RULE, okRule],
            getValue,
            // Simulates api's Coolify container being unreachable this run.
            unreachableApps: new Set(['api'])
        });

        const revalidation = results.find((r) => r.ruleId === RULE.id);
        const adminOnly = results.find((r) => r.ruleId === okRule.id);

        expect(revalidation?.status).toBe('skipped');
        expect(adminOnly?.status).toBe('pass');
    });

    it('returns one result per input rule, in order', () => {
        const results = evaluateCoolifyCrossCheckRules({
            rules: [RULE, THREE_APP_RULE],
            getValue: () => 'v',
            unreachableApps: new Set()
        });
        expect(results.map((r) => r.ruleId)).toEqual([RULE.id, THREE_APP_RULE.id]);
    });

    it('an empty rule list yields an empty result list', () => {
        const results = evaluateCoolifyCrossCheckRules({
            rules: [],
            getValue: () => undefined,
            unreachableApps: new Set()
        });
        expect(results).toEqual([]);
    });
});
