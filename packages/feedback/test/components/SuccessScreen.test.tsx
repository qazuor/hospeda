/**
 * Tests for the SuccessScreen component.
 *
 * Uses @testing-library/react to render the component and verify all branches:
 * - linearIssueId present with URL (lines 47-57): renders an anchor link
 * - linearIssueId present without URL (lines 58-60): renders plain bold text
 * - linearIssueId absent (lines 62-63): renders fallback message
 * - onClose provided (lines 76-80): renders close button
 * - onClose absent: close button not rendered
 *
 * The existing test file was named SuccessScreen.test.tsx but the task
 * references "FeedbackSuccessScreen" — the actual component file is
 * src/components/SuccessScreen.tsx. This file covers all its branches.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SuccessScreen } from '../../src/components/SuccessScreen.js';
import { FEEDBACK_STRINGS } from '../../src/config/strings.js';

// ---------------------------------------------------------------------------
// Minimal props factory
// ---------------------------------------------------------------------------

const makeProps = (overrides: Partial<Parameters<typeof SuccessScreen>[0]> = {}) => ({
    onReset: vi.fn(),
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests: always-rendered content
// ---------------------------------------------------------------------------

describe('SuccessScreen — always-rendered content', () => {
    it('should render the success title', () => {
        render(<SuccessScreen {...makeProps()} />);
        expect(screen.getByText(FEEDBACK_STRINGS.success.title)).toBeInTheDocument();
    });

    it('should render the success message', () => {
        render(<SuccessScreen {...makeProps()} />);
        expect(screen.getByText(FEEDBACK_STRINGS.success.message)).toBeInTheDocument();
    });

    it('should render the thanks message', () => {
        render(<SuccessScreen {...makeProps()} />);
        expect(screen.getByText(FEEDBACK_STRINGS.success.thanks)).toBeInTheDocument();
    });

    it('should render the checkmark character', () => {
        render(<SuccessScreen {...makeProps()} />);
        // &#10003; = ✓
        expect(screen.getByText('✓')).toBeInTheDocument();
    });

    it('should render the "submit another" button', () => {
        render(<SuccessScreen {...makeProps()} />);
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submitAnother })
        ).toBeInTheDocument();
    });

    it('should call onReset when "submit another" button is clicked', () => {
        const onReset = vi.fn();
        render(<SuccessScreen onReset={onReset} />);

        fireEvent.click(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submitAnother })
        );

        expect(onReset).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Tests: linearIssueId with URL (lines 47-57)
// ---------------------------------------------------------------------------

describe('SuccessScreen — linearIssueId with URL', () => {
    it('should render an anchor link with the correct href', () => {
        render(
            <SuccessScreen
                {...makeProps({
                    linearIssueId: 'HOS-42',
                    linearIssueUrl: 'https://linear.app/hospeda/issue/HOS-42'
                })}
            />
        );

        const link = screen.getByRole('link', { name: /HOS-42/ });
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', 'https://linear.app/hospeda/issue/HOS-42');
    });

    it('should render the anchor with target="_blank" and rel="noopener noreferrer"', () => {
        render(
            <SuccessScreen
                {...makeProps({
                    linearIssueId: 'HOS-42',
                    linearIssueUrl: 'https://linear.app/hospeda/issue/HOS-42'
                })}
            />
        );

        const link = screen.getByRole('link', { name: /HOS-42/ });
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should render the issue ID as bold text inside the link', () => {
        render(
            <SuccessScreen
                {...makeProps({
                    linearIssueId: 'HOS-99',
                    linearIssueUrl: 'https://linear.app/hospeda/issue/HOS-99'
                })}
            />
        );

        expect(screen.getByText('HOS-99')).toBeInTheDocument();
    });

    it('should render the issue label prefix text', () => {
        render(
            <SuccessScreen
                {...makeProps({
                    linearIssueId: 'HOS-1',
                    linearIssueUrl: 'https://linear.app/hospeda/issue/HOS-1'
                })}
            />
        );

        expect(
            screen.getByText((content) => content.includes(FEEDBACK_STRINGS.success.issueLabel))
        ).toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: linearIssueId WITHOUT URL (lines 58-60)
// ---------------------------------------------------------------------------

describe('SuccessScreen — linearIssueId without URL', () => {
    it('should render the issue ID as plain bold text (no anchor)', () => {
        render(<SuccessScreen {...makeProps({ linearIssueId: 'HOS-55' })} />);

        expect(screen.getByText('HOS-55')).toBeInTheDocument();
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: no linearIssueId — fallback message (lines 62-63)
// ---------------------------------------------------------------------------

describe('SuccessScreen — no linearIssueId', () => {
    it('should render the fallback message when linearIssueId is undefined', () => {
        render(<SuccessScreen {...makeProps()} />);

        expect(screen.getByText(FEEDBACK_STRINGS.success.fallbackMessage)).toBeInTheDocument();
    });

    it('should NOT render an anchor link when linearIssueId is absent', () => {
        render(<SuccessScreen {...makeProps()} />);
        expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: onClose button (lines 76-80)
// ---------------------------------------------------------------------------

describe('SuccessScreen — onClose prop', () => {
    it('should render a close button when onClose is provided', () => {
        const onClose = vi.fn();
        render(<SuccessScreen {...makeProps({ onClose })} />);

        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.close })
        ).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', () => {
        const onClose = vi.fn();
        render(<SuccessScreen {...makeProps({ onClose })} />);

        fireEvent.click(screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.close }));

        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should NOT render a close button when onClose is not provided', () => {
        render(<SuccessScreen {...makeProps()} />);

        expect(
            screen.queryByRole('button', { name: FEEDBACK_STRINGS.buttons.close })
        ).not.toBeInTheDocument();
    });
});

// ---------------------------------------------------------------------------
// Tests: both linearIssueId + onClose together
// ---------------------------------------------------------------------------

describe('SuccessScreen — full render with all props', () => {
    it('should render all optional elements together', () => {
        const onReset = vi.fn();
        const onClose = vi.fn();

        render(
            <SuccessScreen
                linearIssueId="HOS-100"
                linearIssueUrl="https://linear.app/hospeda/issue/HOS-100"
                onReset={onReset}
                onClose={onClose}
            />
        );

        expect(screen.getByRole('link', { name: /HOS-100/ })).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.submitAnother })
        ).toBeInTheDocument();
        expect(
            screen.getByRole('button', { name: FEEDBACK_STRINGS.buttons.close })
        ).toBeInTheDocument();
    });
});
