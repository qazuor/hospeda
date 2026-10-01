import { describe, expect, it } from 'vitest';
import { nullifyClearedSocialNetworks } from '../social-networks-payload.utils';

/**
 * HOS-1262: `socialNetworks` is a merged JSONB column, so a cleared network has
 * to reach the API as `null` — an omitted key keeps the stored link and `''`
 * fails `SocialNetworkSchema`'s URL check.
 */
describe('nullifyClearedSocialNetworks', () => {
    it('turns an emptied network into an explicit null and keeps the filled ones', () => {
        const result = nullifyClearedSocialNetworks({
            payload: {
                socialNetworks: { facebook: '', instagram: 'https://instagram.com/x' }
            }
        });

        expect(result).toStrictEqual({
            socialNetworks: { facebook: null, instagram: 'https://instagram.com/x' }
        });
    });

    it('treats whitespace-only input as cleared', () => {
        const result = nullifyClearedSocialNetworks({
            payload: { socialNetworks: { twitter: '   ' } }
        });

        expect(result).toStrictEqual({ socialNetworks: { twitter: null } });
    });

    it('leaves other payload keys untouched, empty strings included', () => {
        const result = nullifyClearedSocialNetworks({
            payload: { name: 'Acme', description: '', socialNetworks: { youtube: '' } }
        });

        expect(result).toStrictEqual({
            name: 'Acme',
            description: '',
            socialNetworks: { youtube: null }
        });
    });

    it('returns a payload without socialNetworks unchanged', () => {
        expect(nullifyClearedSocialNetworks({ payload: { name: 'Acme' } })).toStrictEqual({
            name: 'Acme'
        });
    });

    it('passes a non-object socialNetworks value through', () => {
        expect(nullifyClearedSocialNetworks({ payload: { socialNetworks: null } })).toStrictEqual({
            socialNetworks: null
        });
    });

    it('does not mutate its input', () => {
        const social = { facebook: '' };
        const payload = { socialNetworks: social };

        nullifyClearedSocialNetworks({ payload });

        expect(social).toStrictEqual({ facebook: '' });
    });
});
