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
 *
 * Covers (SPEC-321 T-004):
 * - AI-improve trigger for `summary` (plain textarea only, no rich-text
 *   branching) follows the same entitlement/enable/accept/discard contract
 *   as `description`.
 */

import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiTextImprovePanelProps } from '@/components/host/editor/AiTextImprovePanel.client';
import type { BasicInfoSectionProps } from '@/components/host/editor/BasicInfoSection.client';
import { BasicInfoSection } from '@/components/host/editor/BasicInfoSection.client';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('@/lib/i18n', () => ({
    createTranslations: (_locale: string) => ({
        // Interpolates `{{token}}` when params are supplied. Without this the
        // character counters below would read back the raw template and every
        // assertion on their text would be vacuous.
        t: (_key: string, fallback?: string, params?: Record<string, string>) => {
            const template = fallback ?? _key;
            if (!params) return template;
            return Object.entries(params).reduce(
                (acc, [token, value]) => acc.replaceAll(`{{${token}}}`, value),
                template
            );
        },
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
    slug: 'test-hotel',
    lifecycleState: 'DRAFT',
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
    ])('renders without crashing for can_use_rich_description=%s, ai_text_improve=%s', (canUseRichDescription, aiTextImprove) => {
        entitlements = {
            can_use_rich_description: canUseRichDescription,
            ai_text_improve: aiTextImprove
        };

        expect(() => render(<BasicInfoSection {...buildProps()} />)).not.toThrow();
    });

    it('calls onFieldChange("description", suggestion) on Accept when rendered as plain textarea', () => {
        entitlements = { can_use_rich_description: false, ai_text_improve: true };
        const onFieldChange = vi.fn();
        render(<BasicInfoSection {...buildProps({ onFieldChange })} />);

        // Confirm the plain textarea (not TipTap) is the active branch.
        expect(screen.getByLabelText(/^descripción$/i).tagName).toBe('TEXTAREA');

        fireEvent.click(screen.getByTestId('ai-mock-trigger-description'));

        expect(onFieldChange).toHaveBeenCalledWith('description', 'AI suggested text');
    });

    it('calls onFieldChange("description", suggestion) on Accept when rendered as TipTap RichTextEditor', () => {
        entitlements = { can_use_rich_description: true, ai_text_improve: true };
        const onFieldChange = vi.fn();
        render(<BasicInfoSection {...buildProps({ onFieldChange })} />);

        // Confirm the TipTap editor (not the plain textarea) is the active
        // branch. Since HOS-373 BOTH branches carry `id="acc-description"` —
        // the id names the FIELD so focus-on-error can reach it either way — so
        // asserting the id is absent no longer distinguishes them. Assert the
        // element's kind instead, which is what this test actually meant.
        // (Not using getByRole('textbox') here — the `name` field's plain
        // `<input type="text">` also has an implicit textbox role.)
        const descriptionField = document.getElementById('acc-description');
        expect(descriptionField).toBeInTheDocument();
        expect(descriptionField?.tagName).not.toBe('TEXTAREA');
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

describe('BasicInfoSection — summary label consistency (HOS-783 B6)', () => {
    it('should label the summary field as short description', () => {
        render(<BasicInfoSection {...buildProps()} />);

        expect(screen.getByLabelText(/descripción corta/i)).toBeInTheDocument();
        expect(screen.queryByLabelText(/^resumen\b/i)).not.toBeInTheDocument();
    });
});

describe('BasicInfoSection — published slug refresh choice (HOS-784 stage 2)', () => {
    it('renders the warning and checkbox when the published-rename choice is offered', () => {
        render(
            <BasicInfoSection
                {...buildProps()}
                shouldOfferSlugRefresh={true}
                refreshSlugFromName={false}
                onRefreshSlugFromNameChange={vi.fn()}
            />
        );

        expect(screen.getByText(/tu ficha ya está publicada/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/cambiar igual la dirección pública/i)).toBeInTheDocument();
    });

    it('forwards the checkbox toggle through onRefreshSlugFromNameChange', () => {
        const onRefreshSlugFromNameChange = vi.fn();
        render(
            <BasicInfoSection
                {...buildProps()}
                shouldOfferSlugRefresh={true}
                refreshSlugFromName={false}
                onRefreshSlugFromNameChange={onRefreshSlugFromNameChange}
            />
        );

        fireEvent.click(screen.getByLabelText(/cambiar igual la dirección pública/i));

        expect(onRefreshSlugFromNameChange).toHaveBeenCalledWith(true);
    });
});

describe('BasicInfoSection — AI text-improve (summary field, SPEC-321 T-004)', () => {
    beforeEach(() => {
        entitlements = { can_use_rich_description: false, ai_text_improve: false };
    });

    it('does not render the AI-improve trigger when the user lacks ai_text_improve', () => {
        entitlements.ai_text_improve = false;
        render(<BasicInfoSection {...buildProps()} />);

        expect(screen.queryByTestId('ai-mock-trigger-summary')).not.toBeInTheDocument();
    });

    it('renders the AI-improve trigger enabled when entitled and summary has content', () => {
        entitlements.ai_text_improve = true;
        render(<BasicInfoSection {...buildProps()} />);

        const trigger = screen.getByTestId('ai-mock-trigger-summary');
        expect(trigger).toBeInTheDocument();
        expect(trigger).not.toBeDisabled();
    });

    it('disables the AI-improve trigger when summary is empty', () => {
        entitlements.ai_text_improve = true;
        render(<BasicInfoSection {...buildProps({ data: { ...MOCK_DATA, summary: '' } })} />);

        expect(screen.getByTestId('ai-mock-trigger-summary')).toBeDisabled();
    });

    it('calls onFieldChange("summary", suggestion) on Accept', () => {
        entitlements = { can_use_rich_description: false, ai_text_improve: true };
        const onFieldChange = vi.fn();
        render(<BasicInfoSection {...buildProps({ onFieldChange })} />);

        fireEvent.click(screen.getByTestId('ai-mock-trigger-summary'));

        expect(onFieldChange).toHaveBeenCalledWith('summary', 'AI suggested text');
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

// ---------------------------------------------------------------------------
// HOS-783 B5 — character counters
// ---------------------------------------------------------------------------

/**
 * These three fields are the SAME three the publish mini form edits. B5 first
 * shipped on the mini form only, so a host saw `47/100` while creating and
 * nothing at all while editing. The counters are asserted here per field AND
 * per severity, because the amber/red states are the half of B5 that a
 * presence-only check would let regress silently.
 */
describe('BasicInfoSection — character counters (HOS-783 B5)', () => {
    beforeEach(() => {
        entitlements = { can_use_rich_description: false, ai_text_improve: false };
    });

    it.each([
        ['name-char-counter', 'Test Hotel'.length, 3, 100, 'normal'],
        ['summary-char-counter', 'Test summary for accommodation'.length, 10, 300, 'normal'],
        [
            'description-char-counter',
            'Test description with content'.length,
            30,
            2000,
            'under-minimum'
        ]
    ])('renders %s with its range', (testId, used, min, max, state) => {
        render(<BasicInfoSection {...buildProps()} />);

        expect(screen.getByTestId(testId)).toHaveTextContent(`${used}/${max} · mín. ${min}`);
        expect(screen.getByTestId(testId)).toHaveAttribute('data-state', state);
    });

    it('turns amber once the name is within 20% of its limit', () => {
        render(
            <BasicInfoSection {...buildProps({ data: { ...MOCK_DATA, name: 'x'.repeat(80) } })} />
        );

        expect(screen.getByTestId('name-char-counter')).toHaveTextContent('80/100 · mín. 3');
        expect(screen.getByTestId('name-char-counter')).toHaveAttribute('data-state', 'warning');
    });

    it('turns red once the summary reaches its limit', () => {
        render(
            <BasicInfoSection
                {...buildProps({ data: { ...MOCK_DATA, summary: 'x'.repeat(300) } })}
            />
        );

        expect(screen.getByTestId('summary-char-counter')).toHaveTextContent('300/300 · mín. 10');
        expect(screen.getByTestId('summary-char-counter')).toHaveAttribute('data-state', 'danger');
    });

    it('turns red once the description reaches its limit', () => {
        render(
            <BasicInfoSection
                {...buildProps({ data: { ...MOCK_DATA, description: 'x'.repeat(2000) } })}
            />
        );

        expect(screen.getByTestId('description-char-counter')).toHaveTextContent(
            '2000/2000 · mín. 30'
        );
        expect(screen.getByTestId('description-char-counter')).toHaveAttribute(
            'data-state',
            'danger'
        );
    });

    // The description counter sits below the entitlement gate because both
    // branches edit the same `data.description` — the rich-text owner must not
    // lose it.
    it('keeps the description counter on the rich-text branch', () => {
        entitlements = { can_use_rich_description: true, ai_text_improve: false };

        render(<BasicInfoSection {...buildProps()} />);

        expect(screen.getByTestId('description-char-counter')).toBeInTheDocument();
    });

    it('points each field at its counter through aria-describedby', () => {
        render(<BasicInfoSection {...buildProps()} />);

        const name = screen.getByLabelText(/^nombre/i);
        expect(name.getAttribute('aria-describedby')).toContain(
            screen.getByTestId('name-char-counter').id
        );
    });
});

/**
 * HOS-800. The plan notice for rich text used to render BELOW the textarea, as
 * a plain `.fieldHint`, one element away from the AI-improve trigger — so a
 * restriction and an available action sat adjacent, in the same muted grey,
 * both opening with the same verb. The product owner read his own screen and
 * concluded the AI feature was plan-gated while actively using it.
 *
 * These assert the structural half of the fix (the copy half is held by the
 * i18n inline-fallback guard): the notice occupies the slot where the rich
 * editor's formatting toolbar would be, and it is not typographically a hint.
 */
describe('BasicInfoSection — rich-text plan notice placement (HOS-800)', () => {
    beforeEach(() => {
        entitlements = { can_use_rich_description: false, ai_text_improve: true };
    });

    /** The notice element, located by the id the textarea points at. */
    const getFormatNotice = (): HTMLElement => {
        const textarea = screen.getByLabelText(/^descripción$/i);
        const noticeId = (textarea.getAttribute('aria-describedby') ?? '')
            .split(' ')
            .find((id) => id.endsWith('-format-upsell'));

        expect(noticeId).toBeDefined();
        const notice = document.getElementById(noticeId as string);
        expect(notice).not.toBeNull();

        return notice as HTMLElement;
    };

    it('renders the plan notice, then the textarea, then the AI trigger — in that order', () => {
        render(<BasicInfoSection {...buildProps()} />);

        const labelled: ReadonlyArray<readonly [string, HTMLElement]> = [
            ['notice', getFormatNotice()],
            ['textarea', screen.getByLabelText(/^descripción$/i)],
            ['ai-trigger', screen.getByTestId('ai-mock-trigger-description')]
        ];

        // Sorting by document position and comparing the WHOLE sequence is what
        // makes this bite. Asserting "notice precedes trigger" on its own was
        // already true of the buggy layout (notice → counter → trigger); only
        // the textarea landing BETWEEN them distinguishes the two.
        const domOrder = [...labelled]
            .sort(([, a], [, b]) =>
                a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
            )
            .map(([name]) => name);

        expect(domOrder).toEqual(['notice', 'textarea', 'ai-trigger']);
    });

    it('styles the plan notice as a restriction, not as an ordinary field hint', () => {
        render(<BasicInfoSection {...buildProps()} />);

        // The CSS module is proxied to identity, so the class name IS the key.
        const notice = getFormatNotice();
        const box = notice.parentElement;

        expect(box).not.toBeNull();
        expect(box).toHaveClass('formatUpsell');
        expect(notice).not.toHaveClass('fieldHint');
    });

    it('describes the textarea with the plan notice as well as the counter', () => {
        render(<BasicInfoSection {...buildProps()} />);

        const textarea = screen.getByLabelText(/^descripción$/i);
        const described = (textarea.getAttribute('aria-describedby') ?? '').split(' ');

        expect(described).toContain(getFormatNotice().id);
        expect(described).toContain(screen.getByTestId('description-char-counter').id);
    });

    it('drops the plan notice entirely once rich text is entitled', () => {
        entitlements = { can_use_rich_description: true, ai_text_improve: true };

        render(<BasicInfoSection {...buildProps()} />);

        expect(document.querySelector('[id$="-format-upsell"]')).toBeNull();
    });
});
