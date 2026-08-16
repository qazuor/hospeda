/**
 * @file media-asset-url.test.ts
 * @description Regression suite for the write-side half of H-22 — nothing
 * stopped a non-fetchable URL from being persisted as an entity's photo.
 *
 * ## What happened
 *
 * Nine `post_media` / `event_media` rows reached production with
 * `url = 'blob:https://admin.hospeda.com.ar/<uuid>'`. A `blob:` URL is a
 * browser object handle created by `URL.createObjectURL`: it exists only inside
 * the tab that made it, and here the origin was the admin app, not the web. It
 * resolves for nobody, ever. `public_id` was empty on all nine — the file never
 * reached Cloudinary at all.
 *
 * A real blog post and a real event served those as `<img src>` to every
 * visitor until the rows were cleaned on 2026-08-15.
 *
 * ## Why the data fix was not the whole fix
 *
 * The finding asked for two fronts, and cleaning the rows is only the first.
 * The second is the mechanism: the gallery must not be ABLE to persist a URL
 * that is not the uploaded asset — validation on the write, not just in the
 * form. The form was already behaving; the bad rows came from an older client.
 * So the contract is what has to refuse them, or the same nine rows can be
 * written again tomorrow.
 *
 * `z.string().url()`, which every media schema used, accepts `blob:`, `data:`
 * AND `javascript:`. These tests pin that it no longer does.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { BaseContentMediaSchema } from '../../src/common/content-media.schema.js';
import { ImageSchema, mediaAssetUrl, VideoSchema } from '../../src/common/media.schema.js';
import { ModerationStatusEnum } from '../../src/enums/index.js';

/** URLs a media row must never be able to hold. */
const REJECTED = [
    // The exact shape of the nine production rows.
    'blob:https://admin.hospeda.com.ar/eca5228e-3b54-4f0e-81af-9f4c4dac01ff',
    'data:image/png;base64,iVBORw0KGgo=',
    'javascript:alert(1)',
    // Case must not be an escape hatch.
    'JavaScript:alert(1)',
    'ftp://example.com/photo.jpg',
    'not-a-url',
    ''
] as const;

/** URLs that must keep working — the gate is worthless if it breaks uploads. */
const ACCEPTED = [
    'https://res.cloudinary.com/djqdu6u93/image/upload/hospeda/prod/posts/a/gallery/b.jpg',
    'https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800',
    // Local dev serves media over plain http.
    'http://localhost:3001/media/photo.png',
    // Uppercase scheme is legal per RFC 3986.
    'HTTPS://res.cloudinary.com/x.jpg'
] as const;

describe('mediaAssetUrl (H-22, write-side)', () => {
    const schema = mediaAssetUrl('zodError.test.url.invalid');

    for (const url of REJECTED) {
        it(`rejects ${url === '' ? '<empty string>' : url}`, () => {
            expect(schema.safeParse(url).success).toBe(false);
        });
    }

    for (const url of ACCEPTED) {
        it(`accepts ${url}`, () => {
            expect(schema.safeParse(url).success).toBe(true);
        });
    }

    it('does not turn its host object into a ZodEffects', () => {
        // A `.refine()` would satisfy every assertion above and still break
        // `.pick()` / `.omit()` / `.partial()` on the object schemas that embed
        // this field — a known Zod 4 trap in this repo. Asserting the reachable
        // consequence rather than the internal type: slicing must keep working.
        const obj = z.object({ url: mediaAssetUrl('m'), other: z.string() });

        expect(obj.pick({ url: true }).safeParse({ url: 'https://a.test/x.jpg' }).success).toBe(
            true
        );
        expect(obj.partial().safeParse({}).success).toBe(true);
        expect(obj.omit({ url: true }).safeParse({ other: 'x' }).success).toBe(true);
    });
});

describe('the media schemas that persist an asset URL use it', () => {
    // Asserting through the real schemas, not only the helper: swapping the
    // helper in is the actual fix, and a test of the helper alone would stay
    // green if a schema kept its bare `z.string().url()`.
    const BLOB = 'blob:https://admin.hospeda.com.ar/eca5228e';
    const OK = 'https://res.cloudinary.com/djqdu6u93/image/upload/x.jpg';

    it('ImageSchema rejects a blob: url', () => {
        expect(
            ImageSchema.safeParse({ url: BLOB, moderationState: ModerationStatusEnum.APPROVED })
                .success
        ).toBe(false);
        expect(
            ImageSchema.safeParse({ url: OK, moderationState: ModerationStatusEnum.APPROVED })
                .success
        ).toBe(true);
    });

    it('VideoSchema rejects a blob: url', () => {
        expect(
            VideoSchema.safeParse({ url: BLOB, moderationState: ModerationStatusEnum.APPROVED })
                .success
        ).toBe(false);
    });

    it('BaseContentMediaSchema (post_media / event_media) rejects a blob: url', () => {
        // This is the exact schema behind the nine production rows.
        const row = {
            url: BLOB,
            moderationState: ModerationStatusEnum.PENDING,
            state: 'visible' as const,
            isFeatured: false,
            sortOrder: 0,
            createdAt: new Date('2026-08-12T15:42:06.747Z'),
            updatedAt: new Date('2026-08-12T15:42:06.747Z')
        };
        expect(BaseContentMediaSchema.safeParse(row).success).toBe(false);
        expect(BaseContentMediaSchema.safeParse({ ...row, url: OK }).success).toBe(true);
    });
});
