# Documentación de Servicios - Hospeda

## 📋 Índice

- [Visión General](#visión-general)
- [Arquitectura de Servicios](#arquitectura-de-servicios)
- [Para Desarrolladores](#para-desarrolladores)
- [Para Consumidores de API](#para-consumidores-de-api)
- [Servicios Disponibles](#servicios-disponibles)

## 🎯 Visión General

Hospeda utiliza una arquitectura de servicios robusta y escalable que encapsula toda la lógica de negocio en servicios especializados. Cada servicio maneja un dominio específico de la aplicación, desde alojamientos hasta reseñas y eventos.

### Características Principales

- **🔐 Seguridad Integrada**: Cada servicio implementa validación de permisos basada en roles
- **✅ Validación Estricta**: Uso de Zod schemas para validación de entrada y salida
- **📊 Logging Completo**: Trazabilidad completa de operaciones y errores
- **🧪 Altamente Testeable**: Cobertura completa de pruebas unitarias
- **🔄 Transaccional**: Soporte para operaciones transaccionales complejas

## 🏗️ Arquitectura de Servicios

### Estructura Base

Todos los servicios heredan de `BaseCrudService` y siguen un patrón consistente:

```
Service
├── Constructor(ctx: ServiceContext, model?: TModel)
├── Métodos CRUD básicos (create, read, update, delete)
├── Métodos de negocio específicos
├── Validación de permisos
└── Logging automático
```

### Componentes Core

- **ServiceContext**: Contexto compartido con base de datos y configuración
- **Actor System**: Sistema de actores para autenticación y autorización
- **Error Handling**: Manejo estandarizado de errores con códigos específicos
- **Validation**: Validación mediante Zod schemas tipados

## 👨‍💻 Para Desarrolladores

Si eres desarrollador y quieres **crear un nuevo servicio** o **modificar servicios existentes**:

➡️ **[Guía de Desarrollo de Servicios](./desarrollo/README.md)**

Esta guía incluye:
- Cómo crear un nuevo servicio desde cero
- Estructura y patrones requeridos
- Implementación de validaciones y permisos
- Mejores prácticas y convenciones
- Configuración de tests

## 🌐 Para Consumidores de API

Si eres desarrollador de frontend o integrador y quieres **consumir los servicios**:

➡️ **[Documentación de API](./api/README.md)**

Esta documentación incluye:
- Catálogo completo de servicios disponibles
- Métodos, parámetros y respuestas de cada servicio
- Ejemplos de uso y casos comunes
- Códigos de error y manejo de excepciones
- Guías de integración

## 📚 Servicios Disponibles

| Servicio | Descripción | Estado |
|----------|-------------|--------|
| [**Accommodation**](./api/accommodation.md) | Gestión de alojamientos (hoteles, casas, etc.) | ✅ Activo |
| [**AccommodationReview**](./api/accommodation-review.md) | Sistema de reseñas para alojamientos | ✅ Activo |
| [**Amenity**](./api/amenity.md) | Gestión de amenidades y comodidades | ✅ Activo |
| [**Attraction**](./api/attraction.md) | Atracciones turísticas y puntos de interés | ✅ Activo |
| [**Destination**](./api/destination.md) | Destinos turísticos y geografía | ✅ Activo |
| [**DestinationReview**](./api/destination-review.md) | Reseñas de destinos turísticos | ✅ Activo |
| [**Event**](./api/event.md) | Eventos y actividades programadas | ✅ Activo |
| [**EventLocation**](./api/event-location.md) | Ubicaciones y venues para eventos | ✅ Activo |
| [**EventOrganizer**](./api/event-organizer.md) | Organizadores de eventos | ✅ Activo |
| [**Feature**](./api/feature.md) | Características y atributos de alojamientos | ✅ Activo |
| [**Permission**](./api/permission.md) | Sistema de permisos y autorización | ✅ Activo |
| [**Post**](./api/post.md) | Sistema de publicaciones y contenido | ✅ Activo |
| [**PostSponsor**](./api/post-sponsor.md) | Patrocinadores de contenido | ✅ Activo |
| [**PostSponsorship**](./api/post-sponsorship.md) | Gestión de patrocinios | ✅ Activo |
| [**Tag**](./api/tag.md) | Sistema de etiquetas y categorización | ✅ Activo |
| [**User**](./api/user.md) | Gestión de usuarios y perfiles | ✅ Activo |
| [**UserBookmark**](./api/user-bookmark.md) | Favoritos y marcadores de usuario | ✅ Activo |

## 🔧 Herramientas y Utilidades

### Scripts Útiles

```bash
# Ejecutar tests de todos los servicios
pnpm test --filter=service-core

# Ejecutar tests de un servicio específico
pnpm test --filter=service-core -- accommodation

# Ejecutar linting y formateo
pnpm check

# Generar documentación de tipos
pnpm build --filter=service-core
```

### Convenciones

- **Nomenclatura**: CamelCase para servicios, kebab-case para archivos
- **Validación**: Siempre usar Zod schemas tipados
- **Errores**: Usar `ServiceErrorCode` enum para códigos de error
- **Logging**: Usar `serviceLogger` para trazabilidad
- **Tests**: Cobertura mínima del 90% en servicios críticos

## 📞 Soporte

Para preguntas sobre servicios específicos, consulta la documentación individual en los enlaces de arriba.

Para preguntas sobre arquitectura o desarrollo, revisa la [Guía de Desarrollo](./desarrollo/README.md).

---

**Última actualización**: Septiembre 2025  
**Versión**: 1.0  
**Mantenido por**: Equipo de Backend Hospeda