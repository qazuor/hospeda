/**
 * HOS-2184 phase B T-042 — `requiredPermissions` per tool, pinned, and
 * compared with the handler source so the two cannot drift silently.
 *
 * - The pin: every registry tool's declared permissions, by name. Adding,
 *   dropping or changing one is a deliberate edit of this table.
 * - The static check: in each tool file, the permissions the HANDLER refuses
 *   on (`if (!actor.permissions.includes(PermissionEnum.X))`), plus the ones
 *   listed in {@link SERVICE_ENFORCED}, are exactly the ones the tools defined
 *   there declare.
 *
 * Blind spot: the pattern only sees INLINE handler checks. A check done inside
 * a service or a helper (`HostTradeService.listForHost` →
 * `checkCanViewHostTrade`) is invisible to it, so those are pinned by hand in
 * {@link SERVICE_ENFORCED}, each with the place that enforces it. A new
 * service-level check is caught by nobody but a reviewer: adding one means
 * adding its row there.
 *
 * Audited and deliberately NOT declared (HOS-2184 review M3): checks that are
 * not tool-wide, so declaring them would hide a tool an account can use.
 * - `update_listing_basic` / `update_listing_amenities`: the permission depends
 *   on the vertical (`ACCOMMODATION_UPDATE_OWN`, `VENUE_EDIT_OWN`,
 *   `EXPERIENCE_EDIT_OWN`), and an accommodation content write authorised by
 *   the listing-access chain (action 15, `checkAction15CanUpdate`) needs none.
 * - `create_listing`: venue and experience creation declare none on purpose
 *   (HOS-687, it is how an account becomes an owner); accommodation goes
 *   through `/host-onboarding/start`, which declares none either.
 * - `get_owner_summary`: `ACCOMMODATION_VIEW_OWN` gates only the host metrics
 *   branch (`getStatsForHostAccommodations`), and `CONVERSATION_VIEW_OWN` /
 *   `BILLING_VIEW_OWN` only trim blocks.
 * - The benefit-usage tools: row ownership, never a permission (HOS-376).
 * - Every other listing read or write: ownership (`findIdsByOwnerId`, step 4
 *   of the access pipeline), not a permission.
 *
 * @module test/mcp/tools/required-permissions.registry
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { MCP_TOOL_DEFINITIONS } from '../../../src/mcp/tools/registry';

const TOOLS_DIR = resolve(__dirname, '../../../src/mcp/tools');

/** The declared permissions of every tool. Empty means any authenticated account. */
const PINNED: Readonly<Record<string, readonly PermissionEnum[]>> = {
    list_my_listings: [],
    get_owner_summary: [],
    get_my_plan: [PermissionEnum.BILLING_VIEW_OWN],
    get_listing: [],
    update_listing_basic: [],
    get_listing_amenities: [],
    update_listing_amenities: [],
    set_listing_publication: [],
    list_amenities_and_features: [],
    get_listing_stats: [],
    get_listing_creation_guide: [],
    create_listing: [],
    list_reviews: [],
    get_help: [],
    list_inquiries: [PermissionEnum.CONVERSATION_VIEW_OWN],
    get_inquiry: [PermissionEnum.CONVERSATION_VIEW_OWN],
    reply_inquiry: [PermissionEnum.CONVERSATION_REPLY_OWN],
    search_providers: [PermissionEnum.HOST_TRADE_VIEW],
    list_benefit_usages: [],
    confirm_benefit_usage: [],
    reject_benefit_usage: [],
    undo_benefit_rejection: []
};

/**
 * Permissions a tool declares because a SERVICE refuses without them, which
 * the inline pattern cannot see. Member names, as `refusedPermissions` returns.
 */
const SERVICE_ENFORCED: Readonly<Record<string, readonly string[]>> = {
    // HostTradeService.listForHost → checkCanViewHostTrade (host-trade.permissions.ts)
    search_providers: ['HOST_TRADE_VIEW']
};

/** Every `.ts` file under a directory. */
function listSources(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
        const path = join(dir, entry);
        return statSync(path).isDirectory()
            ? listSources(path)
            : path.endsWith('.ts')
              ? [path]
              : [];
    });
}

/** The `PermissionEnum` member names a file's handler refuses on. */
function refusedPermissions(source: string): string[] {
    const pattern = /if \(!actor\.permissions\.includes\(PermissionEnum\.(\w+)\)\)/g;
    return [...source.matchAll(pattern)].map((match) => match[1] ?? '');
}

/** The tool names a file defines (`name: '<snake_case>'` inside `defineTool`). */
function definedToolNames(source: string): string[] {
    if (!source.includes('defineTool(')) return [];
    return [...source.matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((match) => match[1] ?? '');
}

describe('requiredPermissions (HOS-2184 T-042)', () => {
    it('pins the declared permissions of every registry tool', () => {
        // Act
        const declared = Object.fromEntries(
            MCP_TOOL_DEFINITIONS.map((definition) => [
                definition.name,
                [...(definition.requiredPermissions ?? [])]
            ])
        );

        // Assert
        expect(declared).toEqual(PINNED);
    });

    it('matches, file by file, the permissions each handler refuses on', () => {
        // Arrange
        const byName = new Map(
            MCP_TOOL_DEFINITIONS.map((definition) => [definition.name, definition])
        );
        const files = listSources(TOOLS_DIR)
            .map((path) => ({ path, source: readFileSync(path, 'utf8') }))
            .filter(({ source }) => definedToolNames(source).length > 0);

        // Act
        const mismatches = files.flatMap(({ path, source }) => {
            const inline = refusedPermissions(source);
            return definedToolNames(source).flatMap((name) => {
                const refused = new Set([...inline, ...(SERVICE_ENFORCED[name] ?? [])]);
                const definition = byName.get(name);
                const declared = new Set(
                    (definition?.requiredPermissions ?? []).map(
                        (value) =>
                            Object.entries(PermissionEnum).find(
                                ([, member]) => member === value
                            )?.[0]
                    )
                );
                const same =
                    declared.size === refused.size &&
                    [...declared].every((key) => key && refused.has(key));
                return same
                    ? []
                    : [`${name} (${path}): declares ${[...declared]} refuses ${[...refused]}`];
            });
        });

        // Assert: the scan saw the four checks, so a green run is not an empty one.
        expect(files.flatMap(({ source }) => refusedPermissions(source))).toHaveLength(4);
        expect(mismatches).toEqual([]);
    });
});
