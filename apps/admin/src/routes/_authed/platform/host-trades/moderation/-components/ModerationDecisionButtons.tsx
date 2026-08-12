/**
 * @file ModerationDecisionButtons.tsx
 * @description The two verdicts a moderator may record (HOS-376 T-055).
 *
 * Two buttons and a reason field, and there is no third button on purpose:
 * `PENDING` is the state a row ARRIVES in, never a verdict anyone applies.
 * Offering it would let an item be parked back in the queue with no record of
 * who moved it or why — which is the one thing the moderation columns exist to
 * prevent, and which the API rejects outright.
 *
 * The reason travels only when it says something. An empty string is not a
 * reason: stored and shown to the author, it reads as one that was given and
 * lost.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ModerationDecision } from '@/hooks/use-host-trade-moderation';
import { useTranslations } from '@/hooks/use-translations';

interface ModerationDecisionButtonsProps {
    /** Whether this row already carries the verdict. */
    readonly currentState: string;
    readonly submitting: boolean;
    readonly onDecide: (input: { decision: ModerationDecision; reason?: string }) => void;
}

/**
 * Renders the approve/reject controls for one moderation row.
 *
 * @param props - The row's current state, whether a decision is in flight, and
 * the callback that records one.
 * @returns The controls element.
 */
export function ModerationDecisionButtons({
    currentState,
    submitting,
    onDecide
}: ModerationDecisionButtonsProps) {
    const { t } = useTranslations();
    const [reason, setReason] = useState('');

    const trimmed = reason.trim();

    return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <input
                aria-label={t('host-trades.moderation.actions.reasonLabel')}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:w-72"
                disabled={submitting}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t('host-trades.moderation.actions.reasonPlaceholder')}
                type="text"
                value={reason}
            />
            <div className="flex gap-2">
                <Button
                    disabled={submitting || currentState === 'APPROVED'}
                    onClick={() =>
                        onDecide({
                            decision: 'APPROVED',
                            reason: trimmed === '' ? undefined : trimmed
                        })
                    }
                    size="sm"
                    variant="default"
                >
                    {t('host-trades.moderation.actions.approve')}
                </Button>
                <Button
                    disabled={submitting || currentState === 'REJECTED'}
                    onClick={() =>
                        onDecide({
                            decision: 'REJECTED',
                            reason: trimmed === '' ? undefined : trimmed
                        })
                    }
                    size="sm"
                    variant="destructive"
                >
                    {t('host-trades.moderation.actions.reject')}
                </Button>
            </div>
        </div>
    );
}
