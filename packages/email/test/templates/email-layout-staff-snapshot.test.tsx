/**
 * HOS-2565 AC-4.1: the staff layout is frozen.
 *
 * The two fixtures under `__fixtures__/` were rendered from the pre-PR-4
 * `EmailLayout` in the first commit of PR-4, before the user variant existed. The
 * staff variant must keep producing those exact bytes, so a change to the user
 * layout can never leak into the 13 staff mails.
 *
 * The one allowed difference is the `data-layout-variant="staff"` marker on
 * `<body>` (AC-4.2), which is stripped before comparing.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderEmailBodies } from '../../src/render.js';
import { EmailLayout } from '../../src/templates/email-layout.js';

const ATTRIBUTION = {
    medium: 'transactional',
    templateKey: 'test.layout',
    includePixel: false
} as const;

/** The AC-4.2 marker, the only byte the staff variant adds to the frozen markup. */
const VARIANT_MARKER = ' data-layout-variant="staff"';

/** Removes the AC-4.2 marker, asserting it was present exactly once. */
function stripVariantMarker({ html }: { readonly html: string }): string {
    expect(html.split(VARIANT_MARKER)).toHaveLength(2);
    return html.replace(VARIANT_MARKER, '');
}

/** Reads one frozen fixture. */
function readFixture({ name }: { readonly name: string }): string {
    return readFileSync(join(__dirname, '__fixtures__', name), 'utf8');
}

describe('EmailLayout staff variant (HOS-2565 AC-4.1)', () => {
    it('renders the pre-PR-4 markup byte for byte (default footer)', async () => {
        // Arrange
        const expected = readFixture({ name: 'staff-layout.pre-pr4.default.html' });

        // Act
        const { html } = await renderEmailBodies({
            attribution: ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
                    previewText="Vista previa"
                >
                    <p>Contenido fijo</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(stripVariantMarker({ html })).toBe(expected);
    });

    it('renders the pre-PR-4 markup byte for byte (preferences footer)', async () => {
        // Arrange
        const expected = readFixture({ name: 'staff-layout.pre-pr4.preferences.html' });

        // Act
        const { html } = await renderEmailBodies({
            attribution: ATTRIBUTION,
            react: (
                <EmailLayout
                    variant="staff"
                    footerLink="preferences"
                >
                    <p>Contenido fijo</p>
                </EmailLayout>
            )
        });

        // Assert
        expect(stripVariantMarker({ html })).toBe(expected);
    });
});
