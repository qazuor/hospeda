/**
 * What a test passes to build the fake, and the three rules it enforces
 * (DEC-TEST-003, AC:B1:9):
 *
 * 1. a lie that is not in the closed list cannot be named;
 * 2. by default the fake tells every lie: `honestAbout` is empty unless a test
 *    fills it;
 * 3. a test turns one lie off only by NAMING it and saying WHY, one entry per
 *    lie. GUARD:G15 predicate (b) checks the same thing statically, over the
 *    source of every test.
 *
 * Simulations are the opposite way round: off unless a test turns one on, with
 * its name and its reason.
 */
import type { Clock } from '@repo/billing-verticals-contract';
import { z } from 'zod';
import { FAKE_LIES, FAKE_SIMULATIONS, type FakeLieId, type FakeSimulationId } from './fake-lists';

/** One lie a test turns off, by name and with its reason. */
export interface HonestAbout {
    readonly lie: FakeLieId;
    readonly why: string;
}

/** One simulation a test turns on, by name and with its reason. */
export interface Simulate {
    readonly simulation: FakeSimulationId;
    readonly why: string;
}

/** Constructor options of the fake. */
export interface FakePaymentProviderOptions {
    /** The clock every read and every delay of the fake is measured on. */
    readonly clock: Clock;
    /** Separates generated ids across integration test providers sharing a database. */
    readonly idNamespace?: string;
    /** The lies this test turns off. Empty: the fake lies like the real one. */
    readonly honestAbout?: readonly HonestAbout[];
    /** The simulations this test turns on. Empty: none. */
    readonly simulate?: readonly Simulate[];
}

const LIE_IDS = FAKE_LIES.map((lie) => lie.id);
const SIMULATION_IDS = FAKE_SIMULATIONS.map((simulation) => simulation.id);
const Why = z.string().trim().min(1, { message: 'say why' });

/** Validation of the fake's options. An unnamed lie or a missing reason is refused. */
export const FakePaymentProviderOptionsSchema = z.strictObject({
    clock: z.custom<Clock>(
        (value) =>
            typeof value === 'object' &&
            value !== null &&
            typeof (value as { now?: unknown }).now === 'function',
        { message: 'clock must be an object with now(): Date' }
    ),
    idNamespace: z.string().min(1).optional(),
    honestAbout: z
        .array(
            z.strictObject({
                lie: z.string().refine((id) => LIE_IDS.includes(id), {
                    message: 'not a lie of the closed list'
                }),
                why: Why
            })
        )
        .refine((entries) => new Set(entries.map((e) => e.lie)).size === entries.length, {
            message: 'each lie is turned off once'
        })
        .default([]),
    simulate: z
        .array(
            z.strictObject({
                simulation: z.string().refine((id) => SIMULATION_IDS.includes(id), {
                    message: 'not a simulation of the list'
                }),
                why: Why
            })
        )
        .default([])
});

/**
 * Parses the fake's options.
 *
 * @param args.options - What the test passed
 * @returns The clock, the lies turned off and the simulations turned on
 * @throws ZodError when a lie is not in the list, or a reason is missing
 */
export function parseFakeOptions(args: { readonly options: FakePaymentProviderOptions }): {
    readonly clock: Clock;
    readonly idNamespace: string | undefined;
    readonly honest: ReadonlySet<string>;
    readonly simulating: ReadonlySet<string>;
} {
    const parsed = FakePaymentProviderOptionsSchema.parse(args.options);
    return {
        clock: parsed.clock,
        idNamespace: parsed.idNamespace,
        honest: new Set(parsed.honestAbout.map((entry) => entry.lie)),
        simulating: new Set(parsed.simulate.map((entry) => entry.simulation))
    };
}
