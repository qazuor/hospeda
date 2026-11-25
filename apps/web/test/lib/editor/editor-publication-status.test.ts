import { describe, expect, it } from 'vitest';
import { resolveEditorPublicationStatus } from '@/lib/editor/editor-publication-status';

describe('existing-data editor publication status', () => {
    it.each([
        ['accommodation', '/en/alojamientos/casa/'],
        ['venue', '/en/comer-y-salir/casa/'],
        ['experience', '/en/experiencias/casa/']
    ] as const)('links only a published %s to its public page', (vertical, href) => {
        expect(
            resolveEditorPublicationStatus({
                vertical,
                locale: 'en',
                publicationStatus: 'PUBLISHED',
                slug: 'casa'
            })
        ).toMatchObject({ href, tone: 'success' });
    });

    it.each([
        'DRAFT',
        'MODERATED',
        'ARCHIVED',
        'UNPUBLISHED_BY_BILLING',
        'PURGED',
        undefined,
        'future'
    ])('does not advertise a public page for %s', (publicationStatus) => {
        expect(
            resolveEditorPublicationStatus({
                vertical: 'venue',
                locale: 'es',
                publicationStatus,
                slug: 'casa'
            }).href
        ).toBeUndefined();
    });

    it('does not link a published listing with no slug', () => {
        expect(
            resolveEditorPublicationStatus({
                vertical: 'venue',
                locale: 'es',
                publicationStatus: 'PUBLISHED',
                slug: ''
            }).href
        ).toBeUndefined();
    });
});
