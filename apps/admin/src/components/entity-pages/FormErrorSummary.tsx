import { useTranslations } from '@repo/i18n';
import { AlertCircleIcon } from '@repo/icons';
import type { SectionConfig } from '@/components/entity-form/types/section-config.types';
import { buildFormErrorSummaryEntries } from './utils/form-error-summary';

/**
 * Props for {@link FormErrorSummary}.
 */
export interface FormErrorSummaryProps {
    /** Field path → message map, as produced by `parseApiValidationErrors`. */
    readonly errors: Record<string, string | undefined>;
    /** Sections currently rendered, used to resolve labels and ordering. */
    readonly sections?: readonly SectionConfig[];
    /** Extra classes for the wrapper. */
    readonly className?: string;
}

/**
 * Form-level list of every validation error, rendered above the form.
 *
 * Fixes H-28 (smoke agosto 2026): when the failing field had no error slot —
 * a rich-text editor, a select, or a field this form does not even render —
 * the message was mapped and then dropped, so the save button looked inert.
 * A user who sees nothing concludes the panel is broken; that is strictly
 * worse than an ugly message.
 *
 * Renders nothing when there are no errors, so it costs nothing on the happy
 * path. It is a live region (`role="alert"`) so screen readers announce the
 * failure as soon as the response lands.
 */
export function FormErrorSummary({ errors, sections = [], className }: FormErrorSummaryProps) {
    const { t } = useTranslations();
    const entries = buildFormErrorSummaryEntries({ errors, sections });

    if (entries.length === 0) {
        return null;
    }

    return (
        <div
            role="alert"
            aria-live="assertive"
            data-testid="form-error-summary"
            className={`rounded-md border border-destructive/50 bg-destructive/10 p-4 ${className ?? ''}`}
        >
            <div className="flex items-center gap-2 font-medium text-destructive text-sm">
                <AlertCircleIcon className="h-4 w-4 shrink-0" />
                <span>{t('error.form.error-summary-title')}</span>
            </div>

            <ul className="mt-2 list-disc space-y-1 pl-9 text-destructive text-sm">
                {entries.map((entry) => (
                    <li key={entry.field}>
                        <span className="font-medium">{entry.label}</span>
                        {': '}
                        <span>{entry.message}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}
