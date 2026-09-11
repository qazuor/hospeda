/**
 * The chat context-assembler registry (HOS-400).
 *
 * One entry per {@link AiChatEntityType}. The chat route selects from this map
 * rather than branching on the entity type at the call site, so a fourth vertical
 * is a compile error here — `ChatContextAssemblerMap` is exhaustive over the
 * union — instead of a fourth `if` somebody forgets to add and a chat that
 * silently answers with the wrong vertical's context.
 *
 * @module apps/api/services/ai-context
 */

import type { AiChatEntityType, AiFeature } from '@repo/schemas';
import { assembleAccommodationContext } from '../accommodation-ai-context.js';
import { assembleExperienceContext } from './experience-ai-context.js';
import { assembleGastronomyContext } from './gastronomy-ai-context.js';
import type { ChatContextAssembler, ChatContextAssemblerMap } from './types.js';

export { assembleExperienceContext } from './experience-ai-context.js';
export { assembleGastronomyContext } from './gastronomy-ai-context.js';
export * from './owner-data-fence.js';
export * from './types.js';

/**
 * Adapts the pre-existing accommodation assembler to the shared contract.
 *
 * `assembleAccommodationContext` predates the interface (SPEC-200) and keeps its
 * own parameter and result names (`accommodationId`, `accommodationName`). It is
 * adapted rather than renamed: it is the assembler with the most callers and the
 * most tests, and a rename would have put a large mechanical diff in the middle
 * of a feature change for no behavioural gain.
 *
 * `ownerEntitlements` is intentionally unused here — an accommodation's context
 * carries no entitlement-gated sections, unlike gastronomy's carta and
 * experience's directions.
 */
const assembleAccommodationChatContext: ChatContextAssembler = async (input) => {
    const result = await assembleAccommodationContext({
        actor: input.actor,
        accommodationId: input.entityId,
        resolvedPrompt: input.resolvedPrompt,
        locale: input.locale
    });
    return {
        contextBlock: result.contextBlock,
        systemMessage: result.systemMessage,
        entityName: result.accommodationName
    };
};

/** Maps each chat entity type to the assembler that builds its context. */
export const CHAT_CONTEXT_ASSEMBLERS: ChatContextAssemblerMap = {
    accommodation: assembleAccommodationChatContext,
    gastronomy: assembleGastronomyContext,
    experience: assembleExperienceContext
};

/**
 * Maps each chat entity type to the {@link AiFeature} it meters under.
 *
 * This is the metering axis, and it is the reason the three verticals are three
 * features rather than one: monthly quota is enforced by counting `ai_usage` rows
 * keyed by `(userId, feature)`, so a shared feature value would pool the counts
 * regardless of how many distinct `LimitKey`s point at them (see
 * `AiFeatureSchema`'s docblock).
 *
 * Exhaustive over the union for the same reason the assembler map is: a fourth
 * vertical must not be able to inherit another vertical's counter by omission.
 */
export const CHAT_FEATURE_BY_ENTITY_TYPE: Readonly<Record<AiChatEntityType, AiFeature>> = {
    accommodation: 'chat',
    gastronomy: 'chat_gastronomy',
    experience: 'chat_experience'
};
