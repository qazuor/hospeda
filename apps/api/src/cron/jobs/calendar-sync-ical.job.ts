/**
 * iCal Calendar Sync Cron Job (HOS-162 Phase 3 — Layer E).
 *
 * Every 6 hours, iterates every ACTIVE iCal connection across all three iCal
 * providers (`AIRBNB`, `BOOKING`, `OTHER`) and runs the declarative occupancy
 * reconcile (`syncAccommodationIcalCalendar`) for each. The same primitive
 * backs the owner's on-demand "sync now" route.
 *
 * ## Why no advisory lock
 *
 * Mirrors `calendar-sync-google.job.ts`: this job interleaves external HTTP
 * feed fetches with per-accommodation DB writes, which must never happen inside
 * an open transaction (the "no HTTP in a transaction" rule). Overlap protection
 * comes from the sync's DECLARATIVE nature — each run atomically replaces every
 * FUTURE occupancy row for that `(accommodation, provider)` via
 * `replaceFutureSyncOccupancy`, and an iCal feed is a full snapshot by nature,
 * so re-running always converges to the same end-state (wasteful, never
 * corrupting). With a 6-hour cadence and in-process node-cron (which will not
 * start a new run while the previous promise is pending), an actual overlap is
 * not reachable in practice.
 *
 * ## Failure isolation
 *
 * `syncAccommodationIcalCalendar` never throws for operational failures — it
 * records ERROR sync-state, notifies the host, and returns a discriminated
 * result. Each iteration is ALSO wrapped defensively so an unexpected throw on
 * one connection can never abort the whole sweep.
 *
 * @module cron/jobs/calendar-sync-ical
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import { OccupancySourceEnum } from '@repo/schemas';
import { syncAccommodationIcalCalendar } from '../../services/ical-calendar/ical-calendar-sync.service.js';
import type { IcalProvider } from '../../services/ical-calendar/ical-credential.repository.js';
import type { CronJobDefinition } from '../types.js';

/** The three providers whose connections are stored as iCal feeds. */
const ICAL_PROVIDERS: readonly IcalProvider[] = [
    OccupancySourceEnum.AIRBNB,
    OccupancySourceEnum.BOOKING,
    OccupancySourceEnum.OTHER
];

/**
 * iCal calendar sync cron job definition.
 *
 * Schedule: every 6 hours (`0 *\/6 * * *`).
 */
export const calendarSyncIcalJob: CronJobDefinition = {
    name: 'calendar-sync-ical',
    description: 'Sync occupancy from every active Airbnb/Booking/other iCal feed',
    schedule: '0 */6 * * *',
    enabled: true,
    timeoutMs: 300000, // 5 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting iCal calendar sync sweep', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const perProvider = await Promise.all(
                ICAL_PROVIDERS.map(async (provider) => ({
                    provider,
                    connections: await accommodationCalendarSyncModel.findAllActiveByProvider({
                        provider
                    })
                }))
            );
            const totalConnections = perProvider.reduce((n, p) => n + p.connections.length, 0);

            if (dryRun) {
                const durationMs = Date.now() - startedAt.getTime();
                return {
                    success: true,
                    message: `Dry run - would sync ${totalConnections} iCal connection(s)`,
                    processed: totalConnections,
                    errors: 0,
                    durationMs,
                    details: { dryRun: true, connections: totalConnections }
                };
            }

            let ok = 0;
            let errors = 0;
            let skipped = 0;
            let inserted = 0;
            let removed = 0;
            const failures: string[] = [];

            for (const { provider, connections } of perProvider) {
                for (const connection of connections) {
                    try {
                        const result = await syncAccommodationIcalCalendar({
                            accommodationId: connection.accommodationId,
                            provider
                        });

                        if (result.status === 'ok') {
                            ok += 1;
                            inserted += result.inserted;
                            removed += result.removed;
                        } else if (result.status === 'error') {
                            errors += 1;
                            failures.push(
                                `${connection.accommodationId} [${provider}]: [${result.kind}] ${result.message}`
                            );
                        } else {
                            skipped += 1;
                        }
                    } catch (perError) {
                        // Defensive: syncAccommodationIcalCalendar is designed not to
                        // throw for operational failures, but a programmer error on one
                        // row must not abort the whole sweep.
                        errors += 1;
                        const message =
                            perError instanceof Error ? perError.message : String(perError);
                        failures.push(
                            `${connection.accommodationId} [${provider}]: [threw] ${message}`
                        );
                    }
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            if (failures.length > 0) {
                logger.warn('iCal calendar sync had per-connection failures', {
                    failedCount: errors,
                    processed: ok,
                    failures
                });
            }

            logger.info('iCal calendar sync sweep completed', {
                connections: totalConnections,
                ok,
                errors,
                skipped,
                inserted,
                removed,
                durationMs
            });

            return {
                success: errors === 0,
                message: `Synced ${ok}/${totalConnections} iCal connection(s) (${errors} error(s), ${skipped} skipped)`,
                processed: ok,
                errors,
                durationMs,
                details: { ok, errors, skipped, inserted, removed, failures }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('iCal calendar sync sweep failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to run iCal calendar sync sweep: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
};
