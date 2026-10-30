import { VerticalEnum } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    mediaDelete,
    mediaProvider,
    deleteMediaRow,
    deleteCalendarRow,
    revoke,
    revocationPortAvailable
} = vi.hoisted(() => ({
    mediaDelete: vi.fn(),
    mediaProvider: vi.fn(),
    deleteMediaRow: vi.fn(),
    deleteCalendarRow: vi.fn(),
    revoke: vi.fn(),
    revocationPortAvailable: { value: true }
}));
vi.mock('../../../src/services/media', () => ({ getMediaProvider: mediaProvider }));
vi.mock('@repo/db', () => ({
    listingPurgeModel: {
        deleteMarkedMedia: deleteMediaRow,
        deleteMarkedCalendarConnection: deleteCalendarRow
    }
}));
vi.mock('@repo/service-core', () => ({
    getCalendarConnectionRevocationPort: () =>
        revocationPortAvailable.value ? { revoke } : undefined
}));
vi.mock('../../../src/utils/listing-publication/ports', () => ({
    getListingPublicationPorts: () => ({
        afterCommit: { emitCoverageChanged: vi.fn(), invalidateUser: vi.fn(), revalidate: vi.fn() }
    })
}));

import {
    emitListingPurged,
    onListingPurged
} from '../../../src/utils/listing-publication/listing-purged-emitter';
import { getPurgeAfterCommit } from '../../../src/utils/listing-publication/purge-ports';

describe('TEST:V6:13 PB12 production ports', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        revocationPortAvailable.value = true;
        mediaProvider.mockReturnValue({ delete: mediaDelete });
        mediaDelete.mockResolvedValue(undefined);
        deleteMediaRow.mockResolvedValue(true);
        deleteCalendarRow.mockResolvedValue(true);
        revoke.mockResolvedValue({ revoked: true });
    });

    it('TEST:V6:13 deletes the provider object before deleting its marked row', async () => {
        const order: string[] = [];
        mediaDelete.mockImplementation(async () => {
            order.push('provider');
        });
        deleteMediaRow.mockImplementation(async () => {
            order.push('row');
        });
        await getPurgeAfterCommit().deleteRemoteMedia({
            vertical: VerticalEnum.ACCOMMODATION,
            mediaId: 'media',
            publicId: 'cloud-id'
        });
        expect(order).toEqual(['provider', 'row']);
    });

    it('TEST:V6:13 retains the marked row when provider deletion fails or is unavailable', async () => {
        mediaDelete.mockRejectedValue(new Error('offline'));
        await expect(
            getPurgeAfterCommit().deleteRemoteMedia({
                vertical: VerticalEnum.ACCOMMODATION,
                mediaId: 'm',
                publicId: 'p'
            })
        ).rejects.toThrow('offline');
        expect(deleteMediaRow).not.toHaveBeenCalled();
        mediaProvider.mockReturnValue(null);
        await expect(
            getPurgeAfterCommit().deleteRemoteMedia({
                vertical: VerticalEnum.ACCOMMODATION,
                mediaId: 'm',
                publicId: 'p'
            })
        ).rejects.toThrow('unavailable');
        expect(deleteMediaRow).not.toHaveBeenCalled();
    });

    it('TEST:V6:13 deletes a media row without calling storage when publicId is absent', async () => {
        await getPurgeAfterCommit().deleteRemoteMedia({
            vertical: VerticalEnum.EXPERIENCE,
            mediaId: 'm',
            publicId: null
        });
        expect(mediaProvider).not.toHaveBeenCalled();
        expect(deleteMediaRow).toHaveBeenCalledOnce();
    });

    it('TEST:V6:13 deletes calendar rows after confirmed revocation or for non-Google iCal providers', async () => {
        await getPurgeAfterCommit().revokeCalendarConnection({
            connectionId: 'c1',
            accommodationId: 'a1',
            provider: 'GOOGLE_CALENDAR'
        });
        expect(deleteCalendarRow).toHaveBeenCalledOnce();
        revoke.mockResolvedValue({ revoked: false, reason: 'not revocable' });
        await getPurgeAfterCommit().revokeCalendarConnection({
            connectionId: 'c2',
            accommodationId: 'a1',
            provider: 'AIRBNB'
        });
        expect(deleteCalendarRow).toHaveBeenCalledTimes(2);
    });

    it('TEST:V6:13 keeps the calendar row marked when revocation fails', async () => {
        revoke.mockResolvedValue({ revoked: false, reason: 'provider unavailable' });
        await expect(
            getPurgeAfterCommit().revokeCalendarConnection({
                connectionId: 'c',
                accommodationId: 'a',
                provider: 'GOOGLE_CALENDAR'
            })
        ).rejects.toThrow('provider unavailable');
        expect(deleteCalendarRow).not.toHaveBeenCalled();
    });

    it('TEST:V6:13 keeps the marked calendar row when no revocation port is registered', async () => {
        revocationPortAvailable.value = false;
        await expect(
            getPurgeAfterCommit().revokeCalendarConnection({
                connectionId: 'c',
                accommodationId: 'a',
                provider: 'GOOGLE_CALENDAR'
            })
        ).rejects.toThrow('unavailable');
        expect(deleteCalendarRow).not.toHaveBeenCalled();
    });

    it('TEST:V6:13 emits to all listeners despite failures and rejects invalid events', async () => {
        const received: string[] = [];
        const stopFirst = onListingPurged(async () => {
            throw new Error('listener');
        });
        const stopSecond = onListingPurged((event) => {
            received.push(event.listingId);
        });
        await expect(emitListingPurged({ listingId: '' })).rejects.toThrow();
        await emitListingPurged({ listingId: '9f09ab3e-c45c-4f68-9d95-b14b06681192' });
        await new Promise<void>((resolve) => setTimeout(resolve, 60));
        expect(received).toEqual(['9f09ab3e-c45c-4f68-9d95-b14b06681192']);
        stopFirst();
        stopSecond();
    });
});
