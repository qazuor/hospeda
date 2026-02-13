import { z } from 'zod';

/** Maximum file size in bytes (10MB) */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

/** Maximum number of files per report */
export const MAX_FILES = 5;

/** Allowed MIME types for file uploads */
export const ALLOWED_FILE_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'video/mp4',
    'video/webm',
    'application/pdf',
    'text/plain',
    'text/x-log'
] as const;

/** Browser metadata captured automatically on the client */
export const BrowserMetadataSchema = z.object({
    userAgent: z.string(),
    platform: z.string(),
    screenResolution: z.string(),
    timestamp: z.string(),
    language: z.string()
});

/** Schema for the bug report form submission data (JSON payload) */
export const BugReportFormSchema = z.object({
    reporterName: z.string().min(1, 'Reporter name is required'),
    reporterEmail: z.string().email('Reporter email must be valid'),
    title: z
        .string()
        .min(5, 'Title must be at least 5 characters')
        .max(200, 'Title must be at most 200 characters'),
    description: z
        .string()
        .min(10, 'Description must be at least 10 characters')
        .max(5000, 'Description must be at most 5000 characters'),
    stepsToReproduce: z.string().max(5000).nullable().optional(),
    expectedBehavior: z.string().max(5000).nullable().optional(),
    actualBehavior: z.string().max(5000).nullable().optional(),
    priority: z.number().int().min(1).max(4),
    severity: z.enum(['severity:blocker', 'severity:major', 'severity:minor', 'severity:cosmetic']),
    categoryLabelId: z.string().nullable().optional(),
    tagLabelIds: z.array(z.string()).max(5).optional().default([]),
    metadata: BrowserMetadataSchema
});

/** Schema for the response after creating a bug report */
export const BugReportResponseSchema = z.object({
    issueId: z.string(),
    issueUrl: z.string(),
    identifier: z.string()
});

/** Schema for a single Linear label in the labels endpoint response */
export const LinearLabelSchema = z.object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    parentName: z.string().nullable()
});

/** Schema for the labels endpoint response */
export const LinearLabelsResponseSchema = z.object({
    labels: z.array(LinearLabelSchema)
});

/** Priority mapping from numeric value to Spanish display label */
export const PRIORITY_LABELS: Record<number, string> = {
    1: 'Urgente',
    2: 'Alta',
    3: 'Media',
    4: 'Baja'
};

/** Severity mapping from schema value to Spanish display label */
export const SEVERITY_LABELS: Record<string, string> = {
    'severity:blocker': 'Bloqueante',
    'severity:major': 'Mayor',
    'severity:minor': 'Menor',
    'severity:cosmetic': 'Cosmetico'
};

/** Spanish display names for type:* labels (report category) */
export const TYPE_LABELS: Record<string, string> = {
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
    'type:user-question': 'Pregunta / consulta'
};

/** Spanish display names for module:* labels (affected module) */
export const MODULE_LABELS: Record<string, string> = {
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

export type BugReportFormData = z.infer<typeof BugReportFormSchema>;
export type BugReportResponse = z.infer<typeof BugReportResponseSchema>;
export type BrowserMetadata = z.infer<typeof BrowserMetadataSchema>;
