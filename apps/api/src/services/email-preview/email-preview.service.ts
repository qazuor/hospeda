/**
 * Admin email preview service (HOS-2519 §6.3).
 *
 * Lists the central email catalog and renders one scenario of one entry
 * through the production component, the production subject code and
 * `renderEmailBodies`. Read-only: no database write, no send, no outbox row.
 * The outbox renderers run with the non-writing fakes of
 * `email-preview-deps.ts` (AC-4.6).
 *
 * @module services/email-preview/email-preview.service
 */

import {
    EMAIL_CATALOG,
    type EmailCatalogEntry,
    EmailCatalogEntryNotFoundError,
    type EmailCatalogRenderDeps,
    EmailCatalogScenarioNotFoundError,
    type RenderEmailCatalogScenarioInput,
    type RenderedEmailCatalogScenario,
    renderEmailCatalogScenario
} from '@repo/notifications';
import type {
    EmailPreviewEntrySummary,
    EmailPreviewListResponse,
    EmailPreviewRenderQuery,
    EmailPreviewRenderResponse
} from '@repo/schemas';
import { ServiceErrorCode } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { getEmailEnvironmentLabel, getEmailSender } from '../../utils/email-sender.js';
import { env } from '../../utils/env.js';
import { apiLogger } from '../../utils/logger.js';
import { buildEmailPreviewDeps } from './email-preview-deps.js';

/** Collaborators of {@link createEmailPreviewService}; every one has a production default. */
export interface CreateEmailPreviewServiceInput {
    /** The catalog to expose. Defaults to `EMAIL_CATALOG`. */
    readonly catalog?: readonly EmailCatalogEntry[];
    /** Builds the render dependencies, called at most once. Defaults to the env-backed fakes. */
    readonly buildDeps?: () => EmailCatalogRenderDeps;
    /** The preview pipeline. Defaults to `renderEmailCatalogScenario`. */
    readonly renderScenario?: (
        input: RenderEmailCatalogScenarioInput
    ) => Promise<RenderedEmailCatalogScenario>;
    /** Subject prefix the inbox would show. Defaults to `getEmailSender().subjectPrefix`. */
    readonly getSubjectPrefix?: () => string | undefined;
}

/** The admin email preview service. */
export interface EmailPreviewService {
    /**
     * The whole catalog summary, in catalog order, with the subject of every scenario
     * (HOS-2580 §H). Computed once per service and reused.
     */
    readonly listEntries: () => Promise<EmailPreviewListResponse>;
    /**
     * Renders one scenario of one entry.
     *
     * @throws {ServiceError} `NOT_FOUND` for an unknown key or scenario,
     *   `INTERNAL_ERROR` (generic message, cause logged) when the sample fails to render.
     */
    readonly render: (input: EmailPreviewRenderQuery) => Promise<EmailPreviewRenderResponse>;
}

/** Message of the 500 thrown when a sample fails to render. Never carries the cause. */
export const EMAIL_PREVIEW_RENDER_FAILED_MESSAGE = 'The email preview could not be rendered';

/**
 * Builds the production render dependencies from the environment.
 *
 * @returns The catalog render dependencies with non-writing fakes.
 */
function buildDepsFromEnv(): EmailCatalogRenderDeps {
    const environmentLabel = getEmailEnvironmentLabel();
    return buildEmailPreviewDeps({
        siteUrl: env.HOSPEDA_SITE_URL,
        adminUrl: env.HOSPEDA_ADMIN_URL,
        ...(environmentLabel ? { environmentLabel } : {})
    });
}

/**
 * The subject one scenario renders, through the production subject code only (no HTML
 * body is built). A sample that throws yields `null` and a warning, never a failed list.
 *
 * @param input - The entry, the scenario id and the render dependencies.
 * @returns The subject, or `null`.
 */
async function readScenarioSubject(input: {
    readonly entry: EmailCatalogEntry;
    readonly scenarioId: string;
    readonly deps: EmailCatalogRenderDeps;
}): Promise<string | null> {
    try {
        const rendered = await input.entry.renderScenario({
            scenarioId: input.scenarioId,
            deps: input.deps
        });
        return rendered.subject;
    } catch (error) {
        apiLogger.warn(
            {
                key: input.entry.key,
                scenarioId: input.scenarioId,
                error: error instanceof Error ? error : new Error(String(error))
            },
            'Email preview subject could not be rendered for the list'
        );
        return null;
    }
}

/**
 * Projects a catalog entry to its API summary (drops the renderer).
 *
 * @param input - The entry to project and the render dependencies for its subjects.
 * @returns The summary the list endpoint serializes.
 */
async function toSummary(input: {
    readonly entry: EmailCatalogEntry;
    readonly deps: EmailCatalogRenderDeps;
}): Promise<EmailPreviewEntrySummary> {
    const { entry, deps } = input;
    const subjects = await Promise.all(
        entry.scenarios.map((scenario) =>
            readScenarioSubject({ entry, scenarioId: scenario.id, deps })
        )
    );
    return {
        key: entry.key,
        id: entry.id,
        sendPath: entry.sendPath,
        name: entry.name,
        domain: entry.domain,
        audience: entry.audience,
        wired: entry.wired,
        scenarios: entry.scenarios.map((scenario, index) => ({
            id: scenario.id,
            label: scenario.label,
            locale: scenario.locale,
            subject: subjects[index] ?? null
        }))
    };
}

/**
 * Creates the admin email preview service.
 *
 * @param input - Optional collaborators; production defaults otherwise.
 * @returns The service.
 *
 * @example
 * ```ts
 * const service = createEmailPreviewService();
 * const { entries, total } = await service.listEntries();
 * const preview = await service.render({ key: entries[0].key, scenarioId: entries[0].scenarios[0].id });
 * ```
 */
export function createEmailPreviewService(
    input: CreateEmailPreviewServiceInput = {}
): EmailPreviewService {
    const catalog = input.catalog ?? EMAIL_CATALOG;
    const buildDeps = input.buildDeps ?? buildDepsFromEnv;
    const renderScenario = input.renderScenario ?? renderEmailCatalogScenario;
    const getSubjectPrefix = input.getSubjectPrefix ?? (() => getEmailSender().subjectPrefix);
    let deps: EmailCatalogRenderDeps | undefined;
    let listing: Promise<EmailPreviewListResponse> | undefined;

    const listEntries = (): Promise<EmailPreviewListResponse> => {
        // The catalog and the fakes are static: the subjects are computed once.
        listing ??= (async () => {
            deps ??= buildDeps();
            const resolvedDeps = deps;
            const entries = await Promise.all(
                catalog.map((entry) => toSummary({ entry, deps: resolvedDeps }))
            );
            return { entries, total: entries.length };
        })();
        return listing;
    };

    const render = async ({
        key,
        scenarioId
    }: EmailPreviewRenderQuery): Promise<EmailPreviewRenderResponse> => {
        const entry = catalog.find((candidate) => candidate.key === key);
        if (!entry) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Email catalog entry not found');
        }
        if (!entry.scenarios.some((scenario) => scenario.id === scenarioId)) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Email catalog scenario not found');
        }
        try {
            deps ??= buildDeps();
            const rendered = await renderScenario({ key, scenarioId, deps });
            return {
                key,
                scenarioId,
                subject: rendered.subject,
                subjectPrefix: getSubjectPrefix() ?? null,
                html: rendered.html,
                text: rendered.text,
                warnings: [...rendered.warnings]
            };
        } catch (error) {
            if (error instanceof EmailCatalogEntryNotFoundError) {
                throw new ServiceError(ServiceErrorCode.NOT_FOUND, 'Email catalog entry not found');
            }
            if (error instanceof EmailCatalogScenarioNotFoundError) {
                throw new ServiceError(
                    ServiceErrorCode.NOT_FOUND,
                    'Email catalog scenario not found'
                );
            }
            // The whole error (message and stack) goes to the log; the 500 body stays generic (R1b).
            apiLogger.error(
                {
                    key,
                    scenarioId,
                    error: error instanceof Error ? error : new Error(String(error))
                },
                'Email preview render failed'
            );
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                EMAIL_PREVIEW_RENDER_FAILED_MESSAGE
            );
        }
    };

    return { listEntries, render };
}

let defaultService: EmailPreviewService | undefined;

/**
 * The process-wide preview service, built on first use so the render
 * dependencies are composed once per process.
 *
 * @returns The shared service.
 */
export function getEmailPreviewService(): EmailPreviewService {
    defaultService ??= createEmailPreviewService();
    return defaultService;
}
