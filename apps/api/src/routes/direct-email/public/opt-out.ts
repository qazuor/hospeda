/**
 * Public direct email opt-out routes (HOS-2685), mounted at
 * `/api/v1/public/direct-emails`.
 *
 * - `GET /opt-out?token=`: validates the signed token and returns the masked address.
 *   It NEVER writes: mail scanners and link previewers prefetch GET links.
 * - `POST /opt-out`: token in the body; adds the address to the suppression list.
 *   Idempotent.
 *
 * A bad or forged token answers 400 `VALIDATION_ERROR` with reason
 * `DIRECT_EMAIL_TOKEN_INVALID`.
 *
 * @module routes/direct-email/public/opt-out
 */

import {
    DirectEmailOptOutBodySchema,
    DirectEmailOptOutPreviewSchema,
    DirectEmailOptOutQuerySchema,
    DirectEmailOptOutResultSchema
} from '@repo/schemas';
import { createRouter } from '../../../utils/create-app';
import { createPublicRoute } from '../../../utils/route-factory';
import { getDirectEmailSuppressionService, unwrapDirectEmailResult } from '../_singletons';

/** Per-IP cap: a person opts out once; scanners and probes should not loop. */
const OPT_OUT_RATE_LIMIT = { requests: 20, windowMs: 60_000 } as const;

/** GET /opt-out: validate the token, return the masked address, write nothing. */
export const publicDirectEmailOptOutPreviewRoute = createPublicRoute({
    method: 'get',
    path: '/opt-out',
    summary: 'Preview a direct email opt-out',
    description: 'Validates the signed token and returns the masked address. Never writes.',
    tags: ['Direct emails'],
    requestQuery: DirectEmailOptOutQuerySchema.shape,
    responseSchema: DirectEmailOptOutPreviewSchema,
    options: { customRateLimit: OPT_OUT_RATE_LIMIT },
    handler: async (ctx, _params, _body, query) => {
        ctx.header('Cache-Control', 'no-store');
        const { token } = DirectEmailOptOutQuerySchema.parse(query ?? {});
        return unwrapDirectEmailResult(
            await getDirectEmailSuppressionService().previewOptOut({ token })
        );
    }
});

/** POST /opt-out: add the address of the token to the suppression list. */
export const publicDirectEmailOptOutRoute = createPublicRoute({
    method: 'post',
    path: '/opt-out',
    summary: 'Opt out of direct emails',
    description: 'Adds the address of the signed token to the suppression list. Idempotent.',
    tags: ['Direct emails'],
    requestBody: DirectEmailOptOutBodySchema,
    responseSchema: DirectEmailOptOutResultSchema,
    successStatusCode: 200,
    options: { customRateLimit: OPT_OUT_RATE_LIMIT },
    handler: async (ctx, _params, body) => {
        ctx.header('Cache-Control', 'no-store');
        const { token } = DirectEmailOptOutBodySchema.parse(body);
        const { maskedEmail } = unwrapDirectEmailResult(
            await getDirectEmailSuppressionService().optOut({ token })
        );
        return { maskedEmail, suppressed: true as const };
    }
});

/** `/api/v1/public/direct-emails`. */
export const directEmailPublicRoutes = createRouter()
    .route('/', publicDirectEmailOptOutPreviewRoute)
    .route('/', publicDirectEmailOptOutRoute);
