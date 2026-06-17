/**
 * @file GastronomyForm.tsx
 * Standalone React form component for gastronomy create / edit (SPEC-239 T-059).
 *
 * Uses TanStack Form with Zod validation at submit boundary.
 * All fields are Tailwind-styled; no CSS modules.
 *
 * RO-RO props — inputs are plain values, outputs are via callbacks.
 *
 * NOTE: in most admin pages the entity form system (`EntityCreatePageBase`,
 * `EntityPageBase` + consolidated config) handles the form automatically.
 * This component exists as an explicit fallback for contexts where the
 * generic system cannot be used (e.g. embedded modals, custom workflows).
 */

import { Button } from '@/components/ui-wrapped/Button';
import { GastronomyCreateHttpSchema, GastronomyTypeEnum, PriceRangeEnum } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import type { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type GastronomyFormValues = z.infer<typeof GastronomyCreateHttpSchema>;

/** Props accepted by {@link GastronomyForm}. */
export interface GastronomyFormProps {
    /**
     * Initial field values.  Pass the existing entity when editing;
     * omit (or pass `undefined`) when creating.
     */
    readonly defaultValues?: Partial<GastronomyFormValues>;
    /** Called with the validated form values when the user submits. */
    readonly onSubmit: (values: GastronomyFormValues) => Promise<void> | void;
    /** Called when the user clicks Cancel. */
    readonly onCancel?: () => void;
    /** Whether the form is in a pending/saving state. */
    readonly isPending?: boolean;
    /** Label for the submit button. */
    readonly submitLabel?: string;
}

// ---------------------------------------------------------------------------
// Option lists
// ---------------------------------------------------------------------------

const GASTRONOMY_TYPE_OPTIONS: ReadonlyArray<{ value: GastronomyTypeEnum; label: string }> = [
    { value: GastronomyTypeEnum.RESTAURANT, label: 'Restaurante' },
    { value: GastronomyTypeEnum.BAR, label: 'Bar' },
    { value: GastronomyTypeEnum.CAFE, label: 'Café' },
    { value: GastronomyTypeEnum.PARRILLA, label: 'Parrilla' },
    { value: GastronomyTypeEnum.CERVECERIA, label: 'Cervecería' },
    { value: GastronomyTypeEnum.HELADERIA, label: 'Heladería' },
    { value: GastronomyTypeEnum.PANADERIA, label: 'Panadería' },
    { value: GastronomyTypeEnum.ROTISERIA, label: 'Rotisería' },
    { value: GastronomyTypeEnum.FOOD_TRUCK, label: 'Food Truck' }
];

const PRICE_RANGE_OPTIONS: ReadonlyArray<{ value: PriceRangeEnum; label: string }> = [
    { value: PriceRangeEnum.BUDGET, label: 'Económico ($)' },
    { value: PriceRangeEnum.MID, label: 'Intermedio ($$)' },
    { value: PriceRangeEnum.HIGH, label: 'Elevado ($$$)' },
    { value: PriceRangeEnum.PREMIUM, label: 'Premium ($$$$)' }
];

// ---------------------------------------------------------------------------
// Small field wrappers
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
 * Gastronomy create / edit form.
 *
 * Validates at submit via `GastronomyCreateHttpSchema.safeParse`.
 * Field-level errors are surfaced after a failed submit attempt.
 *
 * @param props - {@link GastronomyFormProps}
 */
export function GastronomyForm({
    defaultValues,
    onSubmit,
    onCancel,
    isPending = false,
    submitLabel = 'Guardar'
}: GastronomyFormProps) {
    const [globalError, setGlobalError] = React.useState<string | null>(null);

    const form = useForm<GastronomyFormValues>({
        defaultValues: {
            name: '',
            type: GastronomyTypeEnum.RESTAURANT,
            destinationId: '',
            isFeatured: false,
            ...defaultValues
        } as GastronomyFormValues,
        onSubmit: async ({ value }) => {
            setGlobalError(null);
            const result = GastronomyCreateHttpSchema.safeParse(value);
            if (!result.success) {
                const firstIssue = result.error.issues[0];
                setGlobalError(firstIssue?.message ?? 'Datos inválidos. Revisá el formulario.');
                return;
            }
            await onSubmit(result.data);
        }
    });

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
            }}
            aria-label="Formulario de gastronomía"
            noValidate
        >
            <div className="space-y-6">
                {/* ---- Identity ---- */}
                <section aria-labelledby="gastronomy-identity-heading">
                    <h3
                        id="gastronomy-identity-heading"
                        className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide"
                    >
                        Datos principales
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Name */}
                        <div className="sm:col-span-2">
                            <form.Field
                                name="name"
                                validators={{
                                    onChange: ({ value }) =>
                                        !value || value.trim().length < 2
                                            ? 'El nombre es requerido (mín. 2 caracteres)'
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
                                            value={field.state.value as string}
                                            onBlur={field.handleBlur}
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="Ej: La Parrilla de Juan"
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={isPending}
                                            aria-required="true"
                                        />
                                    </FieldWrapper>
                                )}
                            </form.Field>
                        </div>

                        {/* Summary */}
                        <div className="sm:col-span-2">
                            <form.Field name="summary">
                                {(field) => (
                                    <FieldWrapper
                                        label="Resumen"
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
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="Resumen corto (10–300 caracteres)"
                                            rows={2}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={isPending}
                                        />
                                    </FieldWrapper>
                                )}
                            </form.Field>
                        </div>

                        {/* Description */}
                        <div className="sm:col-span-2">
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
                                            onChange={(e) => field.handleChange(e.target.value)}
                                            placeholder="Descripción completa (20–2000 caracteres)"
                                            rows={4}
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={isPending}
                                        />
                                    </FieldWrapper>
                                )}
                            </form.Field>
                        </div>
                    </div>
                </section>

                {/* ---- Gastronomy-specific ---- */}
                <section aria-labelledby="gastronomy-specific-heading">
                    <h3
                        id="gastronomy-specific-heading"
                        className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-wide"
                    >
                        Detalles gastronómicos
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                    label="Tipo de establecimiento"
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
                                            field.handleChange(e.target.value as GastronomyTypeEnum)
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={isPending}
                                        aria-required="true"
                                    >
                                        <option value="">Seleccioná el tipo…</option>
                                        {GASTRONOMY_TYPE_OPTIONS.map((opt) => (
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

                        {/* Price range */}
                        <form.Field name="priceRange">
                            {(field) => (
                                <FieldWrapper
                                    label="Rango de precios"
                                    htmlFor={field.name}
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
                                            field.handleChange(
                                                (e.target.value as PriceRangeEnum) || undefined
                                            )
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={isPending}
                                    >
                                        <option value="">Sin rango asignado</option>
                                        {PRICE_RANGE_OPTIONS.map((opt) => (
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

                        {/* Menu URL */}
                        <div className="sm:col-span-2">
                            <form.Field name="menuUrl">
                                {(field) => (
                                    <FieldWrapper
                                        label="URL del menú online"
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
                                            onChange={(e) =>
                                                field.handleChange(e.target.value || undefined)
                                            }
                                            placeholder="https://tu-restaurante.com/menu"
                                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                            disabled={isPending}
                                        />
                                    </FieldWrapper>
                                )}
                            </form.Field>
                        </div>

                        {/* Destination ID */}
                        <form.Field
                            name="destinationId"
                            validators={{
                                onChange: ({ value }) =>
                                    !value || value.trim().length < 1
                                        ? 'El destino es requerido'
                                        : undefined
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="ID de destino"
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
                                        placeholder="UUID del destino"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={isPending}
                                        aria-required="true"
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>

                        {/* Owner ID */}
                        <form.Field name="ownerId">
                            {(field) => (
                                <FieldWrapper
                                    label="ID del propietario"
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
                                        value={(field.state.value as string) ?? ''}
                                        onBlur={field.handleBlur}
                                        onChange={(e) =>
                                            field.handleChange(e.target.value || undefined)
                                        }
                                        placeholder="UUID del propietario (opcional)"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={isPending}
                                    />
                                </FieldWrapper>
                            )}
                        </form.Field>
                    </div>
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
                            disabled={isPending}
                        >
                            Cancelar
                        </Button>
                    )}
                    <Button
                        type="submit"
                        disabled={isPending}
                    >
                        {isPending ? 'Guardando…' : submitLabel}
                    </Button>
                </div>
            </div>
        </form>
    );
}
