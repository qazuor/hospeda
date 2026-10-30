/**
 * Renderer registry of the email outbox (HOS-1423).
 *
 * Empty on purpose: U2 builds the mechanism and enqueues none of the
 * NUCLEO/07 §6 catalog mails. Each unit that enqueues a template (V4, B3, ...)
 * registers its renderer here in the same change. A row whose template has no
 * renderer fails its attempt like any other refused send, so it retries, ends
 * `failed` and, being transactional by default, is escalated: an unregistered
 * template is loud, never silently dropped.
 *
 * @module services/outbox/email-outbox-renderers
 */

import {
    type OutboxMailRenderer,
    OutboxTemplateNotRegisteredError
} from './email-outbox-delivery.service.js';

/** Renderers by outbox template identifier. */
export const OUTBOX_MAIL_RENDERERS: Readonly<Record<string, OutboxMailRenderer>> = {};

/**
 * Builds the renderer the sender uses from a registry.
 *
 * @param input - The registry; defaults to {@link OUTBOX_MAIL_RENDERERS}.
 * @returns A renderer that throws {@link OutboxTemplateNotRegisteredError} for an unknown template.
 */
export function createOutboxMailRenderer(
    input: { readonly renderers?: Readonly<Record<string, OutboxMailRenderer>> } = {}
): OutboxMailRenderer {
    const renderers = input.renderers ?? OUTBOX_MAIL_RENDERERS;
    return async ({ row }) => {
        const renderer = Object.hasOwn(renderers, row.template)
            ? renderers[row.template]
            : undefined;
        if (!renderer) {
            throw new OutboxTemplateNotRegisteredError(row.template);
        }
        return renderer({ row });
    };
}
