/**
 * Google Calendar Sync Cron Job (HOS-157 Phase 2 — Layer 4).
 *
 * Every 6 hours, iterates every ACTIVE Google Calendar connection and runs the
 * declarative occupancy reconcile (`syncAccommodationCalendar`) for each. The
 * same primitive backs the owner's on-demand "sync now" route.
 *
 * ## Why no advisory lock
 *
 * Unlike the billing/weather crons, this job deliberately does NOT take a
 * `pg_try_advisory_xact_lock`. Those jobs either mutate money-adjacent state or
 * do all their writes inside one short transaction; this job interleaves
 * external Google HTTP calls with DB writes PER accommodation, which must never
 * happen inside an open transaction (the documented "no HTTP in a transaction"
 * rule — see `destination-weather-fetch.job.ts`). Overlap protection is instead
 * provided by the sync's DECLARATIVE nature: each run atomically replaces every
 * FUTURE `GOOGLE_CALENDAR` occupancy row via
 * `accommodationOccupancyModel.replaceFutureSyncOccupancy` (a single transaction
 * that deletes the current future set for that source and inserts the freshly
 * computed desired set), and Google refresh tokens are not single-use, so
 * re-running the sync always converges to the same end-state regardless of how
 * many times — or how close together — it runs (wasteful, never corrupting).
 * With a 6-hour cadence and in-process node-cron (which will not start a new
 * run while the previous promise is pending), an actual overlap is not
 * reachable in practice.
 *
 * ## Failure isolation
 *
 * `syncAccommodationCalendar` never throws for operational failures — it
 * records ERROR sync-state and returns a discriminated result. Each iteration
 * is ALSO wrapped defensively so an unexpected throw on one accommodation can
 * never abort the whole sweep.
 *
 * @module cron/jobs/calendar-sync-google
 */

import { accommodationCalendarSyncModel } from '@repo/db';
import { OccupancySourceEnum } from '@repo/schemas';
import { syncAccommodationCalendar } from '../../services/google-calendar/google-calendar-sync.service.js';
import type { CronJobDefinition } from '../types.js';

/**
 * Google Calendar sync cron job definition.
 *
 * Schedule: every 6 hours (`0 *\/6 * * *`).
 */
export const calendarSyncGoogleJob: CronJobDefinition = {
    name: 'calendar-sync-google',
    description: 'Sync occupancy from every active Google Calendar connection',
    schedule: '0 */6 * * *',
    enabled: true,
    timeoutMs: 300000, // 5 minutes

    handler: async (ctx) => {
        const { logger, startedAt, dryRun } = ctx;

        logger.info('Starting Google Calendar sync sweep', {
            dryRun,
            startedAt: startedAt.toISOString()
        });

        try {
            const connections = await accommodationCalendarSyncModel.findAllActiveByProvider({
                provider: OccupancySourceEnum.GOOGLE_CALENDAR
            });

            if (dryRun) {
                const durationMs = Date.now() - startedAt.getTime();
                return {
                    success: true,
                    message: `Dry run - would sync ${connections.length} Google Calendar connection(s)`,
                    processed: connections.length,
                    errors: 0,
                    durationMs,
                    details: { dryRun: true, connections: connections.length }
                };
            }

            let ok = 0;
            let errors = 0;
            let skipped = 0;
            let datesUpserted = 0;
            let datesRemoved = 0;
            const failures: string[] = [];

            for (const connection of connections) {
                try {
                    const result = await syncAccommodationCalendar({
                        accommodationId: connection.accommodationId
                    });

                    if (result.status === 'ok') {
                        ok += 1;
                        datesUpserted += result.datesUpserted;
                        datesRemoved += result.datesRemoved;
                    } else if (result.status === 'error') {
                        errors += 1;
                        failures.push(
                            `${connection.accommodationId}: [${result.kind}] ${result.message}`
                        );
                    } else {
                        skipped += 1;
                    }
                } catch (perError) {
                    // Defensive: syncAccommodationCalendar is designed not to throw
                    // for operational failures, but a programmer error on one row
                    // must not abort the whole sweep.
                    errors += 1;
                    const message = perError instanceof Error ? perError.message : String(perError);
                    failures.push(`${connection.accommodationId}: [threw] ${message}`);
                }
            }

            const durationMs = Date.now() - startedAt.getTime();

            if (failures.length > 0) {
                logger.warn('Google Calendar sync had per-accommodation failures', {
                    failedCount: errors,
                    processed: ok,
                    failures
                });
            }

            logger.info('Google Calendar sync sweep completed', {
                connections: connections.length,
                ok,
                errors,
                skipped,
                datesUpserted,
                datesRemoved,
                durationMs
            });

            return {
                success: errors === 0,
                message: `Synced ${ok}/${connections.length} Google Calendar connection(s) (${errors} error(s), ${skipped} skipped)`,
                processed: ok,
                errors,
                durationMs,
                details: { ok, errors, skipped, datesUpserted, datesRemoved, failures }
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            logger.error('Google Calendar sync sweep failed', {
                error: errorMessage,
                stack: errorStack
            });

            const durationMs = Date.now() - startedAt.getTime();

            return {
                success: false,
                message: `Failed to run Google Calendar sync sweep: ${errorMessage}`,
                processed: 0,
                errors: 1,
                durationMs,
                details: { error: errorMessage, stack: errorStack }
            };
        }
    }
};
