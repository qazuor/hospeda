/**
 * @file AiTextImproveFieldAddon.tsx
 * @description Bridge component that mounts the AiTextImprovePanel as a sibling
 * of a form field inside EntityFormSection (SPEC-198 T-010).
 *
 * This component is rendered via the `fieldAddons` prop on EntityFormSection.
 * It uses `useEntityFormContext()` to read the current field value and write
 * the accepted suggestion back to the form state.
 *
 * For RichTextField (description), the existing `useEffect` sync in
 * RichTextField.tsx (line 165-171) picks up the value change and calls
 * `editor.commands.setContent(value, false)` to update the TipTap editor.
 *
 * For TextareaField (summary), the textarea reflects the new value directly
 * via the controlled `value` prop.
 *
 * This component does NOT modify BaseCrudService or forward `_aiMeta` to the
 * update API (AC-12 SHOULD-only: client-side audit hint via `onAiAssisted`).
 */
import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import type { AiTextImproveFieldType } from '@repo/schemas';
import { useCallback } from 'react';
import { AiTextImprovePanel } from './AiTextImprovePanel';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link AiTextImproveFieldAddon}. */
export interface AiTextImproveFieldAddonProps {
    /** The form field ID (e.g. 'description' or 'summary'). */
    readonly fieldId: string;
    /** Which AI text-improve field type to send to the API. */
    readonly fieldType: AiTextImproveFieldType;
    /** Whether the current user's plan includes the AI text-improve entitlement. */
    readonly canUse: boolean;
    /** Locale for the AI suggestion ('es' | 'en' | 'pt'). Defaults to 'es'. */
    readonly locale?: string;
    /** Called when the HOST accepts a suggestion — for client-side audit tracking. */
    readonly onAiAssisted?: (fieldId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Bridge component that connects the AiTextImprovePanel to the entity form
 * context. Rendered as a field addon inside EntityFormSection.
 *
 * Reads the current field value from form state and writes the accepted
 * suggestion back via `setFieldValue`.
 */
export function AiTextImproveFieldAddon({
    fieldId,
    fieldType,
    canUse,
    locale = 'es',
    onAiAssisted
}: AiTextImproveFieldAddonProps) {
    const { values, setFieldValue } = useEntityFormContext();

    // Read the current field value from form state.
    // For flat keys (no dots), this is a direct lookup.
    const fieldValue = (values[fieldId] as string | undefined) ?? '';

    const handleAccept = useCallback(
        (suggestion: string) => {
            setFieldValue(fieldId, suggestion);
            onAiAssisted?.(fieldId);
        },
        [fieldId, setFieldValue, onAiAssisted]
    );

    return (
        <AiTextImprovePanel
            fieldType={fieldType}
            fieldValue={fieldValue}
            locale={locale}
            onAccept={handleAccept}
            canUse={canUse}
        />
    );
}
