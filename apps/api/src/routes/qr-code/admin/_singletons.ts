/**
 * The one {@link QrCodeService} the admin QR routes share.
 *
 * Kept in its own module so the six handlers do not each construct their own —
 * and, more usefully, so there is a single place to look when a test needs to
 * know what the routes actually talk to. The service takes nothing but a logger,
 * so there is no lazy-initialisation dance here: constructing it at import time
 * is safe, and `apps/api`'s global `@repo/db` mock already exports
 * `QrCodeModel` / `QrCodeScanModel` for exactly this reason.
 *
 * @module routes/qr-code/admin/_singletons
 */

import { QrCodeService } from '@repo/service-core';
import { apiLogger } from '../../../utils/logger';

/** Process-wide service instance shared by every admin QR handler. */
export const qrCodeService = new QrCodeService({ logger: apiLogger });
