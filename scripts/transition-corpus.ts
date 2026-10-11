import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** One declared machine, including sub-states that have no independent table. */
export interface MachineDeclaration {
    readonly epic: 'verticals' | 'billing';
    readonly table: string | null;
    readonly subStateOf: string | null;
    readonly stateColumn: string | null;
    readonly states: readonly string[];
}

/** Values used to make guards mutually exclusive. */
export type GuardValue = boolean | string | readonly string[];

/** One explicitly transcribed row from a transition table. */
export interface TransitionRow {
    readonly id: string;
    readonly machine: string;
    readonly from: readonly string[];
    readonly events: readonly string[];
    readonly to: string;
    readonly guard: Readonly<Record<string, GuardValue>>;
    readonly reads: readonly string[];
    readonly inputs: readonly string[];
    readonly writes: readonly string[];
}

/** The checked-in declarations for all transition tables in both epics. */
export interface TransitionCorpus {
    readonly machines: Readonly<Record<string, MachineDeclaration>>;
    readonly transitions: readonly TransitionRow[];
}

/** Result returned by static guards. */
export interface GuardResult {
    readonly exitCode: 0 | 1;
    readonly output: string;
}

/** Repository-relative path to the declared transition corpus. */
export const CORPUS_PATH = 'scripts/guards/transition-tables.json';
/** Repository-relative path to the transition catalog used as the corpus anchor. */
export const CATALOG_PATH =
    '.specs/HOS-1352-billing-verticals-redesign/spec-consolidada/04-catalogos.md';

/** Parsed catalog row and its declared prose bullets. */
export interface CatalogTransition {
    readonly id: string;
    readonly machine: string;
    readonly bullets: Readonly<Record<string, string>>;
}

/** Read and parse the JSON corpus, throwing when it is missing or unreadable. */
export function loadCorpus(args: {
    readonly root: string;
    readonly corpusPath?: string;
}): TransitionCorpus {
    const source = readFileSync(join(args.root, args.corpusPath ?? CORPUS_PATH), 'utf8');
    return JSON.parse(source) as TransitionCorpus;
}

const SECTION_MACHINES: readonly [RegExp, string][] = [
    [/^## Trial \(/, 'trial'],
    [/^## Publicación de la ficha \(/, 'publication'],
    [/^## Postulación de Partner \(/, 'partner_application'],
    [/^## Suscripción \(/, 'subscription'],
    [/^## Pago \(/, 'payment'],
    [/^## Reembolso \(/, 'refund'],
    [/^## Pago manual \(/, 'manual_payment'],
    [/^## Instancia de addon, A1–A7 \(/, 'addon_instance']
];

/** Parse declared transition headings and their source bullets from the catalog. */
export function parseCatalog(args: {
    readonly root: string;
    readonly catalogPath?: string;
}): readonly CatalogTransition[] {
    const lines = readFileSync(join(args.root, args.catalogPath ?? CATALOG_PATH), 'utf8').split(
        /\r?\n/
    );
    let machine = '';
    let current: { id: string; machine: string; bullets: Record<string, string> } | undefined;
    let currentBullet: string | undefined;
    const rows: CatalogTransition[] = [];
    for (const line of lines) {
        if (line.startsWith('## ')) {
            if (current) rows.push(current);
            current = undefined;
            currentBullet = undefined;
            machine = SECTION_MACHINES.find(([pattern]) => pattern.test(line))?.[1] ?? '';
            continue;
        }
        if (line.startsWith('### ')) {
            if (current) rows.push(current);
            current = undefined;
            currentBullet = undefined;
            const heading = /^### `((?:TRANS:[VB]:)[^`]+)`/.exec(line);
            if (heading?.[1]) current = { id: heading[1], machine, bullets: {} };
            continue;
        }
        if (!current) continue;
        const bullet = /^- \*\*(desde|evento|hacia|condición|efectos|nota)\*\*[^:]*:\s*(.*)$/.exec(
            line
        );
        if (bullet) {
            const key = bullet[1];
            if (!key) continue;
            const text = bullet[2] ?? '';
            current.bullets[key] = text;
            currentBullet = key;
        } else if (current && currentBullet && line.trim() && !line.startsWith('- ')) {
            current.bullets[currentBullet] += ` ${line.trim()}`;
        } else if (!line.trim() || line.startsWith('- ')) {
            currentBullet = undefined;
        }
    }
    if (current) rows.push(current);
    return rows;
}

const COLUMN = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;
const EVENT = /^[a-z][a-z0-9_]*$/;
const PSEUDO = /^\*[A-Z_]+$/;
const INPUT = /^(contract|catalog|provider|clock|config|runtime):.+$/;

/** Return all structural problems in a corpus; an empty list means it is valid. */
export function validateCorpus(args: { readonly corpus: TransitionCorpus }): readonly string[] {
    const problems: string[] = [];
    const corpus: unknown = args.corpus;
    if (!corpus || typeof corpus !== 'object') return ['corpus must be an object'];
    const candidate = corpus as { machines?: unknown; transitions?: unknown };
    if (
        !candidate.machines ||
        typeof candidate.machines !== 'object' ||
        Array.isArray(candidate.machines)
    )
        return ['machines must be an object'];
    if (!Array.isArray(candidate.transitions)) return ['transitions must be an array'];
    const machines = candidate.machines as Record<string, unknown>;
    for (const [name, raw] of Object.entries(machines)) {
        if (!raw || typeof raw !== 'object') {
            problems.push(`machine ${name} must be an object`);
            continue;
        }
        const m = raw as Record<string, unknown>;
        if (!['verticals', 'billing'].includes(String(m.epic)))
            problems.push(`machine ${name}: epic is invalid`);
        for (const key of ['table', 'subStateOf', 'stateColumn'])
            if (m[key] !== null && typeof m[key] !== 'string')
                problems.push(`machine ${name}: ${key} must be string or null`);
        if (
            !Array.isArray(m.states) ||
            !m.states.every((state) => typeof state === 'string' && /^[A-Z][A-Z0-9_]*$/.test(state))
        )
            problems.push(`machine ${name}: states must be real state strings`);
    }
    const ids = new Set<string>();
    candidate.transitions.forEach((raw, index) => {
        const label = `transition[${index}]`;
        if (!raw || typeof raw !== 'object') {
            problems.push(`${label} must be an object`);
            return;
        }
        const row = raw as Record<string, unknown>;
        if (typeof row.id !== 'string' || !/^TRANS:[VB]:[A-Z0-9-]+$/.test(row.id))
            problems.push(`${label}: id is invalid`);
        else if (ids.has(row.id)) problems.push(`${row.id}: duplicate id`);
        else ids.add(row.id);
        if (typeof row.machine !== 'string' || !(row.machine in machines))
            problems.push(`${label}: machine is undeclared`);
        const machineStates =
            typeof row.machine === 'string' &&
            machines[row.machine] &&
            typeof machines[row.machine] === 'object'
                ? ((machines[row.machine] as MachineDeclaration).states ?? [])
                : [];
        const from = row.from;
        if (
            !Array.isArray(from) ||
            from.length === 0 ||
            !from.every(
                (state) =>
                    typeof state === 'string' &&
                    (PSEUDO.test(state) || machineStates.includes(state))
            )
        )
            problems.push(`${label}: from has invalid or undeclared states`);
        if (
            !Array.isArray(row.events) ||
            row.events.length === 0 ||
            !row.events.every(
                (event) =>
                    typeof event === 'string' &&
                    (EVENT.test(event) || /^on_[A-Z][A-Z0-9_]*$/.test(event))
            )
        )
            problems.push(`${label}: events must be non-empty lower_snake_case`);
        if (typeof row.to !== 'string' || (!PSEUDO.test(row.to) && !machineStates.includes(row.to)))
            problems.push(`${label}: to is invalid or undeclared`);
        if (
            !row.guard ||
            typeof row.guard !== 'object' ||
            Array.isArray(row.guard) ||
            Object.values(row.guard as object).some(
                (value) =>
                    !(
                        typeof value === 'boolean' ||
                        typeof value === 'string' ||
                        (Array.isArray(value) && value.every((item) => typeof item === 'string'))
                    )
            )
        )
            problems.push(`${label}: guard is invalid`);
        for (const field of ['reads', 'writes', 'inputs'] as const) {
            const values = row[field];
            if (!Array.isArray(values) || !values.every((value) => typeof value === 'string')) {
                problems.push(`${label}: ${field} must be a string array`);
                continue;
            }
            for (const value of values as string[])
                if (field === 'inputs' ? !INPUT.test(value) : !COLUMN.test(value))
                    problems.push(`${label}: invalid ${field} entry ${value}`);
        }
    });
    return problems;
}

function statesIn(text: string | undefined): string[] {
    return [...(text ?? '').matchAll(/`([A-Z][A-Z0-9_]*)`/g)].flatMap((match) =>
        match[1] ? [match[1]] : []
    );
}

/** Compare declared rows to the transition catalog and report omissions or drift. */
export function checkAnchoring(args: {
    readonly corpus: TransitionCorpus;
    readonly catalog: readonly CatalogTransition[];
    readonly machines?: readonly string[];
}): readonly string[] {
    const selected = args.machines ? new Set(args.machines) : undefined;
    const catalogRows = args.catalog.filter(
        (row) => row.id.startsWith('TRANS:') && (!selected || selected.has(row.machine))
    );
    const corpusRows = args.corpus.transitions.filter(
        (row) => !selected || selected.has(row.machine)
    );
    const byId = new Map(catalogRows.map((row) => [row.id, row]));
    const corpusIds = new Set(corpusRows.map((row) => row.id));
    const problems: string[] = [];
    for (const row of catalogRows)
        if (!corpusIds.has(row.id)) problems.push(`${row.id}: catalog row missing from corpus`);
    for (const row of corpusRows) {
        const source = byId.get(row.id);
        if (!source) {
            problems.push(`${row.id}: corpus row has no catalog heading`);
            continue;
        }
        if (source.machine !== row.machine)
            problems.push(
                `${row.id}: machine ${row.machine} does not match catalog section ${source.machine}`
            );
        const expectedFrom = statesIn(source.bullets.desde);
        if (
            expectedFrom.length
                ? JSON.stringify([...expectedFrom].sort()) !== JSON.stringify([...row.from].sort())
                : row.from.length !== 1 || !PSEUDO.test(row.from[0] ?? '')
        )
            problems.push(`${row.id}: from does not match catalog desde states`);
        const expectedTo = statesIn(source.bullets.hacia);
        const actualTo = PSEUDO.test(row.to) ? [] : [row.to];
        if (
            expectedTo.length
                ? JSON.stringify([...expectedTo].sort()) !== JSON.stringify([...actualTo].sort())
                : !PSEUDO.test(row.to)
        )
            problems.push(`${row.id}: to does not match catalog hacia states`);
    }
    return problems;
}

/** Return each distinct machine/from/event tuple shared by multiple rows. */
export function sharedPairs(args: { readonly corpus: TransitionCorpus }): readonly {
    readonly machine: string;
    readonly from: string;
    readonly event: string;
    readonly rows: readonly TransitionRow[];
}[] {
    const groups = new Map<
        string,
        { machine: string; from: string; event: string; rows: TransitionRow[] }
    >();
    const rows = args.corpus.transitions;
    const overlaps = (left: string, right: string): boolean => {
        if (left === '*NO_ROW' || right === '*NO_ROW') return left === right;
        if (PSEUDO.test(left) || PSEUDO.test(right)) return true;
        return left === right;
    };
    for (let leftIndex = 0; leftIndex < rows.length; leftIndex++) {
        const left = rows[leftIndex];
        if (!left) continue;
        for (let rightIndex = leftIndex + 1; rightIndex < rows.length; rightIndex++) {
            const right = rows[rightIndex];
            if (!right || left.machine !== right.machine) continue;
            for (const event of left.events) {
                if (!right.events.includes(event)) continue;
                for (const leftFrom of left.from)
                    for (const rightFrom of right.from) {
                        if (!overlaps(leftFrom, rightFrom)) continue;
                        const from =
                            leftFrom === '*NO_ROW'
                                ? '*NO_ROW'
                                : PSEUDO.test(leftFrom) && !PSEUDO.test(rightFrom)
                                  ? rightFrom
                                  : PSEUDO.test(rightFrom) && !PSEUDO.test(leftFrom)
                                    ? leftFrom
                                    : PSEUDO.test(leftFrom)
                                      ? leftFrom
                                      : rightFrom;
                        const key = `${left.machine}\0${from}\0${event}`;
                        const group = groups.get(key) ?? {
                            machine: left.machine,
                            from,
                            event,
                            rows: []
                        };
                        for (const row of [left, right])
                            if (!group.rows.some((item) => item.id === row.id))
                                group.rows.push(row);
                        groups.set(key, group);
                    }
            }
        }
    }
    return [...groups.values()].filter((group) => group.rows.length > 1);
}

/** Whether two guards have at least one common key with incompatible values. */
export function guardsDisjoint(args: {
    readonly a: TransitionRow['guard'];
    readonly b: TransitionRow['guard'];
}): boolean {
    for (const [key, left] of Object.entries(args.a)) {
        const right = args.b[key];
        if (right === undefined) continue;
        if (typeof left === 'boolean' && typeof right === 'boolean' && left !== right) return true;
        if (
            (typeof left === 'string' || Array.isArray(left)) &&
            (typeof right === 'string' || Array.isArray(right))
        ) {
            const a = new Set(typeof left === 'string' ? [left] : left);
            const b = typeof right === 'string' ? [right] : right;
            if (!b.some((value) => a.has(value))) return true;
        }
    }
    return false;
}
