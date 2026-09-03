/**
 * The common contract every AI-chat context assembler satisfies (HOS-400).
 *
 * ---
 * WHY AN INTERFACE AND NOT ONE PARAMETERISED ASSEMBLER
 *
 * The three verticals answer genuinely different questions. A guest asks an
 * accommodation about capacity, nights and amenities; a diner asks a restaurant
 * what it cooks, when it opens and what a plate costs; someone booking an
 * excursion asks how long it takes, how hard it is and where it leaves from.
 * Those are not the same fields behind a flag — they are different prompts, with
 * different caps and different things worth spending tokens on.
 *
 * What they MUST share is the part that is not about content: the owner-data
 * fence, the sanitisation that stops a value forging its own closing marker, and
 * the shape of the system message. Those live in `owner-data-fence.ts` and are
 * imported by every assembler rather than reimplemented per vertical.
 *
 * So: one interface, one set of safety primitives, three bodies.
 * ---
 *
 * @module apps/api/services/ai-context/types
 */

import type { AiChatEntityType } from '@repo/schemas';
import type { Actor } from '@repo/service-core';

/** Input contract shared by every context assembler. */
export interface AssembleChatContextInput {
    /** The requesting actor, forwarded verbatim to the services that read rows. */
    readonly actor: Actor;
    /** The listing the chat is about. */
    readonly entityId: string;
    /** The prompt resolved by `resolveSystemPrompt({ feature })`. */
    readonly resolvedPrompt: string;
    /** The visitor's locale. */
    readonly locale: 'es' | 'en' | 'pt';
    /**
     * The entitlement keys the listing OWNER's plan grants, for the verticals
     * whose context includes entitlement-gated content (HOS-400).
     *
     * Passed IN rather than resolved here so the assembler performs no billing
     * lookup of its own: the route already resolved the owner's grants to decide
     * whether the chat runs at all, and reading them twice would let the two
     * answers come from different instants if a plan change landed mid-request.
     *
     * An assembler whose vertical has no gated content ignores it. An assembler
     * that needs it MUST fail closed on an empty set — see
     * `gastronomy-ai-context.ts`, where the carta, the menú del día and the venue
     * agenda are each withheld unless the owner's plan grants them. Today every
     * commerce tier that grants `AI_CHAT` happens to grant those too, but that is
     * a fact about the current catalogue, not a guarantee: the day somebody
     * splits the keys across tiers differently, an assembler that trusted the
     * coincidence would put paid content in the prompt of an owner who is not
     * paying for it.
     */
    readonly ownerEntitlements: ReadonlySet<string>;
}

/** Output contract shared by every context assembler. */
export interface AssembleChatContextOutput {
    /** The Markdown context block. */
    readonly contextBlock: string;
    /** The full system message (context block + resolved prompt + language rule). */
    readonly systemMessage: string;
    /** The listing's display name, echoed for logging and conversation titles. */
    readonly entityName: string;
}

/**
 * A vertical's context assembler.
 *
 * Implemented once per {@link AiChatEntityType}; selected by the chat route from
 * {@link CHAT_CONTEXT_ASSEMBLERS} rather than by a conditional at the call site,
 * so adding a fourth vertical is a map entry and a compile error, not a fourth
 * branch somebody can forget to add.
 */
export type ChatContextAssembler = (
    input: AssembleChatContextInput
) => Promise<AssembleChatContextOutput>;

/** Maps a chat entity type to the assembler that builds its context. */
export type ChatContextAssemblerMap = Readonly<Record<AiChatEntityType, ChatContextAssembler>>;
