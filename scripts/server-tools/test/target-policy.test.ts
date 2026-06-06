/**
 * Unit tests for `src/lib/target-policy.ts` — evaluateTargetPolicy().
 *
 * The function is pure (no side effects, no process.exit, no I/O) so every
 * decision in the policy × source × interactive matrix can be exercised
 * deterministically without mocks.
 *
 * Coverage matrix:
 *
 *   policy             | source | interactive | expected action
 *   -------------------|--------|-------------|----------------
 *   none               | flag   | any         | skip
 *   none               | env    | any         | skip
 *   none               | none   | any         | skip
 *   explicit-required  | flag   | any         | run (warn=false)
 *   explicit-required  | env    | false       | die
 *   explicit-required  | env    | true        | die (env still rejected)
 *   explicit-required  | none   | false       | die
 *   explicit-required  | none   | true        | prompt
 *   default-ok         | flag   | any         | run (warn=false)
 *   default-ok         | env    | any         | run (warn=true)
 *   default-ok         | none   | false       | die
 *   default-ok         | none   | true        | prompt
 */

import { describe, expect, it } from 'bun:test';
import { type EvaluateTargetPolicyInput, evaluateTargetPolicy } from '../src/lib/target-policy.ts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeInput(overrides: Partial<EvaluateTargetPolicyInput>): EvaluateTargetPolicyInput {
    return {
        policy: 'none',
        commandName: 'test-cmd',
        target: undefined,
        source: 'none',
        interactive: false,
        ...overrides
    };
}

// ---------------------------------------------------------------------------
// policy === 'none'
// ---------------------------------------------------------------------------

describe("evaluateTargetPolicy — policy 'none'", () => {
    it('returns skip when source is flag', () => {
        const result = evaluateTargetPolicy(
            makeInput({ policy: 'none', target: 'prod', source: 'flag' })
        );
        expect(result.action).toBe('skip');
    });

    it('returns skip when source is env', () => {
        const result = evaluateTargetPolicy(
            makeInput({ policy: 'none', target: 'staging', source: 'env' })
        );
        expect(result.action).toBe('skip');
    });

    it('returns skip when source is none', () => {
        const result = evaluateTargetPolicy(
            makeInput({ policy: 'none', target: undefined, source: 'none' })
        );
        expect(result.action).toBe('skip');
    });

    it('returns skip regardless of interactive flag', () => {
        const nonInteractive = evaluateTargetPolicy(
            makeInput({ policy: 'none', interactive: false })
        );
        const interactive = evaluateTargetPolicy(makeInput({ policy: 'none', interactive: true }));
        expect(nonInteractive.action).toBe('skip');
        expect(interactive.action).toBe('skip');
    });
});

// ---------------------------------------------------------------------------
// policy === 'explicit-required'
// ---------------------------------------------------------------------------

describe("evaluateTargetPolicy — policy 'explicit-required'", () => {
    describe('source === flag', () => {
        it('returns run with the resolved target when flag provided', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    target: 'staging',
                    source: 'flag',
                    interactive: false
                })
            );
            expect(result.action).toBe('run');
            if (result.action !== 'run') throw new Error('narrowing');
            expect(result.target).toBe('staging');
            expect(result.warn).toBe(false);
        });

        it('returns run for prod target via flag', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    target: 'prod',
                    source: 'flag',
                    interactive: true // interactive doesn't change flag behaviour
                })
            );
            expect(result.action).toBe('run');
            if (result.action !== 'run') throw new Error('narrowing');
            expect(result.target).toBe('prod');
            expect(result.warn).toBe(false);
        });
    });

    describe('source === env (HOPS_DEFAULT_TARGET intentionally rejected)', () => {
        it('returns die when source is env and non-interactive', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    target: 'prod',
                    source: 'env',
                    interactive: false
                })
            );
            expect(result.action).toBe('die');
        });

        it('returns die when source is env and interactive (env still rejected)', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    target: 'prod',
                    source: 'env',
                    interactive: true
                })
            );
            // HOPS_DEFAULT_TARGET is always rejected for explicit-required,
            // even in interactive mode. The operator must use --target= or
            // pick via prompt.
            expect(result.action).toBe('die');
        });

        it('die message names the command and explains how to fix it', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    commandName: 'db-restore',
                    target: 'prod',
                    source: 'env',
                    interactive: false
                })
            );
            expect(result.action).toBe('die');
            if (result.action !== 'die') throw new Error('narrowing');
            expect(result.message).toContain('db-restore');
            expect(result.message).toContain('--target=');
            expect(result.message).toContain('HOPS_DEFAULT_TARGET');
        });
    });

    describe('source === none', () => {
        it('returns die when non-interactive and no target', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    target: undefined,
                    source: 'none',
                    interactive: false
                })
            );
            expect(result.action).toBe('die');
        });

        it('returns prompt when interactive and no target', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    target: undefined,
                    source: 'none',
                    interactive: true
                })
            );
            // In interactive mode a human prompt is an explicit choice.
            expect(result.action).toBe('prompt');
        });

        it('die message for non-interactive none contains usage hint', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'explicit-required',
                    commandName: 'redeploy',
                    target: undefined,
                    source: 'none',
                    interactive: false
                })
            );
            expect(result.action).toBe('die');
            if (result.action !== 'die') throw new Error('narrowing');
            expect(result.message).toContain('redeploy');
            expect(result.message).toContain('--target=');
        });
    });
});

// ---------------------------------------------------------------------------
// policy === 'default-ok'
// ---------------------------------------------------------------------------

describe("evaluateTargetPolicy — policy 'default-ok'", () => {
    describe('source === flag', () => {
        it('returns run with the resolved target and warn=false', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    target: 'staging',
                    source: 'flag',
                    interactive: false
                })
            );
            expect(result.action).toBe('run');
            if (result.action !== 'run') throw new Error('narrowing');
            expect(result.target).toBe('staging');
            expect(result.warn).toBe(false);
        });

        it('returns run with warn=false regardless of interactive mode', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    target: 'prod',
                    source: 'flag',
                    interactive: true
                })
            );
            expect(result.action).toBe('run');
            if (result.action !== 'run') throw new Error('narrowing');
            expect(result.warn).toBe(false);
        });
    });

    describe('source === env (HOPS_DEFAULT_TARGET accepted with loud warning)', () => {
        it('returns run with warn=true when source is env (non-interactive)', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    target: 'staging',
                    source: 'env',
                    interactive: false
                })
            );
            expect(result.action).toBe('run');
            if (result.action !== 'run') throw new Error('narrowing');
            expect(result.target).toBe('staging');
            expect(result.warn).toBe(true);
        });

        it('returns run with warn=true when source is env (interactive)', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    target: 'prod',
                    source: 'env',
                    interactive: true
                })
            );
            expect(result.action).toBe('run');
            if (result.action !== 'run') throw new Error('narrowing');
            expect(result.warn).toBe(true);
        });
    });

    describe('source === none', () => {
        it('returns die when non-interactive and no target', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    target: undefined,
                    source: 'none',
                    interactive: false
                })
            );
            expect(result.action).toBe('die');
        });

        it('returns prompt when interactive and no target', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    target: undefined,
                    source: 'none',
                    interactive: true
                })
            );
            expect(result.action).toBe('prompt');
        });

        it('die message for non-interactive none is actionable', () => {
            const result = evaluateTargetPolicy(
                makeInput({
                    policy: 'default-ok',
                    commandName: 'db-counts',
                    target: undefined,
                    source: 'none',
                    interactive: false
                })
            );
            expect(result.action).toBe('die');
            if (result.action !== 'die') throw new Error('narrowing');
            expect(result.message).toContain('db-counts');
            expect(result.message).toContain('--target=');
        });
    });
});

// ---------------------------------------------------------------------------
// Exhaustive discriminant narrowing — verify action is one of the 4 known values
// ---------------------------------------------------------------------------

describe('evaluateTargetPolicy — action type exhaustiveness', () => {
    const allCases: Array<EvaluateTargetPolicyInput> = [
        makeInput({ policy: 'none', source: 'none' }),
        makeInput({ policy: 'explicit-required', source: 'flag', target: 'prod' }),
        makeInput({
            policy: 'explicit-required',
            source: 'env',
            target: 'prod',
            interactive: false
        }),
        makeInput({
            policy: 'explicit-required',
            source: 'env',
            target: 'prod',
            interactive: true
        }),
        makeInput({ policy: 'explicit-required', source: 'none', interactive: false }),
        makeInput({ policy: 'explicit-required', source: 'none', interactive: true }),
        makeInput({ policy: 'default-ok', source: 'flag', target: 'staging' }),
        makeInput({ policy: 'default-ok', source: 'env', target: 'staging' }),
        makeInput({ policy: 'default-ok', source: 'none', interactive: false }),
        makeInput({ policy: 'default-ok', source: 'none', interactive: true })
    ];

    const validActions = new Set(['skip', 'run', 'prompt', 'die']);

    for (const input of allCases) {
        it(`policy=${input.policy} source=${input.source} interactive=${input.interactive} → valid action`, () => {
            const result = evaluateTargetPolicy(input);
            expect(validActions.has(result.action)).toBe(true);
        });
    }
});
