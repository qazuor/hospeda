/**
 * @file reviewer-names.ts
 * @description The one database read `list_reviews` makes about reviewers
 * (HOS-2330, owner decision D-8): the display name of each author, resolved with
 * the same rule the public reviews list applies, and nothing else.
 *
 * The user rows are read whole by the model, so the projection is the safety:
 * only the three name fields cross into {@link resolveReviewerDisplayName}, and
 * the result is a name. No email, no image and no user id leave this module.
 *
 * Models are built lazily: nothing here touches `@repo/db` at import time.
 */

import { UserModel } from '@repo/db';
import { resolveReviewerDisplayName } from '../../../utils/reviewer-display-name';

let userModel: UserModel | undefined;

/** The user model, built on first use. */
function users(): UserModel {
    userModel ??= new UserModel();
    return userModel;
}

/** A user row narrowed to the fields the name rule reads. */
interface ReviewerRow {
    readonly id: string;
    readonly displayName?: string | null;
    readonly firstName?: string | null;
    readonly lastName?: string | null;
}

/**
 * Resolves the public display name of a set of reviewers in one query.
 *
 * @param params.reviewerIds - The reviewers' user ids (duplicates tolerated)
 * @returns A map from user id to display name. A reviewer with no name, or no
 *   longer on file, is absent from the map
 */
export async function readReviewerDisplayNames({
    reviewerIds
}: {
    readonly reviewerIds: readonly string[];
}): Promise<ReadonlyMap<string, string>> {
    const ids = [...new Set(reviewerIds)];
    const names = new Map<string, string>();
    if (ids.length === 0) {
        return names;
    }
    const rows = (await users().findByIds(ids)) as readonly ReviewerRow[];
    for (const row of rows) {
        const name = resolveReviewerDisplayName({ reviewer: row });
        if (name) {
            names.set(row.id, name);
        }
    }
    return names;
}
