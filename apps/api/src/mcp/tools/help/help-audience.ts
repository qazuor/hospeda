/**
 * @file help-audience.ts
 * @description The kinds of caller `get_help` accepts as `audience` (HOS-2333,
 * HOS-2410). Since HOS-2410 PR-12 it is every audience of the catalog
 * (`HELP_AUDIENCES` in `@repo/help`), `partner` included (AC-19). It stays its
 * own constant because it is the API's input vocabulary: a new catalog audience
 * reaches the tool's input only when this list names it.
 */

import type { HelpAudience } from '@repo/help';

/** The `audience` values `get_help` accepts. */
export const OWNER_HELP_CALLER_AUDIENCES = [
    'host',
    'venue',
    'experience',
    'provider',
    'partner'
] as const satisfies readonly HelpAudience[];

/** One `audience` value of `get_help`. */
export type OwnerHelpCallerAudience = (typeof OWNER_HELP_CALLER_AUDIENCES)[number];
