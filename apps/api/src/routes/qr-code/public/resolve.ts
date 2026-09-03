/**
 * Public QR resolution endpoint (HOS-981).
 *
 * `GET /api/v1/public/qr/{slug}` answers where a printed code points, and
 * records the scan in the SAME call. One round trip is the whole design: the
 * web app calls this on the critical path of a redirect, and every millisecond
 * spent here is a millisecond somebody stands in front of a sign holding a
 * phone.
 *
 * ## Everything that does not resolve answers the SAME 404
 *
 * A slug that never existed, a retired one (`isActive = false`), a soft-deleted
 * one and a syntactically impossible one all produce one byte-identical body,
 * built in exactly one place ({@link qrNotFound}). The endpoint is
 * unauthenticated and the slug space is short, so any difference — a different
 * status, a different message, a 403, or a shape that is only reachable for one
 * of the cases — hands a stranger an oracle over the table. A 403 in particular
 * would confirm the id exists, which the repo's error contract forbids
 * (`apps/api/docs/error-contract.md`, "Why a foreign resource answers 404").
 *
 * ## A malformed slug is a 404, not a 400
 *
 * The route declares its param as a plain string and checks the QR alphabet
 * itself. That is deliberate: the alphabet is a property of the slugs we STORE,
 * not of the URL grammar, so "these characters cannot name a code" is an
 * existence fact and belongs with the other three. Answering 400 for a
 * zero-width character and 404 for an unknown code would re-open the oracle
 * from the other side, and it would also make `../`, an absurd length or an
 * invisible character render differently to a scanner than a dead sticker does.
 *
 * The check runs BEFORE the service call, so no unvalidated value ever reaches
 * the database — the ordering rule the error contract states as "no step may
 * touch the database with a value an earlier step did not validate".
 */

import { QrCodeResolutionSchema, QrCodeSlugSchema, ServiceErrorCode } from '@repo/schemas';
import type { Actor } from '@repo/service-core';
import { QrCodeService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const qrCodeService = new QrCodeService({ logger: apiLogger });

/**
 * The one not-found message this endpoint can produce.
 *
 * A single constant behind a single factory is what makes "unknown", "retired",
 * "deleted" and "malformed" indistinguishable STRUCTURALLY rather than by
 * coincidence: there is no second spelling for a future edit to disagree with.
 */
const QR_NOT_FOUND_MESSAGE = 'QR code not found';

/** Builds the single refusal this endpoint may answer with. */
const qrNotFound = (): ServiceError =>
    new ServiceError(ServiceErrorCode.NOT_FOUND, QR_NOT_FOUND_MESSAGE);

/**
 * Records the scan without ever being able to break the redirect.
 *
 * The decision, stated plainly: **a scan is lost before a redirect is.**
 * Somebody standing in front of a printed sign has to reach their destination
 * even when the analytics write fails — a dropped row costs one tick on a
 * counter, a propagated failure costs the visit the code was printed for.
 *
 * The write fails in TWO shapes and both have to be absorbed. `BaseService.ln`
 * catches an ordinary `Error` and RETURNS it as `result.error`, but deliberately
 * RE-THROWS a `DbError` so the HTTP layer can map its type — and a database
 * outage, the failure most worth surviving here, is exactly that second shape.
 * The `try`/`catch` is what makes the guarantee, and it covers the returned-error
 * branch too, since that branch throws nothing; the `result.error` check is
 * there so a returned fault is LOGGED rather than passing in silence. Both paths
 * log at `error` level, so a systematic failure shows up in the logs instead of
 * quietly eroding the metric.
 *
 * It is `await`ed rather than fired and forgotten on purpose. The insert is one
 * row on an append-only table with no audit columns, so the latency it adds is
 * negligible, while a floating promise can be cut off when the process winds
 * down and would make the count quietly lossy under exactly the conditions
 * (deploys, restarts) where it is least likely to be noticed.
 *
 * @param params - Input parameters.
 * @param params.actor - The (guest) actor resolved for this request.
 * @param params.qrCodeId - Id of the code that was just resolved.
 */
async function recordScanBestEffort({
    actor,
    qrCodeId
}: {
    readonly actor: Actor;
    readonly qrCodeId: string;
}): Promise<void> {
    try {
        const result = await qrCodeService.registerScan({ actor, qrCodeId });
        if (result.error) {
            apiLogger.error(
                { qrCodeId, code: result.error.code },
                'QR scan not recorded; redirect continues'
            );
        }
    } catch (error) {
        apiLogger.error(
            { qrCodeId, error: error instanceof Error ? error.message : String(error) },
            'QR scan not recorded; redirect continues'
        );
    }
}

/**
 * GET /api/v1/public/qr/{slug}
 *
 * Resolves a printed slug to its target and records the scan.
 */
export const publicResolveQrCodeRoute = createPublicRoute({
    method: 'get',
    path: '/{slug}',
    summary: 'Resolve a QR code slug',
    description:
        'Resolves the slug printed on a QR code to its current target URL and records the scan. Answers an identical 404 for a slug that is unknown, retired, deleted or malformed.',
    tags: ['QrCodes'],
    requestParams: {
        /**
         * Deliberately loose. The QR alphabet is enforced in the handler so a
         * malformed slug joins the other not-found cases instead of splitting
         * off into a 400 that tells a caller its guess was at least well-formed.
         */
        slug: z.string()
    },
    responseSchema: QrCodeResolutionSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const rawSlug = params.slug;

        const parsedSlug = QrCodeSlugSchema.safeParse(rawSlug);
        if (!parsedSlug.success) {
            throw qrNotFound();
        }

        const actor = getActorFromContext(ctx);
        const result = await qrCodeService.resolveBySlug({ actor, slug: parsedSlug.data });

        // A genuine service fault stays a fault: collapsing it into the 404
        // would hide a broken database behind "that sticker is dead".
        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw qrNotFound();
        }

        const qrCode = result.data;

        await recordScanBestEffort({ actor, qrCodeId: qrCode.id });

        // Projected explicitly rather than handed the whole row: this response
        // needs no authentication, so `label`, `description` and every audit
        // column would be data leaking out of an open endpoint.
        return {
            id: qrCode.id,
            slug: qrCode.slug,
            targetUrl: qrCode.targetUrl
        };
    },
    options: {
        /**
         * No `cacheTTL`. The response both counts a scan and carries an
         * operator-editable target; a cached answer would lose the count and
         * keep sending scanners to a URL that has already been changed.
         *
         * The limit is generous because the natural traffic shape here is a
         * crowd behind one NAT — a bus tour in front of one sign — not a single
         * client polling. A 429 on this endpoint is a scanner who reached a
         * dead end.
         */
        customRateLimit: { requests: 240, windowMs: 60_000 }
    }
});
