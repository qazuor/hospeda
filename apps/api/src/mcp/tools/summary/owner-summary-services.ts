/**
 * @file owner-summary-services.ts
 * @description The benefit-usage services `get_owner_summary` reads through
 * (HOS-2331). Created on first use with the same constructor arguments the
 * `/protected/host-trades` routes use (`new …Service({ logger: apiLogger })`),
 * so the summary counts exactly what the portal's inboxes count.
 *
 * HOS-2332 (PR #4501) adds the equivalent getters for its own tools in
 * `../host-trade/host-trade-tool-services.ts`; once both are on staging the
 * summary can switch to those and this file goes away.
 */

import { HostTradeService, HostTradeUsageService } from '@repo/service-core';
import { apiLogger } from '../../../utils/logger';

let hostTradeService: HostTradeService | undefined;
let hostTradeUsageService: HostTradeUsageService | undefined;

/**
 * The directory service (`GET /protected/host-trades/mine` → `getOwn`).
 *
 * @returns The shared instance
 */
export function getSummaryHostTradeService(): HostTradeService {
    hostTradeService ??= new HostTradeService({ logger: apiLogger });
    return hostTradeService;
}

/**
 * The benefit-usage service (`/usages/pending/count`, `/mine/usages`).
 *
 * @returns The shared instance
 */
export function getSummaryHostTradeUsageService(): HostTradeUsageService {
    hostTradeUsageService ??= new HostTradeUsageService({ logger: apiLogger });
    return hostTradeUsageService;
}
