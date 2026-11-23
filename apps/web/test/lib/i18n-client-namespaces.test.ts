/**
 * @file i18n-client-namespaces.test.ts
 * @description Unit tests for the prefix selection shared by the client-asset
 * narrowing (HOS-369 W3-2) and its critical/rest split (HOS-2572).
 */

import { describe, expect, it } from 'vitest';
import { pickClientNamespaces, pickKeysByPrefixes } from '../../src/lib/i18n-client-namespaces';

describe('pickKeysByPrefixes', () => {
    const messages = {
        'nav.signIn': 'Ingresar',
        'nav.signIn.aria': 'Ingresar a tu cuenta',
        'nav.signInLater': 'Más tarde',
        'footer.newsletter.title': 'Newsletter',
        'faq.q1': 'Pregunta'
    } as const;

    it('keeps a key equal to a prefix and every key beneath it', () => {
        expect(pickKeysByPrefixes({ messages, prefixes: ['nav.signIn'] })).toEqual({
            'nav.signIn': 'Ingresar',
            'nav.signIn.aria': 'Ingresar a tu cuenta'
        });
    });

    it('matches on segment boundaries, never on a bare string prefix', () => {
        // `nav.signIn` must not swallow `nav.signInLater`.
        expect(pickKeysByPrefixes({ messages, prefixes: ['nav.signIn'] })).not.toHaveProperty(
            'nav.signInLater'
        );
    });

    it('unions several prefixes and drops everything else', () => {
        expect(pickKeysByPrefixes({ messages, prefixes: ['footer', 'nav.signInLater'] })).toEqual({
            'nav.signInLater': 'Más tarde',
            'footer.newsletter.title': 'Newsletter'
        });
    });

    it('returns an empty map for no prefixes', () => {
        expect(pickKeysByPrefixes({ messages, prefixes: [] })).toEqual({});
    });

    it('is what pickClientNamespaces narrows with', () => {
        // `nav.signIn` is a declared client prefix, `faq` is not.
        const picked = pickClientNamespaces(messages);
        expect(picked).toHaveProperty(['nav.signIn'], 'Ingresar');
        expect(picked).not.toHaveProperty(['faq.q1']);
    });
});
