/**
 * AI Settings Page
 *
 * Manages system-wide AI configuration: provider toggles, per-feature routing,
 * model parameters, and cost ceilings. The form binds to the nested blob
 * contract served by `GET/PUT /api/v1/admin/ai/settings` (see
 * packages/schemas/src/entities/ai/ai-settings.schema.ts).
 *
 * This is a single-page settings surface (NOT 4-page CRUD), matching the
 * pattern established by `billing/settings.tsx`.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
    type AiFeatureId,
    type AiProviderId,
    type AiSettingsValue,
    FEATURE_LABELS,
    getProviderLabel,
    useAiCredentialsQuery,
    useAiSettingsQuery,
    useUpdateAiSettingsMutation
} from '@/features/ai-settings';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorInfo, reportError } from '@/lib/errors';
import { AlertCircleIcon, LoaderIcon, SaveIcon } from '@repo/icons';
import { useForm } from '@tanstack/react-form';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useMemo } from 'react';

export const Route = createFileRoute('/_authed/ai/settings')({
    component: AiSettingsPage
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_FEATURES: AiFeatureId[] = ['text_improve', 'chat', 'search', 'support', 'translate'];

/** Default settings blob used when the API returns an empty/missing value. */
const DEFAULT_SETTINGS: AiSettingsValue = {
    providers: {
        openai: { enabled: false },
        anthropic: { enabled: false },
        stub: { enabled: true }
    },
    features: {
        text_improve: {
            enabled: false,
            primaryProvider: 'stub',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        chat: {
            enabled: false,
            primaryProvider: 'stub',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        search: {
            enabled: false,
            primaryProvider: 'stub',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        support: {
            enabled: false,
            primaryProvider: 'stub',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        },
        translate: {
            enabled: false,
            primaryProvider: 'stub',
            fallbackChain: [],
            model: 'gpt-4o-mini',
            params: {}
        }
    }
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Merge server settings with defaults, ensuring every field exists.
 * The API may omit optional fields; this fills them from DEFAULT_SETTINGS.
 */
function toFormValues(settings: AiSettingsValue | undefined): AiSettingsValue {
    if (!settings) return DEFAULT_SETTINGS;

    return {
        providers: settings.providers ?? DEFAULT_SETTINGS.providers,
        features: {
            text_improve: settings.features.text_improve ?? DEFAULT_SETTINGS.features.text_improve,
            chat: settings.features.chat ?? DEFAULT_SETTINGS.features.chat,
            search: settings.features.search ?? DEFAULT_SETTINGS.features.search,
            support: settings.features.support ?? DEFAULT_SETTINGS.features.support,
            translate: settings.features.translate ?? DEFAULT_SETTINGS.features.translate
        }
    };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AiSettingsPage() {
    const { addToast } = useToast();

    const { data: settingsResponse, isLoading, error } = useAiSettingsQuery();
    const updateMutation = useUpdateAiSettingsMutation();
    const { data: credentials } = useAiCredentialsQuery();

    // Derive provider list from credentials (for feature routing dropdowns)
    const knownProviders = useMemo(() => {
        return (credentials ?? []).map((c) => c.providerId);
    }, [credentials]);

    // Build providerId -> models[] map from credential metadata
    const providerModels = useMemo(() => {
        const map: Record<string, string[]> = {};
        for (const cred of credentials ?? []) {
            const meta = cred.metadata as Record<string, unknown> | undefined;
            const models = meta?.models;
            if (Array.isArray(models)) {
                map[cred.providerId] = models.filter((m): m is string => typeof m === 'string');
            }
        }
        return map;
    }, [credentials]);

    const form = useForm({
        defaultValues: DEFAULT_SETTINGS,
        onSubmit: async ({ value }) => {
            try {
                const saved = await updateMutation.mutateAsync(value);
                form.reset(toFormValues(saved.value));
                addToast({
                    title: 'Configuración guardada',
                    message: 'La configuración de IA se actualizó correctamente.',
                    variant: 'success'
                });
            } catch (err) {
                addToast({
                    title: 'Error al guardar',
                    message:
                        err instanceof Error ? err.message : 'No se pudo guardar la configuración.',
                    variant: 'error'
                });
            }
        }
    });

    // Seed form once settings load
    useEffect(() => {
        if (settingsResponse) {
            form.reset(toFormValues(settingsResponse.value));
        }
    }, [settingsResponse, form]);

    // Report load errors to Sentry
    useEffect(() => {
        if (error) {
            reportError({
                error,
                source: 'AiSettingsPage',
                tags: { feature: 'ai', surface: 'settings-load' }
            });
        }
    }, [error]);

    if (isLoading) {
        return (
            <SidebarPageLayout>
                <div className="flex items-center justify-center py-12">
                    <LoaderIcon className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </SidebarPageLayout>
        );
    }

    if (error) {
        const friendlyError = getFriendlyErrorInfo(error);
        return (
            <SidebarPageLayout>
                <div className="space-y-6">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">Configuración IA</h1>
                        <p className="text-muted-foreground">
                            Gestiona los proveedores, ruteo de funciones y costos de IA.
                        </p>
                    </div>
                    <Card className="border-destructive/30 bg-destructive/5">
                        <CardContent className="py-8">
                            <div className="flex items-start gap-3">
                                <AlertCircleIcon className="mt-0.5 h-5 w-5 text-destructive" />
                                <div>
                                    <p className="font-medium text-destructive">
                                        {friendlyError.title}
                                    </p>
                                    <p className="mt-1 text-destructive text-sm">
                                        {friendlyError.description}
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </SidebarPageLayout>
        );
    }

    const isApiAvailable = !!settingsResponse && !error;

    return (
        <SidebarPageLayout>
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit();
                }}
                className="space-y-6"
            >
                {/* Header + Save */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">Configuración IA</h1>
                        <p className="text-muted-foreground">
                            Gestiona los proveedores, ruteo de funciones y costos de IA.
                        </p>
                    </div>
                    <form.Subscribe selector={(state) => state.isDirty}>
                        {(isDirty) => (
                            <Button
                                type="submit"
                                disabled={!isDirty || updateMutation.isPending || !isApiAvailable}
                            >
                                {updateMutation.isPending && (
                                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                )}
                                <SaveIcon className="mr-2 h-4 w-4" />
                                Guardar cambios
                            </Button>
                        )}
                    </form.Subscribe>
                </div>

                {!isApiAvailable && (
                    <Card className="border-warning/30 bg-warning/10">
                        <CardContent className="py-4">
                            <p className="text-foreground text-sm">
                                <strong>Nota:</strong> La API no está disponible. Los cambios no se
                                guardarán.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* ── Feature Routing Section ────────────────────────────────── */}
                {ALL_FEATURES.map((featureId) => (
                    <Card key={featureId}>
                        <CardHeader>
                            <CardTitle>{FEATURE_LABELS[featureId]}</CardTitle>
                            <CardDescription>
                                Configuración de ruteo, modelo y parámetros para{' '}
                                {FEATURE_LABELS[featureId].toLowerCase()}.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Enable/disable feature */}
                            <form.Field name={`features.${featureId}.enabled`}>
                                {(field) => (
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <Label htmlFor={`feature-${featureId}`}>
                                                Habilitado
                                            </Label>
                                            <p className="text-muted-foreground text-xs">
                                                Kill-switch: al desactivar, la función se inhabilita
                                                para todos los usuarios.
                                            </p>
                                        </div>
                                        <Switch
                                            id={`feature-${featureId}`}
                                            checked={field.state.value}
                                            onCheckedChange={field.handleChange}
                                        />
                                    </div>
                                )}
                            </form.Field>

                            <div className="grid gap-6 md:grid-cols-2">
                                {/* Primary provider */}
                                <form.Field name={`features.${featureId}.primaryProvider`}>
                                    {(field) => (
                                        <div>
                                            <Label>Proveedor principal</Label>
                                            <Select
                                                value={field.state.value}
                                                onValueChange={(val) =>
                                                    field.handleChange(val as AiProviderId)
                                                }
                                            >
                                                <SelectTrigger className="mt-2">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {knownProviders.map((p) => (
                                                        <SelectItem
                                                            key={p}
                                                            value={p}
                                                        >
                                                            {getProviderLabel(p)}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    )}
                                </form.Field>

                                {/* Model */}
                                <form.Subscribe
                                    selector={(state) => {
                                        // `features` is a Partial map, so both lookups are
                                        // optional at the type level. The form is seeded by
                                        // toFormValues() which fills every feature key from
                                        // DEFAULT_SETTINGS, so a value is always present at
                                        // runtime; fall back defensively so we never assert
                                        // non-null (defaults mirror DEFAULT_SETTINGS).
                                        const fc =
                                            state.values.features[featureId] ??
                                            DEFAULT_SETTINGS.features[featureId];
                                        return {
                                            provider: fc?.primaryProvider ?? 'stub',
                                            model: fc?.model ?? ''
                                        };
                                    }}
                                >
                                    {({ provider }) => {
                                        const models = providerModels[provider] ?? [];

                                        if (models.length === 0) {
                                            return (
                                                <form.Field name={`features.${featureId}.model`}>
                                                    {(field) => (
                                                        <div>
                                                            <Label htmlFor={`model-${featureId}`}>
                                                                Modelo
                                                            </Label>
                                                            <Input
                                                                id={`model-${featureId}`}
                                                                value={field.state.value}
                                                                onChange={(e) =>
                                                                    field.handleChange(
                                                                        e.target.value
                                                                    )
                                                                }
                                                                onBlur={field.handleBlur}
                                                                placeholder="gpt-4o-mini"
                                                                className="mt-2"
                                                            />
                                                            <p className="mt-1 text-muted-foreground text-xs">
                                                                No hay modelos en credenciales para
                                                                este proveedor. Ingresá uno
                                                                manualmente.
                                                            </p>
                                                        </div>
                                                    )}
                                                </form.Field>
                                            );
                                        }

                                        return (
                                            <form.Field name={`features.${featureId}.model`}>
                                                {(field) => (
                                                    <div>
                                                        <Label>Modelo</Label>
                                                        <Select
                                                            value={field.state.value}
                                                            onValueChange={(val) =>
                                                                field.handleChange(val)
                                                            }
                                                        >
                                                            <SelectTrigger className="mt-2">
                                                                <SelectValue placeholder="Seleccioná un modelo..." />
                                                            </SelectTrigger>
                                                            <SelectContent className="z-[1001]">
                                                                {models.map((model) => (
                                                                    <SelectItem
                                                                        key={model}
                                                                        value={model}
                                                                    >
                                                                        {model}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <p className="mt-1 text-muted-foreground text-xs">
                                                            Modelos habilitados en credenciales para
                                                            este proveedor.
                                                        </p>
                                                    </div>
                                                )}
                                            </form.Field>
                                        );
                                    }}
                                </form.Subscribe>
                            </div>

                            {/* Model parameters */}
                            <div className="grid gap-6 md:grid-cols-3">
                                <form.Field name={`features.${featureId}.params.temperature`}>
                                    {(field) => (
                                        <div>
                                            <Label htmlFor={`temp-${featureId}`}>Temperature</Label>
                                            <Input
                                                id={`temp-${featureId}`}
                                                type="number"
                                                min={0}
                                                max={2}
                                                step={0.1}
                                                value={field.state.value ?? ''}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value)
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                placeholder="0.7"
                                                className="mt-2"
                                            />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name={`features.${featureId}.params.maxTokens`}>
                                    {(field) => (
                                        <div>
                                            <Label htmlFor={`tokens-${featureId}`}>
                                                Max tokens
                                            </Label>
                                            <Input
                                                id={`tokens-${featureId}`}
                                                type="number"
                                                min={1}
                                                value={field.state.value ?? ''}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value)
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                placeholder="4096"
                                                className="mt-2"
                                            />
                                        </div>
                                    )}
                                </form.Field>

                                <form.Field name={`features.${featureId}.params.topP`}>
                                    {(field) => (
                                        <div>
                                            <Label htmlFor={`topp-${featureId}`}>Top P</Label>
                                            <Input
                                                id={`topp-${featureId}`}
                                                type="number"
                                                min={0}
                                                max={1}
                                                step={0.1}
                                                value={field.state.value ?? ''}
                                                onChange={(e) =>
                                                    field.handleChange(
                                                        e.target.value === ''
                                                            ? undefined
                                                            : Number(e.target.value)
                                                    )
                                                }
                                                onBlur={field.handleBlur}
                                                placeholder="1.0"
                                                className="mt-2"
                                            />
                                        </div>
                                    )}
                                </form.Field>
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {/* ── Footer Actions ────────────────────────────────────────── */}
                <div className="flex justify-end gap-4 border-t pt-6">
                    <form.Subscribe selector={(state) => state.isDirty}>
                        {(isDirty) => (
                            <>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        form.reset(
                                            settingsResponse
                                                ? toFormValues(settingsResponse.value)
                                                : undefined
                                        );
                                    }}
                                    disabled={!isDirty || updateMutation.isPending}
                                >
                                    Descartar cambios
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        !isDirty || updateMutation.isPending || !isApiAvailable
                                    }
                                >
                                    {updateMutation.isPending && (
                                        <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                                    )}
                                    <SaveIcon className="mr-2 h-4 w-4" />
                                    Guardar configuración
                                </Button>
                            </>
                        )}
                    </form.Subscribe>
                </div>
            </form>
        </SidebarPageLayout>
    );
}
