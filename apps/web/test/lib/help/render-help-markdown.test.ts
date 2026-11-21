/**
 * HOS-2410 data-model §3 — the web gives each `###` the generator's anchor id,
 * and the id survives the sanitizer.
 */

import { slugifyHelpHeading } from '@repo/help';
import { describe, expect, it } from 'vitest';
import { renderHelpMarkdown } from '../../../src/lib/help/render-help-markdown';

const SITE = 'http://localhost:4321';

describe('renderHelpMarkdown', () => {
    it('keeps the id of a heading that starts with a digit (prefixed h-)', () => {
        // Act
        const html = renderHelpMarkdown({
            markdown: '### 48 horas sin respuesta',
            siteOrigin: SITE
        });

        // Assert
        expect(html).toContain('<h3 id="h-48-horas-sin-respuesta">48 horas sin respuesta</h3>');
        expect(slugifyHelpHeading({ text: '48 horas sin respuesta' })).toBe(
            'h-48-horas-sin-respuesta'
        );
    });

    it('uses an explicit {#id} and hides it from the text', () => {
        const html = renderHelpMarkdown({
            markdown: '### Dice algo {#dice-algo}',
            siteOrigin: SITE
        });
        expect(html).toContain('<h3 id="dice-algo">Dice algo</h3>');
    });
});
