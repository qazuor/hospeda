import type { Clock } from '@repo/billing-verticals-contract';
import type { DrizzleClient } from '@repo/db';
import { domainEventModel, reconciliationPauseGiftModel } from '@repo/db';
import { BILLING_CYCLE_MONTHS, type BillingCycle } from '@repo/schemas';
import { computePauseGift } from './pause-gift.js';

type Cycle = BillingCycle;
const CYCLE_MONTHS: Readonly<Record<Cycle, number>> = BILLING_CYCLE_MONTHS;

function isCycle(value: string | null): value is Cycle {
    return value !== null && Object.hasOwn(CYCLE_MONTHS, value);
}

export interface PauseGiftSummary {
    readonly examined: number;
    readonly detected: number;
    readonly notGifted: number;
    readonly skipped: number;
    readonly failures: ReadonlyArray<{ readonly pauseId: string; readonly message: string }>;
}
export interface PauseGiftPorts {
    readonly clock: Clock;
    readonly tx?: DrizzleClient;
}

export async function runPauseGiftDetection(
    input: { readonly correlationId: string; readonly pageSize: number },
    ports: PauseGiftPorts
): Promise<PauseGiftSummary> {
    const now = ports.clock.now();
    const endedSince = new Date(now.getTime() - 45 * 86_400_000);
    let examined = 0,
        detected = 0,
        notGifted = 0,
        skipped = 0;
    const failures: { pauseId: string; message: string }[] = [];
    let afterPauseId: string | undefined;
    for (;;) {
        const page = await reconciliationPauseGiftModel.listEndedPausePage({
            endedSince,
            afterPauseId,
            limit: input.pageSize,
            tx: ports.tx
        });
        for (const pause of page) {
            examined++;
            if (!isCycle(pause.cycle)) {
                skipped++;
                continue;
            }
            try {
                const gift = computePauseGift({
                    pauseStartedAt: pause.startsAt,
                    pauseEndedAt: pause.actualEndAt,
                    anchorChargeAt: pause.nextChargeAt,
                    cycleMonths: CYCLE_MONTHS[pause.cycle]
                });
                if (!gift) {
                    notGifted++;
                    continue;
                }
                await domainEventModel.insert({
                    eventType: 'reconciliation.pause_gift_detected',
                    entityType: 'subscription_pause',
                    entityId: pause.pauseId,
                    actorType: 'job',
                    correlationId: input.correlationId,
                    occurredAt: now,
                    changes: [
                        { field: 'subscription.id', new: pause.subscriptionId },
                        { field: 'pause.starts_at', new: pause.startsAt.toISOString() },
                        { field: 'pause.ended_at', new: pause.actualEndAt.toISOString() },
                        {
                            field: 'charge.first_skipped_at',
                            new: gift.firstSkippedChargeAt.toISOString()
                        },
                        {
                            field: 'charge.next_after_return_at',
                            new: gift.nextChargeAfterReturnAt.toISOString()
                        },
                        { field: 'gift.days', new: gift.giftDays },
                        { field: 'gift.cycle_months', new: CYCLE_MONTHS[pause.cycle] }
                    ],
                    tx: ports.tx
                });
                detected++;
            } catch (error) {
                failures.push({
                    pauseId: pause.pauseId,
                    message: error instanceof Error ? error.message : String(error)
                });
            }
        }
        if (page.length < input.pageSize) break;
        afterPauseId = page.at(-1)?.pauseId;
    }
    return { examined, detected, notGifted, skipped, failures };
}
