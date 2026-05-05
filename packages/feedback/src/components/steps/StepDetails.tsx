/**
 * @repo/feedback - StepDetails component
 *
 * Step 2 of the feedback form. Collects optional detail fields: severity,
 * steps to reproduce, expected/actual result, file attachments, and
 * auto-collected environment data (editable by the user).
 */
import { useMemo, useState } from 'react';
import { FEEDBACK_CONFIG, SEVERITY_LEVELS } from '../../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../config/strings.js';
import type {
    ColorSchemeId,
    DeviceTypeId,
    FeedbackEnvironment,
    FeedbackInteraction,
    SeverityId
} from '../../schemas/feedback.schema.js';
import { Button } from '../../ui/Button.js';
import { Input } from '../../ui/Input.js';
import { Label } from '../../ui/Label.js';
import { Select } from '../../ui/Select.js';
import { Textarea } from '../../ui/Textarea.js';
import styles from './StepDetails.module.css';

/**
 * Serializes a feature flags map into a textarea-friendly string
 * (one `key=value` line per entry).
 */
function flagsToText(flags: Record<string, string> | undefined): string {
    if (!flags) return '';
    return Object.entries(flags)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n');
}

/**
 * Parses a `key=value` per-line text input back into a feature flags map.
 * Empty lines and lines without `=` are skipped. Returns `undefined` when
 * the result is empty so the field can stay unset.
 */
function textToFlags(text: string): Record<string, string> | undefined {
    const flags: Record<string, string> = {};
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (!key) continue;
        flags[key] = value;
    }
    return Object.keys(flags).length > 0 ? flags : undefined;
}

/**
 * Serializes the navigation history into a textarea-friendly string
 * (one URL per line, most-recent last).
 */
function navHistoryToText(history: string[] | undefined): string {
    if (!history) return '';
    return history.join('\n');
}

/**
 * Parses textarea input back into a navigation history array, dropping empty
 * lines. Returns `undefined` for empty input.
 */
function textToNavHistory(text: string): string[] | undefined {
    const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    return lines.length > 0 ? lines : undefined;
}

/**
 * Serializes interactions into a `tag | selector | timestamp` per-line string.
 */
function interactionsToText(interactions: FeedbackInteraction[] | undefined): string {
    if (!interactions) return '';
    return interactions.map((i) => `${i.type} | ${i.selector} | ${i.timestamp}`).join('\n');
}

/**
 * Parses textarea input back into a structured interactions array. Lines that
 * cannot be parsed are skipped. Returns `undefined` for empty input.
 */
function textToInteractions(text: string): FeedbackInteraction[] | undefined {
    const result: FeedbackInteraction[] = [];
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        const parts = trimmed.split('|').map((p) => p.trim());
        const [type, selector, timestamp] = parts;
        if (!type || !selector || !timestamp) continue;
        result.push({ type, selector, timestamp });
    }
    return result.length > 0 ? result : undefined;
}

/** Serializes a console errors array into a textarea-friendly string. */
function consoleErrorsToText(errors: string[] | undefined): string {
    if (!errors) return '';
    return errors.join('\n');
}

/** Parses textarea input back into a console errors array. */
function textToConsoleErrors(text: string): string[] | undefined {
    const lines = text
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);
    return lines.length > 0 ? lines : undefined;
}

/** Data managed by step 2 of the feedback form (all optional) */
export interface StepDetailsData {
    /** Linear priority level for this issue */
    severity?: SeverityId;
    /** Numbered steps a developer can follow to reproduce the issue */
    stepsToReproduce?: string;
    /** What the reporter expected to happen */
    expectedResult?: string;
    /** What actually happened */
    actualResult?: string;
}

/** Props for the StepDetails component */
export interface StepDetailsProps {
    /** Current form values for step 2 fields */
    readonly data: StepDetailsData;
    /**
     * Callback to update a single step 2 field.
     * Uses a generic key constraint to keep type safety.
     */
    readonly onChange: <K extends keyof StepDetailsData>(
        field: K,
        value: StepDetailsData[K]
    ) => void;
    /** Currently attached screenshot files */
    readonly attachments: File[];
    /** Callback to add one or more files to the attachment list */
    readonly onAddAttachments: (files: File[]) => void;
    /** Callback to remove a single attachment by its list index */
    readonly onRemoveAttachment: (index: number) => void;
    /** Auto-collected browser/OS/viewport data (editable by user) */
    readonly environment: FeedbackEnvironment;
    /**
     * Callback to update a single environment field.
     * Uses a generic key constraint to keep type safety.
     */
    readonly onEnvironmentChange: <K extends keyof FeedbackEnvironment>(
        key: K,
        value: FeedbackEnvironment[K]
    ) => void;
    /** Called when user clicks "Volver" */
    readonly onBack: () => void;
    /** Called when user clicks "Enviar" */
    readonly onSubmit: () => void;
    /** Whether form is currently submitting */
    readonly isSubmitting: boolean;
}

/** Format bytes into a human-readable string (e.g. "1.2 MB") */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

/**
 * Step 2 of the feedback form.
 *
 * Renders optional fields to provide more context about an issue:
 * severity, steps to reproduce, expected/actual results, file attachments
 * (images only), and a collapsible technical details section with
 * auto-collected environment data that the user can edit before submitting.
 *
 * @example
 * ```tsx
 * <StepDetails
 *   data={detailsData}
 *   onChange={(field, value) => setDetailsField(field, value)}
 *   attachments={files}
 *   onAddAttachments={handleAddFiles}
 *   onRemoveAttachment={handleRemoveFile}
 *   environment={envData}
 *   onEnvironmentChange={(key, value) => setEnvField(key, value)}
 *   onBack={handleBack}
 *   onSubmit={handleSubmit}
 *   isSubmitting={false}
 * />
 * ```
 */
export function StepDetails({
    data,
    onChange,
    attachments,
    onAddAttachments,
    onRemoveAttachment,
    environment,
    onEnvironmentChange,
    onBack,
    onSubmit,
    isSubmitting
}: StepDetailsProps) {
    const [techOpen, setTechOpen] = useState(false);
    const [fileRejections, setFileRejections] = useState<string[]>([]);

    // Memoized text serializations so editing one field doesn't recompute siblings
    const featureFlagsText = useMemo(
        () => flagsToText(environment.featureFlags),
        [environment.featureFlags]
    );
    const navHistoryText = useMemo(
        () => navHistoryToText(environment.navigationHistory),
        [environment.navigationHistory]
    );
    const lastInteractionsText = useMemo(
        () => interactionsToText(environment.lastInteractions),
        [environment.lastInteractions]
    );
    const consoleErrorsText = useMemo(
        () => consoleErrorsToText(environment.consoleErrors),
        [environment.consoleErrors]
    );

    /**
     * Helper to update a nested field in `environment.errorInfo` while
     * preserving the other property.
     */
    const updateErrorInfo = (field: 'message' | 'stack', value: string): void => {
        const next = {
            message: environment.errorInfo?.message ?? '',
            stack: environment.errorInfo?.stack,
            [field]: value
        } as { message: string; stack?: string };

        // Drop the entire object when both fields are empty
        if (!next.message && !next.stack) {
            onEnvironmentChange('errorInfo', undefined);
            return;
        }
        onEnvironmentChange('errorInfo', next);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files;
        if (!selected) return;

        const remaining = FEEDBACK_CONFIG.maxAttachments - attachments.length;
        const candidates = Array.from(selected).slice(0, remaining);
        const rejections: string[] = [];

        const valid = candidates.filter((file) => {
            if (file.size > FEEDBACK_CONFIG.maxFileSize) {
                rejections.push(`${file.name}: ${FEEDBACK_STRINGS.fields.fileTooBig}`);
                return false;
            }
            if (!(FEEDBACK_CONFIG.allowedFileTypes as readonly string[]).includes(file.type)) {
                rejections.push(`${file.name}: ${FEEDBACK_STRINGS.fields.fileTypeInvalid}`);
                return false;
            }
            return true;
        });

        setFileRejections(rejections);

        if (valid.length > 0) {
            onAddAttachments(valid);
        }

        // Reset input so same file can be re-selected after removal
        e.target.value = '';
    };

    return (
        <div className={styles.stepRoot}>
            {/* Severity */}
            <div className={styles.fieldGroup}>
                <Label htmlFor="feedback-severity">{FEEDBACK_STRINGS.fields.severity}</Label>
                <Select
                    id="feedback-severity"
                    value={data.severity ?? ''}
                    onChange={(e) => {
                        const val = e.target.value;
                        onChange('severity', val === '' ? undefined : (val as SeverityId));
                    }}
                >
                    <option value="">{FEEDBACK_STRINGS.fields.severityOptional}</option>
                    {SEVERITY_LEVELS.map((level) => (
                        <option
                            key={level.id}
                            value={level.id}
                        >
                            {level.label} — {level.description}
                        </option>
                    ))}
                </Select>
            </div>

            {/* Steps to reproduce */}
            <div className={styles.fieldGroup}>
                <Label htmlFor="feedback-steps">{FEEDBACK_STRINGS.fields.stepsToReproduce}</Label>
                <Textarea
                    id="feedback-steps"
                    value={data.stepsToReproduce ?? ''}
                    onChange={(e) =>
                        onChange(
                            'stepsToReproduce',
                            e.target.value === '' ? undefined : e.target.value
                        )
                    }
                    placeholder={FEEDBACK_STRINGS.fields.stepsPlaceholder}
                />
            </div>

            {/* Expected result */}
            <div className={styles.fieldGroup}>
                <Label htmlFor="feedback-expected">{FEEDBACK_STRINGS.fields.expectedResult}</Label>
                <Textarea
                    id="feedback-expected"
                    value={data.expectedResult ?? ''}
                    onChange={(e) =>
                        onChange(
                            'expectedResult',
                            e.target.value === '' ? undefined : e.target.value
                        )
                    }
                    placeholder={FEEDBACK_STRINGS.fields.expectedResultPlaceholder}
                />
            </div>

            {/* Actual result */}
            <div className={styles.fieldGroup}>
                <Label htmlFor="feedback-actual">{FEEDBACK_STRINGS.fields.actualResult}</Label>
                <Textarea
                    id="feedback-actual"
                    value={data.actualResult ?? ''}
                    onChange={(e) =>
                        onChange('actualResult', e.target.value === '' ? undefined : e.target.value)
                    }
                    placeholder={FEEDBACK_STRINGS.fields.actualResultPlaceholder}
                />
            </div>

            {/* File attachments */}
            <div>
                <p className={styles.attachmentsLabel}>{FEEDBACK_STRINGS.fields.attachments}</p>
                {attachments.length < FEEDBACK_CONFIG.maxAttachments && (
                    <label
                        htmlFor="feedback-files"
                        className={styles.uploadZone}
                    >
                        <span className={styles.uploadZoneText}>
                            {FEEDBACK_STRINGS.fields.uploadButton}
                        </span>
                        <p className={styles.uploadZoneHint}>
                            {FEEDBACK_STRINGS.fields.fileHintFormat} &mdash;{' '}
                            {FEEDBACK_STRINGS.fields.fileHintMaxSize.replace(
                                '{size}',
                                formatFileSize(FEEDBACK_CONFIG.maxFileSize)
                            )}
                        </p>
                        <input
                            id="feedback-files"
                            type="file"
                            accept={(FEEDBACK_CONFIG.allowedFileTypes as readonly string[]).join(
                                ','
                            )}
                            multiple
                            className={styles.uploadInput}
                            onChange={handleFileChange}
                        />
                    </label>
                )}
                {fileRejections.length > 0 && (
                    <ul
                        className={styles.rejectionList}
                        role="alert"
                    >
                        {fileRejections.map((msg) => (
                            <li
                                key={msg}
                                className={styles.rejectionItem}
                            >
                                {msg}
                            </li>
                        ))}
                    </ul>
                )}
                {attachments.length > 0 && (
                    <ul className={styles.attachmentList}>
                        {attachments.map((file, index) => (
                            <li
                                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for attachment list
                                key={index}
                                className={styles.attachmentItem}
                            >
                                <span>
                                    {file.name}
                                    <span className={styles.attachmentSize}>
                                        ({formatFileSize(file.size)})
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    className={styles.removeBtn}
                                    onClick={() => onRemoveAttachment(index)}
                                    aria-label={FEEDBACK_STRINGS.fields.removeFileLabel.replace(
                                        '{name}',
                                        file.name
                                    )}
                                >
                                    &times;
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Collapsible tech details */}
            <div className={styles.techSection}>
                <button
                    type="button"
                    className={styles.techToggle}
                    onClick={() => setTechOpen((prev) => !prev)}
                    aria-expanded={techOpen}
                >
                    <span>{FEEDBACK_STRINGS.techDetails.title}</span>
                    <span className={styles.techToggleChevron}>{techOpen ? '▲' : '▼'}</span>
                </button>

                {techOpen && (
                    <div className={styles.techFields}>
                        {/* --------------- Group: Sistema --------------- */}
                        <section className={styles.techGroup}>
                            <h4 className={styles.techGroupTitle}>
                                {FEEDBACK_STRINGS.techDetails.groupSystem}
                            </h4>
                            <div className={styles.techGrid}>
                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-locale"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.locale}
                                    </label>
                                    <Input
                                        id="tech-locale"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.locale ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'locale',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-timezone"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.timezone}
                                    </label>
                                    <Input
                                        id="tech-timezone"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.timezone ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'timezone',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-color-scheme"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.colorScheme}
                                    </label>
                                    <Select
                                        id="tech-color-scheme"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.colorScheme ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            onEnvironmentChange(
                                                'colorScheme',
                                                v === '' ? undefined : (v as ColorSchemeId)
                                            );
                                        }}
                                    >
                                        <option value="">
                                            {FEEDBACK_STRINGS.techDetails.unspecified}
                                        </option>
                                        <option value="light">
                                            {FEEDBACK_STRINGS.techDetails.colorSchemeLight}
                                        </option>
                                        <option value="dark">
                                            {FEEDBACK_STRINGS.techDetails.colorSchemeDark}
                                        </option>
                                    </Select>
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-device-type"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.deviceType}
                                    </label>
                                    <Select
                                        id="tech-device-type"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.deviceType ?? ''}
                                        onChange={(e) => {
                                            const v = e.target.value;
                                            onEnvironmentChange(
                                                'deviceType',
                                                v === '' ? undefined : (v as DeviceTypeId)
                                            );
                                        }}
                                    >
                                        <option value="">
                                            {FEEDBACK_STRINGS.techDetails.unspecified}
                                        </option>
                                        <option value="mobile">
                                            {FEEDBACK_STRINGS.techDetails.deviceTypeMobile}
                                        </option>
                                        <option value="tablet">
                                            {FEEDBACK_STRINGS.techDetails.deviceTypeTablet}
                                        </option>
                                        <option value="desktop">
                                            {FEEDBACK_STRINGS.techDetails.deviceTypeDesktop}
                                        </option>
                                    </Select>
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-connection"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.connectionType}
                                    </label>
                                    <Input
                                        id="tech-connection"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.connectionType ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'connectionType',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </section>

                        {/* --------------- Group: Navegador --------------- */}
                        <section className={styles.techGroup}>
                            <h4 className={styles.techGroupTitle}>
                                {FEEDBACK_STRINGS.techDetails.groupBrowser}
                            </h4>
                            <div className={styles.techGrid}>
                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-browser"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.browser}
                                    </label>
                                    <Input
                                        id="tech-browser"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.browser ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'browser',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-os"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.os}
                                    </label>
                                    <Input
                                        id="tech-os"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.os ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'os',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-viewport"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.viewport}
                                    </label>
                                    <Input
                                        id="tech-viewport"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.viewport ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'viewport',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-url"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.url}
                                    </label>
                                    <Input
                                        id="tech-url"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.currentUrl ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'currentUrl',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-version"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.version}
                                    </label>
                                    <Input
                                        id="tech-version"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.deployVersion ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'deployVersion',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </section>

                        {/* --------------- Group: Trazas --------------- */}
                        <section className={styles.techGroup}>
                            <h4 className={styles.techGroupTitle}>
                                {FEEDBACK_STRINGS.techDetails.groupTraces}
                            </h4>
                            <div className={styles.techGrid}>
                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-console-errors"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.consoleErrors}
                                    </label>
                                    <Textarea
                                        id="tech-console-errors"
                                        className={styles.techTextarea}
                                        value={consoleErrorsText}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'consoleErrors',
                                                textToConsoleErrors(e.target.value)
                                            )
                                        }
                                    />
                                </div>

                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-error-message"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.errorMessage}
                                    </label>
                                    <Input
                                        id="tech-error-message"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.errorInfo?.message ?? ''}
                                        onChange={(e) => updateErrorInfo('message', e.target.value)}
                                    />
                                </div>

                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-error-stack"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.errorStack}
                                    </label>
                                    <Textarea
                                        id="tech-error-stack"
                                        className={styles.techTextarea}
                                        value={environment.errorInfo?.stack ?? ''}
                                        onChange={(e) => updateErrorInfo('stack', e.target.value)}
                                    />
                                </div>

                                <div className={styles.techField}>
                                    <label
                                        htmlFor="tech-sentry-event-id"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.sentryEventId}
                                    </label>
                                    <Input
                                        id="tech-sentry-event-id"
                                        style={{ height: '1.75rem', fontSize: '0.75rem' }}
                                        value={environment.sentryEventId ?? ''}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'sentryEventId',
                                                e.target.value === '' ? undefined : e.target.value
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </section>

                        {/* --------------- Group: Contexto --------------- */}
                        <section className={styles.techGroup}>
                            <h4 className={styles.techGroupTitle}>
                                {FEEDBACK_STRINGS.techDetails.groupContext}
                            </h4>
                            <div className={styles.techGrid}>
                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-feature-flags"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.featureFlags}
                                    </label>
                                    <Textarea
                                        id="tech-feature-flags"
                                        className={styles.techTextarea}
                                        value={featureFlagsText}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'featureFlags',
                                                textToFlags(e.target.value)
                                            )
                                        }
                                    />
                                </div>

                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-nav-history"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.navigationHistory}
                                    </label>
                                    <Textarea
                                        id="tech-nav-history"
                                        className={styles.techTextarea}
                                        value={navHistoryText}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'navigationHistory',
                                                textToNavHistory(e.target.value)
                                            )
                                        }
                                    />
                                </div>

                                <div className={`${styles.techField} ${styles.techFieldFull}`}>
                                    <label
                                        htmlFor="tech-last-interactions"
                                        className={styles.techFieldLabel}
                                    >
                                        {FEEDBACK_STRINGS.techDetails.lastInteractions}
                                    </label>
                                    <Textarea
                                        id="tech-last-interactions"
                                        className={styles.techTextarea}
                                        value={lastInteractionsText}
                                        onChange={(e) =>
                                            onEnvironmentChange(
                                                'lastInteractions',
                                                textToInteractions(e.target.value)
                                            )
                                        }
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className={styles.actions}>
                <Button
                    type="button"
                    variant="secondary"
                    onClick={onBack}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.back}
                </Button>
                <Button
                    type="button"
                    onClick={onSubmit}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.submit}
                </Button>
            </div>
        </div>
    );
}
