/**
 * @file PartnerForm.tsx
 * Partner create / edit form (SPEC-271).
 *
 * Uses TanStack Form with Zod validation at submit boundary.
 * All fields are Tailwind-styled; no CSS modules (admin convention).
 *
 * RO-RO props — inputs are plain values, outputs are via callbacks.
 */

import { Button } from '@/components/ui-wrapped/Button';
import {
    LifecycleStatusEnum,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    PartnerTypeEnum,
    createPartnerSchema
} from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import type { z } from 'zod';
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

const TIER_OPTIONS: ReadonlyArray<{ value: PartnerTierEnum; label: string }> = [
    { value: PartnerTierEnum.GOLD, label: 'Gold' },
    { value: PartnerTierEnum.SILVER, label: 'Silver' },
    { value: PartnerTierEnum.BRONZE, label: 'Bronze' }
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

    const today = new Date().toISOString().slice(0, 10);

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
            startsAt: initialData?.startsAt ?? new Date(today),
            endsAt: initialData?.endsAt ?? null
        } as PartnerFormValues,
        onSubmit: async ({ value }) => {
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
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                            <form.Field
                                name="planId"
                                validators={{
                                    onChange: ({ value }) =>
                                        value ? undefined : 'El plan de billing es requerido'
                                }}
                            >
                                {(field) => (
                                    <FieldWrapper
                                        label="Plan de billing"
                                        htmlFor={field.name}
                                        required
                                        error={
                                            field.state.meta.isTouched
                                                ? field.state.meta.errors.join(', ')
                                                : undefined
                                        }
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
                                            aria-required="true"
                                        >
                                            <option value="">Seleccioná un plan…</option>
                                            {plans.map((plan) => (
                                                <option
                                                    key={plan.id}
                                                    value={plan.id}
                                                >
                                                    {plan.name}
                                                    {plan.monthlyPriceArs !== null
                                                        ? ` · ARS ${(plan.monthlyPriceArs / 100).toLocaleString('es-AR')}`
                                                        : ''}
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                        <form.Field
                            name="startsAt"
                            validators={{
                                onChange: ({ value }) =>
                                    value ? undefined : 'La fecha de inicio es requerida'
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="Inicio"
                                    htmlFor={field.name}
                                    required
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
                                >
                                    <input
                                        id={field.name}
                                        name={field.name}
                                        type="date"
                                        value={toInputDate(
                                            field.state.value as Date | string | null
                                        )}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => {
                                            // startsAt is required — only update when a real date is chosen.
                                            if (e.target.value) {
                                                field.handleChange(new Date(e.target.value));
                                            }
                                        }}
                                        className={INPUT_CLASS}
                                        disabled={isSubmitting}
                                        aria-required="true"
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
                                    error={
                                        field.state.meta.isTouched
                                            ? field.state.meta.errors.join(', ')
                                            : undefined
                                    }
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
                                error={
                                    field.state.meta.isTouched
                                        ? field.state.meta.errors.join(', ')
                                        : undefined
                                }
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
