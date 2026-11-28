/**
 * Lazy service singletons of the direct email routes (HOS-2685).
 *
 * Own module so the admin, public and webhook code share one construction, and so
 * tests have a single seam (`_resetDirectEmailSingletons`).
 *
 * @module routes/direct-email/_singletons
 */

import { ServiceErrorCode } from '@repo/schemas';
import {
    DirectEmailMessageService,
    DirectEmailSuppressionService,
    DirectEmailTemplateService,
    type ServiceOutput
} from '@repo/service-core';
// `/types` is the ServiceError class `handleRouteError` checks with `instanceof`.
import { ServiceError } from '@repo/service-core/types';
import { createDirectEmailMailer } from '../../services/direct-email/direct-email-mailer';
import { resolveDirectEmailFromEmail } from '../../utils/email-sender';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';

let cachedMessageService: DirectEmailMessageService | null = null;
let cachedTemplateService: DirectEmailTemplateService | null = null;
let cachedSuppressionService: DirectEmailSuppressionService | null = null;

/** Site origin the opt-out page lives on. */
function siteUrl(): string {
    return env.HOSPEDA_SITE_URL ?? 'https://hospeda.com.ar';
}

/**
 * Process-wide {@link DirectEmailMessageService}: Brevo mailer, direct sender with the
 * `getEmailSender()` fallback, newsletter HMAC secret for the opt-out tokens.
 *
 * @returns The service
 */
export function getDirectEmailMessageService(): DirectEmailMessageService {
    if (!cachedMessageService) {
        cachedMessageService = new DirectEmailMessageService(
            { logger: apiLogger },
            {
                mailer: createDirectEmailMailer(),
                resolveFromEmail: resolveDirectEmailFromEmail,
                hmacSecret: env.HOSPEDA_NEWSLETTER_HMAC_SECRET,
                siteUrl: siteUrl()
            }
        );
    }
    return cachedMessageService;
}

/**
 * Process-wide {@link DirectEmailTemplateService}.
 *
 * @returns The service
 */
export function getDirectEmailTemplateService(): DirectEmailTemplateService {
    if (!cachedTemplateService) {
        cachedTemplateService = new DirectEmailTemplateService({ logger: apiLogger });
    }
    return cachedTemplateService;
}

/**
 * Process-wide {@link DirectEmailSuppressionService}.
 *
 * @returns The service
 */
export function getDirectEmailSuppressionService(): DirectEmailSuppressionService {
    if (!cachedSuppressionService) {
        cachedSuppressionService = new DirectEmailSuppressionService(
            { logger: apiLogger },
            {
                hmacSecret: env.HOSPEDA_NEWSLETTER_HMAC_SECRET,
                hmacSecretPrev: env.HOSPEDA_NEWSLETTER_HMAC_SECRET_PREV
            }
        );
    }
    return cachedSuppressionService;
}

/**
 * Returns the data of a service call, or throws the service error so the route factory
 * maps it to its HTTP status (error contract).
 *
 * @param result - A service output
 * @returns The data
 * @throws {ServiceError} when the output carries an error
 */
export function unwrapDirectEmailResult<T>(result: ServiceOutput<T>): T {
    if (result.error) {
        throw new ServiceError(
            result.error.code,
            result.error.message,
            result.error.details,
            result.error.reason
        );
    }
    if (result.data === undefined) {
        throw new ServiceError(
            ServiceErrorCode.INTERNAL_ERROR,
            'Service returned neither data nor error'
        );
    }
    return result.data;
}

/**
 * Resets the cached services. Test seam: never call from production code.
 */
export function _resetDirectEmailSingletons(): void {
    cachedMessageService = null;
    cachedTemplateService = null;
    cachedSuppressionService = null;
}
