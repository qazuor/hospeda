/**
 * The preview pipeline: render one catalog scenario to the subject and the two
 * bodies an inbox would receive.
 *
 * @module catalog/render-scenario
 */

import { renderEmailBodies } from '@repo/email';
import { findEmailCatalogEntry } from './catalog.js';
import { EmailCatalogScenarioNotFoundError } from './define-entry.js';
import type { EmailCatalogRenderDeps } from './types.js';

/** Thrown when no catalog entry has the requested key. */
export class EmailCatalogEntryNotFoundError extends Error {
    constructor(key: string) {
        super(`Unknown email catalog entry "${key}"`);
        this.name = 'EmailCatalogEntryNotFoundError';
    }
}

/** Input of {@link renderEmailCatalogScenario}. */
export interface RenderEmailCatalogScenarioInput {
    /** Key of the entry, e.g. `'outbox.billing.renewal-upcoming'`. */
    readonly key: string;
    /** Id of one of the entry's scenarios. */
    readonly scenarioId: string;
    /** Runtime collaborators injected by the host app. */
    readonly deps: EmailCatalogRenderDeps;
}

/** Output of {@link renderEmailCatalogScenario}. */
export interface RenderedEmailCatalogScenario {
    /** Subject as the production path builds it, without the environment prefix. */
    readonly subject: string;
    /** HTML body, exactly as the transport posts it. */
    readonly html: string;
    /** text/plain body, exactly as the transport posts it. */
    readonly text: string;
    /** Non-fatal render issues; empty for a healthy scenario. */
    readonly warnings: readonly string[];
}

/**
 * Renders one scenario of a catalog entry through the production component,
 * the production subject code and `renderEmailBodies`. Never sends anything.
 *
 * @param input - The entry key, the scenario id and the runtime collaborators.
 * @returns The subject, the HTML and text bodies, and any warnings.
 * @throws {EmailCatalogEntryNotFoundError} When no entry has the key.
 * @throws {EmailCatalogScenarioNotFoundError} When the scenario id is unknown.
 */
export async function renderEmailCatalogScenario(
    input: RenderEmailCatalogScenarioInput
): Promise<RenderedEmailCatalogScenario> {
    const { key, scenarioId, deps } = input;
    const entry = findEmailCatalogEntry({ key });
    if (!entry) {
        throw new EmailCatalogEntryNotFoundError(key);
    }
    if (!entry.scenarios.some((scenario) => scenario.id === scenarioId)) {
        throw new EmailCatalogScenarioNotFoundError({ key: entry.key, scenarioId });
    }
    const rendered = await entry.renderScenario({ scenarioId, deps });
    // HOS-2359: the preview carries the same UTMs an inbox receives but never the
    // open pixel, so opening a preview never counts as an open. This is the one place
    // a preview differs from a real send (HOS-2519 D4).
    const { html, text } = await renderEmailBodies({
        react: rendered.react,
        attribution: { medium: 'transactional', templateKey: entry.key, includePixel: false }
    });
    return { subject: rendered.subject, html, text, warnings: rendered.warnings };
}
