import { ServiceErrorCode } from '@repo/schemas';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { createErrorResponse } from '../../../utils/response-helpers';
import { CampaignResolutionReportSchema } from './campaign-dynamic.schemas';

/** Map campaign domain rejections without exposing unvalidated error details. */
export function handleCampaignError(input: {
    readonly error: unknown;
    readonly ctx: Context;
}): Response {
    const { error, ctx } = input;
    if (error && typeof error === 'object' && 'reason' in error) {
        if (error.reason === 'DYNAMIC_BLOCK_BELOW_MIN') {
            const details = 'details' in error ? error.details : undefined;
            const report = CampaignResolutionReportSchema.parse(
                details && typeof details === 'object' && 'report' in details
                    ? details.report
                    : undefined
            );
            return createErrorResponse(
                {
                    code: 'DYNAMIC_BLOCK_BELOW_MIN',
                    message: 'Dynamic block has fewer eligible items than its minimum',
                    reason: error.reason,
                    details: { report }
                },
                ctx,
                422
            );
        }
        if (error.reason === 'INVALID_DYNAMIC_BLOCK') {
            return createErrorResponse(
                { code: 'INVALID_DYNAMIC_BLOCK', message: 'Invalid dynamic block configuration' },
                ctx,
                400
            );
        }
        if (
            'code' in error &&
            error.code === ServiceErrorCode.ALREADY_EXISTS &&
            ['CAMPAIGN_NOT_DRAFT', 'CAMPAIGN_NOT_SENDABLE', 'CAMPAIGN_NOT_CANCELLABLE'].includes(
                String(error.reason)
            )
        ) {
            throw new HTTPException(409, {
                message: 'message' in error ? String(error.message) : 'Conflict'
            });
        }
    }
    throw error;
}
