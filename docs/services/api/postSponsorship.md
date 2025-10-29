# Post Sponsorship Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Gestión de Patrocinios](#gestion-de-patrocinios)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `PostSponsorshipService` gestiona las relaciones de patrocinio entre publicaciones y patrocinadores. Establece el vínculo contractual entre contenido turístico y marcas que financian su promoción, incluyendo términos económicos, duración y condiciones del patrocinio.

### Entidad PostSponsorship

Un patrocinio incluye:

- **Relación**: Conexión entre Post y PostSponsor específicos
- **Términos Económicos**: Monto, moneda, modalidad de pago
- **Duración**: Fechas de inicio y fin del patrocinio
- **Estado**: Activo, completado, cancelado
- **Condiciones**: Términos específicos del acuerdo
- **Métricas**: KPIs y resultados del patrocinio

### Casos de Uso

- **Contenido Patrocinado**: Posts financiados por marcas
- **Promoción de Destinos**: Patrocinio de artículos turísticos
- **Campañas Publicitarias**: Asociación marca-contenido
- **Marketing de Influencia**: Colaboraciones con creadores

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: PostSponsorshipCreateInput)

Crea una nueva relación de patrocinio.

**Ejemplo:**

```typescript
{
    postId: "post_patagonia_adventure",
    sponsorId: "sponsor_latam_airlines", 
    amount: 5000,
    currency: "USD",
    startDate: "2024-01-15",
    endDate: "2024-02-15",
    status: "ACTIVE",
    terms: "Patrocinio de campaña promocional de turismo aventura en Patagonia, incluye menciones en redes sociales",
    paymentTerms: "50% al inicio, 50% al completar métricas acordadas"
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene patrocinio por ID
- `list(actor, params)` - Lista patrocinios con filtros
- `update/patch(actor, id, input)` - Actualiza patrocinio
- `softDelete/hardDelete(actor, id)` - Elimina patrocinio

## 💼 Gestión de Patrocinios {#gestion-de-patrocinios}

### Estados de Patrocinio

```typescript
enum SponsorshipStatus {
    PENDING = "PENDING",         // Pendiente de aprobación
    ACTIVE = "ACTIVE",           // Patrocinio activo
    COMPLETED = "COMPLETED",     // Completado exitosamente
    CANCELLED = "CANCELLED",     // Cancelado antes de completar
    EXPIRED = "EXPIRED"          // Vencido sin completar
}
```

### Búsquedas Especializadas

```typescript
// Patrocinios activos
const activeSponsorship = await postSponsorshipService.list(actor, {
    filters: { status: "ACTIVE" }
});

// Por patrocinador específico
const sponsorCampaigns = await postSponsorshipService.list(actor, {
    filters: { sponsorId: "sponsor_marriott" }
});

// Por rango de fechas
const currentMonth = await postSponsorshipService.list(actor, {
    filters: {
        startDate: { gte: "2024-01-01" },
        endDate: { lte: "2024-01-31" }
    }
});
```

### Métricas y Reporting

```typescript
// Dashboard de patrocinios
const sponsorshipMetrics = {
    // Ingresos por patrocinio
    totalRevenue: await calculateTotalRevenue(),
    
    // Patrocinios por estado
    byStatus: await groupByStatus(),
    
    // Top patrocinadores
    topSponsors: await getTopSponsors(),
    
    // Performance de campañas
    campaignPerformance: await getCampaignMetrics()
};

async function calculateTotalRevenue() {
    const sponsorships = await postSponsorshipService.list(actor, {
        filters: { status: ["ACTIVE", "COMPLETED"] }
    });
    
    return sponsorships.items.reduce((total, sponsorship) => {
        return total + (sponsorship.amount || 0);
    }, 0);
}
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### PostSponsorshipCreateInput

**Campos Requeridos:**

- `postId`: string (ID del post patrocinado)
- `sponsorId`: string (ID del patrocinador)

**Campos Opcionales:**

- `amount`: number (monto del patrocinio)
- `currency`: string (moneda del pago)
- `startDate`: date (fecha de inicio)
- `endDate`: date (fecha de finalización)
- `status`: enum (estado del patrocinio)
- `terms`: string (términos del acuerdo)
- `paymentTerms`: string (condiciones de pago)

### Validaciones de Negocio

- Fechas: startDate debe ser anterior a endDate
- Referencias: postId y sponsorId deben existir
- Montos: amount debe ser positivo si se especifica
- Estados: transiciones válidas entre estados

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `POST_SPONSORSHIP_CREATE` | Content Manager+ |
| `getById`, `list` | `POST_SPONSORSHIP_READ` | Content Manager+ |
| `update`, `patch` | `POST_SPONSORSHIP_UPDATE` | Content Manager+ |
| `delete` | `POST_SPONSORSHIP_DELETE` | Content Manager+ |

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Campaña de Patrocinio Turístico

```typescript
// Crear campaña completa de patrocinio
const tourismCampaign = {
    postId: "post_mendoza_wine_route",
    sponsorId: "sponsor_wines_of_argentina",
    amount: 8000,
    currency: "USD",
    startDate: "2024-03-01",
    endDate: "2024-04-30", 
    status: "ACTIVE",
    terms: "Promoción de la Ruta del Vino de Mendoza con focus en bodegas premium, incluye 3 posts, 5 stories Instagram y 1 video promocional",
    paymentTerms: "30% al inicio, 40% a los 30 días, 30% al completar entregables",
    expectedReach: 50000,
    targetAudience: "wine enthusiasts, luxury travel, age 35-55"
};

const sponsorship = await postSponsorshipService.create(actor, tourismCampaign);
```

### Gestión de Ciclo de Vida

```typescript
// Activar patrocinio aprobado
await postSponsorshipService.update(actor, sponsorshipId, {
    status: "ACTIVE",
    startDate: new Date().toISOString()
});

// Completar patrocinio exitoso
await postSponsorshipService.update(actor, sponsorshipId, {
    status: "COMPLETED",
    endDate: new Date().toISOString(),
    actualReach: 75000,
    performanceNotes: "Superó métricas esperadas en 50%, excelente engagement"
});

// Cancelar patrocinio
await postSponsorshipService.update(actor, sponsorshipId, {
    status: "CANCELLED", 
    cancellationReason: "Cambio en estrategia de marketing del cliente"
});
```

---

**Nota**: El PostSponsorshipService gestiona los acuerdos comerciales entre contenido y patrocinadores, asegurando transparencia y trazabilidad en las relaciones de marketing turístico.
