/**
 * HOS-2410 (`docs/data-model.md` §3) — the anchor id of a `###` heading, shared
 * by the generator and the web article page.
 *
 * @module test/headings
 */

import { describe, expect, it } from 'vitest';
import { helpSubHeading, slugifyHelpHeading } from '../src/headings';

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
