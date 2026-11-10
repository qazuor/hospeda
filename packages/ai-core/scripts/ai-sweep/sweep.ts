/**
 * HOS-2095 model and parameter sweep for the AI chat feature.
 *
 * DRY-RUN BY DEFAULT: without `--execute` this script makes no network call.
 * With `--execute` it refuses to start unless every provider it needs has its
 * API key env var set. Run from `packages/ai-core` (see README.md).
 *
 * @module ai-core/scripts/ai-sweep/sweep
 */

import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { MODEL_RATES } from '../../src/usage/model-rates.js';
import { type BlindKey, buildBlindExport, entriesToJsonl, ingestGrades } from './blind.js';
import {
    aggregateResults,
    approxTokens,
    type CallResult,
    estimateCostUsd,
    expandMatrix,
    FixtureFileSchema,
    GeneratedFileSchema,
    type Grade,
    joinGeneratedCases,
    type PlannedCall,
    type PromptCase,
    RULE_IDS,
    renderErrorSummary,
    renderSummaryMarkdown,
    resolveRates,
    runRule,
    type SweepConfig,
    SweepConfigSchema,
    type UsdRates
} from './lib.js';
import { checkAnswer } from './quality.js';

const HERE = dirname(fileURLToPath(import.meta.url));

type OpenAiProvider = ReturnType<typeof createOpenAI>;

interface CliArgs {
    readonly execute: boolean;
    readonly configPath: string;
    readonly outDir: string;
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
    const num = (flag: string): number | null => {
        const v = value(flag);
        return v === null ? null : Number(v);
    };
    const path = (flag: string): string | null => {
        const v = value(flag);
        return v === null ? null : resolve(v);
    };
    return {
        execute: argv.includes('--execute') && !argv.includes('--dry-run'),
        configPath: resolve(value('--config') ?? resolve(HERE, 'sweep.config.example.json')),
        outDir: resolve(value('--out') ?? resolve(HERE, 'out')),
        maxCalls: num('--max-calls'),
        concurrency: num('--concurrency'),
        apiKeyFile: path('--api-key-file'),
        blindExport: path('--blind-export'),
        gradesPath: path('--grades'),
        keyPath: path('--key'),
        resultsPath: path('--results')
    };
}

/**
 * Loads the cases joined with their generated contexts. The system message of
 * each case is the exact text production sends (see README, "Contexts").
 */
function loadCases(): PromptCase[] {
    const fixtures = FixtureFileSchema.parse(
        JSON.parse(readFileSync(resolve(HERE, 'fixtures.json'), 'utf8'))
    );
    const generated = GeneratedFileSchema.parse(
        JSON.parse(readFileSync(resolve(HERE, 'contexts.generated.json'), 'utf8'))
    );
    return joinGeneratedCases({ fixtures: fixtures.cases, generated });
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const config = SweepConfigSchema.parse(JSON.parse(readFileSync(args.configPath, 'utf8')));
    const cases = loadCases();
    if (args.resultsPath) {
        runOffline({ args, config, cases });
        return;
    }
    const maxCalls = args.maxCalls ?? config.maxCalls;
    const concurrency = args.concurrency ?? config.concurrency;
    const calls = expandMatrix({ config, cases });
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const systemById = new Map(cases.map((c) => [c.id, c.system]));
    const warnings: string[] = [];

    const ratesFor = (model: string): UsdRates | null => {
        const override = config.models.find((m) => m.id === model)?.rates;
        const rates = resolveRates({ model, override, table: MODEL_RATES });
        if (!rates && !warnings.some((w) => w.includes(`"${model}"`))) {
            warnings.push(
                `No rate for model "${model}": cost will be null (add "rates" to the config).`
            );
        }
        return rates;
    };

    // ---- Matrix + worst-case estimate (always printed) ----
    const perVariant = new Map<string, number>();
    let worstCaseUsd = 0;
    let worstCaseKnown = true;
    let worstInputTokens = 0;
    let worstOutputTokens = 0;
    for (const call of calls) {
        perVariant.set(call.variantKey, (perVariant.get(call.variantKey) ?? 0) + 1);
        const inTok =
            approxTokens(systemById.get(call.caseId) ?? '') +
            approxTokens(caseById.get(call.caseId)?.question ?? '');
        worstInputTokens += inTok;
        worstOutputTokens += call.maxOutputTokens;
        const cost = estimateCostUsd({
            inputTokens: inTok,
            outputTokens: call.maxOutputTokens,
            rates: ratesFor(call.model)
        });
        if (cost === null) worstCaseKnown = false;
        else worstCaseUsd += cost;
    }
    console.log(`Mode: ${args.execute ? 'EXECUTE' : 'DRY-RUN (no network calls)'}`);
    console.log(`Config: ${args.configPath}`);
    console.log(
        `Cases (${new Set(calls.map((c) => c.caseId)).size}): ${[...new Set(calls.map((c) => c.caseId))].join(', ')}`
    );
    console.log(`Matrix variants (model | effort | cap): ${perVariant.size}`);
    for (const [key, n] of perVariant) console.log(`  ${key}  x${n} calls`);
    console.log(`Total calls: ${calls.length} (hard cap ${maxCalls}, concurrency ${concurrency})`);
    const costLabel = worstCaseKnown
        ? `$${worstCaseUsd.toFixed(4)}`
        : `>= $${worstCaseUsd.toFixed(4)} (some models have no rate)`;
    console.log(
        `Worst case (every call hits its cap; input approximated at 4 chars/token): ` +
            `${worstInputTokens} input tokens, ${worstOutputTokens} output tokens, cost ${costLabel}`
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

    // ---- Execute: refuse without keys ----
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
                args.apiKeyFile
                    ? `ABORT: the key file is empty (provider "${id}").`
                    : `ABORT: env var ${def.apiKeyEnv} is not set (provider "${id}"); or pass --api-key-file.`
            );
            process.exit(2);
        }
        providers.set(
            id,
            createOpenAI({ apiKey, ...(def.baseURL ? { baseURL: def.baseURL } : {}) })
        );
    }
    void runAll({ calls, concurrency, providers, caseById, systemById, config, args, ratesFor });
}

async function runOne(input: {
    readonly call: PlannedCall;
    readonly provider: OpenAiProvider;
    readonly hasBaseUrl: boolean;
    readonly promptCase: PromptCase;
    readonly system: string;
    readonly rates: UsdRates | null;
}): Promise<CallResult> {
    const { call, promptCase } = input;
    const model = input.hasBaseUrl ? input.provider.chat(call.model) : input.provider(call.model);
    const start = performance.now();
    let ttftMs: number | null = null;
    let text = '';
    let error: string | null = null;
    let finishReason = 'error';
    let inputTokens = 0;
    let outputTokens = 0;
    let reasoningTokens = 0;
    try {
        const result = streamText({
            model,
            system: input.system,
            messages: [{ role: 'user', content: promptCase.question }],
            maxOutputTokens: call.maxOutputTokens,
            maxRetries: 1,
            ...(call.effort
                ? { providerOptions: { openai: { reasoningEffort: call.effort } } }
                : {})
        });
        for await (const part of result.fullStream) {
            if (part.type === 'text-delta') {
                if (ttftMs === null) ttftMs = performance.now() - start;
                text += part.text;
            } else if (part.type === 'error') {
                error = part.error instanceof Error ? part.error.message : String(part.error);
            }
        }
        if (error === null) {
            const usage = await result.usage;
            finishReason = await result.finishReason;
            inputTokens = usage.inputTokens ?? 0;
            outputTokens = usage.outputTokens ?? 0;
            reasoningTokens = usage.outputTokenDetails?.reasoningTokens ?? 0;
        }
    } catch (e) {
        error = e instanceof Error ? e.message : String(e);
    }
    const latencyMs = performance.now() - start;
    const ruleChecks: Record<string, boolean> = {};
    for (const rule of promptCase.rules) {
        if (RULE_IDS.includes(rule)) ruleChecks[rule] = runRule({ rule, text });
    }
    return {
        variantKey: call.variantKey,
        model: call.model,
        effort: call.effort,
        maxOutputTokens: call.maxOutputTokens,
        caseId: call.caseId,
        repetition: call.repetition,
        text,
        finishReason,
        inputTokens,
        outputTokens,
        reasoningTokens,
        ttftMs,
        latencyMs,
        costUsd: estimateCostUsd({ inputTokens, outputTokens, rates: input.rates }),
        ruleChecks,
        quality: checkAnswer({ text, rubric: promptCase.rubric }),
        error
    };
}

async function runAll(input: {
    readonly calls: readonly PlannedCall[];
    readonly concurrency: number;
    readonly providers: ReadonlyMap<string, OpenAiProvider>;
    readonly caseById: ReadonlyMap<string, PromptCase>;
    readonly systemById: ReadonlyMap<string, string>;
    readonly config: SweepConfig;
    readonly args: CliArgs;
    readonly ratesFor: (model: string) => UsdRates | null;
}): Promise<void> {
    mkdirSync(input.args.outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const jsonlPath = resolve(input.args.outDir, `sweep-${stamp}.jsonl`);
    const results: CallResult[] = [];
    let cursor = 0;
    const worker = async (): Promise<void> => {
        while (cursor < input.calls.length) {
            const call = input.calls[cursor++];
            if (!call) return;
            const providerDef = input.config.providers.find((p) => p.id === call.provider);
            const provider = input.providers.get(call.provider);
            const promptCase = input.caseById.get(call.caseId);
            if (!provider || !promptCase) continue;
            const result = await runOne({
                call,
                provider,
                hasBaseUrl: Boolean(providerDef?.baseURL),
                promptCase,
                system: input.systemById.get(call.caseId) ?? '',
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
    const mdPath = jsonlPath.replace(/\.jsonl$/, '.md');
    writeSummary({
        results,
        config: input.config,
        mdPath,
        grades: loadGrades(input.args)
    });
    console.log(`Raw: ${jsonlPath}`);
    if (input.args.blindExport) {
        writeBlindExport({
            path: input.args.blindExport,
            results,
            cases: [...input.caseById.values()]
        });
    }
}

function writeSummary(input: {
    readonly results: readonly CallResult[];
    readonly config: SweepConfig;
    readonly mdPath: string;
    readonly grades: Readonly<Record<string, Grade>> | undefined;
}): void {
    const rows = aggregateResults({
        results: input.results,
        quotas: input.config.monthlyQuotas,
        grades: input.grades
    });
    const errors = renderErrorSummary(rows);
    const md = renderSummaryMarkdown({ rows, quotas: input.config.monthlyQuotas });
    const text = `${md}\n${errors ? `\n${errors}\n` : ''}`;
    writeFileSync(input.mdPath, text);
    console.log(`\n${text}\nSummary: ${input.mdPath}`);
}

/** Writes the blind JSONL plus its key file (`<path>.key.json`). */
function writeBlindExport(input: {
    readonly path: string;
    readonly results: readonly CallResult[];
    readonly cases: readonly PromptCase[];
}): void {
    const { entries, key } = buildBlindExport({
        results: input.results,
        cases: input.cases,
        salt: randomBytes(8).toString('hex')
    });
    mkdirSync(dirname(input.path), { recursive: true });
    writeFileSync(input.path, entriesToJsonl(entries));
    writeFileSync(`${input.path}.key.json`, `${JSON.stringify(key, null, 2)}\n`);
    console.log(
        `Blind export: ${input.path} (${entries.length} answers)\n` +
            `Key (keep it away from the grader): ${input.path}.key.json\n` +
            'Grade as {"<id>": {"score": 1-5, "notes": "..."}}, then re-run with ' +
            '--results <jsonl> --grades <file> --key <key.json>.'
    );
}

function loadGrades(args: CliArgs): Record<string, Grade> | undefined {
    if (!args.gradesPath) return undefined;
    const keyPath = args.keyPath ?? (args.blindExport ? `${args.blindExport}.key.json` : null);
    if (!keyPath) {
        console.error('ABORT: --grades needs --key <key.json> (written by --blind-export).');
        process.exit(2);
    }
    const key = JSON.parse(readFileSync(keyPath, 'utf8')) as BlindKey;
    const { grades, unknownIds } = ingestGrades({
        grades: JSON.parse(readFileSync(args.gradesPath, 'utf8')),
        key
    });
    console.log(`Grades merged: ${Object.keys(grades).length}`);
    if (unknownIds.length > 0) {
        console.warn(`WARNING: unknown grade ids ignored: ${unknownIds.join(', ')}`);
    }
    return grades;
}

/** Offline mode: re-summarize or blind-export an existing results JSONL. Never touches the network. */
function runOffline(input: {
    readonly args: CliArgs;
    readonly config: SweepConfig;
    readonly cases: readonly PromptCase[];
}): void {
    const { args } = input;
    const source = args.resultsPath ?? '';
    const caseById = new Map(input.cases.map((c) => [c.id, c]));
    // Quality is recomputed with the CURRENT rubric, so a rubric fix re-scores old answers.
    const results = readFileSync(source, 'utf8')
        .split('\n')
        .filter((l) => l.trim() !== '')
        .map((l) => JSON.parse(l) as CallResult)
        .map((r) => {
            const promptCase = caseById.get(r.caseId);
            return promptCase
                ? { ...r, quality: checkAnswer({ text: r.text, rubric: promptCase.rubric }) }
                : r;
        });
    console.log(`Offline mode: ${results.length} results from ${source}`);
    if (args.blindExport) {
        writeBlindExport({ path: args.blindExport, results, cases: input.cases });
    }
    if (args.gradesPath || !args.blindExport) {
        writeSummary({
            results,
            config: input.config,
            mdPath: `${source.replace(/\.jsonl$/, '')}.graded.md`,
            grades: loadGrades(args)
        });
    }
}

main();
