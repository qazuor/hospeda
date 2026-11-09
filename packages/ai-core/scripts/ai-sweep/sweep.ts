/**
 * HOS-2095 model and parameter sweep for the AI chat feature.
 *
 * DRY-RUN BY DEFAULT: without `--execute` this script makes no network call.
 * With `--execute` it refuses to start unless every provider it needs has its
 * API key env var set. Run from `packages/ai-core` (see README.md).
 *
 * @module ai-core/scripts/ai-sweep/sweep
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOpenAI } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { composeSystemPrompt } from '../../src/config/prompt-resolver.js';
import { DEFAULT_PROMPTS, DEFAULT_RULES } from '../../src/engine/default-prompts.js';
import { MODEL_RATES } from '../../src/usage/model-rates.js';
import {
    aggregateResults,
    approxTokens,
    type CallResult,
    estimateCostUsd,
    expandMatrix,
    type PlannedCall,
    type PromptCase,
    RULE_IDS,
    renderSummaryMarkdown,
    resolveRates,
    runRule,
    type SweepConfig,
    SweepConfigSchema,
    type UsdRates
} from './lib.js';

const HERE = dirname(fileURLToPath(import.meta.url));

type OpenAiProvider = ReturnType<typeof createOpenAI>;

interface CliArgs {
    readonly execute: boolean;
    readonly configPath: string;
    readonly outDir: string;
    readonly maxCalls: number | null;
    readonly concurrency: number | null;
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
    return {
        execute: argv.includes('--execute') && !argv.includes('--dry-run'),
        configPath: resolve(value('--config') ?? resolve(HERE, 'sweep.config.example.json')),
        outDir: resolve(value('--out') ?? resolve(HERE, 'out')),
        maxCalls: num('--max-calls'),
        concurrency: num('--concurrency')
    };
}

/** Same layout as `buildChatSystemMessage` in apps/api/src/services/ai-context/owner-data-fence.ts:134. */
function buildSystem(promptCase: PromptCase): string {
    const resolved = composeSystemPrompt({
        content: DEFAULT_PROMPTS[promptCase.feature],
        rules: DEFAULT_RULES[promptCase.feature]
    });
    return [
        promptCase.contextBlock,
        '',
        '---',
        '',
        resolved,
        '',
        `- You MUST respond in the user's language: locale is "es".`
    ].join('\n');
}

function main(): void {
    const args = parseArgs(process.argv.slice(2));
    const config = SweepConfigSchema.parse(JSON.parse(readFileSync(args.configPath, 'utf8')));
    const fixtures = JSON.parse(readFileSync(resolve(HERE, 'fixtures.json'), 'utf8')) as {
        cases: PromptCase[];
    };
    const maxCalls = args.maxCalls ?? config.maxCalls;
    const concurrency = args.concurrency ?? config.concurrency;
    const cases = fixtures.cases;
    const calls = expandMatrix({ config, cases });
    const caseById = new Map(cases.map((c) => [c.id, c]));
    const systemById = new Map(cases.map((c) => [c.id, buildSystem(c)]));
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
            approxTokens(caseById.get(call.caseId)?.userMessage ?? '');
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
    console.log(`Cases: ${cases.map((c) => c.id).join(', ')}`);
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
        const apiKey = process.env[def.apiKeyEnv];
        if (!apiKey) {
            console.error(`ABORT: env var ${def.apiKeyEnv} is not set (provider "${id}").`);
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
            messages: [{ role: 'user', content: promptCase.userMessage }],
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
    const md = renderSummaryMarkdown({
        rows: aggregateResults({ results, quotas: input.config.monthlyQuotas }),
        quotas: input.config.monthlyQuotas
    });
    const mdPath = jsonlPath.replace(/\.jsonl$/, '.md');
    writeFileSync(mdPath, `${md}\n`);
    console.log(`\n${md}\n\nRaw: ${jsonlPath}\nSummary: ${mdPath}`);
}

main();
