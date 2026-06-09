/**
 * AI Prompts Page
 *
 * Allows admins to view and manage system prompts for each AI feature.
 * Each feature shows the active prompt in a textarea, version history,
 * and the ability to create new versions and activate older ones.
 *
 * API surface:
 *   GET  /api/v1/admin/ai/prompts?feature=<AiFeature>  — list versions
 *   POST /api/v1/admin/ai/prompts                      — create + optionally activate
 */
import { SidebarPageLayout } from '@/components/layout/SidebarPageLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    type AiFeatureId,
    type AiPromptVersion,
    FEATURE_LABELS,
    useAiPromptsQuery,
    useCreateAiPromptMutation
} from '@/features/ai-settings';
import { useToast } from '@/hooks/use-toast';
import { getFriendlyErrorInfo, reportError } from '@/lib/errors';
import { AlertCircleIcon, CheckCircleIcon, LoaderIcon, SaveIcon } from '@repo/icons';
import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';

export const Route = createFileRoute('/_authed/ai/prompts')({
    component: AiPromptsPage
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_FEATURES: AiFeatureId[] = ['text_improve', 'chat', 'search', 'support'];

// ---------------------------------------------------------------------------
// FeaturePromptEditor (sub-component)
// ---------------------------------------------------------------------------

function FeaturePromptEditor({ feature }: { readonly feature: AiFeatureId }) {
    const { addToast } = useToast();
    const { data: prompts, isLoading, error } = useAiPromptsQuery(feature);
    const createMutation = useCreateAiPromptMutation();

    const activePrompt = prompts?.find((p) => p.isActive);
    const [draftContent, setDraftContent] = useState('');

    // Seed textarea when prompts load
    useEffect(() => {
        if (activePrompt) {
            setDraftContent(activePrompt.content);
        }
    }, [activePrompt]);

    // Report load errors to Sentry
    useEffect(() => {
        if (error) {
            reportError({
                error,
                source: 'AiPromptsPage',
                tags: { feature: 'ai', surface: 'prompts-load', featureId: feature }
            });
        }
    }, [error, feature]);

    const handleSaveAsNewVersion = async () => {
        if (!draftContent.trim()) return;
        try {
            await createMutation.mutateAsync({
                feature,
                content: draftContent.trim(),
                activate: true
            });
            addToast({
                title: 'Prompt guardado',
                message: `Nueva versión del prompt de ${FEATURE_LABELS[feature]} creada y activada.`,
                variant: 'success'
            });
        } catch (err) {
            addToast({
                title: 'Error al guardar',
                message: err instanceof Error ? err.message : 'No se pudo guardar el prompt.',
                variant: 'error'
            });
        }
    };

    const handleActivate = async (prompt: AiPromptVersion) => {
        try {
            await createMutation.mutateAsync({
                feature,
                content: prompt.content,
                activate: true
            });
            addToast({
                title: 'Prompt activado',
                message: `Versión ${prompt.version} de ${FEATURE_LABELS[feature]} activada.`,
                variant: 'success'
            });
        } catch (err) {
            addToast({
                title: 'Error al activar',
                message: err instanceof Error ? err.message : 'No se pudo activar el prompt.',
                variant: 'error'
            });
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (error) {
        const friendlyError = getFriendlyErrorInfo(error);
        return (
            <Card className="border-destructive/30 bg-destructive/5">
                <CardContent className="py-6">
                    <div className="flex items-start gap-3">
                        <AlertCircleIcon className="mt-0.5 h-5 w-5 text-destructive" />
                        <div>
                            <p className="font-medium text-destructive">{friendlyError.title}</p>
                            <p className="mt-1 text-destructive text-sm">
                                {friendlyError.description}
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const sortedPrompts = [...(prompts ?? [])].sort((a, b) => b.version - a.version);

    return (
        <Card>
            <CardHeader>
                <CardTitle>{FEATURE_LABELS[feature]}</CardTitle>
                <CardDescription>
                    {activePrompt
                        ? `Versión activa: v${activePrompt.version} — ${new Date(activePrompt.createdAt).toLocaleDateString('es-AR')}`
                        : 'No hay prompt activo para esta función.'}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Active prompt editor */}
                <div>
                    <Label htmlFor={`prompt-${feature}`}>Contenido del prompt activo</Label>
                    <Textarea
                        id={`prompt-${feature}`}
                        value={draftContent}
                        onChange={(e) => setDraftContent(e.target.value)}
                        placeholder="Escribí el system prompt para esta función..."
                        className="mt-2 min-h-[200px] font-mono text-sm"
                    />
                </div>

                <div className="flex justify-end">
                    <Button
                        onClick={handleSaveAsNewVersion}
                        disabled={
                            !draftContent.trim() ||
                            createMutation.isPending ||
                            draftContent.trim() === (activePrompt?.content ?? '')
                        }
                    >
                        {createMutation.isPending && (
                            <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        <SaveIcon className="mr-2 h-4 w-4" />
                        Guardar como nueva versión
                    </Button>
                </div>

                {/* Version history */}
                {sortedPrompts.length > 0 && (
                    <div className="border-t pt-4">
                        <Label>Historial de versiones</Label>
                        <div className="mt-2 space-y-2">
                            {sortedPrompts.map((prompt) => (
                                <div
                                    key={prompt.id}
                                    className="flex items-center justify-between rounded-md border p-3"
                                >
                                    <div className="flex items-center gap-3">
                                        {prompt.isActive && (
                                            <CheckCircleIcon className="h-4 w-4 text-green-600" />
                                        )}
                                        <div>
                                            <span className="font-medium text-sm">
                                                Versión {prompt.version}
                                            </span>
                                            {prompt.isActive && (
                                                <span className="ml-2 text-green-600 text-xs">
                                                    (activa)
                                                </span>
                                            )}
                                            <p className="text-muted-foreground text-xs">
                                                {new Date(prompt.createdAt).toLocaleDateString(
                                                    'es-AR',
                                                    {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {!prompt.isActive && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleActivate(prompt)}
                                            disabled={createMutation.isPending}
                                        >
                                            Activar
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

function AiPromptsPage() {
    return (
        <SidebarPageLayout>
            <div className="space-y-6">
                <div>
                    <h1 className="mb-2 font-bold text-2xl">Prompts IA</h1>
                    <p className="text-muted-foreground">
                        Gestiona los system prompts para cada función de IA. Cada cambio crea una
                        nueva versión que puede activarse o desactivarse.
                    </p>
                </div>

                {ALL_FEATURES.map((featureId) => (
                    <FeaturePromptEditor
                        key={featureId}
                        feature={featureId}
                    />
                ))}
            </div>
        </SidebarPageLayout>
    );
}
