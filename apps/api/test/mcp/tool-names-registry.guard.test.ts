/**
 * Guard (HOS-2349): `MCP_TOOL_NAMES` in `@repo/schemas` is exactly the set of
 * tools the API registers, in both directions.
 *
 * The admin log offers the tool filter as a select built from
 * `MCP_TOOL_NAMES`, and the API validates `tool` against the same tuple. A
 * tool registered but missing from the tuple could not be filtered (a 400); a
 * name in the tuple with no tool would be a dead option. Adding or removing a
 * tool therefore means editing the tuple in the same change.
 */
import { MCP_TOOL_NAMES } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { MCP_TOOL_DEFINITIONS } from '../../src/mcp/tools/registry';

const registered = MCP_TOOL_DEFINITIONS.map((definition) => definition.name);
const published: readonly string[] = MCP_TOOL_NAMES;

describe('MCP_TOOL_NAMES matches the API tool registry', () => {
    it('publishes every registered tool', () => {
        const missing = registered.filter((name) => !published.includes(name));
        expect(
            missing,
            `Registered tools missing from MCP_TOOL_NAMES (packages/schemas/src/entities/mcp-activity/mcp-activity.schema.ts): ${missing.join(', ')}`
        ).toEqual([]);
    });

    it('publishes no name the registry lacks', () => {
        const stale = published.filter((name) => !registered.includes(name));
        expect(
            stale,
            `Names in MCP_TOOL_NAMES with no registered tool: ${stale.join(', ')}`
        ).toEqual([]);
    });

    it('has no duplicates on either side', () => {
        expect(new Set(registered).size).toBe(registered.length);
        expect(new Set(published).size).toBe(published.length);
        expect(published.length).toBe(registered.length);
    });
});
