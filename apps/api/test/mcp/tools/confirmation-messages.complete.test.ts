/**
 * HOS-2247 L1 — a confirmation form shows everything the confirmed call writes
 * or makes public: `create_listing` shows the whole summary and description (up
 * to the create schemas' maximum), and the publish form names the listing's
 * vertical, type and city, read from the row the call already loaded.
 *
 * @module test/mcp/tools/confirmation-messages.complete
 */

import { DestinationTypeEnum, VerticalEnum } from '@repo/schemas';
import { DestinationService } from '@repo/service-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CONFIRMATION_BLOCK_PREFIX } from '../../../src/mcp/tools/confirmation-text';
import { createListingConfirmationMessage } from '../../../src/mcp/tools/listing/create-listing-preview';
import type { OwnListingRow } from '../../../src/mcp/tools/listing/get-listing';
import {
    publishConfirmationMessage,
    readPublishListingFacts
} from '../../../src/mcp/tools/listing/publish-confirmation';

/** The text of the block that follows the `label` line, prefixes and wrap undone. */
function blockAfter(message: string, label: string): string {
    const lines = message.split('\n');
    const start = lines.indexOf(label) + 1;
    const block: string[] = [];
    for (const line of lines.slice(start)) {
        if (!line.startsWith(CONFIRMATION_BLOCK_PREFIX.trimEnd())) break;
        block.push(line.slice(CONFIRMATION_BLOCK_PREFIX.length));
    }
    return block.join('');
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('create_listing shows all it writes', () => {
    it('the whole 300-character summary and 2000-character description, as blocks', () => {
        // Arrange
        const summary = 's'.repeat(300);
        const description = 'd'.repeat(2000);

        // Act
        const message = createListingConfirmationMessage({
            vertical: VerticalEnum.VENUE,
            listing: { name: 'n'.repeat(100), summary, description },
            point: null
        });

        // Assert
        expect(blockAfter(message, 'Resumen:')).toBe(summary);
        expect(blockAfter(message, 'Descripción:')).toBe(description);
        expect(message).toContain(`Nombre: «${'n'.repeat(100)}»`);
        expect(message).not.toContain('…');
    });
});

describe('the publish form names what goes public', () => {
    it('shows vertical, type and city before the owner-written name', () => {
        // Act
        const lines = publishConfirmationMessage({
            vertical: VerticalEnum.VENUE,
            name: 'La Parrilla',
            typeLabel: 'Parrilla',
            city: 'Concepción del Uruguay'
        }).split('\n');

        // Assert
        expect(lines.slice(1, 5)).toEqual([
            'Categoría: Comer y salir',
            'Tipo: «Parrilla»',
            'Ciudad: «Concepción del Uruguay»',
            'Nombre: «La Parrilla»'
        ]);
    });

    it('says when a fact is unknown instead of leaving it out', () => {
        // Act
        const message = publishConfirmationMessage({
            vertical: VerticalEnum.EXPERIENCE,
            name: 'Kayak',
            typeLabel: null,
            city: null
        });

        // Assert
        expect(message).toContain('Tipo: sin dato');
        expect(message).toContain('Ciudad: sin dato');
    });

    it('reads the type label and the city from the row', async () => {
        // Arrange
        vi.spyOn(DestinationService.prototype, 'getById').mockResolvedValue({
            data: {
                id: 'd1',
                name: 'Colón',
                destinationType: DestinationTypeEnum.CITY
            }
        } as never);
        const row = { type: 'RESTAURANT', destinationId: 'd1' } as unknown as OwnListingRow;

        // Act
        const facts = await readPublishListingFacts({ vertical: VerticalEnum.VENUE, row });

        // Assert
        expect(facts.city).toBe('Colón');
        expect(facts.typeLabel).not.toBeNull();
        expect(facts.typeLabel).not.toBe('RESTAURANT');
    });

    it('degrades to unknown when the destination cannot be read', async () => {
        // Arrange
        vi.spyOn(DestinationService.prototype, 'getById').mockRejectedValue(new Error('db down'));
        const row = { destinationId: 'd1' } as unknown as OwnListingRow;

        // Act
        const facts = await readPublishListingFacts({ vertical: VerticalEnum.VENUE, row });

        // Assert
        expect(facts).toEqual({ typeLabel: null, city: null });
    });
});
