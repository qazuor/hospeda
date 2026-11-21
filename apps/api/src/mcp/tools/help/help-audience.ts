/**
 * @file help-audience.ts
 * @description The kinds of caller `get_help` accepts as `audience` (HOS-2333,
 * HOS-2410). It is the API's input vocabulary, not the catalog's: the catalog
 * also has `partner` (`HELP_AUDIENCES` in `@repo/help`), which the tool does not
 * take as input yet.
 */

import type { HelpAudience } from '@repo/help';

/** The `audience` values `get_help` accepts. */
export const OWNER_HELP_CALLER_AUDIENCES = [
    'host',
    'venue',
    'experience',
    'provider'
] as const satisfies readonly HelpAudience[];

/** One `audience` value of `get_help`. */
export type OwnerHelpCallerAudience = (typeof OWNER_HELP_CALLER_AUDIENCES)[number];
