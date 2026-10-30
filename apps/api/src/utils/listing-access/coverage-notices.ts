/**
 * The process-wide coverage-changed notice registry of `apps/api` (contract §3,
 * §7.1; B4.2, HOS-1533).
 *
 * The registry itself is billing's (`createCoverageNoticeRegistry` in
 * `@repo/service-core`); the composition root of `apps/api` is the only place
 * that joins it with the verticals listeners. This module holds the ONE instance
 * every emitter and every listener of the process shares:
 *
 * - emitters: the billing writers (the provider notice receiver and the billing
 *   crons, through their `coverageNotices` port), the trial machine
 *   (`afterCommit.emitCoverageChanged`) and the publication;
 * - listeners: the publication recalculation and the trial conversion, both
 *   through `getListingAccessPorts().billing.onCoverageChanged`.
 *
 * The notice leaves after the commit, with no durable delivery (DEC-ARCH-009
 * 📌2); the daily coverage reconciler is the net.
 *
 * It never imports `@repo/db` nor `listing-access/ports.ts`, so a builder of
 * billing ports (the webhook, a cron) can share the registry without building
 * the whole listing access composition.
 */
import { type CoverageNoticeRegistry, createCoverageNoticeRegistry } from '@repo/service-core';

let registry: CoverageNoticeRegistry | undefined;

/**
 * Returns the single coverage-changed notice registry of the process, created
 * lazily on the first call and the same instance on every call after it.
 *
 * @returns The shared `{ emitCoverageChanged, onCoverageChanged }` registry
 */
export function getCoverageNotices(): CoverageNoticeRegistry {
    if (!registry) registry = createCoverageNoticeRegistry();
    return registry;
}
