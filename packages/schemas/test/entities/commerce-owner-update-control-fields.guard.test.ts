/**
 * Guard: the owner-facing commerce update payload must never carry a control
 * field (HOS-589 AC-11, HOS-166 §6.2).
 *
 * HOS-686 gives commerce listings a `moderate()` action and a dedicated admin
 * route. That makes the owner side of the boundary load-bearing rather than
 * incidental: if `moderationState` ever became owner-writable, an owner could
 * clear their own rejection through an ordinary PATCH and the reconciler would
 * put the listing straight back on the public site.
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
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '../../src/enums/index.js';

/** Fields an owner must never move through their own update payload. */
const CONTROL_FIELDS = ['moderationState', 'visibility', 'lifecycleState', 'isFeatured'] as const;

const OWNER_SCHEMAS = [
    { name: 'GastronomyOwnerUpdateInputSchema', schema: GastronomyOwnerUpdateInputSchema },
    { name: 'ExperienceOwnerUpdateInputSchema', schema: ExperienceOwnerUpdateInputSchema }
] as const;

describe('commerce owner update payload excludes the control fields (AC-11)', () => {
    for (const { name, schema } of OWNER_SCHEMAS) {
        for (const field of CONTROL_FIELDS) {
            it(`${name} does not declare ${field}`, () => {
                expect(
                    Object.keys(schema.shape),
                    `${field} is back in ${name}. Control fields move through their dedicated admin action — moderationState through POST /api/v1/admin/{gastronomies|experiences}/:id/moderate, which is where COMMERCE_MODERATION_CHANGE is enforced.`
                ).not.toContain(field);
            });
        }

        it(`${name} strips a control-field payload instead of persisting it`, () => {
            const result = schema.safeParse({
                name: 'A perfectly ordinary edit',
                moderationState: ModerationStatusEnum.APPROVED,
                visibility: VisibilityEnum.PUBLIC,
                lifecycleState: LifecycleStatusEnum.ACTIVE,
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
