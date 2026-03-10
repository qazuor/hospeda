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
import { Button } from '../../ui/Button.js';
import { Input } from '../../ui/Input.js';
import { Label } from '../../ui/Label.js';
import { Select } from '../../ui/Select.js';
import { Textarea } from '../../ui/Textarea.js';

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
        <div className="space-y-4">
            {/* Severity */}
            <div>
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
            <div>
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
            <div>
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
            <div>
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
                <p className="mb-1 font-semibold text-foreground text-sm">
                    {FEEDBACK_STRINGS.fields.attachments}
                </p>
                {attachments.length < FEEDBACK_CONFIG.maxAttachments && (
                    <label
                        htmlFor="feedback-files"
                        className="block cursor-pointer rounded-md border-2 border-border border-dashed bg-muted/50 p-4 text-center transition-colors hover:bg-muted"
                    >
                        <span className="font-medium text-sm">
                            {FEEDBACK_STRINGS.fields.uploadButton}
                        </span>
                        <p className="mt-1 text-muted-foreground text-xs">
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
                            className="hidden"
                            onChange={handleFileChange}
                        />
                    </label>
                )}
                {fileRejections.length > 0 && (
                    <ul
                        className="mt-1 list-none p-0"
                        role="alert"
                    >
                        {fileRejections.map((msg) => (
                            <li
                                key={msg}
                                className="mt-0.5 text-destructive text-xs"
                            >
                                {msg}
                            </li>
                        ))}
                    </ul>
                )}
                {attachments.length > 0 && (
                    <ul className="mt-2 list-none space-y-1 p-0">
                        {attachments.map((file, index) => (
                            <li
                                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for attachment list
                                key={index}
                                className="flex items-center justify-between rounded bg-muted px-3 py-1.5 text-foreground text-sm"
                            >
                                <span>
                                    {file.name}
                                    <span className="ml-1.5 text-muted-foreground text-xs">
                                        ({formatFileSize(file.size)})
                                    </span>
                                </span>
                                <button
                                    type="button"
                                    className="p-0.5 font-bold text-destructive text-sm hover:text-destructive/80"
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
            <div className="overflow-hidden rounded-md border border-border">
                <button
                    type="button"
                    className="flex w-full items-center justify-between bg-muted px-3.5 py-2.5 text-left font-semibold text-foreground text-xs"
                    onClick={() => setTechOpen((prev) => !prev)}
                    aria-expanded={techOpen}
                >
                    <span>{FEEDBACK_STRINGS.techDetails.title}</span>
                    <span>{techOpen ? '▲' : '▼'}</span>
                </button>

                {techOpen && (
                    <div className="space-y-2.5 p-3.5">
                        <div>
                            <label
                                htmlFor="tech-url"
                                className="mb-0.5 block font-medium text-muted-foreground text-xs"
                            >
                                {FEEDBACK_STRINGS.techDetails.url}
                            </label>
                            <Input
                                id="tech-url"
                                className="h-7 text-xs"
                                value={environment.currentUrl ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'currentUrl',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="tech-browser"
                                className="mb-0.5 block font-medium text-muted-foreground text-xs"
                            >
                                {FEEDBACK_STRINGS.techDetails.browser}
                            </label>
                            <Input
                                id="tech-browser"
                                className="h-7 text-xs"
                                value={environment.browser ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'browser',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="tech-os"
                                className="mb-0.5 block font-medium text-muted-foreground text-xs"
                            >
                                {FEEDBACK_STRINGS.techDetails.os}
                            </label>
                            <Input
                                id="tech-os"
                                className="h-7 text-xs"
                                value={environment.os ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'os',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="tech-viewport"
                                className="mb-0.5 block font-medium text-muted-foreground text-xs"
                            >
                                {FEEDBACK_STRINGS.techDetails.viewport}
                            </label>
                            <Input
                                id="tech-viewport"
                                className="h-7 text-xs"
                                value={environment.viewport ?? ''}
                                onChange={(e) =>
                                    onEnvironmentChange(
                                        'viewport',
                                        e.target.value === '' ? undefined : e.target.value
                                    )
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="tech-version"
                                className="mb-0.5 block font-medium text-muted-foreground text-xs"
                            >
                                {FEEDBACK_STRINGS.techDetails.version}
                            </label>
                            <Input
                                id="tech-version"
                                className="h-7 text-xs"
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
                            <div>
                                <span className="mb-0.5 block font-medium text-muted-foreground text-xs">
                                    {FEEDBACK_STRINGS.techDetails.consoleErrors}
                                </span>
                                <p className="text-muted-foreground text-xs italic">
                                    {FEEDBACK_STRINGS.fields.consoleErrorsCount.replace(
                                        '{count}',
                                        String(environment.consoleErrors.length)
                                    )}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action buttons */}
            <div className="flex justify-between gap-3 pt-2">
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
