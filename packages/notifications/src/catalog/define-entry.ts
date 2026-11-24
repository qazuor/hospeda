/**
 * Builders of catalog entries.
 *
 * @module catalog/define-entry
 */

import type { EmailOutboxRow } from '@repo/db';
import { renderNotificationEmail } from '../services/notification-render.js';
import type { NotificationPayload, NotificationType } from '../types/notification.types.js';
import { buildPreviewOutboxRow } from './preview-outbox-row.js';
import {
    type EmailAudience,
    type EmailCatalogDomain,
    type EmailCatalogEntry,
    type EmailCatalogRenderDeps,
    type EmailCatalogRendered,
    type EmailScenario,
    type EmailScenarioLocale,
    type EmailSendPath,
    SUBJECT_FELL_BACK_WARNING
} from './types.js';

/** At least one scenario, enforced at the type level. */
export type EmailScenarioList<TInput> = readonly [
    EmailScenario<TInput>,
    ...EmailScenario<TInput>[]
];

/** Thrown when a scenario id does not exist on an entry. */
export class EmailCatalogScenarioNotFoundError extends Error {
    constructor(input: { readonly key: string; readonly scenarioId: string }) {
        super(`Unknown scenario "${input.scenarioId}" for email catalog entry "${input.key}"`);
        this.name = 'EmailCatalogScenarioNotFoundError';
    }
}

/** Input of {@link defineEmailCatalogEntry}. */
export interface DefineEmailCatalogEntryInput<TInput> {
    /** Production path that sends the email. */
    readonly sendPath: EmailSendPath;
    /** NotificationType value, outbox template key, or path-local id. */
    readonly id: string;
    /** Spanish human name. */
    readonly name: string;
    /** Admin grouping. */
    readonly domain: EmailCatalogDomain;
    /** Who reads the email. */
    readonly audience: EmailAudience;
    /** Defaults to `true`. `false`: the template exists but nothing sends it. */
    readonly wired?: boolean;
    /** Sample inputs, at least one. */
    readonly scenarios: EmailScenarioList<TInput>;
    /** Renders one sample through the production component and subject code. */
    readonly render: (input: {
        readonly scenario: TInput;
        readonly deps: EmailCatalogRenderDeps;
    }) => EmailCatalogRendered | Promise<EmailCatalogRendered>;
}

const SCENARIO_LOCALES: readonly EmailScenarioLocale[] = ['es', 'en', 'pt'];

function isScenarioLocale(value: unknown): value is EmailScenarioLocale {
    return SCENARIO_LOCALES.some((locale) => locale === value);
}

function recordOf(value: unknown): Readonly<Record<string, unknown>> | null {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        ? (value as Readonly<Record<string, unknown>>)
        : null;
}

/**
 * Reads the locale a scenario input carries, at the top level (notification payloads,
 * conversation and digest samples) or inside `payload` (outbox rows).
 *
 * @param input - The scenario input
 * @returns The locale the input carries, or `undefined` when it carries none
 */
export function readInputLocale(input: unknown): EmailScenarioLocale | undefined {
    const top = recordOf(input);
    if (!top) return undefined;
    if (isScenarioLocale(top.locale)) return top.locale;
    const payload = recordOf(top.payload);
    return payload && isScenarioLocale(payload.locale) ? payload.locale : undefined;
}

/**
 * Builds a type-erased catalog entry while keeping its scenarios typed.
 *
 * @param input - The entry definition.
 * @returns The catalog entry.
 * @throws {Error} At module load when two scenarios share an id, or when a scenario's
 * input carries a `locale` that differs from the locale the scenario declares (D14).
 */
export function defineEmailCatalogEntry<TInput>(
    input: DefineEmailCatalogEntryInput<TInput>
): EmailCatalogEntry {
    const key = `${input.sendPath}.${input.id}` as const;
    const seen = new Set<string>();
    for (const scenario of input.scenarios) {
        if (seen.has(scenario.id)) {
            throw new Error(
                `Duplicate scenario id "${scenario.id}" in email catalog entry "${key}"`
            );
        }
        seen.add(scenario.id);
        const carried = readInputLocale(scenario.input);
        const declared = scenario.locale ?? 'es';
        if (carried !== undefined && carried !== declared) {
            throw new Error(
                `Scenario "${scenario.id}" of email catalog entry "${key}" carries locale "${carried}" but declares "${declared}"`
            );
        }
    }
    const { render, scenarios } = input;
    return {
        key,
        id: input.id,
        sendPath: input.sendPath,
        name: input.name,
        domain: input.domain,
        audience: input.audience,
        wired: input.wired ?? true,
        scenarios: scenarios.map(({ id, label, locale, recipientVerticals }) => ({
            id,
            label,
            locale: locale ?? 'es',
            ...(recipientVerticals ? { recipientVerticals } : {})
        })),
        renderScenario: async ({ scenarioId, deps }) => {
            const scenario = scenarios.find((candidate) => candidate.id === scenarioId);
            if (!scenario) {
                throw new EmailCatalogScenarioNotFoundError({ key, scenarioId });
            }
            return render({ scenario: scenario.input, deps });
        }
    };
}

/** Input of {@link defineNotificationEntry}. */
export interface DefineNotificationEntryInput<TPayload extends NotificationPayload> {
    /** The notification type; it is also the entry id. */
    readonly type: NotificationType;
    /** Spanish human name. */
    readonly name: string;
    /** Admin grouping. */
    readonly domain: EmailCatalogDomain;
    /** Who reads the email. */
    readonly audience: EmailAudience;
    /** Sample payloads, at least one. */
    readonly scenarios: EmailScenarioList<TPayload>;
}

/**
 * Builds a `notification.*` entry rendered through `renderNotificationEmail`,
 * the function `NotificationService.send` uses.
 *
 * Every scenario's `payload.type` must equal the entry's `type`: the template
 * is selected from the payload, so a copy-pasted scenario of another type
 * would otherwise preview template X under the key `notification.Y`.
 *
 * @param input - The entry definition.
 * @returns The catalog entry.
 * @throws {Error} At module load when a scenario's payload type differs from the entry type.
 */
export function defineNotificationEntry<TPayload extends NotificationPayload>(
    input: DefineNotificationEntryInput<TPayload>
): EmailCatalogEntry {
    for (const scenario of input.scenarios) {
        if (scenario.input.type !== input.type) {
            throw new Error(
                `Scenario "${scenario.id}" of email catalog entry "notification.${input.type}" has payload type "${scenario.input.type}"`
            );
        }
    }
    return defineEmailCatalogEntry<TPayload>({
        sendPath: 'notification',
        id: input.type,
        name: input.name,
        domain: input.domain,
        audience: input.audience,
        scenarios: input.scenarios,
        render: ({ scenario, deps }) => {
            const { subject, react, unresolvedPlaceholders } = renderNotificationEmail({
                payload: scenario,
                siteUrl: deps.siteUrl
            });
            return {
                subject,
                react,
                warnings: unresolvedPlaceholders.length > 0 ? [SUBJECT_FELL_BACK_WARNING] : []
            };
        }
    });
}

/** Scenario input of an outbox entry: the row payload plus optional row overrides. */
export interface OutboxScenarioInput {
    /** The JSON payload the producer enqueues. */
    readonly payload: Record<string, unknown>;
    /** Row fields to override on the synthetic row (rarely needed). */
    readonly row?: Partial<Omit<EmailOutboxRow, 'template' | 'payload'>>;
}

/** Input of {@link defineOutboxEntry}. */
export interface DefineOutboxEntryInput {
    /** The outbox template key; it is also the entry id. */
    readonly template: string;
    /** Spanish human name. */
    readonly name: string;
    /** Admin grouping. */
    readonly domain: EmailCatalogDomain;
    /** Who reads the email. */
    readonly audience: EmailAudience;
    /** Sample payloads, at least one. */
    readonly scenarios: EmailScenarioList<OutboxScenarioInput>;
}

/**
 * Builds an `outbox.*` entry. The render builds a synthetic outbox row and
 * hands it to the injected `deps.outboxRenderer`, so the production renderer's
 * own runtime validation checks the sample.
 *
 * @param input - The entry definition.
 * @returns The catalog entry.
 */
export function defineOutboxEntry(input: DefineOutboxEntryInput): EmailCatalogEntry {
    return defineEmailCatalogEntry<OutboxScenarioInput>({
        sendPath: 'outbox',
        id: input.template,
        name: input.name,
        domain: input.domain,
        audience: input.audience,
        scenarios: input.scenarios,
        render: async ({ scenario, deps }) => {
            const row = buildPreviewOutboxRow({
                template: input.template,
                payload: scenario.payload,
                ...(scenario.row ? { overrides: scenario.row } : {})
            });
            const { subject, react } = await deps.outboxRenderer({ row });
            return { subject, react, warnings: [] };
        }
    });
}
