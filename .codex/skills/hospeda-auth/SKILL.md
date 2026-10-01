---
name: hospeda-auth
description: Reglas para Better Auth, sesiones, actores, roles, permisos y superficies públicas/protegidas de Hospeda.
triggers:
  - Better Auth
  - autenticación
  - autorización
  - sesión
  - roles
  - permisos
  - rutas protegidas
---

# Hospeda Auth

Usá este skill cuando el cambio toque autenticación, sesiones, actores, roles,
permisos, trusted origins o rutas protegidas en cualquier app.

## Reglas

- Reutilizá la configuración y helpers de Better Auth existentes.
- Diferenciá identidad autenticada, actor, rol y permiso.
- Aplicá middleware y checks en el punto correcto; no confíes sólo en ocultar UI.
- Conservá trusted origins, cookies, CSRF y redirecciones declaradas.
- No guardes secretos ni tokens en código, logs, fixtures o documentación.
- Los bypass de staff/admin deben ser explícitos, acotados y testeados.

## Verificación

- Probá no autenticado, autenticado, rol insuficiente, permiso válido y sesión
  expirada.
- Verificá API y UI: una protección debe existir en servidor aunque la UI también
  la oculte.
- No uses credenciales reales para smoke tests.

## Checklist

- [ ] Actor, rol y permiso están diferenciados.
- [ ] Protección server-side y client-side coherentes.
- [ ] Origins y cookies no cambiaron accidentalmente.
- [ ] Bypass y errores de auth tienen cobertura.
- [ ] No se expusieron secretos.
