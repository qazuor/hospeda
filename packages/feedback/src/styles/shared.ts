/**
 * @repo/feedback - Shared inline style definitions.
 *
 * Centralizes commonly-used inline styles so they are defined once and
 * imported by FeedbackForm, StepBasic, StepDetails, and other components.
 *
 * Only styles that appear in two or more components belong here.
 * Component-specific styles (e.g. success screen, error boundary card)
 * remain local to their file.
 */

// -- Form field styles --------------------------------------------------------

/** Standard `<label>` style for form fields. */
export const labelStyle = {
    display: 'block',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '4px'
} as const;

/**
 * Base `<input>` style. Does not include error state.
 * Merge with `inputErrorStyle` when validation fails.
 */
export const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    boxSizing: 'border-box' as const
} as const;

/** Override applied to inputs in error state. */
export const inputErrorStyle = {
    borderColor: '#ef4444'
} as const;

/** Inline validation error message. */
export const errorTextStyle = {
    fontSize: '12px',
    color: '#ef4444',
    marginTop: '2px'
} as const;

/**
 * Base `<textarea>` style without min-height (varies per usage).
 * Consumers should spread this and add `minHeight` as needed.
 */
export const textareaBaseStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    resize: 'vertical' as const,
    boxSizing: 'border-box' as const
} as const;

/** Standard `<select>` style. */
export const selectStyle = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '14px',
    backgroundColor: '#fff',
    boxSizing: 'border-box' as const
} as const;

// -- Layout styles ------------------------------------------------------------

/** Vertical spacing between form field groups. */
export const fieldGroupStyle = {
    marginBottom: '16px'
} as const;

/** Horizontal button row with space-between layout (step navigation). */
export const buttonRowStyle = {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginTop: '20px'
} as const;

// -- Button styles ------------------------------------------------------------

/** Primary action button (solid blue). */
export const buttonPrimaryStyle = {
    padding: '8px 20px',
    backgroundColor: '#2563eb',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer'
} as const;

/** Disabled variant of the primary button. */
export const buttonPrimaryDisabledStyle = {
    padding: '8px 20px',
    backgroundColor: '#93c5fd',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'not-allowed'
} as const;

/** Secondary action button (outlined blue). */
export const buttonSecondaryStyle = {
    padding: '8px 20px',
    backgroundColor: 'transparent',
    color: '#2563eb',
    border: '1px solid #2563eb',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer'
} as const;

/** Disabled variant of the secondary button. */
export const buttonSecondaryDisabledStyle = {
    padding: '8px 20px',
    backgroundColor: 'transparent',
    color: '#93c5fd',
    border: '1px solid #93c5fd',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'not-allowed'
} as const;
