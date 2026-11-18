/**
 * @file registry.ts
 * @description The Hospeda assistant tool registry (HOS-2184 T-012).
 *
 * {@link MCP_TOOL_DEFINITIONS} is the list `createHospedaMcpServer` registers
 * by default. T-013+ append their definitions here; nothing else changes.
 */

import { getHelpTool } from './help/get-help';
import { getInquiryTool } from './inquiry/get-inquiry';
import { listInquiriesTool } from './inquiry/list-inquiries';
import { replyInquiryTool } from './inquiry/reply-inquiry';
import { createListingTool } from './listing/create-listing';
import { getListingTool } from './listing/get-listing';
import { getListingAmenitiesTool } from './listing/get-listing-amenities';
import { getListingCreationGuideTool } from './listing/get-listing-creation-guide';
import { getListingStatsTool } from './listing/get-listing-stats';
import { listAmenitiesAndFeaturesTool } from './listing/list-amenities-and-features';
import { listMyListingsTool } from './listing/list-my-listings';
import { setListingPublicationTool } from './listing/set-listing-publication';
import { updateListingAmenitiesTool } from './listing/update-listing-amenities';
import { updateListingBasicTool } from './listing/update-listing-basic';
import { listReviewsTool } from './review/list-reviews';
import { getOwnerSummaryTool } from './summary/get-owner-summary';
import type { ToolDefinition } from './tool-definition';

/** Every v1 tool, in the order clients list them. */
export const MCP_TOOL_DEFINITIONS: readonly ToolDefinition[] = [
    listMyListingsTool,
    getOwnerSummaryTool,
    getListingTool,
    updateListingBasicTool,
    getListingAmenitiesTool,
    updateListingAmenitiesTool,
    setListingPublicationTool,
    listAmenitiesAndFeaturesTool,
    getListingStatsTool,
    getListingCreationGuideTool,
    createListingTool,
    listReviewsTool,
    getHelpTool,
    listInquiriesTool,
    getInquiryTool,
    replyInquiryTool
];
