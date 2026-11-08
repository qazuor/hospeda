/**
 * GUARD:G-FAC-10 (HOS-1847, AC:4:9) — every content column of a listing table is
 * in its vertical's purge `SET` (`packages/db/src/models/listing/listing-purge.model.ts`,
 * `BLANK_CONTENT`) or in a closed, counted list of system/classification columns
 * (`scripts/guards/purge-content-columns.json`).
 *
 * What it does:
 * (a) reads the columns of `accommodations`, `venues` and `experiences` from their
 *     `dbschema` with the TypeScript AST, including the spread
 *     `...listingPublicationColumns()` resolved from its own helper;
 * (b) reads the columns each `BLANK_CONTENT[vertical]` assigns in its `sql` template;
 * (c) requires every column of (a) to be in (b) or in the closed list, and rejects a
 *     list row whose column no longer exists or a per-table `count` that does not
 *     match the rows;
 * (d) compares the purge `SET` with `LISTING_SUPPORT_EDIT_CONTENT_FIELDS` (the
 *     action-15 list, DEC-FAC-074) in both directions, with a closed, counted list
 *     of exceptions; and
 * (e) requires `business_lines` in the system list and `businessLines` in
 *     `LISTING_NON_CONTENT_FIELDS` (it is classification, not content); and
 * (f) allows a closed, counted list of LEGACY columns (`purgeOnlyLegacyColumns`)
 *     that the purge must still blank but no field may edit, because no code
 *     reads or writes them any more (an expand/contract window before their
 *     DROP). Each row must still be a column of its table and must be in the
 *     purge `SET`, so the list empties itself when the column is dropped.
 * A floor per table and per `SET` catches a parser that under-reads, and the
 * positive control (this repository) is green.
 *
 * What it does NOT verify:
 * - content held in child tables (G-R9 counts those tables) or in external storage;
 * - that the VALUE assigned in the `SET` is the right kind of empty (`''`, `NULL`,
 *   `'{}'`, `false`): it only requires the assignment to exist;
 * - that PB9 and PB12 actually run the purge: it reads the purge's own `SET`;
 * - which fields the support-edit email groups as "textos" (`FIELD_PART`): a note
 *   without a part falls into `other` by design.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    type ColumnScan,
    camelToSnake,
    parseFunctionReturnColumns,
    parsePgTableColumns,
    parseSqlAssignments,
    parseStringArray,
    snakeToCamel
} from './purge-content-columns-scan';

/** The three verticals, keyed as `BLANK_CONTENT` keys them. */
export const VERTICALS = ['accommodation', 'venue', 'experience'] as const;
export type Vertical = (typeof VERTICALS)[number];

/** Table and dbschema of each vertical. */
export const TABLES: Readonly<Record<Vertical, { readonly table: string; readonly file: string }>> =
    {
        accommodation: {
            table: 'accommodations',
            file: 'packages/db/src/schemas/accommodation/accommodation.dbschema.ts'
        },
        venue: { table: 'venues', file: 'packages/db/src/schemas/venue/venue.dbschema.ts' },
        experience: {
            table: 'experiences',
            file: 'packages/db/src/schemas/experience/experiences.dbschema.ts'
        }
    };

/** Helper whose returned columns a `...spread` contributes. */
export const SPREAD_HELPER = {
    file: 'packages/db/src/schemas/listing/listing-publication-columns.ts',
    functionName: 'listingPublicationColumns'
} as const;

/** Files the guard reads. */
export const PURGE_MODEL_PATH = 'packages/db/src/models/listing/listing-purge.model.ts';
export const SUPPORT_EDIT_PATH =
    'packages/service-core/src/services/listing/listing-support-edit.ts';
export const OWNER_ACT_PATH = 'packages/service-core/src/services/listing/listing-owner-act.ts';
export const INVENTORY_PATH = 'scripts/guards/purge-content-columns.json';

/** Names of the declarations the guard reads. */
export const PURGE_SET_NAME = 'BLANK_CONTENT';
export const SUPPORT_EDIT_FIELDS_NAME = 'LISTING_SUPPORT_EDIT_CONTENT_FIELDS';
export const NON_CONTENT_FIELDS_NAME = 'LISTING_NON_CONTENT_FIELDS';

/** A parser that reads too few columns must fail, not pass silently. */
export const MIN_COLUMNS: Readonly<Record<Vertical, number>> = {
    accommodation: 40,
    venue: 40,
    experience: 40
};
export const MIN_SET_ASSIGNMENTS: Readonly<Record<Vertical, number>> = {
    accommodation: 14,
    venue: 20,
    experience: 20
};

/** One row of the closed system/classification list. */
export interface SystemRow {
    /** `tabla.columna`, e.g. `venues.business_lines`. */
    readonly key: string;
    readonly reason: string;
}

/** The closed inventory of columns that are not content. */
export interface Inventory {
    readonly systemColumns: {
        /** Row count per table name (`venues`, `accommodations`, `experiences`). */
        readonly counts: Readonly<Record<string, number>>;
        readonly rows: readonly SystemRow[];
    };
    /** Action-15 fields that are not a purge content column, each with its reason. */
    readonly supportEditExceptions: {
        readonly count: number;
        readonly fields: readonly { readonly field: string; readonly reason: string }[];
    };
    /** Legacy columns the purge blanks but no field edits (rule f). */
    readonly purgeOnlyLegacyColumns?: {
        readonly count: number;
        readonly rows: readonly SystemRow[];
    };
}

/** The data the analysis needs, so tests can inject their own. */
export interface GuardInput {
    readonly columns: Readonly<Record<Vertical, readonly string[]>>;
    readonly purgeSet: Readonly<Record<Vertical, readonly string[]>>;
    readonly supportEditFields: readonly string[];
    readonly nonContentFields: readonly string[];
    readonly inventory: Inventory;
    readonly minColumns?: Readonly<Record<Vertical, number>>;
    readonly minSetAssignments?: Readonly<Record<Vertical, number>>;
}

const KEY_PATTERN = /^(accommodations|venues|experiences)\.[a-z][a-z0-9_]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Parses and validates the closed inventory.
 *
 * @param text - the JSON file's contents
 * @returns the inventory, or the reason it cannot be used
 */
export function parseInventory(text: string): {
    readonly inventory?: Inventory;
    readonly error?: string;
} {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        return { error: `${INVENTORY_PATH} cannot be parsed: ${(error as Error).message}` };
    }
    if (!isRecord(parsed) || !isRecord(parsed.systemColumns)) {
        return { error: `${INVENTORY_PATH} must contain systemColumns` };
    }
    const counts = parsed.systemColumns.counts;
    if (!isRecord(counts)) return { error: `${INVENTORY_PATH} systemColumns.counts is missing` };
    const parsedCounts: Record<string, number> = {};
    for (const vertical of VERTICALS) {
        const table = TABLES[vertical].table;
        const value = counts[table];
        if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
            return { error: `${INVENTORY_PATH} has no integer count for ${table}` };
        }
        parsedCounts[table] = value;
    }
    const rawRows = parsed.systemColumns.rows;
    if (!Array.isArray(rawRows))
        return { error: `${INVENTORY_PATH} systemColumns.rows is missing` };
    const rows: SystemRow[] = [];
    const seen = new Set<string>();
    for (const [index, raw] of rawRows.entries()) {
        if (!isRecord(raw) || typeof raw.key !== 'string' || typeof raw.reason !== 'string') {
            return { error: `${INVENTORY_PATH} system row ${index} needs a key and a reason` };
        }
        if (!KEY_PATTERN.test(raw.key)) {
            return { error: `${INVENTORY_PATH} system row ${raw.key} is not "tabla.columna"` };
        }
        if (!raw.reason.trim())
            return { error: `${INVENTORY_PATH} system row ${raw.key} has no reason` };
        if (seen.has(raw.key)) return { error: `${INVENTORY_PATH} repeats system row ${raw.key}` };
        seen.add(raw.key);
        rows.push({ key: raw.key, reason: raw.reason });
    }
    const rawExceptions = parsed.supportEditExceptions;
    if (!isRecord(rawExceptions) || !Array.isArray(rawExceptions.fields)) {
        return { error: `${INVENTORY_PATH} supportEditExceptions is missing` };
    }
    if (typeof rawExceptions.count !== 'number' || !Number.isInteger(rawExceptions.count)) {
        return { error: `${INVENTORY_PATH} supportEditExceptions.count is missing` };
    }
    const fields: { field: string; reason: string }[] = [];
    const seenFields = new Set<string>();
    for (const [index, raw] of rawExceptions.fields.entries()) {
        if (!isRecord(raw) || typeof raw.field !== 'string' || typeof raw.reason !== 'string') {
            return { error: `${INVENTORY_PATH} exception ${index} needs a field and a reason` };
        }
        if (!raw.field.trim())
            return { error: `${INVENTORY_PATH} exception ${index} has no field` };
        if (!raw.reason.trim())
            return { error: `${INVENTORY_PATH} exception ${raw.field} has no reason` };
        if (seenFields.has(raw.field))
            return { error: `${INVENTORY_PATH} repeats exception ${raw.field}` };
        seenFields.add(raw.field);
        fields.push({ field: raw.field, reason: raw.reason });
    }
    const rawLegacy = parsed.purgeOnlyLegacyColumns;
    const legacyRows: SystemRow[] = [];
    let legacyCount = 0;
    if (rawLegacy !== undefined) {
        if (!isRecord(rawLegacy) || !Array.isArray(rawLegacy.rows))
            return { error: `${INVENTORY_PATH} purgeOnlyLegacyColumns.rows is missing` };
        if (typeof rawLegacy.count !== 'number' || !Number.isInteger(rawLegacy.count))
            return { error: `${INVENTORY_PATH} purgeOnlyLegacyColumns.count is missing` };
        legacyCount = rawLegacy.count;
        const seenLegacy = new Set<string>();
        for (const [index, raw] of rawLegacy.rows.entries()) {
            if (!isRecord(raw) || typeof raw.key !== 'string' || typeof raw.reason !== 'string')
                return { error: `${INVENTORY_PATH} legacy row ${index} needs a key and a reason` };
            if (!KEY_PATTERN.test(raw.key))
                return { error: `${INVENTORY_PATH} legacy row ${raw.key} is not "tabla.columna"` };
            if (!raw.reason.trim())
                return { error: `${INVENTORY_PATH} legacy row ${raw.key} has no reason` };
            if (seenLegacy.has(raw.key))
                return { error: `${INVENTORY_PATH} repeats legacy row ${raw.key}` };
            seenLegacy.add(raw.key);
            legacyRows.push({ key: raw.key, reason: raw.reason });
        }
    }
    return {
        inventory: {
            systemColumns: { counts: parsedCounts, rows },
            supportEditExceptions: { count: rawExceptions.count, fields },
            purgeOnlyLegacyColumns: { count: legacyCount, rows: legacyRows }
        }
    };
}

function tableOfKey(key: string): string {
    return key.slice(0, key.indexOf('.'));
}

/**
 * Runs every G-FAC-10 check over the given data.
 *
 * @param input - the columns, the purge `SET`, both closed lists and the inventory
 * @returns one message per violation; empty means green
 */
export function analyze(input: GuardInput): readonly string[] {
    const violations: string[] = [];
    const minColumns = input.minColumns ?? MIN_COLUMNS;
    const minSet = input.minSetAssignments ?? MIN_SET_ASSIGNMENTS;
    const systemKeys = new Set(input.inventory.systemColumns.rows.map((row) => row.key));
    const exceptionFields = new Set(
        input.inventory.supportEditExceptions.fields.map((row) => row.field)
    );
    const columnIndex = new Map<string, ReadonlySet<string>>();
    for (const vertical of VERTICALS) {
        columnIndex.set(TABLES[vertical].table, new Set(input.columns[vertical]));
    }

    for (const vertical of VERTICALS) {
        const { table } = TABLES[vertical];
        const columns = input.columns[vertical];
        const set = input.purgeSet[vertical] ?? [];
        if (!Array.isArray(input.purgeSet[vertical]))
            violations.push(`${vertical} has no ${PURGE_SET_NAME} entry`);
        if (columns.length < minColumns[vertical])
            violations.push(
                `${table} read only ${columns.length} columns; the floor is ${minColumns[vertical]}`
            );
        if (set.length < minSet[vertical])
            violations.push(
                `${table} SET assigns ${set.length} columns; the floor is ${minSet[vertical]}`
            );
        const setColumns = new Set(set);
        for (const column of set) {
            if (!columnIndex.get(table)?.has(column))
                violations.push(
                    `${table} SET assigns ${column}, which is not a column of the table`
                );
        }
        for (const column of columns) {
            if (setColumns.has(column)) continue;
            if (systemKeys.has(`${table}.${column}`)) continue;
            violations.push(
                `${table}.${column} is neither in the purge SET nor in the closed system list (${INVENTORY_PATH})`
            );
        }
    }

    for (const row of input.inventory.systemColumns.rows) {
        const table = tableOfKey(row.key);
        const column = row.key.slice(row.key.indexOf('.') + 1);
        const present = columnIndex.get(table);
        if (!present) {
            violations.push(`system row ${row.key} names an unknown table`);
        } else if (!present.has(column)) {
            violations.push(`system row ${row.key} no longer exists in ${table}`);
        }
    }
    for (const vertical of VERTICALS) {
        const { table } = TABLES[vertical];
        const actual = input.inventory.systemColumns.rows.filter(
            (row) => tableOfKey(row.key) === table
        ).length;
        const declared = input.inventory.systemColumns.counts[table];
        if (actual !== declared)
            violations.push(
                `${table} system count is ${declared} but the list has ${actual} rows; update the count with every row`
            );
    }

    const allColumns = new Set<string>();
    const allSet = new Set<string>();
    for (const vertical of VERTICALS) {
        for (const column of input.columns[vertical]) allColumns.add(column);
        for (const column of input.purgeSet[vertical] ?? []) allSet.add(column);
    }
    const legacy = input.inventory.purgeOnlyLegacyColumns ?? { count: 0, rows: [] };
    if (legacy.count !== legacy.rows.length)
        violations.push(
            `purgeOnlyLegacyColumns count is ${legacy.count} but the list has ${legacy.rows.length} rows`
        );
    const legacyColumns = new Set<string>();
    for (const row of legacy.rows) {
        const table = tableOfKey(row.key);
        const column = row.key.slice(row.key.indexOf('.') + 1);
        const present = columnIndex.get(table);
        const vertical = VERTICALS.find((v) => TABLES[v].table === table);
        if (!present || !vertical) {
            violations.push(`legacy row ${row.key} names an unknown table`);
            continue;
        }
        if (!present.has(column)) {
            violations.push(
                `legacy row ${row.key} no longer exists in ${table}; remove it from purgeOnlyLegacyColumns`
            );
            continue;
        }
        if (!(input.purgeSet[vertical] ?? []).includes(column))
            violations.push(`legacy row ${row.key} must be blanked by the purge SET`);
        legacyColumns.add(column);
    }
    const supportEdit = new Set(input.supportEditFields);
    for (const column of allSet) {
        if (legacyColumns.has(column)) continue;
        const field = snakeToCamel(column);
        if (!supportEdit.has(field))
            violations.push(
                `purge SET column ${column} maps to ${field}, which is missing from ${SUPPORT_EDIT_FIELDS_NAME}`
            );
    }
    const { count: declaredExceptions, fields: exceptions } = input.inventory.supportEditExceptions;
    if (declaredExceptions !== exceptions.length)
        violations.push(
            `supportEditExceptions count is ${declaredExceptions} but the list has ${exceptions.length} fields`
        );
    for (const row of exceptions) {
        if (!supportEdit.has(row.field))
            violations.push(
                `support-edit exception ${row.field} is not in ${SUPPORT_EDIT_FIELDS_NAME}`
            );
        if (allSet.has(camelToSnake(row.field)))
            violations.push(
                `support-edit exception ${row.field} is in the purge SET, so it is not an exception`
            );
    }
    for (const field of input.supportEditFields) {
        const column = camelToSnake(field);
        if (!allColumns.has(column)) {
            if (!exceptionFields.has(field))
                violations.push(
                    `${field} is in ${SUPPORT_EDIT_FIELDS_NAME} but is neither a listing column nor a declared exception`
                );
            continue;
        }
        if (!allSet.has(column) && !exceptionFields.has(field))
            violations.push(
                `${field} (column ${column}) is in ${SUPPORT_EDIT_FIELDS_NAME} but not in the purge SET`
            );
    }

    for (const vertical of VERTICALS) {
        const key = `${TABLES[vertical].table}.business_lines`;
        if (!systemKeys.has(key)) violations.push(`${key} must be in the closed system list`);
    }
    if (!input.nonContentFields.includes('businessLines'))
        violations.push(
            `businessLines must be in ${NON_CONTENT_FIELDS_NAME} (DEC-FAC-074: classification, not content)`
        );

    return violations;
}

function read(root: string, file: string): { readonly text?: string; readonly error?: string } {
    try {
        return { text: readFileSync(resolve(root, file), 'utf8') };
    } catch (error) {
        return { error: `${file} cannot be read: ${(error as Error).message}` };
    }
}

function scanError(scan: ColumnScan, label: string): string | null {
    return scan.error ? `${label}: ${scan.error}` : null;
}

/**
 * Runs GUARD:G-FAC-10 against a repository tree.
 *
 * @param args.root - repository root (defaults to this repository)
 * @param args.inventoryPath - absolute inventory path (defaults to `<root>/scripts/guards/...`)
 * @returns the exit code and the text to print
 */
export function run(args: { readonly root?: string; readonly inventoryPath?: string } = {}): {
    readonly exitCode: number;
    readonly output: string;
} {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const helper = read(root, SPREAD_HELPER.file);
    if (!helper.text) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${helper.error}` };
    const spread = parseFunctionReturnColumns({ ...SPREAD_HELPER, source: helper.text });
    if (spread.error) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${spread.error}` };

    const columns: Record<Vertical, readonly string[]> = {
        accommodation: [],
        venue: [],
        experience: []
    };
    for (const vertical of VERTICALS) {
        const { table, file } = TABLES[vertical];
        const source = read(root, file);
        if (!source.text) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${source.error}` };
        const scan = parsePgTableColumns({
            file,
            source: source.text,
            table,
            resolveSpread: (name) => (name === SPREAD_HELPER.functionName ? spread.columns : null)
        });
        const error = scanError(scan, table);
        if (error) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${error}` };
        columns[vertical] = scan.columns;
    }

    const purge = read(root, PURGE_MODEL_PATH);
    if (!purge.text) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${purge.error}` };
    const set = parseSqlAssignments({
        file: PURGE_MODEL_PATH,
        source: purge.text,
        variableName: PURGE_SET_NAME
    });
    if (set.error) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${set.error}` };
    const purgeSet: Record<Vertical, readonly string[]> = {
        accommodation: set.assignments.accommodation ?? [],
        venue: set.assignments.venue ?? [],
        experience: set.assignments.experience ?? []
    };
    for (const vertical of VERTICALS) {
        if (!set.assignments[vertical])
            return {
                exitCode: 1,
                output: `FAIL GUARD:G-FAC-10: ${PURGE_SET_NAME} has no ${vertical} template`
            };
    }

    const supportEdit = read(root, SUPPORT_EDIT_PATH);
    if (!supportEdit.text)
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${supportEdit.error}` };
    const supportEditFields = parseStringArray({
        file: SUPPORT_EDIT_PATH,
        source: supportEdit.text,
        variableName: SUPPORT_EDIT_FIELDS_NAME
    });
    if (supportEditFields.error)
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${supportEditFields.error}` };

    const ownerAct = read(root, OWNER_ACT_PATH);
    if (!ownerAct.text) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${ownerAct.error}` };
    const nonContent = parseStringArray({
        file: OWNER_ACT_PATH,
        source: ownerAct.text,
        variableName: NON_CONTENT_FIELDS_NAME
    });
    if (nonContent.error)
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${nonContent.error}` };

    const inventorySource = read(root, args.inventoryPath ?? INVENTORY_PATH);
    if (!inventorySource.text)
        return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${inventorySource.error}` };
    const parsed = parseInventory(inventorySource.text);
    if (!parsed.inventory) return { exitCode: 1, output: `FAIL GUARD:G-FAC-10: ${parsed.error}` };

    const violations = analyze({
        columns,
        purgeSet,
        supportEditFields: supportEditFields.values,
        nonContentFields: nonContent.values,
        inventory: parsed.inventory
    });
    if (violations.length > 0) {
        return {
            exitCode: 1,
            output: violations.map((message) => `FAIL GUARD:G-FAC-10: ${message}`).join('\n')
        };
    }
    const summary = VERTICALS.map(
        (vertical) =>
            `${TABLES[vertical].table} ${columns[vertical].length} columns / ${purgeSet[vertical].length} SET`
    ).join('; ');
    return {
        exitCode: 0,
        output: `OK GUARD:G-FAC-10: ${summary}; ${parsed.inventory.systemColumns.rows.length} system rows and ${parsed.inventory.supportEditExceptions.fields.length} action-15 exceptions`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
