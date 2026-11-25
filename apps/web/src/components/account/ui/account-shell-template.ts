/**
 * Page templates of the account shell (HOS-2413 T-020).
 *
 * The template sets the content column's maximum width through
 * `[data-template]` in `AccountShell.module.css`:
 * The shell owns the sibling stack (`--space-6`) for every template; page
 * wrappers own only their internal grouping gaps, not extra outer spacing.
 *
 * - `list`: tables and card lists, full column.
 * - `form`: a single form, 720px max (`--form-max`), left-aligned.
 * - `dashboard`: a grid of cards, full column.
 * - `reading`: long text, 640px max (`--reading-max`).
 * - `editor`: a listing editor with its own section nav, full column.
 *
 * @module components/account/ui/account-shell-template
 */

/** The five page templates. */
export const ACCOUNT_SHELL_TEMPLATES = ['list', 'form', 'dashboard', 'reading', 'editor'] as const;

/** A page template. */
export type AccountShellTemplate = (typeof ACCOUNT_SHELL_TEMPLATES)[number];

/** Template used when a page does not pick one. */
export const DEFAULT_ACCOUNT_SHELL_TEMPLATE: AccountShellTemplate = 'list';

/**
 * Normalizes a template value; anything unknown falls back to the default.
 *
 * @param input - Options object.
 * @param input.template - The requested template, if any.
 * @returns A valid template.
 */
export function resolveShellTemplate({
    template
}: {
    readonly template?: string;
}): AccountShellTemplate {
    return (ACCOUNT_SHELL_TEMPLATES as readonly string[]).includes(template ?? '')
        ? (template as AccountShellTemplate)
        : DEFAULT_ACCOUNT_SHELL_TEMPLATE;
}
