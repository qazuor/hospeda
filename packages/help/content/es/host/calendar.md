---
id: calendar
title: "Bloquear fechas y conectar un calendario externo"
summary: "Cómo bloquear fechas de tu alojamiento y sincronizarlo con Google, Airbnb, Booking.com u otro calendario."
audiences:
  - host
verticals:
  - accommodation
keywords:
  - "calendario"
  - "disponibilidad"
  - "bloquear"
  - "fechas ocupadas"
  - "ocupado"
  - "sincronizar"
  - "google calendar"
  - "airbnb"
  - "booking"
  - "ical"
  - "reservas superpuestas"
destinations:
  - kind: ownEditorSection
    vertical: accommodation
    section: calendar
    label: "Calendario"
  - kind: plans
    vertical: accommodation
    label: "Planes para alojamientos"
public: false
related:
  - change-plan
  - publish-requirements
  - inquiries
covers:
  - "page:planes/anfitriones"
  - "entitlement:can_use_calendar"
  - "entitlement:can_sync_external_calendar"
entryFor:
  - "section:accommodation.calendario"
reviewedAt: "2026-11-23"
---

## Qué podés hacer

Bloquear y liberar fechas, y conectar calendarios externos, desde {{link:section:accommodation:calendario|Calendario}}.

## Cómo se hace

1. Abrí el editor de tu alojamiento («Mis propiedades» → «Editar») y entrá a «Calendario». Es una sección de alojamientos.
2. En el calendario de ocupación, hacé clic en un día y en otro para elegir un rango, sumá una nota si querés y tocá «Bloquear». Con «Liberar» desbloqueás. Esas fechas no aparecen disponibles en las búsquedas.
3. Para sincronizar con otro calendario, tocá «Conectar calendarios externos».
4. Con Google Calendar, tocá «Conectar Google Calendar» y aprobá el acceso de solo lectura. Con Airbnb, Booking.com u otro, pegá la URL de exportación en formato iCal (.ics) y tocá «Conectar».
5. Una vez conectado ves su estado y podés usar «Sincronizar ahora» o «Desconectar». Lo ya sincronizado queda como está al desconectar.
6. Los bloqueos que llegan de un calendario conectado no se editan desde Hospeda: para liberar esos días, cambiá el evento en el calendario de origen o desconectalo.
7. El calendario y la sincronización dependen de tu plan: si no los incluye, el editor lo avisa y te lleva a mejorar el plan.

## Qué esperar

- Las fechas bloqueadas no aparecen disponibles en las búsquedas.
- Un calendario conectado muestra su estado y se puede sincronizar a mano o desconectar.
- El calendario y la sincronización dependen de tu plan: compará {{link:plans:accommodation|los planes para alojamientos}}.

## Qué NO esperar

- Editar desde Hospeda los bloqueos que llegan de un calendario conectado.
- Que desconectar un calendario borre lo que ya se sincronizó.

## Problemas comunes

### El editor dice que mi plan no incluye el calendario {#sin-plan}

Mirá {{article:change-plan|cómo cambiar tu plan}}.

### Un día sincronizado no se puede liberar {#sincronizado}

Cambiá el evento en el calendario de origen o desconectalo.
