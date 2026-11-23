/**
 * Owner decision 16: discarded partner logos are deleted from the provider,
 * only when they are this partner's own uploaded logos, and never fail the
 * request.
 */
import { describe, expect, it, vi } from 'vitest';
import { deletePartnerLogoOrphans } from '../../../src/services/partner-presence/partner-logo-orphan-cleanup';

const CLOUD = 'hospeda-test';
const PARTNER = 'p-1';
const url = (path: string) => `https://res.cloudinary.com/${CLOUD}/image/upload/v1/${path}.png`;

describe('deletePartnerLogoOrphans', () => {
    it('deletes this partner logo assets and nothing else', async () => {
        // Arrange
        const remove = vi.fn().mockResolvedValue(undefined);

        // Act
        const result = await deletePartnerLogoOrphans({
            partnerId: PARTNER,
            urls: [
                url(`hospeda/test/partners/${PARTNER}/logo/abc`),
                url('hospeda/test/partners/other/logo/xyz'),
                url(`hospeda/test/partners/${PARTNER}/gallery/def`),
                'https://images.pexels.com/seed.png'
            ],
            mediaProvider: { delete: remove },
            cloudName: CLOUD
        });

        // Assert
        expect(remove).toHaveBeenCalledTimes(1);
        expect(remove).toHaveBeenCalledWith({
            publicId: `hospeda/test/partners/${PARTNER}/logo/abc`
        });
        expect(result).toEqual({
            deleted: [`hospeda/test/partners/${PARTNER}/logo/abc`],
            skipped: 3,
            failed: []
        });
    });

    it('does not call the provider when nothing was discarded', async () => {
        const remove = vi.fn();
        const result = await deletePartnerLogoOrphans({
            partnerId: PARTNER,
            urls: [],
            mediaProvider: { delete: remove },
            cloudName: CLOUD
        });
        expect(remove).not.toHaveBeenCalled();
        expect(result.deleted).toEqual([]);
    });

    it('swallows a provider failure and reports it', async () => {
        const remove = vi.fn().mockRejectedValue(new Error('cloudinary down'));
        const publicId = `hospeda/test/partners/${PARTNER}/logo/abc`;
        const result = await deletePartnerLogoOrphans({
            partnerId: PARTNER,
            urls: [url(publicId)],
            mediaProvider: { delete: remove },
            cloudName: CLOUD
        });
        expect(result).toEqual({ deleted: [], skipped: 0, failed: [publicId] });
    });

    it('leaves the assets in place when no provider is configured', async () => {
        const publicId = `hospeda/test/partners/${PARTNER}/logo/abc`;
        const result = await deletePartnerLogoOrphans({
            partnerId: PARTNER,
            urls: [url(publicId)],
            mediaProvider: null,
            cloudName: CLOUD
        });
        expect(result).toEqual({ deleted: [], skipped: 0, failed: [publicId] });
    });
});
