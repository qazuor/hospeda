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

/** GUARD:G-R6 — every declared read column has a writer in the complete corpus.
 * What it does NOT verify: `inputs` are contract/catalog/provider/clock/config facts, not columns.
 */
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
            output: `FAIL GUARD:G-R6: cannot load corpus or catalog: ${error instanceof Error ? error.message : String(error)}`
        };
    }
    const shape = validateCorpus({ corpus });
    if (shape.length) return { exitCode: 1, output: `FAIL GUARD:G-R6:\n${shape.join('\n')}` };
    const anchored = checkAnchoring({ corpus, catalog, machines: args.machines });
    if (anchored.length) return { exitCode: 1, output: `FAIL GUARD:G-R6:\n${anchored.join('\n')}` };
    const rows = corpus.transitions.filter(
        (row) => !args.machines || args.machines.includes(row.machine)
    );
    const written = new Set(corpus.transitions.flatMap((row) => row.writes));
    const violations = rows.flatMap((row) =>
        row.reads
            .filter((column) => !written.has(column))
            .map((column) => `${row.id} reads unwritten column ${column}`)
    );
    if (violations.length)
        return { exitCode: 1, output: `FAIL GUARD:G-R6:\n${violations.join('\n')}` };
    return {
        exitCode: 0,
        output: `OK GUARD:G-R6: verified ${rows.reduce((count, row) => count + row.reads.length, 0)} read columns.`
    };
}

if (process.argv[1] && import.meta.url === `file://${resolve(process.argv[1])}`) {
    const result = run();
    (result.exitCode === 0 ? console.log : console.error)(result.output);
    process.exit(result.exitCode);
}
