/**
 * @file elicitation-policy.ts
 * @description The per-tool policy of out-of-band confirmation (HOS-2247, spec
 * §5.7, owner decision D-17).
 *
 * Every tool that confirms a write with a token is listed here. On a client
 * that declared, on the request, that it renders confirmation forms:
 * - `true` (strict, the default for every tool): the human MUST confirm through
 *   the client's form. No token is issued, and a `confirmationToken` the call
 *   carries is refused with nothing written.
 * - `false` (relaxed): that tool runs the token flow for that client as well,
 *   exactly as for a client without the capability. It is the remedy for a
 *   client that declares the capability but does not render the form (R-20).
 *
 * Changing an entry is a code change with its own PR. It lives in its own
 * module so a test can relax one tool (`vi.mock`) without touching the logic
 * that reads it (`elicitation-confirmation.ts`).
 */

/** The tools covered by out-of-band confirmation. */
export const ELICITATION_TOOL_NAMES = [
    'reply_inquiry',
    'create_listing',
    'set_listing_publication'
] as const;

/** Name of a tool covered by out-of-band confirmation. */
export type ElicitationToolName = (typeof ELICITATION_TOOL_NAMES)[number];

/** Strict (`true`) or relaxed (`false`) out-of-band confirmation, per covered tool. */
export const ELICITATION_STRICT: Readonly<Record<ElicitationToolName, boolean>> = {
    reply_inquiry: true,
    create_listing: true,
    set_listing_publication: true
};
