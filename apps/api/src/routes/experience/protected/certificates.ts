/**
 * The certificates an experience provider issues (HOS-1057).
 *
 * ```
 * POST /api/v1/protected/experiences/{id}/certificates
 * GET  /api/v1/protected/experiences/{id}/certificates
 * GET  /api/v1/protected/experiences/{id}/certificates/{certificateId}/pdf
 * ```
 *
 * Three routes in one module because they share one preamble
 * ({@link requireOwnedExperience}) and one refusal, and splitting them across
 * files is how the two drift apart.
 *
 * ---
 * THE ORDER OF THE CHECKS, WHICH IS THE WHOLE SECURITY MODEL
 *
 * 1. `protectedAuthMiddleware` — a session, or 401.
 * 2. `commerceVerticalEntitlementMiddleware('experience')` — REPLACES the
 *    request's entitlement set with the one resolved from the caller's
 *    EXPERIENCE subscription. Without it the next line reads the ACCOMMODATION
 *    set, which never carries a commerce key, and every caller is refused.
 * 3. `requireEntitlement(ISSUE_EXPERIENCE_CERTIFICATE)` — the plan gate, 403.
 * 4. Ownership, inside the handler — 404, never 403, because a 403 would
 *    confirm that the experience id exists (`docs/error-contract.md`).
 *
 * Steps 2 and 3 are middlewares so they run BEFORE the handler touches the
 * database: the e2e tests assert exactly that by spying on
 * `ExperienceService.getById` and requiring it never ran on the refusal path.
 *
 * ## Who may read a certificate
 *
 * The issuing owner, and nobody else. There is deliberately no public
 * certificate URL — the reasoning is in the module doc of
 * `services/experience-certificate/certificate-response.ts`, and it is the
 * thing to read before adding one.
 *
 * @module routes/experience/protected/certificates
 */

import { EntitlementKey } from '@repo/billing';
import {
    EntityTypeEnum,
    ExperienceCertificateCreateInputSchema,
    ExperienceCertificateListOutputSchema,
    type ExperienceCertificateOutput,
    ExperienceCertificateOutputSchema,
    PermissionEnum,
    QrCodePurposeEnum,
    ServiceErrorCode,
    VisibilityEnum
} from '@repo/schemas';
import {
    ExperienceService,
    entityNotFoundError,
    getExperienceCertificate,
    issueExperienceCertificate,
    listExperienceCertificates
} from '@repo/service-core';
// Same module instance `utils/response-helpers` compares against: importing
// `ServiceError` from the package ROOT yields a DIFFERENT class under the test
// resolver, and `instanceof` then fails — a NOT_FOUND answered as a 500.
import { ServiceError } from '@repo/service-core/types';
import type { Context } from 'hono';
import { z } from 'zod';
import { commerceVerticalEntitlementMiddleware } from '../../../middlewares/commerce-entitlement';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { buildCertificateContent } from '../../../services/experience-certificate/certificate-content';
import { buildCertificateResponse } from '../../../services/experience-certificate/certificate-response';
import { getActorFromContext } from '../../../utils/actor';
import { buildEntityQrLabel, resolveEntityQrScanUrl } from '../../../utils/entity-qr';
import { env } from '../../../utils/env';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { resolveReturnUrlLocale } from '../../billing/checkout-return-urls';

const experienceService = new ExperienceService({ logger: apiLogger });

/** The gate every route in this module carries, spelled once. */
const CERTIFICATE_GATE = [
    commerceVerticalEntitlementMiddleware('experience'),
    requireEntitlement(EntitlementKey.ISSUE_EXPERIENCE_CERTIFICATE)
];

/**
 * TYPE-WORKAROUND: the service-core certificate helpers take the model, and the
 * service exposes it as `protected`. Same cast `addFaq.ts` uses, for the same
 * reason: a public accessor would widen the service's surface for one caller.
 */
function experienceModel(): Parameters<typeof issueExperienceCertificate>[0] {
    // TYPE-WORKAROUND: the certificate helpers take the model, and the service
    // exposes it as `protected`; a public accessor would widen the service's
    // surface for one caller.
    return (
        experienceService as unknown as {
            model: Parameters<typeof issueExperienceCertificate>[0];
        }
    ).model;
}

/**
 * Loads the experience and asserts it is the caller's.
 *
 * Staff holding `COMMERCE_VIEW_ALL` pass the ownership test, as they do on the
 * brochure route — a support agent looking at a provider's account must be able
 * to see what that provider issued.
 *
 * Every failure — no such listing, somebody else's listing — throws the SAME
 * canonical NOT_FOUND, so a caller cannot tell them apart by status or message
 * (HOS-600).
 */
async function requireOwnedExperience(ctx: Context, experienceId: string) {
    const actor = getActorFromContext(ctx);
    const result = await experienceService.getById(actor, experienceId);

    if (result.error) {
        throw new ServiceError(result.error.code, result.error.message);
    }

    const entity = result.data;
    const hasViewAll = actor.permissions?.includes(PermissionEnum.COMMERCE_VIEW_ALL);
    if (!entity || (!hasViewAll && entity.ownerId !== actor.id)) {
        throw entityNotFoundError({ entityName: ExperienceService.ENTITY_NAME });
    }

    return entity;
}

/** Projects a stored certificate into the API's response shape. */
function toOutput(certificate: {
    id: string;
    experienceId: string;
    recipientName: string;
    completedAt: string;
    issuedAt: Date | string;
}): ExperienceCertificateOutput {
    return {
        id: certificate.id,
        experienceId: certificate.experienceId,
        recipientName: certificate.recipientName,
        completedAt: certificate.completedAt,
        issuedAt:
            certificate.issuedAt instanceof Date
                ? certificate.issuedAt.toISOString()
                : certificate.issuedAt
    };
}

/**
 * POST /api/v1/protected/experiences/:id/certificates
 *
 * Issues one. Manual by design: automatic issuance at the end of an outing
 * needs the outings (HOS-1040) and the bookings behind them (HOS-1050), and
 * neither exists — while this path blocks on nothing.
 */
export const protectedIssueExperienceCertificateRoute = createProtectedRoute({
    method: 'post',
    path: '/{id}/certificates',
    summary: 'Issue a certificate for an experience',
    description:
        'Issues a certificate naming the person who did the experience and the day they did it. Owner-only. Requires the issue_experience_certificate entitlement, granted by the professional experience plan and upwards.',
    tags: ['Experience', 'Experience Certificates'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    requestBody: ExperienceCertificateCreateInputSchema,
    responseSchema: z.object({ certificate: ExperienceCertificateOutputSchema }),
    handler: async (
        ctx: Context,
        params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        await requireOwnedExperience(ctx, params.id as string);

        const result = await issueExperienceCertificate(experienceModel(), actor, {
            experienceId: params.id as string,
            recipientName: String(body.recipientName ?? ''),
            completedAt: String(body.completedAt ?? '')
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return { certificate: toOutput(result.data.certificate) };
    },
    options: {
        middlewares: CERTIFICATE_GATE,
        // A provider issues a handful after an outing, never a hundred. The cap
        // is what stops the endpoint from being usable to write a lot of
        // arbitrary names into the database quickly.
        customRateLimit: { requests: 30, windowMs: 60_000 }
    }
});

/**
 * GET /api/v1/protected/experiences/:id/certificates
 *
 * The provider's own record of what they issued, newest first.
 */
export const protectedListExperienceCertificatesRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/certificates',
    summary: 'List the certificates issued for an experience',
    description:
        'Returns the certificates this experience has issued, newest first. Owner-only. Requires the issue_experience_certificate entitlement.',
    tags: ['Experience', 'Experience Certificates'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: ExperienceCertificateListOutputSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        await requireOwnedExperience(ctx, params.id as string);

        const result = await listExperienceCertificates(experienceModel(), actor, {
            experienceId: params.id as string,
            page: 1,
            pageSize: 100
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            certificates: result.data.certificates.map(toOutput),
            total: result.data.total
        };
    },
    options: {
        middlewares: CERTIFICATE_GATE
    }
});

/**
 * GET /api/v1/protected/experiences/:id/certificates/:certificateId/pdf
 *
 * The printable sheet. Returns a raw `Response` rather than a JSON envelope,
 * so the schema machinery validates nothing here — which is exactly why the
 * e2e test asserts the header pair and the PDF magic bytes directly.
 *
 * **Refuses a listing that is not PUBLIC**, and that is not a copy of the
 * brochure's rule for its own sake: this sheet carries a QR pointing at the
 * experience's public ficha, and printing one for an unpublished listing puts a
 * permanent 404 on a piece of paper somebody keeps. Issuing and listing stay
 * open regardless of visibility, so unpublishing never costs an owner their
 * record — only the ability to print a sheet whose link would be dead.
 */
export const protectedGetExperienceCertificatePdfRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/certificates/{certificateId}/pdf',
    summary: 'Download the certificate as a printable PDF',
    description:
        'Returns a print-ready landscape A4 PDF of one issued certificate — the recipient, the experience, the date and a QR back to the public listing. Owner-only, and only for a listing that is publicly visible. Requires the issue_experience_certificate entitlement.',
    tags: ['Experience', 'Experience Certificates'],
    requestParams: {
        id: z.string().uuid({ message: 'zodError.common.id.invalidUuid' }),
        certificateId: z.string().uuid({ message: 'zodError.common.id.invalidUuid' })
    },
    responseSchema: z.null(),
    handler: async (ctx: Context, params: Record<string, unknown>): Promise<Response> => {
        const actor = getActorFromContext(ctx);
        const experience = await requireOwnedExperience(ctx, params.id as string);

        if (experience.visibility !== VisibilityEnum.PUBLIC) {
            // Same canonical message as the ownership branch, deliberately: two
            // spellings would let a caller tell "not yours" from "not
            // published".
            throw entityNotFoundError({ entityName: ExperienceService.ENTITY_NAME });
        }

        const result = await getExperienceCertificate(experienceModel(), actor, {
            experienceId: params.id as string,
            certificateId: params.certificateId as string
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const certificate = result.data.certificate;

        if (!experience.slug) {
            throw new ServiceError(
                ServiceErrorCode.INTERNAL_ERROR,
                'experience listing could not be projected for printing'
            );
        }

        const content = buildCertificateContent({
            certificate: {
                recipientName: certificate.recipientName,
                completedAt: certificate.completedAt
            },
            experience: {
                slug: experience.slug,
                name: experience.name,
                nameI18n: experience.nameI18n ?? null
            },
            locale: resolveReturnUrlLocale(ctx),
            siteUrl: env.HOSPEDA_SITE_URL
        });

        // The sheet's QR encodes the platform's own redirect, never
        // `content.publicUrl` (HOS-1129). `CERTIFICATE`, not `BROCHURE`: an
        // experience carries both codes, and `purpose` is the third part of the
        // lookup key precisely so neither document draws the other's.
        //
        // One code per EXPERIENCE, not per certificate: every sheet this
        // listing issues points at the same ficha, so a per-certificate slug
        // would burn one permanent identifier per recipient and buy nothing.
        const qrUrl = await resolveEntityQrScanUrl({
            actor,
            entityType: EntityTypeEnum.EXPERIENCE,
            entityId: params.id as string,
            purpose: QrCodePurposeEnum.CERTIFICATE,
            targetUrl: content.publicUrl,
            label: buildEntityQrLabel({
                description: 'Experience certificate QR',
                name: experience.name,
                slug: experience.slug
            }),
            siteUrl: env.HOSPEDA_SITE_URL
        });

        return buildCertificateResponse({
            content,
            recipientName: certificate.recipientName,
            qrUrl
        });
    },
    options: {
        middlewares: CERTIFICATE_GATE,
        customRateLimit: { requests: 20, windowMs: 60_000 }
    }
});
