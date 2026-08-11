/**
 * @file ModerationDecisionButtons.test.tsx
 * @description The two verdicts, and the third that must not exist
 * (HOS-376 T-055).
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-translations', () => ({
    useTranslations: () => ({
        t: (key: string) => key,
        tPlural: (key: string) => key
    })
}));

import { ModerationDecisionButtons } from '../ModerationDecisionButtons';

describe('ModerationDecisionButtons', () => {
    it('should offer approve and reject, and nothing else', () => {
        // PENDING is the state a row ARRIVES in, never a verdict. A third
        // button would let an item be parked back in the queue with no record
        // of who moved it or why — and the API refuses it anyway, so the button
        // would only produce a 400 a moderator cannot act on.
        render(
            <ModerationDecisionButtons
                currentState="PENDING"
                onDecide={vi.fn()}
                submitting={false}
            />
        );

        expect(screen.getAllByRole('button')).toHaveLength(2);
        expect(screen.queryByRole('button', { name: /pending/i })).not.toBeInTheDocument();
    });

    it('should carry a written reason with the verdict', async () => {
        const onDecide = vi.fn();
        render(
            <ModerationDecisionButtons
                currentState="PENDING"
                onDecide={onDecide}
                submitting={false}
            />
        );

        await userEvent.type(screen.getByRole('textbox'), 'Incluye un teléfono');
        await userEvent.click(
            screen.getByRole('button', { name: 'host-trades.moderation.actions.reject' })
        );

        expect(onDecide).toHaveBeenCalledWith({
            decision: 'REJECTED',
            reason: 'Incluye un teléfono'
        });
    });

    it('should send no reason rather than an empty one', async () => {
        // The reason is stored on the row and shown to its author. An empty
        // string is not a reason — it reads as one that was given and lost.
        const onDecide = vi.fn();
        render(
            <ModerationDecisionButtons
                currentState="PENDING"
                onDecide={onDecide}
                submitting={false}
            />
        );

        await userEvent.click(
            screen.getByRole('button', { name: 'host-trades.moderation.actions.approve' })
        );

        expect(onDecide).toHaveBeenCalledWith({ decision: 'APPROVED', reason: undefined });
    });

    it('should treat a whitespace-only reason as none', async () => {
        const onDecide = vi.fn();
        render(
            <ModerationDecisionButtons
                currentState="PENDING"
                onDecide={onDecide}
                submitting={false}
            />
        );

        await userEvent.type(screen.getByRole('textbox'), '   ');
        await userEvent.click(
            screen.getByRole('button', { name: 'host-trades.moderation.actions.approve' })
        );

        expect(onDecide).toHaveBeenCalledWith({ decision: 'APPROVED', reason: undefined });
    });

    it('should not offer the verdict the row already carries', () => {
        render(
            <ModerationDecisionButtons
                currentState="APPROVED"
                onDecide={vi.fn()}
                submitting={false}
            />
        );

        expect(
            screen.getByRole('button', { name: 'host-trades.moderation.actions.approve' })
        ).toBeDisabled();
        expect(
            screen.getByRole('button', { name: 'host-trades.moderation.actions.reject' })
        ).toBeEnabled();
    });

    it('should block both verdicts while one is in flight', () => {
        // Two clicks would record two decisions on the same row, and the second
        // would overwrite the first's author and timestamp.
        render(
            <ModerationDecisionButtons
                currentState="PENDING"
                onDecide={vi.fn()}
                submitting={true}
            />
        );

        for (const button of screen.getAllByRole('button')) {
            expect(button).toBeDisabled();
        }
    });
});
