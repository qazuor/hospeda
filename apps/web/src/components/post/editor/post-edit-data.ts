/**
 * @file post-edit-data.ts
 * @description The post editor's form-state shape and its PATCH-diff builder
 * (HOS-374 Phase 2 2C-2).
 *
 * Kept out of the orchestrator component so the diff contract is unit-testable
 * without mounting React — the same split the commerce editor uses
 * (`commerce-edit-data.ts`).
 */

import type { PostEditDetail } from '@/lib/api/types';

/**
 * Editable post fields held in the editor's React state.
 *
 * Every value is form-friendly (a string, or `null` for a cleared number), NOT
 * the API's shape: `relatedDestinationId` is `''` rather than `null` when
 * unset, because a `<select>` cannot hold `null`.
 *
 * Deliberately absent:
 *  - `slug` — server-derived at create time and immutable afterwards here.
 *    Changing it silently breaks the post's public URL with no redirect
 *    (same reasoning as the commerce listing's slug, HOS-166 OQ-3).
 *  - `isFeatured` — editorial curation, not authorship. The PATCH schema
 *    accepts it, but an author must not be able to feature their own post.
 *  - `visibility` / `moderationState` / `lifecycleState` — publication state
 *    moves through `POST /protected/posts/:id/publish-state`, never through
 *    the generic PATCH payload (HOS-374 §7.6.4).
 *  - `isPublished` — a name that lies. `httpToDomainPostUpdate` maps it to the
 *    `publishedAt` TIMESTAMP; it publishes nothing.
 */
export interface PostEditFormData {
    readonly title: string;
    readonly summary: string;
    readonly content: string;
    readonly category: string;
    /** `null` when the author cleared the field — never coerced to `0`. */
    readonly readingTimeMinutes: number | null;
    /** `''` means "no related destination"; maps to an omitted PATCH key. */
    readonly relatedDestinationId: string;
}

/**
 * Builds the editor's initial form state from the fetched post.
 *
 * @param detail - The transformed protected `getById` payload.
 * @returns Form state seeded with the persisted values.
 */
export function buildPostEditFormData({
    detail
}: {
    readonly detail: PostEditDetail;
}): PostEditFormData {
    return {
        title: detail.title,
        summary: detail.summary,
        content: detail.content,
        category: detail.category,
        readingTimeMinutes: detail.readingTimeMinutes,
        relatedDestinationId: detail.relatedDestinationId ?? ''
    };
}

/**
 * Builds the PATCH body as the diff between the edited form and the last
 * persisted snapshot.
 *
 * Two field names are translated on the way out, because the HTTP payload and
 * the form state deliberately differ:
 *  - `relatedDestinationId` (domain/response name) → `destinationId` (the key
 *    `PostUpdateHttpSchema` accepts; `httpToDomainPostUpdate` maps it back).
 *  - a cleared `relatedDestinationId` ships `undefined`, not `null`: the HTTP
 *    schema types it `z.string().uuid().optional()`, so an explicit `null`
 *    fails validation.
 *
 * @param params - Current form state and the persisted baseline to diff against.
 * @returns Only the changed keys, in HTTP-payload naming.
 */
export function buildPostPatchPayload({
    current,
    baseline
}: {
    readonly current: PostEditFormData;
    readonly baseline: PostEditFormData;
}): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (current.title !== baseline.title) {
        payload.title = current.title;
    }
    if (current.summary !== baseline.summary) {
        payload.summary = current.summary;
    }
    if (current.content !== baseline.content) {
        payload.content = current.content;
    }
    if (current.category !== baseline.category) {
        payload.category = current.category;
    }
    if (current.readingTimeMinutes !== baseline.readingTimeMinutes) {
        payload.readingTimeMinutes = current.readingTimeMinutes;
    }
    if (current.relatedDestinationId !== baseline.relatedDestinationId) {
        payload.destinationId = current.relatedDestinationId || undefined;
    }

    return payload;
}
