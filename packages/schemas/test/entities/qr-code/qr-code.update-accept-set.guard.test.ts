/**
 * Freezes WHICH FIELDS a QR-code PATCH may carry (HOS-981 PR 4).
 *
 * ## Why this guard exists
 *
 * Nothing anywhere pinned the accept-set of an update schema. Measured: taking
 * `purpose` out of the `.omit()` list left 45 schema tests and 26 admin-route
 * tests green. The suites that look like they cover these schemas pin defaults,
 * render-option merging and response shapes — never the one property that makes
 * an immutable field immutable, which is that the key is ABSENT.
 *
 * That gap is not academic. `qr_codes` carries fields whose whole job is to not
 * move, and each of them fails silently rather than loudly when it does:
 *
 * - `slug` is printed on a sticker. Renaming it strands every code in the field.
 * - `entityType` + `entityId` + `purpose` are ONE uniqueness key. Moving any
 *   single column hides the row from its own provisioner, which then mints a
 *   second permanent slug for the same subject. The worst shape of this is
 *   `PATCH {entityId: <provider B>}` on provider A's code: A's sticker, already
 *   on a van, starts sending A's customers to B's page and crediting B with the
 *   scans, while A's panel quietly issues a replacement.
 *
 * ## What it asserts, and why it is written this way
 *
 * An ASSERTION guard, not a behaviour test. It states the exact key set twice
 * over — once as "these are accepted", once as "these are refused" — so that
 * BOTH directions of drift are caught: widening the schema (a field slips out
 * of the omit list) and narrowing it (a field an operator relies on disappears).
 * A test that only checked the frozen fields were rejected would stay green if
 * somebody deleted `targetUrl`, which is the one field an update is FOR.
 *
 * The rejection half is checked by parsing rather than by reading the shape,
 * because absence from the shape is only half of immutability — `.strict()` is
 * the other half, and a schema that lost its `.strict()` would silently start
 * dropping these keys instead of refusing them.
 *
 * @module test/entities/qr-code/qr-code.update-accept-set.guard
 */

import { describe, expect, it } from 'vitest';
import {
    QrCodeUpdateHttpSchema,
    QrCodeUpdateInputSchema
} from '../../../src/entities/qr-code/index.js';

/**
 * Every field a QR-code PATCH may carry, in both the domain and the HTTP
 * schema. Sorted so the comparison never depends on declaration order.
 *
 * Changing this list is a deliberate act with consequences beyond the schema —
 * read the frozen-field table below before touching it.
 */
const ACCEPTED_UPDATE_KEYS = [
    'description',
    'isActive',
    'label',
    'renderOptions',
    'source',
    'targetUrl'
] as const;

/**
 * Fields that must NEVER be accepted by a PATCH, each with the reason, so a
 * failure tells the next reader what breaks rather than only that something
 * changed.
 */
const FROZEN_UPDATE_FIELDS: ReadonlyArray<{ key: string; sample: unknown; why: string }> = [
    {
        key: 'slug',
        sample: 'k7Qm2XbT',
        why: 'the slug is printed on a sticker; renaming it strands every code already in the field'
    },
    {
        key: 'purpose',
        sample: 'LISTING',
        why: 'part of the (entityType, entityId, purpose) uniqueness key; moving it hides the row from its provisioner, which mints a second permanent slug'
    },
    {
        key: 'entityType',
        sample: 'HOST_TRADE',
        why: 'part of the uniqueness key; freezing only a third of a three-column key protects nothing'
    },
    {
        key: 'entityId',
        sample: '33333333-3333-4333-8333-333333333333',
        why: "part of the uniqueness key; re-pointing it at another subject makes a printed sticker send its owner's customers to someone else's page"
    }
];

const SCHEMAS = [
    { name: 'QrCodeUpdateInputSchema (domain)', schema: QrCodeUpdateInputSchema },
    { name: 'QrCodeUpdateHttpSchema (HTTP)', schema: QrCodeUpdateHttpSchema }
] as const;

describe('QR code update schemas — frozen accept-set', () => {
    for (const { name, schema } of SCHEMAS) {
        it(`${name} accepts exactly the fields a PATCH is allowed to change`, () => {
            const actual = Object.keys(schema.shape).sort();

            expect(
                actual,
                `${name}'s accept-set changed.\n` +
                    `  expected: ${[...ACCEPTED_UPDATE_KEYS].join(', ')}\n` +
                    `  actual:   ${actual.join(', ')}\n` +
                    'A field that APPEARED here escaped the .omit() list — check it is not part of ' +
                    'the (entityType, entityId, purpose) uniqueness key or the printed slug, or a ' +
                    'PATCH can now strand a sticker that is already on a van. A field that ' +
                    'DISAPPEARED removed an operator capability; targetUrl in particular is the ' +
                    'field this entire indirection exists to let people edit.'
            ).toEqual([...ACCEPTED_UPDATE_KEYS]);
        });

        for (const frozen of FROZEN_UPDATE_FIELDS) {
            it(`${name} refuses '${frozen.key}'`, () => {
                const result = schema.safeParse({ [frozen.key]: frozen.sample });

                expect(
                    result.success,
                    `${name} accepted '${frozen.key}', which must stay immutable: ${frozen.why}.`
                ).toBe(false);

                // Refused, not silently dropped. Absence from the shape only
                // makes a field immutable while `.strict()` is there to reject
                // it; without it the key would be stripped and the caller would
                // get a 200 for an edit that never happened.
                const codes = result.success ? [] : result.error.issues.map((issue) => issue.code);
                expect(
                    codes,
                    `${name} did not REFUSE '${frozen.key}' — it dropped it. The schema lost its ` +
                        '.strict(), so an operator now gets a success response for a change that ' +
                        'was silently discarded.'
                ).toContain('unrecognized_keys');
            });
        }
    }

    /**
     * The two schemas are declared independently — the HTTP one is not derived
     * from the domain one — so nothing but this makes them agree. A field
     * frozen on one and open on the other is the same hole with an extra step.
     */
    it('the domain and HTTP schemas freeze the same fields', () => {
        const domain = Object.keys(QrCodeUpdateInputSchema.shape).sort();
        const http = Object.keys(QrCodeUpdateHttpSchema.shape).sort();

        expect(
            http,
            'The HTTP and domain update schemas disagree about what a PATCH may carry. They are ' +
                'declared separately, so a field frozen in one and open in the other is reachable ' +
                'through the route that uses the looser one.'
        ).toEqual(domain);
    });
});
