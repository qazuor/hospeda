/**
 * @file inquiry-services.ts
 * @description The service instance the inquiry tools read through
 * (HOS-2184 T-020/T-021). Built once per process, lazily, because
 * `ConversationService` needs the validated environment at construction and
 * this module is imported while the tool registry loads.
 *
 * The tools reuse the exact service methods the protected owner routes call
 * (`routes/conversations/protected/owner/*`) and never query inquiries
 * themselves. `reply_inquiry` (T-023) also needs the `MessageService`.
 */

import { ConversationService, MessageService } from '@repo/service-core';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';

let conversationService: ConversationService | undefined;
let messageService: MessageService | undefined;

/**
 * Returns the shared conversation service, as the owner routes build theirs.
 *
 * @returns The process-wide `ConversationService`
 */
export function getInquiryConversationService(): ConversationService {
    conversationService ??= new ConversationService(
        { logger: apiLogger },
        { authSecret: env.HOSPEDA_BETTER_AUTH_SECRET, siteUrl: env.HOSPEDA_SITE_URL }
    );
    return conversationService;
}

/**
 * Returns the shared message service, as the owner reply route builds its own.
 * Used by `reply_inquiry` to create the message and to dry-run its content
 * rules.
 *
 * @returns The process-wide `MessageService`
 */
export function getInquiryMessageService(): MessageService {
    messageService ??= new MessageService({ logger: apiLogger });
    return messageService;
}
