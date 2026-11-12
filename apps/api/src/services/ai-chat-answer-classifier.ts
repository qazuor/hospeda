/**
 * Chat-answer classifier for the host AI questions panel (HOS-2101).
 *
 * After a chat turn is persisted, one cheap model call decides whether the
 * bot's answer actually answered the visitor's question or said the fact is
 * not in the listing. The verdict lands on `ai_messages.answer_status` of the
 * assistant row, and the host panel shows unanswered questions first.
 *
 * ## Contract
 *
 * - **Never blocks the chat.** {@link scheduleChatAnswerClassification} returns
 *   synchronously and runs the call detached, after the stream's metadata has
 *   resolved. Nothing awaits it.
 * - **Failure leaves the row unclassified.** A provider error, a cost-ceiling
 *   hit, a moderation block, an empty or unparseable output: all of them log a
 *   warning and write nothing. `NULL` is "not classified", never a verdict.
 * - **Metered, but never against a quota.** Every call that reached the
 *   provider writes ONE `ai_usage` row with `userId: null` and the feature
 *   {@link CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE}, so the monthly cost ceiling
 *   and the admin dashboards see its spend. Quotas count rows keyed by a user
 *   AND filtered by a chat feature, so this row matches neither (HOS-2095
 *   keeps the chat at exactly one quota row per request).
 * - **Respects the cost ceiling.** The configured service checks it before the
 *   provider call; a reached ceiling throws and the turn stays unclassified.
 * - **Only for delivered turns.** The chat schedules it after a non-empty turn
 *   was persisted; a quota-blocked request never streams, so it never gets here.
 * - **Bounded cost.** The model sees a fixed short instruction plus the
 *   question and answer, each truncated to {@link MAX_CLASSIFIER_INPUT_CHARS},
 *   and may emit at most {@link CLASSIFIER_MAX_OUTPUT_TOKENS} tokens — about
 *   US$0.0002 per question on the configured chat model.
 *
 * @module apps/api/services/ai-chat-answer-classifier
 */

import { type AiService, recordAiUsage } from '@repo/ai-core';
import { aiMessages, getDb } from '@repo/db';
import type { AiAnswerStatus, AiFeature, LanguageEnum } from '@repo/schemas';
import { eq } from 'drizzle-orm';
import { warnMissingModelRate } from '../utils/ai-missing-model-rate.js';
import { loadModelRateOverrides } from '../utils/ai-rate-overrides.js';
import { apiLogger } from '../utils/logger.js';
import { createConfiguredAiService } from './ai-service.factory.js';

/** Characters of the question and of the answer sent to the classifier. */
export const MAX_CLASSIFIER_INPUT_CHARS = 1200;

/**
 * `ai_usage.feature` of every classifier call.
 *
 * Deliberately NOT an `AiFeature` value: it is never configured in
 * `ai_settings`, has no prompt and no quota. Being its own key keeps it out of
 * every quota count (they filter by the chat features) while the global cost
 * ceiling, which sums all rows, and the admin usage dashboards include it.
 */
export const CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE = 'chat_answer_classifier';

/**
 * Output cap. The verdict is a single word, but the OpenAI Responses API
 * rejects any `max_output_tokens` below 16 ("Expected a value >= 16"), and a
 * rejected call leaves every turn `unclassified`. 16 is that provider floor;
 * the model still stops after the one-word verdict (measured: 6 tokens).
 */
export const CLASSIFIER_MAX_OUTPUT_TOKENS = 16;

/** Lowest `max_output_tokens` the OpenAI Responses API accepts. */
export const OPENAI_MIN_OUTPUT_TOKENS = 16;

/**
 * Fixed instruction. English on purpose: it is read by the model only, and
 * one language keeps the verdict tokens stable whatever language the visitor
 * used.
 */
export const CHAT_ANSWER_CLASSIFIER_SYSTEM = [
    'You audit replies of an assistant that answers visitor questions about one tourism listing',
    'using only the listing data.',
    'Reply UNANSWERED when the reply does not give the requested fact: it says the information is',
    'not in the listing, that it does not know, or it only suggests contacting the owner.',
    'Reply ANSWERED when the reply gives the requested fact, even partially.',
    'Reply with exactly one word: ANSWERED or UNANSWERED.'
].join(' ');

/** Input of {@link parseClassifierVerdict}. */
export interface ParseClassifierVerdictInput {
    /** Raw model output. */
    readonly text: string;
}

/** Output of {@link parseClassifierVerdict}. */
export interface ParseClassifierVerdictOutput {
    /** The verdict, or `null` when the output is not one of the two words. */
    readonly verdict: AiAnswerStatus | null;
}

/**
 * Reads the classifier's one-word output.
 *
 * `UNANSWERED` is tested first because it contains `ANSWERED`. Anything that is
 * neither word — prose, an empty string — is `null`, so a confused model leaves
 * the row unclassified instead of guessing.
 *
 * @param input - The raw model output.
 * @returns The verdict, or `null`.
 */
export function parseClassifierVerdict(
    input: ParseClassifierVerdictInput
): ParseClassifierVerdictOutput {
    const normalized = input.text
        .trim()
        .toUpperCase()
        .replace(/[^A-Z]/g, '');
    if (normalized === 'UNANSWERED') {
        return { verdict: 'unanswered' };
    }
    if (normalized === 'ANSWERED') {
        return { verdict: 'answered' };
    }
    return { verdict: null };
}

/** Collaborators of {@link classifyChatAnswer}, injectable for tests. */
export interface ClassifyChatAnswerDeps {
    /** Builds the configured AI service (credentials, cost ceiling, moderation). */
    readonly createAiService: () => Promise<Pick<AiService, 'generateText'>>;
    /**
     * Meters one classifier call in `ai_usage` (system row: no user, so no
     * owner or tourist quota can count it).
     */
    readonly recordUsage: (input: {
        readonly provider: string;
        readonly model: string;
        readonly promptTokens: number;
        readonly completionTokens: number;
        readonly latencyMs: number;
    }) => Promise<void>;
    /** Writes the verdict onto the assistant row. */
    readonly writeVerdict: (input: {
        readonly assistantMessageId: string;
        readonly verdict: AiAnswerStatus;
    }) => Promise<void>;
}

/** Input of {@link classifyChatAnswer}. */
export interface ClassifyChatAnswerInput {
    /** The assistant `ai_messages` row the verdict belongs to. */
    readonly assistantMessageId: string;
    /** The visitor's question. */
    readonly question: string;
    /** The bot's answer. */
    readonly answer: string;
    /** The vertical's chat feature — selects the configured model. */
    readonly feature: AiFeature;
    /** Chat locale (required by the engine contract). */
    readonly locale: LanguageEnum;
    /** Optional collaborators; production defaults otherwise. */
    readonly deps?: ClassifyChatAnswerDeps;
}

/** Output of {@link classifyChatAnswer}. */
export interface ClassifyChatAnswerOutput {
    /** What was written, or `null` when the row was left unclassified. */
    readonly verdict: AiAnswerStatus | null;
}

/**
 * Production metering of one classifier call: a system `ai_usage` row
 * (`userId: null`) under {@link CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE}.
 *
 * @param usage - Provider, model, tokens and latency of the call.
 */
export async function recordClassifierUsage(
    usage: Parameters<ClassifyChatAnswerDeps['recordUsage']>[0]
): Promise<void> {
    const rateOverrides = await loadModelRateOverrides();
    await recordAiUsage({
        userId: null,
        feature: CHAT_ANSWER_CLASSIFIER_USAGE_FEATURE,
        ...usage,
        status: 'success',
        rateOverrides,
        onMissingRate: warnMissingModelRate
    });
}

/**
 * Production verdict write onto the assistant `ai_messages` row.
 *
 * @param input - The assistant row id and the verdict.
 */
export async function writeClassifierVerdict(
    input: Parameters<ClassifyChatAnswerDeps['writeVerdict']>[0]
): Promise<void> {
    await getDb()
        .update(aiMessages)
        .set({ answerStatus: input.verdict })
        .where(eq(aiMessages.id, input.assistantMessageId));
}

/** Production collaborators. */
const DEFAULT_DEPS: ClassifyChatAnswerDeps = {
    createAiService: createConfiguredAiService,
    recordUsage: recordClassifierUsage,
    writeVerdict: writeClassifierVerdict
};

/**
 * Truncates a classifier input so a long answer cannot inflate the cost.
 */
function clip(text: string): string {
    return text.length > MAX_CLASSIFIER_INPUT_CHARS
        ? `${text.slice(0, MAX_CLASSIFIER_INPUT_CHARS)}…`
        : text;
}

/**
 * Classifies one persisted chat answer and stores the verdict.
 *
 * Never throws: every failure is logged and reported as `verdict: null`.
 *
 * @param input - The assistant row id, the question/answer pair, the chat
 *   feature and locale, and optional collaborators.
 * @returns The verdict written, or `null`.
 */
export async function classifyChatAnswer(
    input: ClassifyChatAnswerInput
): Promise<ClassifyChatAnswerOutput> {
    const deps = input.deps ?? DEFAULT_DEPS;
    try {
        const aiService = await deps.createAiService();
        const startedAt = Date.now();
        // The configured service runs the cost-ceiling check before calling the
        // provider: a reached ceiling throws here and the row stays unclassified.
        const result = await aiService.generateText({
            feature: input.feature,
            locale: input.locale,
            system: CHAT_ANSWER_CLASSIFIER_SYSTEM,
            prompt: `Question: ${clip(input.question)}\nReply: ${clip(input.answer)}`,
            params: { maxTokens: CLASSIFIER_MAX_OUTPUT_TOKENS, temperature: 0 }
        });
        // Tokens were spent whatever the output says, so the call is metered
        // before parsing. A metering failure must not discard a good verdict.
        try {
            await deps.recordUsage({
                provider: result.provider,
                model: result.model,
                promptTokens: result.usage.promptTokens,
                completionTokens: result.usage.completionTokens,
                latencyMs: Date.now() - startedAt
            });
        } catch (meteringError) {
            apiLogger.warn(
                {
                    assistantMessageId: input.assistantMessageId,
                    error:
                        meteringError instanceof Error
                            ? meteringError.message
                            : String(meteringError)
                },
                'ai-chat-classifier: failed to record usage (non-fatal)'
            );
        }
        const { verdict } = parseClassifierVerdict({ text: result.text });
        if (verdict === null) {
            apiLogger.warn(
                {
                    assistantMessageId: input.assistantMessageId,
                    feature: input.feature,
                    outputLength: result.text.length
                },
                'ai-chat-classifier: unparseable verdict, row left unclassified'
            );
            return { verdict: null };
        }
        await deps.writeVerdict({ assistantMessageId: input.assistantMessageId, verdict });
        return { verdict };
    } catch (error) {
        apiLogger.warn(
            {
                assistantMessageId: input.assistantMessageId,
                feature: input.feature,
                error: error instanceof Error ? error.message : String(error)
            },
            'ai-chat-classifier: classification failed, row left unclassified'
        );
        return { verdict: null };
    }
}

/**
 * Starts {@link classifyChatAnswer} detached and returns immediately.
 *
 * The chat route calls this from its post-stream persistence callback; the
 * promise is intentionally not awaited so the classification can never delay
 * the `done` frame or the response.
 *
 * @param input - Same as {@link classifyChatAnswer}.
 */
export function scheduleChatAnswerClassification(input: ClassifyChatAnswerInput): void {
    void classifyChatAnswer(input);
}
