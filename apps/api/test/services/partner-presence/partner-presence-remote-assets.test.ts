import { describe, expect, it } from 'vitest';
import { classifyPartnerRemoteAssets } from '../../../src/services/partner-presence/partner-presence-remote-assets';

describe('classifyPartnerRemoteAssets', () => {
    it('keeps unique assets from the configured Hospeda namespace and counts rejected URLs', () => {
        const logo =
            'https://res.cloudinary.com/hospeda-test/image/upload/v1/hospeda/test/partners/x/logo.png';
        expect(
            classifyPartnerRemoteAssets({
                urls: [
                    logo,
                    logo.replace('.png', '.jpg'),
                    'https://res.cloudinary.com/another/image/upload/v1/hospeda/test/x.png',
                    'https://res.cloudinary.com/another/image/upload/v1/hospeda/test/x.png',
                    'https://res.cloudinary.com/hospeda-test/image/upload/v1/other/x.png',
                    'https://images.pexels.com/x.png',
                    'data:image/png;base64,abc',
                    'not a URL',
                    null,
                    '  ',
                    'https://evil.res.cloudinary.com.attacker.com/hospeda-test/image/upload/v1/hospeda/x.png'
                ],
                cloudName: 'hospeda-test'
            })
        ).toEqual({ publicIds: ['hospeda/test/partners/x/logo'], skipped: 6 });
    });

    it('counts every non-empty URL as skipped when the cloud name is missing', () => {
        expect(
            classifyPartnerRemoteAssets({
                urls: ['https://res.cloudinary.com/hospeda/image/upload/v1/hospeda/x.png'],
                cloudName: null
            })
        ).toEqual({ publicIds: [], skipped: 1 });
    });
});
