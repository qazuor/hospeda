# Session Replay Privacy

## Estado actual

- Session Replay está **deshabilitado** en este momento.
- `apps/web`: `disable_session_recording: true`
- `apps/admin`: `disable_session_recording: true`

## Motivo

Antes de activarlo hay que cerrar una política de privacidad explícita. Hoy el repo todavía no implementa:

- masking de inputs para PostHog
- selectores `ph-no-capture` en todos los formularios sensibles
- exclusión documentada de rutas con mayor riesgo
- estrategia de sampling aprobada

## Qué se grabaría si se activa

Cuando se active, la intención es permitir Replay sólo donde aporte valor de producto:

- onboarding owner
- publicación de alojamientos
- checkout de suscripciones
- errores de UX en navegación pública

## Qué debe quedar oculto

Si Replay se activa, estos datos NO deben llegar a PostHog:

- contraseñas
- emails escritos por usuarios
- teléfonos escritos por usuarios
- mensajes privados
- datos de contacto
- datos de pago
- tokens o query params sensibles

## Rutas o superficies sensibles

Estas superficies requieren protección reforzada antes de cualquier activación:

- autenticación
- formularios de contacto a alojamientos
- guest conversation access
- checkout / suscripciones
- mensajería
- panel admin con datos de usuarios y billing

## Estrategia recomendada para una futura activación

### Web

- `maskAllInputs: true`
- `maskTextSelector: '*'`
- unmask selectivo sólo en elementos marcados como seguros
- `ph-no-capture` en componentes sensibles
- revisar y redactar URLs capturadas cuando haya query params delicados

### Admin

- mantener Replay apagado por defecto
- sólo evaluar activación parcial si existe un caso muy concreto de soporte interno
- en caso de activación, exigir masking todavía más estricto que en web

## Sampling recomendado

Si se habilita más adelante:

- no grabar 100% de sesiones
- priorizar sesiones con error
- priorizar onboarding / publicación / checkout
- mantener tráfico general en una tasa baja

## Verificación manual requerida antes de activarlo

1. Probar login/sign up y verificar que no se vea texto sensible.
2. Probar formulario de contacto y verificar que no se vea el mensaje.
3. Probar checkout y verificar que no se vea información de pago.
4. Probar navegación pública y verificar que las URLs sensibles estén redacted si corresponde.
5. Confirmar costo y volumen estimado en PostHog.

## Conclusión

Replay no está listo para producción todavía. La postura actual correcta es mantenerlo deshabilitado hasta completar masking, exclusiones y sampling con revisión manual.
