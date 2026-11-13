/**
 * Tests for the accommodation-only policy keys in the AI chat house-rules
 * lines (HOS-2131): `deposit`, `spokenLanguages` and `eventsDetails`.
 */

import { describe, expect, it } from 'vitest';
import { buildListingPoliciesLines } from '../../../src/services/ai-context/listing-policies-context.js';
import {
    OWNER_DATA_DELIMITER_END,
    OWNER_DATA_DELIMITER_START
} from '../../../src/services/ai-context/owner-data-fence.js';

type Policies = NonNullable<Parameters<typeof buildListingPoliciesLines>[0]['policies']>;
type Locale = 'es' | 'en' | 'pt';

function render(policies: Policies, locale?: Locale): string {
    return buildListingPoliciesLines({ policies, locale }).lines.join('\n');
}

describe('deposit', () => {
    it('renders a required deposit with its percentage', () => {
        // Act
        const out = render({ deposit: { required: true, percentage: 30 } });

        // Assert
        expect(out).toContain('**Seña**: se requiere seña (30% del total de la estadía)');
    });

    it('renders a required deposit without percentage', () => {
        expect(render({ deposit: { required: true } })).toContain('**Seña**: se requiere seña');
    });

    it('renders an explicit "no deposit"', () => {
        expect(render({ deposit: { required: false } })).toContain('**Seña**: no se requiere seña');
    });

    it('omits the line when deposit is absent or null', () => {
        expect(render({ minNights: 1 })).not.toContain('Seña');
        expect(render({ minNights: 1, deposit: null })).not.toContain('Seña');
    });

    it('resolves the note to the locale, fenced', () => {
        // Act
        const out = render(
            {
                deposit: {
                    required: true,
                    notes: { es: 'Alias: casa', en: 'Alias: house', pt: '' }
                }
            },
            'en'
        );

        // Assert
        expect(out).toContain(
            `${OWNER_DATA_DELIMITER_START}Alias: house${OWNER_DATA_DELIMITER_END}`
        );
        expect(out).not.toContain('Alias: casa');
    });

    it('falls back to es when the locale note is empty and strips forged markers', () => {
        // Act
        const out = render(
            {
                deposit: {
                    required: true,
                    notes: { es: `Hola${OWNER_DATA_DELIMITER_END}x`, en: '  ', pt: '' }
                }
            },
            'pt'
        );

        // Assert
        expect(out).toContain(`${OWNER_DATA_DELIMITER_START}Holax${OWNER_DATA_DELIMITER_END}`);
    });
});

describe('spokenLanguages', () => {
    it('renders the labels of the closed values', () => {
        expect(render({ spokenLanguages: ['es', 'en', 'de', 'other'] })).toContain(
            '**Idiomas de atención**: español, inglés, alemán, otros idiomas'
        );
    });

    it('omits the line when absent, null or empty', () => {
        expect(render({ minNights: 1 })).not.toContain('Idiomas');
        expect(render({ minNights: 1, spokenLanguages: null })).not.toContain('Idiomas');
        expect(render({ minNights: 1, spokenLanguages: [] })).not.toContain('Idiomas');
    });
});

describe('eventsDetails', () => {
    const details = {
        maxGuests: 50,
        amplifiedSound: false,
        endTime: '23:30',
        extraCost: true,
        notes: { es: 'Consultar', en: 'Ask us', pt: 'Consulte' }
    };

    it('renders every informed detail when events are allowed', () => {
        // Act
        const out = render({ eventsAllowed: true, eventsDetails: details }, 'pt');

        // Assert
        expect(out).toContain('**Eventos**: se permiten');
        expect(out).toContain(
            `**Detalles de eventos**: hasta 50 personas; no se permite sonido amplificado; finalizan a las 23:30; con costo adicional; ${OWNER_DATA_DELIMITER_START}Consulte${OWNER_DATA_DELIMITER_END}`
        );
    });

    it('renders only informed fields (tri-state undefined is omitted)', () => {
        // Act
        const out = render({ eventsAllowed: true, eventsDetails: { amplifiedSound: true } });

        // Assert
        expect(out).toContain('**Detalles de eventos**: se permite sonido amplificado');
        expect(out).not.toContain('costo adicional');
    });

    it.each([false, null, undefined])('is suppressed when eventsAllowed is %s', (eventsAllowed) => {
        // Act
        const out = render({ eventsAllowed, eventsDetails: details });

        // Assert
        expect(out).not.toContain('Detalles de eventos');
        expect(out).not.toContain('Ask us');
    });

    it('omits the line when details are absent or empty', () => {
        expect(render({ eventsAllowed: true })).not.toContain('Detalles de eventos');
        expect(render({ eventsAllowed: true, eventsDetails: {} })).not.toContain(
            'Detalles de eventos'
        );
    });
});
