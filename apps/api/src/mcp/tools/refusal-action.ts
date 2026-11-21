/**
 * @file refusal-action.ts
 * @description Attaches the portal link to a failed tool call (HOS-2326, spec
 * HOS-2335 §5.1).
 *
 * One place applies the rules of a refusal link, so no tool can break them:
 * 1. **No link for what no page fixes.** A transient failure (service
 *    unavailable, rate limit), a reconnect (`UNAUTHORIZED`) and anything
 *    unexpected carry none (AC-C3). A handler-set `link` or `helpTopicId` is
 *    dropped on those too.
 * 2. **No link that confirms an id.** A not-found answer is uniform for a
 *    missing and a foreign resource, so a link around the asked id would tell
 *    the two apart. It may carry only a destination with no identifier, such as
 *    the owner's listing list (AC-C4).
 * 3. **The URL is built here**, from the configured site URL, never by a tool or
 *    a handler: both only name a destination, so no arbitrary URL can be emitted.
 *
 * Never throws: a broken link must not change the refusal the user reads.
 */

import {
    buildPortalUrl,
    describePortalDestination,
    isNonIdentifyingDestination,
    type PortalLocale
} from '@repo/portal-routes';
import { ServiceErrorCode } from '@repo/schemas';
import { env } from '../../utils/env';
import { apiLogger } from '../../utils/logger';
import type {
    ToolAction,
    ToolDefinition,
    ToolErrorCode,
    ToolErrorPayload,
    ToolRefusalLink
} from './tool-definition';
import type { ToolFailure } from './tool-errors';

/** Codes no portal page can fix: transient, or a reconnect. */
const NO_LINK_CODES: ReadonlySet<ToolErrorCode> = new Set<ToolErrorCode>([
    ServiceErrorCode.SERVICE_UNAVAILABLE,
    ServiceErrorCode.PROVIDER_ERROR,
    ServiceErrorCode.PROVIDER_RATE_LIMITED,
    ServiceErrorCode.PROVIDER_TIMEOUT,
    ServiceErrorCode.QUOTA_EXCEEDED,
    ServiceErrorCode.UNAUTHORIZED,
    'RATE_LIMIT_EXCEEDED'
]);

/** Codes the error contract answers for a missing or foreign resource. */
const NOT_FOUND_CODES: ReadonlySet<ToolErrorCode> = new Set<ToolErrorCode>([
    ServiceErrorCode.NOT_FOUND,
    ServiceErrorCode.GONE
]);

/** Arguments for {@link attachRefusalAction}. RO-RO. */
export interface AttachRefusalActionArgs {
    /** The failure as `toToolFailure` mapped it. */
    readonly failure: ToolFailure;
    /** The error behind it. */
    readonly error: ToolErrorPayload;
    /** The call's input: validated for a handler failure, RAW for a malformed call. */
    readonly input: unknown;
    /** The tool that failed. */
    readonly definition: Pick<ToolDefinition, 'name' | 'refusalAction'>;
    /** Locale prefix of the link (the user's web language). Defaults to `es`. */
    readonly locale?: PortalLocale;
}

/** Logs a link that could not be built. Never throws. */
function logLinkFailure(input: { readonly tool: string; readonly error: unknown }): void {
    try {
        apiLogger.warn(
            {
                tool: input.tool,
                error: input.error instanceof Error ? input.error.message : String(input.error)
            },
            'MCP refusal link could not be built'
        );
    } catch {
        // A logging failure must not change the tool result.
    }
}

/** The tool's link for this refusal, or `undefined`. A throwing tool yields none. */
function readRefusalLink(args: AttachRefusalActionArgs): ToolRefusalLink | undefined {
    try {
        return args.definition.refusalAction?.({ error: args.error, input: args.input });
    } catch (error) {
        logLinkFailure({ tool: args.definition.name, error });
        return undefined;
    }
}

/** Resolves a link to its URL and label, or `undefined` when it must not be shown. */
function resolveLink(
    args: AttachRefusalActionArgs & { readonly link: ToolRefusalLink }
): ToolAction | undefined {
    const { link, error, definition, locale } = args;
    if (NOT_FOUND_CODES.has(error.code) && !isNonIdentifyingDestination(link)) {
        return undefined;
    }
    try {
        return {
            url: buildPortalUrl({
                destination: link.destination,
                locale,
                siteUrl: env.HOSPEDA_SITE_URL
            }),
            label: link.label ?? describePortalDestination(link)
        };
    } catch (cause) {
        logLinkFailure({ tool: definition.name, error: cause });
        return undefined;
    }
}

/** A copy of `failure` with no action. */
function withoutAction(failure: ToolFailure): ToolFailure {
    const { action: _action, ...rest } = failure;
    return rest;
}

/** A copy of `failure` with no action and no help topic. */
function withoutLinks(failure: ToolFailure): ToolFailure {
    const { helpTopicId: _helpTopicId, ...rest } = withoutAction(failure);
    return rest;
}

/**
 * Returns the failure with its portal link, applying the rules in the file
 * header. The destination comes from the payload's `link` when the handler set one,
 * else from the tool's `refusalAction`.
 *
 * @param args - The failure, the error behind it, the call input and the tool
 * @returns The failure, with `action` set when a link is allowed
 *
 * @example
 * ```typescript
 * const failure = attachRefusalAction({ failure: toToolFailure({ error }), error, input, definition });
 * ```
 */
export function attachRefusalAction(args: AttachRefusalActionArgs): ToolFailure {
    const { failure, error } = args;
    if (failure.unexpected || NO_LINK_CODES.has(error.code)) {
        return withoutLinks(failure);
    }
    const link = error.link ?? readRefusalLink(args);
    if (link === undefined) {
        return failure;
    }
    const action = resolveLink({ ...args, link });
    return action === undefined ? failure : { ...failure, action };
}
