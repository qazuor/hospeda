import type {
    BillingForVerticals,
    CoverageChangedEvent
} from '@repo/billing-verticals-contract';
import { type LogEntry, registerHook, unregisterHook } from '@repo/logger';
import { VerticalEnum } from '@repo/schemas';
import { afterEach, describe, expect, it } from 'vitest';
import { createCoverageNoticeRegistry } from '../../../../src/services/billing/coverage/coverage-notice-registry';
import type { CoverageNotices } from '../../../../src/services/billing/payment/payment-ports';

const HOOK = 'coverage-notice-registry-test';

afterEach(() => unregisterHook(HOOK));

function event(): CoverageChangedEvent {
    return {
        userId: crypto.randomUUID(),
        vertical: VerticalEnum.ACCOMMODATION,
        sourceType: 'SUBSCRIPTION',
        change: 'CHANGED'
    };
}

describe('TEST:B4:2 the real coverage-changed notice registry (AC:B4:2)', () => {
    it('satisfies both the emitter port and the onCoverageChanged half at runtime', () => {
        // Arrange
        const registry = createCoverageNoticeRegistry();
        const emitter: CoverageNotices = registry;
        const subscriber: Pick<BillingForVerticals, 'onCoverageChanged'> = registry;

        // Assert
        expect(typeof emitter.emitCoverageChanged).toBe('function');
        expect(typeof subscriber.onCoverageChanged).toBe('function');
        expect(typeof subscriber.onCoverageChanged(() => undefined)).toBe('function');
    });

    it('(a) delivers the validated event to every listener and waits for all of them', async () => {
        // Arrange
        const registry = createCoverageNoticeRegistry();
        const received: { readonly who: string; readonly event: CoverageChangedEvent }[] = [];
        let slowFinished = false;
        registry.onCoverageChanged(async (delivered) => {
            await new Promise((resolve) => setTimeout(resolve, 30));
            slowFinished = true;
            received.push({ who: 'slow', event: delivered });
        });
        registry.onCoverageChanged((delivered) => {
            received.push({ who: 'fast', event: delivered });
        });
        const notice = event();

        // Act
        await registry.emitCoverageChanged(notice);

        // Assert
        expect(slowFinished).toBe(true);
        expect(received).toEqual([
            { who: 'fast', event: notice },
            { who: 'slow', event: notice }
        ]);
    });

    it('(b) an invalid event throws and reaches no listener', async () => {
        // Arrange
        const registry = createCoverageNoticeRegistry();
        const received: unknown[] = [];
        registry.onCoverageChanged((delivered) => {
            received.push(delivered);
        });
        const unknownVertical = { ...event(), vertical: 'spaceport' };
        const extraField = { ...event(), extra: true };

        // Act & Assert
        await expect(
            registry.emitCoverageChanged(unknownVertical as unknown as CoverageChangedEvent)
        ).rejects.toThrow();
        await expect(
            registry.emitCoverageChanged(extraField as unknown as CoverageChangedEvent)
        ).rejects.toThrow();
        expect(received).toEqual([]);
    });

    it('(c) a failing listener does not stop the others, is logged, and the emit resolves', async () => {
        // Arrange
        const registry = createCoverageNoticeRegistry();
        const errors: LogEntry[] = [];
        registerHook(HOOK, (entry) => {
            if (entry.level === 'ERROR' && entry.category === 'coverage-notice-registry')
                errors.push(entry);
        });
        const received: CoverageChangedEvent[] = [];
        registry.onCoverageChanged(async () => {
            throw new Error('listener down');
        });
        registry.onCoverageChanged(() => {
            throw new Error('sync listener down');
        });
        registry.onCoverageChanged((delivered) => {
            received.push(delivered);
        });
        const notice = event();

        // Act
        await expect(registry.emitCoverageChanged(notice)).resolves.toBeUndefined();

        // Assert
        expect(received).toEqual([notice]);
        expect(errors).toHaveLength(2);
        for (const entry of errors) {
            expect(entry.data).toMatchObject({
                userId: notice.userId,
                vertical: notice.vertical,
                sourceType: notice.sourceType,
                change: notice.change
            });
        }
    });

    it('(d) Unsubscribe removes the listener and calling it twice does not break', async () => {
        // Arrange
        const registry = createCoverageNoticeRegistry();
        const kept: CoverageChangedEvent[] = [];
        const removed: CoverageChangedEvent[] = [];
        const listener = (delivered: CoverageChangedEvent) => {
            removed.push(delivered);
        };
        const unsubscribeFirst = registry.onCoverageChanged(listener);
        registry.onCoverageChanged(listener);
        registry.onCoverageChanged((delivered) => {
            kept.push(delivered);
        });
        const notice = event();

        // Act
        unsubscribeFirst();
        unsubscribeFirst();
        await registry.emitCoverageChanged(notice);

        // Assert: only the first registration went away; the second one stays
        expect(removed).toEqual([notice]);
        expect(kept).toEqual([notice]);
    });

    it('(e) two registries created separately do not see each other', async () => {
        // Arrange
        const first = createCoverageNoticeRegistry();
        const second = createCoverageNoticeRegistry();
        const firstReceived: CoverageChangedEvent[] = [];
        const secondReceived: CoverageChangedEvent[] = [];
        first.onCoverageChanged((delivered) => {
            firstReceived.push(delivered);
        });
        second.onCoverageChanged((delivered) => {
            secondReceived.push(delivered);
        });
        const notice = event();

        // Act
        await first.emitCoverageChanged(notice);

        // Assert
        expect(firstReceived).toEqual([notice]);
        expect(secondReceived).toEqual([]);
    });
});
