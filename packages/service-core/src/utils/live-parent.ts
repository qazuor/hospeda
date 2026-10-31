/**
 * Narrows a freshly loaded parent row to "live": a soft-deleted parent (one in
 * the trash) is treated exactly like a missing one (HOS-1919).
 *
 * Child-entity writes (media, FAQs, menu, schedules, ...) load their parent
 * with `findById`, which returns trashed rows too. Without this narrowing an
 * owner could keep adding FAQs and uploading media (billed by Cloudinary) to a
 * listing in the trash. The caller keeps its own `NOT_FOUND` branch, so the
 * response is byte-identical to a parent that does not exist (error-contract:
 * 404, never a distinct code that would confirm the id exists).
 *
 * Reads that must still reach trashed parents (admin trash views) simply do not
 * call this.
 *
 * @param params - Parameters object.
 * @param params.entity - The row returned by `findById`, or null/undefined.
 * @returns The row when it is live, otherwise `null`.
 */
export const liveParentOrNull = <T extends { readonly deletedAt?: Date | string | null }>({
    entity
}: {
    readonly entity: T | null | undefined;
}): T | null => {
    if (!entity) return null;
    return entity.deletedAt === null || entity.deletedAt === undefined ? entity : null;
};
