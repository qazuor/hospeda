import { z } from 'zod';

/**
 * Admin email previewer API schemas (HOS-2519 §7.2).
 *
 * The catalog itself (React elements, renderers) lives in `@repo/notifications`;
 * the API surface and the admin app only see these Zod shapes.
 */

// ============================================================================
// ENUMS
// ============================================================================

/** Production path that sends an email. Mirrors `EmailSendPath` in `@repo/notifications`. */
export const EmailSendPathSchema = z.enum([
    'notification',
    'outbox',
    'auth',
    'conversation',
    'alert-digest',
    'newsletter'
]);

/** Production path that sends an email. */
export type EmailSendPath = z.infer<typeof EmailSendPathSchema>;

/** Grouping shown in the admin previewer. Mirrors `EmailCatalogDomain` in `@repo/notifications`. */
export const EmailCatalogDomainSchema = z.enum([
    'auth',
    'billing',
    'subscription',
    'trial',
    'listing',
    'host-trade',
    'alliance',
    'partner',
    'conversation',
    'admin',
    'newsletter',
    'alerts',
    'contact-feedback',
    'ai'
]);

/** Grouping shown in the admin previewer. */
export type EmailCatalogDomain = z.infer<typeof EmailCatalogDomainSchema>;

/** Who reads an email. Mirrors `EmailAudience` in `@repo/notifications` (HOS-2565). */
export const EmailAudienceSchema = z.enum(['user', 'staff']);

/** Who reads an email: end users or internal staff. */
export type EmailAudience = z.infer<typeof EmailAudienceSchema>;

// ============================================================================
// LIST
// ============================================================================

/** One scenario of a catalog entry, as listed (no sample input). */
export const EmailPreviewScenarioSummarySchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    /** Locale of the rendered copy (HOS-2565 D14). Resolved: never absent. */
    locale: z.enum(['es', 'en', 'pt']),
    /**
     * Subject this sample renders, without the environment prefix, so the previewer can
     * search by it (HOS-2580 §H). `null` when the sample could not be rendered.
     */
    subject: z.string().nullable()
});

/** One scenario of a catalog entry, as listed. */
export type EmailPreviewScenarioSummary = z.infer<typeof EmailPreviewScenarioSummarySchema>;

/** One catalog entry in `GET /api/v1/admin/email-previews`. */
export const EmailPreviewEntrySummarySchema = z.object({
    key: z.string().min(1),
    id: z.string().min(1),
    sendPath: EmailSendPathSchema,
    name: z.string().min(1),
    domain: EmailCatalogDomainSchema,
    /** Who reads the email: end users or internal staff. */
    audience: EmailAudienceSchema,
    /** `false`: the template exists but no production path sends it. */
    wired: z.boolean(),
    scenarios: z.array(EmailPreviewScenarioSummarySchema).min(1)
});

/** One catalog entry in the list response. */
export type EmailPreviewEntrySummary = z.infer<typeof EmailPreviewEntrySummarySchema>;

/** Response of `GET /api/v1/admin/email-previews`: the whole catalog, in catalog order. */
export const EmailPreviewListResponseSchema = z.object({
    entries: z.array(EmailPreviewEntrySummarySchema),
    total: z.number().int().nonnegative()
});

/** Response of the list endpoint. */
export type EmailPreviewListResponse = z.infer<typeof EmailPreviewListResponseSchema>;

// ============================================================================
// RENDER
// ============================================================================

/** Query of `GET /api/v1/admin/email-previews/render`. */
export const EmailPreviewRenderQuerySchema = z.object({
    key: z.string().min(1).max(200),
    scenarioId: z.string().min(1).max(100)
});

/** Query of the render endpoint. */
export type EmailPreviewRenderQuery = z.infer<typeof EmailPreviewRenderQuerySchema>;

/** Response of `GET /api/v1/admin/email-previews/render`. */
export const EmailPreviewRenderResponseSchema = z.object({
    key: z.string(),
    scenarioId: z.string(),
    /** Exactly what the production path builds, without the environment prefix. */
    subject: z.string(),
    /** `'[STAGING] '` outside production, `null` on production. */
    subjectPrefix: z.string().nullable(),
    /** HTML body, as the transport posts it. */
    html: z.string(),
    /** text/plain body, as the transport posts it. */
    text: z.string(),
    warnings: z.array(z.string())
});

/** Response of the render endpoint. */
export type EmailPreviewRenderResponse = z.infer<typeof EmailPreviewRenderResponseSchema>;
