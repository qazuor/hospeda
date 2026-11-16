/**
 * Renders the provider request of every non-chat AI sweep case (HOS-2217).
 *
 * `render-sweep-tasks.ts` is a library, never run directly. It runs through the
 * generator: `CI=true pnpm --filter hospeda-api exec tsx scripts/ai-sweep/generate-sweep-tasks.ts`.
 *
 * The sweep in `packages/ai-core/scripts/ai-sweep` stores each case's raw route
 * input (`task-fixtures/<feature>.json`). This module turns that input into the
 * exact engine request the production route hands `aiService`, calling the
 * real builders and nothing else:
 *
 * | call                   | production code                                                     |
 * |------------------------|---------------------------------------------------------------------|
 * | `search_intent`        | `buildConversationalSearchPrompt` + `sanitizeSearchIntentEntities`  |
 * | `search_reply`         | `buildSearchReplySystemPrompt` + `buildSearchReplyMessages`         |
 * | `translate`            | `protectUrls` + `buildTranslationPrompt` (`translateField`)          |
 * | `text_improve`         | `buildTextImprovePrompt` (`AiTextImproveRequestSchema` input)        |
 * | `post_generate`        | `buildPostGeneratePrompt` (`AiPostGenerateRequestSchema` input)      |
 * | `accommodation_import` | `stripHtmlToText` + `buildImportAiPrompt`                            |
 * | `faq_draft`            | the chat context builders + `buildChatSystemMessage` + `buildFaqDraftRequest` |
 * | `support`              | none: no production route calls it (engine defaults only)           |
 * | `chat_answer_classifier` | `buildChatAnswerClassifierRequest` (runs on the chat feature)     |
 *
 * It also serializes each output schema with the AI SDK's own conversion
 * (`toSdkJsonSchema`, imported from the sweep by relative path because `ai` is
 * an ai-core dependency).
 *
 * @module apps/api/scripts/ai-sweep/render-sweep-tasks
 */

import {
    AiChatMessageSchema,
    AiFaqDraftOutputSchema,
    AiPostGenerateDraftGenerationSchema,
    AiPostGenerateRequestSchema,
    AiTextImproveRequestSchema,
    AttractionLocationConflictSchema,
    SearchIntentEntitiesSchema,
    SearchIntentOutputSchema
} from '@repo/schemas';
import { stripHtmlToText } from '@repo/service-core';
import { z } from 'zod';
import { toSdkJsonSchema } from '../../../../packages/ai-core/scripts/ai-sweep/sdk-json-schema.js';
import {
    AccommodationImportAiModelOutputSchema,
    buildImportAiPrompt
} from '../../src/routes/accommodation/protected/import-from-url.ai.js';
import { buildPostGeneratePrompt } from '../../src/routes/ai/admin/post-generate.prompt.js';
import {
    buildConversationalSearchPrompt,
    buildSearchReplyMessages,
    buildSearchReplySystemPrompt
} from '../../src/routes/ai/protected/search-chat.prompt.js';
import { sanitizeSearchIntentEntities } from '../../src/routes/ai/protected/search-intent.mapper.js';
import { buildTextImprovePrompt } from '../../src/routes/ai/protected/text-improve.prompt.js';
import { buildChatAnswerClassifierRequest } from '../../src/services/ai-chat-answer-classifier.js';
import { buildChatSystemMessage } from '../../src/services/ai-context/owner-data-fence.js';
import { buildFaqDraftRequest } from '../../src/services/ai-faq-draft.service.js';
import { buildTranslationPrompt, protectUrls } from '../../src/services/ai-translate.service.js';
import { ApiEnvBaseSchema } from '../../src/utils/env-schema.js';
import {
    type CatalogCuration,
    renderEntityContext,
    type SweepEntity
} from './render-sweep-contexts.js';

const LocaleSchema = z.enum(['es', 'en', 'pt']);
const HistorySchema = z.array(AiChatMessageSchema).default([]);

/** Raw route input of each call kind, as stored in `task-fixtures/*.json`. */
export const TASK_INPUT_SCHEMAS = {
    search_intent: z.object({
        locale: LocaleSchema,
        message: z.string().min(1),
        history: HistorySchema,
        currentFilters: SearchIntentEntitiesSchema.optional()
    }),
    search_reply: z.object({
        locale: LocaleSchema,
        message: z.string().min(1),
        history: HistorySchema,
        /** The filters the intent call would ideally extract (fixed, so the reply is measured alone). */
        extractedFilters: SearchIntentEntitiesSchema,
        attractionLocationConflict: AttractionLocationConflictSchema.optional()
    }),
    translate: z.object({
        fieldType: z.string().min(1),
        sourceLocale: LocaleSchema,
        targetLocale: LocaleSchema,
        value: z.string().min(1)
    }),
    text_improve: AiTextImproveRequestSchema,
    post_generate: AiPostGenerateRequestSchema,
    accommodation_import: z.object({ locale: LocaleSchema, html: z.string().min(1) }),
    faq_draft: z.object({
        /** An entity id of `inputs/*.json`. */
        entity: z.string().min(1),
        locale: LocaleSchema,
        question: z.string().min(1)
    }),
    support: z.object({ locale: LocaleSchema, message: z.string().min(1), history: HistorySchema }),
    chat_answer_classifier: z.object({
        /** The vertical's chat feature: the classifier runs on its configured model. */
        feature: z.enum(['chat', 'chat_venue', 'chat_experience']),
        locale: LocaleSchema,
        question: z.string(),
        /** The bot's reply being classified (may be empty in a trap case). */
        answer: z.string()
    })
} as const;

/** A call kind the renderer knows. */
export type RenderableCall = keyof typeof TASK_INPUT_SCHEMAS;

/**
 * Production Zod schema of each serialized output schema id: the schema the
 * route hands `generateObject`, i.e. what the provider is constrained with.
 * For `accommodation_import` that is the strict model-facing schema (HOS-2250),
 * not the downstream parse.
 */
export const OUTPUT_ZOD_SCHEMAS = {
    search_intent: SearchIntentOutputSchema,
    accommodation_import: AccommodationImportAiModelOutputSchema,
    post_generate: AiPostGenerateDraftGenerationSchema,
    faq_draft: AiFaqDraftOutputSchema
} as const;

/** One output schema id. */
export type RenderableSchemaId = keyof typeof OUTPUT_ZOD_SCHEMAS;

/** The engine request one route hands `aiService` (see the sweep's `EngineRequestSchema`). */
export interface RenderedEngineRequest {
    readonly feature: string;
    readonly locale: 'es' | 'en' | 'pt';
    readonly prompt?: string;
    readonly messages?: readonly {
        readonly role: 'user' | 'assistant';
        readonly content: string;
    }[];
    readonly system?: string;
    readonly systemPrompt?: string;
    readonly params?: { readonly maxTokens?: number; readonly temperature?: number };
}

/** One rendered case, before the digest is attached. */
export interface RenderedTask {
    readonly mode: 'text' | 'object';
    readonly stream: boolean;
    readonly request: RenderedEngineRequest;
    readonly schemaId?: RenderableSchemaId;
    readonly placeholders: readonly string[];
    readonly groundingText: string;
}

/** Placeholder token `protectUrls` substitutes for each URL. */
const URL_PLACEHOLDER = /\{\{\{HOSPEDA_URL_\d+\}\}\}/g;

/**
 * Renders one case with the real production builders.
 *
 * @param input.call - The call kind.
 * @param input.input - The stored raw input (validated here).
 * @param input.entities - Entities for `faq_draft` (from `inputs/*.json`).
 * @param input.curation - Catalog curation for `faq_draft` contexts.
 * @returns `{ rendered }`. Throws on an invalid input, an unknown entity, or a
 *   `faq_draft` question production would refuse before calling the model.
 */
export function renderTask(input: {
    readonly call: RenderableCall;
    readonly input: unknown;
    readonly entities: Readonly<Record<string, SweepEntity>>;
    readonly curation: CatalogCuration;
}): { readonly rendered: RenderedTask } {
    const none = { placeholders: [], groundingText: '' } as const;
    switch (input.call) {
        case 'search_intent': {
            const i = TASK_INPUT_SCHEMAS.search_intent.parse(input.input);
            const prompt = buildConversationalSearchPrompt({
                currentFilters:
                    i.currentFilters === undefined
                        ? undefined
                        : sanitizeSearchIntentEntities(i.currentFilters),
                history: i.history,
                message: i.message,
                locale: i.locale
            });
            return {
                rendered: {
                    mode: 'object',
                    stream: false,
                    request: { feature: 'search', locale: i.locale, prompt },
                    schemaId: 'search_intent',
                    ...none
                }
            };
        }
        case 'search_reply': {
            const i = TASK_INPUT_SCHEMAS.search_reply.parse(input.input);
            const { system, messages } = buildSearchReplyMessages({
                systemPrompt: buildSearchReplySystemPrompt({ locale: i.locale }),
                history: i.history,
                message: i.message,
                extractedFilters: i.extractedFilters,
                attractionLocationConflict: i.attractionLocationConflict
            });
            const turns = messages.map((m) => {
                if (m.role !== 'user' && m.role !== 'assistant') {
                    throw new Error(`search_reply: unexpected message role "${m.role}"`);
                }
                return { role: m.role, content: m.content };
            });
            return {
                rendered: {
                    mode: 'text',
                    stream: true,
                    request: { feature: 'search', locale: i.locale, system, messages: turns },
                    ...none
                }
            };
        }
        case 'translate': {
            const i = TASK_INPUT_SCHEMAS.translate.parse(input.input);
            const { protectedText } = protectUrls(i.value);
            const prompt = buildTranslationPrompt(
                protectedText,
                i.sourceLocale,
                i.targetLocale,
                i.fieldType
            );
            return {
                rendered: {
                    mode: 'text',
                    stream: false,
                    request: { feature: 'translate', locale: i.targetLocale, prompt },
                    placeholders: protectedText.match(URL_PLACEHOLDER) ?? [],
                    groundingText: ''
                }
            };
        }
        case 'text_improve': {
            const i = TASK_INPUT_SCHEMAS.text_improve.parse(input.input);
            return {
                rendered: {
                    mode: 'text',
                    stream: true,
                    request: {
                        feature: 'text_improve',
                        locale: i.locale ?? 'es',
                        prompt: buildTextImprovePrompt(i)
                    },
                    ...none
                }
            };
        }
        case 'post_generate': {
            const i = TASK_INPUT_SCHEMAS.post_generate.parse(input.input);
            return {
                rendered: {
                    mode: 'object',
                    stream: false,
                    request: {
                        feature: 'post_generate',
                        locale: i.locale ?? 'es',
                        prompt: buildPostGeneratePrompt(i)
                    },
                    schemaId: 'post_generate',
                    ...none
                }
            };
        }
        case 'accommodation_import': {
            const i = TASK_INPUT_SCHEMAS.accommodation_import.parse(input.input);
            // The generic adapter strips the page with the deployed character cap.
            const maxChars = ApiEnvBaseSchema.shape.HOSPEDA_IMPORT_AI_MAX_CHARS.parse(undefined);
            const text = stripHtmlToText({ html: i.html, maxChars });
            return {
                rendered: {
                    mode: 'object',
                    stream: false,
                    request: {
                        feature: 'accommodation_import',
                        locale: i.locale,
                        prompt: buildImportAiPrompt(text)
                    },
                    schemaId: 'accommodation_import',
                    placeholders: [],
                    groundingText: text
                }
            };
        }
        case 'faq_draft': {
            const i = TASK_INPUT_SCHEMAS.faq_draft.parse(input.input);
            const entity = input.entities[i.entity];
            if (!entity) throw new Error(`faq_draft: unknown entity "${i.entity}"`);
            const { context } = renderEntityContext({
                entity,
                curation: input.curation,
                locale: i.locale
            });
            // The chat assemblers build the system message with an empty prompt for FAQ drafts.
            const systemMessage = buildChatSystemMessage(context, '', i.locale);
            const { request } = buildFaqDraftRequest({
                systemMessage,
                question: i.question,
                locale: i.locale
            });
            if (request === null) {
                throw new Error(
                    `faq_draft: the injection guard blocks "${i.question}", so production never calls the model.`
                );
            }
            return {
                rendered: {
                    mode: 'object',
                    stream: false,
                    request: {
                        feature: request.feature,
                        locale: request.locale,
                        systemPrompt: request.systemPrompt,
                        prompt: request.prompt,
                        params: { ...request.params }
                    },
                    schemaId: 'faq_draft',
                    placeholders: [],
                    groundingText: context
                }
            };
        }
        case 'chat_answer_classifier': {
            const i = TASK_INPUT_SCHEMAS.chat_answer_classifier.parse(input.input);
            const { request } = buildChatAnswerClassifierRequest(i);
            return {
                rendered: {
                    mode: 'text',
                    stream: false,
                    request: { ...request, params: { ...request.params } },
                    ...none
                }
            };
        }
        case 'support': {
            const i = TASK_INPUT_SCHEMAS.support.parse(input.input);
            return {
                rendered: {
                    mode: 'text',
                    stream: true,
                    request: {
                        feature: 'support',
                        locale: i.locale,
                        messages: [...i.history, { role: 'user', content: i.message }]
                    },
                    ...none
                }
            };
        }
    }
}

/**
 * Serializes every output schema with the AI SDK's conversion.
 *
 * @returns `{ schemas }` keyed by output schema id.
 */
export function renderOutputSchemas(): {
    readonly schemas: Readonly<Record<RenderableSchemaId, Readonly<Record<string, unknown>>>>;
} {
    const out = {} as Record<RenderableSchemaId, Readonly<Record<string, unknown>>>;
    for (const id of Object.keys(OUTPUT_ZOD_SCHEMAS) as RenderableSchemaId[]) {
        out[id] = toSdkJsonSchema({ schema: OUTPUT_ZOD_SCHEMAS[id] }).jsonSchema;
    }
    return { schemas: out };
}
