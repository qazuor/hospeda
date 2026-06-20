/**
 * @file ai-post-generate-panel.state.ts
 * @description Reducer, state types, and action types for AiPostGeneratePanel (SPEC-223 T-009).
 *
 * Extracted from AiPostGeneratePanel.tsx to keep the component file under the
 * 500-line hard limit.
 */

import type { AiPostGenerateDraft, AiPostGenerateRequest } from '@repo/schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Possible UI phases of the AI post-generation panel. */
export type PanelStatus = 'idle' | 'generating' | 'draft-ready' | 'error';

/** Full state for the panel state machine. */
export interface PanelState {
    /** Current UI phase. */
    status: PanelStatus;
    /** Draft from a successful generation — only present in 'draft-ready'. */
    draft: AiPostGenerateDraft | null;
    /** Mapped error key (i18n suffix after `admin-pages.posts.aiGenerate.`). */
    errorKey: string | null;
    /** Inline validation errors for the panel form fields. */
    validationErrors: Partial<Record<keyof AiPostGenerateRequest, string>>;
    /** Currently entered topic text. */
    topic: string;
    /** Currently entered points list. */
    points: string[];
    /** Selected category (optional). */
    category: string;
    /** Selected tone. */
    tone: string;
    /** Selected locale. */
    locale: string;
}

/** All discriminated-union actions for the panel state machine. */
export type PanelAction =
    | { type: 'set_topic'; value: string }
    | { type: 'add_point' }
    | { type: 'update_point'; index: number; value: string }
    | { type: 'remove_point'; index: number }
    | { type: 'set_category'; value: string }
    | { type: 'set_tone'; value: string }
    | { type: 'set_locale'; value: string }
    | { type: 'validation_errors'; errors: Partial<Record<keyof AiPostGenerateRequest, string>> }
    | { type: 'generating' }
    | { type: 'draft_ready'; draft: AiPostGenerateDraft }
    | { type: 'error'; errorKey: string }
    | { type: 'discard' };

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

/** Default (reset) state for a freshly mounted panel. */
export const initialPanelState: PanelState = {
    status: 'idle',
    draft: null,
    errorKey: null,
    validationErrors: {},
    topic: '',
    points: [''],
    category: '',
    tone: 'neutral',
    locale: 'es'
};

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

/**
 * Pure reducer for the AI post-generation panel.
 *
 * @param state  - Current panel state.
 * @param action - Dispatched action.
 * @returns New panel state (immutable).
 */
export function panelReducer(state: PanelState, action: PanelAction): PanelState {
    switch (action.type) {
        case 'set_topic':
            return { ...state, topic: action.value };
        case 'add_point':
            if (state.points.length >= 10) return state;
            return { ...state, points: [...state.points, ''] };
        case 'update_point': {
            const updated = [...state.points];
            updated[action.index] = action.value;
            return { ...state, points: updated };
        }
        case 'remove_point': {
            if (state.points.length <= 1) return state;
            const filtered = state.points.filter((_, i) => i !== action.index);
            return { ...state, points: filtered };
        }
        case 'set_category':
            return { ...state, category: action.value };
        case 'set_tone':
            return { ...state, tone: action.value };
        case 'set_locale':
            return { ...state, locale: action.value };
        case 'validation_errors':
            return { ...state, validationErrors: action.errors, status: 'idle' };
        case 'generating':
            return {
                ...state,
                status: 'generating',
                errorKey: null,
                validationErrors: {},
                draft: null
            };
        case 'draft_ready':
            return { ...state, status: 'draft-ready', draft: action.draft, errorKey: null };
        case 'error':
            return { ...state, status: 'error', errorKey: action.errorKey, draft: null };
        case 'discard':
            return { ...state, status: 'idle', draft: null, errorKey: null };
        default:
            return state;
    }
}
