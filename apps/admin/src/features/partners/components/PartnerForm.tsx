/**
 * @file PartnerForm.tsx
 * Partner create / edit form (SPEC-271).
 *
 * Uses TanStack Form with Zod validation at submit boundary.
 * All fields are Tailwind-styled; no CSS modules (admin convention).
 *
 * RO-RO props — inputs are plain values, outputs are via callbacks.
 */

import {
    createPartnerSchema,
    LifecycleStatusEnum,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    PartnerTypeEnum
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui-wrapped/Button';
import type { PartnerAdminPlanOption } from '../hooks/usePartnerQuery';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PartnerFormValues = z.infer<typeof createPartnerSchema>;

/** Props accepted by {@link PartnerForm}. */
export interface PartnerFormProps {
    /**
     * Initial field values.  Pass the existing entity when editing;
     * omit (or pass `undefined`) when creating.
     */
    readonly initialData?: Partial<PartnerFormValues> | null;
    /** Available billing plans for the plan selector. */
    readonly plans: readonly PartnerAdminPlanOption[];
    /** Whether the form is in a pending/saving state. */
    readonly isSubmitting?: boolean;
    /** Label for the submit button. */
    readonly submitLabel?: string;
    /** Called when the user clicks Cancel. */
    readonly onCancel?: () => void;
    /** Called with the validated form values when the user submits. */
    readonly onSubmit: (values: PartnerFormValues) => Promise<void> | void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Converts a raw string to a URL-safe slug (lowercase, hyphens).
 */
function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

/**
 * Formats a Date, ISO string, or null/undefined as a `YYYY-MM-DD` string
 * suitable for an `<input type="date">`.
 */
function toInputDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const TYPE_OPTIONS: ReadonlyArray<{ value: PartnerTypeEnum; label: string }> = [
    { value: PartnerTypeEnum.COMMERCE, label: 'Comercio' },
    { value: PartnerTypeEnum.NGO, label: 'ONG' },
    { value: PartnerTypeEnum.INSTITUTION, label: 'Institución' }
];

// Gold and silver are the only tiers. `bronze` was retired by HOS-294: it had
// no plan and no price, and gold is the tier that grants the partner's own
// public page at `/partners/<slug>/`.
const TIER_OPTIONS: ReadonlyArray<{ value: PartnerTierEnum; label: string }> = [
    { value: PartnerTierEnum.GOLD, label: 'Gold' },
    { value: PartnerTierEnum.SILVER, label: 'Silver' }
];

// ---------------------------------------------------------------------------
// Small field wrapper
// ---------------------------------------------------------------------------

interface FieldWrapperProps {
    readonly label: string;
    readonly htmlFor?: string;
    readonly required?: boolean;
    readonly error?: string;
    readonly children: React.ReactNode;
}

/** The subset of a TanStack Form field's meta this file reads. */
interface FieldMetaLike {
    readonly isTouched: boolean;
    readonly errors: readonly unknown[];
}

/**
 * Field error copy, or `undefined` when the field has nothing to say yet.
 *
 * Gated on `isTouched` **or a submit having been attempted** — never on
 * `isTouched` alone. `form.handleSubmit()` runs every field validator and, when
 * one refuses, resolves normally WITHOUT invoking the submit handler: no throw,
 * no request, no rejection to catch. Gating the message on touch alone meant a
 * field the operator never opened could veto the save while displaying nothing
 * at all, which is exactly how H-161 stayed invisible through four save
 * attempts across three input methods.
 *
 * @param meta - The field's `state.meta`.
 * @param submitAttempted - Whether the operator has pressed save at least once.
 * @returns The joined error copy, or `undefined` when there is nothing to show.
 */
function fieldError(meta: FieldMetaLike, submitAttempted: boolean): string | undefined {
    if (!meta.isTouched && !submitAttempted) return undefined;
    const text = meta.errors.filter(Boolean).join(', ');
    return text.length > 0 ? text : undefined;
}

function FieldWrapper({ label, htmlFor, required, error, children }: FieldWrapperProps) {
    return (
        <div className="space-y-1">
            <label
                htmlFor={htmlFor}
                className="block font-medium text-foreground text-sm"
            >
                {label}
                {required && <span className="ml-1 text-destructive">*</span>}
            </label>
            {children}
            {error && <p className="text-destructive text-xs">{error}</p>}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Partner create / edit form.
 *
 * Validates at submit via `createPartnerSchema.safeParse`.
 * Field-level errors are surfaced after a failed submit attempt.
 *
 * @param props - {@link PartnerFormProps}
 */
export function PartnerForm({
    initialData,
    plans,
    isSubmitting = false,
    submitLabel = 'Guardar',
    onCancel,
    onSubmit
}: PartnerFormProps) {
    const [globalError, setGlobalError] = React.useState<string | null>(null);
    // Whether save has been pressed at least once — the gate that lets field
    // errors surface for fields the operator never touched (see `fieldError`).
    const [submitAttempted, setSubmitAttempted] = React.useState(false);
    // Set by the submit handler itself, so the wrapper below can tell "the save
    // ran" from "the save was vetoed". Nothing else distinguishes the two:
    // `form.handleSubmit()` resolves the same way either way.
    const submitHandlerRan = React.useRef(false);

    const form = useForm<PartnerFormValues>({
        defaultValues: {
            name: initialData?.name ?? '',
            slug: initialData?.slug ?? '',
            type: initialData?.type ?? PartnerTypeEnum.COMMERCE,
            tier: initialData?.tier ?? PartnerTierEnum.GOLD,
            logoUrl: initialData?.logoUrl ?? null,
            websiteUrl: initialData?.websiteUrl ?? null,
            description: initialData?.description ?? null,
            planId: initialData?.planId ?? null,
            subscriptionStatus:
                initialData?.subscriptionStatus ?? PartnerSubscriptionStatusEnum.PENDING,
            lifecycleState: initialData?.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
            startsAt: initialData?.startsAt ?? null,
            endsAt: initialData?.endsAt ?? null
        } as PartnerFormValues,
        onSubmit: async ({ value }) => {
            submitHandlerRan.current = true;
            setGlobalError(null);
            const result = createPartnerSchema.safeParse(value);
            if (!result.success) {
                const firstIssue = result.error.issues[0];
                setGlobalError(firstIssue?.message ?? 'Datos inválidos. Revisá el formulario.');
                return;
            }
            await onSubmit(result.data);
        }
    });

    const INPUT_CLASS =
        'w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

    return (
        <form
            onSubmit={async (e) => {
                e.preventDefault();
                e.stopPropagation();
                setGlobalError(null);
                setSubmitAttempted(true);
                submitHandlerRan.current = false;

                await form.handleSubmit();

                // A field validator that refuses aborts the submit INSIDE
                // `handleSubmit`, which then resolves normally — no throw, no
                // rejected promise, no request. Without this line the operator
                // presses save and gets absolutely nothing back: not a success,
                // not a failure. That silence is H-161, and it is worse than a
                // loud refusal because it reads as "saved".
                if (!submitHandlerRan.current) {
                    setGlobalError(
                        'No pudimos guardar: revisá los campos marcados y volvé a intentar.'
                    );
                }
            }}
            aria-label="Formulario de partner"
            noValidate
        >
            <div className="space-y-6">
                {/* ---- Identity ---- */}
                <section aria-labelledby="partner-identity-heading">
                    <h3
                        id="partner-identity-heading"
                        className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide"
                    >
                        Datos principales
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Name */}
                        <form.Field
                            name="name"
                            validators={{
                                onChange: ({ value }) =>
                                    !value || value.trim().length < 1
                                        ? 'El nombre es requerido'
                                        : undefined
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="Nombre"
                                    htmlFor={field.name}
                                    required
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            field.handleChange(e.target.value);
                                            // Auto-fill slug when slug is still empty
                                            const slugField = form.getFieldValue('slug');
                                            if (!slugField || slugField === '') {
                                                form.setFieldValue('slug', slugify(e.target.value));
                                            }
                                        }}
                                        placeholder="Ej: Municipalidad de Concepción"
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                        aria-required="true"
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Slug */}
                        <form.Field
                            name="slug"
                            validators={{
                                onChange: ({ value }) =>
                                    !value || value.trim().length < 1
                                        ? 'El slug es requerido'
                                        : undefined
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="Slug"
                                    htmlFor={field.name}
                                    required
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        placeholder="ej: municipalidad-cdu"
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                        aria-required="true"
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Type */}
                        <form.Field
                            name="type"
                            validators={{
                                onChange: ({ value }) =>
                                    value ? undefined : 'El tipo es requerido'
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="Tipo"
                                    htmlFor={field.name}
                                    required
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <select
                                        id={field.name}
                                        name={field.name}
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value as PartnerTypeEnum)
                                        }
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                        aria-required="true"
                                    >
                                        <option value="">Seleccioná el tipo…</option>
                                        {TYPE_OPTIONS.map((opt) => (
                                            <option
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Tier */}
                        <form.Field
                            name="tier"
                            validators={{
                                onChange: ({ value }) =>
                                    value ? undefined : 'El tier es requerido'
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="Tier"
                                    htmlFor={field.name}
                                    required
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <select
                                        id={field.name}
                                        name={field.name}
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value as PartnerTierEnum)
                                        }
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                        aria-required="true"
                                    >
                                        <option value="">Seleccioná el tier…</option>
                                        {TIER_OPTIONS.map((opt) => (
                                            <option
                                                key={opt.value}
                                                value={opt.value}
                                            >
                                                {opt.label}
                                            </option>
                                        ))}
                                    </select>
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Plan */}
                        <div className="sm:col-span-2">
                            {/* NO required validator, deliberately. `partnerSchema.planId`
                                is `.nullable().optional()`, and every partner in production
                                carries `plan_id = NULL` — a hand-written "required" rule
                                here therefore vetoed the save on EVERY existing partner
                                before the submit handler could run (H-161). A partner
                                without a plan is a real, supported state: it is what a
                                curated partner looks like until someone sells it one. */}
                            <form.Field name="planId">
                                {(field) => (
                                    <FieldWrapper
                                        label="Plan de billing"
                                        htmlFor={field.name}
                                        error={fieldError(field.state.meta, submitAttempted)}
                                    >
                                        <select
                                            id={field.name}
                                            name={field.name}
                                            value={(field.state.value as string) ?? ''}
                                            onBlur={field.handleBlur}
                                            onChange={(e) =>
                                                field.handleChange(e.target.value || null)
                                            }
                                            className={INPUT_CLASS}
                                            disabled={isSubmitting}
                                        >
                                            <option value="">Sin plan asignado</option>
                                            {plans.map((plan) => (
                                                <option
                                                    key={plan.id}
                                                    value={plan.id}
                                                >
                                                    {plan.name}
                                                    {plan.monthlyPriceArs === null
                                                        ? ''
                                                        : ` · ARS ${(plan.monthlyPriceArs / 100).toLocaleString('es-AR')}`}
                                                </option>
                                            ))}
                                        </select>
                                    </FieldWrapper>
                                )}
                            </form.Field>
                        </div>
                    </div>
                </section>

                {/* ---- URLs ---- */}
                <section aria-labelledby="partner-urls-heading">
                    <h3
                        id="partner-urls-heading"
                        className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide"
                    >
                        Presencia online
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Logo URL */}
                        <form.Field name="logoUrl">
                            {(field) => (
                                <FieldWrapper
                                    label="Logo URL"
                                    htmlFor={field.name}
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="url"
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value || null)}
                                        placeholder="https://ejemplo.com/logo.png"
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Website URL */}
                        <form.Field name="websiteUrl">
                            {(field) => (
                                <FieldWrapper
                                    label="Sitio web"
                                    htmlFor={field.name}
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="url"
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value || null)}
                                        placeholder="https://ejemplo.com"
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>
                    </div>
                </section>

                {/* ---- Subscription period ---- */}
                <section aria-labelledby="partner-dates-heading">
                    <h3
                        id="partner-dates-heading"
                        className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide"
                    >
                        Período de partnership
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Starts At */}
                        <form.Field name="startsAt">
                            {(field) => (
                                <FieldWrapper
                                    label="Inicio (opcional)"
                                    htmlFor={field.name}
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="date"
                                        value={toInputDate(
                                            field.state.value as Date | string | null
                                        )}
                                        onBlur={field.handleBlur}
                                        // Clearable, and empty by default (HOS-278 D1). This
                                        // field used to refuse to clear and to prefill the
                                        // current date, so a partner that had not started yet
                                        // still carried a start date — invented, and
                                        // indistinguishable from a real one everywhere it was
                                        // read afterwards.
                                        onChange={(e) =>
                                            field.handleChange(
                                                e.target.value ? new Date(e.target.value) : null
                                            )
                                        }
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Ends At */}
                        <form.Field name="endsAt">
                            {(field) => (
                                <FieldWrapper
                                    label="Fin (opcional)"
                                    htmlFor={field.name}
                                    error={fieldError(field.state.meta, submitAttempted)}
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="date"
                                        value={toInputDate(
                                            field.state.value as Date | string | null
                                        )}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(
                                                e.target.value ? new Date(e.target.value) : null
                                            )
                                        }
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>
                    </div>
                </section>

                {/* ---- Description ---- */}
                <section aria-labelledby="partner-desc-heading">
                    <h3
                        id="partner-desc-heading"
                        className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide"
                    >
                        Descripción
                    </h3>
                    <form.Field name="description">
                        {(field) => (
                            <FieldWrapper
                                label="Descripción"
                                htmlFor={field.name}
                                error={fieldError(field.state.meta, submitAttempted)}
                            >
                                <textarea
                                    id={field.name}
                                    name={field.name}
                                    value={(field.state.value as string) ?? ''}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => field.handleChange(e.target.value || null)}
                                    placeholder="Descripción del partner (opcional, máx. 5000 caracteres)"
                                    rows={4}
                                    className={INPUT_CLASS}
                                    disabled={isSubmitting}
                                />
                            </FieldWrapper>
                        )}
                    </form.Field>
                </section>

                {/* ---- Global error ---- */}
                {globalError && (
                    <p
                        role="alert"
                        className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-destructive text-sm"
                    >
                        {globalError}
                    </p>
                )}

                {/* ---- Actions ---- */}
                <div className="flex justify-end gap-3">
                    {onCancel && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            Cancelar
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? 'Guardando…' : submitLabel}
                    </Button>
                </div>
            </div>
        </form>
    );
}
