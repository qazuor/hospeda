/**
 * @file transform-experience-practical-info.test.ts
 * @description The read side of the four practical ficha fields — duration
 * (HOS-898), the two checklists (HOS-1046), the cancellation policy (HOS-1047)
 * and the private-groups flag (HOS-1056) — tested where it actually executes.
 *
 * ## What this file proves, and what it does not
 *
 * `toExperienceDetailPageProps` is the only place the public payload becomes
 * something the detail page can render, so this is where "nothing declared" is
 * decided for each field. Every input that means "the owner said nothing" has to
 * converge on ONE value per field — `null` for the two scalars, `[]` for the
 * lists, `false` for the flag — because each `.astro` component's whole gate is
 * a single presence check on that value. A blank string reaching a view would
 * paint a heading over an empty line and nothing would report it.
 *
 * NOT covered here: the `.astro` components' own branches. Vitest cannot render
 * `.astro` in this repo, so what is covered is the VALUE those branches are
 * handed. The tier projection that decides whether these fields reach this
 * transform at all is covered separately, by a full `ExperiencePublicSchema`
 * parse in `packages/schemas/.../experience.access.schema.test.ts`.
 */

import { describe, expect, it } from 'vitest';
import { toExperienceDetailPageProps } from '@/lib/api/transforms';

const POLICY = 'Si baja el río reprogramamos sin cargo.';

/** A minimal raw public payload; only the practical keys vary per test. */
function buildRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        slug: 'excursion-a-colon',
        name: 'Excursión a Colón',
        type: 'EXCURSION',
        summary: 'Visitá la ciudad vecina de Colón con guía incluido.',
        description: 'Una excursión completa a la ciudad de Colón.',
        priceFrom: 1500000,
        priceUnit: 'per_person',
        isPriceOnRequest: false,
        averageRating: 4.5,
        reviewsCount: 12,
        ...overrides
    };
}

describe('toExperienceDetailPageProps — duration (HOS-898)', () => {
    it('carries a stored duration through as a number', () => {
        // Arrange
        const raw = buildRaw({ durationMinutes: 150 });

        // Act
        const props = toExperienceDetailPageProps({ item: raw, locale: 'es' });

        // Assert — a NUMBER, not a pre-formatted string: the ficha renders in
        // three languages and the wording is chosen at render time.
        expect(props.durationMinutes).toBe(150);
    });

    it('reads a missing key and an explicit null as the same "not declared"', () => {
        expect(
            toExperienceDetailPageProps({ item: buildRaw(), locale: 'es' }).durationMinutes
        ).toBeNull();
        expect(
            toExperienceDetailPageProps({ item: buildRaw({ durationMinutes: null }), locale: 'es' })
                .durationMinutes
        ).toBeNull();
    });

    it('refuses a duration that arrived as a string', () => {
        // The guard is `typeof === 'number'`, so a stringified value from a
        // hand-written payload becomes "not declared" rather than reaching the
        // formatter and rendering NaN.
        const props = toExperienceDetailPageProps({
            item: buildRaw({ durationMinutes: '150' }),
            locale: 'es'
        });

        expect(props.durationMinutes).toBeNull();
    });
});

describe('toExperienceDetailPageProps — checklists (HOS-1046)', () => {
    it('carries both lists through in order', () => {
        const props = toExperienceDetailPageProps({
            item: buildRaw({
                whatToBring: ['Repelente', 'Calzado cerrado'],
                requirements: ['Edad mínima 12 años']
            }),
            locale: 'es'
        });

        expect(props.whatToBring).toEqual(['Repelente', 'Calzado cerrado']);
        expect(props.requirements).toEqual(['Edad mínima 12 años']);
    });

    it('collapses every "no items" input to an empty array', () => {
        // Four shapes mean the same thing and the view must only test one:
        // the key absent, the column null, a non-array value, and an array of
        // blanks. `undefined` reaching the view would throw on `.length`.
        const cases: readonly unknown[] = [undefined, null, 'Repelente', 42, ['', '   ']];

        for (const value of cases) {
            const props = toExperienceDetailPageProps({
                item: buildRaw({ whatToBring: value }),
                locale: 'es'
            });
            expect(props.whatToBring).toEqual([]);
        }
    });

    it('trims items and drops the blank ones without dropping the rest', () => {
        const props = toExperienceDetailPageProps({
            item: buildRaw({ requirements: ['  Saber nadar  ', '', '   ', 'Edad mínima 12 años'] }),
            locale: 'es'
        });

        expect(props.requirements).toEqual(['Saber nadar', 'Edad mínima 12 años']);
    });

    it('drops a non-string entry instead of publishing the literal "null"', () => {
        // `String(x)` would turn a stray null into a bullet reading "null" on a
        // public ficha, which is worse than losing the row.
        const props = toExperienceDetailPageProps({
            item: buildRaw({ whatToBring: ['Repelente', null, 7, 'Traje de baño'] }),
            locale: 'es'
        });

        expect(props.whatToBring).toEqual(['Repelente', 'Traje de baño']);
    });
});

describe('toExperienceDetailPageProps — cancellation policy (HOS-1047)', () => {
    it('carries the owner text through', () => {
        const props = toExperienceDetailPageProps({
            item: buildRaw({ cancellationPolicy: POLICY }),
            locale: 'es'
        });

        expect(props.cancellationPolicy).toBe(POLICY);
    });

    it('collapses absent, null and whitespace-only to null', () => {
        // A whitespace policy is a string, and the view's gate is a presence
        // check — leaving it as `'   '` would render the heading over nothing.
        expect(
            toExperienceDetailPageProps({ item: buildRaw(), locale: 'es' }).cancellationPolicy
        ).toBeNull();
        expect(
            toExperienceDetailPageProps({
                item: buildRaw({ cancellationPolicy: null }),
                locale: 'es'
            }).cancellationPolicy
        ).toBeNull();
        expect(
            toExperienceDetailPageProps({
                item: buildRaw({ cancellationPolicy: '   \n  ' }),
                locale: 'es'
            }).cancellationPolicy
        ).toBeNull();
    });
});

describe('toExperienceDetailPageProps — private groups (HOS-1056)', () => {
    it('turns the CTA on only for an explicit true', () => {
        expect(
            toExperienceDetailPageProps({
                item: buildRaw({ acceptsPrivateGroups: true }),
                locale: 'es'
            }).acceptsPrivateGroups
        ).toBe(true);
    });

    it('reads a missing key, false, and a truthy non-boolean as OFF', () => {
        // Strict `=== true`: a legacy row carries no key at all, and a string
        // "false" is truthy — a loose check would light the CTA up on it.
        for (const value of [undefined, false, null, 'false', 0]) {
            const props = toExperienceDetailPageProps({
                item: buildRaw({ acceptsPrivateGroups: value }),
                locale: 'es'
            });
            expect(props.acceptsPrivateGroups).toBe(false);
        }
    });
});
