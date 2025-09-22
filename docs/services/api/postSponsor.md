# Post Sponsor Service

## 📋 Índice

- [Visión General](#vision-general)
- [Métodos CRUD Básicos](#metodos-crud-basicos)
- [Búsquedas y Filtros](#busquedas-y-filtros)
- [Tipos de Patrocinadores](#tipos-de-patrocinadores)
- [Esquemas de Validación](#esquemas-de-validacion)
- [Permisos Requeridos](#permisos-requeridos)
- [Ejemplos de Uso](#ejemplos-de-uso)

## 🎯 Visión General {#vision-general}

El `PostSponsorService` gestiona los patrocinadores que pueden financiar y promocionar publicaciones en la plataforma. Proporciona un sistema para registrar empresas, organizaciones e instituciones que desean asociar su marca con contenido turístico y promocional.

### Entidad PostSponsor

Un patrocinador incluye:

- **Información Corporativa**: Nombre, tipo de cliente, descripción
- **Identidad Visual**: Logo con URL y caption
- **Contacto**: Email, teléfono, sitio web, dirección
- **Presencia Digital**: Redes sociales (Facebook, Instagram, Twitter, LinkedIn)
- **Clasificación**: Tipo según ClientTypeEnum
- **Metadatos**: Información de auditoría y ciclo de vida

### Casos de Uso

- **Patrocinio de Contenido**: Financiar publicaciones promocionales
- **Marketing Colaborativo**: Asociación de marca con destinos
- **Promoción Cruzada**: Intercambio de visibilidad entre marcas
- **Contenido Patrocinado**: Posts pagados y promocionales

## 🔧 Métodos CRUD Básicos {#metodos-crud-basicos}

### create(actor: Actor, input: PostSponsorCreateInput)

Crea un nuevo patrocinador de publicaciones.

**Ejemplo:**
```typescript
{
    name: "Aerolíneas Argentinas",
    type: "ENTERPRISE",
    description: "Línea aérea de bandera argentina con vuelos nacionales e internacionales",
    logo: {
        url: "https://cdn.aerolineas.com.ar/logo-oficial.png",
        caption: "Logo oficial Aerolíneas Argentinas"
    },
    email: "marketing@aerolineas.com.ar",
    phone: "+54 11 4317-3000",
    website: "https://www.aerolineas.com.ar",
    address: "Av. Madero 1143, Buenos Aires",
    socialNetworks: {
        facebook: "AerolineasArgentinas",
        instagram: "aerolineasarg",
        twitter: "AerolineasArg",
        linkedin: "aerolineas-argentinas"
    }
}
```

### Operaciones Estándar

- `getById(actor, id)` - Obtiene patrocinador por ID
- `list(actor, params)` - Lista patrocinadores con filtros
- `update/patch(actor, id, input)` - Actualiza patrocinador  
- `softDelete/hardDelete(actor, id)` - Elimina patrocinador

## 🔍 Búsquedas y Filtros {#busquedas-y-filtros}

### searchForList(actor: Actor, params: PostSponsorSearchInput)

Búsqueda avanzada de patrocinadores con múltiples filtros.

**Parámetros:**
```typescript
{
    q?: string;              // Búsqueda de texto libre
    name?: string;           // Filtro específico por nombre
    type?: ClientTypeEnum;   // Filtro por tipo de cliente
    page?: number;
    pageSize?: number;
}
```

**Búsqueda de Texto Libre (q)**
Busca coincidencias en:
- `name` (nombre del patrocinador)
- `description` (descripción corporativa)

**Ejemplo:**
```typescript
// Buscar aerolíneas
const airlines = await postSponsorService.searchForList(actor, {
    q: "aerolínea vuelo airline",
    pageSize: 20
});

// Filtrar por tipo de empresa
const enterprises = await postSponsorService.searchForList(actor, {
    type: "ENTERPRISE"
});

// Buscar hoteles
const hotels = await postSponsorService.searchForList(actor, {
    q: "hotel resort hospedaje"
});
```

## 🏢 Tipos de Patrocinadores {#tipos-de-patrocinadores}

### ClientTypeEnum

Los patrocinadores se clasifican según el tipo de cliente:

```typescript
enum ClientType {
    INDIVIDUAL = "INDIVIDUAL",     // Personas físicas
    STARTUP = "STARTUP",           // Empresas emergentes
    SMB = "SMB",                   // Pequeñas y medianas empresas
    ENTERPRISE = "ENTERPRISE",     // Grandes corporaciones
    NONPROFIT = "NONPROFIT",       // Organizaciones sin fines de lucro
    GOVERNMENT = "GOVERNMENT"      // Entidades gubernamentales
}
```

### Ejemplos por Tipo

**ENTERPRISE (Grandes Corporaciones)**
- Aerolíneas internacionales
- Cadenas hoteleras multinacionales
- Empresas de turismo globales
- Marcas de lujo

**SMB (Pequeñas y Medianas Empresas)**
- Hoteles boutique locales
- Agencias de viaje regionales
- Restaurantes destacados
- Tour operadores especializados

**GOVERNMENT (Entidades Gubernamentales)**
- Secretarías de turismo
- Entes provinciales de promoción
- Municipios turísticos
- Institutos nacionales

**NONPROFIT (Sin Fines de Lucro)**
- Fundaciones culturales
- Organizaciones de conservación
- Asociaciones turísticas
- ONGs de desarrollo sostenible

## ✅ Esquemas de Validación {#esquemas-de-validacion}

### PostSponsorCreateInput

**Campos Requeridos:**
- `name`: string (3-100 caracteres)
- `type`: ClientTypeEnum (valor válido del enum)
- `description`: string (10-500 caracteres)

**Campos Opcionales:**
- `logo`: objeto con url y caption opcional
- `email`: string (formato email válido)
- `phone`: string (formato internacional)
- `website`: string (URL válida)
- `address`: string (dirección física)
- `socialNetworks`: objeto con perfiles sociales

### Validaciones Específicas

```typescript
// Patrocinador mínimo válido
{
    name: "Turismo Aventura SA",
    type: "SMB",
    description: "Empresa especializada en turismo de aventura y ecoturismo en la Patagonia"
}

// Patrocinador completo
{
    name: "Hotel Sheraton Buenos Aires",
    type: "ENTERPRISE", 
    description: "Hotel 5 estrellas en el corazón de Retiro con vistas panorámicas al Río de la Plata",
    logo: {
        url: "https://marriott.com/sheraton-ba/logo.png",
        caption: "Sheraton Buenos Aires Hotel & Convention Center"
    },
    email: "marketing@sheraton-ba.com",
    phone: "+54 11 4318-9000",
    website: "https://sheraton-buenosaires.com",
    address: "San Martín 1225, Retiro, Buenos Aires",
    socialNetworks: {
        facebook: "SheratonBA",
        instagram: "sheratonbuenosaires",
        linkedin: "sheraton-buenos-aires"
    }
}
```

### Campos de Base Heredados

- **BaseContactFields**: email, phone, website, address
- **SocialNetworkFields**: facebook, instagram, twitter, linkedin
- **BaseAuditFields**: createdAt, updatedAt, createdBy, updatedBy
- **BaseLifecycleFields**: isActive, deletedAt
- **BaseAdminFields**: visibility, adminNotes

## 🔐 Permisos Requeridos {#permisos-requeridos}

| Operación | Permiso | Restricciones |
|-----------|---------|---------------|
| `create` | `POST_SPONSOR_MANAGE` | Content Manager+ |
| `getById`, `list` | `POST_SPONSOR_MANAGE` | Content Manager+ |
| `update`, `patch` | `POST_SPONSOR_MANAGE` | Content Manager+ |
| `delete` | `POST_SPONSOR_MANAGE` | Content Manager+ |
| `search`, `count` | `POST_SPONSOR_MANAGE` | Content Manager+ |

### Características de Permisos

- **Acceso Restringido**: Solo Content Manager+ puede gestionar patrocinadores
- **Permiso Unificado**: Un solo permiso (`POST_SPONSOR_MANAGE`) para todas las operaciones
- **Sin Acceso Público**: No hay operaciones públicas para patrocinadores
- **Control Total**: Gestión completa restringida a roles administrativos

## 💡 Ejemplos de Uso {#ejemplos-de-uso}

### Crear Portfolio de Patrocinadores Turísticos

```typescript
const tourismSponsors = [
    {
        name: "LATAM Airlines",
        type: "ENTERPRISE",
        description: "Aerolínea líder en América Latina con conexiones a más de 140 destinos",
        logo: {
            url: "https://latam.com/assets/logo.png",
            caption: "LATAM Airlines Group"
        },
        email: "partnerships@latam.com",
        website: "https://latam.com",
        socialNetworks: {
            facebook: "LATAM",
            instagram: "latam",
            twitter: "LATAM_Airlines"
        }
    },
    {
        name: "Secretaría de Turismo de Mendoza",
        type: "GOVERNMENT",
        description: "Organismo oficial de promoción turística de la provincia de Mendoza",
        email: "prensa@turismo.mendoza.gov.ar",
        website: "https://turismo.mendoza.gov.ar",
        socialNetworks: {
            facebook: "TurismoMendoza",
            instagram: "turismomendoza"
        }
    },
    {
        name: "Fundación Vida Silvestre",
        type: "NONPROFIT", 
        description: "ONG dedicada a la conservación de la naturaleza y turismo sustentable",
        logo: {
            url: "https://vidasilvestre.org.ar/logo.png",
            caption: "Fundación Vida Silvestre Argentina"
        },
        email: "info@vidasilvestre.org.ar",
        website: "https://vidasilvestre.org.ar"
    }
];

for (const sponsor of tourismSponsors) {
    await postSponsorService.create(actor, sponsor);
}
```

### Sistema de Búsqueda por Sector

```typescript
// Buscador por sectores turísticos
async function findSponsorsBySector(sector: string) {
    const sectorKeywords = {
        "transporte": ["aerolínea", "airline", "bus", "transfer", "rental"],
        "alojamiento": ["hotel", "resort", "hostel", "apart", "lodge"],
        "gastronomía": ["restaurant", "cuisine", "food", "wine", "gastronomy"],
        "actividades": ["tour", "adventure", "experience", "guide", "activity"],
        "cultura": ["museum", "cultural", "art", "heritage", "festival"],
        "naturaleza": ["eco", "nature", "wildlife", "conservation", "park"]
    };
    
    const keywords = sectorKeywords[sector] || [];
    const results = [];
    
    for (const keyword of keywords) {
        const searchResults = await postSponsorService.searchForList(actor, {
            q: keyword,
            pageSize: 10
        });
        results.push(...searchResults.items);
    }
    
    // Remover duplicados
    return results.filter((item, index, self) => 
        index === self.findIndex(t => t.id === item.id)
    );
}
```

### Dashboard de Patrocinadores

```typescript
// Análisis de cartera de patrocinadores
const sponsorAnalytics = {
    // Total por tipo
    byType: {},
    
    // Con presencia digital completa
    withCompleteProfile: 0,
    withSocialMedia: 0,
    withLogo: 0,
    
    // Sectores representados
    sectors: {
        transport: 0,
        accommodation: 0,
        gastronomy: 0,
        activities: 0,
        culture: 0,
        nature: 0
    }
};

// Análisis por tipo de cliente
const clientTypes = ["INDIVIDUAL", "STARTUP", "SMB", "ENTERPRISE", "NONPROFIT", "GOVERNMENT"];
for (const type of clientTypes) {
    const count = await postSponsorService.count(actor, { type });
    sponsorAnalytics.byType[type] = count.count;
}

// Análisis de completitud de perfiles
const allSponsors = await postSponsorService.searchForList(actor, {
    pageSize: 1000
});

allSponsors.items.forEach(sponsor => {
    // Evaluar completitud
    const hasComplete = sponsor.email && sponsor.website && sponsor.logo;
    if (hasComplete) sponsorAnalytics.withCompleteProfile++;
    
    if (sponsor.socialNetworks && Object.keys(sponsor.socialNetworks).length > 0) {
        sponsorAnalytics.withSocialMedia++;
    }
    
    if (sponsor.logo) sponsorAnalytics.withLogo++;
    
    // Categorizar por sector (basado en descripción)
    const desc = sponsor.description.toLowerCase();
    if (desc.includes('hotel') || desc.includes('alojamiento')) {
        sponsorAnalytics.sectors.accommodation++;
    }
    if (desc.includes('aerolínea') || desc.includes('vuelo')) {
        sponsorAnalytics.sectors.transport++;
    }
    // ... otros sectores
});
```

### Sistema de Recomendación de Patrocinadores

```typescript
// Sugerir patrocinadores para tipos de contenido
async function suggestSponsorsForContent(contentType: string, audience: string) {
    const sponsorRecommendations = {
        "destination": {
            "luxury": ["ENTERPRISE"], 
            "budget": ["SMB", "GOVERNMENT"],
            "adventure": ["SMB", "NONPROFIT"]
        },
        "experience": {
            "cultural": ["GOVERNMENT", "NONPROFIT"],
            "nature": ["NONPROFIT", "ENTERPRISE"],
            "urban": ["ENTERPRISE", "SMB"]
        },
        "accommodation": {
            "luxury": ["ENTERPRISE"],
            "boutique": ["SMB"],
            "budget": ["SMB", "GOVERNMENT"]
        }
    };
    
    const recommendedTypes = sponsorRecommendations[contentType]?.[audience] || [];
    const suggestions = [];
    
    for (const type of recommendedTypes) {
        const results = await postSponsorService.searchForList(actor, {
            type,
            pageSize: 5
        });
        suggestions.push(...results.items);
    }
    
    return suggestions.slice(0, 10);
}
```

---

**Nota**: El PostSponsorService gestiona la base de datos de patrocinadores potenciales para contenido turístico, facilitando asociaciones estratégicas entre marcas y publicaciones promocionales.
