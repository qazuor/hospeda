/**
 * AI Credentials Page
 *
 * Manages provider API credentials (masked display, create, rotate, delete).
 * NOT standard entity CRUD — each provider has at most one credential, and
 * operations are provider-scoped (rotate/delete by providerId).
 *
 * Uses Card-based layout instead of DataTable since the list is bounded
 * to 3 providers max.
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog';
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
    type AiCredentialMasked,
    type AiProviderId,
    getProviderLabel,
    useAiCredentialsQuery,
    useCreateAiCredentialMutation,
    useDeleteAiCredentialMutation,
    useRotateAiCredentialMutation,
    useUpdateAiCredentialMutation
} from '@/features/ai-settings';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorInfo, reportError } from '@/lib/errors';
import { AddIcon, AlertCircleIcon, DeleteIcon, EditIcon, LoaderIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/ai/credentials')({
    component: AiCredentialsPage
});

// ---------------------------------------------------------------------------
// Known providers metadata
// ---------------------------------------------------------------------------

interface KnownProvider {
    id: string;
    label: string;
    apiKeyPlaceholder: string;
    baseURL: string;
    keyUrl: string;
    models: readonly string[];
    needsApiKey: boolean;
}

const KNOWN_PROVIDERS: readonly KnownProvider[] = [
    {
        id: 'openai',
        label: 'OpenAI (GPT)',
        apiKeyPlaceholder: 'sk-...',
        baseURL: 'https://api.openai.com/v1',
        keyUrl: 'https://platform.openai.com/api-keys',
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'o3-mini'],
        needsApiKey: true
    },
    {
        id: 'anthropic',
        label: 'Anthropic (Claude)',
        apiKeyPlaceholder: 'sk-ant-...',
        baseURL: 'https://api.anthropic.com/v1',
        keyUrl: 'https://console.anthropic.com/settings/keys',
        models: ['claude-sonnet-4-20250514', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
        needsApiKey: true
    },
    {
        id: 'google',
        label: 'Google (Gemini)',
        apiKeyPlaceholder: 'AIza...',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        keyUrl: 'https://aistudio.google.com/apikey',
        models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash'],
        needsApiKey: true
    },
    {
        id: 'deepseek',
        label: 'DeepSeek',
        apiKeyPlaceholder: 'sk-...',
        baseURL: 'https://api.deepseek.com/v1',
        keyUrl: 'https://platform.deepseek.com/api_keys',
        models: ['deepseek-chat', 'deepseek-reasoner'],
        needsApiKey: true
    },
    {
        id: 'groq',
        label: 'Groq',
        apiKeyPlaceholder: 'gsk_...',
        baseURL: 'https://api.groq.com/openai/v1',
        keyUrl: 'https://console.groq.com/keys',
        models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
        needsApiKey: true
    },
    {
        id: 'together',
        label: 'Together AI',
        apiKeyPlaceholder: '...',
        baseURL: 'https://api.together.xyz/v1',
        keyUrl: 'https://api.together.xyz/settings/api-keys',
        models: ['meta-llama/Llama-3.3-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
        needsApiKey: true
    },
    {
        id: 'mistral',
        label: 'Mistral AI',
        apiKeyPlaceholder: '...',
        baseURL: 'https://api.mistral.ai/v1',
        keyUrl: 'https://console.mistral.ai/api-keys/',
        models: ['mistral-large-latest', 'mistral-small-latest', 'codestral-latest'],
        needsApiKey: true
    },
    {
        id: 'moonshot',
        label: 'Moonshot (Kimi)',
        apiKeyPlaceholder: 'sk-...',
        baseURL: 'https://api.moonshot.cn/v1',
        keyUrl: 'https://platform.moonshot.cn/console/api-keys',
        models: ['moonshot-v1-128k', 'moonshot-v1-32k', 'moonshot-v1-8k'],
        needsApiKey: true
    },
    {
        id: 'zhipu',
        label: 'Zhipu AI (GLM)',
        apiKeyPlaceholder: '...',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys',
        models: ['glm-4-plus', 'glm-4-flash', 'glm-4-long'],
        needsApiKey: true
    },
    {
        id: 'baidu',
        label: 'Baidu (ERNIE)',
        apiKeyPlaceholder: '...',
        baseURL: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop',
        keyUrl: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application',
        models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-128k'],
        needsApiKey: true
    },
    {
        id: 'ollama',
        label: 'Ollama (local)',
        apiKeyPlaceholder: 'ollama (no key needed)',
        baseURL: 'http://localhost:11434/v1',
        keyUrl: '',
        models: ['llama3', 'mistral', 'codellama', 'qwen2.5'],
        needsApiKey: false
    }
] as const;

const CUSTOM_OPTION_ID = '__custom__';

function getKnownProvider(id: string): KnownProvider | undefined {
    return KNOWN_PROVIDERS.find((p) => p.id === id);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Create credential dialog state. */
function CreateCredentialDialog() {
    const { addToast } = useToast();
    const createMutation = useCreateAiCredentialMutation();
    const [open, setOpen] = useState(false);
    const [selectedProvider, setSelectedProvider] = useState('');
    const [customProvider, setCustomProvider] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [label, setLabel] = useState('');
    const [baseURL, setBaseURL] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [disabledModels, setDisabledModels] = useState<string[]>([]);
    const [newModel, setNewModel] = useState('');

    const isCustom = selectedProvider === CUSTOM_OPTION_ID;
    const effectiveProvider = isCustom ? customProvider.trim() : selectedProvider;
    const known = getKnownProvider(effectiveProvider);

    // Reset form when dialog opens/closes
    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (!nextOpen) {
            setSelectedProvider('');
            setCustomProvider('');
            setApiKey('');
            setLabel('');
            setBaseURL('');
            setSelectedModels([]);
            setDisabledModels([]);
        }
    };

    // Auto-fill when a known provider is selected
    const handleProviderSelect = (value: string) => {
        setSelectedProvider(value);
        const meta = getKnownProvider(value);
        if (meta) {
            setBaseURL(meta.baseURL);
            setLabel(meta.label);
            setSelectedModels([]);
        } else {
            setBaseURL('');
            setLabel('');
            setSelectedModels([]);
        }
    };

    const toggleModel = (model: string) => {
        setDisabledModels((prev) =>
            prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
        );
    };

    const addCustomModel = () => {
        const m = newModel.trim();
        if (!m || selectedModels.includes(m)) return;
        setSelectedModels((prev) => [...prev, m]);
        setNewModel('');
    };

    const handleSubmit = async () => {
        if (!effectiveProvider) return;
        if (known ? known.needsApiKey && !apiKey : !apiKey) return;
        try {
            await createMutation.mutateAsync({
                providerId: effectiveProvider,
                plaintextKey: apiKey || 'no-key-needed',
                label: label || undefined,
                metadata: {
                    ...(baseURL ? { baseURL } : {}),
                    ...(selectedModels.length > 0 ? { models: selectedModels } : {})
                }
            });
            addToast({
                title: 'Credencial creada',
                message: `Credencial de ${getProviderLabel(effectiveProvider)} creada correctamente.`,
                variant: 'success'
            });
            handleOpenChange(false);
        } catch (err) {
            addToast({
                title: 'Error al crear',
                message: err instanceof Error ? err.message : 'No se pudo crear la credencial.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogTrigger asChild>
                <Button>
                    <AddIcon className="mr-2 h-4 w-4" />
                    Agregar proveedor
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Agregar proveedor de IA</DialogTitle>
                    <DialogDescription>
                        Seleccioná un proveedor conocido o agregá uno personalizado.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Provider selector */}
                    <div>
                        <Label>Proveedor</Label>
                        <Select
                            value={selectedProvider}
                            onValueChange={handleProviderSelect}
                        >
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="Seleccioná un proveedor..." />
                            </SelectTrigger>
                            <SelectContent className="z-[1001]">
                                {KNOWN_PROVIDERS.map((p) => (
                                    <SelectItem
                                        key={p.id}
                                        value={p.id}
                                    >
                                        {p.label}
                                    </SelectItem>
                                ))}
                                <SelectItem value={CUSTOM_OPTION_ID}>
                                    + Proveedor personalizado
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Custom provider ID input */}
                    {isCustom && (
                        <div>
                            <Label htmlFor="custom-provider-id">ID del proveedor</Label>
                            <Input
                                id="custom-provider-id"
                                value={customProvider}
                                onChange={(e) => setCustomProvider(e.target.value)}
                                placeholder="mi-proveedor, local-llm..."
                                className="mt-2"
                            />
                            <p className="mt-1 text-muted-foreground text-xs">
                                Cualquier ID. Si es una API compatible con OpenAI, ingresá la base
                                URL.
                            </p>
                        </div>
                    )}

                    {/* API Key */}
                    {selectedProvider && (
                        <div>
                            <Label htmlFor="create-api-key">API Key</Label>
                            <Input
                                id="create-api-key"
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                placeholder={known?.apiKeyPlaceholder ?? 'sk-...'}
                                className="mt-2"
                            />
                            {known?.keyUrl && (
                                <p className="mt-1 text-xs">
                                    <a
                                        href={known.keyUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary underline-offset-2 hover:underline"
                                    >
                                        Obtener key →
                                    </a>
                                </p>
                            )}
                        </div>
                    )}

                    {/* Base URL */}
                    {selectedProvider && (
                        <div>
                            <Label htmlFor="create-base-url">Base URL</Label>
                            <Input
                                id="create-base-url"
                                value={baseURL}
                                onChange={(e) => setBaseURL(e.target.value)}
                                placeholder={known?.baseURL ?? 'https://api.example.com/v1'}
                                className="mt-2"
                            />
                            <p className="mt-1 text-muted-foreground text-xs">
                                {isCustom
                                    ? 'Para APIs compatibles con OpenAI, ingresá la URL base.'
                                    : 'Podés modificarla si usás un proxy o endpoint personalizado.'}
                            </p>
                        </div>
                    )}

                    {/* Label */}
                    {selectedProvider && (
                        <div>
                            <Label htmlFor="create-label">Etiqueta (opcional)</Label>
                            <Input
                                id="create-label"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Mi key de producción"
                                className="mt-2"
                            />
                        </div>
                    )}

                    {/* Model selector (only for known providers) */}
                    {known && (
                        <div className="border-t pt-4">
                            <Label>Modelos habilitados</Label>
                            <p className="mb-3 text-muted-foreground text-xs">
                                Activá los modelos que querés habilitar para este proveedor.
                            </p>
                            <div className="grid gap-2">
                                {/* Predefined models */}
                                {known.models.map((model) => {
                                    const isEnabled = !disabledModels.includes(model);
                                    return (
                                        <div
                                            key={model}
                                            className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50"
                                        >
                                            <span className="font-mono text-xs">{model}</span>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={isEnabled}
                                                    onCheckedChange={() => toggleModel(model)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        setSelectedModels((prev) =>
                                                            prev.filter((m) => m !== model)
                                                        )
                                                    }
                                                >
                                                    <DeleteIcon className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Custom models (added by user) */}
                                {selectedModels
                                    .filter((m) => !known.models.includes(m))
                                    .map((model) => {
                                        const isEnabled = !disabledModels.includes(model);
                                        return (
                                            <div
                                                key={model}
                                                className="flex items-center justify-between rounded-md border border-dashed p-2"
                                            >
                                                <span className="font-mono text-xs">{model}</span>
                                                <div className="flex items-center gap-2">
                                                    <Switch
                                                        checked={isEnabled}
                                                        onCheckedChange={() => toggleModel(model)}
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                        onClick={() =>
                                                            setSelectedModels((prev) =>
                                                                prev.filter((m) => m !== model)
                                                            )
                                                        }
                                                    >
                                                        <DeleteIcon className="h-3 w-3" />
                                                    </Button>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                            {/* Add custom model */}
                            <div className="mt-3 flex items-end gap-2">
                                <div className="flex-1">
                                    <Input
                                        value={newModel}
                                        onChange={(e) => setNewModel(e.target.value)}
                                        placeholder="Agregar modelo no listado..."
                                        className="h-8 text-xs"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomModel();
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addCustomModel}
                                    disabled={!newModel.trim()}
                                >
                                    Agregar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={createMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={
                            !effectiveProvider ||
                            (known ? known.needsApiKey && !apiKey : !apiKey) ||
                            createMutation.isPending
                        }
                    >
                        {createMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Crear
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Rotate credential dialog state. */
function RotateCredentialDialog({
    providerId,
    currentLabel
}: {
    readonly providerId: AiProviderId;
    readonly currentLabel: string | null;
}) {
    const { addToast } = useToast();
    const rotateMutation = useRotateAiCredentialMutation();
    const [open, setOpen] = useState(false);
    const [newKey, setNewKey] = useState('');

    const handleSubmit = async () => {
        try {
            await rotateMutation.mutateAsync({
                providerId,
                payload: { newPlaintextKey: newKey }
            });
            addToast({
                title: 'Clave rotada',
                message: `La clave de ${getProviderLabel(providerId)} se actualizó correctamente.`,
                variant: 'success'
            });
            setOpen(false);
            setNewKey('');
        } catch (err) {
            addToast({
                title: 'Error al rotar',
                message: err instanceof Error ? err.message : 'No se pudo rotar la clave.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                >
                    Rotar clave
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Rotar clave — {getProviderLabel(providerId)}</DialogTitle>
                    <DialogDescription>
                        {currentLabel
                            ? `Reemplaza la clave actual de "${currentLabel}".`
                            : 'Reemplaza la clave actual de este proveedor.'}
                    </DialogDescription>
                </DialogHeader>
                <div>
                    <Label htmlFor={`rotate-key-${providerId}`}>Nueva API Key</Label>
                    <Input
                        id={`rotate-key-${providerId}`}
                        type="password"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        placeholder="sk-..."
                        className="mt-2"
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={rotateMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={!newKey || rotateMutation.isPending}
                    >
                        {rotateMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Rotar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Edit credential metadata dialog. */
function EditCredentialDialog({
    credential
}: {
    readonly credential: AiCredentialMasked;
}) {
    const { addToast } = useToast();
    const updateMutation = useUpdateAiCredentialMutation();
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState('');
    const [baseURL, setBaseURL] = useState('');
    const [selectedModels, setSelectedModels] = useState<string[]>([]);
    const [newModel, setNewModel] = useState('');

    const known = getKnownProvider(credential.providerId);

    // Pre-fill from credential metadata when dialog opens
    const handleOpenChange = (nextOpen: boolean) => {
        setOpen(nextOpen);
        if (nextOpen) {
            setLabel(credential.label ?? '');
            const meta = credential.metadata ?? {};
            setBaseURL(typeof meta.baseURL === 'string' ? meta.baseURL : '');
            setSelectedModels(Array.isArray(meta.models) ? (meta.models as string[]) : []);
        }
    };

    const toggleModel = (model: string) => {
        setSelectedModels((prev) =>
            prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model]
        );
    };

    const addCustomModel = () => {
        const m = newModel.trim();
        if (!m || selectedModels.includes(m)) return;
        setSelectedModels((prev) => [...prev, m]);
        setNewModel('');
    };

    const handleSubmit = async () => {
        try {
            const metadata: Record<string, unknown> = {};
            if (baseURL) metadata.baseURL = baseURL;
            if (selectedModels.length > 0) metadata.models = selectedModels;

            await updateMutation.mutateAsync({
                providerId: credential.providerId,
                payload: {
                    label: label || undefined,
                    metadata: Object.keys(metadata).length > 0 ? metadata : undefined
                }
            });
            addToast({
                title: 'Credencial actualizada',
                message: `Los metadatos de ${getProviderLabel(credential.providerId)} se actualizaron.`,
                variant: 'success'
            });
            setOpen(false);
        } catch (err) {
            addToast({
                title: 'Error al actualizar',
                message:
                    err instanceof Error ? err.message : 'No se pudieron actualizar los metadatos.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={handleOpenChange}
        >
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                >
                    <EditIcon className="mr-1 h-3.5 w-3.5" />
                    Editar
                </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Editar — {getProviderLabel(credential.providerId)}</DialogTitle>
                    <DialogDescription>
                        Actualizá la etiqueta y los modelos habilitados. La clave API no se
                        modifica.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Label */}
                    <div>
                        <Label htmlFor={`edit-label-${credential.providerId}`}>Etiqueta</Label>
                        <Input
                            id={`edit-label-${credential.providerId}`}
                            value={label}
                            onChange={(e) => setLabel(e.target.value)}
                            placeholder="Mi key de producción"
                            className="mt-2"
                        />
                    </div>

                    {/* Base URL */}
                    <div>
                        <Label htmlFor={`edit-base-url-${credential.providerId}`}>Base URL</Label>
                        <Input
                            id={`edit-base-url-${credential.providerId}`}
                            value={baseURL}
                            onChange={(e) => setBaseURL(e.target.value)}
                            placeholder={known?.baseURL ?? 'https://api.example.com/v1'}
                            className="mt-2"
                        />
                    </div>

                    {/* Model selector */}
                    {known && (
                        <div className="border-t pt-4">
                            <Label>Modelos habilitados</Label>
                            <p className="mb-3 text-muted-foreground text-xs">
                                Activá los modelos que querés habilitar para este proveedor.
                            </p>
                            <div className="grid gap-2">
                                {/* Predefined models */}
                                {known.models.map((model) => {
                                    const isEnabled = selectedModels.includes(model);
                                    return (
                                        <div
                                            key={model}
                                            className="flex items-center justify-between rounded-md border p-2 hover:bg-muted/50"
                                        >
                                            <span className="font-mono text-xs">{model}</span>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={isEnabled}
                                                    onCheckedChange={() => toggleModel(model)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        setSelectedModels((prev) =>
                                                            prev.filter((m) => m !== model)
                                                        )
                                                    }
                                                >
                                                    <DeleteIcon className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    );
                                })}
                                {/* Custom models (not in known list) */}
                                {selectedModels
                                    .filter((m) => !known.models.includes(m))
                                    .map((model) => (
                                        <div
                                            key={model}
                                            className="flex items-center justify-between rounded-md border border-dashed p-2"
                                        >
                                            <span className="font-mono text-xs">{model}</span>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={true}
                                                    onCheckedChange={() => toggleModel(model)}
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                                    onClick={() =>
                                                        setSelectedModels((prev) =>
                                                            prev.filter((m) => m !== model)
                                                        )
                                                    }
                                                >
                                                    <DeleteIcon className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                            </div>
                            {/* Add custom model */}
                            <div className="mt-3 flex items-end gap-2">
                                <div className="flex-1">
                                    <Input
                                        value={newModel}
                                        onChange={(e) => setNewModel(e.target.value)}
                                        placeholder="Agregar modelo no listado..."
                                        className="h-8 text-xs"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addCustomModel();
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addCustomModel}
                                    disabled={!newModel.trim()}
                                >
                                    Agregar
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={updateMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={updateMutation.isPending}
                    >
                        {updateMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Guardar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/** Delete credential dialog state. */
function DeleteCredentialDialog({
    providerId,
    currentLabel
}: {
    readonly providerId: AiProviderId;
    readonly currentLabel: string | null;
}) {
    const { addToast } = useToast();
    const deleteMutation = useDeleteAiCredentialMutation();
    const [open, setOpen] = useState(false);

    const handleDelete = async () => {
        try {
            await deleteMutation.mutateAsync(providerId);
            addToast({
                title: 'Credencial eliminada',
                message: `La credencial de ${getProviderLabel(providerId)} se eliminó.`,
                variant: 'success'
            });
            setOpen(false);
        } catch (err) {
            addToast({
                title: 'Error al eliminar',
                message: err instanceof Error ? err.message : 'No se pudo eliminar la credencial.',
                variant: 'error'
            });
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={setOpen}
        >
            <DialogTrigger asChild>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                >
                    <DeleteIcon className="h-4 w-4" />
                </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Eliminar credencial</DialogTitle>
                    <DialogDescription>
                        ¿Eliminar la credencial de {getProviderLabel(providerId)}
                        {currentLabel ? ` ("${currentLabel}")` : ''}? Esta acción no se puede
                        deshacer.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setOpen(false)}
                        disabled={deleteMutation.isPending}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                    >
                        {deleteMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Eliminar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ---------------------------------------------------------------------------
// Credential card
// ---------------------------------------------------------------------------

function CredentialCard({
    credential
}: {
    readonly credential: AiCredentialMasked;
}) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div>
                    <CardTitle className="text-lg">
                        {getProviderLabel(credential.providerId)}
                    </CardTitle>
                    <CardDescription>{credential.label ?? 'Sin etiqueta'}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <EditCredentialDialog credential={credential} />
                    <RotateCredentialDialog
                        providerId={credential.providerId}
                        currentLabel={credential.label}
                    />
                    <DeleteCredentialDialog
                        providerId={credential.providerId}
                        currentLabel={credential.label}
                    />
                </div>
            </CardHeader>
            <CardContent>
                <dl className="grid gap-4 text-sm md:grid-cols-3">
                    <div>
                        <dt className="text-muted-foreground">ID</dt>
                        <dd className="font-mono text-xs">{credential.id}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Proveedor</dt>
                        <dd>{credential.providerId}</dd>
                    </div>
                    <div>
                        <dt className="text-muted-foreground">Creado</dt>
                        <dd>{new Date(credential.createdAt).toLocaleDateString('es-AR')}</dd>
                    </div>
                </dl>
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function AiCredentialsPage() {
    const { data: credentials, isLoading, error } = useAiCredentialsQuery();

    // Report load errors to Sentry
    useEffect(() => {
        if (error) {
            reportError({
                error,
                source: 'AiCredentialsPage',
                tags: { feature: 'ai', surface: 'credentials-load' }
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
                        <h1 className="mb-2 font-bold text-2xl">Credenciales IA</h1>
                        <p className="text-muted-foreground">
                            Gestiona las API keys de los proveedores de IA.
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

    const credentialList = credentials ?? [];

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">Credenciales IA</h1>
                        <p className="text-muted-foreground">
                            Gestiona las API keys de los proveedores de IA. Las claves se almacenan
                            de forma segura y se muestran enmascaradas.
                        </p>
                    </div>
                    <CreateCredentialDialog />
                </div>

                {/* Existing credentials */}
                {credentialList.length > 0 ? (
                    <div className="space-y-4">
                        {credentialList.map((cred) => (
                            <CredentialCard
                                key={cred.id}
                                credential={cred}
                            />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardContent className="py-8 text-center">
                            <p className="text-muted-foreground">
                                No hay credenciales configuradas. Agrega una para comenzar a usar
                                IA.
                            </p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </SidebarPageLayout>
    );
}
