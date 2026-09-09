/**
 * The admin's half of the partner payment review (HOS-1299).
 *
 * Renders NOTHING unless the `partner-payment-review` cron has actually asked
 * about this partner. The card is the question, so a card that showed up on
 * every partner would train the operator to ignore the one that matters.
 *
 * What it must never do is imply something already happened. When this is on
 * screen the partner is still published, still active, still on the carousel —
 * the system detected a gap and stopped there, because the owner's decision
 * (2026-09-09) is that cutting off somebody who paid is the expensive mistake
 * and a machine cannot tell "they did not pay" from "nobody wrote it down".
 *
 * @module routes/_authed/partners/-components/PaymentReviewCard
 */

import { type Partner, PartnerPaymentReviewStateEnum } from '@repo/schemas';
import type { UseMutationResult } from '@tanstack/react-query';
import { useState } from 'react';
import type { useToast } from '@/components/ui/ToastProvider';
import { formatCalendarShortDate } from '@/lib/format-helpers';

type ReviewBody = {
    readonly decision: 'confirmed-paid' | 'not-paid';
    readonly confirmedThrough?: string;
};

export interface PaymentReviewCardProps {
    readonly partner: Partner;
    readonly mutation: UseMutationResult<Partner, Error, ReviewBody>;
    /** `addToast` from `useToast()`, passed down so this stays presentational. */
    readonly addToast: ReturnType<typeof useToast>['addToast'];
}

/**
 * The confirm / do-not-confirm card for a flagged partner.
 *
 * @param props - See {@link PaymentReviewCardProps}.
 * @returns The card, or `null` when nothing was asked about this partner.
 */
export function PaymentReviewCard({ partner, mutation, addToast }: PaymentReviewCardProps) {
    const [confirmedThrough, setConfirmedThrough] = useState('');

    if (partner.paymentReviewState !== PartnerPaymentReviewStateEnum.PENDING_CONFIRMATION) {
        return null;
    }

    const coveredFrom = partner.paymentConfirmedThrough ?? partner.startsAt;

    const answer = async (decision: ReviewBody['decision']) => {
        await mutation.mutateAsync({
            decision,
            ...(decision === 'confirmed-paid' && confirmedThrough
                ? { confirmedThrough: new Date(confirmedThrough).toISOString() }
                : {})
        });
        addToast(
            decision === 'confirmed-paid'
                ? {
                      message: 'Pago confirmado. El aliado sigue publicado.',
                      variant: 'success'
                  }
                : {
                      message: 'Aliado dado de baja por falta de pago.',
                      variant: 'warning'
                  }
        );
    };

    return (
        <div className="space-y-3 rounded-lg border border-amber-400 bg-amber-50 p-4 md:col-span-2 dark:bg-amber-950/20">
            <h2 className="font-medium text-lg">No hay pago registrado para este aliado</h2>
            <p className="text-muted-foreground text-sm">
                {coveredFrom
                    ? `No registramos pagos desde el ${formatCalendarShortDate({ date: coveredFrom })}. `
                    : 'No registramos pagos para este aliado. '}
                Sigue activo y publicado: no cambiamos nada hasta que decidas.{' '}
                <strong>Si el pago entró y no quedó asentado, confirmalo acá.</strong>
            </p>

            <label
                className="block text-sm"
                htmlFor="payment-confirmed-through"
            >
                Cubierto hasta (opcional — por defecto, un mes desde hoy)
                <input
                    id="payment-confirmed-through"
                    type="date"
                    className="mt-1 block rounded-md border px-3 py-2"
                    value={confirmedThrough}
                    onChange={(event) => setConfirmedThrough(event.target.value)}
                />
            </label>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                    disabled={mutation.isPending}
                    onClick={() => answer('confirmed-paid')}
                >
                    {mutation.isPending ? 'Guardando...' : 'Está al día'}
                </button>
                <button
                    type="button"
                    className="rounded-md border border-destructive px-4 py-2 text-destructive disabled:opacity-50"
                    disabled={mutation.isPending}
                    onClick={() => answer('not-paid')}
                >
                    No pagó — darlo de baja
                </button>
            </div>
        </div>
    );
}
