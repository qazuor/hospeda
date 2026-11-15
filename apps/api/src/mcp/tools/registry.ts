/**
 * @file registry.ts
 * @description The Hospeda assistant tool registry (HOS-2184 T-012).
 *
 * {@link MCP_TOOL_DEFINITIONS} is the list `createHospedaMcpServer` registers
 * by default. T-013+ append their definitions here; nothing else changes.
 */

import type { ToolDefinition } from './tool-definition';

/** Every v1 tool, in the order clients list them. Empty until T-013. */
export const MCP_TOOL_DEFINITIONS: readonly ToolDefinition[] = [];
