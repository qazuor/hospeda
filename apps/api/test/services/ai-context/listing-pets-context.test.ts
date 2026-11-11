/**
 * Tests for the pets-absent line of the chat context (HOS-2102).
 *
 * On a listing with no pet data the model invented "La casa acepta mascotas";
 * the fix renders «**Mascotas**: no figura información en la ficha» ONLY when
 * no pet signal reaches the context. These tests pin `findListingPetSignal`
 * across every signal surface (policies admission, pet slugs, owner free text
 * in the three locales) and its near-misses (word boundaries, non-pet
 * prefixes), and `buildListingPetsLines`'s one-line-or-none contract.
 *
 * @module test/services/ai-context/listing-pets-context
 */

import { describe, expect, it } from 'vitest';
import {
    buildListingPetsLines,
    findListingPetSignal
} from '../../../src/services/ai-context/listing-pets-context.js';

/** The exact line the builder must render when nothing informs pets. */
const PETS_NOT_INFORMED_LINE = '**Mascotas**: no figura información en la ficha';

/** An input carrying no pet signal at all; each test adds one surface. */
const NO_SIGNAL = {
    policies: null,
    amenitySlugs: [],
    featureSlugs: [],
    texts: []
} as const;

describe('findListingPetSignal', () => {
    it('is true when the policies inform pets (admission "yes")', () => {
        // Arrange
        const input = { ...NO_SIGNAL, policies: { pets: { admission: 'yes' } } };

        // Act + Assert
        expect(findListingPetSignal(input)).toBe(true);
    });

    it('is true when the policies inform pets as NOT admitted ("no" is informed too)', () => {
        // Arrange
        const input = { ...NO_SIGNAL, policies: { pets: { admission: 'no' } } };

        // Act + Assert
        expect(findListingPetSignal(input)).toBe(true);
    });

    it('is false when admission is an empty string — nothing is declared', () => {
        // Arrange
        const input = { ...NO_SIGNAL, policies: { pets: { admission: '' } } };

        // Act + Assert
        expect(findListingPetSignal(input)).toBe(false);
    });

    it('is true for the real pet amenity slug with policies null', () => {
        // Act + Assert
        expect(findListingPetSignal({ ...NO_SIGNAL, amenitySlugs: ['wifi', 'pet_friendly'] })).toBe(
            true
        );
    });

    it('is true for the real pet feature slugs', () => {
        // Act + Assert
        expect(
            findListingPetSignal({
                ...NO_SIGNAL,
                featureSlugs: ['river_front', 'pet_suitable', 'pet_friendly_area']
            })
        ).toBe(true);
    });

    it('is true for an unknown slug that starts with "pet" (the catalog may grow)', () => {
        // Act + Assert
        expect(findListingPetSignal({ ...NO_SIGNAL, featureSlugs: ['pet_extra'] })).toBe(true);
    });

    it('is false for a slug that merely CONTAINS "pet" (startsWith, not includes)', () => {
        // Act + Assert
        expect(findListingPetSignal({ ...NO_SIGNAL, amenitySlugs: ['carpet_cleaning'] })).toBe(
            false
        );
    });

    it.each([
        ['FAQ', '¿Se aceptan perros?'],
        ['description', 'La casa acepta mascotas pequeñas.'],
        ['iaData', 'El sector trasero está habilitado para gatos.']
    ])('is true for a pet word in %s text', (_surface, text) => {
        expect(findListingPetSignal({ ...NO_SIGNAL, texts: [text] })).toBe(true);
    });

    it.each([
        ['Portuguese', 'Aceita cachorros e cães no quintal'],
        ['English', 'We welcome dogs and cats']
    ])('is true for a pet word in %s text', (_locale, text) => {
        expect(findListingPetSignal({ ...NO_SIGNAL, texts: [text] })).toBe(true);
    });

    it('matches pet words case-insensitively', () => {
        // Act + Assert
        expect(findListingPetSignal({ ...NO_SIGNAL, texts: ['ACEPTA MASCOTAS'] })).toBe(true);
    });

    it('is false for a word that only CONTAINS a pet word ("expert" is not "pet")', () => {
        // Act + Assert
        expect(findListingPetSignal({ ...NO_SIGNAL, texts: ['Un experto en vinos.'] })).toBe(false);
    });

    it('is false when nothing carries a pet signal', () => {
        // Act + Assert
        expect(findListingPetSignal(NO_SIGNAL)).toBe(false);
    });
});

describe('buildListingPetsLines', () => {
    it('renders no line when the policies already inform pets', () => {
        // Arrange
        const input = { ...NO_SIGNAL, policies: { pets: { admission: 'on_request' } } };

        // Act + Assert
        expect(buildListingPetsLines(input).lines).toEqual([]);
    });

    it('renders no line when only an amenity slug informs pets', () => {
        // Arrange
        const input = { ...NO_SIGNAL, amenitySlugs: ['pet_friendly'] };

        // Act + Assert
        expect(buildListingPetsLines(input).lines).toEqual([]);
    });

    it('renders no line when only the free text mentions pets', () => {
        // Arrange
        const input = { ...NO_SIGNAL, texts: ['P: ¿vienen con perros?'] };

        // Act + Assert
        expect(buildListingPetsLines(input).lines).toEqual([]);
    });

    it('renders exactly the not-informed line when there is no signal at all', () => {
        // Act
        const { lines } = buildListingPetsLines(NO_SIGNAL);

        // Assert
        expect(lines).toEqual([PETS_NOT_INFORMED_LINE]);
    });
});
