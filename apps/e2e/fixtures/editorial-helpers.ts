/**
 * Editorial fixtures for the HOS-374 editor flows.
 *
 * Lives beside `api-helpers.ts` rather than inside it for the same reason
 * `commerce-editor-helpers.ts` does: that file is already well past the
 * 500-line budget, and these helpers only serve the post/event editor specs.
 *
 * `createPostAsAuthor` goes through the REAL protected route on purpose — a
 * direct SQL insert would let a spec assert on an `authorId` the fixture chose
 * itself, and authorship being taken from the session instead of the body is
 * one of the things HOS-374 changed (§5.1.3 / D-2).
 */

import { randomBytes } from 'node:crypto';
import { TRUSTED_EDITOR_PERMISSIONS } from '@repo/schemas';
import { execSQL } from './db-helpers.ts';

const DEFAULT_API_BASE_URL = process.env.HOSPEDA_E2E_API_URL ?? 'http://localhost:18001';

export interface CreatedPost {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    /** Moderation verdict the API assigned at creation — always `PENDING`. */
    readonly moderationState: string;
    /** Author switch the API assigned at creation — always `PUBLIC`. */
    readonly visibility: string;
}

interface PostCreateResponse {
    data?: {
        id?: string;
        slug?: string;
        title?: string;
        moderationState?: string;
        visibility?: string;
    };
}

/**
 * Makes an EDITOR a **trusted editor** (HOS-374 §5.1.2 / OQ-1).
 *
 * A trusted editor is not a role and not a column: it is an `EDITOR` holding
 * the four `TRUSTED_EDITOR_PERMISSIONS` as per-user `grant` overrides in
 * `user_permission` (SPEC-170). Writes the rows directly, like `setUserRole`
 * does for hats — the admin endpoint that normally performs this
 * (`PUT /api/v1/admin/users/{id}/trusted-editor`) needs a SUPER_ADMIN session,
 * and a fixture should not have to mint one just to arrange state the test
 * isn't validating.
 *
 * The permission list is DERIVED from `TRUSTED_EDITOR_PERMISSIONS`, never
 * restated: that tuple is the single source of truth, so a fifth permission
 * joining the bundle reaches this fixture without anyone editing it.
 *
 * Idempotent, and it normalizes: the `(user_id, permission)` primary key makes
 * a repeat call a no-op, and a pre-existing `deny` row is upgraded to `grant`
 * — the same semantics the real service applies.
 *
 * The caller must have granted the EDITOR hat first (`createUser({ role:
 * 'EDITOR' })`); these overrides widen what an editor may do, they do not
 * substitute for the role.
 *
 * @param userId - UUID of the editor to promote
 */
export async function setTrustedEditor(userId: string): Promise<void> {
    await execSQL(
        `INSERT INTO user_permission (user_id, permission, effect)
         SELECT $1::uuid, wanted, 'grant'::permission_effect_enum
         FROM unnest($2::permission_enum[]) AS wanted
         ON CONFLICT (user_id, permission)
         DO UPDATE SET effect = 'grant'::permission_effect_enum`,
        [userId, [...TRUSTED_EDITOR_PERMISSIONS]]
    );
}

/**
 * Creates a post authored by whoever owns `sessionCookie`, via
 * `POST /api/v1/protected/posts`.
 *
 * The route assigns `authorId` from the session and the domain mapper fixes the
 * initial state at `lifecycleState: ACTIVE`, `visibility: PUBLIC`,
 * `moderationState: PENDING` — so a freshly created post is one admin approval
 * away from being public, and nothing else stands between it and the reader.
 * That is the premise every publication-gate spec rests on, which is why the
 * returned object carries both state fields for the caller to assert on rather
 * than trusting them silently.
 *
 * @param params.sessionCookie - Session of the account that will author the post
 * @param params.slugPrefix - Prefix for the generated slug, to keep specs apart
 * @param params.apiBaseUrl - Override for the API origin
 * @returns The created post's id, slug, title and initial state
 */
export async function createPostAsAuthor(params: {
    readonly sessionCookie: string;
    readonly slugPrefix?: string;
    readonly apiBaseUrl?: string;
}): Promise<CreatedPost> {
    const apiBaseUrl = params.apiBaseUrl ?? DEFAULT_API_BASE_URL;
    const suffix = `${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
    const slug = `${params.slugPrefix ?? 'e2e-post'}-${suffix}`;
    const title = `E2E editorial post ${suffix}`;

    const response = await fetch(`${apiBaseUrl}/api/v1/protected/posts`, {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            cookie: params.sessionCookie
        },
        body: JSON.stringify({
            title,
            slug,
            summary: 'E2E summary for the HOS-374 editor flows.',
            // The domain schema demands at least 100 characters of content.
            content:
                'This post exists only to exercise the HOS-374 publication gate end to end. ' +
                'It carries enough prose to clear the minimum content length the schema enforces.',
            category: 'GENERAL'
        })
    });

    if (!response.ok) {
        throw new Error(
            `createPostAsAuthor: create failed ${response.status} ${response.statusText} — ${await response.text()}`
        );
    }

    const body = (await response.json()) as PostCreateResponse;
    const id = body.data?.id;
    if (!id) {
        throw new Error('createPostAsAuthor: create response missing post id');
    }

    return {
        id,
        slug: body.data?.slug ?? slug,
        title: body.data?.title ?? title,
        moderationState: body.data?.moderationState ?? '',
        visibility: body.data?.visibility ?? ''
    };
}
