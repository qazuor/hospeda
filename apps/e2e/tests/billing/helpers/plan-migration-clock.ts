import { getLocalDateString, getUtcInstantForLocalMidnight } from '@repo/utils';

/**
 * Fake time the cohort build may consume before the launch announces the migration.
 *
 * Every card activation and credited charge delivers its notice late
 * (`FAKE_NOTICE_DELAY_MS`, ten minutes on the fake clock), so building the seven
 * customers and launching moves the clock roughly two hours. Six hours leaves a
 * wide margin without moving the clock far from real time.
 */
export const MIGRATION_COHORT_CLOCK_BUDGET_MS = 6 * 60 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The instant TEST:B12:12 starts its fake clock at (HOS-2240).
 *
 * The plan migration stores, per subscription, its first charge day strictly after
 * the notice (`computeApplicationDate`). The test asserts ONE application day for
 * the whole cohort, which only holds while every member's charge anchor and the
 * announcement fall on the same market-local day. Starting at the real `now` broke
 * that whenever the build began less than ~two hours before local midnight: the
 * first card was anchored on day N and the later ones on day N+1.
 *
 * Returns `now` when the budget fits before the next local midnight, otherwise the
 * next local midnight itself, so the whole build runs inside one local day. The
 * clock only ever moves forward, never behind real time.
 *
 * @param input.now - The real current instant
 * @param input.budgetMs - Fake time the build may consume (default {@link MIGRATION_COHORT_CLOCK_BUDGET_MS})
 * @returns The fake clock start
 */
export function migrationCohortClockStart(input: {
    readonly now: Date;
    readonly budgetMs?: number;
}): Date {
    const budgetMs = input.budgetMs ?? MIGRATION_COHORT_CLOCK_BUDGET_MS;
    const today = getLocalDateString({ instant: input.now });
    const tomorrow = new Date(Date.parse(`${today}T12:00:00.000Z`) + DAY_MS)
        .toISOString()
        .slice(0, 10);
    const nextMidnight = getUtcInstantForLocalMidnight({ date: tomorrow });
    return input.now.getTime() + budgetMs < nextMidnight.getTime() ? input.now : nextMidnight;
}
