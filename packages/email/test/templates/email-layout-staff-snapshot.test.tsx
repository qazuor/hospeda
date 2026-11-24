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
 *
 * A third fixture, `staff-layout.pr4-baseline.components.html`, renders the shared
 * components a staff mail uses (EmailTitle, Button in both variants, Callout) inside
 * the staff layout. It was taken from PR-4 itself, so it accepts PR-4's green
 * button and callout icon as the baseline; from here on a change to a shared
 * component shows up in the staff mails too.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/components/button.js';
import { Callout } from '../../src/components/callout.js';
import { EmailTitle } from '../../src/components/email-title.js';
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

    it('renders the shared components inside the staff layout byte for byte (PR-4 baseline)', async () => {
        // Arrange
        const expected = readFixture({ name: 'staff-layout.pr4-baseline.components.html' });

        // Act
        const { html } = await renderEmailBodies({
            attribution: ATTRIBUTION,
            layout: { illustration: 'payments' },
            react: (
                <EmailLayout
                    variant="staff"
                    previewText="Vista previa"
                >
                    <EmailTitle>Título fijo</EmailTitle>
                    <p>Contenido fijo</p>
                    <Callout
                        tone="warning"
                        title="Atención"
                    >
                        Texto del aviso
                    </Callout>
                    <Button href="https://hospeda.com.ar/es/">Acción principal</Button>
                    <Button
                        href="https://hospeda.com.ar/es/ayuda/"
                        variant="secondary"
                    >
                        Acción secundaria
                    </Button>
                </EmailLayout>
            )
        });

        // Assert
        expect(stripVariantMarker({ html })).toBe(expected);
    });
});
