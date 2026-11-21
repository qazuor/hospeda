/**
 * Tiny class-name joiner for the Mi Cuenta kit (HOS-2413).
 *
 * Joins the truthy parts with a space. Kept local to the kit so the kit has no
 * dependency on a class-name library.
 *
 * @module components/account/ui/cx
 */

/** A class-name part: a string, or a falsy value that is skipped. */
export type ClassPart = string | false | null | undefined;

/**
 * Joins class-name parts, skipping falsy ones.
 *
 * @param parts - Class-name parts.
 * @returns The joined class string (empty when every part is falsy).
 */
export function cx(...parts: readonly ClassPart[]): string {
    return parts.filter((part): part is string => Boolean(part)).join(' ');
}
