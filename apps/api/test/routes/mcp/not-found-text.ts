/**
 * The exact text an assistant tool answers for a missing or foreign resource
 * (HOS-2326): the uniform not-found message plus the one link that names no id,
 * the owner's list. Shared by the end-to-end `/mcp` tests.
 *
 * @module test/routes/mcp/not-found-text
 */

import { REFUSAL_ACTION_LINE_PREFIX } from '../../../src/lib/mcp/bind-tool';
import { TOOL_NOT_FOUND_MESSAGE } from '../../../src/mcp/tools/tool-errors';

/**
 * @param args.siteUrl - The configured `HOSPEDA_SITE_URL`
 * @param args.path - Portal path of the list, with no locale and no edge slashes
 * @returns The expected text of the not-found result
 */
export function notFoundWithListLink({
    siteUrl,
    path
}: {
    readonly siteUrl: string;
    readonly path: string;
}): string {
    return `${TOOL_NOT_FOUND_MESSAGE}\n${REFUSAL_ACTION_LINE_PREFIX} ${siteUrl.replace(/\/+$/, '')}/es/${path}/`;
}
