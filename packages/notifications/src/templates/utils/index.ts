/**
 * Shared utilities for notification email templates.
 *
 * @module templates/utils
 */

export type { BuildAddonManagementUrlInput } from './addon-links.js';
export { buildAddonManagementUrl, DEFAULT_ADDON_LINK_LOCALE } from './addon-links.js';
export type {
    FormatCurrencyInput,
    FormatDateInput,
    FormatMajorCurrencyInput
} from './format-helpers.js';
export { formatCurrency, formatDate, formatMajorCurrency } from './format-helpers.js';
