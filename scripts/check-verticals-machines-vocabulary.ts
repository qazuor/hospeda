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

const VERTICALS = ['trial', 'publication', 'partner_application'] as const;
/** Return forbidden billing states named in one structured vocabulary value. */
export function forbiddenStateWords(args: {
    readonly value: string;
    readonly forbidden: ReadonlySet<string>;
}): readonly string[] {
    return [...args.forbidden].filter(
        (state) =>
            new RegExp(`\\b${state}\\b`, 'i').test(args.value) ||
            new RegExp(`\\bon_${state}\\b`, 'i').test(args.value)
    );
}
function flatten(value: unknown): string[] {
    if (typeof value === 'string' || typeof value === 'boolean') return [String(value)];
    if (Array.isArray(value)) return value.flatMap(flatten);
    return [];
}

/** GUARD:G-R4-B — vertical transition declarations avoid billing machine states. */
export function run(
    args: {
        readonly root?: string;
        readonly corpusPath?: string;
        readonly catalogPath?: string;
        readonly machines?: readonly string[];
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
            output: `FAIL GUARD:G-R4-B: cannot load corpus or catalog: ${error instanceof Error ? error.message : String(error)}`
        };
    }
    const shape = validateCorpus({ corpus });
    if (shape.length) return { exitCode: 1, output: `FAIL GUARD:G-R4-B:\n${shape.join('\n')}` };
    const anchored = checkAnchoring({ corpus, catalog, machines: args.machines });
    if (anchored.length)
        return { exitCode: 1, output: `FAIL GUARD:G-R4-B:\n${anchored.join('\n')}` };
    const verticalMachines = new Set(
        VERTICALS.filter((machine) => !args.machines || args.machines.includes(machine))
    );
    const stateSet = new Set(
        [...corpus.machines.subscription.states, ...corpus.machines.addon_instance.states].filter(
            (state) =>
                !Object.entries(corpus.machines).some(
                    ([machine, declaration]) =>
                        verticalMachines.has(machine as (typeof VERTICALS)[number]) &&
                        declaration.states.includes(state)
                )
        )
    );
    const columns = new Set(
        [
            corpus.machines.subscription.stateColumn,
            corpus.machines.addon_instance.stateColumn
        ].filter((value): value is string => value !== null)
    );
    const byId = new Map(catalog.map((row) => [row.id, row]));
    const violations: string[] = [];
    for (const row of corpus.transitions.filter((item) =>
        verticalMachines.has(item.machine as (typeof VERTICALS)[number])
    )) {
        const fields = [
            ...row.events,
            ...Object.keys(row.guard),
            ...Object.values(row.guard).flatMap(flatten),
            ...row.reads,
            ...row.inputs
        ];
        const badState = fields.flatMap((field) =>
            forbiddenStateWords({ value: field, forbidden: stateSet })
        );
        const badColumn = fields.flatMap((field) =>
            [...columns].filter((column) => field.includes(column))
        );
        for (const state of [...new Set(badState)])
            violations.push(`${row.id} structured names prohibited state ${state}`);
        for (const column of [...new Set(badColumn)])
            violations.push(`${row.id} structured names prohibited column ${column}`);
        const source = byId.get(row.id);
        const prose = ['evento', 'condición', 'nota'].flatMap((key) => {
            const text = source?.bullets[key] ?? '';
            const names = [...text.matchAll(/`([^`]+)`/g)].flatMap((match) =>
                match[1] ? [match[1]] : []
            );
            return names.flatMap((name) =>
                [...stateSet]
                    .filter((state) => name.toLowerCase() === state.toLowerCase())
                    .map((state) => `${state} in ${key}`)
            );
        });
        for (const item of [...new Set(prose)])
            violations.push(`${row.id} catalog prose names prohibited state ${item}`);
    }
    if (violations.length)
        return { exitCode: 1, output: `FAIL GUARD:G-R4-B:\n${violations.join('\n')}` };
    return {
        exitCode: 0,
        output: `OK GUARD:G-R4-B: checked ${verticalMachines.size} vertical machines.`
    };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
