import { randomUUID } from 'node:crypto';
import type { Clock } from '@repo/billing-verticals-contract';
import { addonInstances, and, domainEventModel, eq, getDb, isNotNull, lte } from '@repo/db';
import { createLogger } from '@repo/logger';
import { z } from 'zod';
import type { CoverageNotices } from '../payment/payment-ports';
import { emitAddonCoverageRemoved } from './addon-instance-a5';
import type { AddonOrphanhoodPorts } from './addon-orphanhood-ports';
import { removedCoverageVerticalsOf } from './addon-removed-coverage-verticals';

const logger = createLogger('addon-instance-a4');
const limitSchema = z.number().int().positive();

/** Ports needed to expire fixed-days addon instances. */
export interface ExpireAddonInstancesPorts {
    readonly clock: Clock;
    readonly coverageNotices: CoverageNotices;
    readonly listing: AddonOrphanhoodPorts['listing'];
}

/** Counts of one A4 expiry pass. */
export interface ExpireAddonInstancesSummary {
    readonly examined: number;
    readonly expired: number;
    readonly skipped: number;
    readonly failed: number;
}

/** Expires each due ACTIVE instance in its own transaction, then emits its removal notice. */
export async function expireAddonInstances(
    limit: number,
    ports: ExpireAddonInstancesPorts
): Promise<ExpireAddonInstancesSummary> {
    limitSchema.parse(limit);
    const now = ports.clock.now();
    const rows = await getDb()
        .select({ id: addonInstances.id })
        .from(addonInstances)
        .where(
            and(
                eq(addonInstances.status, 'ACTIVE'),
                isNotNull(addonInstances.endsAt),
                lte(addonInstances.endsAt, now)
            )
        )
        .orderBy(addonInstances.endsAt, addonInstances.id)
        .limit(limit);
    let expired = 0;
    let skipped = 0;
    let failed = 0;
    for (const row of rows) {
        try {
            const result = await getDb().transaction(async (tx) => {
                const [instance] = await tx
                    .select()
                    .from(addonInstances)
                    .where(eq(addonInstances.id, row.id))
                    .limit(1)
                    .for('update');
                if (instance?.status !== 'ACTIVE' || !instance.endsAt || instance.endsAt > now)
                    return null;
                if (instance.complementSubscriptionId) {
                    logger.error({ instanceId: instance.id }, 'Fixed-days addon has a complement');
                    return null;
                }
                const coverageVerticals = await removedCoverageVerticalsOf({
                    tx,
                    instance,
                    ports
                });
                const [updated] = await tx
                    .update(addonInstances)
                    .set({ status: 'EXPIRED', updatedAt: now })
                    .where(
                        and(
                            eq(addonInstances.id, instance.id),
                            eq(addonInstances.status, 'ACTIVE'),
                            lte(addonInstances.endsAt, now)
                        )
                    )
                    .returning({ id: addonInstances.id });
                if (!updated) return null;
                await domainEventModel.insert({
                    eventType: 'addon_instance.status_changed',
                    entityType: 'addon_instance',
                    entityId: instance.id,
                    actorType: 'job',
                    actorId: null,
                    correlationId: randomUUID(),
                    changes: [{ field: 'status', old: 'ACTIVE', new: 'EXPIRED' }],
                    occurredAt: now,
                    tx
                });
                return { instance, coverageVerticals };
            });
            if (!result) {
                skipped++;
                continue;
            }
            expired++;
            await emitAddonCoverageRemoved({
                cancelled: [
                    {
                        instanceId: result.instance.id,
                        ownerId: result.instance.ownerId,
                        clause: 'ORPHANED',
                        coverageVerticals: result.coverageVerticals,
                        complementSubscriptionId: null,
                        providerCancellation: null
                    }
                ],
                coverageNotices: {
                    emitCoverageChanged: (notice) =>
                        ports.coverageNotices.emitCoverageChanged(notice)
                }
            });
        } catch (error) {
            failed++;
            logger.error(
                {
                    instanceId: row.id,
                    error: error instanceof Error ? error.message : String(error)
                },
                'Addon instance expiry failed'
            );
        }
    }
    return { examined: rows.length, expired, skipped, failed };
}
