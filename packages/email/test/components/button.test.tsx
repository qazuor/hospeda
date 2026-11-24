import { render } from '@react-email/render';
import { emailPalette } from '@repo/design-tokens';
import { describe, expect, it } from 'vitest';
import {
    Button,
    EMAIL_BUTTON_CLASS,
    EMAIL_BUTTON_SECONDARY_CLASS
} from '../../src/components/button.js';

/** Returns the opening tag of the first `<a>` of a rendered fragment. */
function anchorOf(html: string): string {
    const anchor = html.match(/<a\b[^>]*>/)?.[0];
    if (!anchor) {
        throw new Error('no <a> in the rendered button');
    }
    return anchor;
}

describe('Button (HOS-2565 US-2)', () => {
    describe('when rendering the primary variant (default)', () => {
        it('should render a content-width inline-block anchor with the shared class', async () => {
            // Arrange & Act
            const html = await render(<Button href="https://hospeda.com.ar/es/">Ver</Button>);
            const anchor = anchorOf(html);

            // Assert
            expect(anchor).toContain('href="https://hospeda.com.ar/es/"');
            expect(anchor).toContain(`class="${EMAIL_BUTTON_CLASS}"`);
            expect(anchor).toContain('display:inline-block');
            expect(anchor).not.toMatch(/[";]width:/);
        });

        it('should use the primary palette roles', async () => {
            // Arrange & Act
            const anchor = anchorOf(await render(<Button href="https://x.test/">Ver</Button>));

            // Assert
            expect(anchor).toContain(`background-color:${emailPalette.buttonPrimary}`);
            expect(anchor).toContain(`color:${emailPalette.buttonPrimaryText}`);
            expect(anchor).toContain('border-radius:6px');
            expect(anchor).toContain('font-size:16px');
        });
    });

    describe('when rendering the secondary variant', () => {
        it('should be outlined with the secondary border role and keep the class', async () => {
            // Arrange & Act
            const anchor = anchorOf(
                await render(
                    <Button
                        href="https://x.test/"
                        variant="secondary"
                    >
                        Ver
                    </Button>
                )
            );

            // Assert
            // HOS-2565 PR-4: light blue fill, cyan border, dark cyan text.
            expect(anchor).toContain(`border:2px solid ${emailPalette.buttonSecondaryBorder}`);
            expect(anchor).toContain(`background-color:${emailPalette.buttonSecondaryBackground}`);
            expect(anchor).toContain(`color:${emailPalette.buttonSecondaryText}`);
            expect(anchor).not.toContain(`background-color:${emailPalette.buttonPrimary}`);
            expect(anchor).toContain(
                `class="${EMAIL_BUTTON_CLASS} ${EMAIL_BUTTON_SECONDARY_CLASS}"`
            );
            expect(anchor).toContain('display:inline-block');
        });
    });

    describe('when wrapping itself', () => {
        it('should sit in a centered presentation table with vertical spacing', async () => {
            // Arrange & Act
            const html = await render(<Button href="https://x.test/">Ver</Button>);

            // Assert
            expect(html).toContain('role="presentation"');
            expect(html).toMatch(/<td align="center" style="[^"]*padding:24px 0/);
        });
    });

    describe('data-utm-content (HOS-2359 §6.A.2)', () => {
        it('should land data-utm-content="cta" on the anchor by default', async () => {
            // Arrange & Act
            const html = await render(<Button href="https://hospeda.com.ar/es/">Ver</Button>);

            // Assert
            expect(html).toMatch(/<a [^>]*data-utm-content="cta"[^>]*>/);
        });

        it('should use an explicit slot', async () => {
            // Arrange & Act
            const html = await render(
                <Button
                    href="https://hospeda.com.ar/es/"
                    utmContent="secondary-cta"
                >
                    Ver
                </Button>
            );

            // Assert
            expect(html).toMatch(/<a [^>]*data-utm-content="secondary-cta"[^>]*>/);
        });
    });
});
