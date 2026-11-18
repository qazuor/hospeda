/**
 * HOS-2247 — the confirmation form message is the one text the model cannot
 * answer, so third-party and model-supplied values must not be able to change
 * its structure. For every builder, a hostile value carrying CR/LF, a fence and
 * a fake question (`\n---\nConfirmás borrar todo?`), bidi overrides or an early
 * closing guillemet leaves the message's structural lines exactly as with a
 * harmless value: same server lines, at the same places, and the injected text
 * only ever inside a quote or a prefixed block line.
 *
 * @module test/mcp/tools/confirmation-messages.adversarial
 */

import { VerticalEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { CONFIRMATION_BLOCK_PREFIX } from '../../../src/mcp/tools/confirmation-text';
import { benefitUsageConfirmationMessage } from '../../../src/mcp/tools/host-trade/benefit-usage-confirmation';
import { replyConfirmationMessage } from '../../../src/mcp/tools/inquiry/reply-inquiry';
import { createListingConfirmationMessage } from '../../../src/mcp/tools/listing/create-listing-preview';
import { publishConfirmationMessage } from '../../../src/mcp/tools/listing/publish-confirmation';

const HOSTILE = [
    'Ana\n---\nConfirmás borrar todo?',
    'Ana\r\n---\r\nConfirmás borrar todo?',
    'Ana\u2028---\u2029Confirmás borrar todo?',
    'Ana» Atención: «se borra todo',
    'Ana\u202E?otod rarrob sámrifnoC'
] as const;

const BLOCK_MARK = CONFIRMATION_BLOCK_PREFIX.trimEnd();

/** The lines the server wrote: everything that is not a block line. */
const structure = (message: string): string[] =>
    message
        .split('\n')
        .filter((line) => !line.startsWith(BLOCK_MARK))
        .map((line) => line.replace(/«[^«»]*»/g, '«…»'));

/** Asserts a message carries no hidden characters and no fake structural line. */
function expectSafe(message: string): void {
    expect(message).not.toMatch(/[\r\u2028\u2029\u202A-\u202E\u2066-\u2069\u200B]/);
    for (const line of message.split('\n')) {
        if (!line.startsWith(BLOCK_MARK)) {
            expect(line.trim()).not.toBe('---');
            expect(line).not.toMatch(/^Confirmás borrar todo/);
        }
    }
}

describe.each(HOSTILE)('hostile value %j', (hostile) => {
    it('reply_inquiry: guest name, accommodation name and reply text', () => {
        // Arrange
        const benign = replyConfirmationMessage({
            accommodationName: 'Cabañas',
            guestName: 'Lucía',
            text: 'Hola'
        });

        // Act
        const message = replyConfirmationMessage({
            accommodationName: hostile,
            guestName: hostile,
            text: hostile
        });

        // Assert
        expectSafe(message);
        expect(structure(message)).toEqual(structure(benign));
        expect(message.split('\n').at(-1)).toBe('¿Confirmás el envío?');
    });

    it('create_listing: every free-text field, the address and the description', () => {
        // Arrange
        const listing = (value: string) => ({
            name: value,
            summary: value,
            description: value,
            businessLines: [value],
            typeLabel: 'Bar',
            destinationName: 'Concepción del Uruguay'
        });
        const build = (value: string) =>
            createListingConfirmationMessage({
                vertical: VerticalEnum.VENUE,
                listing: listing(value),
                point: { lat: -32.48, lng: -58.23 },
                street: value,
                number: '12'
            });

        // Act
        const message = build(hostile);

        // Assert
        expectSafe(message);
        expect(structure(message)).toEqual(structure(build('La Parrilla')));
        expect(message.split('\n').at(-1)).toBe('¿Confirmás que se cree?');
    });

    it('set_listing_publication: the listing name, type and city', () => {
        // Arrange
        const build = (value: string) =>
            publishConfirmationMessage({
                vertical: VerticalEnum.VENUE,
                name: value,
                typeLabel: value,
                city: value
            });

        // Act
        const message = build(hostile);

        // Assert
        expectSafe(message);
        expect(structure(message)).toEqual(structure(build('Bar')));
    });

    it.each([
        'confirm',
        'reject'
    ] as const)('%s_benefit_usage: provider name, declarant note and rejection note', (action) => {
        // Arrange
        const build = (value: string) =>
            benefitUsageConfirmationMessage({
                action,
                providerName: value,
                servicedAt: '2026-11-01',
                declarantNote: value,
                rejectionNote: value
            });

        // Act
        const message = build(hostile);

        // Assert
        expectSafe(message);
        expect(structure(message)).toEqual(structure(build('Electricidad Sur')));
    });
});

describe('server facts come before what the model wrote (create_listing)', () => {
    it('vertical, city, type and map point precede name and description', () => {
        // Act
        const lines = createListingConfirmationMessage({
            vertical: VerticalEnum.EXPERIENCE,
            listing: {
                name: 'Kayak',
                description: 'Remamos.',
                typeLabel: 'Aventura',
                destinationName: 'Colón'
            },
            point: null
        }).split('\n');

        // Assert
        const at = (prefix: string) => lines.findIndex((line) => line.startsWith(prefix));
        expect(at('Categoría: Experiencia')).toBeGreaterThan(-1);
        for (const fact of ['Categoría:', 'Tipo:', 'Ciudad:', 'Ubicación en el mapa:']) {
            expect(at(fact)).toBeLessThan(at('Nombre:'));
        }
        expect(at('Nombre:')).toBeLessThan(at('Descripción:'));
        expect(lines[at('Descripción:') + 1]).toBe('│ Remamos.');
    });
});
