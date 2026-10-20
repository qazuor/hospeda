import type { CoverageChangedEvent } from '@repo/billing-verticals-contract';
import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { getCoverageNotices } from '../../../src/utils/listing-access/coverage-notices';

describe('TEST:B4:2 the process-wide coverage notice registry (HOS-1533, I-9)', () => {
    it('returns the same registry instance on every call', () => {
        // Arrange / Act
        const first = getCoverageNotices();
        const second = getCoverageNotices();

        // Assert
        expect(second).toBe(first);
    });

    it('delivers what emitCoverageChanged emits to a listener registered by onCoverageChanged', async () => {
        // Arrange
        const received: CoverageChangedEvent[] = [];
        const stop = getCoverageNotices().onCoverageChanged((event) => {
            received.push(event);
        });
        const event: CoverageChangedEvent = {
            userId: '00000000-0000-4000-8000-0000000b4201',
            vertical: VerticalEnum.ACCOMMODATION,
            sourceType: 'SUBSCRIPTION',
            change: 'CHANGED'
        };

        // Act
        await getCoverageNotices().emitCoverageChanged(event);
        stop();
        await getCoverageNotices().emitCoverageChanged(event);

        // Assert
        expect(received).toEqual([event]);
    });
});
