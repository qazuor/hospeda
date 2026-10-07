/**
 * @file generate-catalog-sql.ts
 * @description The SQL generator GUARD:G18 regenerates and compares (HOS-1352
 * program, built by V1 / HOS-1431, AC:V1:4).
 *
 * A migration cannot call code, so the reference rows the code catalog declares
 * travel inside a migration as generated SQL. This file is the ONE place that
 * turns the code catalog into that SQL. Two loads:
 *
 * - `catalog_key` (the key table): one row per entitlement and limit key of
 *   `packages/schemas/src/catalog`, with its four declared attributes.
 * - `vertical`: one row per `VerticalEnum` value with its declared activation
 *   event (`VERTICAL_ACTIVATION_EVENT_BY_VERTICAL`).
 *
 * The output is byte-identical to the `INSERT` statements of
 * `packages/db/src/migrations/0129_gorgeous_storm.sql`, which were hand-written
 * before this generator existed (`scripts/__tests__/check-catalog-sql.test.ts`
 * pins that). Row order is deterministic: verticals in enum order; keys
 * entitlements first then limits, each sorted by key (the catalog's own order).
 *
 * ## Usage
 *
 *     pnpm gen:catalog-sql                    # both loads
 *     pnpm gen:catalog-sql --load=catalog_key # one load
 *
 * Paste the output into a NEW migration (never edit an applied one). GUARD:G18
 * (`scripts/check-catalog-sql.ts`) then compares the cumulative rows every
 * migration inserts against what this generator produces.
 */

import type { CatalogKeyDefinition } from '../packages/schemas/src/catalog/key-attributes.js';
import { CATALOG_KEY_DEFINITIONS } from '../packages/schemas/src/catalog/key-catalog.js';
import { VERTICAL_ACTIVATION_EVENT_BY_VERTICAL } from '../packages/schemas/src/catalog/vertical-activation-event.js';
import { VerticalEnum } from '../packages/schemas/src/enums/vertical.enum.js';

/** A generated SQL value: a string literal or SQL `NULL`. */
export type SqlValue = string | null;

/** One reference-row load: the table, its columns, and its rows in insert order. */
export interface CatalogLoad {
    /** Table the rows go into. */
    readonly table: string;
    /** Human name used in guard messages. */
    readonly label: string;
    /** Column names, in insert order. The first one is the primary key. */
    readonly columns: readonly string[];
    /** Rows, each aligned with {@link CatalogLoad.columns}. */
    readonly rows: readonly (readonly SqlValue[])[];
}

/** The load names, in the order the generator emits them. */
export const LOAD_NAMES = ['vertical', 'catalog_key'] as const;
export type LoadName = (typeof LOAD_NAMES)[number];

/**
 * Builds the `catalog_key` load from a key catalog.
 *
 * @param input - Build input.
 * @param input.definitions - The key catalog; defaults to the code catalog.
 * @returns The load, rows in catalog order.
 */
export function buildCatalogKeyLoad({
    definitions = CATALOG_KEY_DEFINITIONS
}: {
    readonly definitions?: readonly CatalogKeyDefinition[];
} = {}): CatalogLoad {
    return {
        table: 'catalog_key',
        label: 'catalog_key (the entitlement/limit key table)',
        columns: [
            'key',
            'kind',
            'scope',
            'aggregation_strategy',
            'enforcement_strategy',
            'key_class'
        ],
        rows: definitions.map((d) => [
            d.key,
            d.kind,
            d.scope,
            d.aggregationStrategy,
            d.enforcementStrategy,
            d.keyClass
        ])
    };
}

/**
 * Builds the `vertical` load from the vertical enum and its activation events.
 *
 * @param input - Build input.
 * @param input.verticals - The vertical values; defaults to `VerticalEnum`, in enum order.
 * @param input.activationByVertical - Event per vertical; defaults to the code map.
 * @returns The load, rows in enum order.
 */
export function buildVerticalLoad({
    verticals = Object.values(VerticalEnum),
    activationByVertical = VERTICAL_ACTIVATION_EVENT_BY_VERTICAL
}: {
    readonly verticals?: readonly string[];
    readonly activationByVertical?: Readonly<Record<string, string | null>>;
} = {}): CatalogLoad {
    return {
        table: 'vertical',
        label: 'vertical (the vertical table)',
        columns: ['id', 'activation_event'],
        rows: verticals.map((id) => [id, activationByVertical[id] ?? null])
    };
}

/**
 * Builds every load the generator owns.
 *
 * @returns The loads keyed by name.
 */
export function buildLoads(): Readonly<Record<LoadName, CatalogLoad>> {
    return { vertical: buildVerticalLoad(), catalog_key: buildCatalogKeyLoad() };
}

/** Renders one value as a SQL literal. Only `[a-z0-9_A-Z]` reach here today; quotes are escaped anyway. */
function renderValue({ value }: { readonly value: SqlValue }): string {
    return value === null ? 'NULL' : `'${value.replaceAll("'", "''")}'`;
}

/**
 * Renders a load as ONE multi-row `INSERT` statement, in the exact layout of
 * `0129_gorgeous_storm.sql` (tab-indented rows, trailing `;`).
 *
 * @param input - Render input.
 * @param input.load - The load to render.
 * @returns The SQL statement, without a trailing newline.
 */
export function renderInsert({ load }: { readonly load: CatalogLoad }): string {
    const columns = load.columns.map((c) => `"${c}"`).join(', ');
    const rows = load.rows.map(
        (row) => `\t(${row.map((value) => renderValue({ value })).join(', ')})`
    );
    return `INSERT INTO "${load.table}" (${columns}) VALUES\n${rows.join(',\n')};`;
}

/**
 * Renders the requested loads, separated by Drizzle's statement breakpoint.
 *
 * @param input - Render input.
 * @param input.loads - Which loads to render; defaults to all, in {@link LOAD_NAMES} order.
 * @returns The SQL text, ending in a newline.
 */
export function generateCatalogSql({
    loads = LOAD_NAMES
}: {
    readonly loads?: readonly LoadName[];
} = {}): string {
    const all = buildLoads();
    return `${loads.map((name) => renderInsert({ load: all[name] })).join('\n--> statement-breakpoint\n')}\n`;
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const loadArg = process.argv.find((arg) => arg.startsWith('--load='))?.slice('--load='.length);
    if (loadArg !== undefined && !(LOAD_NAMES as readonly string[]).includes(loadArg)) {
        console.error(`Unknown --load=${loadArg}. Expected one of: ${LOAD_NAMES.join(', ')}.`);
        process.exit(1);
    }
    process.stdout.write(
        generateCatalogSql({ loads: loadArg ? [loadArg as LoadName] : LOAD_NAMES })
    );
}
