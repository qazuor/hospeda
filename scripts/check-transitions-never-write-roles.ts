import { resolve } from 'node:path';
import {
    type CatalogTransition,
    checkAnchoring,
    type GuardResult,
    loadCorpus,
    parseCatalog,
    type TransitionCorpus,
    validateCorpus
} from './transition-corpus';

/** Database tables whose writes change role assignments or role permissions. */
export const ROLE_TABLES = ['user_role', 'user_role_audit', 'role_permission'] as const;
/** Subscription and trial machines, including their declared sub-states. */
export const G4_MACHINES = ['trial', 'subscription'] as const;

/** Return G4 machines and every corpus machine declared as their sub-state. */
export function machinesInScope(args: { readonly corpus: TransitionCorpus }): readonly string[] {
    const parents = new Set<string>(G4_MACHINES);
    return Object.entries(args.corpus.machines)
        .filter(
            ([name, machine]) =>
                parents.has(name) ||
                (machine.subStateOf !== null && parents.has(machine.subStateOf))
        )
        .map(([name]) => name);
}

/** Return whether a transition write targets a role table or a user role column. */
export function roleWrite(args: { readonly column: string }): boolean {
    const [table, column] = args.column.split('.');
    if (!table || !column) return false;
    return (
        ROLE_TABLES.includes(table as (typeof ROLE_TABLES)[number]) ||
        ((table === 'user' || table === 'users') && (column === 'role' || column === 'roles'))
    );
}

/** Return role-related whole-word matches in catalog prose. */
export function roleProse(args: { readonly text: string }): readonly string[] {
    const patterns = [/\broles?\b/gi, /\brol(?:es)?\b/gi];
    const matches = patterns.flatMap((pattern) =>
        [...args.text.matchAll(pattern)].map((match) => match[0])
    );
    const tables = ROLE_TABLES.flatMap((table) =>
        [...args.text.matchAll(new RegExp(`\\b${table}\\b`, 'gi'))].map((match) => match[0])
    );
    return [...new Set([...matches, ...tables])];
}

/**
 * GUARD:G4 — checks declared subscription/trial transition writes and effect prose.
 *
 * What it does NOT verify:
 * - It does not inspect the publication or Partner application machines.
 * - It checks declared transition effects, not implementation code.
 * - It does not treat user_permission overrides as roles.
 */
export function run(
    args: {
        readonly root?: string;
        readonly corpusPath?: string;
        readonly catalogPath?: string;
    } = {}
): GuardResult {
    const root = args.root ?? process.cwd();
    let corpus: TransitionCorpus;
    let catalog: readonly CatalogTransition[];
    try {
        corpus = loadCorpus({ root, corpusPath: args.corpusPath });
        catalog = parseCatalog({ root, catalogPath: args.catalogPath });
    } catch (error) {
        return {
            exitCode: 1,
            output: `FAIL GUARD:G4: cannot load corpus or catalog: ${error instanceof Error ? error.message : String(error)}`
        };
    }
    const shape = validateCorpus({ corpus });
    if (shape.length) return { exitCode: 1, output: `FAIL GUARD:G4: ${shape.join('; ')}` };
    const anchored = checkAnchoring({ corpus, catalog });
    if (anchored.length) return { exitCode: 1, output: `FAIL GUARD:G4: ${anchored.join('; ')}` };
    for (const machine of G4_MACHINES) {
        if (!corpus.machines[machine])
            return {
                exitCode: 1,
                output: `FAIL GUARD:G4: required machine ${machine} is not declared`
            };
        if (!corpus.transitions.some((row) => row.machine === machine))
            return {
                exitCode: 1,
                output: `FAIL GUARD:G4: required machine ${machine} has no transition rows`
            };
    }
    const scope = machinesInScope({ corpus });
    const scopedRows = corpus.transitions.filter((row) => scope.includes(row.machine));
    const catalogById = new Map(catalog.map((row) => [row.id, row]));
    for (const row of scopedRows) {
        const write = row.writes.find((column) => roleWrite({ column }));
        if (write)
            return {
                exitCode: 1,
                output: `FAIL GUARD:G4: structured: ${row.id} (${row.machine}) writes ${write}: a subscription or trial transition writes roles`
            };
    }
    for (const row of scopedRows) {
        const effect = catalogById.get(row.id)?.bullets.efectos ?? '';
        const match = roleProse({ text: effect })[0];
        if (match)
            return {
                exitCode: 1,
                output: `FAIL GUARD:G4: catalog prose: ${row.id} (${row.machine}) effects mention "${match}": a declared effect mentions a role`
            };
    }
    const subStates = scope.filter(
        (machine) => !G4_MACHINES.includes(machine as (typeof G4_MACHINES)[number])
    );
    const suffix = subStates.length ? ` (+ ${subStates.join(', ')})` : '';
    return {
        exitCode: 0,
        output: `OK GUARD:G4: ${scopedRows.length} transitions of trial, subscription${suffix} checked; none writes user_role, user_role_audit, role_permission or user(s).role(s), and no declared effect mentions a role`
    };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
