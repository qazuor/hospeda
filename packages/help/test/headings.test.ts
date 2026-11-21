/**
 * HOS-2410 (`docs/data-model.md` §3) — the anchor id of a `###` heading, shared
 * by the generator and the web article page.
 *
 * @module test/headings
 */

import { describe, expect, it } from 'vitest';
import { helpSubHeading, isHelpAnchorId, slugifyHelpHeading } from '../src/headings';

describe('helpSubHeading', () => {
    it('uses the explicit {#id} and drops it from the visible text', () => {
        // Act
        const heading = helpSubHeading({ text: 'Mis fotos no se ven {#fotos-no-se-ven}' });

        // Assert
        expect(heading).toEqual({ text: 'Mis fotos no se ven', anchor: 'fotos-no-se-ven' });
    });

    it('slugifies the text when no explicit id is written', () => {
        // Act
        const heading = helpSubHeading({ text: '¿Por qué no aparece?' });

        // Assert
        expect(heading).toEqual({ text: '¿Por qué no aparece?', anchor: 'por-que-no-aparece' });
    });

    it('agrees with slugifyHelpHeading for plain text', () => {
        expect(helpSubHeading({ text: 'Dice «Compras pausadas»' }).anchor).toBe(
            slugifyHelpHeading({ text: 'Dice «Compras pausadas»' })
        );
    });
});

describe('anchors that start with a digit (the web drops such an id)', () => {
    it('prefixes the slug with h-', () => {
        expect(slugifyHelpHeading({ text: '48 horas sin respuesta' })).toBe(
            'h-48-horas-sin-respuesta'
        );
        expect(helpSubHeading({ text: '¿24 horas?' }).anchor).toBe('h-24-horas');
    });

    it('leaves a slug that starts with a letter alone', () => {
        expect(slugifyHelpHeading({ text: 'Hace 48 horas' })).toBe('hace-48-horas');
    });

    it('keeps an explicit digit anchor as written, so the generator can reject it', () => {
        expect(helpSubHeading({ text: 'En un día {#24h}' })).toEqual({
            text: 'En un día',
            anchor: '24h'
        });
        expect(isHelpAnchorId({ anchor: '24h' })).toBe(false);
        expect(isHelpAnchorId({ anchor: 'h-24h' })).toBe(true);
        expect(isHelpAnchorId({ anchor: slugifyHelpHeading({ text: '7 días' }) })).toBe(true);
    });
});

describe('helpSubHeading on adversarial whitespace (js/polynomial-redos)', () => {
    it('stays linear on a long run of tabs and still finds the anchor', () => {
        const started = Date.now();
        const noAnchor = helpSubHeading({ text: `a${'\t'.repeat(50000)}b` });
        const withAnchor = helpSubHeading({ text: `a${'\t'.repeat(50000)}{#fotos}\t\t` });

        expect(noAnchor.text).toBe(`a${'\t'.repeat(50000)}b`);
        expect(withAnchor).toEqual({ text: 'a', anchor: 'fotos' });
        expect(Date.now() - started).toBeLessThan(1000);
    });
});
