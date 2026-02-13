import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Loader2, Send } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { FileUploadZone } from './FileUploadZone';
import { ThankYouMessage } from './ThankYouMessage';

/** Linear label from API */
interface LinearLabel {
    id: string;
    name: string;
    color: string;
    parentName: string | null;
}

/** Spanish display names for type:* and module:* labels */
const LABEL_DISPLAY_NAMES: Record<string, string> = {
    'type:bug-functional': 'Bug funcional',
    'type:bug-visual': 'Bug visual',
    'type:bug-copy': 'Error de texto',
    'type:bug-performance': 'Problema de rendimiento',
    'type:bug-crash': 'Crash / error critico',
    'type:bug-data': 'Error de datos',
    'type:bug-integration': 'Error de integracion',
    'type:feature-request': 'Solicitud de funcionalidad',
    'type:ui-improvement': 'Mejora de interfaz',
    'type:ux-improvement': 'Mejora de experiencia',
    'type:feedback-general': 'Feedback general',
    'type:user-question': 'Pregunta / consulta',
    'module:auth': 'Autenticacion',
    'module:dashboard': 'Dashboard',
    'module:onboarding': 'Registro / Onboarding',
    'module:payments': 'Pagos',
    'module:settings': 'Configuracion',
    'module:notifications': 'Notificaciones',
    'module:conversations': 'Conversaciones',
    'module:agents': 'Agentes',
    'module:integrations': 'Integraciones',
    'module:admin-panel': 'Panel de admin',
    'module:analytics': 'Estadisticas'
};

/** Returns a human-friendly Spanish display name for a Linear label */
function getLabelDisplayName(name: string): string {
    return LABEL_DISPLAY_NAMES[name] ?? name.split(':').pop() ?? name;
}

/** Priority options with Spanish labels and Linear values */
const PRIORITY_OPTIONS = [
    { value: '1', label: 'Urgente' },
    { value: '2', label: 'Alta' },
    { value: '3', label: 'Media' },
    { value: '4', label: 'Baja' }
] as const;

/** Severity options with Spanish labels and API values */
const SEVERITY_OPTIONS = [
    { value: 'severity:blocker', label: 'Bloqueante' },
    { value: 'severity:major', label: 'Mayor' },
    { value: 'severity:minor', label: 'Menor' },
    { value: 'severity:cosmetic', label: 'Cosmetico' }
] as const;

type FormState = 'idle' | 'loading' | 'success' | 'error';

interface FormData {
    title: string;
    description: string;
    priority: string;
    severity: string;
    categoryLabelId: string;
    tagLabelIds: string[];
    stepsToReproduce: string;
    expectedBehavior: string;
    actualBehavior: string;
}

interface FormErrors {
    title?: string;
    description?: string;
    priority?: string;
    severity?: string;
}

interface SubmitResult {
    issueUrl: string;
    identifier: string;
}

const INITIAL_FORM_DATA: FormData = {
    title: '',
    description: '',
    priority: '3',
    severity: 'severity:minor',
    categoryLabelId: '',
    tagLabelIds: [],
    stepsToReproduce: '',
    expectedBehavior: '',
    actualBehavior: ''
};

interface BugReportFormProps {
    apiBaseUrl: string;
    reporterName: string;
    reporterEmail: string;
}

/**
 * Main bug report form component.
 * Fetches labels from Linear, validates form data, uploads files,
 * and submits the report to the API.
 */
export function BugReportForm({ apiBaseUrl, reporterName, reporterEmail }: BugReportFormProps) {
    const [formState, setFormState] = useState<FormState>('idle');
    const [formData, setFormData] = useState<FormData>(INITIAL_FORM_DATA);
    const [files, setFiles] = useState<File[]>([]);
    const [errors, setErrors] = useState<FormErrors>({});
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
    const [labels, setLabels] = useState<LinearLabel[]>([]);
    const [labelsLoading, setLabelsLoading] = useState(true);

    // Fetch labels on mount
    useEffect(() => {
        const fetchLabels = async () => {
            try {
                const response = await fetch(`${apiBaseUrl}/api/v1/reports/labels`, {
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    const labelsData = data?.data?.labels ?? data?.labels ?? [];
                    setLabels(labelsData);
                }
            } catch {
                // Labels are optional, form works without them
            } finally {
                setLabelsLoading(false);
            }
        };
        fetchLabels();
    }, [apiBaseUrl]);

    // Derived label groups: type:* for categories, module:* for tags
    const categoryLabels = labels.filter((l) => l.name.startsWith('type:'));
    const tagLabels = labels.filter((l) => l.name.startsWith('module:'));

    const updateField = useCallback(<K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: undefined }));
    }, []);

    const toggleTag = useCallback((tagId: string) => {
        setFormData((prev) => {
            const current = prev.tagLabelIds;
            if (current.includes(tagId)) {
                return { ...prev, tagLabelIds: current.filter((id) => id !== tagId) };
            }
            if (current.length >= 5) return prev;
            return { ...prev, tagLabelIds: [...current, tagId] };
        });
    }, []);

    const validate = useCallback((): boolean => {
        const newErrors: FormErrors = {};

        if (!formData.title || formData.title.length < 5) {
            newErrors.title = 'El titulo debe tener al menos 5 caracteres';
        }
        if (formData.title.length > 200) {
            newErrors.title = 'El titulo no puede exceder 200 caracteres';
        }
        if (!formData.description || formData.description.length < 10) {
            newErrors.description = 'La descripcion debe tener al menos 10 caracteres';
        }
        if (formData.description.length > 5000) {
            newErrors.description = 'La descripcion no puede exceder 5000 caracteres';
        }
        if (!formData.priority) {
            newErrors.priority = 'Selecciona una prioridad';
        }
        if (!formData.severity) {
            newErrors.severity = 'Selecciona una severidad';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData]);

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault();
            if (!validate()) return;

            setFormState('loading');
            setSubmitError(null);

            try {
                // Auto-capture browser metadata
                const metadata = {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    screenResolution: `${screen.width}x${screen.height}`,
                    timestamp: new Date().toISOString(),
                    language: navigator.language
                };

                // Build JSON payload
                const payload = {
                    reporterName,
                    reporterEmail,
                    title: formData.title,
                    description: formData.description,
                    priority: Number(formData.priority),
                    severity: formData.severity,
                    categoryLabelId: formData.categoryLabelId || null,
                    tagLabelIds: formData.tagLabelIds,
                    stepsToReproduce: formData.stepsToReproduce || null,
                    expectedBehavior: formData.expectedBehavior || null,
                    actualBehavior: formData.actualBehavior || null,
                    metadata
                };

                // Build FormData for multipart upload
                const multipartData = new FormData();
                multipartData.append('data', JSON.stringify(payload));
                for (const file of files) {
                    multipartData.append('files', file);
                }

                const response = await fetch(`${apiBaseUrl}/api/v1/reports/create`, {
                    method: 'POST',
                    credentials: 'include',
                    body: multipartData
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(
                        result?.error?.message ?? 'Error al enviar el reporte. Intenta nuevamente.'
                    );
                }

                setSubmitResult({
                    issueUrl: result.data.issueUrl,
                    identifier: result.data.identifier
                });
                setFormState('success');
            } catch (err) {
                setSubmitError(
                    err instanceof Error ? err.message : 'Error inesperado. Intenta nuevamente.'
                );
                setFormState('error');
            }
        },
        [apiBaseUrl, files, formData, reporterEmail, reporterName, validate]
    );

    const handleReportAnother = useCallback(() => {
        setFormData(INITIAL_FORM_DATA);
        setFiles([]);
        setErrors({});
        setSubmitError(null);
        setSubmitResult(null);
        setFormState('idle');
    }, []);

    // Success state
    if (formState === 'success' && submitResult) {
        return (
            <ThankYouMessage
                issueUrl={submitResult.issueUrl}
                identifier={submitResult.identifier}
                onReportAnother={handleReportAnother}
            />
        );
    }

    const isSubmitting = formState === 'loading';

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-6"
        >
            {/* Error banner */}
            {submitError && (
                <div className="flex items-start gap-3 rounded-md border border-destructive/50 bg-destructive/5 p-4">
                    <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
                    <div>
                        <p className="font-medium text-destructive text-sm">
                            Error al enviar el reporte
                        </p>
                        <p className="mt-1 text-destructive/80 text-sm">{submitError}</p>
                    </div>
                </div>
            )}

            {/* Reporter info (read-only) */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-base">Reportado por</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                            <Label className="text-muted-foreground text-xs">Nombre</Label>
                            <p className="mt-1 font-medium text-sm">
                                {reporterName || 'Sin nombre'}
                            </p>
                        </div>
                        <div>
                            <Label className="text-muted-foreground text-xs">Email</Label>
                            <p className="mt-1 font-medium text-sm">{reporterEmail}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Title */}
            <div className="space-y-2">
                <Label htmlFor="title">
                    Titulo <span className="text-destructive">*</span>
                </Label>
                <Input
                    id="title"
                    placeholder="Describe brevemente el problema"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    maxLength={200}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.title}
                />
                {errors.title && <p className="text-destructive text-sm">{errors.title}</p>}
                <p className="text-right text-muted-foreground text-xs">
                    {formData.title.length}/200
                </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
                <Label htmlFor="description">
                    Descripcion <span className="text-destructive">*</span>
                </Label>
                <Textarea
                    id="description"
                    placeholder="Explica en detalle que paso, donde lo viste, y cualquier informacion relevante"
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    maxLength={5000}
                    rows={5}
                    disabled={isSubmitting}
                    aria-invalid={!!errors.description}
                />
                {errors.description && (
                    <p className="text-destructive text-sm">{errors.description}</p>
                )}
                <p className="text-right text-muted-foreground text-xs">
                    {formData.description.length}/5000
                </p>
            </div>

            {/* Priority & Severity */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="priority">
                        Prioridad <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={formData.priority}
                        onValueChange={(val) => updateField('priority', val)}
                        disabled={isSubmitting}
                    >
                        <SelectTrigger
                            id="priority"
                            aria-invalid={!!errors.priority}
                        >
                            <SelectValue placeholder="Seleccionar prioridad" />
                        </SelectTrigger>
                        <SelectContent>
                            {PRIORITY_OPTIONS.map((opt) => (
                                <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                >
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.priority && (
                        <p className="text-destructive text-sm">{errors.priority}</p>
                    )}
                </div>

                <div className="space-y-2">
                    <Label htmlFor="severity">
                        Severidad <span className="text-destructive">*</span>
                    </Label>
                    <Select
                        value={formData.severity}
                        onValueChange={(val) => updateField('severity', val)}
                        disabled={isSubmitting}
                    >
                        <SelectTrigger
                            id="severity"
                            aria-invalid={!!errors.severity}
                        >
                            <SelectValue placeholder="Seleccionar severidad" />
                        </SelectTrigger>
                        <SelectContent>
                            {SEVERITY_OPTIONS.map((opt) => (
                                <SelectItem
                                    key={opt.value}
                                    value={opt.value}
                                >
                                    {opt.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {errors.severity && (
                        <p className="text-destructive text-sm">{errors.severity}</p>
                    )}
                </div>
            </div>

            {/* Category (type:* labels) */}
            {!labelsLoading && categoryLabels.length > 0 && (
                <div className="space-y-2">
                    <Label htmlFor="category">Tipo de reporte</Label>
                    <Select
                        value={formData.categoryLabelId}
                        onValueChange={(val) => updateField('categoryLabelId', val)}
                        disabled={isSubmitting}
                    >
                        <SelectTrigger id="category">
                            <SelectValue placeholder="Seleccionar tipo (opcional)" />
                        </SelectTrigger>
                        <SelectContent>
                            {categoryLabels.map((label) => (
                                <SelectItem
                                    key={label.id}
                                    value={label.id}
                                >
                                    <span className="flex items-center gap-2">
                                        <span
                                            className="inline-block h-2.5 w-2.5 rounded-full"
                                            style={{ backgroundColor: label.color }}
                                        />
                                        {getLabelDisplayName(label.name)}
                                    </span>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Tags (module:* labels) */}
            {!labelsLoading && tagLabels.length > 0 && (
                <div className="space-y-2">
                    <Label>Modulo afectado (max 5)</Label>
                    <div className="flex flex-wrap gap-2">
                        {tagLabels.map((label) => {
                            const isSelected = formData.tagLabelIds.includes(label.id);
                            return (
                                <button
                                    key={label.id}
                                    type="button"
                                    onClick={() => toggleTag(label.id)}
                                    disabled={
                                        isSubmitting ||
                                        (!isSelected && formData.tagLabelIds.length >= 5)
                                    }
                                    className="focus:outline-none"
                                >
                                    <Badge
                                        variant={isSelected ? 'default' : 'outline'}
                                        className={`cursor-pointer transition-colors ${
                                            isSelected ? '' : 'hover:bg-accent'
                                        }`}
                                    >
                                        <span
                                            className="mr-1.5 inline-block h-2 w-2 rounded-full"
                                            style={{ backgroundColor: label.color }}
                                        />
                                        {getLabelDisplayName(label.name)}
                                    </Badge>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Steps to Reproduce */}
            <div className="space-y-2">
                <Label htmlFor="steps">Pasos para reproducir</Label>
                <Textarea
                    id="steps"
                    placeholder="1. Ir a la pagina X&#10;2. Hacer click en Y&#10;3. Observar el error"
                    value={formData.stepsToReproduce}
                    onChange={(e) => updateField('stepsToReproduce', e.target.value)}
                    maxLength={5000}
                    rows={4}
                    disabled={isSubmitting}
                />
            </div>

            {/* Expected vs Actual */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="expected">Comportamiento esperado</Label>
                    <Textarea
                        id="expected"
                        placeholder="Que esperabas que pasara"
                        value={formData.expectedBehavior}
                        onChange={(e) => updateField('expectedBehavior', e.target.value)}
                        maxLength={5000}
                        rows={3}
                        disabled={isSubmitting}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="actual">Comportamiento actual</Label>
                    <Textarea
                        id="actual"
                        placeholder="Que paso realmente"
                        value={formData.actualBehavior}
                        onChange={(e) => updateField('actualBehavior', e.target.value)}
                        maxLength={5000}
                        rows={3}
                        disabled={isSubmitting}
                    />
                </div>
            </div>

            {/* File upload */}
            <div className="space-y-2">
                <Label>Adjuntos</Label>
                <FileUploadZone
                    files={files}
                    onFilesChange={setFiles}
                />
            </div>

            {/* Submit */}
            <div className="flex justify-end pt-4">
                <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[160px] gap-2"
                >
                    {isSubmitting ? (
                        <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Enviando...
                        </>
                    ) : (
                        <>
                            <Send className="h-4 w-4" />
                            Enviar Reporte
                        </>
                    )}
                </Button>
            </div>
        </form>
    );
}
