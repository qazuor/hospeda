import { describe, expect, it } from 'bun:test';
import type { Check, PrStatus } from '../src/commands/ci/verdict.ts';
import {
    decideStep,
    exitCodeFor,
    explainWaitOutcome,
    formatElapsed,
    isFatalQueryError,
    nextDelayMs,
    parseWaitOptions,
    type PollResult,
    renderWaitHeadline,
    type WaitKind,
    type WaitOutcome,
    waitForVerdict
} from '../src/commands/ci/wait.ts';

const passed: Check = { name: 'Lint', outcome: 'passed', detail: 'SUCCESS' };
const failed: Check = { name: 'E2E P0 Suite', outcome: 'failed', detail: 'FAILURE' };
const pending: Check = { name: 'Build', outcome: 'pending', detail: 'IN_PROGRESS' };

function makeStatus(overrides: Partial<PrStatus> = {}): PrStatus {
    return { number: 3120, state: 'OPEN', mergeable: 'MERGEABLE', checks: [], ...overrides };
}

/**
 * A clock that only moves when the code under test sleeps.
 *
 * Real timers would make a timeout test take the timeout to run, which is the
 * fastest way to end up with a suite nobody runs.
 */
function fakeClock() {
    let time = 0;
    return {
        now: () => time,
        sleep: async (ms: number) => {
            time += ms;
        },
        advance: (ms: number) => {
            time += ms;
        }
    };
}

/** Replays a fixed sequence of readings, repeating the last one forever. */
function pollSequence(readings: readonly PollResult[]): () => Promise<PollResult> {
    let index = 0;
    return async () => {
        const reading = readings[Math.min(index, readings.length - 1)];
        index += 1;
        return reading as PollResult;
    };
}

describe('nextDelayMs', () => {
    it('should grow with each attempt', () => {
        expect(nextDelayMs({ attempt: 1 })).toBeGreaterThan(nextDelayMs({ attempt: 0 }));
    });

    it('should never exceed a minute, however long the wait runs', () => {
        // Unbounded growth turns a 30-minute wait into one poll at the start and
        // one at the end.
        expect(nextDelayMs({ attempt: 50 })).toBe(60_000);
    });
});

describe('isFatalQueryError', () => {
    it('should refuse to retry an expired credential', () => {
        // A 401 will still be a 401 on the third try; retrying only delays the
        // one message the caller needs to read.
        expect(isFatalQueryError({ error: 'HTTP 401: Bad credentials' })).toBe(true);
    });

    it('should retry something that can cure itself', () => {
        expect(isFatalQueryError({ error: 'getaddrinfo ENOTFOUND api.github.com' })).toBe(false);
    });
});

describe('decideStep', () => {
    const base = { elapsedMs: 0, timeoutMs: 1000, noChecksGraceMs: 500 };

    it('should let a verdict that arrived win over the clock', () => {
        // A result that lands on the same poll that crossed the ceiling is still
        // a result. Calling it a timeout throws away the answer.
        for (const verdict of ['green', 'red', 'conflict'] as const) {
            expect({
                verdict,
                step: decideStep({ ...base, verdict, elapsedMs: 99_999 })
            }).toEqual({ verdict, step: 'settled' });
        }
    });

    it('should keep waiting while zero checks is still forgivable', () => {
        expect(decideStep({ ...base, verdict: 'no-checks', elapsedMs: 499 })).toBe('keep-waiting');
    });

    it('should call zero checks past the grace "never-started", not a timeout', () => {
        // These are different facts and lead to different next moves: nothing
        // dispatched (redispatch it) vs. still running (wait longer).
        expect(decideStep({ ...base, verdict: 'no-checks', elapsedMs: 500 })).toBe('never-started');
        expect(decideStep({ ...base, verdict: 'no-checks', elapsedMs: 99_999 })).toBe(
            'never-started'
        );
    });

    it('should time out only on work that is actually running', () => {
        expect(decideStep({ ...base, verdict: 'pending', elapsedMs: 1000 })).toBe('timeout');
        expect(decideStep({ ...base, verdict: 'pending', elapsedMs: 999 })).toBe('keep-waiting');
    });
});

describe('waitForVerdict', () => {
    it('should poll until the checks settle', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([
                makeStatus({ checks: [pending] }),
                makeStatus({ checks: [pending] }),
                makeStatus({ checks: [passed, passed] })
            ]),
            sleep: clock.sleep,
            now: clock.now
        });

        expect({ kind: outcome.kind, polls: outcome.polls }).toEqual({ kind: 'green', polls: 3 });
    });

    it('should report red when a check failed', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([makeStatus({ checks: [passed, failed] })]),
            sleep: clock.sleep,
            now: clock.now
        });

        expect(outcome.kind).toBe('red');
    });

    it('should survive a blip and reset its budget', async () => {
        // Two failures in a row, then a success: the budget is consecutive
        // failures, not failures ever, or a long wait dies of old wounds.
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([
                { error: 'network glitch' },
                { error: 'network glitch' },
                makeStatus({ checks: [pending] }),
                { error: 'network glitch' },
                { error: 'network glitch' },
                makeStatus({ checks: [passed] })
            ]),
            sleep: clock.sleep,
            now: clock.now,
            maxConsecutiveErrors: 3
        });

        expect({ kind: outcome.kind, polls: outcome.polls }).toEqual({ kind: 'green', polls: 6 });
    });

    it('should give up immediately on an expired credential', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([{ error: 'HTTP 401: Bad credentials' }]),
            sleep: clock.sleep,
            now: clock.now
        });

        expect({ kind: outcome.kind, polls: outcome.polls }).toEqual({ kind: 'error', polls: 1 });
    });

    it('should give up once the error budget is spent', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([{ error: 'network glitch' }]),
            sleep: clock.sleep,
            now: clock.now,
            maxConsecutiveErrors: 3
        });

        expect({ kind: outcome.kind, polls: outcome.polls }).toEqual({ kind: 'error', polls: 3 });
    });

    it('should never report a verdict it could not read', async () => {
        // The whole point: a failed query is not a green PR and not a red one.
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([{ error: 'HTTP 401' }]),
            sleep: clock.sleep,
            now: clock.now
        });

        expect(['green', 'red']).not.toContain(outcome.kind);
    });

    it('should stop waiting for checks that never appear', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([makeStatus({ checks: [] })]),
            sleep: clock.sleep,
            now: clock.now,
            noChecksGraceMs: 60_000,
            timeoutMs: 600_000
        });

        expect(outcome.kind).toBe('never-started');
        // It must not have burned the full timeout to say so.
        expect(outcome.elapsedMs).toBeLessThan(600_000);
    });

    it('should time out rather than wait forever on a stuck run', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([makeStatus({ checks: [pending, passed] })]),
            sleep: clock.sleep,
            now: clock.now,
            timeoutMs: 120_000
        });

        expect(outcome.kind).toBe('timeout');
        expect(outcome.elapsedMs).toBeGreaterThanOrEqual(120_000);
    });

    it('should report a branch with no pull request as such', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence(['none']),
            sleep: clock.sleep,
            now: clock.now
        });

        expect(outcome.kind).toBe('no-pr');
    });

    it('should refuse to call a conflicted PR green, however green its checks', async () => {
        const clock = fakeClock();
        const outcome = await waitForVerdict({
            poll: pollSequence([makeStatus({ mergeable: 'CONFLICTING', checks: [passed, passed] })]),
            sleep: clock.sleep,
            now: clock.now
        });

        expect(outcome.kind).toBe('conflict');
    });
});

describe('exitCodeFor', () => {
    it('should keep the two ways of not knowing apart from each other and from red', () => {
        // Collapsing any of these into 1 lets "no me enteré" pass for "falló",
        // and the caller goes debugging a failure that never happened.
        const codes = {
            green: exitCodeFor({ kind: 'green' }),
            red: exitCodeFor({ kind: 'red' }),
            neverStarted: exitCodeFor({ kind: 'never-started' }),
            timeout: exitCodeFor({ kind: 'timeout' })
        };

        expect(codes).toEqual({ green: 0, red: 1, neverStarted: 3, timeout: 4 });
        expect(new Set(Object.values(codes)).size).toBe(4);
    });

    it('should give only green a success code', () => {
        const kinds: readonly WaitKind[] = [
            'red',
            'conflict',
            'never-started',
            'timeout',
            'error',
            'no-pr'
        ];

        expect(kinds.filter((kind) => exitCodeFor({ kind }) === 0)).toEqual([]);
    });
});

describe('renderWaitHeadline', () => {
    function outcomeOf(kind: WaitKind, status: PrStatus | null = makeStatus()): WaitOutcome {
        return { kind, status, elapsedMs: 372_000, polls: 4, error: 'HTTP 401' };
    }

    it('should never make a non-green outcome read as success', () => {
        // N4, as an assertion: the degraded modes exist to look different from
        // "todo bien". If one of them says VERDE, the command is worse than not
        // having it.
        const kinds: readonly WaitKind[] = [
            'red',
            'conflict',
            'never-started',
            'timeout',
            'error',
            'no-pr'
        ];

        for (const kind of kinds) {
            expect({
                kind,
                saysGreen: renderWaitHeadline({ outcome: outcomeOf(kind), branch: 'x' }).includes(
                    'VERDE'
                )
            }).toEqual({ kind, saysGreen: false });
        }
    });

    it('should give each outcome its own headline', () => {
        const kinds: readonly WaitKind[] = [
            'green',
            'red',
            'conflict',
            'never-started',
            'timeout',
            'error',
            'no-pr'
        ];
        const headlines = kinds.map(
            (kind) => renderWaitHeadline({ outcome: outcomeOf(kind), branch: 'x' }).split('  ')[0]
        );

        expect(new Set(headlines).size).toBe(kinds.length);
    });

    it('should name the branch when there is no PR to name', () => {
        expect(
            renderWaitHeadline({ outcome: outcomeOf('no-pr', null), branch: 'feat/algo' })
        ).toContain('feat/algo');
    });
});

describe('explainWaitOutcome', () => {
    it('should say out loud that a timeout is not a failure', () => {
        const text = explainWaitOutcome({
            outcome: { kind: 'timeout', status: null, elapsedMs: 0, polls: 1, error: '' }
        });

        expect(text).toContain('NO es rojo');
    });

    it('should add nothing to a green run', () => {
        expect(
            explainWaitOutcome({
                outcome: { kind: 'green', status: null, elapsedMs: 0, polls: 1, error: '' }
            })
        ).toBeNull();
    });
});

describe('parseWaitOptions', () => {
    it('should default to not waiting', () => {
        expect(parseWaitOptions({ argv: [] })).toEqual({ wait: false, timeoutMs: 30 * 60_000 });
    });

    it('should read a timeout in minutes', () => {
        expect(parseWaitOptions({ argv: ['--wait', '--timeout=15'] })).toEqual({
            wait: true,
            timeoutMs: 900_000
        });
    });

    it('should reject a timeout it cannot read instead of falling back', () => {
        // Silently discarding a flag is the bug this repo already shipped once:
        // the command reports success having done something else than asked.
        for (const argv of [
            ['--wait', '--timeout=abc'],
            ['--wait', '--timeout='],
            ['--wait', '--timeout'],
            ['--wait', '--timeout=0'],
            ['--wait', '--timeout=999']
        ]) {
            expect({ argv, parsed: parseWaitOptions({ argv }) }).toEqual({
                argv,
                parsed: { error: expect.any(String) }
            });
        }
    });

    it('should refuse a timeout without a wait to bound', () => {
        expect(parseWaitOptions({ argv: ['--timeout=15'] })).toEqual({
            error: expect.any(String)
        });
    });
});

describe('formatElapsed', () => {
    it('should read the way a person says it', () => {
        expect([formatElapsed({ ms: 12_000 }), formatElapsed({ ms: 372_000 })]).toEqual([
            '12s',
            '6m 12s'
        ]);
    });
});
