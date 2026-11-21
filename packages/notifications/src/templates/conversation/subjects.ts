/**
 * Subject lines of the conversation emails.
 *
 * They are sent from `apps/api` (the conversation mailer and the two
 * conversation crons), but live next to their templates so the senders and the
 * admin email preview build the same string (HOS-2519 D6). Owner-approved copy:
 * do not edit casually.
 *
 * @module templates/conversation/subjects
 */

/** Subject of the anonymous guest verification email ({@link ConversationVerify}). */
export const CONVERSATION_VERIFY_SUBJECT =
    'Verificá tu email para continuar la conversación — Hospeda';

/** Subject of the magic-link re-access email (also rendered with {@link ConversationVerify}). */
export const CONVERSATION_ACCESS_LINK_SUBJECT = 'Tu enlace de acceso a la conversación — Hospeda';

/** Input of the conversation subject builders that name the accommodation. */
export interface ConversationSubjectInput {
    /** Display name of the accommodation the conversation is about. */
    readonly accommodationName: string;
}

/**
 * Subject of the new-message notification, both the registered-guest
 * ({@link ConversationNewMessage}) and the anonymous ({@link ConversationNewMessageAnon}) variants.
 *
 * @param input - The accommodation name.
 * @returns The subject line.
 */
export function buildConversationNewMessageSubject(input: ConversationSubjectInput): string {
    return `Nuevo mensaje sobre ${input.accommodationName}`;
}

/**
 * Subject of the access-link expiry reminder sent 15 days before it expires
 * ({@link ConversationTokenExpiringDay15}).
 *
 * @param input - The accommodation name.
 * @returns The subject line.
 */
export function buildConversationTokenDay15Subject(input: ConversationSubjectInput): string {
    return `Tu enlace de acceso vence en 15 días — ${input.accommodationName}`;
}

/**
 * Subject of the last access-link expiry reminder, 5 days before it expires
 * ({@link ConversationTokenExpiringDay25}).
 *
 * @param input - The accommodation name.
 * @returns The subject line.
 */
export function buildConversationTokenDay25Subject(input: ConversationSubjectInput): string {
    return `¡Último aviso! Tu enlace vence en 5 días — ${input.accommodationName}`;
}
