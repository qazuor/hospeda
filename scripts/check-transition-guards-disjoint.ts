import { resolve } from 'node:path';
import {
    type CatalogTransition,
    checkAnchoring,
    type GuardResult,
    guardsDisjoint,
    loadCorpus,
    parseCatalog,
    sharedPairs,
    type TransitionCorpus,
    validateCorpus
} from './transition-corpus';

/** GUARD:G-R4 — disjoint guards for rows sharing a machine, origin, and event. */
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
            output: `FAIL GUARD:G-R4: cannot load corpus or catalog: ${error instanceof Error ? error.message : String(error)}`
        };
    }
    const shape = validateCorpus({ corpus });
    if (shape.length) return { exitCode: 1, output: `FAIL GUARD:G-R4:\n${shape.join('\n')}` };
    const anchored = checkAnchoring({ corpus, catalog, machines: args.machines });
    if (anchored.length) return { exitCode: 1, output: `FAIL GUARD:G-R4:\n${anchored.join('\n')}` };
    const shared = sharedPairs({ corpus }).filter(
        (pair) => !args.machines || args.machines.includes(pair.machine)
    );
    const violations: string[] = [];
    for (const pair of shared)
        for (let i = 0; i < pair.rows.length; i++)
            for (let j = i + 1; j < pair.rows.length; j++) {
                const a = pair.rows[i];
                const b = pair.rows[j];
                if (a && b && !guardsDisjoint({ a: a.guard, b: b.guard }))
                    violations.push(
                        `${a.id}/${b.id} share (${pair.machine}, ${pair.from}, ${pair.event}) without disjoint guards`
                    );
            }
    if (violations.length)
        return { exitCode: 1, output: `FAIL GUARD:G-R4:\n${violations.join('\n')}` };
    const listed = shared.map(
        (pair) =>
            `${pair.rows.map((row) => row.id).join('/')} (${pair.machine}, ${pair.from}, ${pair.event})`
    );
    return {
        exitCode: 0,
        output: `OK GUARD:G-R4: shared pairs: ${listed.join(', ') || 'none'}; count ${shared.length}.`
    };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
