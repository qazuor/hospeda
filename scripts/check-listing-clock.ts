/**
 * GUARD:G-R6-B (HOS-1476, AC:V6:15) — the four halves of the closed list of
 * `listing.inactive_since` (`.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/
 * 04-catalogos.md` GUARD:G-R6-B; `10-corte/V6.md:810-910`; `02-nucleo-glosario.md:43-73`).
 *
 * What it does: `scripts/listing-clock-scan.ts` lists every production write and read of the
 * listing clock; this guard crosses them with `scripts/guards/listing-clock-inventory.json`,
 * keyed by `file|symbol` with an exact `count`, every row citing the spec:
 * (a) "escritor fuera de la lista": a writing symbol without a `writers` row, or with more
 *     sites than its count; and ALWAYS a write of `listing.deadlines_version` that does not
 *     write `listing.inactive_since` in the same object, call or literal;
 * (b) "lector fuera del inventario": a reading symbol that is neither a consumer row
 *     (`readers`), nor a transport row of `packages/db/src/models/listing/`, nor the one
 *     cutover tool (`cutTool`), or that has more sites than its count;
 * (c) "lector declarado que ya no lee": a `readers` row of an implemented consumer with fewer
 *     sites than its count, naming every consumer of that row;
 * (d) "lector de retención que no pregunta por la pausa": a `decision` row of a retention
 *     consumer (PB4, PB5, PB9 and the notices) whose symbol does not call `retentionStopped`,
 *     or reads the clock other than inside `retentionClockStart({ inactiveSince, pauseEndedAt })`.
 * It also fails closed on a broken inventory (unreadable, a row without `spec`, consumers that
 * are not exactly the six, more than one `cutTool` row, a transport row outside the listing
 * models, more pending consumers than `PENDING_CEILING`) and on a scan that is too small.
 *
 * What it does NOT verify:
 * - that every fact has someone executing it: «para los escritores la dirección simétrica
 *   sigue deliberadamente afuera del guard» (`10-corte/V6.md:901-910`);
 * - the reads of `deadlines_version`: it only checks that it is WRITTEN together with the clock;
 * - `trial.deadlines_version` and `partner_application.deadlines_version`, which are not the
 *   listing's columns;
 * - that a condition reads a column some transition writes: that is GUARD:G-R6
 *   (`pnpm check:read-columns-written`), not this guard.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { type ClockSite, scanTree } from './listing-clock-scan';

/** Fewer files than this means the scan looked at the wrong tree (same floor as GUARD:G5). */
export const MIN_SCANNED_FILES = 1000;

/** Consumers still to be built (V9b). It only goes down (Coord-93). */
export const PENDING_CEILING = 2;

/** Default inventory path, relative to the repository root. */
export const INVENTORY_PATH = 'scripts/guards/listing-clock-inventory.json';

/** The six consumers of `V6.md:860-873`, as English ids. */
export const SIX_CONSUMERS = [
    'PB4',
    'PB5',
    'PB9',
    'NOTICE_BEFORE_DAY_90',
    'NOTICE_BEFORE_DAY_180',
    'ARCHIVE_NOTICE_DATE'
] as const;

/** The consumers that decide to archive, delete or notify (half d). */
const RETENTION_CONSUMERS: ReadonlySet<string> = new Set(SIX_CONSUMERS);
const LISTING_MODELS = 'packages/db/src/models/listing/';
const SPEC_REF = /\.md:\d+/;

/** The four halves of the guard. */
export type Half = 'a' | 'b' | 'c' | 'd';

/** The spec's label of each half (`04-catalogos.md`, GUARD:G-R6-B), literal. */
export const HALF_LABELS: Readonly<Record<Half, string>> = {
    a: 'escritor fuera de la lista',
    b: 'lector fuera del inventario',
    c: 'lector declarado que ya no lee',
    d: 'lector de retención que no pregunta por la pausa'
};

type Row = {
    readonly file: string;
    readonly symbol: string;
    readonly count: number;
    readonly spec: string;
};
type ReaderRow = Row & { readonly consumers: readonly string[]; readonly role: string };
type Consumer = { readonly id: string; readonly spec: string; readonly owner?: string };

/** The parsed inventory. */
export type Inventory = {
    readonly writers: readonly Row[];
    readonly readers: readonly ReaderRow[];
    readonly transport: readonly Row[];
    readonly cutTool: readonly Row[];
    readonly pendingConsumers: readonly Consumer[];
    readonly implementedConsumers: readonly Consumer[];
};

const key = (e: { readonly file: string; readonly symbol: string }) => `${e.file}|${e.symbol}`;
const fail = (half: Half, detail: string) =>
    `FAIL GUARD:G-R6-B half (${half}) "${HALF_LABELS[half]}": ${detail}`;

function loadInventory(path: string): { inventory?: Inventory; error?: string } {
    try {
        const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<Inventory>;
        const lists = [
            'writers',
            'readers',
            'transport',
            'cutTool',
            'pendingConsumers',
            'implementedConsumers'
        ] as const;
        for (const list of lists)
            if (!Array.isArray(raw[list])) return { error: `inventory has no "${list}" list` };
        return { inventory: raw as Inventory };
    } catch (error) {
        return { error: `inventory cannot be loaded (${(error as Error).message})` };
    }
}

function integrity(inv: Inventory): string[] {
    const errors: string[] = [];
    const named = (
        list: string,
        rows: readonly { spec?: unknown }[],
        label: (i: number) => string
    ) =>
        rows.forEach((row, i) => {
            if (typeof row.spec !== 'string' || !SPEC_REF.test(row.spec))
                errors.push(`${list} row ${label(i)} has no "spec" (file:line of the spec)`);
        });
    for (const list of ['writers', 'readers', 'transport', 'cutTool'] as const)
        named(list, inv[list], (i) => {
            const row = inv[list][i];
            return row ? key(row) : String(i);
        });
    named('pendingConsumers', inv.pendingConsumers, (i) => inv.pendingConsumers[i]?.id ?? '?');
    named(
        'implementedConsumers',
        inv.implementedConsumers,
        (i) => inv.implementedConsumers[i]?.id ?? '?'
    );
    const ids = [...inv.pendingConsumers, ...inv.implementedConsumers].map((c) => c.id);
    const six = new Set<string>(SIX_CONSUMERS);
    if (
        ids.length !== six.size ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => six.has(id))
    )
        errors.push(
            `pendingConsumers + implementedConsumers must be exactly the six consumers (${SIX_CONSUMERS.join(', ')}); found ${ids.join(', ')}`
        );
    for (const row of inv.readers)
        for (const id of row.consumers)
            if (!six.has(id))
                errors.push(`readers row ${key(row)} names ${id}, not one of the six consumers`);
    for (const pending of inv.pendingConsumers)
        if (!pending.owner) errors.push(`pending consumer ${pending.id} has no owner`);
    if (inv.cutTool.length > 1)
        errors.push(`more than one cutTool row (${inv.cutTool.length}); the cutover tool is one`);
    for (const row of inv.transport)
        if (!row.file.startsWith(LISTING_MODELS))
            errors.push(`transport row ${key(row)} is outside ${LISTING_MODELS}`);
    if (inv.pendingConsumers.length > PENDING_CEILING)
        errors.push(
            `pending consumers ${inv.pendingConsumers.length} exceed ceiling ${PENDING_CEILING}`
        );
    return errors.map((e) => `FAIL GUARD:G-R6-B inventory: ${e} (${INVENTORY_PATH})`);
}

function group(sites: readonly ClockSite[]): Map<string, ClockSite[]> {
    const byKey = new Map<string, ClockSite[]>();
    for (const site of sites) {
        const list = byKey.get(key(site)) ?? [];
        list.push(site);
        byKey.set(key(site), list);
    }
    return byKey;
}

const lines = (sites: readonly ClockSite[]) => sites.map((s) => s.line).join(', ');

/**
 * Runs GUARD:G-R6-B over the tree at `root` (default: this repository).
 */
export function run(
    args: {
        readonly root?: string;
        readonly inventoryPath?: string;
        readonly minScannedFiles?: number;
    } = {}
): { readonly exitCode: number; readonly output: string } {
    const root = args.root ?? resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
    const loaded = loadInventory(args.inventoryPath ?? join(root, INVENTORY_PATH));
    if (!loaded.inventory)
        return { exitCode: 1, output: `FAIL GUARD:G-R6-B inventory: ${loaded.error}` };
    const inv = loaded.inventory;
    const errors = integrity(inv);
    const scan = scanTree({ root });
    const minimum = args.minScannedFiles ?? MIN_SCANNED_FILES;
    if (scan.scannedFiles < minimum)
        errors.push(
            `FAIL GUARD:G-R6-B scan: ${scan.scannedFiles} files scanned; expected at least ${minimum}`
        );

    const writes = scan.sites.filter((s) => s.kind === 'write');
    const reads = scan.sites.filter((s) => s.kind === 'read');
    const writesBy = group(writes);
    const readsBy = group(reads);

    // Half (a): writers outside the list, and deadlines_version written alone.
    const writers = new Map(inv.writers.map((row) => [key(row), row]));
    for (const [k, sites] of writesBy) {
        const row = writers.get(k);
        const first = sites[0] as ClockSite;
        if (!row)
            errors.push(
                fail(
                    'a',
                    `${first.file}:${first.line} ${first.symbol} writes the listing clock outside the closed list of facts (lines ${lines(sites)})`
                )
            );
        else if (sites.length > row.count)
            errors.push(
                fail(
                    'a',
                    `${first.file}:${first.line} ${first.symbol} has ${sites.length} clock writes, the list admits ${row.count} (lines ${lines(sites)})`
                )
            );
    }
    for (const site of writes)
        if (site.column === 'deadlines_version' && !site.writesClockToo)
            errors.push(
                fail(
                    'a',
                    `${site.file}:${site.line} ${site.symbol} writes listing.deadlines_version without listing.inactive_since`
                )
            );
    for (const row of inv.writers)
        if ((writesBy.get(key(row))?.length ?? 0) < row.count)
            errors.push(
                `FAIL GUARD:G-R6-B stale inventory row: writer ${key(row)} declares ${row.count} writes, found ${writesBy.get(key(row))?.length ?? 0}`
            );

    // Half (b): readers outside the inventory.
    const declared = new Map<string, Row>();
    for (const row of [...inv.readers, ...inv.transport, ...inv.cutTool])
        declared.set(key(row), row);
    for (const [k, sites] of readsBy) {
        const row = declared.get(k);
        const first = sites[0] as ClockSite;
        if (!row)
            errors.push(
                fail(
                    'b',
                    `${first.file}:${first.line} ${first.symbol} reads listing.inactive_since and is not in the inventory (lines ${lines(sites)})`
                )
            );
        else if (sites.length > row.count)
            errors.push(
                fail(
                    'b',
                    `${first.file}:${first.line} ${first.symbol} has ${sites.length} clock reads, the inventory admits ${row.count} (lines ${lines(sites)})`
                )
            );
    }

    // Half (c): declared readers that no longer read.
    const implemented = new Set(inv.implementedConsumers.map((c) => c.id));
    for (const row of inv.readers) {
        const found = readsBy.get(key(row))?.length ?? 0;
        if (found >= row.count || !row.consumers.some((id) => implemented.has(id))) continue;
        for (const id of row.consumers)
            errors.push(
                fail(
                    'c',
                    `consumer ${id} (${row.file} ${row.symbol}) declares ${row.count} reads of listing.inactive_since, found ${found}`
                )
            );
    }
    for (const row of [...inv.transport, ...inv.cutTool])
        if ((readsBy.get(key(row))?.length ?? 0) < row.count)
            errors.push(
                `FAIL GUARD:G-R6-B stale inventory row: reader ${key(row)} declares ${row.count} reads, found ${readsBy.get(key(row))?.length ?? 0}`
            );

    // Half (d): retention readers that do not ask about the pause.
    const stopped = new Set(scan.retentionStoppedKeys);
    for (const row of inv.readers) {
        if (row.role !== 'decision') continue;
        const consumers = row.consumers.filter((id) => RETENTION_CONSUMERS.has(id));
        const sites = readsBy.get(key(row)) ?? [];
        const line = sites[0]?.line ?? 1;
        for (const id of consumers) {
            if (!stopped.has(key(row)))
                errors.push(
                    fail(
                        'd',
                        `consumer ${id} (${row.file}:${line} ${row.symbol}) does not ask retentionStopped`
                    )
                );
            for (const site of sites.filter((s) => s.clockUse !== 'later-of-both'))
                errors.push(
                    fail(
                        'd',
                        `consumer ${id} (${site.file}:${site.line} ${row.symbol}) does not count from the later of inactive_since and pauseEndedAt`
                    )
                );
        }
    }

    if (errors.length > 0) return { exitCode: 1, output: errors.join('\n') };
    const ids = (list: readonly Consumer[]) => list.map((c) => c.id).join(', ');
    return {
        exitCode: 0,
        output: `OK GUARD:G-R6-B: ${scan.scannedFiles} production files scanned; ${writes.length} writer sites (facts 1, 2, 3, 5, 6 and C); ${reads.length} reader sites; consumers implemented: ${ids(inv.implementedConsumers)}; pending (V9b): ${ids(inv.pendingConsumers)}`
    };
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
