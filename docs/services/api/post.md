# Post Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Métodos de Búsqueda](#metodos-de-busqueda)
- [Métodos Especializados](#metodos-especializados)
- [Gestión de Contenido](#gestion-de-contenido)
- [Sistema de Engagement](#sistema-de-engagement)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `PostService` gestiona contenido editorial y publicaciones en Hospeda. Maneja artículos, noticias, guías de viaje y contenido promocional. Proporciona operaciones CRUD completas, búsquedas por categoría, contenido relacionado y estadísticas de engagement.

### Entidad Post

Un post incluye:

- **Contenido**: Título, extracto, contenido principal, categoría
- **Metadata**: Autor, fechas de publicación, expiración
- **Relaciones**: Destinos, alojamientos, eventos asociados
- **Patrocinio**: Información de sponsors y patrocinios
- **Engagement**: Likes, comentarios, compartidos
- **Multimedia**: Imágenes, videos, galería
- **SEO**: Meta descripciones, palabras clave
- **Moderación**: Estado de aprobación, visibilidad

### Categorías de Posts

Los posts se clasifican en múltiples categorías:

```typescript
enum PostCategory {
    TRAVEL_GUIDE = "TRAVEL_GUIDE",       // Guías de viaje
    DESTINATION_REVIEW = "DESTINATION_REVIEW", // Reseñas de destinos
    ACCOMMODATION_REVIEW = "ACCOMMODATION_REVIEW", // Reseñas de alojamientos
    LOCAL_TIPS = "LOCAL_TIPS",           // Tips locales
    FOOD_DRINK = "FOOD_DRINK",          // Gastronomía
    CULTURE = "CULTURE",                 // Cultura y tradiciones
    ADVENTURE = "ADVENTURE",             // Aventuras y actividades
    BUDGET_TRAVEL = "BUDGET_TRAVEL",     // Viajes económicos
    LUXURY_TRAVEL = "LUXURY_TRAVEL",     // Viajes de lujo
    SOLO_TRAVEL = "SOLO_TRAVEL",         // Viajes en solitario
    FAMILY_TRAVEL = "FAMILY_TRAVEL",     // Viajes familiares
    BUSINESS_TRAVEL = "BUSINESS_TRAVEL", // Viajes de negocios
    NEWS = "NEWS",                       // Noticias
    ANNOUNCEMENT = "ANNOUNCEMENT",       // Anuncios
    PROMOTIONAL = "PROMOTIONAL",         // Contenido promocional
    OTHER = "OTHER"                      // Otros
}
```

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: PostCreateInput)

Crea un nuevo post con validaciones de negocio específicas.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `input`: Datos del post a crear

**Permisos Requeridos:** `POST_CREATE`

**Validaciones Especiales:**

- Título único por categoría
- Si es noticia (`isNews: true`), requiere `expiresAt` en el futuro
- Slug único (se genera automáticamente si no se proporciona)
- Contenido principal requerido para posts publicados

**Ejemplo de Input:**

```typescript
{
    title: "Guía Completa para Visitar Barcelona en 3 Días",
    slug: "guia-barcelona-3-dias", // Opcional, se genera automáticamente
    excerpt: "Descubre los imprescindibles de Barcelona en un fin de semana largo con nuestra guía detallada",
    content: "Barcelona es una ciudad que cautiva desde el primer momento. En esta guía te mostramos cómo aprovechar al máximo 3 días en la Ciudad Condal...",
    category: "TRAVEL_GUIDE",
    isFeatured: true,
    isNews: false,
    
    // Relaciones con otras entidades
    relatedDestinations: ["dest_barcelona"],
    relatedAccommodations: ["acc_hotel_barcelona_center"],
    relatedEvents: ["event_sagrada_familia_tour"],
    
    // Multimedia
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/barcelona-guide.jpg",
            moderationState: "APPROVED",
            altText: "Vista panorámica de Barcelona desde el Park Güell"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/sagrada-familia.jpg",
                moderationState: "APPROVED",
                altText: "Fachada de la Sagrada Familia"
            },
            {
                url: "https://images.unsplash.com/park-guell.jpg",
                moderationState: "APPROVED",
                altText: "Mosaicos coloridos en Park Güell"
            }
        ]
    },
    
    // SEO
    seo: {
        metaTitle: "Guía Barcelona 3 Días - Qué Ver y Hacer | Hospeda",
        metaDescription: "Planifica tu escapada perfecta a Barcelona con nuestra guía de 3 días. Descubre los mejores lugares, restaurantes y actividades.",
        keywords: ["barcelona", "guía viaje", "3 días", "qué ver", "turismo", "españa"]
    },
    
    // Programación de publicación
    publishAt: "2024-09-25T06:00:00Z", // Opcional, se publica inmediatamente si no se especifica
    
    // Configuración de visibilidad
    visibility: "PUBLIC"
}
```

**Respuesta:**

```typescript
{
    data: {
        id: "post_123",
        title: "Guía Completa para Visitar Barcelona en 3 Días",
        slug: "guia-barcelona-3-dias",
        category: "TRAVEL_GUIDE",
        // ... resto de campos
        engagementStats: {
            likes: 0,
            comments: 0,
            shares: 0,
            views: 0
        },
        createdAt: "2024-09-22T10:00:00Z",
        updatedAt: "2024-09-22T10:00:00Z"
    }
}
```

### Validación Especial para Noticias

```typescript
// Para posts de tipo noticia
{
    title: "Nueva Ruta Aérea Conecta Madrid con Tokio",
    category: "NEWS",
    isNews: true,
    expiresAt: "2024-12-31T23:59:59Z", // ✅ Requerido para noticias
    content: "La aerolínea japonesa ANA anuncia una nueva ruta directa...",
    // ... resto de campos
}
```

### getById(actor: Actor, id: string)

Obtiene un post por su ID con conteo de vistas automático.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `id`: ID del post

**Permisos Requeridos:** `POST_READ` (público con restricciones de visibilidad)

**Funcionalidad Adicional:**

- Incrementa automáticamente el contador de vistas
- Respeta la programación de publicación (`publishAt`)
- Filtra contenido expirado para usuarios no autorizados

**Ejemplo:**

```typescript
const result = await postService.getById(actor, "post_123");
if (result.data) {
    console.log(result.data.title); // "Guía Completa para Visitar Barcelona en 3 Días"
    console.log(result.data.engagementStats.views); // Se incrementa automáticamente
}
```

### getBySlug(actor: Actor, slug: string)

Obtiene un post por su slug.

**Parámetros:**

- `actor`: Actor que ejecuta la operación
- `slug`: Slug del post

**Ejemplo:**

```typescript
const result = await postService.getBySlug(actor, "guia-barcelona-3-dias");
```

### update(actor: Actor, id: string, input: PostUpdateInput)

Actualiza un post existente (PUT - reemplaza completamente).

**Permisos Requeridos:** `POST_EDIT`

**Validaciones:**

- El actor debe ser el autor del post o tener permisos de admin
- Título único por categoría (excluyendo el post actual)
- Preserva estadísticas de engagement existentes

### patch(actor: Actor, id: string, input: PostPatchInput)

Actualiza parcialmente un post (PATCH - actualización incremental).

**Permisos Requeridos:** `POST_EDIT`

**Ejemplo:**

```typescript
const result = await postService.patch(actor, "post_123", {
    isFeatured: true,
    publishAt: "2024-09-25T08:00:00Z", // Reprogramar publicación
    seo: {
        keywords: ["barcelona", "guía viaje", "3 días", "turismo", "mejores lugares"]
    }
});
```

### softDelete(actor: Actor, id: string)

Elimina lógicamente un post (soft delete).

**Permisos Requeridos:** `POST_DELETE`

**Funcionalidad:**

- Mantiene estadísticas para análisis histórico
- Preserva relaciones con otros contenidos

### hardDelete(actor: Actor, id: string)

Elimina físicamente un post (hard delete - irreversible).

**Permisos Requeridos:** `POST_DELETE` + `ADMIN` role

### restore(actor: Actor, id: string)

Restaura un post eliminado lógicamente.

**Permisos Requeridos:** `POST_EDIT`

### list(actor: Actor, params: PostListInput)

Lista posts con paginación y filtros avanzados.

**Permisos Requeridos:** `POST_LIST`

**Parámetros de Búsqueda:**

```typescript
{
    q?: string;                    // Búsqueda por texto (título, excerpt, contenido)
    category?: PostCategory;       // Filtro por categoría
    authorId?: string;            // Filtro por autor
    isFeatured?: boolean;         // Solo posts destacados
    isNews?: boolean;             // Solo noticias
    hasRelatedDestination?: boolean; // Solo posts con destinos relacionados
    hasRelatedAccommodation?: boolean; // Solo posts con alojamientos
    hasRelatedEvent?: boolean;    // Solo posts con eventos
    publishedAfter?: string;      // Publicados después de esta fecha
    publishedBefore?: string;     // Publicados antes de esta fecha
    isExpired?: boolean;          // Incluir/excluir contenido expirado
    page?: number;                // Página (default: 1)
    pageSize?: number;            // Elementos por página (default: 10, max: 50)
}
```

## 🔍 Métodos de Búsqueda {#metodos-de-busqueda}

### searchForList(actor: Actor, params: PostListInput)

Búsqueda optimizada para listados con información resumida.

**Respuesta Optimizada:**

- Solo campos esenciales para listados
- Estadísticas básicas de engagement
- Imagen principal únicamente
- Información del autor resumida

**Ejemplo:**

```typescript
const result = await postService.searchForList(actor, {
    q: "barcelona guía viaje",
    category: "TRAVEL_GUIDE",
    isFeatured: true,
    page: 1,
    pageSize: 12
});
```

## 📰 Métodos Especializados {#metodos-especializados}

### getNews(actor: Actor, params: GetPostNewsInput)

Obtiene posts de noticias con filtros específicos.

**Parámetros:**

```typescript
{
    visibility?: VisibilityEnum;   // Filtro por visibilidad
    includePastNews?: boolean;     // Incluir noticias expiradas
    page?: number;
    pageSize?: number;
}
```

**Funcionalidad:**

- Filtra automáticamente por `isNews: true`
- Excluye noticias expiradas por defecto
- Ordena por fecha de publicación (más recientes primero)

**Ejemplo:**

```typescript
const result = await postService.getNews(actor, {
    visibility: "PUBLIC",
    includePastNews: false,
    page: 1,
    pageSize: 10
});
```

### getFeatured(actor: Actor, params: GetPostFeaturedInput)

Obtiene posts destacados.

**Parámetros:**

```typescript
{
    category?: PostCategory;       // Filtro por categoría
    limit?: number;               // Límite de resultados (default: 5, max: 20)
}
```

**Ejemplo:**

```typescript
const result = await postService.getFeatured(actor, {
    category: "TRAVEL_GUIDE",
    limit: 8
});
```

### getByCategory(actor: Actor, params: GetPostByCategoryInput)

Obtiene posts filtrados por categoría específica.

**Parámetros:**

```typescript
{
    category: PostCategory;        // Categoría requerida
    isFeatured?: boolean;         // Solo destacados
    authorId?: string;            // Filtro por autor
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await postService.getByCategory(actor, {
    category: "LOCAL_TIPS",
    isFeatured: true,
    page: 1,
    pageSize: 15
});
```

### getByRelatedDestination(actor: Actor, params: GetPostByRelatedDestinationInput)

Obtiene posts relacionados con un destino específico.

**Parámetros:**

```typescript
{
    destinationId: string;         // ID del destino
    category?: PostCategory;       // Filtro por categoría
    excludePostId?: string;       // Excluir un post específico
    page?: number;
    pageSize?: number;
}
```

**Respuesta:**

```typescript
{
    data: {
        posts: [
            {
                id: "post_123",
                title: "Guía Completa para Visitar Barcelona en 3 Días",
                category: "TRAVEL_GUIDE",
                excerpt: "Descubre los imprescindibles de Barcelona...",
                relatedDestinations: ["dest_barcelona"],
                engagementStats: {
                    likes: 45,
                    comments: 12,
                    views: 1250
                }
            }
            // ... más posts
        ],
        destination: {
            id: "dest_barcelona",
            name: "Barcelona",
            slug: "barcelona"
        },
        total: 8
    }
}
```

**Ejemplo:**

```typescript
const result = await postService.getByRelatedDestination(actor, {
    destinationId: "dest_barcelona",
    category: "TRAVEL_GUIDE",
    excludePostId: "post_current", // Para evitar mostrar el post actual
    page: 1,
    pageSize: 6
});
```

### getByRelatedAccommodation(actor: Actor, params: GetPostByRelatedAccommodationInput)

Obtiene posts relacionados con un alojamiento específico.

**Parámetros:**

```typescript
{
    accommodationId: string;       // ID del alojamiento
    category?: PostCategory;
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await postService.getByRelatedAccommodation(actor, {
    accommodationId: "acc_hotel_barcelona_center",
    category: "ACCOMMODATION_REVIEW"
});
```

### getByRelatedEvent(actor: Actor, params: GetPostByRelatedEventInput)

Obtiene posts relacionados con un evento específico.

**Parámetros:**

```typescript
{
    eventId: string;              // ID del evento
    category?: PostCategory;
    page?: number;
    pageSize?: number;
}
```

**Ejemplo:**

```typescript
const result = await postService.getByRelatedEvent(actor, {
    eventId: "event_festival_jazz_barcelona",
    category: "CULTURE"
});
```

## 📊 Gestión de Contenido {#gestion-de-contenido}

### getSummary(actor: Actor, params: GetPostSummaryInput)

Obtiene un resumen estadístico de posts.

**Parámetros:**

```typescript
{
    category?: PostCategory;       // Filtro por categoría
    authorId?: string;            // Filtro por autor
    timeframe?: "WEEK" | "MONTH" | "YEAR"; // Marco temporal
    includeEngagement?: boolean;   // Incluir estadísticas de engagement
}
```

**Respuesta:**

```typescript
{
    data: {
        totalPosts: 456,
        publishedPosts: 432,
        draftPosts: 18,
        featuredPosts: 45,
        newsPosts: 23,
        postsByCategory: {
            TRAVEL_GUIDE: 156,
            LOCAL_TIPS: 98,
            FOOD_DRINK: 67,
            CULTURE: 45,
            ACCOMMODATION_REVIEW: 34,
            NEWS: 23,
            OTHER: 33
        },
        topAuthors: [
            {
                authorId: "user_123",
                authorName: "María González",
                postCount: 23,
                totalViews: 45000
            }
        ],
        engagementSummary: {
            totalLikes: 12540,
            totalComments: 3456,
            totalViews: 234567,
            averageLikesPerPost: 27.4,
            averageCommentsPerPost: 7.6
        },
        recentHighlights: [
            {
                id: "post_trending",
                title: "Los 10 Mejores Restaurantes de Barcelona",
                category: "FOOD_DRINK",
                views: 5400,
                likes: 230
            }
        ]
    }
}
```

### getStats(actor: Actor, params: GetPostStatsInput)

Obtiene estadísticas detalladas de engagement.

**Parámetros:**

```typescript
{
    postId?: string;              // Stats de un post específico
    authorId?: string;            // Stats de posts de un autor
    category?: PostCategory;      // Stats por categoría
    timeframe?: "DAY" | "WEEK" | "MONTH" | "YEAR";
    includeHistoricalData?: boolean; // Incluir datos históricos
}
```

**Respuesta:**

```typescript
{
    data: {
        postTitle: "Guía Completa para Visitar Barcelona en 3 Días",
        currentStats: {
            views: 12540,
            likes: 345,
            comments: 89,
            shares: 23
        },
        historicalData: [
            {
                date: "2024-09-22",
                views: 1250,
                likes: 45,
                comments: 12
            }
            // ... más datos históricos
        ],
        topPerformingContent: [
            {
                section: "Park Güell",
                engagement: "high",
                timeSpent: "00:03:45"
            }
        ],
        audienceInsights: {
            topCountries: ["Spain", "France", "Germany"],
            topCities: ["Barcelona", "Madrid", "Paris"],
            avgTimeOnPage: "00:04:23",
            bounceRate: 0.23
        }
    }
}
```

## 💝 Sistema de Engagement {#sistema-de-engagement}

### likePost(actor: Actor, input: LikePostInput)

Permite a un usuario dar "like" a un post.

**Parámetros:**

```typescript
{
    postId: string;               // ID del post
}
```

**Permisos Requeridos:** `POST_LIKE`

**Funcionalidad:**

- Incrementa contador de likes del post
- Previene likes duplicados del mismo usuario
- Registra actividad para recomendaciones

**Ejemplo:**

```typescript
const result = await postService.likePost(actor, {
    postId: "post_123"
});

// Respuesta
{
    data: {
        postId: "post_123",
        liked: true,
        totalLikes: 346 // Incrementado
    }
}
```

### unlikePost(actor: Actor, input: LikePostInput)

Permite a un usuario quitar su "like" de un post.

**Parámetros:**

```typescript
{
    postId: string;               // ID del post
}
```

**Ejemplo:**

```typescript
const result = await postService.unlikePost(actor, {
    postId: "post_123"
});

// Respuesta  
{
    data: {
        postId: "post_123",
        liked: false,
        totalLikes: 345 // Decrementado
    }
}
```

### commentPost(actor: Actor, input: CommentPostInput)

Permite a un usuario comentar en un post.

**Parámetros:**

```typescript
{
    postId: string;               // ID del post
    content: string;              // Contenido del comentario
    parentCommentId?: string;     // ID del comentario padre (para respuestas)
}
```

**Permisos Requeridos:** `POST_COMMENT`

**Validaciones:**

- Contenido mínimo de 3 caracteres
- Máximo 1000 caracteres
- Post debe permitir comentarios
- Usuario debe estar autenticado

**Ejemplo:**

```typescript
const result = await postService.commentPost(actor, {
    postId: "post_123",
    content: "Excelente guía! Me ha sido muy útil para planificar mi viaje a Barcelona.",
    parentCommentId: undefined // Comentario principal
});

// Para responder a un comentario
const reply = await postService.commentPost(actor, {
    postId: "post_123", 
    content: "¡Gracias! Me alegra que te haya sido útil.",
    parentCommentId: "comment_456" // Respuesta
});
```

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### PostCreateInput

**Campos Requeridos:**

- `title`: string (3-150 caracteres)
- `excerpt`: string (10-300 caracteres)
- `content`: string (50+ caracteres para posts publicados)
- `category`: PostCategory enum

**Campos Opcionales:**

- `slug`: string (se genera automáticamente)
- `isNews`: boolean (default: false)
- `isFeatured`: boolean (default: false)
- `publishAt`: ISO string (default: ahora)
- `expiresAt`: ISO string (requerido si `isNews: true`)
- `relatedDestinations`: array de destination IDs
- `relatedAccommodations`: array de accommodation IDs
- `relatedEvents`: array de event IDs
- `media`: estructura de multimedia
- `seo`: metadatos para SEO

### Validaciones Específicas

**Título Único por Categoría:**

```typescript
// ✅ Válido - diferentes categorías
{ title: "Barcelona Guide", category: "TRAVEL_GUIDE" }
{ title: "Barcelona Guide", category: "LOCAL_TIPS" }

// ❌ Inválido - misma categoría
{ title: "Barcelona Guide", category: "TRAVEL_GUIDE" } // Ya existe
```

**Noticias con Expiración:**

```typescript
// ✅ Válido
{
    title: "Nueva ruta aérea",
    category: "NEWS",
    isNews: true,
    expiresAt: "2024-12-31T23:59:59Z" // Fecha futura requerida
}

// ❌ Inválido
{
    title: "Nueva ruta aérea",
    category: "NEWS", 
    isNews: true
    // expiresAt falta - requerido para noticias
}
```

**Programación de Publicación:**

```typescript
// ✅ Válido
{
    title: "Guía de verano",
    publishAt: "2024-06-01T06:00:00Z", // Fecha futura para programar
    visibility: "PUBLIC"
}
```

**Slug Único:**

```typescript
// Se genera automáticamente desde el title
title: "Guía Completa Barcelona" → slug: "guia-completa-barcelona"
title: "10 Tips for Madrid" → slug: "10-tips-for-madrid"
```

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones Adicionales |
|-----------|---------|---------------------------|
| `create` | `POST_CREATE` | Solo usuarios verificados |
| `getById`, `getBySlug` | `POST_READ` | Respeta visibilidad y programación |
| `list`, `searchForList` | `POST_LIST` | Solo públicos para guests |
| `update`, `patch` | `POST_EDIT` | Solo autor o admin |
| `softDelete` | `POST_DELETE` | Solo autor o admin |
| `hardDelete` | `POST_DELETE` | Solo super admin |
| `restore` | `POST_EDIT` | Solo autor o admin |
| `getNews`, `getFeatured` | `POST_READ` | Público |
| `getByCategory` | `POST_READ` | Público |
| `getByRelated*` | `POST_READ` | Público |
| `getSummary`, `getStats` | `POST_READ` | Admin o propietario |
| `likePost`, `unlikePost` | `POST_LIKE` | Usuario autenticado |
| `commentPost` | `POST_COMMENT` | Usuario autenticado |

### Roles y Permisos

```typescript
// Permisos por rol
GUEST: ['POST_READ', 'POST_LIST']
USER: ['POST_READ', 'POST_LIST', 'POST_LIKE', 'POST_COMMENT']
CONTENT_CREATOR: ['POST_READ', 'POST_LIST', 'POST_CREATE', 'POST_EDIT', 'POST_LIKE', 'POST_COMMENT']
EDITOR: ['POST_*'] // Todos los permisos excepto hard delete
ADMIN: ['POST_*'] // Todos los permisos
```

### Autorización de Contenido

```typescript
// El actor puede editar si:
- Es el autor del post
- Tiene rol EDITOR o superior
- Tiene permiso POST_EDIT y es supervisor del autor

// Visibilidad del contenido:
PUBLIC: Visible para todos
PRIVATE: Solo para usuarios autenticados
DRAFT: Solo para autor y editores
SCHEDULED: Solo visible después de publishAt
```

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Guía de Viaje Completa

```typescript
const guiaViaje = {
    title: "Ruta por la Costa Brava en 7 Días",
    excerpt: "Descubre los pueblos más encantadores de la Costa Brava en una semana inolvidable",
    content: `
# Día 1: Lloret de Mar
Comenzamos nuestra aventura en Lloret de Mar, conocido por sus hermosas playas...

# Día 2: Tossa de Mar  
Tossa de Mar nos recibe con su impresionante villa medieval...

# Día 3: Cadaqués
El pueblo de Dalí nos espera con sus casas blancas y su ambiente bohemio...
    `,
    category: "TRAVEL_GUIDE",
    isFeatured: true,
    
    relatedDestinations: [
        "dest_lloret_de_mar",
        "dest_tossa_de_mar", 
        "dest_cadaques"
    ],
    
    relatedAccommodations: [
        "acc_hotel_costa_brava_lloret",
        "acc_hostal_tossa_mar"
    ],
    
    media: {
        featuredImage: {
            url: "https://images.unsplash.com/costa-brava-aerial.jpg",
            moderationState: "APPROVED",
            altText: "Vista aérea de la Costa Brava con sus calas turquesas"
        },
        gallery: [
            {
                url: "https://images.unsplash.com/tossa-de-mar.jpg",
                moderationState: "APPROVED",
                altText: "Villa medieval de Tossa de Mar"
            },
            {
                url: "https://images.unsplash.com/cadaques-houses.jpg",
                moderationState: "APPROVED", 
                altText: "Casas blancas de Cadaqués"
            }
        ]
    },
    
    seo: {
        metaTitle: "Ruta Costa Brava 7 Días - Guía Completa 2024",
        metaDescription: "Planifica tu ruta perfecta por la Costa Brava. 7 días explorando Lloret, Tossa de Mar, Cadaqués y más pueblos encantadores.",
        keywords: ["costa brava", "ruta 7 días", "lloret de mar", "tossa de mar", "cadaqués", "pueblos cataluña"]
    },
    
    publishAt: "2024-05-01T06:00:00Z" // Programar para temporada alta
};

const result = await postService.create(actor, guiaViaje);
```

### Gestión de Noticias con Expiración

```typescript
// Crear noticia con expiración
const noticia = {
    title: "Nuevas Restricciones de Viaje por COVID-19 en Europa",
    excerpt: "Actualización importante sobre las medidas sanitarias vigentes",
    content: "Las autoridades europeas han anunciado nuevas medidas...",
    category: "NEWS",
    isNews: true,
    expiresAt: "2024-12-31T23:59:59Z", // Expira a fin de año
    isFeatured: true,
    
    seo: {
        metaTitle: "Restricciones COVID-19 Europa 2024 - Última Actualización",
        metaDescription: "Mantente informado sobre las últimas restricciones de viaje por COVID-19 en países europeos. Información actualizada.",
        keywords: ["covid-19", "restricciones viaje", "europa", "2024", "medidas sanitarias"]
    }
};

const result = await postService.create(actor, noticia);

// Obtener noticias activas
const noticiasActivas = await postService.getNews(actor, {
    visibility: "PUBLIC",
    includePastNews: false // Solo noticias no expiradas
});
```

### Sistema de Contenido Relacionado

```typescript
// Buscar posts relacionados con Barcelona
const postsBarcelona = await postService.getByRelatedDestination(actor, {
    destinationId: "dest_barcelona",
    excludePostId: "post_current", // Excluir post actual
    page: 1,
    pageSize: 6
});

// Buscar reseñas de un hotel específico
const resenasHotel = await postService.getByRelatedAccommodation(actor, {
    accommodationId: "acc_hotel_barcelona_luxury",
    category: "ACCOMMODATION_REVIEW",
    page: 1,
    pageSize: 10
});

// Posts relacionados con un evento
const postsEvento = await postService.getByRelatedEvent(actor, {
    eventId: "event_festival_flamenco_sevilla",
    category: "CULTURE"
});

// Combinar resultados para widget de "Contenido Relacionado"
const contenidoRelacionado = {
    destino: postsBarcelona.data?.posts.slice(0, 3),
    hotel: resenasHotel.data?.posts.slice(0, 2),
    evento: postsEvento.data?.posts.slice(0, 2)
};
```

### Gestión de Engagement

```typescript
// Usuario da like a un post
const like = await postService.likePost(actor, {
    postId: "post_123"
});

// Usuario comenta
const comentario = await postService.commentPost(actor, {
    postId: "post_123",
    content: "Excelente artículo! La información sobre los horarios del Parque Güell me ha sido muy útil."
});

// Responder a un comentario
const respuesta = await postService.commentPost(actor, {
    postId: "post_123",
    content: "¡Gracias por el feedback! Me alegra que te haya sido útil la información.",
    parentCommentId: comentario.data.id
});

// Ver estadísticas de engagement
const stats = await postService.getStats(actor, {
    postId: "post_123",
    timeframe: "MONTH",
    includeHistoricalData: true
});

console.log(`Post con ${stats.data.currentStats.views} vistas y ${stats.data.currentStats.likes} likes`);
```

### Dashboard de Contenido para Editores

```typescript
// Resumen general de contenido
const resumen = await postService.getSummary(actor, {
    timeframe: "MONTH",
    includeEngagement: true
});

// Posts más populares por categoría
const guiasPopulares = await postService.getByCategory(actor, {
    category: "TRAVEL_GUIDE",
    isFeatured: true,
    page: 1,
    pageSize: 10
});

// Noticias recientes
const noticiasRecientes = await postService.getNews(actor, {
    visibility: "PUBLIC",
    page: 1,
    pageSize: 5
});

// Stats de un autor específico
const statsAutor = await postService.getStats(actor, {
    authorId: "user_456",
    timeframe: "YEAR"
});

// Crear dashboard
const dashboard = {
    resumenGeneral: resumen.data,
    guiasDestacadas: guiasPopulares.data?.items,
    ultimasNoticias: noticiasRecientes.data,
    rendimientoAutor: statsAutor.data,
    
    // KPIs importantes
    kpis: {
        totalPosts: resumen.data.totalPosts,
        avgEngagement: resumen.data.engagementSummary.averageLikesPerPost,
        topCategory: Object.entries(resumen.data.postsByCategory)
            .sort(([,a], [,b]) => b - a)[0],
        trending: resumen.data.recentHighlights
    }
};
```

### Programación y Moderación de Contenido

```typescript
// Programar post para publicación futura
const postProgramado = await postService.create(actor, {
    title: "Guía de Viaje para Semana Santa 2024",
    // ... resto del contenido
    publishAt: "2024-03-15T06:00:00Z", // 2 semanas antes de Semana Santa
    visibility: "PUBLIC"
});

// Actualizar contenido existente
const actualizacion = await postService.patch(actor, "post_123", {
    content: "Contenido actualizado con nueva información...",
    seo: {
        keywords: ["barcelona", "guía actualizada", "2024", "nuevas atracciones"]
    }
});

// Destacar contenido de temporada
const destacarTemporada = await postService.patch(actor, "post_summer_guide", {
    isFeatured: true,
    publishAt: "2024-06-01T06:00:00Z"
});

// Gestionar expiración de noticias
const actualizarExpiracion = await postService.patch(actor, "post_news_covid", {
    expiresAt: "2024-06-30T23:59:59Z" // Extender vigencia
});
```

## 🚨 Manejo de Errores Comunes

### Errores de Validación de Título

```typescript
// Error por título duplicado en la misma categoría
{
    error: {
        code: "VALIDATION_ERROR",
        message: "A post with this title already exists in this category",
        details: {
            title: "Guía de Barcelona",
            category: "TRAVEL_GUIDE",
            existingPostId: "post_456"
        }
    }
}
```

### Errores de Noticias sin Expiración

```typescript
// Error por noticia sin fecha de expiración
{
    error: {
        code: "VALIDATION_ERROR",
        message: "expiresAt is required for news posts",
        details: {
            fieldErrors: {
                expiresAt: ["Required field missing for news posts"]
            }
        }
    }
}
```

### Errores de Slug Duplicado

```typescript
// Error por slug ya existente
{
    error: {
        code: "ALREADY_EXISTS",
        message: "Post with slug 'guia-barcelona-3-dias' already exists",
        details: { 
            slug: "guia-barcelona-3-dias",
            suggestion: "guia-barcelona-3-dias-2024"
        }
    }
}
```

### Errores de Permisos de Engagement

```typescript
// Error por usuario no autenticado intentando dar like
{
    error: {
        code: "FORBIDDEN",
        message: "Authentication required to like posts",
        details: {
            action: "like_post",
            required: "authenticated_user"
        }
    }
}
```

### Errores de Contenido Programado

```typescript
// Error por intentar acceder a contenido no publicado aún
{
    error: {
        code: "NOT_FOUND",
        message: "Post not yet published",
        details: {
            publishAt: "2024-10-01T06:00:00Z",
            currentTime: "2024-09-22T10:00:00Z"
        }
    }
}
```

## 🔗 Relaciones con Otros Servicios

### Con DestinationService

- Los posts pueden estar relacionados con múltiples destinos
- Estadísticas de contenido por destino
- Recomendaciones de contenido basadas en destinos

### Con AccommodationService

- Posts de reseñas de alojamientos
- Contenido promocional de hoteles
- Guías de alojamiento por zona

### Con EventService

- Posts relacionados con eventos específicos
- Cobertura de festivales y eventos culturales
- Guías de eventos por temporada

### Con UserService

- Autoría y gestión de permisos de contenido
- Sistema de followers para autores
- Historial de engagement del usuario

### Con ReviewService

- Posts que analizan reseñas agregadas
- Contenido basado en tendencias de opiniones
- Verificación cruzada de información

---

**Nota**: El PostService es el corazón del sistema de contenido de Hospeda. Gestiona toda la información editorial que enriquece la experiencia del usuario y proporciona valor agregado a la plataforma turística.