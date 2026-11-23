import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { Button } from '../../src/templates/components/button';

/**
 * The CTA button tags its anchor with `data-utm-content` so email attribution can
 * report the link slot as `utm_content` (HOS-2359 §6.A.2).
 */
describe('Button data-utm-content', () => {
    it('lands data-utm-content="cta" on the <a> by default', async () => {
        // Arrange / Act
        const html = await render(<Button href="https://hospeda.com.ar/es/">Ver</Button>);

        // Assert
        expect(html).toMatch(/<a [^>]*data-utm-content="cta"[^>]*>/);
    });

    it('uses an explicit slot', async () => {
        const html = await render(
            <Button
                href="https://hospeda.com.ar/es/"
                utmContent="secondary-cta"
            >
                Ver
            </Button>
        );

        expect(html).toMatch(/<a [^>]*data-utm-content="secondary-cta"[^>]*>/);
    });
});
