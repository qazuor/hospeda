import pc from 'picocolors';
import { type Check, overallVerdict, type PrStatus, type Verdict } from './verdict.ts';

/**
 * How a wait ended.
 *
 * The three non-verdict kinds exist because "I did not find out" must never
 * look like "everything is fine". A caller that gates on this command has to be
 * able to tell a run that finished badly from one that never started and from
 * one still going when the ceiling hit.
 */
export type WaitKind =
    /** Every check finished and passed. */
    | 'green'
    /** At least one check failed. */
    | 'red'
    /** The pull request conflicts, so its checks describe an earlier push. */
    | 'conflict'
    /** Zero checks were ever reported, past the grace window. */
    | 'never-started'
    /** Checks were still running when the ceiling hit. */
    | 'timeout'
    /** GitHub could not be asked. */
    | 'error'
    /** The branch has no pull request. */
    | 'no-pr';

/** The result of waiting. */
export interface WaitOutcome {
    /** How it ended. */
    readonly kind: WaitKind;
    /** The last status read, when there was one. */
    readonly status: PrStatus | null;
    /** Wall time spent waiting. */
    readonly elapsedMs: number;
    /** How many times GitHub was asked. */
    readonly polls: number;
    /** The failure message, for `error` only. */
    readonly error: string;
}

/** What one poll's reading means for the loop. */
export type WaitStep = 'settled' | 'keep-waiting' | 'never-started' | 'timeout';

/** First pause between polls. */
const FIRST_DELAY_MS = 10_000;
/** Ceiling for a single pause. */
const MAX_DELAY_MS = 60_000;
/** Growth factor per attempt. */
const DELAY_GROWTH = 1.5;

/** Default ceiling for the whole wait. */
export const DEFAULT_TIMEOUT_MS = 30 * 60_000;
/**
 * How long zero checks is still forgivable.
 *
 * A pull request opened seconds ago genuinely reports no checks for a while.
 * Past this, zero checks stops being "not yet" and becomes "nothing ever
 * dispatched" — a conflicted PR, or a `pull_request` event GitHub dropped.
 */
export const DEFAULT_NO_CHECKS_GRACE_MS = 5 * 60_000;
/** How many consecutive failed queries are tolerated before giving up. */
export const DEFAULT_ERROR_BUDGET = 3;

/**
 * Pause before the next poll, growing with each attempt.
 *
 * @param input.attempt - Zero-based poll index already made.
 * @returns The delay in milliseconds, capped.
 */
export function nextDelayMs({ attempt }: { readonly attempt: number }): number {
    const grown = FIRST_DELAY_MS * DELAY_GROWTH ** Math.max(0, attempt);
    return Math.min(MAX_DELAY_MS, Math.round(grown));
}

/**
 * Whether a query failure is worth retrying.
 *
 * A network blip cures itself; an expired credential does not. Retrying a 401
 * three times only delays the same answer, and the message a caller needs to
 * read is the auth one, not a timeout.
 *
 * @param input.error - The failure message from `gh`.
 * @returns `true` when retrying cannot help.
 */
export function isFatalQueryError({ error }: { readonly error: string }): boolean {
    return /\b(401|403)\b|authentication|not logged/i.test(error);
}

/**
 * Decides what one reading means for the loop.
 *
 * A settled verdict wins over the clock: a result that arrived on the same poll
 * that crossed the ceiling is still a result, and reporting it as a timeout
 * would throw away the answer the command exists to produce.
 *
 * @param input.verdict          - The verdict just read.
 * @param input.elapsedMs        - Wall time since the wait began.
 * @param input.timeoutMs        - Ceiling for the whole wait.
 * @param input.noChecksGraceMs  - How long zero checks is still forgivable.
 * @returns The {@link WaitStep} to take.
 */
export function decideStep({
    verdict,
    elapsedMs,
    timeoutMs,
    noChecksGraceMs
}: {
    readonly verdict: Verdict;
    readonly elapsedMs: number;
    readonly timeoutMs: number;
    readonly noChecksGraceMs: number;
}): WaitStep {
    if (verdict === 'green' || verdict === 'red' || verdict === 'conflict') return 'settled';
    // Zero checks past the grace window is its own answer, and a more useful
    // one than "timeout": nothing ran, so there is nothing to keep waiting for.
    if (verdict === 'no-checks' && elapsedMs >= noChecksGraceMs) return 'never-started';
    if (elapsedMs >= timeoutMs) return 'timeout';
    return 'keep-waiting';
}

/** What one poll returns: a status, no pull request, or a failure. */
export type PollResult = PrStatus | 'none' | { readonly error: string };

/**
 * Polls until the pull request's checks settle, or until it is clear they will not.
 *
 * Prints nothing while it waits: there is nobody reading the intermediate
 * states, and a command whose output must be skimmed to find the answer has not
 * saved anyone the reading.
 *
 * @param input.poll                 - Reads the pull request once.
 * @param input.sleep                - Pauses between polls.
 * @param input.now                  - Current time in milliseconds.
 * @param input.timeoutMs            - Ceiling for the whole wait.
 * @param input.noChecksGraceMs      - How long zero checks is still forgivable.
 * @param input.maxConsecutiveErrors - Failed queries tolerated in a row.
 * @returns The {@link WaitOutcome}.
 */
export async function waitForVerdict({
    poll,
    sleep,
    now,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    noChecksGraceMs = DEFAULT_NO_CHECKS_GRACE_MS,
    maxConsecutiveErrors = DEFAULT_ERROR_BUDGET
}: {
    readonly poll: () => Promise<PollResult>;
    readonly sleep: (ms: number) => Promise<void>;
    readonly now: () => number;
    readonly timeoutMs?: number;
    readonly noChecksGraceMs?: number;
    readonly maxConsecutiveErrors?: number;
}): Promise<WaitOutcome> {
    const startedAt = now();
    let polls = 0;
    let consecutiveErrors = 0;
    let lastError = '';

    for (;;) {
        const reading = await poll();
        polls += 1;
        const elapsedMs = now() - startedAt;

        if (typeof reading === 'object' && 'error' in reading) {
            lastError = reading.error;
            consecutiveErrors += 1;
            // A credential that stopped working will not start working; and a
            // budget spent is a budget spent. Either way the honest answer is
            // "I could not find out", never a verdict.
            if (
                isFatalQueryError({ error: reading.error }) ||
                consecutiveErrors >= maxConsecutiveErrors
            ) {
                return { kind: 'error', status: null, elapsedMs, polls, error: reading.error };
            }
            await sleep(nextDelayMs({ attempt: polls - 1 }));
            continue;
        }

        if (reading === 'none') {
            return { kind: 'no-pr', status: null, elapsedMs, polls, error: '' };
        }

        consecutiveErrors = 0;
        const verdict = overallVerdict({ status: reading });
        const step = decideStep({ verdict, elapsedMs, timeoutMs, noChecksGraceMs });

        if (step === 'settled') {
            // `settled` is only ever reached for these three, so the cast back
            // to a kind is total rather than a default that could hide one.
            return { kind: verdict as 'green' | 'red' | 'conflict', status: reading, elapsedMs, polls, error: '' };
        }
        if (step === 'never-started') {
            return { kind: 'never-started', status: reading, elapsedMs, polls, error: '' };
        }
        if (step === 'timeout') {
            return { kind: 'timeout', status: reading, elapsedMs, polls, error: lastError };
        }

        await sleep(nextDelayMs({ attempt: polls - 1 }));
    }
}

/** Conclusions that mean a job was cut short rather than judged. */
const INTERRUPTED = new Set(['CANCELLED', 'TIMED_OUT']);

/**
 * Whether every failing check was cut short rather than actually failing.
 *
 * A job killed by its `timeout-minutes`, or cancelled because a newer push
 * superseded it, is not a broken test. It still blocks a merge — the checks are
 * not green — but calling it "ROJO" sends the reader hunting for a failure that
 * does not exist. Measured on PR #3152: `Integration Tests` was cancelled at
 * exactly 20m 17s against a 20-minute ceiling, and the headline read as a test
 * breaking.
 *
 * A single genuine failure alongside cancelled ones still reads as red: the
 * softer headline is only for when there is nothing else to report.
 *
 * @param input.checks - Every classified check.
 * @returns `true` when checks failed and all of them were interrupted.
 */
export function allFailuresInterrupted({
    checks
}: {
    readonly checks: readonly Check[];
}): boolean {
    const failed = checks.filter((check) => check.outcome === 'failed');
    return failed.length > 0 && failed.every((check) => INTERRUPTED.has(check.detail));
}

/** What the flags asked for. */
export interface WaitOptions {
    /** Whether to block until the checks settle. */
    readonly wait: boolean;
    /** Ceiling for the whole wait. */
    readonly timeoutMs: number;
}

/** Largest wait anyone can ask for, in minutes. */
const MAX_TIMEOUT_MINUTES = 180;

/**
 * Reads the wait flags, refusing anything it does not understand.
 *
 * A flag silently discarded is the bug this repo already shipped once: the
 * command runs, reports success, and does something other than what was asked.
 * So an unparseable `--timeout` is an error, never a fallback to the default.
 *
 * @param input.argv - Arguments after the command name.
 * @returns The options, or the reason they could not be read.
 */
export function parseWaitOptions({ argv }: { readonly argv: readonly string[] }):
    | WaitOptions
    | { readonly error: string } {
    const wait = argv.includes('--wait');
    const raw = argv.find((arg) => arg.startsWith('--timeout'));

    if (raw === undefined) return { wait, timeoutMs: DEFAULT_TIMEOUT_MS };
    if (!raw.startsWith('--timeout=')) {
        return { error: 'A --timeout hay que darle un valor: --timeout=15' };
    }
    const value = raw.slice('--timeout='.length);
    // Number('') is 0 and Number(' 5 ') is 5: neither is what the user typed.
    if (!/^\d+$/.test(value)) {
        return { error: `No entiendo --timeout=${value}. Va en minutos enteros: --timeout=15` };
    }
    const minutes = Number(value);
    if (minutes < 1 || minutes > MAX_TIMEOUT_MINUTES) {
        return { error: `--timeout va entre 1 y ${MAX_TIMEOUT_MINUTES} minutos, pediste ${minutes}` };
    }
    if (!wait) {
        // Accepting it silently would let someone believe they waited.
        return { error: '--timeout sólo tiene sentido con --wait' };
    }
    return { wait, timeoutMs: minutes * 60_000 };
}

/**
 * Renders a duration the way a person reads one.
 *
 * @param input.ms - The duration.
 * @returns Something like `6m 12s`.
 */
export function formatElapsed({ ms }: { readonly ms: number }): string {
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

/**
 * The exit code for an outcome.
 *
 * Three codes, not two, because the two ways of not knowing must be
 * distinguishable by a script: 3 says nothing ever ran, 4 says it was still
 * running. Collapsing either into 1 would let "no me enteré" pass for "falló",
 * and a caller would go debug a failure that did not happen.
 *
 * @param input.kind - How the wait ended.
 * @returns The process exit code.
 */
export function exitCodeFor({ kind }: { readonly kind: WaitKind }): number {
    if (kind === 'green') return 0;
    if (kind === 'never-started') return 3;
    if (kind === 'timeout') return 4;
    return 1;
}

/**
 * Renders the one-line verdict.
 *
 * @param input.outcome - How the wait ended.
 * @param input.branch  - The branch waited on.
 * @returns The headline, without a trailing newline.
 */
export function renderWaitHeadline({
    outcome,
    branch
}: {
    readonly outcome: WaitOutcome;
    readonly branch: string;
}): string {
    const elapsed = formatElapsed({ ms: outcome.elapsedMs });
    const pr = outcome.status === null ? branch : `PR #${outcome.status.number} · ${branch}`;
    const checks = outcome.status?.checks.length ?? 0;

    if (outcome.kind === 'green') {
        return `${pc.green('VERDE')}  ${pc.dim(`${pr} · ${checks} checks · ${elapsed}`)}`;
    }
    if (outcome.kind === 'red') {
        const failing = outcome.status?.checks.filter((c) => c.outcome === 'failed') ?? [];
        if (allFailuresInterrupted({ checks: outcome.status?.checks ?? [] })) {
            return `${pc.yellow('CI CORTADO')}  ${pc.dim(`${pr} · ${failing.length} cortados de ${checks} · ${elapsed}`)}`;
        }
        return `${pc.red('ROJO')}  ${pc.dim(`${pr} · ${failing.length} fallando de ${checks} · ${elapsed}`)}`;
    }
    if (outcome.kind === 'conflict') {
        return `${pc.red('EN CONFLICTO')}  ${pc.dim(`${pr} · ${elapsed}`)}`;
    }
    if (outcome.kind === 'never-started') {
        return `${pc.yellow('SIN ARRANCAR')}  ${pc.dim(`${pr} · 0 checks tras ${elapsed}`)}`;
    }
    if (outcome.kind === 'timeout') {
        const pending = outcome.status?.checks.filter((c) => c.outcome === 'pending').length ?? 0;
        return `${pc.yellow('TIMEOUT')}  ${pc.dim(`${pr} · ${pending} siguen corriendo tras ${elapsed}`)}`;
    }
    if (outcome.kind === 'no-pr') {
        return `${pc.yellow('SIN PR')}  ${pc.dim(`${branch} · ${elapsed}`)}`;
    }
    return `${pc.red('NO PUDE CONSULTAR')}  ${pc.dim(`${branch} · ${elapsed}`)}`;
}

/**
 * The line under the headline explaining what to do about it.
 *
 * @param input.outcome - How the wait ended.
 * @returns The explanation, or `null` when the headline says it all.
 */
export function explainWaitOutcome({
    outcome
}: {
    readonly outcome: WaitOutcome;
}): string | null {
    if (outcome.kind === 'never-started') {
        return (
            'Ni un check en toda la espera. No es que haya pasado: es que no corrió nada. ' +
            'Suele ser un PR en conflicto, o un evento pull_request que GitHub dropeó — un commit vacío lo redispara.'
        );
    }
    if (outcome.kind === 'timeout') {
        return 'Se acabó la espera con checks todavía corriendo. Esto NO es rojo: no llegué a saber el resultado.';
    }
    if (outcome.kind === 'error') {
        return (
            `No pude consultar GitHub: ${outcome.error.split('\n')[0] ?? ''}. ` +
            'Si dice 401, un GITHUB_TOKEN vencido en el entorno le gana a las credenciales de gh.'
        );
    }
    if (outcome.kind === 'conflict') {
        return 'El PR tiene conflictos, así que GitHub no dispara los workflows: los checks que ves son de un push anterior.';
    }
    if (
        outcome.kind === 'red' &&
        allFailuresInterrupted({ checks: outcome.status?.checks ?? [] })
    ) {
        return (
            'Ningún test falló: los jobs se cortaron (timeout del job, o un push nuevo que los reemplazó). ' +
            'Bloquea el merge igual, pero no hay nada que debuggear — se re-corren.'
        );
    }
    return null;
}
