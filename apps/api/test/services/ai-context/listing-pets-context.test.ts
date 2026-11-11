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
    findListingPetSignal,
    RENDERED_PETS_ADMISSIONS
} from '../../../src/services/ai-context/listing-pets-context.js';
import { buildListingPoliciesLines } from '../../../src/services/ai-context/listing-policies-context.js';

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

    it('is false for an admission value the policies builder does not render', () => {
        // Arrange: an unknown value renders no policy line, so the absent line must stay.
        const input = { ...NO_SIGNAL, policies: { pets: { admission: 'legacy_value' } } };

        // Act + Assert
        expect(findListingPetSignal(input)).toBe(false);
    });

    it.each([
        ...RENDERED_PETS_ADMISSIONS
    ])('admission "%s" is one the policies builder actually renders', (admission) => {
        // Act
        const { lines } = buildListingPoliciesLines({ policies: { pets: { admission } } });

        // Assert: keeps RENDERED_PETS_ADMISSIONS in step with PETS_LABELS.
        expect(lines.some((line) => line.startsWith('**Mascotas**:'))).toBe(true);
    });

    it.each([
        'Se admite una mascota pequeña',
        'Traé a tu mascota',
        'Pet friendly',
        'Pet-friendly cabin',
        'Aceita pet',
        'Allows your pet',
        'Un animal por unidad',
        'Aceitamos um cão',
        'Perrito ok'
    ])('is true for the singular or "pet" free-text mention %j', (text) => {
        // Act + Assert
        expect(findListingPetSignal({ ...NO_SIGNAL, texts: [text] })).toBe(true);
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
