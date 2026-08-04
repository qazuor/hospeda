import { describe, expect, it } from 'vitest';
import {
    EventPatchInputSchema,
    EventUpdateInputSchema
} from '../../src/entities/event/event.crud.schema.js';
import {
    PostPatchInputSchema,
    PostUpdateInputSchema
} from '../../src/entities/post/post.crud.schema.js';
import {
    LifecycleStatusEnum,
    ModerationStatusEnum,
    VisibilityEnum
} from '../../src/enums/index.js';

/**
 * Guard: the generic post/event update payload must never accept a state field
 * again (HOS-374 §7.6.4).
 *
 * `moderationState`, `visibility` and `lifecycleState` each have a dedicated
 * endpoint gated by its own permission. As long as the generic update also
 * accepts them, every one of those gates is bypassable by an actor who merely
 * holds `POST_UPDATE`/`EVENT_UPDATE` — which is precisely how the four granular
 * publish permissions ended up decorative for so long.
 *
 * This is a guard, not a test of behavior: re-adding any of the three to a
 * `*UpdateInputSchema` is a one-line change that would silently reopen the
 * hole, and no functional test would notice.
 */
const FORBIDDEN_STATE_FIELDS = ['moderationState', 'visibility', 'lifecycleState'] as const;

const SCHEMAS = [
    { name: 'PostUpdateInputSchema', schema: PostUpdateInputSchema },
    { name: 'PostPatchInputSchema', schema: PostPatchInputSchema },
    { name: 'EventUpdateInputSchema', schema: EventUpdateInputSchema },
    { name: 'EventPatchInputSchema', schema: EventPatchInputSchema }
] as const;

describe('content state fields are excluded from the generic update payload', () => {
    for (const { name, schema } of SCHEMAS) {
        for (const field of FORBIDDEN_STATE_FIELDS) {
            it(`${name} does not declare ${field}`, () => {
                expect(
                    Object.keys(schema.shape),
                    `${field} is back in ${name}. It must be moved through its dedicated endpoint (/moderate, /publish-state or /lifecycle-state), which is where its permission is enforced.`
                ).not.toContain(field);
            });
        }
    }

    it('a payload carrying all three does not reach the service with any of them', () => {
        // Post schemas are non-strict, so the keys are stripped rather than
        // rejected. Either outcome is acceptable — what must never happen is the
        // value surviving into the update.
        const result = PostUpdateInputSchema.safeParse({
            title: 'A perfectly ordinary edit',
            moderationState: ModerationStatusEnum.APPROVED,
            visibility: VisibilityEnum.PUBLIC,
            lifecycleState: LifecycleStatusEnum.ACTIVE
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('moderationState');
            expect(result.data).not.toHaveProperty('visibility');
            expect(result.data).not.toHaveProperty('lifecycleState');
        }
    });

    it('the event payload rejects them outright — its schema is strict', () => {
        const result = EventUpdateInputSchema.safeParse({
            name: 'A perfectly ordinary edit',
            moderationState: ModerationStatusEnum.APPROVED
        });

        expect(result.success).toBe(false);
    });
});
