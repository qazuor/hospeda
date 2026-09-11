/**
 * experience.certificate.ts
 *
 * Issuing and reading the certificate an experience provider hands to whoever
 * did the experience (HOS-1057).
 *
 * ---
 * WHY HELPER FUNCTIONS AND NOT A `BaseCrudService`
 *
 * Same reason `experience.faq.ts` is shaped this way, and it is the direct
 * precedent: a certificate is a sub-entity of ONE listing with its own table
 * and model, never listed platform-wide, never searched by free text, and
 * never reachable except through its parent. A `BaseCrudService` would bring a
 * generic search surface nobody calls and — worse — a `getSearchableColumns()`
 * whose inherited default is `['name']` over a table that has no `name`
 * column, which is a fail-open that does not appear in any diff.
 *
 * ## Authorisation, and the shape of a refusal
 *
 * Every function here re-derives ownership from the listing rather than
 * trusting the caller, even though the routes already do (see
 * `apps/api/src/routes/experience/protected/certificates.ts`). The duplication
 * is deliberate: the route's check is what produces the correct STATUS, and
 * this one is what stops a future caller that reaches the helper another way.
 *
 * Reads answer NOT_FOUND, never FORBIDDEN, for a listing or a certificate that
 * is not the caller's — the error contract's anti-enumeration rule. Writes go
 * through `checkExperienceCanEditFaqs`'s underlying `checkCanEditOwn`, which
 * raises FORBIDDEN, and that is right: by the time a write runs, the route has
 * already established the listing IS the caller's, so a refusal here means the
 * actor's permission set is wrong rather than that they are probing for ids.
 *
 * ## No emission on completion, and why not yet
 *
 * The certificate is issued BY HAND from the provider's panel. Automatic
 * issuance when an outing ends needs the outings (HOS-1040) and needs to know
 * who was on them, which needs the bookings (HOS-1050); neither exists. The
 * manual path is the whole v1 and blocks on nothing.
 *
 * @module experience.certificate
 */

import { ExperienceCertificateModel, type ExperienceModel } from '@repo/db';
import {
    type ExperienceCertificate,
    type ExperienceCertificateGetInput,
    ExperienceCertificateGetInputSchema,
    type ExperienceCertificateIssueInput,
    ExperienceCertificateIssueInputSchema,
    type ExperienceCertificateListInput,
    ExperienceCertificateListInputSchema,
    ServiceErrorCode
} from '@repo/schemas';
import type { z } from 'zod';
import type { Actor, ServiceContext, ServiceOutput } from '../../types';
import { ServiceError } from '../../types';
import { checkExperienceCanEditFaqs } from './experience.permissions';

/**
 * The one spelling of "there is no such certificate here".
 *
 * Used for a listing that does not exist, a listing that is not the caller's, a
 * certificate that does not exist, and a certificate that belongs to another
 * listing — four states with one message, so the endpoint cannot be used to
 * tell them apart (HOS-600).
 */
const NOT_FOUND_MESSAGE = 'Experience certificate not found';

/** Validates `input` against `schema` or returns the service's validation failure. */
function parseOrFail<TSchema extends z.ZodTypeAny>(
    schema: TSchema,
    input: unknown
): { ok: true; data: z.infer<TSchema> } | { ok: false; message: string } {
    const parsed = schema.safeParse(input);
    if (parsed.success) {
        return { ok: true, data: parsed.data };
    }
    const messages = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
    return { ok: false, message: `Validation failed: ${messages}` };
}

/**
 * Loads the listing and asserts it is the actor's, or throws the canonical 404.
 *
 * Ownership IS the authorisation here, and a listing that is not the actor's
 * answers NOT_FOUND rather than FORBIDDEN so the endpoint is not an oracle for
 * which experience ids exist.
 */
async function requireOwnedExperience(
    model: ExperienceModel,
    actor: Actor,
    experienceId: string,
    tx?: ServiceContext['tx']
): Promise<{ id: string; ownerId?: string | null }> {
    const entity = await model.findById(experienceId, tx);
    if (!entity || !actor?.id || entity.ownerId !== actor.id) {
        throw new ServiceError(ServiceErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
    }
    return entity;
}

/**
 * Issues a certificate for an experience.
 *
 * @param model - ExperienceModel instance, used to resolve the parent listing.
 * @param actor - The provider issuing it. Must own the listing.
 * @param data - Listing id, recipient name and the day it was done.
 * @param ctx - Optional service context, for transaction propagation.
 * @returns The created certificate.
 */
export async function issueExperienceCertificate(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceCertificateIssueInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ certificate: ExperienceCertificate }>> {
    const parsed = parseOrFail(ExperienceCertificateIssueInputSchema, data);
    if (!parsed.ok) {
        return { error: { code: ServiceErrorCode.VALIDATION_ERROR, message: parsed.message } };
    }
    const validated = parsed.data;

    try {
        const experience = await requireOwnedExperience(
            model,
            actor,
            validated.experienceId,
            ctx?.tx
        );
        checkExperienceCanEditFaqs(actor, experience);

        const certificateModel = new ExperienceCertificateModel();
        const created = await certificateModel.create(
            {
                experienceId: validated.experienceId,
                recipientName: validated.recipientName,
                completedAt: validated.completedAt,
                // Stamped here rather than defaulted in the database so the
                // moment the row records is the same one the response reports.
                issuedAt: new Date(),
                createdById: actor.id,
                updatedById: actor.id
                // TYPE-WORKAROUND: `issuedAt` and the audit ids are decided
                // server-side, so the create input schema does not declare them.
            } as unknown as Partial<ExperienceCertificate>,
            ctx?.tx
        );

        return { data: { certificate: created as ExperienceCertificate } };
    } catch (error) {
        return toServiceOutputError(error);
    }
}

/**
 * The certificates a listing has issued, newest first.
 *
 * @param model - ExperienceModel instance.
 * @param actor - The provider. Must own the listing.
 * @param data - Listing id and the page window.
 * @param ctx - Optional service context.
 * @returns The page of certificates plus the unpaginated total.
 */
export async function listExperienceCertificates(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceCertificateListInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ certificates: ExperienceCertificate[]; total: number }>> {
    const parsed = parseOrFail(ExperienceCertificateListInputSchema, data);
    if (!parsed.ok) {
        return { error: { code: ServiceErrorCode.VALIDATION_ERROR, message: parsed.message } };
    }
    const validated = parsed.data;

    try {
        await requireOwnedExperience(model, actor, validated.experienceId, ctx?.tx);

        const certificateModel = new ExperienceCertificateModel();
        const { items, total } = await certificateModel.findAll(
            { experienceId: validated.experienceId, deletedAt: null },
            {
                page: validated.page,
                pageSize: validated.pageSize,
                sortBy: 'issuedAt',
                sortOrder: 'desc'
            },
            undefined,
            ctx?.tx
        );

        return { data: { certificates: items as ExperienceCertificate[], total } };
    } catch (error) {
        return toServiceOutputError(error);
    }
}

/**
 * One certificate of one listing.
 *
 * The pair is checked together on purpose: a certificate id that exists but
 * hangs off another listing answers NOT_FOUND like one that does not exist at
 * all, so the endpoint cannot confirm an id by its status code.
 *
 * @param model - ExperienceModel instance.
 * @param actor - The provider. Must own the listing.
 * @param data - Listing id and certificate id.
 * @param ctx - Optional service context.
 * @returns The certificate.
 */
export async function getExperienceCertificate(
    model: ExperienceModel,
    actor: Actor,
    data: ExperienceCertificateGetInput,
    ctx?: ServiceContext
): Promise<ServiceOutput<{ certificate: ExperienceCertificate }>> {
    const parsed = parseOrFail(ExperienceCertificateGetInputSchema, data);
    if (!parsed.ok) {
        return { error: { code: ServiceErrorCode.VALIDATION_ERROR, message: parsed.message } };
    }
    const validated = parsed.data;

    try {
        await requireOwnedExperience(model, actor, validated.experienceId, ctx?.tx);

        const certificateModel = new ExperienceCertificateModel();
        const certificate = await certificateModel.findOne(
            {
                id: validated.certificateId,
                experienceId: validated.experienceId,
                deletedAt: null
            },
            ctx?.tx
        );

        if (!certificate) {
            throw new ServiceError(ServiceErrorCode.NOT_FOUND, NOT_FOUND_MESSAGE);
        }

        return { data: { certificate: certificate as ExperienceCertificate } };
    } catch (error) {
        return toServiceOutputError(error);
    }
}

/**
 * Turns a thrown error into the `ServiceOutput` failure shape.
 *
 * A `ServiceError` keeps its own code — that is how the NOT_FOUND above reaches
 * the route as a 404 rather than a 500. Anything else is genuinely unexpected
 * and becomes INTERNAL_ERROR without leaking its message.
 */
function toServiceOutputError(error: unknown): {
    error: { code: ServiceErrorCode; message: string };
} {
    if (error instanceof ServiceError) {
        return { error: { code: error.code, message: error.message } };
    }
    return {
        error: {
            code: ServiceErrorCode.INTERNAL_ERROR,
            message: 'Could not complete the certificate operation'
        }
    };
}
