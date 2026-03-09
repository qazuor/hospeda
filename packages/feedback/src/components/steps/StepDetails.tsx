/**
 * @repo/feedback - StepDetails component
 *
 * Step 2 of the feedback form. Collects optional detail fields: severity,
 * steps to reproduce, expected/actual result, file attachments, and
 * auto-collected environment data (editable by the user).
 */
import { useState } from 'react';
import { FEEDBACK_CONFIG, SEVERITY_LEVELS } from '../../config/feedback.config.js';
import { FEEDBACK_STRINGS } from '../../config/strings.js';
import type { FeedbackEnvironment, SeverityId } from '../../schemas/feedback.schema.js';

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
    data: StepDetailsData;
    /**
     * Callback to update a single step 2 field.
     * Uses a generic key constraint to keep type safety.
     */
    onChange: <K extends keyof StepDetailsData>(field: K, value: StepDetailsData[K]) => void;
    /** Currently attached screenshot files */
    attachments: File[];
    /** Callback to add one or more files to the attachment list */
    onAddAttachments: (files: File[]) => void;
    /** Callback to remove a single attachment by its list index */
    onRemoveAttachment: (index: number) => void;
    /** Auto-collected browser/OS/viewport data (editable by user) */
    environment: FeedbackEnvironment;
    /**
     * Callback to update a single environment field.
     * Uses a generic key constraint to keep type safety.
     */
    onEnvironmentChange: <K extends keyof FeedbackEnvironment>(
        key: K,
        value: FeedbackEnvironment[K]
    ) => void;
    /** Called when user clicks "Volver" */
    onBack: () => void;
    /** Called when user clicks "Enviar" */
    onSubmit: () => void;
    /** Whether form is currently submitting */
    isSubmitting: boolean;
}

const styles = {
    label: {
        display: 'block',
        fontSize: '14px',
        fontWeight: '600',
        color: '#374151',
        marginBottom: '4px'
    },
    input: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        boxSizing: 'border-box' as const
    },
    textarea: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        minHeight: '80px',
        resize: 'vertical' as const,
        boxSizing: 'border-box' as const
    },
    select: {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #d1d5db',
        borderRadius: '6px',
        fontSize: '14px',
        backgroundColor: '#fff',
        boxSizing: 'border-box' as const
    },
    fieldGroup: {
        marginBottom: '16px'
    },
    buttonRow: {
        display: 'flex',
        justifyContent: 'space-between',
        gap: '12px',
        marginTop: '20px'
    },
    buttonPrimary: {
        padding: '8px 20px',
        backgroundColor: '#2563eb',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'pointer'
    },
    buttonPrimaryDisabled: {
        padding: '8px 20px',
        backgroundColor: '#93c5fd',
        color: '#fff',
        border: 'none',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '600',
        cursor: 'not-allowed'
    },
    buttonSecondary: {
        padding: '8px 20px',
        backgroundColor: 'transparent',
        color: '#2563eb',
        border: '1px solid #2563eb',
        borderRadius: '6px',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer'
    },
    uploadArea: {
        border: '2px dashed #d1d5db',
        borderRadius: '6px',
        padding: '16px',
        textAlign: 'center' as const,
        backgroundColor: '#f9fafb',
        cursor: 'pointer'
    },
    uploadHint: {
        fontSize: '12px',
        color: '#6b7280',
        marginTop: '4px'
    },
    fileList: {
        listStyle: 'none',
        padding: 0,
        margin: '8px 0 0 0'
    },
    fileItem: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 10px',
        backgroundColor: '#f3f4f6',
        borderRadius: '4px',
        marginBottom: '4px',
        fontSize: '13px',
        color: '#374151'
    },
    fileSize: {
        color: '#6b7280',
        fontSize: '12px',
        marginLeft: '6px'
    },
    removeButton: {
        background: 'none',
        border: 'none',
        color: '#ef4444',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '700',
        padding: '0 4px',
        lineHeight: 1
    },
    techSection: {
        border: '1px solid #e5e7eb',
        borderRadius: '6px',
        overflow: 'hidden'
    },
    techHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: '#f3f4f6',
        cursor: 'pointer',
        border: 'none',
        width: '100%',
        textAlign: 'left' as const,
        fontSize: '13px',
        fontWeight: '600',
        color: '#374151'
    },
    techBody: {
        padding: '12px 14px'
    },
    techFieldGroup: {
        marginBottom: '10px'
    },
    techLabel: {
        display: 'block',
        fontSize: '12px',
        fontWeight: '500',
        color: '#6b7280',
        marginBottom: '2px'
    },
    techInput: {
        width: '100%',
        padding: '6px 10px',
        border: '1px solid #e5e7eb',
        borderRadius: '4px',
        fontSize: '12px',
        backgroundColor: '#fff',
        boxSizing: 'border-box' as const
    },
    errorHint: {
        fontSize: '12px',
        color: '#6b7280',
        fontStyle: 'italic'
    }
} as const;

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
        <div>
            {/* Severity */}
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-severity"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.severity}
                </label>
                <select
                    id="feedback-severity"
                    style={styles.select}
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
                </select>
            </div>

            {/* Steps to reproduce */}
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-steps"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.stepsToReproduce}
                </label>
                <textarea
                    id="feedback-steps"
                    style={styles.textarea}
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
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-expected"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.expectedResult}
                </label>
                <textarea
                    id="feedback-expected"
                    style={styles.textarea}
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
            <div style={styles.fieldGroup}>
                <label
                    htmlFor="feedback-actual"
                    style={styles.label}
                >
                    {FEEDBACK_STRINGS.fields.actualResult}
                </label>
                <textarea
                    id="feedback-actual"
                    style={styles.textarea}
                    value={data.actualResult ?? ''}
                    onChange={(e) =>
                        onChange('actualResult', e.target.value === '' ? undefined : e.target.value)
                    }
                    placeholder={FEEDBACK_STRINGS.fields.actualResultPlaceholder}
                />
            </div>

            {/* File attachments */}
            <div style={styles.fieldGroup}>
                <p style={{ ...styles.label, margin: '0 0 4px 0' }}>
                    {FEEDBACK_STRINGS.fields.attachments}
                </p>
                {attachments.length < FEEDBACK_CONFIG.maxAttachments && (
                    <label
                        htmlFor="feedback-files"
                        style={styles.uploadArea}
                    >
                        <span>{FEEDBACK_STRINGS.fields.uploadButton}</span>
                        <p style={styles.uploadHint}>
                            PNG, JPG, WebP, GIF &mdash; max{' '}
                            {formatFileSize(FEEDBACK_CONFIG.maxFileSize)} por archivo
                        </p>
                        <input
                            id="feedback-files"
                            type="file"
                            accept={(FEEDBACK_CONFIG.allowedFileTypes as readonly string[]).join(
                                ','
                            )}
                            multiple
                            style={{ display: 'none' }}
                            onChange={handleFileChange}
                        />
                    </label>
                )}
                {fileRejections.length > 0 && (
                    <ul
                        style={{ margin: '4px 0 0 0', padding: 0, listStyle: 'none' }}
                        role="alert"
                    >
                        {fileRejections.map((msg) => (
                            <li
                                key={msg}
                                style={{ color: '#dc2626', fontSize: '0.8rem', marginTop: '2px' }}
                            >
                                {msg}
                            </li>
                        ))}
                    </ul>
                )}
                {attachments.length > 0 && (
                    <ul style={styles.fileList}>
                        {attachments.map((file, index) => (
                            <li
                                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for attachment list
                                key={index}
                                style={styles.fileItem}
                            >
                                <span>
                                    {file.name}
                                    <span style={styles.fileSize}>
                                        ({formatFileSize(file.size)})
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    style={styles.removeButton}
                                    onClick={() => onRemoveAttachment(index)}
                                    aria-label={`Eliminar ${file.name}`}
                                >
                                    &times;
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Collapsible tech details */}
            <div style={{ ...styles.fieldGroup, ...styles.techSection }}>
                <button
                    type="button"
                    style={styles.techHeader}
                    onClick={() => setTechOpen((prev) => !prev)}
                    aria-expanded={techOpen}
                >
                    <span>{FEEDBACK_STRINGS.techDetails.title}</span>
                    <span>{techOpen ? '▲' : '▼'}</span>
                </button>

                {techOpen && (
                    <div style={styles.techBody}>
                        <div style={styles.techFieldGroup}>
                            <label
                                htmlFor="tech-url"
                                style={styles.techLabel}
                            >
                                {FEEDBACK_STRINGS.techDetails.url}
                            </label>
                            <input
                                id="tech-url"
                                type="text"
                                style={styles.techInput}
                                value={environment.currentUrl ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'currentUrl',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div style={styles.techFieldGroup}>
                            <label
                                htmlFor="tech-browser"
                                style={styles.techLabel}
                            >
                                {FEEDBACK_STRINGS.techDetails.browser}
                            </label>
                            <input
                                id="tech-browser"
                                type="text"
                                style={styles.techInput}
                                value={environment.browser ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'browser',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div style={styles.techFieldGroup}>
                            <label
                                htmlFor="tech-os"
                                style={styles.techLabel}
                            >
                                {FEEDBACK_STRINGS.techDetails.os}
                            </label>
                            <input
                                id="tech-os"
                                type="text"
                                style={styles.techInput}
                                value={environment.os ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'os',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div style={styles.techFieldGroup}>
                            <label
                                htmlFor="tech-viewport"
                                style={styles.techLabel}
                            >
                                {FEEDBACK_STRINGS.techDetails.viewport}
                            </label>
                            <input
                                id="tech-viewport"
                                type="text"
                                style={styles.techInput}
                                value={environment.viewport ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'viewport',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div style={styles.techFieldGroup}>
                            <label
                                htmlFor="tech-version"
                                style={styles.techLabel}
                            >
                                {FEEDBACK_STRINGS.techDetails.version}
                            </label>
                            <input
                                id="tech-version"
                                type="text"
                                style={styles.techInput}
                                value={environment.deployVersion ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'deployVersion',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        {environment.consoleErrors && environment.consoleErrors.length > 0 && (
                            <div style={styles.techFieldGroup}>
                                <span style={styles.techLabel}>
                                    {FEEDBACK_STRINGS.techDetails.consoleErrors}
                                </span>
                                <p style={styles.errorHint}>
                                    {environment.consoleErrors.length} error(s) capturado(s)
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div style={styles.buttonRow}>
                <button
                    type="button"
                    style={styles.buttonSecondary}
                    onClick={onBack}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.back}
                </button>
                <button
                    type="button"
                    style={isSubmitting ? styles.buttonPrimaryDisabled : styles.buttonPrimary}
                    onClick={onSubmit}
                    disabled={isSubmitting}
                >
                    {FEEDBACK_STRINGS.buttons.submit}
                </button>
            </div>
        </div>
    );
}
