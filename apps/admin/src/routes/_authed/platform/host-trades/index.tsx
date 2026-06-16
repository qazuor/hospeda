/**
 * Host-Trades list page — admin directory of local tradespeople / service providers.
 *
 * Uses the generic `createEntityListPage` system (same pattern as destination-attractions).
 * The route and component are generated from `HostTradesRoute` / `HostTradesPageComponent`
 * in the `host-trades` feature config.
 */
import {
    HostTradesPageComponent,
    HostTradesRoute
} from '@/features/host-trades/config/host-trades.config';
import { createFileRoute } from '@tanstack/react-router';

// TanStack Router requirement: bare reference prevents unused-import removal by bundler
createFileRoute;

export const Route = HostTradesRoute;
export { HostTradesPageComponent as default };
