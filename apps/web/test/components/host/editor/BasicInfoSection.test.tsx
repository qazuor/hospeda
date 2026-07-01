/**
 * @file BasicInfoSection.test.tsx
 * @description Tests for the BasicInfoSection form component.
 *
 * Covers (SPEC-321 T-003):
 * - AI-improve trigger for `description` is not rendered when the user
 *   lacks the `ai_text_improve` entitlement, independent of
 *   `can_use_rich_description`.
 * - AI-improve trigger renders when entitled, and is disabled/enabled per
 *   `triggerDisabled` (mirrors whether `description` has content).
 * - Accepting a suggestion calls `onFieldChange('description', suggestion)`
 *   both when `description` renders as the plain textarea
 *   (`can_use_rich_description=false`) and as the TipTap `RichTextEditor`
 *   (`can_use_rich_description=true`) — proving the T-003 discovery that
 *   `onAccept` is identical regardless of rendering branch.
 * - All 4 combinations of {can_use_rich_description, ai_text_improve}
 *   render without crashing.
 */

import type { AiTextImprovePanelProps } from '@/components/host/editor/AiTextImprovePanel.client';
import { BasicInfoSection } from '@/components/host/editor/BasicInfoSection.client';
import type { BasicInfoSectionProps } from '@/components/host/editor/BasicInfoSection.client';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        t: (_key: string, fallback?: string) => fallback ?? _key,
        tPlural: (_key: string, _count: number, fallback?: string) => fallback ?? _key
    })
}));

vi.mock('@/components/host/editor/BasicInfoSection.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

vi.mock('@/components/host/editor/PlanEntitlementGate.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

/** Mutable entitlement flags controlled per test. */
let entitlements: { can_use_rich_description: boolean; ai_text_improve: boolean };

vi.mock('@/hooks/useMyEntitlements', () => ({
    useMyEntitlements: () => ({
        has: (key: string) => Boolean(entitlements[key as keyof typeof entitlements]),
        isLoading: false,
        error: null,
        limit: vi.fn(() => -1),
        plan: null
    })
}));

// Shallow mock of AiTextImprovePanel — its own behavior is covered by T-002's
// suite (AiTextImprovePanel.test.tsx). Here we only assert it receives the
// right props and that its `onAccept` wiring behaves correctly.
vi.mock('@/components/host/editor/AiTextImprovePanel.client', () => ({
    AiTextImprovePanel: (props: AiTextImprovePanelProps) => (
        <button
            type="button"
            data-testid={`ai-mock-trigger-${props.fieldType}`}
            disabled={props.triggerDisabled}
            onClick={() => props.onAccept('AI suggested text')}
        >
            Mejorar con IA ({props.fieldType})
        </button>
    )
}));

// Mock RichTextEditor's CSS module so the real TipTap component can mount
// without needing the actual stylesheet.
vi.mock('@/components/host/editor/RichTextEditor.module.css', () => ({
    default: new Proxy({}, { get: (_t, prop) => String(prop) })
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_DATA = {
    id: 'acc-1',
    name: 'Test Hotel',
    summary: 'Test summary for accommodation',
    description: 'Test description with content',
    type: 'HOTEL',
    destinationId: 'dest-1',
    latitude: null,
    longitude: null,
    maxGuests: 2,
    bedrooms: 1,
    bathrooms: 1,
    beds: 1,
    basePrice: 1000,
    currency: 'ARS',
    isAvailable: true,
    isFeatured: false,
    amenityIds: [],
    featureIds: [],
    phone: '',
    email: '',
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    linkedinUrl: '',
    tiktokUrl: '',
    youtubeUrl: ''
};

const MOCK_DESTINATIONS = [{ id: 'dest-1', name: 'Concepción del Uruguay' }];

const buildProps = (overrides: Partial<BasicInfoSectionProps> = {}): BasicInfoSectionProps => ({
    locale: 'es',
    data: MOCK_DATA,
    destinations: MOCK_DESTINATIONS,
    errors: {},
    onFieldChange: vi.fn(),
    ...overrides
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BasicInfoSection — AI text-improve (description field, SPEC-321 T-003)', () => {
    beforeEach(() => {
        entitlements = { can_use_rich_description: false, ai_text_improve: false };
    });

    it('does not render the AI-improve trigger when the user lacks ai_text_improve', () => {
        entitlements.ai_text_improve = false;
        render(<BasicInfoSection {...buildProps()} />);

        expect(screen.queryByTestId('ai-mock-trigger-description')).not.toBeInTheDocument();
    });

    it('renders the AI-improve trigger enabled when entitled and description has content', () => {
        entitlements.ai_text_improve = true;
        render(<BasicInfoSection {...buildProps()} />);

        const trigger = screen.getByTestId('ai-mock-trigger-description');
        expect(trigger).toBeInTheDocument();
        expect(trigger).not.toBeDisabled();
    });

    it('disables the AI-improve trigger when description is empty', () => {
        entitlements.ai_text_improve = true;
        render(<BasicInfoSection {...buildProps({ data: { ...MOCK_DATA, description: '' } })} />);

        expect(screen.getByTestId('ai-mock-trigger-description')).toBeDisabled();
    });

    it.each([
        [false, false],
        [false, true],
        [true, false],
        [true, true]
    ])(
        'renders without crashing for can_use_rich_description=%s, ai_text_improve=%s',
        (canUseRichDescription, aiTextImprove) => {
            entitlements = {
                can_use_rich_description: canUseRichDescription,
                ai_text_improve: aiTextImprove
            };

            expect(() => render(<BasicInfoSection {...buildProps()} />)).not.toThrow();
        }
    );

    it('calls onFieldChange("description", suggestion) on Accept when rendered as plain textarea', () => {
        entitlements = { can_use_rich_description: false, ai_text_improve: true };
        const onFieldChange = vi.fn();
        render(<BasicInfoSection {...buildProps({ onFieldChange })} />);

        // Confirm the plain textarea (not TipTap) is the active branch.
        expect(screen.getByLabelText(/descripción/i).tagName).toBe('TEXTAREA');

        fireEvent.click(screen.getByTestId('ai-mock-trigger-description'));

        expect(onFieldChange).toHaveBeenCalledWith('description', 'AI suggested text');
    });

    it('calls onFieldChange("description", suggestion) on Accept when rendered as TipTap RichTextEditor', () => {
        entitlements = { can_use_rich_description: true, ai_text_improve: true };
        const onFieldChange = vi.fn();
        render(<BasicInfoSection {...buildProps({ onFieldChange })} />);

        // Confirm the TipTap editor (not the plain textarea) is the active branch:
        // the plain `<textarea id="acc-description">` is absent, and the
        // TipTap editable region (`[contenteditable="true"]`) is present
        // instead. (Not using getByRole('textbox') here — the `name` field's
        // plain `<input type="text">` also has an implicit textbox role.)
        expect(document.getElementById('acc-description')).not.toBeInTheDocument();
        expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument();

        fireEvent.click(screen.getByTestId('ai-mock-trigger-description'));

        expect(onFieldChange).toHaveBeenCalledWith('description', 'AI suggested text');
    });

    it('does not call onFieldChange when the AI panel is not accepted', () => {
        entitlements = { can_use_rich_description: false, ai_text_improve: true };
        const onFieldChange = vi.fn();
        render(<BasicInfoSection {...buildProps({ onFieldChange })} />);

        // No interaction with the AI trigger — onFieldChange should not fire
        // from the AI-improve wiring path.
        expect(onFieldChange).not.toHaveBeenCalled();
    });
});
