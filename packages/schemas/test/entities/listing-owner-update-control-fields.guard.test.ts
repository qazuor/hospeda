/**
 * Guard: the owner-facing listing update payload must never carry a control
 * field (HOS-589 AC-11, HOS-166 §6.2).
 *
 * Since HOS-1641 the listing state is ONE field, `publicationStatus`, and only
 * the PB publication transitions write it — taking a listing down by
 * moderation is PB10 (`POST /api/v1/admin/{vertical}/:id/moderate`). That makes
 * the owner side of the boundary load-bearing rather than incidental: if
 * `publicationStatus` ever became owner-writable, an owner could lift their own
 * moderation, or publish without paying, through an ordinary PATCH.
 *
 * The schemas are non-strict, so a re-added field would NOT throw — it would be
 * accepted and written, with the owner's PATCH returning 200 either way. That
 * is exactly the failure a guard exists for, and it is why this asserts on the
 * declared shape as well as on parse output: `pick()`ing the field back in is a
 * one-line change no functional test would notice.
 */
import { describe, expect, it } from 'vitest';
import { ExperienceOwnerUpdateInputSchema } from '../../src/entities/experience/experience.crud.schema.js';
import { GastronomyOwnerUpdateInputSchema } from '../../src/entities/gastronomy/gastronomy.crud.schema.js';
import { PublicationStatusEnum } from '../../src/enums/index.js';

/** Fields an owner must never move through their own update payload. */
const CONTROL_FIELDS = ['publicationStatus', 'isFeatured'] as const;

const OWNER_SCHEMAS = [
    { name: 'GastronomyOwnerUpdateInputSchema', schema: GastronomyOwnerUpdateInputSchema },
    { name: 'ExperienceOwnerUpdateInputSchema', schema: ExperienceOwnerUpdateInputSchema }
] as const;

describe('listing owner update payload excludes the control fields (AC-11)', () => {
    for (const { name, schema } of OWNER_SCHEMAS) {
        for (const field of CONTROL_FIELDS) {
            it(`${name} does not declare ${field}`, () => {
                expect(
                    Object.keys(schema.shape),
                    `${field} is back in ${name}. Control fields move through their dedicated action — publicationStatus only through the PB publication transitions (moderation is PB10, POST /api/v1/admin/{gastronomies|experiences}/:id/moderate).`
                ).not.toContain(field);
            });
        }

        it(`${name} strips a control-field payload instead of persisting it`, () => {
            const result = schema.safeParse({
                name: 'A perfectly ordinary edit',
                publicationStatus: PublicationStatusEnum.PUBLISHED,
                isFeatured: true
            });

            expect(result.success).toBe(true);
            if (result.success) {
                for (const field of CONTROL_FIELDS) {
                    expect(result.data).not.toHaveProperty(field);
                }
                // Instrument check: the schema really did parse the payload, so
                // "no control fields" is a measurement rather than the trivial
                // consequence of an empty result.
                expect(result.data).toHaveProperty('name');
            }
        });
    }
});
