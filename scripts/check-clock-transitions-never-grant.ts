/**
 * GUARD:G-R3-B — a clock-triggered transition never grants (AC:V5:20, cap. 17 section 3.4).
 *
 * Reads the declared transition corpus (`scripts/guards/transition-tables.json`), the transition
 * catalog it is anchored to, and the per-transition class declaration
 * (`scripts/guards/transition-classes.json`). The class is declared transition by transition and
 * never inferred (`V5.md:1061-1063`); the guard fails when a row of the trial, publication or
 * partner_application machines has no class, when a clock declaration does not quote its catalog
 * evento or cite its source, when an event-declared row names the passing of time in its catalog
 * evento, and when a clock-declared row enters a granting state or writes a coverage source.
 *
 * What it does NOT verify:
 * - The billing machines (subscription, payment, refund, manual_payment, addon_instance). Its
 *   domain is the three verticals machines the spec names (`04-catalogos.md:880`); a billing row
 *   whose evento names time (for example TRANS:B:S10) is a finding for the owner, not a check here.
 * - The code that implements the transitions (crons, services). It checks the declared tables,
 *   which is what the catalog says the guard reads (`04-catalogos.md:880-881`).
 * - The prose of each row's `efectos`/`nota`: only the corpus `to` states and `writes` columns.
 * - Who evaluates steps 5 to 7 for a clock-triggered transition (`V5.md:1058-1059`).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import {
    type CatalogTransition,
    checkAnchoring,
    type GuardResult,
    loadCorpus,
    parseCatalog,
    type TransitionCorpus,
    type TransitionRow,
    validateCorpus
} from './transition-corpus';

/** Repository-relative path to the declared class of every in-scope transition. */
export const CLASSES_PATH = 'scripts/guards/transition-classes.json';

/** Machines whose transitions G-R3-B classifies: the verticals machines (`04-catalogos.md:880`). */
export const G_R3_B_MACHINES = ['trial', 'publication', 'partner_application'] as const;

/** One of the machines in the guard's scope. */
export type GR3BMachine = (typeof G_R3_B_MACHINES)[number];

/**
 * States that give something when entered: an active trial, a published listing (which the spec
 * calls granting, `V5.md:1097-1098`) and an approved Partner application.
 */
export const GRANTING_STATES: Readonly<Record<GR3BMachine, readonly string[]>> = {
    trial: ['TRIAL_ACTIVE'],
    publication: ['PUBLISHED'],
    partner_application: ['APROBADA']
};

/**
 * Tables that are coverage sources: writing any of their columns grants (the spec's own example is
 * `T3` writing a source, `V5.md:1513-1514`).
 */
export const GRANTING_WRITE_TABLES = [
    'subscription',
    'courtesy_grant',
    'subscription_grant',
    'covered_period',
    'addon_instance',
    'canje_de_trial'
] as const;

/** Columns that open or extend a trial, which grants even though `trial` is not a source table. */
export const GRANTING_WRITE_COLUMNS = ['trial.started_at', 'trial.ends_at'] as const;

/** Catalog evento wording that names the passing of time. */
export const TIME_EVENT =
    /\b(?:llega|llegó)\s+(?:la|su|el)\s+(?:fecha|fin|día)\b|\bvence\b|\bse agota\b|\bplazo\b|\binactividad\b|\breloj\b/i;

/** A verified citation backing a clock declaration. */
export interface ClassSource {
    readonly path: string;
    readonly line: number;
    readonly quote: string;
}

/** One declared class entry of `transition-classes.json`. */
export interface ClassEntry {
    readonly id: string;
    readonly class: 'clock' | 'event';
    readonly clause?: string;
    readonly source?: ClassSource;
}

/** The checked-in class declaration. */
export interface ClassDeclaration {
    readonly transitions: readonly ClassEntry[];
}

/** Return the reasons a transition grants; an empty list means it does not grant. */
export function clockGrants(args: { readonly row: TransitionRow }): readonly string[] {
    const { row } = args;
    const granting = GRANTING_STATES[row.machine as GR3BMachine] ?? [];
    const destinations = Array.isArray(row.to) ? row.to : [row.to];
    const entered = destinations
        .filter((state) => granting.includes(state) && !row.from.includes(state))
        .map((state) => `enters ${state}`);
    const written = row.writes
        .filter((column) => {
            const table = column.split('.')[0] ?? '';
            return (
                GRANTING_WRITE_TABLES.includes(table as (typeof GRANTING_WRITE_TABLES)[number]) ||
                GRANTING_WRITE_COLUMNS.includes(column as (typeof GRANTING_WRITE_COLUMNS)[number])
            );
        })
        .map((column) => `writes ${column}`);
    return [...entered, ...written];
}

/** Return the problem with a clock entry's citation, or undefined when it resolves. */
export function sourceProblem(args: {
    readonly root: string;
    readonly entry: ClassEntry;
}): string | undefined {
    const { entry } = args;
    const source = entry.source;
    if (!source || typeof source !== 'object') return 'has no source';
    if (typeof source.path !== 'string' || typeof source.quote !== 'string')
        return 'source path and quote must be strings';
    const base = resolve(args.root);
    const file = resolve(base, source.path);
    const rel = relative(base, file);
    if (!rel || rel.startsWith('..')) return `source ${source.path} is not under the root`;
    if (!existsSync(file)) return `source ${source.path} does not exist`;
    const line = readFileSync(file, 'utf8').split(/\r?\n/)[source.line - 1];
    if (!Number.isInteger(source.line) || line === undefined)
        return `source ${source.path}:${String(source.line)} does not exist`;
    if (!line.includes(source.quote))
        return `source ${source.path}:${source.line} does not contain "${source.quote}"`;
    const short = `\`${entry.id.split(':')[2] ?? ''}\``;
    if (!source.quote.includes(short)) return `source quote does not name ${short}`;
    return undefined;
}

/** Return the class problems of the declaration against the in-scope rows. */
function declarationProblems(args: {
    readonly root: string;
    readonly rows: readonly TransitionRow[];
    readonly entries: readonly unknown[];
    readonly catalogById: ReadonlyMap<string, CatalogTransition>;
}): { readonly problems: readonly string[]; readonly clock: readonly TransitionRow[] } {
    const problems: string[] = [];
    const rowsById = new Map(args.rows.map((row) => [row.id, row]));
    const declared = new Map<string, ClassEntry>();
    for (const raw of args.entries) {
        const entry = raw as Partial<ClassEntry> | null;
        const id = entry && typeof entry.id === 'string' ? entry.id : JSON.stringify(raw);
        if (!entry || typeof entry.id !== 'string' || !rowsById.has(entry.id))
            problems.push(`unknown: ${id} is not a transition of ${G_R3_B_MACHINES.join(', ')}`);
        else if (declared.has(entry.id)) problems.push(`unknown: ${id} is declared more than once`);
        else if (entry.class !== 'clock' && entry.class !== 'event')
            problems.push(`unknown: ${id} has class ${String(entry.class)}, not clock or event`);
        else declared.set(entry.id, entry as ClassEntry);
    }
    const clock: TransitionRow[] = [];
    for (const row of args.rows) {
        const entry = declared.get(row.id);
        if (!entry) {
            problems.push(`undeclared: ${row.id} (${row.machine}) has no class in ${CLASSES_PATH}`);
            continue;
        }
        const evento = args.catalogById.get(row.id)?.bullets.evento ?? '';
        if (entry.class === 'event') {
            const time = TIME_EVENT.exec(evento)?.[0];
            if (time)
                problems.push(
                    `undeclared clock: ${row.id} is declared event but its catalog evento names the passing of time ("${time}")`
                );
            continue;
        }
        clock.push(row);
        if (typeof entry.clause !== 'string' || !entry.clause || !evento.includes(entry.clause))
            problems.push(
                `clause: ${row.id} (${row.machine}, clock) clause is not a literal fragment of its catalog evento`
            );
        const source = sourceProblem({ root: args.root, entry });
        if (source) problems.push(`source: ${row.id} (${row.machine}, clock) ${source}`);
        const grants = clockGrants({ row });
        if (grants.length)
            problems.push(
                `grants: ${row.id} (${row.machine}, clock) ${grants.join(', ')}: a clock-triggered transition grants instead of taking away`
            );
    }
    return { problems, clock };
}

/**
 * Run GUARD:G-R3-B over the corpus, the catalog and the class declaration under `root`.
 * Reports every problem found, one `FAIL` line each.
 */
export function run(
    args: {
        readonly root?: string;
        readonly corpusPath?: string;
        readonly catalogPath?: string;
        readonly classesPath?: string;
    } = {}
): GuardResult {
    const root = args.root ?? process.cwd();
    let corpus: TransitionCorpus;
    let catalog: readonly CatalogTransition[];
    let classes: ClassDeclaration;
    try {
        corpus = loadCorpus({ root, corpusPath: args.corpusPath });
        catalog = parseCatalog({ root, catalogPath: args.catalogPath });
        classes = JSON.parse(
            readFileSync(join(root, args.classesPath ?? CLASSES_PATH), 'utf8')
        ) as ClassDeclaration;
    } catch (error) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-R3-B: cannot load corpus, catalog or classes: ${error instanceof Error ? error.message : String(error)}`
        };
    }
    const shape = validateCorpus({ corpus });
    if (shape.length) return { exitCode: 1, output: `FAIL GUARD:G-R3-B: ${shape.join('; ')}` };
    const anchored = checkAnchoring({ corpus, catalog, machines: G_R3_B_MACHINES });
    if (anchored.length)
        return { exitCode: 1, output: `FAIL GUARD:G-R3-B: ${anchored.join('; ')}` };
    const problems: string[] = [];
    for (const machine of G_R3_B_MACHINES) {
        if (!corpus.machines[machine]) problems.push(`required machine ${machine} is not declared`);
        else if (!corpus.transitions.some((row) => row.machine === machine))
            problems.push(`required machine ${machine} has no transition rows`);
    }
    const entries: unknown = classes && typeof classes === 'object' ? classes.transitions : null;
    if (!Array.isArray(entries))
        return {
            exitCode: 1,
            output: `FAIL GUARD:G-R3-B: ${CLASSES_PATH} must have a transitions array`
        };
    const rows = corpus.transitions.filter((row) =>
        G_R3_B_MACHINES.includes(row.machine as GR3BMachine)
    );
    const catalogById = new Map(catalog.map((row) => [row.id, row]));
    const declared = declarationProblems({ root, rows, entries, catalogById });
    problems.push(...declared.problems);
    if (!declared.clock.length)
        problems.push('no transition is declared clock: the guard would watch nothing');
    if (problems.length)
        return {
            exitCode: 1,
            output: problems.map((problem) => `FAIL GUARD:G-R3-B: ${problem}`).join('\n')
        };
    const clockIds = declared.clock.map((row) => row.id.split(':')[2]).join(', ');
    return {
        exitCode: 0,
        output: `OK GUARD:G-R3-B: ${rows.length} transitions of ${G_R3_B_MACHINES.join(', ')} declared (${declared.clock.length} clock: ${clockIds}; ${rows.length - declared.clock.length} event); no clock-triggered transition enters a granting state or writes a coverage source`
    };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
