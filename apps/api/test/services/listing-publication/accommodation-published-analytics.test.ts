/**
 * HOS-2184 T-018 — the `accommodationPublished` event, shared by the protected
 * publish route and `set_listing_publication`.
 */

import { AnalyticsEvents } from '@repo/analytics';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const capture = vi.hoisted(() => vi.fn());

vi.mock('../../../src/lib/analytics-client', () => ({ captureServerAnalyticsEvent: capture }));

import { captureAccommodationPublished } from '../../../src/services/listing-publication/accommodation-published-analytics';

describe('captureAccommodationPublished', () => {
    beforeEach(() => {
        capture.mockReset();
    });

    it('reports the accommodation with its string facts', () => {
        // Act
        captureAccommodationPublished({
            actorId: 'actor-1',
            accommodation: {
                id: 'acc-1',
                type: 'CABIN',
                destinationId: 'dest-1',
                ownerId: 'owner-1'
            }
        });

        // Assert
        expect(capture).toHaveBeenCalledTimes(1);
        expect(capture).toHaveBeenCalledWith({
            distinctId: 'actor-1',
            name: AnalyticsEvents.accommodationPublished,
            properties: {
                accommodation_id: 'acc-1',
                accommodation_type: 'CABIN',
                destination_id: 'dest-1',
                owner_id: 'owner-1'
            }
        });
    });

    it('forwards the visitor so the event joins the browser session (HOS-2119)', () => {
        // Arrange
        const visitor = {
            ip: '203.0.113.9',
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/130'
        };

        // Act
        captureAccommodationPublished({
            actorId: 'actor-1',
            accommodation: { id: 'acc-1' },
            visitor
        });

        // Assert
        expect(capture.mock.calls).toEqual([
            [
                {
                    distinctId: 'actor-1',
                    name: AnalyticsEvents.accommodationPublished,
                    properties: {
                        accommodation_id: 'acc-1',
                        accommodation_type: undefined,
                        destination_id: undefined,
                        owner_id: undefined
                    },
                    visitor
                }
            ]
        ]);
    });

    it('sends no visitor key when none is given', () => {
        // Act
        captureAccommodationPublished({ actorId: 'actor-1', accommodation: { id: 'acc-1' } });

        // Assert
        expect(capture.mock.calls[0]?.[0]).not.toHaveProperty('visitor');
    });

    it('drops facts that are not strings', () => {
        // Act
        captureAccommodationPublished({
            actorId: 'actor-1',
            accommodation: { id: 'acc-1', type: null, destinationId: 7 }
        });

        // Assert
        expect(capture).toHaveBeenCalledWith(
            expect.objectContaining({
                properties: {
                    accommodation_id: 'acc-1',
                    accommodation_type: undefined,
                    destination_id: undefined,
                    owner_id: undefined
                }
            })
        );
    });
});
