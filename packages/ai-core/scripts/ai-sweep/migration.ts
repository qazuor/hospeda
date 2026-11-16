/**
 * HOS-2217 model-migration sweep: compares candidate models across EVERY AI
 * feature (chat, chat_venue, chat_experience, search, translate, text_improve,
 * post_generate, accommodation_import, faq_draft, support) with one command.
 *
 * DRY-RUN BY DEFAULT: without `--execute` it makes no network call; it prints
 * the call count and the worst-case cost per feature and in total. With
 * `--execute` it refuses to start without the provider keys. Run from
 * `packages/ai-core` (see README.md, "Model migration").
 *
 * @module ai-core/scripts/ai-sweep/migration
 */

import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAI } from '@ai-sdk/openai';
import { generateObject, generateText, jsonSchema, streamText } from 'ai';
import { MODEL_RATES } from '../../src/usage/model-rates.js';
import { type BlindKey, ingestGrades } from './blind.js';
import { estimateCostUsd, type Grade, resolveRates, resultKey, type UsdRates } from './lib.js';
import { loadMigrationCases } from './load-cases.js';
import {
    expandMigrationMatrix,
    type MigrationCall,
    type MigrationConfig,
    MigrationConfigSchema,
    type MigrationResult,
    planCalls,
    type RunnableCase,
    recheckResults,
    renderPlanMarkdown,
    selectCases
} from './migration-lib.js';
import { aggregateMigration, renderMigrationReport } from './migration-report.js';
import { toSdkCallOptions } from './provider-call.js';

const HERE = dirname(fileURLToPath(import.meta.url));

type OpenAiProvider = ReturnType<typeof createOpenAI>;

interface CliArgs {
    readonly execute: boolean;
    readonly configPath: string;
    readonly outDir: string;
    readonly features: readonly string[] | null;
    readonly maxCalls: number | null;
    readonly concurrency: number | null;
    readonly apiKeyFile: string | null;
    readonly blindExport: string | null;
    readonly gradesPath: string | null;
    readonly keyPath: string | null;
    readonly resultsPath: string | null;
}

function parseArgs(argv: readonly string[]): CliArgs {
    const value = (flag: string): string | null => {
        const i = argv.indexOf(flag);
        return i >= 0 ? (argv[i + 1] ?? null) : null;
    };
    const path = (flag: string): string | null => {
        const v = value(flag);
        return v === null ? null : resolve(v);
    };
    const num = (flag: string): number | null => {
        const v = value(flag);
        return v === null ? null : Number(v);
    };
    const features = value('--features');
    return {
        execute: argv.includes('--execute') && !argv.includes('--dry-run'),
        configPath: resolve(value('--config') ?? resolve(HERE, 'sweep.config.migration.json')),
        outDir: resolve(value('--out') ?? resolve(HERE, 'out')),
        features: features === null ? null : features.split(',').map((f) => f.trim()),
        maxCalls: num('--max-calls'),
        concurrency: num('--concurrency'),
        apiKeyFile: path('--api-key-file'),
        blindExport: path('--blind-export'),
        gradesPath: path('--grades'),
        keyPath: path('--key'),
        resultsPath: path('--results')
    };
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const config = MigrationConfigSchema.parse(JSON.parse(readFileSync(args.configPath, 'utf8')));
    const { selected } = selectCases({
        config,
        cases: loadMigrationCases({ dir: HERE }).cases,
        onlyFeatures: args.features
    });
    if (args.resultsPath) {
        runOffline({ args, config, cases: selected });
        return;
    }
    const warnings = new Set<string>();
    const ratesFor = (model: string): UsdRates | null => {
        const override = config.models.find((m) => m.id === model)?.rates;
        const rates = resolveRates({ model, override, table: MODEL_RATES });
        if (!rates)
            warnings.add(`No rate for model "${model}": its cost is unknown (add "rates").`);
        return rates;
    };
    const { calls } = expandMigrationMatrix({ config, cases: selected });
    const maxCalls = args.maxCalls ?? config.maxCalls;
    const concurrency = args.concurrency ?? config.concurrency;
    const variants = [...new Set(calls.map((c) => c.variantKey))];
    console.log(`Mode: ${args.execute ? 'EXECUTE' : 'DRY-RUN (no network calls)'}`);
    console.log(`Config: ${args.configPath}`);
    console.log(`Variants (model | effort), first = baseline: ${variants.join(', ')}`);
    console.log(`Cases: ${selected.length}; repetitions: ${config.repetitions}`);
    console.log(
        'Worst case: every call hits its output cap; input approximated at 4 chars/token.\n'
    );
    console.log(renderPlanMarkdown(planCalls({ calls, ratesFor })));
    console.log(
        `\nTotal calls: ${calls.length} (hard cap ${maxCalls}, concurrency ${concurrency})`
    );
    for (const w of warnings) console.warn(`WARNING: ${w}`);
    if (calls.length > maxCalls) {
        console.error(`ABORT: ${calls.length} calls exceeds the hard cap of ${maxCalls}.`);
        process.exit(2);
    }
    if (!args.execute) {
        console.log('Dry run only. Pass --execute to call the providers.');
        return;
    }
    const providers = new Map<string, OpenAiProvider>();
    for (const id of new Set(calls.map((c) => c.provider))) {
        const def = config.providers.find((p) => p.id === id);
        if (!def) {
            console.error(`ABORT: model references unknown provider "${id}".`);
            process.exit(2);
        }
        // The key is never logged, echoed or measured.
        const apiKey = args.apiKeyFile
            ? readFileSync(args.apiKeyFile, 'utf8').trim()
            : process.env[def.apiKeyEnv];
        if (!apiKey) {
            console.error(
                `ABORT: no key for provider "${id}" (${def.apiKeyEnv} or --api-key-file).`
            );
            process.exit(2);
        }
        providers.set(
            id,
            createOpenAI({ apiKey, ...(def.baseURL ? { baseURL: def.baseURL } : {}) })
        );
    }
    void runAll({ calls, concurrency, providers, cases: selected, config, args, ratesFor });
}

async function runOne(input: {
    readonly call: MigrationCall;
    readonly provider: OpenAiProvider;
    readonly hasBaseUrl: boolean;
    readonly runnable: RunnableCase;
    readonly rates: UsdRates | null;
}): Promise<MigrationResult> {
    const { call, runnable } = input;
    const model = input.hasBaseUrl ? input.provider.chat(call.model) : input.provider(call.model);
    const { options } = toSdkCallOptions({
        providerRequest: call.request,
        fallbackMaxOutputTokens: call.maxOutputTokens
    });
    const { prompt, messages, ...rest } = options;
    const common = { model, ...rest, maxRetries: 1 };
    const start = performance.now();
    let ttftMs: number | null = null;
    let text = '';
    let object: unknown;
    let error: string | null = null;
    let finishReason = 'error';
    let usage: { inputTokens?: number; outputTokens?: number; reasoningTokens?: number } = {};
    try {
        if (runnable.mode === 'object') {
            if (prompt === undefined || runnable.outputSchema === null) {
                throw new Error('object call without prompt or output schema');
            }
            const r = await generateObject({
                ...common,
                prompt,
                schema: jsonSchema(runnable.outputSchema as Parameters<typeof jsonSchema>[0])
            });
            object = r.object;
            text = JSON.stringify(r.object);
            finishReason = r.finishReason;
            usage = { ...r.usage, reasoningTokens: r.usage.outputTokenDetails?.reasoningTokens };
        } else if (runnable.stream) {
            const r =
                prompt === undefined
                    ? streamText({ ...common, messages: [...(messages ?? [])] })
                    : streamText({ ...common, prompt });
            for await (const part of r.fullStream) {
                if (part.type === 'text-delta') {
                    if (ttftMs === null) ttftMs = performance.now() - start;
                    text += part.text;
                } else if (part.type === 'error') {
                    error = part.error instanceof Error ? part.error.message : String(part.error);
                }
            }
            if (error === null) {
                const u = await r.usage;
                finishReason = await r.finishReason;
                usage = { ...u, reasoningTokens: u.outputTokenDetails?.reasoningTokens };
            }
        } else {
            const r =
                prompt === undefined
                    ? await generateText({ ...common, messages: [...(messages ?? [])] })
                    : await generateText({ ...common, prompt });
            text = r.text;
            finishReason = r.finishReason;
            usage = { ...r.usage, reasoningTokens: r.usage.outputTokenDetails?.reasoningTokens };
        }
    } catch (e) {
        error = e instanceof Error ? e.message : String(e);
    }
    const inputTokens = usage.inputTokens ?? 0;
    const outputTokens = usage.outputTokens ?? 0;
    return {
        variantKey: call.variantKey,
        model: call.model,
        effort: call.effort,
        feature: call.feature,
        caseId: call.caseId,
        repetition: call.repetition,
        maxOutputTokens: call.maxOutputTokens,
        text,
        ...(object === undefined ? {} : { object }),
        finishReason: error === null ? finishReason : 'error',
        inputTokens,
        outputTokens,
        reasoningTokens: usage.reasoningTokens ?? 0,
        ttftMs,
        latencyMs: performance.now() - start,
        costUsd: estimateCostUsd({ inputTokens, outputTokens, rates: input.rates }),
        error,
        outcome: error === null ? runnable.check({ text, object }) : null
    };
}

async function runAll(input: {
    readonly calls: readonly MigrationCall[];
    readonly concurrency: number;
    readonly providers: ReadonlyMap<string, OpenAiProvider>;
    readonly cases: readonly RunnableCase[];
    readonly config: MigrationConfig;
    readonly args: CliArgs;
    readonly ratesFor: (model: string) => UsdRates | null;
}): Promise<void> {
    mkdirSync(input.args.outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonlPath = resolve(input.args.outDir, `migration-${stamp}.jsonl`);
    const byId = new Map(input.cases.map((c) => [c.id, c]));
    const results: MigrationResult[] = [];
    let cursor = 0;
    const worker = async (): Promise<void> => {
        while (cursor < input.calls.length) {
            const call = input.calls[cursor++];
            if (!call) return;
            const provider = input.providers.get(call.provider);
            const runnable = byId.get(call.caseId);
            if (!provider || !runnable) continue;
            const result = await runOne({
                call,
                provider,
                hasBaseUrl: Boolean(
                    input.config.providers.find((p) => p.id === call.provider)?.baseURL
                ),
                runnable,
                rates: input.ratesFor(call.model)
            });
            results.push(result);
            writeFileSync(jsonlPath, `${JSON.stringify(result)}\n`, { flag: 'a' });
            console.log(
                `[${results.length}/${input.calls.length}] ${call.variantKey} ${call.caseId} ` +
                    `${result.finishReason} ${Math.round(result.latencyMs)}ms${result.error ? ` ERROR ${result.error}` : ''}`
            );
        }
    };
    await Promise.all(Array.from({ length: input.concurrency }, worker));
    writeReport({
        results,
        config: input.config,
        mdPath: jsonlPath.replace(/\.jsonl$/, '.md'),
        grades: undefined
    });
    console.log(`Raw: ${jsonlPath}`);
    if (input.args.blindExport)
        writeBlind({ path: input.args.blindExport, results, cases: input.cases });
}

function writeReport(input: {
    readonly results: readonly MigrationResult[];
    readonly config: MigrationConfig;
    readonly mdPath: string;
    readonly grades: Readonly<Record<string, Grade>> | undefined;
}): void {
    const md = renderMigrationReport(
        aggregateMigration({ results: input.results, config: input.config, grades: input.grades })
    );
    const errors = input.results.filter((r) => r.error !== null);
    const errorLines = errors.slice(0, 20).map((r) => `- ${r.variantKey} ${r.caseId}: ${r.error}`);
    const text = `# Model migration sweep\n\nMonthly volumes come from the config (owner input), not from production.\n\n${md}\n${errors.length ? `\n## Provider errors (${errors.length}, first 20)\n\n${errorLines.join('\n')}\n` : ''}`;
    writeFileSync(input.mdPath, text);
    console.log(`\n${text}\nSummary: ${input.mdPath}`);
}

/** Writes the blind JSONL (no model/effort) plus its key file (`<path>.key.json`). */
function writeBlind(input: {
    readonly path: string;
    readonly results: readonly MigrationResult[];
    readonly cases: readonly RunnableCase[];
}): void {
    const salt = randomBytes(8).toString('hex');
    const byId = new Map(input.cases.map((c) => [c.id, c]));
    const key: Record<string, BlindKey[string]> = {};
    const entries = input.results.flatMap((r) => {
        const c = byId.get(r.caseId);
        if (!c || r.error !== null) return [];
        const id = createHash('sha256')
            .update(`${salt}|${resultKey(r)}`)
            .digest('hex')
            .slice(0, 10);
        key[id] = { variantKey: r.variantKey, caseId: r.caseId, repetition: r.repetition };
        return [
            { id, feature: r.feature, caseId: r.caseId, ...c.grading, answer: r.object ?? r.text }
        ];
    });
    entries.sort((a, b) => a.id.localeCompare(b.id));
    mkdirSync(dirname(input.path), { recursive: true });
    writeFileSync(
        input.path,
        entries.map((e) => JSON.stringify(e)).join('\n') + (entries.length ? '\n' : '')
    );
    writeFileSync(`${input.path}.key.json`, `${JSON.stringify(key, null, 2)}\n`);
    console.log(
        `Blind export: ${input.path} (${entries.length} answers). Key (keep it from the grader): ${input.path}.key.json`
    );
}

function loadGrades(args: CliArgs): Record<string, Grade> | undefined {
    if (!args.gradesPath) return undefined;
    const keyPath = args.keyPath ?? (args.blindExport ? `${args.blindExport}.key.json` : null);
    if (!keyPath) {
        console.error('ABORT: --grades needs --key <key.json> (written by --blind-export).');
        process.exit(2);
    }
    const { grades, unknownIds } = ingestGrades({
        grades: JSON.parse(readFileSync(args.gradesPath, 'utf8')),
        key: JSON.parse(readFileSync(keyPath, 'utf8')) as BlindKey
    });
    console.log(`Grades merged: ${Object.keys(grades).length}`);
    if (unknownIds.length > 0)
        console.warn(`WARNING: unknown grade ids ignored: ${unknownIds.join(', ')}`);
    return grades;
}

/** Offline mode: re-check, re-report or blind-export an existing JSONL. Never touches the network. */
function runOffline(input: {
    readonly args: CliArgs;
    readonly config: MigrationConfig;
    readonly cases: readonly RunnableCase[];
}): void {
    const source = input.args.resultsPath ?? '';
    const stored = readFileSync(source, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as MigrationResult);
    const { results } = recheckResults({ results: stored, cases: input.cases });
    console.log(`Offline mode: ${results.length} results from ${source}`);
    if (input.args.blindExport)
        writeBlind({ path: input.args.blindExport, results, cases: input.cases });
    if (input.args.gradesPath || !input.args.blindExport) {
        writeReport({
            results,
            config: input.config,
            mdPath: `${source.replace(/\.jsonl$/, '')}.report.md`,
            grades: loadGrades(input.args)
        });
    }
}

main();
