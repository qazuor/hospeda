/**
 * @file registry.ts
 * @description The Hospeda assistant tool registry (HOS-2184 T-012).
 *
 * {@link MCP_TOOL_DEFINITIONS} is the list `createHospedaMcpServer` registers
 * by default. T-013+ append their definitions here; nothing else changes.
 */

import { listMyListingsTool } from './listing/list-my-listings';
import type { ToolDefinition } from './tool-definition';

/** Every v1 tool, in the order clients list them. */
export const MCP_TOOL_DEFINITIONS: readonly ToolDefinition[] = [listMyListingsTool];
