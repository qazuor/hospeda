import { describe, expect, it } from 'vitest';
import { parseStep3bArgs } from '../../../src/services/cutover-b9a/step-3b.args.js';

const actor = '10000000-0000-4000-8000-000000000001';
const first = '10000000-0000-4000-8000-000000000002';
const second = '10000000-0000-4000-8000-000000000003';
const plan = '10000000-0000-4000-8000-000000000004';
const version = '10000000-0000-4000-8000-000000000005';
const complete = [
    `--actor-user-id=${actor}`,
    `--beneficiary=${first}`,
    `--beneficiary=${second}`,
    `--plan-id=${plan}`,
    `--floor-plan-version-id=${version}`,
    '--includes-addons=false',
    '--confirm'
];

describe('TEST:B9a:16 (args) — parseStep3bArgs', () => {
    it('(a) accepts the complete argument set', () => {
        expect(parseStep3bArgs({ argv: complete })).toEqual({
            ok: true,
            value: {
                actorUserId: actor,
                beneficiaryUserIds: [first, second],
                planId: plan,
                floorPlanVersionId: version,
                includesAddons: false,
                dryRun: false
            }
        });
    });
    it('(b) requires --includes-addons', () => {
        expect(
            parseStep3bArgs({
                argv: complete.filter((value) => !value.startsWith('--includes-addons='))
            }).ok
        ).toBe(false);
    });
    it('(c) requires exactly two beneficiaries', () => {
        expect(
            parseStep3bArgs({
                argv: complete
                    .filter((value) => !value.startsWith('--beneficiary='))
                    .concat(`--beneficiary=${first}`)
            }).ok
        ).toBe(false);
        expect(parseStep3bArgs({ argv: [...complete, `--beneficiary=${actor}`] }).ok).toBe(false);
    });
    it('(d) rejects equal beneficiaries', () => {
        const argv = complete.map((value) =>
            value === `--beneficiary=${second}` ? `--beneficiary=${first}` : value
        );
        expect(parseStep3bArgs({ argv }).ok).toBe(false);
    });
    it('(e) reports an unknown flag', () => {
        const result = parseStep3bArgs({ argv: [...complete, '--strange=yes'] });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain('--strange');
    });
    it('(f) requires exactly one confirmation mode', () => {
        const noMode = complete.filter((value) => value !== '--confirm');
        const result = parseStep3bArgs({ argv: noMode });
        expect(result.ok).toBe(false);
        if (!result.ok) expect(result.reason).toContain('Refusing');
        expect(parseStep3bArgs({ argv: [...complete, '--dry-run'] }).ok).toBe(false);
    });
    it('(g) rejects malformed UUIDs', () => {
        expect(
            parseStep3bArgs({
                argv: complete.map((value) =>
                    value === `--plan-id=${plan}` ? '--plan-id=nope' : value
                )
            }).ok
        ).toBe(false);
    });
    it('rejects repeated switches and values on boolean switches', () => {
        expect(parseStep3bArgs({ argv: [...complete, '--confirm'] }).ok).toBe(false);
        expect(
            parseStep3bArgs({
                argv: complete.map((value) => (value === '--confirm' ? '--confirm=true' : value))
            }).ok
        ).toBe(false);
    });
});
