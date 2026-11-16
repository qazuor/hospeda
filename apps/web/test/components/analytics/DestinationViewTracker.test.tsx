/**
 * @file DestinationViewTracker.test.tsx
 * @description Unit tests for DestinationViewTracker (HOS-2119 T-030).
 */

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const trackEventMock = vi.fn();
vi.mock('@/lib/analytics/umami-client', () => ({
    trackEvent: (...args: unknown[]) => trackEventMock(...args)
}));

import { DestinationViewTracker } from '@/components/analytics/DestinationViewTracker.client';

const PROPS = {
    destinationId: '550e8400-e29b-41d4-a716-446655440010',
    destinationSlug: 'colon',
    locale: 'es' as const
};

describe('DestinationViewTracker (HOS-2119 T-030)', () => {
    beforeEach(() => {
        trackEventMock.mockClear();
    });

    it('fires destination_viewed once per mount with exact properties', () => {
        // Arrange / Act
        render(<DestinationViewTracker {...PROPS} />);

        // Assert
        expect(trackEventMock).toHaveBeenCalledTimes(1);
        expect(trackEventMock.mock.calls[0]?.[0]).toBe('destination_viewed');
        expect(trackEventMock.mock.calls[0]?.[1]).toEqual({
            destination_id: PROPS.destinationId,
            destination_slug: 'colon',
            locale: 'es',
            source_page: 'destination_detail'
        });
    });
});
