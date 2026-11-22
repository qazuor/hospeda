/**
 * Contracts of the central email template catalog (HOS-2519 §7.1).
 *
 * @module catalog/types
 */

import type { ReactElement } from 'react';
import type { OutboxMailRenderer } from '../services/outbox/email-outbox-delivery.service.js';

/** Production path that sends the email. */
export type EmailSendPath =
    | 'notification'
    | 'outbox'
    | 'auth'
    | 'conversation'
    | 'alert-digest'
    | 'newsletter';

/** Grouping shown in the admin previewer. */
export type EmailCatalogDomain =
    | 'auth'
    | 'billing'
    | 'subscription'
    | 'trial'
    | 'listing'
    | 'host-trade'
    | 'alliance'
    | 'partner'
    | 'conversation'
    | 'admin'
    | 'newsletter'
    | 'alerts'
    | 'contact-feedback'
    | 'ai';

/** Who reads the email. Drives the previewer audience filter (HOS-2565). */
export type EmailAudience = 'user' | 'staff';

/** One named sample input for an entry. */
export interface EmailScenario<TInput> {
    /** Kebab-case, unique within the entry. */
    readonly id: string;
    /** Spanish label shown in the admin. */
    readonly label: string;
    /** Sample input. Fictional data only. */
    readonly input: TInput;
}

/** Runtime collaborators injected by the host app. */
export interface EmailCatalogRenderDeps {
    /** Site base URL used in CTA links. */
    readonly siteUrl: string;
    /** The outbox renderer, built by the host app with non-writing fakes. */
    readonly outboxRenderer: OutboxMailRenderer;
}

/** Output of rendering one scenario, before HTML/text serialization. */
export interface EmailCatalogRendered {
    /** Subject exactly as the production path builds it, without the environment prefix. */
    readonly subject: string;
    /** React Email element of the body. */
    readonly react: ReactElement;
    /** Non-fatal render issues, e.g. `'subject-fell-back-to-generic'`. */
    readonly warnings: readonly string[];
}

/** Public summary of one scenario. */
export interface EmailCatalogScenarioSummary {
    /** Scenario id, unique within the entry. */
    readonly id: string;
    /** Spanish label. */
    readonly label: string;
}

/** Input of {@link EmailCatalogEntry.renderScenario}. */
export interface EmailCatalogRenderScenarioInput {
    /** Id of the scenario to render. */
    readonly scenarioId: string;
    /** Runtime collaborators. */
    readonly deps: EmailCatalogRenderDeps;
}

/** Type-erased catalog entry (built only through `defineEmailCatalogEntry`). */
export interface EmailCatalogEntry {
    /** `<sendPath>.<id>`, e.g. `'outbox.billing.renewal-upcoming'`. */
    readonly key: `${EmailSendPath}.${string}`;
    /** NotificationType value, outbox template key, or path-local id. */
    readonly id: string;
    /** Production path that sends the email. */
    readonly sendPath: EmailSendPath;
    /** Spanish human name. */
    readonly name: string;
    /** Admin grouping. */
    readonly domain: EmailCatalogDomain;
    /** Who reads the email: `'staff'` for internal mails, `'user'` otherwise. */
    readonly audience: EmailAudience;
    /** `false`: the template exists but no production sender sends it. */
    readonly wired: boolean;
    /** Scenario summaries, in declaration order. */
    readonly scenarios: readonly EmailCatalogScenarioSummary[];
    /** Renders one scenario. Rejects for an unknown scenario id. */
    readonly renderScenario: (
        input: EmailCatalogRenderScenarioInput
    ) => Promise<EmailCatalogRendered>;
}

/** Warning raised when a notification subject degraded to the generic one. */
export const SUBJECT_FELL_BACK_WARNING = 'subject-fell-back-to-generic';
