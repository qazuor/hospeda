/**
 * Owner decision 16: which partner logo URLs a write leaves unreferenced.
 */
import { describe, expect, it } from 'vitest';
import { resolveDiscardedPartnerLogoUrls } from '../../../src/services/partner/partner-logo-orphans';

const LIVE = 'https://res.cloudinary.com/x/image/upload/hospeda/test/partners/p/logo/live.png';
const OLD_PENDING = 'https://res.cloudinary.com/x/image/upload/hospeda/test/partners/p/logo/a.png';
const NEW_PENDING = 'https://res.cloudinary.com/x/image/upload/hospeda/test/partners/p/logo/b.png';

describe('resolveDiscardedPartnerLogoUrls', () => {
    it('names the pending logo a new submission replaces, never the live one', () => {
        const result = resolveDiscardedPartnerLogoUrls({
            before: { logoUrl: LIVE, pendingLogoUrl: OLD_PENDING },
            after: { logoUrl: LIVE, pendingLogoUrl: NEW_PENDING }
        });
        expect(result).toEqual([OLD_PENDING]);
    });

    it('names the previous live logo when an approval replaces it', () => {
        const result = resolveDiscardedPartnerLogoUrls({
            before: { logoUrl: LIVE, pendingLogoUrl: NEW_PENDING },
            after: { logoUrl: NEW_PENDING, pendingLogoUrl: null }
        });
        expect(result).toEqual([LIVE]);
    });

    it('names the rejected pending logo and keeps the live one', () => {
        const result = resolveDiscardedPartnerLogoUrls({
            before: { logoUrl: LIVE, pendingLogoUrl: NEW_PENDING },
            after: { logoUrl: LIVE, pendingLogoUrl: null }
        });
        expect(result).toEqual([NEW_PENDING]);
    });

    it('names nothing when the submission re-sends the live logo', () => {
        const result = resolveDiscardedPartnerLogoUrls({
            before: { logoUrl: LIVE, pendingLogoUrl: null },
            after: { logoUrl: LIVE, pendingLogoUrl: LIVE }
        });
        expect(result).toEqual([]);
    });

    it('names nothing when the approved logo is the same URL', () => {
        const result = resolveDiscardedPartnerLogoUrls({
            before: { logoUrl: LIVE, pendingLogoUrl: LIVE },
            after: { logoUrl: LIVE, pendingLogoUrl: null }
        });
        expect(result).toEqual([]);
    });
});
