/**
 * @file SendPaymentLinkCard.tsx
 * @description The "Send payment link" card on the partner detail page (HOS-411).
 *
 * Before HOS-411 the "Generar link" button called `mutateAsync()` with no
 * `try`/`catch` and nothing in the page read `sendLinkMutation.error`, so a
 * 422 from the two AC-11 gates (content not approved, no plan assigned) left
 * the admin staring at a button that visibly did nothing. This component:
 *
 * 1. Surfaces the mutation error via a toast (`onError`), instead of letting
 *    the promise rejection disappear.
 * 2. Disables the button up front with an inline reason when either gate
 *    would reject the request, so the admin does not have to click-and-fail
 *    to find out why.
 *
 * Extracted out of `$id.tsx` (a TanStack Router route file, hard to unit
 * test directly since it calls `Route.useParams()`) so the gate logic and
 * the error-toast wiring are testable without mounting the route.
 */
import type { Partner } from '@repo/schemas';
import type { useToast } from '@/components/ui/ToastProvider';
import type { useSendPartnerPaymentLinkMutation } from '@/features/partners/hooks/usePartnerQuery';
import { isApiError } from '@/lib/errors';

/**
 * Shown when the mutation fails without a recognizable `ApiError` (e.g. a
 * network failure) — the specific 422 reasons from the backend always carry
 * `error.message`, so this is the last-resort case only.
 */
const GENERIC_SEND_LINK_ERROR_MESSAGE = 'No pudimos generar el link de pago. Intentá de nuevo.';

/**
 * Computes why "Generar link" should be disabled, or `null` when the partner
 * is eligible.
 *
 * Mirrors two backend gates on purpose rather than importing them:
 * - `isPartnerContentApprovedForPayment` / `PARTNER_CONTENT_NOT_APPROVED_MESSAGE`
 *   (`packages/service-core/src/services/partner/partner.service.ts`) — reads
 *   `contentApprovedAt`, NOT `contentReviewState`. An already-published
 *   partner who edits their logo goes back to a `pending` review state while
 *   keeping the approval date they earned, so the button must stay enabled
 *   for them too.
 * - the `!partner.planId` check in the `send-link` route
 *   (`apps/api/src/routes/partners/admin/send-link.ts`).
 *
 * `@repo/service-core` is a backend-only package (DB access, etc.) not meant
 * to ship in the admin browser bundle — the rest of `apps/admin` follows the
 * same "mirror, don't import" convention for it (see
 * `PartnerMentionsSection.tsx` and `revalidation-shared.tsx`).
 *
 * @param partner - The partner to evaluate.
 * @returns A human-readable, already-Spanish reason, or `null` if eligible.
 */
export function getSendLinkDisabledReason(
    partner: Pick<Partner, 'contentApprovedAt' | 'planId'>
): string | null {
    if (partner.contentApprovedAt == null) {
        return 'El contenido del partner todavía no fue aprobado. Aprobá el contenido antes de generar un link de pago.';
    }
    if (!partner.planId) {
        return 'El partner no tiene un plan de facturación asignado. Asigná un plan antes de generar un link de pago.';
    }
    return null;
}

/**
 * Props for {@link SendPaymentLinkCard}.
 */
export interface SendPaymentLinkCardProps {
    /** The partner this card acts on. Only the two gated fields are required. */
    readonly partner: Pick<Partner, 'contentApprovedAt' | 'planId'>;
    /** The `useSendPartnerPaymentLinkMutation(id)` instance owned by the page. */
    readonly mutation: ReturnType<typeof useSendPartnerPaymentLinkMutation>;
    /** `addToast` from `useToast()`, passed down so this stays presentational. */
    readonly addToast: ReturnType<typeof useToast>['addToast'];
}

/**
 * Renders the "Enviar link de pago" card: the trigger button, its disabled
 * reason (when gated), the resulting payment URL on success, and an error
 * toast on failure.
 *
 * @param props - See {@link SendPaymentLinkCardProps}.
 * @returns The card element.
 */
export function SendPaymentLinkCard({ partner, mutation, addToast }: SendPaymentLinkCardProps) {
    const disabledReason = getSendLinkDisabledReason(partner);

    const handleClick = () => {
        mutation.mutate(undefined, {
            onError: (error) => {
                addToast({
                    message: isApiError(error) ? error.message : GENERIC_SEND_LINK_ERROR_MESSAGE,
                    variant: 'error'
                });
            }
        });
    };

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <h2 className="font-medium text-lg">Enviar link de pago</h2>
            <p className="text-muted-foreground text-sm">
                Genera un checkout real para el plan asignado al partner.
            </p>
            <button
                type="button"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                disabled={mutation.isPending || disabledReason != null}
                onClick={handleClick}
            >
                {mutation.isPending ? 'Generando...' : 'Generar link'}
            </button>
            {disabledReason ? <p className="text-destructive text-sm">{disabledReason}</p> : null}
            {mutation.data ? (
                <div className="space-y-2">
                    <span className="block font-medium text-sm">URL</span>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        readOnly
                        value={mutation.data.paymentUrl}
                    />
                </div>
            ) : null}
        </div>
    );
}
