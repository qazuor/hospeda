import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EditorSection } from '@/components/account/editor-shell/EditorSection';
import type { HelpAnchor } from '@/components/account/ui/help-anchor';
import { createT } from '@/lib/i18n';

const sections: readonly [HelpAnchor, string][] = [
    ['section:accommodation.ubicacion', 'host.properties.editor.section.location'],
    ['section:accommodation.politicas', 'host.properties.editor.section.policies'],
    ['section:accommodation.seo', 'host.properties.editor.section.seo'],
    ['section:venue.ubicacion', 'listing.owner.editor.sectionNav.location'],
    ['section:experience.punto-de-encuentro', 'listing.owner.editor.sectionNav.meetingPoint']
];

describe('EditorSection', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('omits duplicate route headings during SSR in %s, keeping the surface named', (locale) => {
        const t = createT(locale);
        for (const [helpId, key] of sections) {
            const html = renderToString(
                <EditorSection
                    locale={locale}
                    helpId={helpId}
                    title={t(key)}
                    description="Supporting description"
                    actions={<button type="button">Help</button>}
                >
                    <input aria-label="Field" />
                </EditorSection>
            );
            expect(html).not.toMatch(/<h[23]\b/);
            expect(html).toContain(`aria-label="${t(key)}"`);
            expect(html).not.toContain('aria-labelledby');
            expect(html).toContain('Supporting description');
            expect(html).toContain('Help');
            expect(html).toContain('data-kit-section');
        }
    });

    it('preserves distinct subheadings and their accessible references', () => {
        render(
            <EditorSection
                locale="en"
                helpId="section:venue.ubicacion"
                title="Postal address"
            >
                <p>Fields</p>
            </EditorSection>
        );
        expect(
            screen.getByRole('heading', { name: 'Postal address', level: 2 })
        ).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Postal address' })).toHaveAttribute(
            'aria-labelledby'
        );
    });
});
