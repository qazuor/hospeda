/**
 * @file undo-benefit-rejection.ts
 * @description Tool `undo_benefit_rejection` (HOS-2332, spec HOS-2335 §6.7):
 * puts a REJECTED benefit usage back to PENDING.
 *
 * One step, because the action is itself the undo. Same path as
 * `POST /protected/host-trades/usages/{id}/reject/undo`, through the shared
 * helper the route calls (`lib/host-trade-usage-transitions.ts`): only the
 * account that rejected the usage may undo it, and like the route it emails
 * nobody. Role-blind, no permission. Anyone else, and a missing id, get the
 * uniform not-found, never FORBIDDEN.
 */

import { z } from 'zod';
import { undoBenefitUsageRejection } from '../../../lib/host-trade-usage-transitions';
import { defineTool, type ToolHandlerResult } from '../tool-definition';
import {
    BENEFIT_USAGE_REASON_MESSAGES,
    benefitUsageRefusalLink,
    fromUsageService
} from './benefit-usage-refusals';

/** Input schema of `undo_benefit_rejection`. */
export const UndoBenefitRejectionInputSchema = z
    .object({
        usageId: z
            .uuid()
            .describe('The id of a REJECTED usage the user rejected, from list_benefit_usages.')
    })
    .strict();

/** What `undo_benefit_rejection` answers. */
export interface UndoBenefitRejectionResult {
    /** Discriminator: the usage is PENDING again. */
    readonly status: 'pending';
    /** The usage. */
    readonly usageId: string;
}

/** `undo_benefit_rejection`: write; it reverts the user's own rejection. */
export const undoBenefitRejectionTool = defineTool({
    name: 'undo_benefit_rejection',
    title: 'Deshacer rechazo de uso',
    description:
        'Reverts a rejection the user made of a benefit usage: the usage goes back to PENDING, waiting for the user to confirm or reject it again, and the other party may declare on the pair again. Only the person who rejected it can undo it; any other usage, or one that does not exist, is reported as not found. Nobody is emailed. Take the usageId from list_benefit_usages (status REJECTED). Call it only when the user asks to undo that rejection.',
    inputSchema: UndoBenefitRejectionInputSchema,
    isWrite: true,
    hints: { destructiveHint: false, idempotentHint: false, openWorldHint: false },
    reasonMessages: BENEFIT_USAGE_REASON_MESSAGES,
    refusalAction: ({ error }) => benefitUsageRefusalLink({ error }),
    auditTarget: ({ input }) => ({ type: 'host_trade_usage', id: input.usageId }),
    handler: async ({ actor, input }): Promise<ToolHandlerResult<UndoBenefitRejectionResult>> => {
        const result = await undoBenefitUsageRejection({ actor, usageId: input.usageId });
        const refused = fromUsageService(result);
        if (refused) {
            return refused;
        }
        return { data: { status: 'pending', usageId: input.usageId } };
    }
});
