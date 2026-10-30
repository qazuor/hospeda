/**
 * The real coverage-changed notice registry (contract §3, §7.1; B4.2).
 *
 * "La cobertura de (user, vertical) cambió" is the only thing billing pushes
 * to verticals. Per DEC-ARCH-009 📌2 it leaves AFTER the commit of the write
 * that changed the answer, with no durable delivery: nothing is stored, queued
 * or retried here (the `U2` outbox is for e-mail only). A lost notice is a
 * declared case; the daily coverage reconciler of verticals is the net, with
 * up to one day of delay.
 *
 * The registry lives in the billing half (contract §7.1: the real forward
 * implementation is billing's); the composition root of `apps/api` is the only
 * place that joins it with the verticals listeners. This module never imports
 * `@repo/db`.
 */
import {
    type BillingForVerticals,
    type ContractListener,
    type CoverageChangedEvent,
    CoverageChangedEventSchema,
    type Unsubscribe
} from '@repo/billing-verticals-contract';
import { createLogger } from '@repo/logger';
import type { CoverageNotices } from '../payment/payment-ports';

const logger = createLogger('coverage-notice-registry');

/**
 * One registry that both emits (the `CoverageNotices` port the billing writers
 * call after their commit) and subscribes (the `onCoverageChanged` half of
 * `BillingForVerticals`).
 */
export type CoverageNoticeRegistry = CoverageNotices &
    Pick<BillingForVerticals, 'onCoverageChanged'>;

/**
 * Creates an independent coverage-changed notice registry (contract §3,
 * DEC-ARCH-009 📌2).
 *
 * - `emitCoverageChanged(event)` validates the event with
 *   `CoverageChangedEventSchema` (an invalid event throws and reaches no
 *   listener), delivers it to a snapshot of the registered listeners, and
 *   waits for all of them. A listener that fails is logged and does not stop
 *   the others; the promise resolves anyway, because the notice was emitted
 *   and the failure belongs to the consumer.
 * - `onCoverageChanged(listener)` registers a listener and returns an
 *   idempotent `Unsubscribe`.
 *
 * Nothing is persisted, enqueued or retried. There is no module-level state:
 * every call returns a registry that sees no other registry's listeners.
 *
 * @returns `{ emitCoverageChanged, onCoverageChanged }`
 */
export function createCoverageNoticeRegistry(): CoverageNoticeRegistry {
    const entries = new Set<{ readonly listener: ContractListener<CoverageChangedEvent> }>();
    return {
        onCoverageChanged(listener: ContractListener<CoverageChangedEvent>): Unsubscribe {
            const entry = { listener };
            entries.add(entry);
            return () => {
                entries.delete(entry);
            };
        },
        async emitCoverageChanged(event: CoverageChangedEvent): Promise<void> {
            const parsed = CoverageChangedEventSchema.parse(event);
            const snapshot = [...entries];
            const results = await Promise.allSettled(
                snapshot.map(async (entry) => entry.listener(parsed))
            );
            for (const result of results) {
                if (result.status === 'rejected') {
                    logger.error(
                        {
                            userId: parsed.userId,
                            vertical: parsed.vertical,
                            sourceType: parsed.sourceType,
                            change: parsed.change,
                            error: result.reason
                        },
                        'Coverage changed listener failed'
                    );
                }
            }
        }
    };
}
