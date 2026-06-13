/**
 * AI Playground Page
 *
 * A debug/testing zone where admins can test AI features in real-time.
 * Supports chat streaming via SSE, and displays metadata (provider, model,
 * tokens, conversation ID) after each response.
 *
 * API surface:
 *   POST /api/v1/protected/ai/chat — SSE streaming chat endpoint
 *   GET  /api/v1/admin/ai/prompts?feature=<AiFeature> — read system prompt (for display)
 *   GET  /api/v1/admin/accommodations?search=<q> — accommodation search for combobox
 *   GET  /api/v1/admin/ai/settings — read AI settings (params display)
 *   PUT  /api/v1/admin/ai/settings — save playground config as settings
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
    type AiFeatureId,
    type AiModelParams,
    type AiSettingsValue,
    FEATURE_LABELS,
    useAiPromptsQuery,
    useAiSettingsQuery,
    useCreateAiPromptMutation,
    useUpdateAiSettingsMutation
} from '@/features/ai-settings';
import { useToast } from '@/hooks/use-toast';
import { AlertCircleIcon, DeleteIcon, SaveIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccommodationCombobox } from './-components/AccommodationCombobox';
import { AdvancedSettingsPanel } from './-components/AdvancedSettingsPanel';
import { MessagesArea } from './-components/MessagesArea';
import { streamChat } from './-components/stream-chat';

export const Route = createFileRoute('/_authed/ai/playground')({
    component: AiPlaygroundPage
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_FEATURES: AiFeatureId[] = ['text_improve', 'chat', 'search', 'support', 'translate'];

const DEFAULT_PARAMS: AiModelParams = {
    temperature: 0.7,
    maxTokens: 1000,
    topP: 1
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaygroundMessage {
    readonly role: 'user' | 'assistant' | 'system' | 'error';
    readonly content: string;
    readonly timestamp: number;
    readonly debugInfo?: DebugInfo;
    readonly debugContext?: DebugContext;
}

/** Debug metadata attached to each assistant message. */
interface DebugInfo {
    readonly provider: string;
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly finishReason: string;
    readonly conversationId?: string;
}

/** Debug context data sent before the stream starts. */
interface DebugContext {
    readonly contextBlock: string;
    readonly resolvedPrompt: string;
    readonly systemMessage: string;
    readonly feature: string;
    readonly accommodationId?: string;
}

interface StreamMetadata {
    readonly provider: string;
    readonly model: string;
    readonly promptTokens: number;
    readonly completionTokens: number;
    readonly totalTokens: number;
    readonly finishReason: string;
    readonly conversationId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function AiPlaygroundPage() {
    // Feature selector
    const [selectedFeature, setSelectedFeature] = useState<AiFeatureId>('chat');
    const [accommodationId, setAccommodationId] = useState('');
    const [inputMessage, setInputMessage] = useState('');

    // Advanced settings
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [overrideParams, setOverrideParams] = useState<AiModelParams>(DEFAULT_PARAMS);

    // Chat state
    const [messages, setMessages] = useState<PlaygroundMessage[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [currentAssistantContent, setCurrentAssistantContent] = useState('');
    const [metadata, setMetadata] = useState<StreamMetadata | null>(null);
    const [currentDebugContext, setCurrentDebugContext] = useState<DebugContext | null>(null);

    // Queries & mutations
    const { data: prompts } = useAiPromptsQuery(selectedFeature);
    const activePrompt = prompts?.find((p) => p.isActive);
    const { data: settingsData } = useAiSettingsQuery();
    const updateSettingsMutation = useUpdateAiSettingsMutation();
    const createPromptMutation = useCreateAiPromptMutation();
    const { addToast } = useToast();

    // Editable prompt content
    const [promptContent, setPromptContent] = useState('');

    useEffect(() => {
        if (activePrompt) {
            setPromptContent(activePrompt.content);
        }
    }, [activePrompt]);

    // Current settings params for display
    const currentFeatureConfig = settingsData?.value.features[selectedFeature];
    const currentParams: AiModelParams = currentFeatureConfig?.params ?? DEFAULT_PARAMS;

    // Abort controller ref
    const abortRef = useRef<AbortController | null>(null);

    // Messages end ref for auto-scroll
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const handleSend = async () => {
        const text = inputMessage.trim();
        if (!text || isStreaming) return;

        const userMessage: PlaygroundMessage = {
            role: 'user',
            content: text,
            timestamp: Date.now()
        };

        setMessages((prev) => [...prev, userMessage]);
        setInputMessage('');
        setIsStreaming(true);
        setCurrentAssistantContent('');
        setMetadata(null);
        setCurrentDebugContext(null);

        const abortController = new AbortController();
        abortRef.current = abortController;

        let assistantContent = '';

        await streamChat({
            feature: selectedFeature,
            message: text,
            accommodationId: accommodationId || undefined,
            signal: abortController.signal,
            onEvent: (event) => {
                switch (event.type) {
                    case 'token':
                        assistantContent += event.delta;
                        setCurrentAssistantContent(assistantContent);
                        scrollToBottom();
                        break;

                    case 'debug': {
                        const ctx: DebugContext = {
                            contextBlock: String(event.data.contextBlock ?? ''),
                            resolvedPrompt: String(event.data.resolvedPrompt ?? ''),
                            systemMessage: String(event.data.systemMessage ?? ''),
                            feature: String(event.data.feature ?? ''),
                            accommodationId: event.data.accommodationId as string | undefined
                        };
                        setCurrentDebugContext(ctx);
                        break;
                    }

                    case 'done': {
                        const doneDebug: DebugInfo = {
                            provider: String(event.data.provider ?? ''),
                            model: String(event.data.model ?? ''),
                            promptTokens: Number(
                                (event.data.usage as Record<string, unknown>)?.promptTokens ?? 0
                            ),
                            completionTokens: Number(
                                (event.data.usage as Record<string, unknown>)?.completionTokens ?? 0
                            ),
                            totalTokens: Number(
                                (event.data.usage as Record<string, unknown>)?.totalTokens ?? 0
                            ),
                            finishReason: String(event.data.finishReason ?? ''),
                            conversationId: event.data.conversationId as string | undefined
                        };
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: 'assistant',
                                content: assistantContent,
                                timestamp: Date.now(),
                                debugInfo: doneDebug,
                                debugContext: currentDebugContext ?? undefined
                            }
                        ]);
                        setCurrentAssistantContent('');
                        setIsStreaming(false);
                        setMetadata(doneDebug);
                        scrollToBottom();
                        break;
                    }

                    case 'error':
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: 'error',
                                content: `[${event.code}] ${event.message}`,
                                timestamp: Date.now()
                            }
                        ]);
                        setCurrentAssistantContent('');
                        setIsStreaming(false);
                        scrollToBottom();
                        break;

                    case 'stream_error':
                        setMessages((prev) => [
                            ...prev,
                            {
                                role: 'error',
                                content: event.error.message,
                                timestamp: Date.now()
                            }
                        ]);
                        setCurrentAssistantContent('');
                        setIsStreaming(false);
                        scrollToBottom();
                        break;
                }
            }
        });
    };

    const handleAbort = () => {
        abortRef.current?.abort();
        setIsStreaming(false);
        setCurrentAssistantContent('');
    };

    const handleClear = () => {
        setMessages([]);
        setCurrentAssistantContent('');
        setMetadata(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleSaveSettings = async () => {
        if (!settingsData) {
            addToast({
                title: 'Error',
                message: 'No hay configuración cargada.',
                variant: 'error'
            });
            return;
        }

        const currentValue = settingsData.value;

        const updatedFeatures = {
            ...currentValue.features,
            [selectedFeature]: {
                ...currentValue.features[selectedFeature],
                params: overrideParams
            }
        };

        const payload: AiSettingsValue = {
            ...currentValue,
            features: updatedFeatures as AiSettingsValue['features']
        };

        try {
            await updateSettingsMutation.mutateAsync(payload);

            // Also save the prompt if it changed
            if (promptContent.trim() && promptContent !== activePrompt?.content) {
                await createPromptMutation.mutateAsync({
                    feature: selectedFeature,
                    content: promptContent.trim(),
                    activate: true
                });
            }

            addToast({
                title: 'Guardado',
                message: `Configuración de "${FEATURE_LABELS[selectedFeature]}" actualizada.`,
                variant: 'success'
            });
        } catch {
            addToast({
                title: 'Error',
                message: 'No se pudo guardar la configuración.',
                variant: 'error'
            });
        }
    };

    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="mb-2 font-bold text-2xl">Playground IA</h1>
                        <p className="text-muted-foreground">
                            Zona de prueba y depuración para las funciones de IA. Enviá mensajes y
                            observá la respuesta en tiempo real.
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        onClick={handleClear}
                        disabled={messages.length === 0 && !isStreaming}
                    >
                        <DeleteIcon className="mr-2 h-4 w-4" />
                        Limpiar
                    </Button>
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left column — Controls + Messages */}
                    <div className="space-y-4 lg:col-span-2">
                        {/* Feature selector + inputs */}
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-lg">Configuración</CardTitle>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveSettings}
                                        disabled={
                                            updateSettingsMutation.isPending ||
                                            createPromptMutation.isPending
                                        }
                                    >
                                        <SaveIcon className="mr-1 h-4 w-4" />
                                        {updateSettingsMutation.isPending ||
                                        createPromptMutation.isPending
                                            ? 'Guardando...'
                                            : 'Guardar configuración'}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div>
                                        <Label>Función</Label>
                                        <Select
                                            value={selectedFeature}
                                            onValueChange={(v) =>
                                                setSelectedFeature(v as AiFeatureId)
                                            }
                                        >
                                            <SelectTrigger className="mt-2">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ALL_FEATURES.map((f) => (
                                                    <SelectItem
                                                        key={f}
                                                        value={f}
                                                    >
                                                        {FEATURE_LABELS[f]}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {selectedFeature === 'chat' && (
                                        <AccommodationCombobox
                                            value={accommodationId}
                                            onChange={setAccommodationId}
                                        />
                                    )}
                                </div>

                                {/* Advanced Settings */}
                                <AdvancedSettingsPanel
                                    params={overrideParams}
                                    onChange={setOverrideParams}
                                    currentParams={currentParams}
                                    isOpen={showAdvanced}
                                    onToggle={() => setShowAdvanced(!showAdvanced)}
                                />
                            </CardContent>
                        </Card>

                        {/* Messages area */}
                        <MessagesArea
                            messages={messages}
                            isStreaming={isStreaming}
                            currentAssistantContent={currentAssistantContent}
                            inputMessage={inputMessage}
                            onInputChange={setInputMessage}
                            onSend={handleSend}
                            onAbort={handleAbort}
                            onKeyDown={handleKeyDown}
                            messagesEndRef={messagesEndRef}
                        />
                    </div>

                    {/* Right column — Metadata + System prompt */}
                    <div className="space-y-4">
                        {/* Metadata */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Metadatos</CardTitle>
                                <CardDescription>
                                    Información de la última respuesta generada.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {metadata ? (
                                    <dl className="space-y-3 text-sm">
                                        <div>
                                            <dt className="text-muted-foreground">Proveedor</dt>
                                            <dd className="font-mono">{metadata.provider}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-muted-foreground">Modelo</dt>
                                            <dd className="font-mono">{metadata.model}</dd>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2">
                                            <div>
                                                <dt className="text-muted-foreground text-xs">
                                                    Prompt
                                                </dt>
                                                <dd className="font-mono text-xs">
                                                    {metadata.promptTokens}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-muted-foreground text-xs">
                                                    Respuesta
                                                </dt>
                                                <dd className="font-mono text-xs">
                                                    {metadata.completionTokens}
                                                </dd>
                                            </div>
                                            <div>
                                                <dt className="text-muted-foreground text-xs">
                                                    Total
                                                </dt>
                                                <dd className="font-mono text-xs">
                                                    {metadata.totalTokens}
                                                </dd>
                                            </div>
                                        </div>
                                        <div>
                                            <dt className="text-muted-foreground">Finish reason</dt>
                                            <dd className="font-mono">{metadata.finishReason}</dd>
                                        </div>
                                        {metadata.conversationId && (
                                            <div>
                                                <dt className="text-muted-foreground">
                                                    Conversation ID
                                                </dt>
                                                <dd className="break-all font-mono text-xs">
                                                    {metadata.conversationId}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        Los metadatos aparecerán después de la primera respuesta.
                                    </p>
                                )}
                            </CardContent>
                        </Card>

                        {/* System prompt display */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">System Prompt Activo</CardTitle>
                                <CardDescription>
                                    Editá el system prompt y la configuración de la función (
                                    {FEATURE_LABELS[selectedFeature]}).
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {activePrompt ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">
                                                Versión {activePrompt.version}
                                            </span>
                                            <span className="text-muted-foreground">
                                                {new Date(
                                                    activePrompt.createdAt
                                                ).toLocaleDateString('es-AR')}
                                            </span>
                                        </div>
                                        <Textarea
                                            value={promptContent}
                                            onChange={(e) => setPromptContent(e.target.value)}
                                            className="min-h-[200px] font-mono text-xs"
                                            placeholder="Escribí el system prompt para esta función..."
                                        />
                                    </div>
                                ) : (
                                    <div className="flex items-start gap-2">
                                        <AlertCircleIcon className="mt-0.5 h-4 w-4 text-muted-foreground" />
                                        <p className="text-muted-foreground text-sm">
                                            No hay prompt activo para esta función. Creá uno en la
                                            página de Prompts.
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </SidebarPageLayout>
    );
}
