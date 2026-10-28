/**
 * @file VenueForm.tsx
 * Standalone React form component for venue create / edit (SPEC-239 T-059).
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

import { PriceRangeEnum, VenueCreateHttpSchema, VenueTypeEnum } from '@repo/schemas';
import { useForm } from '@tanstack/react-form';
import * as React from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui-wrapped/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VenueFormValues = z.infer<typeof VenueCreateHttpSchema>;

/** Props accepted by {@link VenueForm}. */
export interface VenueFormProps {
    /**
     * Initial field values.  Pass the existing entity when editing;
     * omit (or pass `undefined`) when creating.
     */
    readonly defaultValues?: Partial<VenueFormValues>;
    /** Called with the validated form values when the user submits. */
    readonly onSubmit: (values: VenueFormValues) => Promise<void> | void;
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

const VENUE_TYPE_OPTIONS: ReadonlyArray<{ value: VenueTypeEnum; label: string }> = [
    { value: VenueTypeEnum.RESTAURANT, label: 'Restaurante' },
    { value: VenueTypeEnum.BAR, label: 'Bar' },
    { value: VenueTypeEnum.CAFE, label: 'Café' },
    { value: VenueTypeEnum.PARRILLA, label: 'Parrilla' },
    { value: VenueTypeEnum.CERVECERIA, label: 'Cervecería' },
    { value: VenueTypeEnum.HELADERIA, label: 'Heladería' },
    { value: VenueTypeEnum.PANADERIA, label: 'Panadería' },
    { value: VenueTypeEnum.ROTISERIA, label: 'Rotisería' },
    { value: VenueTypeEnum.FOOD_TRUCK, label: 'Food Truck' }
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
 * Venue create / edit form.
 *
 * Validates at submit via `VenueCreateHttpSchema.safeParse`.
 * Field-level errors are surfaced after a failed submit attempt.
 *
 * @param props - {@link VenueFormProps}
 */
export function VenueForm({
    defaultValues,
    onSubmit,
    onCancel,
    isPending = false,
    submitLabel = 'Guardar'
}: VenueFormProps) {
    const [globalError, setGlobalError] = React.useState<string | null>(null);

    const form = useForm<VenueFormValues>({
        defaultValues: {
            name: '',
            type: VenueTypeEnum.RESTAURANT,
            destinationId: '',
            ...defaultValues
        } as VenueFormValues,
        onSubmit: async ({ value }) => {
            setGlobalError(null);
            const result = VenueCreateHttpSchema.safeParse(value);
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

                {/* ---- Venue-specific ---- */}
                <section aria-labelledby="venue-specific-heading">
                    <h3
                        id="venue-specific-heading"
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
                                            field.handleChange(e.target.value as VenueTypeEnum)
                                        }
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={isPending}
                                        aria-required="true"
                                    >
                                        <option value="">Seleccioná el tipo…</option>
                                        {VENUE_TYPE_OPTIONS.map((opt) => (
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

                        {/*
                            Owner ID — REQUIRED (H-88). `venues.owner_id`
                            is NOT NULL with no default, so submitting without it
                            reached the database and came back as a bare 500
                            "A database error occurred". The field was labelled
                            optional, which is exactly what invited an operator
                            to leave it blank.
                        */}
                        <form.Field
                            name="ownerId"
                            validators={{
                                onChange: ({ value }) =>
                                    !value || String(value).trim().length < 1
                                        ? 'El propietario es requerido'
                                        : undefined
                            }}
                        >
                            {(field) => (
                                <FieldWrapper
                                    label="ID del propietario"
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
                                        // Raw value, not `|| undefined`: the field is
                                        // required now, so an empty string has to reach
                                        // the validator as an empty string rather than
                                        // vanishing from the payload (H-88).
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        placeholder="UUID del propietario"
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                        disabled={isPending}
                                        aria-required="true"
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
