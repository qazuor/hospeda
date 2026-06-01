/**
 * Shared helpers for the admin comment read routes (SPEC-165).
 */

/** Row shape returned by admin reads (author relation loaded for `authorName`). */
export type AdminCommentRow = Record<string, unknown> & {
    author?: { displayName?: string | null } | null;
};

/**
 * Flatten the loaded `author` relation into a stable `authorName` field, falling
 * back to a deleted-user placeholder when the author is missing (SPEC-165).
 * Mirrors the mapping in `routes/post/comments/public/list.ts`.
 */
export const mapAuthorName = (comment: AdminCommentRow) => ({
    ...comment,
    authorName: comment.author?.displayName ?? '[Usuario eliminado]'
});
