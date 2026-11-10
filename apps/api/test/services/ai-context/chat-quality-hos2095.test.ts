/**
 * Regression tests for the HOS-2095 listing-chat quality sweep.
 *
 * A blind-graded sweep of 224 answers across every model found the same
 * defects on all of them, so they are context/prompt defects, not model ones:
 *
 * 1. Language: the system message ended with `locale is "es"`, and that line
 *    beat the user's English question in 13 of 16 cases.
 * 2. Raw internal codes (`MID`, `CABIN`, `BAR`, `pet_friendly`) reached the
 *    tourist because the builders rendered enums and slugs verbatim.
 * 3. Menu prices were unreadable (`$4500`) and experience prices were rendered
 *    in centavos (100x the real price).
 * 7. Caps of 20 amenities / 10 FAQs / 800 description chars dropped data the
 *    owner entered (air conditioning at #37, parking FAQ at #15, pool size
 *    after char 800).
 *
 * Every test here was written against the pre-fix code and failed there.
 *
 * @module test/services/ai-context/chat-quality-hos2095
 */

import { appendReplyLanguageInstruction, REPLY_LANGUAGE_INSTRUCTIONS } from '@repo/ai-core';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), debug: vi.fn(), error: vi.fn() }
}));

import {
    buildChatSystemMessage as accommodationBuildChatSystemMessage,
    buildMarkdownContext
} from '../../../src/services/accommodation-ai-context';
import { buildExperienceMarkdownContext } from '../../../src/services/ai-context/experience-ai-context';
import {
    buildChatSystemMessage,
    OWNER_DATA_DELIMITER_END,
    OWNER_DATA_DELIMITER_START
} from '../../../src/services/ai-context/owner-data-fence';
import { buildVenueMarkdownContext } from '../../../src/services/ai-context/venue-ai-context';
import {
    CASA_QUINTA_AMENITY_SLUGS,
    CASA_QUINTA_FEATURE_SLUGS,
    makeBarFaqs,
    makeBarMenuItems,
    makeBarVenue,
    makeCasaQuinta,
    makeCasaQuintaFaqs,
    makeKayakExperience,
    makeKayakFaqs
} from './fixtures/real-shaped-listings';

/** Raw enum values / slugs that must never reach the visitor. */
const RAW_CODE_PATTERN =
    /\b(COUNTRY_HOUSE|CABIN|KAYAK_RENTAL|BOLICHE|MID|per_person|air_conditioning|pet_friendly|river_front)\b/;

/** Asserts every owner-data fence in `ctx` is well formed (S,E,S,E…). */
function expectWellFormedFences(ctx: string): void {
    const tokens: Array<{ at: number; kind: string }> = [];
    for (const [marker, kind] of [
        [OWNER_DATA_DELIMITER_START, 'S'],
        [OWNER_DATA_DELIMITER_END, 'E']
    ] as const) {
        let idx = ctx.indexOf(marker);
        while (idx !== -1) {
            tokens.push({ at: idx, kind });
            idx = ctx.indexOf(marker, idx + marker.length);
        }
    }
    const seq = tokens
        .sort((a, b) => a.at - b.at)
        .map((t) => t.kind)
        .join('');
    expect(seq.length).toBeGreaterThan(0);
    expect(seq).toBe('SE'.repeat(seq.length / 2));
}

function buildCasaQuinta(locale: 'es' | 'en' | 'pt'): string {
    return buildMarkdownContext(
        makeCasaQuinta() as never,
        makeCasaQuintaFaqs(),
        CASA_QUINTA_AMENITY_SLUGS.map((slug) => ({ name: slug })),
        CASA_QUINTA_FEATURE_SLUGS.map((slug) => ({ name: slug })),
        [],
        locale
    );
}

// ---------------------------------------------------------------------------
// 1. Language
// ---------------------------------------------------------------------------

describe('HOS-2095 #1 — the answer language follows the latest user message', () => {
    it.each([
        'es',
        'en',
        'pt'
    ] as const)('never pins the answer to the page locale (%s) as a hard instruction', (locale) => {
        const msg = buildChatSystemMessage('ctx', 'prompt', locale);
        expect(msg).not.toContain(`You MUST respond in the user's language: locale is`);
        expect(msg).toContain("language of the visitor's latest message");
        expect(msg).toContain(`page locale is "${locale}"`);
        expect(msg).toContain('only as a fallback');
    });

    it('tells the model the Spanish context headings are not a reason to answer in Spanish', () => {
        const msg = buildChatSystemMessage('ctx', 'prompt', 'es');
        expect(msg).toContain('written in Spanish');
    });

    it('HOS-2100: field names and values are translated too, never a word left in another language', () => {
        // Arrange / Act
        const msg = buildChatSystemMessage('ctx', 'prompt', 'pt');

        // Assert
        expect(msg).toContain('field names and values included (amenities, rules, labels)');
        expect(msg).toContain('never leave a word or a sentence in another language');
        expect(msg).toContain('keeping proper names unchanged');
    });

    it('the accommodation chat uses the SAME shared system-message builder', () => {
        expect(accommodationBuildChatSystemMessage).toBe(buildChatSystemMessage);
    });
});

describe('HOS-2095 round 2 — explicit reply language over the real system message', () => {
    it.each([
        ['Hi! Is breakfast included?', 'en'],
        ['oi, aceita cachorro?', 'pt'],
        ['hola, tienen pileta?', 'es']
    ] as const)('"%s" on a Spanish page: the %s line comes LAST, after the locale fallback', (question, language) => {
        // Arrange
        const base = buildChatSystemMessage('ctx', 'prompt', 'es');

        // Act
        const { system } = appendReplyLanguageInstruction({
            system: base,
            latestUserMessage: question
        });

        // Assert
        const lines = system.split('\n');
        expect(lines.at(-1)).toBe(REPLY_LANGUAGE_INSTRUCTIONS[language]);
        expect(lines.at(-2)).toContain('page locale is "es"');
        expect(system.startsWith(base)).toBe(true);
    });

    it('keeps the generic rule alone when the message cannot be decided', () => {
        const base = buildChatSystemMessage('ctx', 'prompt', 'en');
        expect(
            appendReplyLanguageInstruction({ system: base, latestUserMessage: 'wifi?' }).system
        ).toBe(base);
    });
});

// ---------------------------------------------------------------------------
// 2. Labels, never raw codes
// ---------------------------------------------------------------------------

describe('HOS-2095 #2 — human labels instead of enum values and slugs', () => {
    it('accommodation (en): type, amenities and features render as English labels', () => {
        const ctx = buildCasaQuinta('en');
        expect(ctx).toContain('**Type**: Country house');
        expect(ctx).toContain('- Air conditioning');
        expect(ctx).toContain('- Pet friendly');
        expect(ctx).not.toMatch(RAW_CODE_PATTERN);
    });

    it('accommodation (es): labels follow the page locale', () => {
        const ctx = buildCasaQuinta('es');
        expect(ctx).toContain('Casa quinta');
        expect(ctx).toContain('- Aire acondicionado');
        expect(ctx).toContain('- Se aceptan mascotas');
        expect(ctx).not.toMatch(RAW_CODE_PATTERN);
    });

    it('accommodation (pt): labels follow the page locale', () => {
        const ctx = buildCasaQuinta('pt');
        expect(ctx).toContain('Chacara');
        expect(ctx).not.toMatch(RAW_CODE_PATTERN);
    });

    it('a slug with no catalog label degrades to a humanized slug, never the raw slug', () => {
        const ctx = buildMarkdownContext(
            makeCasaQuinta() as never,
            [],
            [{ name: 'infinity_pool_xl' }],
            [{ name: 'brand-new-feature' }],
            [],
            'es'
        );
        expect(ctx).toContain('- Infinity pool xl');
        expect(ctx).toContain('- Brand new feature');
        expect(ctx).not.toContain('infinity_pool_xl');
        expect(ctx).not.toContain('brand-new-feature');
    });

    it('an unknown accommodation type degrades to a humanized label', () => {
        const ctx = buildMarkdownContext(
            { ...makeCasaQuinta(), type: 'TREE_HOUSE' } as never,
            [],
            [],
            [],
            [],
            'en'
        );
        expect(ctx).toContain('**Type**: Tree house');
        expect(ctx).not.toContain('TREE_HOUSE');
    });

    it('venue: type and price range render as labels (en and es)', () => {
        const en = buildVenueMarkdownContext(makeBarVenue() as never, [], [], false, null, 'en');
        expect(en).toContain('Bar');
        expect(en).toContain('Moderate');
        expect(en).not.toMatch(/\bMID\b/);
        const es = buildVenueMarkdownContext(
            { ...makeBarVenue(), type: 'BOLICHE' } as never,
            [],
            [],
            false,
            null,
            'es'
        );
        expect(es).toContain('Boliche');
        expect(es).toContain('Moderado');
        expect(es).not.toMatch(/\b(MID|BOLICHE)\b/);
    });

    it('experience: type and price unit render as labels', () => {
        const ctx = buildExperienceMarkdownContext(makeKayakExperience() as never, [], true, 'es');
        expect(ctx).toContain('Alquiler de kayak');
        expect(ctx).toContain('por persona');
        expect(ctx).not.toMatch(/\b(KAYAK_RENTAL|per_person)\b/);
    });
});

// ---------------------------------------------------------------------------
// 3. Prices readable (and correct)
// ---------------------------------------------------------------------------

describe('HOS-2095 #3 — prices are formatted as currency', () => {
    it('venue carta prices are ARS-formatted, not a bare integer', () => {
        const ctx = buildVenueMarkdownContext(
            makeBarVenue() as never,
            [],
            makeBarMenuItems(),
            true,
            null,
            'es'
        );
        // 450000 centavos = $ 4.500 (es-AR grouping).
        expect(ctx).toMatch(/\*\*Plato 1\*\* — \$\s4\.500/);
        expect(ctx).not.toContain('$4500');
    });

    it('experience priceFrom is centavos and renders as pesos (it was 100x before)', () => {
        const ctx = buildExperienceMarkdownContext(makeKayakExperience() as never, [], true, 'es');
        expect(ctx).toMatch(/\$\s15\.000/);
        expect(ctx).not.toContain('1500000');
    });

    it('accommodation base price is currency-formatted', () => {
        const ctx = buildCasaQuinta('es');
        expect(ctx).toMatch(/\$\s85\.000/);
    });
});

// ---------------------------------------------------------------------------
// 7. Truncation no longer drops data the owner entered
// ---------------------------------------------------------------------------

describe('HOS-2095 #7 — the context keeps the owner data the caps used to drop', () => {
    it('keeps amenity #37 (air conditioning)', () => {
        expect(buildCasaQuinta('es')).toContain('Aire acondicionado');
    });

    it('keeps FAQ #15 (parking)', () => {
        expect(buildCasaQuinta('es')).toContain('¿Hay estacionamiento?');
    });

    it('keeps the pool dimensions written after char 800 of the description', () => {
        expect(buildCasaQuinta('es')).toContain('8 x 4 metros');
    });

    it('lists featured / higher-weight amenities first when a cap does apply', () => {
        const many = Array.from({ length: 150 }, (_, i) => ({
            name: `amenity_${i}`,
            isFeatured: false,
            displayWeight: 10
        }));
        many.push({ name: 'air_conditioning', isFeatured: true, displayWeight: 90 });
        const ctx = buildMarkdownContext(makeCasaQuinta() as never, [], many, [], [], 'es');
        const amenities = ctx.split('### Amenities')[1]?.split('###')[0] ?? '';
        const first = amenities.split('\n').find((line) => line.startsWith('- '));
        expect(first).toBe('- Aire acondicionado');
    });

    it('venue keeps FAQ #12 and the description past char 800', () => {
        const ctx = buildVenueMarkdownContext(
            makeBarVenue() as never,
            makeBarFaqs(),
            makeBarMenuItems(),
            true,
            null,
            'es'
        );
        expect(ctx).toContain('¿Toman reservas?');
        expect(ctx).toContain('Plato 30');
        expect(ctx).toContain(String(makeBarVenue().description));
    });

    it('experience keeps all 12 FAQs and the full description', () => {
        const ctx = buildExperienceMarkdownContext(
            makeKayakExperience() as never,
            makeKayakFaqs(),
            true,
            'es'
        );
        expect(ctx).toContain('número 12');
        expect(ctx).toContain(String(makeKayakExperience().description));
    });

    it('stays within a reasonable budget on the real-shaped listings (< 3,000 tokens each)', () => {
        const blocks = [
            buildCasaQuinta('es'),
            buildVenueMarkdownContext(
                makeBarVenue() as never,
                makeBarFaqs(),
                makeBarMenuItems(),
                true,
                null,
                'es'
            ),
            buildExperienceMarkdownContext(
                makeKayakExperience() as never,
                makeKayakFaqs(),
                true,
                'es'
            )
        ];
        for (const block of blocks) {
            expect(block.length / 4).toBeLessThan(3000);
        }
    });
});

// ---------------------------------------------------------------------------
// Fence + no contact leakage
// ---------------------------------------------------------------------------

describe('HOS-2095 — fence and contact invariants still hold', () => {
    it('every builder keeps its owner-data fences well formed', () => {
        expectWellFormedFences(buildCasaQuinta('en'));
        expectWellFormedFences(
            buildVenueMarkdownContext(
                makeBarVenue() as never,
                makeBarFaqs(),
                makeBarMenuItems(),
                true,
                null,
                'en'
            )
        );
        expectWellFormedFences(
            buildExperienceMarkdownContext(
                makeKayakExperience() as never,
                makeKayakFaqs(),
                true,
                'en'
            )
        );
    });

    it('never renders contact details, even when the row carries them', () => {
        const contact = {
            contactInfo: { mobilePhone: '+54 9 3442 555-0101', personalEmail: 'dueno@example.com' },
            whatsapp: '+5493442555010'
        };
        const blocks = [
            buildMarkdownContext(
                { ...makeCasaQuinta(), ...contact } as never,
                [],
                [],
                [],
                [],
                'es'
            ),
            buildVenueMarkdownContext(
                { ...makeBarVenue(), ...contact } as never,
                [],
                [],
                false,
                null,
                'es'
            ),
            buildExperienceMarkdownContext(
                { ...makeKayakExperience(), ...contact } as never,
                [],
                true,
                'es'
            )
        ];
        for (const block of blocks) {
            expect(block).not.toContain('555');
            expect(block).not.toContain('dueno@example.com');
        }
    });
});

// ---------------------------------------------------------------------------
// 5. Third-person voice over first-person owner text
// ---------------------------------------------------------------------------

describe('HOS-2095 #5 — owner text is relayed in the third person', () => {
    it('every builder opens with the third-person voice instruction', () => {
        const blocks = [
            buildCasaQuinta('es'),
            buildVenueMarkdownContext(
                makeBarVenue() as never,
                makeBarFaqs(),
                [],
                false,
                null,
                'es'
            ),
            buildExperienceMarkdownContext(makeKayakExperience() as never, [], true, 'es')
        ];
        for (const block of blocks) {
            const directive = block.split('\n')[0] ?? '';
            expect(directive).toContain('in the third person');
            expect(directive).toContain('never the owner or its staff');
        }
    });
});

// ---------------------------------------------------------------------------
// 8. Owner-entered fields the context used to omit
// ---------------------------------------------------------------------------

/** A real `OpeningHoursSchema` value (the shape the column actually stores). */
const REAL_OPENING_HOURS = {
    timezone: 'America/Argentina/Buenos_Aires',
    days: {
        mon: { closed: true, shifts: [] },
        tue: { closed: false, shifts: [{ open: '12:00', close: '15:00' }] },
        wed: { closed: false, shifts: [{ open: '12:00', close: '15:00' }] },
        thu: { closed: false, shifts: [{ open: '12:00', close: '15:00' }] },
        fri: {
            closed: false,
            shifts: [
                { open: '12:00', close: '15:00' },
                { open: '20:00', close: '23:59' }
            ]
        },
        sat: { closed: false, shifts: [{ open: '20:00', close: '23:59' }] },
        sun: { closed: true, shifts: [] }
    },
    notesI18n: { es: 'Feriados abrimos al mediodía.', en: '', pt: '' }
};

describe('HOS-2095 #8 — owner-entered fields reach the context', () => {
    it('venue renders the REAL opening-hours shape (it rendered only the timezone before)', () => {
        const ctx = buildVenueMarkdownContext(
            { ...makeBarVenue(), openingHours: REAL_OPENING_HOURS } as never,
            [],
            [],
            false,
            null,
            'es'
        );
        expect(ctx).toContain('- Lunes: Cerrado');
        expect(ctx).toContain('- Viernes: 12:00–15:00, 20:00–23:59');
        expect(ctx).not.toContain('timezone');
        expectWellFormedFences(ctx);
        expect(ctx).toContain(
            `${OWNER_DATA_DELIMITER_START}\nFeriados abrimos al mediodía.\n${OWNER_DATA_DELIMITER_END}`
        );
    });

    it('venue day labels follow the page locale', () => {
        const ctx = buildVenueMarkdownContext(
            { ...makeBarVenue(), openingHours: REAL_OPENING_HOURS } as never,
            [],
            [],
            false,
            null,
            'en'
        );
        expect(ctx).toContain('- Monday: Closed');
    });

    it('venue renders the reservation policy', () => {
        const ctx = buildVenueMarkdownContext(
            { ...makeBarVenue(), policies: { reservations: 'recommended' } } as never,
            [],
            [],
            false,
            null,
            'es'
        );
        expect(ctx).toContain('**Reservas**: se recomienda reservar');
    });

    it('experience renders its schedule', () => {
        const ctx = buildExperienceMarkdownContext(
            { ...makeKayakExperience(), openingHours: REAL_OPENING_HOURS } as never,
            [],
            true,
            'es'
        );
        expect(ctx).toContain('### Horarios');
        expect(ctx).toContain('- Sábado: 20:00–23:59');
        expectWellFormedFences(ctx);
    });

    it('accommodation renders the house rules (check-in/out, pets, smoking, min nights)', () => {
        const ctx = buildCasaQuinta('es');
        expect(ctx).toContain('**Check-in**: 14:00–20:00');
        expect(ctx).toContain('**Check-out**: hasta 10:00');
        expect(ctx).toContain('**Mascotas**: sí, se admiten');
        expect(ctx).toContain('**Fumar**: solo en espacios al aire libre');
        expect(ctx).toContain('**Mínimo de noches**: 2');
    });
});

// ---------------------------------------------------------------------------
// Review follow-ups (PR #4249)
// ---------------------------------------------------------------------------

/** A 2,000-char FAQ answer (schema maximum), made of words so a word cut is observable. */
const MAX_ANSWER = 'palabra '.repeat(250).trim();

/** `count` FAQs with maxed-out question (300) and answer (2,000) lengths. */
function maxedFaqs(count: number): Array<{ question: string; answer: string }> {
    return Array.from({ length: count }, (_, i) => ({
        question: `${'¿'}${String(i).padStart(3, '0')} ${'pregunta '.repeat(32)}`.slice(0, 300),
        answer: MAX_ANSWER
    }));
}

describe('review #1 — owner text is bounded, so the worst case is bounded', () => {
    it('truncates a long FAQ answer at a word boundary with "…"', () => {
        const ctx = buildMarkdownContext(
            makeCasaQuinta() as never,
            [{ question: '¿Larga?', answer: MAX_ANSWER }],
            [],
            [],
            [],
            'es'
        );
        const answerLine = ctx.split('\n').find((line) => line.startsWith('A: ')) ?? '';
        const answer = answerLine.slice(3);
        expect(answer.endsWith('…')).toBe(true);
        expect(answer.length).toBeLessThanOrEqual(701);
        // Word boundary: the cut never leaves half a word before the marker.
        expect(answer.slice(0, -1).trimEnd().endsWith('palabra')).toBe(true);
    });

    it('caps the whole FAQ section with a char budget and says how many were left out', () => {
        const ctx = buildMarkdownContext(
            makeCasaQuinta() as never,
            maxedFaqs(30),
            [],
            [],
            [],
            'es'
        );
        const section = ctx.split('### FAQs')[1] ?? '';
        expect(section.length).toBeLessThan(7000);
        expect(section).toMatch(/\d+ preguntas frecuentes más no se incluyeron/);
    });

    it('venue and experience FAQ sections are budgeted too', () => {
        const venue = buildVenueMarkdownContext(
            makeBarVenue() as never,
            maxedFaqs(30),
            [],
            false,
            null,
            'es'
        );
        const experience = buildExperienceMarkdownContext(
            makeKayakExperience() as never,
            maxedFaqs(30),
            true,
            'es'
        );
        for (const ctx of [venue, experience]) {
            const section = ctx.split('### Preguntas frecuentes')[1] ?? '';
            expect(section.length).toBeLessThan(7000);
        }
    });

    it('worst case: maxed-out listings stay under 24,000 chars (~6k tokens) each', () => {
        const longText = (n: number) => 'texto '.repeat(Math.ceil(n / 6)).slice(0, n);
        const accommodation = buildMarkdownContext(
            {
                ...makeCasaQuinta(),
                name: longText(200),
                summary: longText(300),
                description: longText(10000)
            } as never,
            maxedFaqs(60),
            Array.from({ length: 176 }, (_, i) => ({ name: `amenity_number_${i}_long_slug` })),
            Array.from({ length: 106 }, (_, i) => ({ name: `feature_number_${i}_long_slug` })),
            Array.from({ length: 10 }, (_, i) => ({
                title: longText(300),
                content: longText(2000),
                category: `Categoría ${i % 3}`
            })),
            'es'
        );
        const venue = buildVenueMarkdownContext(
            {
                ...makeBarVenue(),
                name: longText(200),
                summary: longText(300),
                description: longText(10000),
                openingHours: { ...REAL_OPENING_HOURS, notesI18n: { es: longText(5000) } }
            } as never,
            maxedFaqs(60),
            Array.from({ length: 40 }, (_, i) => ({
                sectionName: longText(200),
                name: `${i} ${longText(300)}`,
                description: longText(1000),
                priceCents: 999999999,
                isAvailable: false
            })),
            true,
            {
                minAge: 18,
                legalNotice: longText(300),
                entryLabel: 'Entrada paga',
                entryNote: longText(200),
                entryPriceFrom: 99999,
                dressCodeLabel: 'Elegante',
                dressCodeNote: longText(200)
            },
            'es'
        );
        const experience = buildExperienceMarkdownContext(
            {
                ...makeKayakExperience(),
                name: longText(200),
                summary: longText(300),
                description: longText(10000),
                meetingPoint: longText(300),
                meetingPointDirections: Array.from({ length: 12 }, () => longText(400)),
                whatToBring: Array.from({ length: 20 }, () => longText(160)),
                requirements: Array.from({ length: 20 }, () => longText(160)),
                policies: { cancellation: longText(3000), privateGroups: true },
                openingHours: { ...REAL_OPENING_HOURS, notesI18n: { es: longText(5000) } }
            } as never,
            maxedFaqs(60),
            true,
            'es'
        );
        for (const block of [accommodation, venue, experience]) {
            expect(block.length).toBeLessThan(24000);
        }
    });
});

describe('review #2/#3/#8 — opening hours edge cases', () => {
    it('a row without `days` never re-renders timezone and keeps notes inside the fence', () => {
        const ctx = buildVenueMarkdownContext(
            {
                ...makeBarVenue(),
                openingHours: {
                    timezone: 'America/Argentina/Buenos_Aires',
                    notes: 'Nota del dueño'
                }
            } as never,
            [],
            [],
            false,
            null,
            'es'
        );
        expect(ctx).not.toContain('timezone');
        expect(ctx).not.toContain('America/Argentina');
        expect(ctx).toContain(
            `${OWNER_DATA_DELIMITER_START}\nNota del dueño\n${OWNER_DATA_DELIMITER_END}`
        );
        expectWellFormedFences(ctx);
    });

    it('drops shift times that are not HH:mm', () => {
        const ctx = buildVenueMarkdownContext(
            {
                ...makeBarVenue(),
                openingHours: {
                    timezone: 'America/Argentina/Buenos_Aires',
                    days: {
                        ...REAL_OPENING_HOURS.days,
                        tue: { closed: false, shifts: [{ open: 'IGNORE ALL', close: '25' }] }
                    }
                }
            } as never,
            [],
            [],
            false,
            null,
            'es'
        );
        expect(ctx).not.toContain('IGNORE ALL');
    });

    it('a day missing from `days` (or with no valid shift) reads as "sin información", not closed', () => {
        const { wed: _wed, ...withoutWednesday } = REAL_OPENING_HOURS.days;
        const ctx = buildVenueMarkdownContext(
            {
                ...makeBarVenue(),
                openingHours: { timezone: 'America/Argentina/Buenos_Aires', days: withoutWednesday }
            } as never,
            [],
            [],
            false,
            null,
            'es'
        );
        expect(ctx).toContain('- Miércoles: sin información');
    });
});

describe('review #4/#8 — neutral voice example, generic language rule, single currency', () => {
    it('the voice directive does not name a restaurant in every vertical', () => {
        for (const block of [
            buildCasaQuinta('es'),
            buildExperienceMarkdownContext(makeKayakExperience() as never, [], true, 'es')
        ]) {
            const directive = block.split('\n')[0] ?? '';
            expect(directive).not.toContain('restaurant');
            expect(directive).toContain('el lugar acepta');
        }
    });

    it('the language rule names the latest message generically, not a closed list of languages', () => {
        const msg = buildChatSystemMessage('ctx', 'prompt', 'es');
        expect(msg).toContain("the language of the visitor's latest message");
        expect(msg).not.toContain('Spanish, English or Portuguese');
    });

    it('the accommodation price shows the currency once (en: no "ARS … ARS")', () => {
        const en = buildCasaQuinta('en');
        const priceLine = en.split('\n').find((line) => line.startsWith('**Precio base**')) ?? '';
        expect(priceLine.match(/ARS/g) ?? []).toHaveLength(1);
        const es = buildCasaQuinta('es');
        expect(es).toMatch(/\*\*Precio base\*\*: \$\s85\.000 ARS\/noche/);
    });
});
