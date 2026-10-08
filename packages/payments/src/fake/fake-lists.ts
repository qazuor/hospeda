/**
 * The fake's two closed lists (DEC-TEST-003, AC:B1:9), and what it simulates
 * apart.
 *
 * - **The measured lies**, M1..M13: what the real provider does on purpose that
 *   a reasonable provider would not. Each row carries its three data: its name,
 *   the matrix rows it comes from (with date and account), and the test that
 *   proves our code resists it. By default the fake tells every lie it
 *   implements; a test may turn one off only by naming it and saying why.
 * - **The provider's own rules and measured behaviour**, RP1..RP12: not lies;
 *   the provider demands them and says so. The fake keeps them always.
 * - **The simulations**: network cases nobody measured (a lost answer, a cut
 *   network, notices out of order). Not lies, never counted as such, and off
 *   unless a test turns one on, naming it and saying why.
 *
 * The lists are PURE DATA in `fake-lists.json`, next to this file, at the
 * fixed path `FAKE_LISTS_PATH`: GUARD:G15 (`scripts/check-fake-lies.ts`) reads
 * the JSON by that path. Do not move or rename it.
 *
 * Not every row is implemented by the fake yet: the rows whose surface the
 * payment interface does not carry today (M1, M2, M4, M7, M9, M12; RP1, RP7,
 * RP8, RP10, RP11, RP12) arrive with the units that add that surface. The list
 * is closed regardless: a lie the fake tells must have its row here.
 */
import { z } from 'zod';
import fakeListsJson from './fake-lists.json';

/** Repo-relative path of the JSON file. GUARD:G15 reads it from here. */
export const FAKE_LISTS_PATH = 'packages/payments/src/fake/fake-lists.json';

/** The accounts a measurement can come from. */
export const MEASUREMENT_ACCOUNTS = ['sandbox', 'production', 'staging'] as const;

/** One measurement: a matrix row, the day it was measured and where. */
export interface FakeMeasurement {
    readonly row: string;
    /** ISO date, `YYYY-MM-DD`. */
    readonly date: string;
    readonly accounts: readonly (typeof MEASUREMENT_ACCOUNTS)[number][];
}

/** One measured lie. */
export interface FakeLie {
    readonly id: string;
    readonly name: string;
    readonly does: string;
    readonly measured: readonly FakeMeasurement[];
    /** The test that proves our code resists the lie, as `TEST:<piece>:<n>`. */
    readonly defenseTest: string;
}

/** One rule of the provider, or one measured behaviour. */
export interface FakeRule {
    readonly id: string;
    readonly kind: 'rule' | 'measuredBehaviour';
    readonly name: string;
    readonly measured: readonly FakeMeasurement[];
}

/** One simulated, unmeasured network case. */
export interface FakeSimulation {
    readonly id: string;
    readonly name: string;
    readonly why: string;
}

/** The three lists, as the JSON file holds them. */
export interface FakeLists {
    readonly lies: readonly FakeLie[];
    readonly rules: readonly FakeRule[];
    readonly simulations: readonly FakeSimulation[];
}

const NonBlank = z.string().trim().min(1);

const MeasurementSchema = z.strictObject({
    row: NonBlank,
    date: z.iso.date(),
    accounts: z.array(z.enum(MEASUREMENT_ACCOUNTS)).min(1)
});

const uniqueIds = (rows: readonly { readonly id: string }[]) =>
    new Set(rows.map((row) => row.id)).size === rows.length;

/** The shape of `fake-lists.json`. A row without one of its data is refused. */
export const FakeListsSchema: z.ZodType<FakeLists> = z.strictObject({
    lies: z
        .array(
            z.strictObject({
                id: z.string().regex(/^M\d+$/),
                name: NonBlank,
                does: NonBlank,
                measured: z.array(MeasurementSchema).min(1),
                defenseTest: z.string().regex(/^TEST:[A-Za-z0-9]+:\d+$/)
            })
        )
        .refine(uniqueIds, { message: 'lie ids must be unique' }),
    rules: z
        .array(
            z.strictObject({
                id: z.string().regex(/^RP\d+$/),
                kind: z.enum(['rule', 'measuredBehaviour']),
                name: NonBlank,
                measured: z.array(MeasurementSchema).min(1)
            })
        )
        .refine(uniqueIds, { message: 'rule ids must be unique' }),
    simulations: z
        .array(
            z.strictObject({
                id: z.string().regex(/^[a-z][A-Za-z]*$/),
                name: NonBlank,
                why: NonBlank
            })
        )
        .refine(uniqueIds, { message: 'simulation ids must be unique' })
});

/**
 * Validates the lists.
 *
 * @param args.input - The raw lists (the parsed JSON)
 * @returns The validated lists
 * @throws ZodError when a row lacks one of its data
 */
export function parseFakeLists(args: { readonly input: unknown }): { readonly lists: FakeLists } {
    return { lists: FakeListsSchema.parse(args.input) };
}

/** The lists, validated at load: a broken file fails the import, never empties a list. */
export const FAKE_LISTS: FakeLists = Object.freeze(parseFakeLists({ input: fakeListsJson }).lists);

/** The closed list of measured lies, M1..M13. */
export const FAKE_LIES: readonly FakeLie[] = FAKE_LISTS.lies;

/** The provider's own rules and measured behaviour, RP1..RP12. */
export const FAKE_RULES: readonly FakeRule[] = FAKE_LISTS.rules;

/** What the fake simulates without having measured it. */
export const FAKE_SIMULATIONS: readonly FakeSimulation[] = FAKE_LISTS.simulations;

/** The id of a measured lie (`M1`..`M13`); membership is checked at runtime. */
export type FakeLieId = `M${number}`;

/** The id of a simulation; membership is checked at runtime. */
export type FakeSimulationId = string;
