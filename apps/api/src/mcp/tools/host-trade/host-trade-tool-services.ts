/**
 * @file host-trade-tool-services.ts
 * @description The service-core instances the provider and benefit-usage tools
 * read through (HOS-2332). Created on first use, the same services and
 * constructor arguments the `/protected/host-trades` routes use, so a tool can
 * never read through a differently configured path.
 *
 * The usage TRANSITIONS do not go through these: they call
 * `lib/host-trade-usage-transitions.ts`, the helper the routes call, so the
 * declarant's email is sent from one place.
 */

import { HostTradeService, HostTradeUsageService } from '@repo/service-core';
import { apiLogger } from '../../../utils/logger';

let hostTradeService: HostTradeService | undefined;
let hostTradeUsageService: HostTradeUsageService | undefined;

/**
 * The directory service (`GET /protected/host-trades`, `/mine`).
 *
 * @returns The shared instance
 */
export function getHostTradeToolService(): HostTradeService {
    hostTradeService ??= new HostTradeService({ logger: apiLogger });
    return hostTradeService;
}

/**
 * The benefit-usage service (`/usages`, `/usages/pending`, `/mine/usages`).
 *
 * @returns The shared instance
 */
export function getHostTradeUsageToolService(): HostTradeUsageService {
    hostTradeUsageService ??= new HostTradeUsageService({ logger: apiLogger });
    return hostTradeUsageService;
}
