import { describe, expect, it } from 'vitest';
import { decideCartaPage } from '../../../src/lib/venue/carta-redirect';

const listingUrl = '/es/comer-y-salir/el-boliche/';

describe('decideCartaPage', () => {
    it.each([
        ['absent', {}],
        ['locked', {}],
        ['empty', { menuSections: [] }],
        ['available with only external link', { menuUrl: 'https://menu.example' }]
    ])('redirects a projected listing with %s menu content', (_case, listing) => {
        expect(decideCartaPage({ listing, listingUrl })).toEqual({
            kind: 'redirect',
            status: 302,
            headers: { Location: listingUrl, 'Cache-Control': 'no-store' }
        });
    });

    it('renders a structured menu', () => {
        expect(decideCartaPage({ listing: { menuSections: [{}] }, listingUrl })).toEqual({
            kind: 'render'
        });
    });

    it('renders an uploaded menu file', () => {
        expect(
            decideCartaPage({
                listing: { menuFileUrl: 'https://cdn.example/menu.pdf', menuFileKind: 'pdf' },
                listingUrl
            })
        ).toEqual({ kind: 'render' });
    });
});
