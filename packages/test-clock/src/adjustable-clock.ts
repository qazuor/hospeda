/**
 * The adjustable clock (AC:B1:17, `B/20` §5.1 case 31): the `Clock` tests inject
 * in place of the system time, so a test can move the time the code reads.
 *
 * TEST-ONLY. This package is a devDependency wherever it appears, and no
 * production build imports it (`test/never-in-production.test.ts`).
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { z } from 'zod';

/** A clock a test can move. Reads like any `Clock`; only a test moves it. */
export interface AdjustableClock extends Clock {
    /**
     * Moves the clock forward.
     *
     * @param input.ms - Milliseconds to move forward; an integer, zero or more
     * @returns The instant the clock now reads
     */
    advance(input: { readonly ms: number }): { readonly now: Date };
    /**
     * Puts the clock at an exact instant, forward or back.
     *
     * @param input.at - The instant the clock reads from now on
     * @returns The instant the clock now reads
     */
    set(input: { readonly at: Date }): { readonly now: Date };
}

/** One millisecond-precision instant; an invalid `Date` is refused. */
const InstantSchema = z.date();

const CreateInputSchema = z.strictObject({ start: InstantSchema });
const AdvanceInputSchema = z.strictObject({ ms: z.number().int().nonnegative() });
const SetInputSchema = z.strictObject({ at: InstantSchema });

/**
 * Creates an adjustable clock that stays still until a test moves it.
 *
 * @param input.start - The instant it reads first
 * @returns The clock
 * @throws ZodError when an input is not valid
 */
export function createAdjustableClock(input: { readonly start: Date }): AdjustableClock {
    let current = CreateInputSchema.parse(input).start.getTime();

    return {
        now: () => new Date(current),
        advance: (advanceInput) => {
            current += AdvanceInputSchema.parse(advanceInput).ms;
            return { now: new Date(current) };
        },
        set: (setInput) => {
            current = SetInputSchema.parse(setInput).at.getTime();
            return { now: new Date(current) };
        }
    };
}
