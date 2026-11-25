import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Reads an editor source inside the current worktree. */
function source({ path }: { readonly path: string }): string {
    return readFileSync(resolve(__dirname, '../../../../src', path), 'utf8');
}

describe('G17 shared layout contracts', () => {
    it('keeps the calendar inside the Section padding', () => {
        expect(source({ path: 'components/host/editor/CalendarSection.module.css' })).not.toContain(
            'margin-inline: calc(-1'
        );
    });
    it('uses horizontal categories rather than a tall desktop sidebar', () => {
        expect(
            source({
                path: 'components/host/editor/amenity-catalog/AmenityCatalogBrowser.module.css'
            })
        ).not.toContain('grid-template-columns: minmax(12rem, 15rem)');
    });
    it('spans selected amenity details across the full options row', () => {
        expect(
            source({ path: 'components/shared/catalog-picker/CatalogPicker.module.css' })
        ).toContain('.itemWithAttributes');
    });
    it('does not visually duplicate SEO fallback values', () => {
        const css = source({ path: 'components/host/editor/SeoSection.module.css' });
        expect(css).toContain('clip-path: inset(50%)');
        expect(css).toContain('::placeholder');
    });

    it('gives both destination fields a full grid row', () => {
        for (const vertical of ['host', 'listing']) {
            const component = source({
                path: `components/${vertical}/editor/BasicInfoSection.client.tsx`
            });
            expect(component).toMatch(
                /idParts=\{idOf\('destinationId'\)\}\s+className=\{styles.full\}/
            );
        }
    });

    it('shares field alignment and keeps both stay bounds in the same row', () => {
        for (const path of [
            'components/host/editor/CapacitySection.module.css',
            'components/listing/editor/listing-section.module.css'
        ]) {
            expect(source({ path })).toContain('EditorFieldLayout.module.css');
        }
        expect(
            source({ path: 'components/account/editor/EditorFieldLayout.module.css' })
        ).toContain('align-items: start');
        expect(source({ path: 'components/host/editor/CapacitySection.client.tsx' })).toContain(
            'className={styles.stayBounds}'
        );
    });

    it('uses a kit Alert for the URL notice and compact owned business-line tracks', () => {
        expect(
            source({
                path: 'pages/[lang]/mi-cuenta/comercio/[vertical]/[id]/editar/datos.astro'
            })
        ).toContain('<Alert tone="info" locale={locale}>');
        expect(
            source({ path: 'components/listing/editor/BusinessLinesField.module.css' })
        ).toContain('gap: 0 var(--space-3)');
    });
});
