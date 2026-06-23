/**
 * ImportFromUrlSection — admin accommodation form section.
 *
 * Renders a URL input + legal-confirmation checkbox + "Importar" button.
 * On success it prefills `name`, `summary`, and `type` in the entity form
 * context WITHOUT saving. Each prefilled field shows a confidence badge.
 *
 * Integration notes:
 * - Uses `useEntityFormContext().setFieldValue` to mark fields dirty.
 * - Fires `POST /api/v1/protected/accommodations/import-from-url` via
 *   `useAccommodationImportMutation`.
 * - Validates with `AccommodationImportRequestSchema` before the network call.
 * - NEVER submits/saves the form.
 *
 * @module ImportFromUrlSection
 */

import { useEntityFormContext } from '@/components/entity-form/context/EntityFormContext';
import { useTranslations } from '@/hooks/use-translations';
import { AlertCircleIcon, ImportIcon, InfoIcon, LoaderIcon } from '@repo/icons';
import { AccommodationImportRequestSchema } from '@repo/schemas';
import { useState } from 'react';
import { useAccommodationImportMutation } from '../hooks/useAccommodationImportMutation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Per-field metadata stored after a successful import. */
interface FieldMeta {
    readonly confidence: number;
    readonly source: string;
}

/** Local state tracking which fields were prefilled and their metadata. */
type ImportedFieldsMap = Partial<Record<'name' | 'summary' | 'type', FieldMeta>>;

// ---------------------------------------------------------------------------
// Sub-component: ConfidenceBadge
// ---------------------------------------------------------------------------

interface ConfidenceBadgeProps {
    readonly fieldKey: 'name' | 'summary' | 'type';
    readonly importedFields: ImportedFieldsMap;
    readonly t: ReturnType<typeof useTranslations>['t'];
}

/**
 * Renders a muted pill showing "Importado · 90% · jsonld" when the given
 * field was prefilled by the importer. Returns null when the field was not
 * imported this session.
 */
function ConfidenceBadge({ fieldKey, importedFields, t }: ConfidenceBadgeProps) {
    const meta = importedFields[fieldKey];
    if (!meta) return null;

    const separator = t('host.importFromUrl.prefill.badge.separator' as Parameters<typeof t>[0]);
    const imported = t('host.importFromUrl.prefill.badge.imported' as Parameters<typeof t>[0]);
    const confidenceLabel = t(
        'host.importFromUrl.prefill.badge.confidence' as Parameters<typeof t>[0],
        { confidence: meta.confidence } as Record<string, unknown>
    );

    return (
        <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
            <span>{imported}</span>
            <span aria-hidden="true">{separator}</span>
            <span data-testid={`confidence-value-${fieldKey}`}>{confidenceLabel}</span>
            <span aria-hidden="true">{separator}</span>
            <span>{meta.source}</span>
        </span>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Self-contained section component for importing accommodation data from a URL.
 * Injected into the consolidated form via `customRender` — no props needed.
 */
export function ImportFromUrlSection() {
    const { t } = useTranslations();
    const { setFieldValue } = useEntityFormContext();
    const mutation = useAccommodationImportMutation();

    // Local state
    const [url, setUrl] = useState('');
    const [legalChecked, setLegalChecked] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [importedFields, setImportedFields] = useState<ImportedFieldsMap>({});
    const [reviewNotice, setReviewNotice] = useState(false);
    const [serverMessage, setServerMessage] = useState<string | null>(null);
    const [destinationHintText, setDestinationHintText] = useState<string | null>(null);
    /** Machine-readable failure message from a 200 response that carries failureCode (SPEC-258 C.1). */
    const [failureError, setFailureError] = useState<string | null>(null);

    // Derived
    const isDisabled = !legalChecked || mutation.isPending;

    const handleImport = async () => {
        setValidationError(null);
        setServerMessage(null);
        setDestinationHintText(null);
        setFailureError(null);

        const parseResult = AccommodationImportRequestSchema.safeParse({
            url: url.trim(),
            legalConfirmed: true as const
        });

        if (!parseResult.success) {
            const issue = parseResult.error.issues[0];
            if (issue?.path[0] === 'url') {
                const msg =
                    url.trim() === ''
                        ? t('host.importFromUrl.errors.urlRequired' as Parameters<typeof t>[0])
                        : t('host.importFromUrl.errors.urlInvalid' as Parameters<typeof t>[0]);
                setValidationError(msg);
            } else {
                setValidationError(
                    t('host.importFromUrl.errors.urlInvalid' as Parameters<typeof t>[0])
                );
            }
            return;
        }

        try {
            const response = await mutation.mutateAsync({
                url: parseResult.data.url,
                legalConfirmed: true
            });

            // Branch 2: 200 response with a machine-readable failureCode — render as error,
            // do NOT prefill the form (SPEC-258 C.1).
            if (response.failureCode) {
                const camelKey = response.failureCode.replace(/_([a-z])/g, (_, letter: string) =>
                    letter.toUpperCase()
                );
                setFailureError(
                    t(`host.importFromUrl.errors.failure.${camelKey}` as Parameters<typeof t>[0])
                );
                return;
            }

            // Prefill form fields from draft
            const newImportedFields: ImportedFieldsMap = {};

            if (typeof response.draft.name?.value === 'string') {
                setFieldValue('name', response.draft.name.value);
                newImportedFields.name = {
                    confidence: response.draft.name.confidence,
                    source: response.draft.name.source
                };
            }

            if (typeof response.draft.summary?.value === 'string') {
                setFieldValue('summary', response.draft.summary.value);
                newImportedFields.summary = {
                    confidence: response.draft.summary.confidence,
                    source: response.draft.summary.source
                };
            }

            if (typeof response.draft.type?.value === 'string') {
                setFieldValue('type', response.draft.type.value);
                newImportedFields.type = {
                    confidence: response.draft.type.confidence,
                    source: response.draft.type.source
                };
            }

            setImportedFields(newImportedFields);
            setReviewNotice(true);

            // Surface optional server message (e.g. AI-quota degraded notice)
            if (response.message) {
                setServerMessage(response.message);
            }

            // Advisory destination hint — never sets any form field
            if (response.destinationHint) {
                const hint = response.destinationHint;
                const parts: string[] = [];
                if (hint.scrapedLocality) {
                    parts.push(
                        t(
                            'host.importFromUrl.prefill.destinationHint.locality' as Parameters<
                                typeof t
                            >[0],
                            { locality: hint.scrapedLocality } as Record<string, unknown>
                        )
                    );
                }
                if (hint.candidates.length > 0) {
                    parts.push(
                        t(
                            'host.importFromUrl.prefill.destinationHint.candidates' as Parameters<
                                typeof t
                            >[0],
                            {
                                names: hint.candidates.map((c) => c.name).join(', ')
                            } as Record<string, unknown>
                        )
                    );
                }
                if (parts.length > 0) {
                    setDestinationHintText(parts.join(' '));
                }
            }
        } catch {
            // Error is already surfaced by mutation.error below
        }
    };

    return (
        <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
            {/* URL input */}
            <div className="space-y-1.5">
                <label
                    htmlFor="import-url"
                    className="font-medium text-sm"
                >
                    {t('host.importFromUrl.fields.url' as Parameters<typeof t>[0])}
                </label>
                <input
                    id="import-url"
                    type="url"
                    value={url}
                    onChange={(e) => {
                        setUrl(e.target.value);
                        if (validationError) setValidationError(null);
                    }}
                    placeholder={t(
                        'host.importFromUrl.fields.urlPlaceholder' as Parameters<typeof t>[0]
                    )}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    aria-describedby={validationError ? 'import-url-error' : undefined}
                    aria-invalid={validationError ? 'true' : undefined}
                />
                {validationError && (
                    <p
                        id="import-url-error"
                        role="alert"
                        className="flex items-center gap-1 text-destructive text-xs"
                    >
                        <AlertCircleIcon className="h-3.5 w-3.5 shrink-0" />
                        {validationError}
                    </p>
                )}
            </div>

            {/* Legal confirmation checkbox */}
            <div className="flex items-start gap-2">
                <input
                    id="import-legal"
                    type="checkbox"
                    checked={legalChecked}
                    onChange={(e) => setLegalChecked(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-input"
                    aria-required="true"
                />
                <label
                    htmlFor="import-legal"
                    className="cursor-pointer text-muted-foreground text-sm leading-snug"
                >
                    {t('host.importFromUrl.fields.legalConfirm' as Parameters<typeof t>[0])}
                </label>
            </div>

            {/* Import button */}
            <button
                type="button"
                onClick={handleImport}
                disabled={isDisabled}
                data-testid="import-submit-btn"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            >
                {mutation.isPending ? (
                    <>
                        <LoaderIcon className="h-4 w-4 animate-spin" />
                        {t('host.importFromUrl.actions.submitting' as Parameters<typeof t>[0])}
                    </>
                ) : (
                    <>
                        <ImportIcon className="h-4 w-4" />
                        {t('host.importFromUrl.actions.submit' as Parameters<typeof t>[0])}
                    </>
                )}
            </button>

            {/* Network / server error */}
            {mutation.error && (
                <p
                    role="alert"
                    className="flex items-center gap-1 text-destructive text-sm"
                >
                    <AlertCircleIcon className="h-4 w-4 shrink-0" />
                    {t('host.importFromUrl.errors.submit' as Parameters<typeof t>[0])}
                </p>
            )}

            {/* Failure code error: 200 response that carries a machine-readable failure cause (SPEC-258 C.1) */}
            {failureError && (
                <p
                    data-testid="import-failure-error"
                    role="alert"
                    className="flex items-center gap-1 text-destructive text-sm"
                >
                    <AlertCircleIcon className="h-4 w-4 shrink-0" />
                    {failureError}
                </p>
            )}

            {/* Review notice (one-time, after successful import) */}
            {reviewNotice && (
                <output
                    data-testid="import-review-notice"
                    className="block text-sm text-yellow-700 dark:text-yellow-400"
                >
                    {t('host.importFromUrl.prefill.reviewNotice' as Parameters<typeof t>[0])}
                </output>
            )}

            {/* Confidence badges for each imported field */}
            {Object.keys(importedFields).length > 0 && (
                <div
                    data-testid="import-confidence-badges"
                    className="space-y-1"
                >
                    {(['name', 'summary', 'type'] as const).map(
                        (fieldKey) =>
                            importedFields[fieldKey] && (
                                <div
                                    key={fieldKey}
                                    className="flex items-center"
                                >
                                    <span className="text-muted-foreground text-xs capitalize">
                                        {fieldKey}
                                    </span>
                                    <ConfidenceBadge
                                        fieldKey={fieldKey}
                                        importedFields={importedFields}
                                        t={t}
                                    />
                                </div>
                            )
                    )}
                </div>
            )}

            {/* Server message (e.g. AI-quota degraded) */}
            {serverMessage && (
                <p
                    data-testid="import-server-message"
                    className="flex items-start gap-1.5 text-muted-foreground text-sm"
                >
                    <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    {serverMessage}
                </p>
            )}

            {/* Advisory destination hint */}
            {destinationHintText && (
                <p
                    data-testid="import-destination-hint"
                    className="text-muted-foreground text-xs"
                >
                    <span className="font-medium">
                        {t(
                            'host.importFromUrl.prefill.destinationHint.label' as Parameters<
                                typeof t
                            >[0]
                        )}
                        {': '}
                    </span>
                    {destinationHintText}{' '}
                    {t(
                        'host.importFromUrl.prefill.destinationHint.hint' as Parameters<typeof t>[0]
                    )}
                </p>
            )}
        </div>
    );
}
