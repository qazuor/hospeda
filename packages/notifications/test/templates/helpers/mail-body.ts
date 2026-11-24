/**
 * Test helper: the part of a rendered mail a template wrote, without the user
 * layout's footer (HOS-2565 PR-4).
 *
 * The user footer carries its own copy ("tarjeta" in the security card, account
 * links under `/mi-cuenta`, WhatsApp). A test that asserts what a TEMPLATE says, or
 * does not say, reads this slice instead of the whole document.
 */

/** Marker the user layout puts on its footer cell. */
const USER_FOOTER_MARKER = 'data-layout-footer="user"';

/**
 * Returns the rendered HTML up to the user layout footer (the whole document for
 * a staff mail, which has no such footer).
 *
 * @param input - The rendered HTML.
 * @returns The HTML before the footer.
 */
export function mailBodyOf({ html }: { readonly html: string }): string {
    const footer = html.indexOf(USER_FOOTER_MARKER);
    return footer === -1 ? html : html.slice(0, footer);
}
