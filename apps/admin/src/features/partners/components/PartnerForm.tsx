import {
    type CreatePartner,
    LifecycleStatusEnum,
    type Partner,
    PartnerSubscriptionStatusEnum,
    PartnerTierEnum,
    PartnerTypeEnum,
    type UpdatePartner
} from '@repo/schemas';
import { useEffect, useState } from 'react';
import type { PartnerAdminPlanOption } from '../hooks/usePartnerQuery';

interface PartnerFormProps {
    readonly initialData?: Partner | null;
    readonly plans: readonly PartnerAdminPlanOption[];
    readonly isSubmitting: boolean;
    readonly submitLabel: string;
    readonly onSubmit: (data: CreatePartner | UpdatePartner) => Promise<void> | void;
}

interface PartnerFormState {
    readonly name: string;
    readonly slug: string;
    readonly type: PartnerTypeEnum;
    readonly tier: PartnerTierEnum;
    readonly logoUrl: string;
    readonly websiteUrl: string;
    readonly description: string;
    readonly planId: string;
    readonly startsAt: string;
    readonly endsAt: string;
}

function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

function toInputDate(value: Date | string | null | undefined): string {
    if (!value) return '';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

function getInitialState(initialData?: Partner | null): PartnerFormState {
    return {
        name: initialData?.name ?? '',
        slug: initialData?.slug ?? '',
        type: initialData?.type ?? PartnerTypeEnum.COMMERCE,
        tier: initialData?.tier ?? PartnerTierEnum.GOLD,
        logoUrl: initialData?.logoUrl ?? '',
        websiteUrl: initialData?.websiteUrl ?? '',
        description: initialData?.description ?? '',
        planId: initialData?.planId ?? '',
        startsAt: toInputDate(initialData?.startsAt) || new Date().toISOString().slice(0, 10),
        endsAt: toInputDate(initialData?.endsAt)
    };
}

export function PartnerForm({
    initialData,
    plans,
    isSubmitting,
    submitLabel,
    onSubmit
}: PartnerFormProps) {
    const [form, setForm] = useState<PartnerFormState>(() => getInitialState(initialData));

    useEffect(() => {
        setForm(getInitialState(initialData));
    }, [initialData]);

    return (
        <form
            className="space-y-6"
            onSubmit={async (event) => {
                event.preventDefault();

                const payload = {
                    name: form.name.trim(),
                    slug: (form.slug.trim() || slugify(form.name)).trim(),
                    type: form.type,
                    tier: form.tier,
                    logoUrl: form.logoUrl.trim() || null,
                    websiteUrl: form.websiteUrl.trim() || null,
                    description: form.description.trim() || null,
                    planId: form.planId || null,
                    subscriptionStatus:
                        initialData?.subscriptionStatus ?? PartnerSubscriptionStatusEnum.PENDING,
                    lifecycleState: initialData?.lifecycleState ?? LifecycleStatusEnum.ACTIVE,
                    startsAt: new Date(form.startsAt),
                    endsAt: form.endsAt ? new Date(form.endsAt) : null
                } satisfies CreatePartner | UpdatePartner;

                await onSubmit(payload);
            }}
        >
            <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Nombre</span>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.name}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                name: event.target.value,
                                slug: current.slug ? current.slug : slugify(event.target.value)
                            }))
                        }
                        required
                    />
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Slug</span>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.slug}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, slug: event.target.value }))
                        }
                        required
                    />
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Tipo</span>
                    <select
                        className="w-full rounded-md border px-3 py-2"
                        value={form.type}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                type: event.target.value as PartnerTypeEnum
                            }))
                        }
                    >
                        <option value="commerce">Comercio</option>
                        <option value="ngo">ONG</option>
                        <option value="institution">Institución</option>
                    </select>
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Tier</span>
                    <select
                        className="w-full rounded-md border px-3 py-2"
                        value={form.tier}
                        onChange={(event) =>
                            setForm((current) => ({
                                ...current,
                                tier: event.target.value as PartnerTierEnum
                            }))
                        }
                    >
                        <option value="gold">Gold</option>
                        <option value="silver">Silver</option>
                        <option value="bronze">Bronze</option>
                    </select>
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium">Plan de billing</span>
                    <select
                        className="w-full rounded-md border px-3 py-2"
                        value={form.planId}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, planId: event.target.value }))
                        }
                        required
                    >
                        <option value="">Seleccionar plan</option>
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
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Logo URL</span>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.logoUrl}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, logoUrl: event.target.value }))
                        }
                    />
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Sitio web</span>
                    <input
                        className="w-full rounded-md border px-3 py-2"
                        value={form.websiteUrl}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, websiteUrl: event.target.value }))
                        }
                    />
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Inicio</span>
                    <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2"
                        value={form.startsAt}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, startsAt: event.target.value }))
                        }
                        required
                    />
                </label>
                <label className="space-y-2 text-sm">
                    <span className="font-medium">Fin</span>
                    <input
                        type="date"
                        className="w-full rounded-md border px-3 py-2"
                        value={form.endsAt}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, endsAt: event.target.value }))
                        }
                    />
                </label>
                <label className="space-y-2 text-sm md:col-span-2">
                    <span className="font-medium">Descripción</span>
                    <textarea
                        className="min-h-32 w-full rounded-md border px-3 py-2"
                        value={form.description}
                        onChange={(event) =>
                            setForm((current) => ({ ...current, description: event.target.value }))
                        }
                    />
                </label>
            </div>

            <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50"
                disabled={isSubmitting}
            >
                {isSubmitting ? 'Guardando...' : submitLabel}
            </button>
        </form>
    );
}
