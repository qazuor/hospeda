import { appendReplyLanguageInstruction, guardPromptInjection } from '@repo/ai-core';
import { accommodations, aiConversations, aiMessages, experiences, getDb, venues } from '@repo/db';
import {
    type AiChatEntityType,
    AiFaqDraftOutputSchema,
    type AiFaqDraftResponse,
    type LanguageEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import { and, eq, isNull } from 'drizzle-orm';
import { ZodError } from 'zod';
import { stripMarkdown } from '../utils/entitlement-filter.js';
import { CHAT_CONTEXT_ASSEMBLERS, truncateAtWord } from './ai-context/index.js';
import { readPairedQuestionAnswer } from './ai-listing-questions.service.js';
import { createConfiguredAiService } from './ai-service.factory.js';

/** Listing and question data needed to create one owner FAQ draft. */
export interface FaqDraftContextInput {
    readonly messageId: string;
    readonly ownerId: string;
    readonly businessLines: readonly string[];
    readonly entityType: AiChatEntityType;
    readonly entityId: string;
    readonly question: string;
    readonly answerStatus: string | null;
}

/** Loads the question and its paired assistant status without exposing visitor identity. */
export async function readFaqDraftQuestion(input: {
    readonly messageId: string;
}): Promise<FaqDraftContextInput | null> {
    const db = getDb();
    const rows = await db
        .select({
            question: aiMessages.content,
            entityType: aiConversations.listingEntityType,
            entityId: aiConversations.listingEntityId
        })
        .from(aiMessages)
        .innerJoin(aiConversations, eq(aiMessages.conversationId, aiConversations.id))
        .where(
            and(
                eq(aiMessages.id, input.messageId),
                eq(aiMessages.role, 'user'),
                isNull(aiMessages.deletedAt),
                isNull(aiConversations.deletedAt)
            )
        )
        .limit(1);
    const row = rows[0];
    if (
        !row?.entityId ||
        !row.entityType ||
        !['accommodation', 'venue', 'experience'].includes(row.entityType)
    )
        return null;
    const tables = {
        accommodation: accommodations,
        venue: venues,
        experience: experiences
    } as const;
    const listing = tables[row.entityType as AiChatEntityType];
    const listingRows = await db
        .select({ ownerId: listing.ownerId })
        .from(listing)
        .where(and(eq(listing.id, row.entityId), isNull(listing.deletedAt)))
        .limit(1);
    const owner = listingRows[0];
    if (!owner) return null;
    let businessLines: readonly string[] = [];
    if (row.entityType === 'venue') {
        const [venue] = await db
            .select({ businessLines: venues.businessLines })
            .from(venues)
            .where(eq(venues.id, row.entityId))
            .limit(1);
        businessLines = venue?.businessLines ?? [];
    } else if (row.entityType === 'experience') {
        const [experience] = await db
            .select({ businessLines: experiences.businessLines })
            .from(experiences)
            .where(eq(experiences.id, row.entityId))
            .limit(1);
        businessLines = experience?.businessLines ?? [];
    }
    const answer = await readPairedQuestionAnswer({ messageId: input.messageId });
    if (!answer) return null;
    return {
        messageId: input.messageId,
        ownerId: owner.ownerId,
        businessLines,
        entityType: row.entityType as AiChatEntityType,
        entityId: row.entityId,
        question: row.question,
        answerStatus: answer.answerStatus
    };
}

/** Generates a grounded FAQ answer; a high-confidence injection returns no draft. */
export async function generateFaqDraft(input: {
    readonly context: FaqDraftContextInput;
    readonly actor: Actor;
    readonly locale: LanguageEnum;
    readonly listingSections: Parameters<
        (typeof CHAT_CONTEXT_ASSEMBLERS)[AiChatEntityType]
    >[0]['listingSections'];
}): Promise<{
    readonly response: AiFaqDraftResponse;
    readonly usage?: {
        readonly provider: string;
        readonly model: string;
        readonly promptTokens: number;
        readonly completionTokens: number;
        readonly latencyMs: number;
    };
}> {
    const { context } = input;
    const injection = guardPromptInjection({ text: context.question });
    if (injection.severity === 'high')
        return { response: { messageId: context.messageId, hasData: false, draft: null } };
    const assembled = await CHAT_CONTEXT_ASSEMBLERS[context.entityType]({
        actor: input.actor,
        entityId: context.entityId,
        resolvedPrompt: '',
        locale: input.locale,
        listingSections: input.listingSections
    });
    const language = appendReplyLanguageInstruction({
        system: assembled.systemMessage,
        latestUserMessage: context.question
    });
    const systemPrompt = `${language.system}\n\nCreate an editable answer using only the listing context above. If it lacks the requested fact, return hasData=false and an empty draft. Return plain text without markdown, no more than 2000 characters, and include contact details only when verbatim in the context.`;
    const startedAt = Date.now();
    const service = await createConfiguredAiService();
    let result: Awaited<ReturnType<typeof service.generateObject>>;
    let output: ReturnType<typeof AiFaqDraftOutputSchema.parse>;
    try {
        result = await service.generateObject(
            {
                feature: 'faq_draft',
                locale: input.locale,
                systemPrompt,
                prompt: `Visitor question: ${injection.sanitizedText}`,
                params: { maxTokens: 1024, temperature: 0 }
            },
            AiFaqDraftOutputSchema
        );
        output = AiFaqDraftOutputSchema.parse(result.object);
    } catch (error) {
        if (error instanceof ZodError)
            throw new ServiceError(
                ServiceErrorCode.PROVIDER_ERROR,
                'The AI provider returned an invalid FAQ draft.'
            );
        throw error;
    }
    const clean = truncateAtWord(stripMarkdown(output.draft), 2000);
    const hasData = output.hasData && clean.length > 0;
    return {
        response: { messageId: context.messageId, hasData, draft: hasData ? clean : null },
        usage: {
            provider: result.provider,
            model: result.model,
            promptTokens: result.usage.promptTokens,
            completionTokens: result.usage.completionTokens,
            latencyMs: Date.now() - startedAt
        }
    };
}
