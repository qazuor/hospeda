# Guía del Panel de Administración de Cron Jobs

## Descripción General

El panel de administración de cron jobs permite gestionar y monitorear las tareas programadas del sistema desde la interfaz de administración de Hospeda.

## Ubicación

- **Ruta**: `/billing/cron`
- **Menú**: Facturación → Tareas Programadas

## Características

### 1. Visualización de Jobs

Muestra todos los cron jobs registrados en el sistema con:

- **Nombre**: Identificador único del job
- **Descripción**: Explicación de qué hace el job
- **Programación**: Cuándo se ejecuta (ej: "Diariamente a medianoche")
- **Estado**: Activo o Deshabilitado

### 2. Estadísticas del Sistema

Panel con métricas clave:

- Total de tareas programadas
- Tareas activas
- Tareas deshabilitadas

### 3. Ejecución Manual

Para cada job activo, se puede:

- **Ejecutar manualmente**: Botón "Ejecutar ahora"
- **Modo Dry Run**: Switch para ejecutar en modo prueba sin hacer cambios reales
- **Ver resultados**: Información detallada después de la ejecución

### 4. Resultados de Ejecución

Después de ejecutar un job, se muestra:

- Estado: Éxito o Error
- Mensaje descriptivo
- Registros procesados
- Errores encontrados
- Duración en milisegundos
- Modo de ejecución (Prueba o Real)

### 5. Auto-actualización

- La lista de jobs se actualiza automáticamente cada minuto
- Indicador visual cuando se está actualizando

## Estructura de Archivos

```
apps/admin/src/features/cron-jobs/
├── components/
│   ├── CronJobCard.tsx        # Tarjeta individual de job
│   └── CronJobsPanel.tsx      # Panel principal
├── hooks.ts                   # TanStack Query hooks
├── types.ts                   # Definiciones TypeScript
└── index.ts                   # Barrel exports
```

## API Endpoints Utilizados

### GET /api/v1/cron

Lista todos los cron jobs registrados.

**Response:**

```typescript
{
  success: true,
  data: {
    jobs: CronJob[],
    totalJobs: number,
    enabledJobs: number
  }
}
```

### POST /api/v1/cron/:jobName

Ejecuta un cron job manualmente.

**Query params:**

- `dryRun` (optional): Si es "true", ejecuta en modo prueba

**Response:**

```typescript
{
  success: true,
  data: {
    success: boolean,
    message: string,
    processed: number,
    errors: number,
    durationMs: number,
    jobName: string,
    dryRun: boolean,
    executedAt: string
  }
}
```

## Tipos TypeScript

### CronJob

```typescript
interface CronJob {
  name: string;
  description: string;
  schedule: string;
  enabled: boolean;
}
```

### CronJobResult

```typescript
interface CronJobResult {
  success: boolean;
  message: string;
  processed: number;
  errors: number;
  durationMs: number;
  jobName: string;
  dryRun: boolean;
  executedAt: string;
}
```

## Hooks Disponibles

### useCronJobsQuery()

Obtiene la lista de todos los cron jobs.

```typescript
const { data, isLoading, error } = useCronJobsQuery();
```

**Características:**

- Stale time: 5 minutos
- Refetch interval: 1 minuto (auto-refresh)

### useTriggerCronJobMutation()

Ejecuta un cron job manualmente.

```typescript
const { mutate, isPending } = useTriggerCronJobMutation();

mutate(
  { jobName: 'cleanup-sessions', dryRun: true },
  {
    onSuccess: (response) => {
      console.log(response.data);
    }
  }
);
```

## Componentes

### CronJobCard

Tarjeta que muestra un cron job individual con capacidad de ejecución manual.

**Props:**

```typescript
interface CronJobCardProps {
  job: CronJob;
}
```

**Características:**

- Muestra información del job
- Switch para modo Dry Run
- Botón de ejecución manual
- Muestra último resultado
- Estados de loading y error

### CronJobsPanel

Panel principal que muestra todos los jobs y estadísticas.

**Características:**

- Estadísticas del sistema
- Lista de todos los jobs
- Auto-refresh con indicador
- Estados de loading, error y empty

## Permisos

El acceso a esta página está protegido por la autenticación del admin. Solo usuarios autenticados con acceso al panel de administración pueden ver y usar esta funcionalidad.

## Notas Importantes

1. **Dry Run**: Siempre está activado por defecto para evitar cambios accidentales
2. **Jobs deshabilitados**: No se pueden ejecutar manualmente
3. **Auto-refresh**: La lista se actualiza sola, no es necesario recargar la página
4. **Errores**: Se muestran de forma clara con mensajes descriptivos

## Casos de Uso

### Ejecutar job en modo prueba

1. Ir a `/billing/cron`
2. Encontrar el job deseado
3. Verificar que "Modo de prueba (Dry Run)" esté activado
4. Click en "Ejecutar ahora"
5. Ver resultados en la tarjeta

### Ejecutar job en modo real

1. Ir a `/billing/cron`
2. Encontrar el job deseado
3. Desactivar el switch "Modo de prueba (Dry Run)"
4. Click en "Ejecutar ahora"
5. Confirmar que entiendes que esto hará cambios reales
6. Ver resultados en la tarjeta

### Monitorear estado del sistema

1. Ir a `/billing/cron`
2. Revisar las tarjetas de estadísticas en la parte superior
3. Ver qué jobs están activos/deshabilitados
4. La página se actualiza automáticamente cada minuto

## Troubleshooting

### El job no aparece en la lista

- Verificar que el job esté registrado en `apps/api/src/cron/registry.ts`
- Verificar que el servidor API esté corriendo
- Revisar la consola del navegador para errores

### No se puede ejecutar un job

- Verificar que el job esté habilitado
- Verificar que la API esté respondiendo
- Revisar permisos de autenticación

### Los resultados no aparecen

- Verificar la respuesta de la API en Network tab
- Revisar errores en la consola
- Verificar que el endpoint `/api/v1/cron/:jobName` esté funcionando

## Desarrollo Futuro

Posibles mejoras:

- Historial de ejecuciones
- Gráficos de performance
- Notificaciones de errores
- Programación dinámica de jobs
- Logs detallados por ejecución
