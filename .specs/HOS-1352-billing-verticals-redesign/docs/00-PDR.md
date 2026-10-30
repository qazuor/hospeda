---
title: PDR rector — Rediseño integral de Verticales y Billing
linear: HOS-1352
statusSource: linear
created: 2026-09-15
status: CURRENT
mutability: INMUTABLE
author: owner
---

> **ESTE DOCUMENTO ES INMUTABLE.**
>
> Es el prompt rector entregado por el owner el 2026-09-15, transcripto **verbatim**.
> Lo único agregado es el frontmatter de arriba y este bloque de nota.
>
> Toda desviación, aclaración o decisión posterior se registra en
> [`01-decision-log.md`](./01-decision-log.md) — **nunca** editando este archivo.
> Si una decisión contradice al PDR, el PDR sigue diciendo lo que decía y la
> decisión dice por qué se apartó.

---

# PDR / PROMPT RECTOR
# Rediseño integral de Verticales, Trials, Billing, Suscripciones, Entitlements, Limits y Complementos de Hospeda

## 0. IMPORTANTE: LEER ANTES DE HACER CUALQUIER COSA

Este trabajo afecta una de las áreas más delicadas de Hospeda.

NO quiero otro refactor incremental realizado a partir de cómo está escrito hoy el código.

NO quiero que la implementación existente condicione el diseño del sistema nuevo.

NO quiero que tomes decisiones funcionales importantes implícitamente.

NO quiero que empieces a programar después de leer este documento.

Primero tenemos que:

1. definir correctamente el dominio;
2. cerrar todas las decisiones funcionales;
3. verificar experimentalmente las capacidades necesarias de Mercado Pago;
4. diseñar la arquitectura ideal;
5. recién después contrastarla contra el código existente.

La arquitectura actual NO es la fuente de verdad.

La fuente de verdad será:

1. este documento;
2. las decisiones explícitamente tomadas durante el proceso;
3. las specs aprobadas que surjan de este trabajo.

Toda decisión no especificada debe identificarse como:

`OPEN DECISION`

Toda cuestión que pueda cambiar significativamente la arquitectura:

`BLOCKING DECISION`

Toda hipótesis sobre Mercado Pago aún no comprobada:

`PENDING MP VALIDATION`

NO convertir en decisiones:

- recuerdos;
- comportamiento legacy;
- documentación obsoleta;
- comentarios viejos;
- implementaciones actuales;
- suposiciones sobre Mercado Pago.

---

# 1. OBJETIVO GENERAL

Tenemos problemas estructurales relacionados con:

- verticales;
- trials;
- planes;
- billing;
- subscriptions;
- Mercado Pago;
- pagos manuales;
- ciclos de facturación;
- upgrades;
- downgrades;
- cancelaciones;
- pausas;
- grace periods;
- promo codes;
- cortesías;
- entitlements;
- limits;
- complementos;
- publicación;
- roles;
- permisos;
- emails;
- auditoría;
- observabilidad;
- administración;
- testing.

Durante aproximadamente el último mes realizamos múltiples refactors intentando ordenar este sistema.

Algunos mejoraron partes puntuales.

Pero seguimos encontrando:

- lógica duplicada;
- implementaciones divergentes;
- comportamiento diferente por vertical;
- restos de arquitecturas anteriores;
- código legacy;
- conceptos obsoletos;
- caminos parcialmente migrados;
- bugs derivados del diseño histórico.

Por este motivo NO queremos continuar indefinidamente parchando.

El objetivo es diseñar:

**cómo construiríamos hoy Verticales + Billing de Hospeda si partiéramos desde cero, con todo lo que ya aprendimos.**

Después:

1. compararemos ese diseño contra el código existente;
2. determinaremos qué sirve;
3. qué debe eliminarse;
4. qué conviene reescribir;
5. qué eventualmente puede adaptarse.

---

# 2. REGLA DE REWRITE VS REFACTOR

Existe una preferencia explícita hacia REWRITE cuando el código actual:

- es difícil de entender;
- tiene comportamiento divergente;
- mezcla conceptos viejos;
- no es completamente genérico;
- tiene lógica específica por vertical;
- requiere muchos cambios para ajustarse al nuevo modelo;
- arrastra Commerce;
- tiene deuda técnica significativa;
- no estamos 100% seguros de que sea correcto.

Llevamos aproximadamente un mes intentando sucesivos refactors y seguimos encontrando problemas.

Por eso:

**NO conservar código simplemente porque ya existe.**

Solo considerar `KEEP` cuando estemos razonablemente 100% seguros de que el código:

1. funciona correctamente;
2. representa el dominio nuevo;
3. es genérico;
4. sirve para todas las verticales a las que corresponde;
5. tiene tests adecuados;
6. no depende de conceptos legacy.

Si para transformar una pieza vieja en la arquitectura correcta resulta costoso, complejo o riesgoso:

**preferir REWRITE antes que continuar acumulando refactors.**

La carga de prueba debe estar del lado de conservar código legacy.

No del lado de justificar reescribirlo.

---

# 3. DOCUMENTACIÓN OBLIGATORIA DESDE EL MOMENTO CERO

La documentación NO es una fase final.

Es una actividad obligatoria desde el primer minuto.

## 3.1 Primer paso obligatorio

Antes de comenzar incluso FASE 1A:

guardar este mismo PDR/prompt dentro del proyecto como documento rector.

Debe quedar claramente identificado como:

- guía de trabajo;
- source of truth inicial;
- metodología;
- objetivos;
- invariantes.

NO modificar silenciosamente este documento para hacer coincidir decisiones posteriores.

Las nuevas decisiones deben documentarse explícitamente.

---

## 3.2 Worklog / Progress Log obligatorio

Desde el inicio crear un documento de seguimiento que registre cronológicamente:

- qué se investigó;
- qué se encontró;
- qué decisiones se tomaron;
- quién/qué las tomó;
- preguntas abiertas;
- respuestas del owner;
- documentación creada;
- experimentos realizados;
- resultados;
- problemas encontrados;
- cambios de dirección;
- próximos pasos.

Debe poder responder:

**"¿Qué hicimos hasta ahora y por qué?"**

---

## 3.3 Handoff obligatorio

Este proyecto puede superar múltiples context windows.

Por eso mantener un documento de handoff vivo.

Antes de cada handoff/context reset:

actualizarlo.

El nuevo agente/subagente debe comenzar leyendo obligatoriamente:

1. este PDR;
2. Master Decision Log;
3. Progress/Worklog;
4. Current Handoff;
5. specs vigentes;
6. Open Decisions.

NO confiar en memoria implícita.

---

## 3.4 Decision Log

Mantener registro explícito de decisiones importantes.

Cada decisión debería incluir:

- ID;
- fecha;
- problema;
- alternativas;
- decisión;
- motivo;
- implicaciones;
- si reemplaza una decisión anterior.

Ejemplo:

`DEC-BILL-001 - Trial scope = user + vertical`

---

## 3.5 Documentación vigente vs histórica

Debe distinguirse claramente:

- CURRENT;
- LEGACY;
- OBSOLETE;
- SUPERSEDED.

Nunca permitir que documentación antigua parezca vigente.

Esto es especialmente importante porque ya tuvimos problemas por agentes reutilizando conocimiento viejo como si continuara siendo válido.

---

# 4. PROHIBICIÓN INICIAL

Hasta llegar explícitamente a implementación:

MUST NOT:

- modificar código productivo;
- crear migrations productivas;
- borrar código;
- cambiar DB productiva;
- refactorizar servicios;
- modificar integración productiva con Mercado Pago;
- crear PRs de implementación;
- decidir conservar algo solo porque existe.

Sí se permite:

- investigar;
- leer;
- documentar;
- ejecutar queries;
- inspeccionar DB;
- revisar issues;
- revisar Linear;
- revisar memoria;
- revisar Engram;
- inspeccionar logs;
- crear scripts experimentales descartables;
- probar Mercado Pago sandbox/API;
- ejecutar tests;
- crear specs;
- crear matrices de pruebas.

---

# 5. CONTEXTO HISTÓRICO

Sirve para entender cómo llegamos aquí.

NO debe utilizarse para justificar arquitectura legacy.

## 5.1 Primera versión

Hospeda originalmente tenía solamente:

- Alojamientos.

Posteriormente implementamos:

- trial manejado por Hospeda;
- creación de `preapproval` mediante API;
- redirección posterior del usuario a Mercado Pago.

---

## 5.2 Aparición de Commerce

Luego agregamos:

- Gastronomía;
- Experiencias.

Se las agrupó parcialmente bajo una pseudovertical:

`commerce`.

En vez de reutilizar correctamente Alojamientos, aparecieron caminos separados para:

- trial;
- billing;
- subscription;
- entitlements;
- limits;
- complementos;
- UI.

Aquí comienza gran parte de la divergencia actual.

---

## 5.3 Path C / Preapproval creado directamente por el usuario en Mercado Pago

Posteriormente abandonamos temporalmente el modelo donde Hospeda creaba el `preapproval` vía API.

Pasamos a lo que históricamente denominamos:

`Path C`.

En Path C:

Hospeda NO generaba primero el `preapproval` mediante API.

En su lugar:

1. Hospeda enviaba directamente al usuario a Mercado Pago;
2. el propio usuario completaba allí el flujo;
3. Mercado Pago terminaba creando/configurando el preapproval durante ese proceso.

También se trasladó trial hacia Mercado Pago en esa etapa.

Esto generó nuevos problemas:

- menor control;
- linking complejo;
- subscriptions huérfanas;
- dificultad para vincular inequívocamente User Hospeda + Vertical + Subscription + Preapproval;
- mayor divergencia entre caminos.

---

## 5.4 Partner

Luego agregamos Partner.

Nuevamente aparecieron comportamientos particulares en vez de utilizar una infraestructura verdaderamente genérica.

---

## 5.5 Separación Gastronomía / Experiencias

Posteriormente decidimos que:

- Gastronomía;
- Experiencia;

son verticales independientes de primera clase.

Sin embargo Commerce no desapareció completamente.

Hoy pueden coexistir restos de:

- commerce;
- gastronomy;
- experience;
- lógica parcialmente compartida;
- lógica completamente separada.

Eso debe eliminarse.

---

## 5.6 Regreso al preapproval creado por Hospeda vía API

Finalmente decidimos abandonar Path C como modelo principal.

Volvimos al enfoque donde:

1. Hospeda crea explícitamente el `preapproval` mediante API;
2. queda asociado desde el comienzo a nuestro dominio;
3. recién después enviamos al usuario a Mercado Pago para completar/autorizar el proceso.

También volvimos a administrar el trial desde Hospeda.

Este es el modelo conceptual desde el cual partimos actualmente.

Pero NO asumir automáticamente que la implementación actual sea correcta.

Debe validarse nuevamente contra los requisitos y mediante pruebas reales.

---

# 6. TERMINOLOGÍA

## Vertical

Categoría/producto dentro de Hospeda.

Actualmente:

- Turista;
- Alojamiento;
- Gastronomía;
- Experiencia;
- Partner.

---

## Billable / Commercial Vertical

Vertical que puede participar del sistema de planes/billing.

Actualmente incluye:

- Turista;
- Alojamiento;
- Gastronomía;
- Experiencia;
- Partner.

Pero Turista es un caso especial.

Turista NO tiene ficha/listing comercial.

Su plan pago mejora las capacidades del user como turista.

---

## Commercial Listing Verticals

Actualmente:

- Alojamiento;
- Gastronomía;
- Experiencia.

Poseen fichas/listings.

---

## Partner

Es una vertical comercial pero tiene modelo propio de presencia.

No tiene listing estándar.

Sin embargo:

**Partner Gold puede tener página propia.**

Conceptualmente esa página cumple parte del rol que una ficha cumple en otras verticales, pero NO debemos forzarla necesariamente al modelo `Listing`.

Diseñar correctamente esta diferencia.

---

## Listing / Ficha

Recurso publicable propiedad de un user.

Actualmente:

- alojamiento;
- gastronomía;
- experiencia.

Una ficha tiene exactamente:

**1 owner user.**

NO existe multi-owner.

Un user puede tener múltiples fichas.

---

## User

Cuenta autenticada.

---

## Guest

Persona sin autenticar.

---

## Turista

User autenticado usando capacidades destinadas al turista.

---

# 7. PRINCIPIO ARQUITECTÓNICO CENTRAL

Debe existir:

**un único motor genérico de billing.**

NO:

- billing alojamiento;
- billing gastronomía;
- billing experiencia;
- billing partner;
- billing turista completamente separado.

Las diferencias deben provenir de:

- DB;
- configuración almacenada en DB;
- capacidades;
- policies;
- strategy;
- vertical context.

No duplicación.

---

# 8. TRES EJES

## Eje 1

Infraestructura transversal:

- trial;
- plans;
- billing options;
- subscription;
- payments;
- payment provider;
- grace;
- pause;
- cancellation;
- upgrade;
- downgrade;
- promo;
- courtesy;
- entitlements;
- limits;
- notifications;
- audit;
- reconciliation.

---

## Eje 2

Comportamiento específico de vertical.

---

## Eje 3

Addons/complementos.

---

# 9. SOURCE OF TRUTH DE CONFIGURACIÓN

Toda configuración relevante del dominio debe salir:

**SI O SI DE DATABASE.**

NO usar:

- archivos TS;
- JSON de configuración;
- constantes duplicadas;
- config files por app;
- environment variables para reglas comerciales;
- listas hardcodeadas.

Esto ya produjo inconsistencias anteriormente.

La DB debe ser source of truth para:

- verticales;
- plans;
- trial plans;
- billing options;
- prices;
- currencies;
- trial duration;
- trial emails;
- entitlements;
- limits;
- inheritance;
- pause settings;
- supported payment methods;
- promo policies;
- addons;
- cualquier regla comercial configurable.

Código solamente debe contener comportamiento/algoritmos que no representen configuración comercial.

---

# 10. TRIAL

## 10.1 Scope

Trial único de por vida por:

`user + vertical`

Ejemplo:

consume Alojamiento Trial.

Nunca más tiene Alojamiento Trial.

Puede posteriormente tener:

Gastronomía Trial.

---

## 10.2 No reseteable

No reinicia por:

- borrar ficha;
- crear nueva;
- cancelar;
- volver después;
- cambiar plan;
- volver a registrarse sobre la misma identidad si podemos detectarlo.

---

# 10.3 PLAN ESPECIAL DE TRIAL

Cada vertical que soporte trial debe tener:

**exactamente un Trial Plan especial.**

Este plan NO es un plan comercial elegible por el user.

Se asigna automáticamente al comenzar trial.

Debe otorgar:

### Entitlements

Exactamente los entitlements del plan comercial más premium de esa vertical.

### Limits

Exactamente los limits del plan comercial más básico de esa vertical.

IMPORTANTE:

estos valores NO deben copiarse manualmente al Trial Plan.

Deben derivarse automáticamente.

Ejemplo:

si mañana Premium agrega:

`AI_CHAT`

el Trial Plan debe recibirlo automáticamente.

Si mañana Basic cambia:

`MAX_PHOTOS: 20 -> 25`

Trial debe pasar automáticamente a 25.

NO queremos sincronización manual.

NO queremos duplicación.

NO queremos que Trial Plan quede desactualizado.

La arquitectura debe modelar esta derivación explícitamente.

---

# 10.4 Inicio del trial

Para verticales con ficha:

**el trial comienza exactamente al PUBLICAR la primera ficha.**

NO:

- al registrarse;
- al crear draft;
- al entrar al onboarding;
- al guardar formulario parcial.

La publicación efectiva dispara el consumo del trial.

Partner y cualquier vertical futura sin Listing deberán definir su evento funcional equivalente explícitamente.

---

# 10.5 Máximo una ficha durante trial

Durante trial:

máximo una ficha dentro de esa vertical.

NO se permite adquirir addons mientras el user solamente está en trial.

Los addons/complementos solo pueden comprarse cuando existe una subscription comercial activa compatible.

Por tanto:

si quiere superar el límite de trial debe:

1. suscribirse;
2. elegir un plan que otorgue capacidad suficiente;

o:

3. suscribirse a un plan como Basic y posteriormente adquirir un addon compatible.

Nunca:

Trial + addon pago.

---

# 10.6 Fin del trial

Si no se suscribe:

`TRIAL_ACTIVE -> SUSPENDED`

Consecuencias:

- fichas fuera del listado;
- no edición;
- no creación;
- pérdida de capabilities comerciales;
- datos conservados;
- acceso read-only correspondiente;
- acceso a billing;
- posibilidad de suscribirse y recuperar el servicio.

---

# 10.7 Emails antes y después del vencimiento del trial

## Pre-vencimiento

Schedule configurable desde DB.

Ejemplo default:

- 10 días antes;
- 5 días antes;
- 2 días antes;
- día de vencimiento.

Si el trial dura menos:

ignorar thresholds imposibles.

---

## Recovery post-trial

Si venció y NO se suscribió:

continuar intentando recuperar al customer.

Schedule inicial deseado:

- +1 día;
- +5 días;
- +15 días;
- +30 días;
- +60 días.

Los mails deben:

- recordar que sus datos siguen disponibles;
- explicar que no está publicado;
- permitir suscribirse fácilmente;
- indicar claramente la vertical.

Después del contacto de +60 días:

finaliza esta campaña automática de recuperación.

No continuar enviando indefinidamente.

---

# 11. SUBSCRIPTION PRINCIPAL

Máximo:

`1 main subscription por user + vertical`

Puede tener simultáneamente distintas verticales en estados diferentes.

---

# 12. VARIAS FICHAS

Una subscription cubre todas las fichas del user dentro de esa vertical.

Cantidad controlada mediante limits.

Si la subscription:

- pausa;
- suspende;
- cancela;
- pierde acceso;

afecta todas las fichas de ESA vertical.

No otras.

---

# 13. AUTORIZACIÓN, ROLES, ENTITLEMENTS Y LIMITS

Los roles aportan permisos/pertenencia.

Pero:

**ROLE NO ES SUFICIENTE PARA AUTORIZAR UNA OPERACIÓN.**

La validación real debe ocurrir en services/domain layer correspondiente.

Como mínimo verificar:

1. authenticated user;
2. owner;
3. role/permission;
4. vertical scope;
5. access state;
6. active trial/subscription/courtesy;
7. entitlement;
8. applicable limits.

Problema específico a evitar:

un user con Gastronomía activa termina ejecutando una operación de Alojamientos porque ambos tienen capabilities conceptualmente parecidas.

Todos los permisos/capabilities relevantes deben tener contexto suficiente para evitar cross-vertical authorization.

---

# 14. TURISTA FREE

Todo user autenticado tiene estado base:

`Turista Free`.

No requiere Subscription real.

La pricing UI puede mostrarlo como:

- plan;
- gratis;
- activo.

Pero eso no obliga a modelarlo como una Subscription artificial.

---

# 15. TURISTA PAGO / VIP

Turista posee además al menos un plan pago.

Ese plan:

- no crea listing;
- no representa negocio comercial;
- mejora capacidades del user como turista.

Debe utilizar el motor genérico de:

- plans;
- billing;
- subscription;
- payment;
- promo;
- etc.

Pero las capabilities específicas son de Turista.

---

# 16. HERENCIA TURISTA VIP

Cada plan/vertical comercial puede configurar desde DB si hereda beneficios de Turista VIP.

No hardcodear.

Actualmente esperamos `true` para las verticales comerciales actuales donde tenga sentido.

Una vertical futura puede configurar `false`.

---

# 17. PARTNER

Partner usa el mismo motor de:

- trial;
- plans;
- billing;
- subscriptions;
- entitlements;
- limits;
- promo;
- courtesy;
- addons.

Difiere solo en su funcionalidad específica.

---

# 17.1 Partner Gold

Partner Gold puede contar con página propia.

Es una presencia pública similar funcionalmente a una ficha, pero NO debemos forzar la entidad Partner dentro del modelo Listing solo por esa semejanza.

Diseñar correctamente.

---

# 17.2 Métodos de pago

Partner necesita soportar actualmente:

- Mercado Pago;
- pago manual/efectivo.

Pero debe ser configurable POR PLAN desde DB.

No:

`if partner -> cash`.

Mañana otra vertical podría permitirlo.

---

# 17.3 PARTNER NO ES SELF-SERVICE

Partner MUST NOT utilizar onboarding self-service.

Existen solamente dos caminos de alta.

## Camino A: Postulación

1. interesado completa formulario de Partner;
2. admin revisa;
3. admin aprueba o rechaza;
4. si rechaza:
   - se comunica correspondientemente;
5. si aprueba:
   - comprobar si existe User Hospeda con el email;
6. si NO existe:
   - crear user;
   - enviar email para validar dirección;
   - pedir que complete perfil como cualquier otro user;
7. admin configura Partner/plan;
8. si método requiere MP:
   - enviar link para completar subscription/pago;
9. si método manual:
   - continuar flujo administrativo/manual.

---

## Camino B: Alta directa por admin

Admin puede registrar un Partner directamente sin postulación previa.

Debe:

1. ingresar datos necesarios;
2. comprobar user por email;
3. crear user si no existe;
4. enviar validación de email;
5. pedir completar perfil;
6. configurar Partner;
7. gestionar método de pago correspondiente.

NO existe tercera opción self-service.

---

# 18. PLAN Y BILLING OPTION

Plan representa tier/capabilities.

Billing Option representa:

- mensual;
- trimestral;
- semestral;
- anual;
- precio;
- currency;
- provider-specific configuration.

No duplicar Premium cuatro veces conceptualmente.

---

# 19. CICLOS

Soportar:

- mensual;
- trimestral;
- semestral;
- anual.

Implementación exacta MP:

`PENDING MP VALIDATION`

---

# 20. GRACE PERIOD

Pago fallido:

`ACTIVE -> GRACE_PERIOD`

Duración:

**10 días.**

Durante grace:

- servicio activo;
- fichas publicadas;
- edición activa;
- entitlements activos;
- advertencias;
- emails.

Si pago entra:

`GRACE_PERIOD -> ACTIVE`

Si no:

`GRACE_PERIOD -> SUSPENDED`

---

# 21. SUSPENDED

Consecuencias:

- no listing público;
- no edición;
- no creación;
- sin entitlements comerciales;
- datos conservados;
- Mi Cuenta read-only;
- billing accesible;
- recuperación posible.

---

# 22. PAGOS TARDÍOS Y RECONCILIACIÓN

Si llega un pago después de suspensión:

evaluar:

- timestamp real;
- payment status;
- subscription;
- posible nueva subscription;
- posibles dobles cobros.

Si es seguro:

reactivar.

Si existe ambigüedad:

`RECONCILIATION_REQUIRED`

---

# 22.1 RECONCILIATION_REQUIRED

SIEMPRE que el sistema llegue a:

`RECONCILIATION_REQUIRED`

MUST:

1. registrar evento crítico;
2. generar información suficiente para investigar;
3. enviar email a `SUPER_ADMIN`;
4. mostrar alerta en Admin si corresponde;
5. evitar decisiones destructivas automáticas hasta resolver.

El objetivo es que SUPER_ADMIN esté al tanto y pueda intervenir.

---

# 23. RECONCILIATION JOB

Debe existir proceso periódico contra MP.

Detectar:

- missing webhook;
- duplicate;
- orphan payment;
- orphan subscription;
- state mismatch;
- unknown preapproval;
- discrepancias.

---

# 24. CANCELACIÓN

Cancelación normal:

se hace efectiva al final del período ya pagado.

Hasta entonces mantiene servicio.

No nueva renovación.

---

# 25. RETENCIÓN

Desde que queda efectivamente inactiva:

## Día 90

Soft delete.

## Día 180

Hard delete de datos operativos eliminables.

Conservar:

- auditoría;
- pagos;
- registros obligatorios;
- información legal;
- historial necesario.

---

# 26. PAUSA

Solo:

- Subscription ACTIVE;
- billing mensual;
- plan que permita pause.

NO:

- trial;
- trimestral;
- semestral;
- anual.

---

# 26.1 Efectos

Detiene:

- billing;
- publicación;
- edición;
- servicio.

Conserva datos.

---

# 26.2 Fin de pausa

Al crear pausa se define fecha de fin.

Pero el user puede:

**reactivar manualmente antes de esa fecha si lo desea.**

Por tanto hay dos caminos:

1. auto-resume al llegar `pauseUntil`;
2. early resume solicitado por user.

Ambos deben:

- actualizar billing correctamente;
- restaurar publicación;
- restaurar entitlements;
- emitir mails/eventos.

Implementación MP:

`PENDING MP VALIDATION`

---

# 26.3 Límites de pausa

Desde DB.

Defaults:

- máximo 3 pausas por ventana móvil de 12 meses;
- máximo 120 días por pausa;
- máximo 240 días acumulados en ventana móvil de 12 meses.

Un plan puede configurar:

- valores distintos;
- pausa deshabilitada.

---

# 26.4 Días pagos

User no debe perder período ya pagado por estar pausado.

Cómo lograrlo:

`PENDING MP VALIDATION`

---

# 27. UPGRADE

Upgrade:

inmediato.

Entitlements/limits nuevos:

inmediatos.

Impacto económico/provider:

`PENDING MP VALIDATION`

---

# 28. DOWNGRADE

Aplicación:

fin del ciclo actual.

Hasta entonces conserva plan anterior.

---

# 28.1 Exceso de limits

Informar antes.

Dos opciones:

1. user decide qué eliminar/desactivar;
2. Hospeda aplica política automática.

Evitar hard delete.

Preferir:

- archive;
- disable;
- unpublish.

Cada tipo de limit puede definir:

`enforcementStrategy`.

---

# 29. CAMBIOS DE PRECIO

Puede afectar:

- customers nuevos;
- subscriptions existentes.

Debe:

- cumplir normativa argentina;
- avisar;
- mostrar precio anterior/nuevo;
- fecha efectiva;
- permitir cancelación.

Investigar normativa actual antes de implementar.

---

# 30. PAGOS MANUALES

Mismo motor de Subscription.

Payment method distinto.

Si falta pago:

`GRACE_PERIOD`

durante 10 días.

Además notificar admin.

Admin puede:

- registrar pago;
- confirmar no pago.

Si termina grace sin pago:

`SUSPENDED`.

---

# 31. PROMO CODES - GENERAL

Tipos:

- `TRIAL_EXTENSION`;
- `DISCOUNT`.

Scope configurable:

- una vertical;
- varias verticales;
- todas las verticales actuales;
- todas las verticales actuales y futuras.

Cada user:

máximo un uso de cada código.

Cada promo define:

- stackable;
- usableWhileAnotherPromoActive.

---

# 32. TRIAL_EXTENSION PROMO

Solo válido durante:

`TRIAL_ACTIVE`.

Nunca después.

Backend debe rechazar.

UI debe explicar.

Puede:

- extender N días;
- respetar scopes configurados.

---

# 33. DISCOUNT PROMO

Soportar:

- porcentaje;
- monto fijo;
- primer cobro;
- N cobros;
- forever.

Con scope y stackability configurables.

---

# 34. CORTESÍA TEMPORAL

Admin puede otorgar:

`N días / meses gratis`.

Debe tener scope configurable, de forma equivalente al sistema de Free Forever.

Puede aplicarse a:

- una vertical;
- varias verticales;
- todas las verticales actuales;
- todas las verticales actuales y futuras,

siempre durante el período temporal configurado.

---

## 34.1 Durante trial

Extiende el trial para las verticales correspondientes.

---

## 34.2 Durante subscription

Mantiene servicio sin cobrar durante el período otorgado.

NO asumir implementación contra MP.

Debe investigarse.

`PENDING MP VALIDATION`

---

# 35. FREE FOREVER / CORTESÍA PERMANENTE

Solo:

`SUPER_ADMIN`.

Modelarlo como Grant independiente.

---

# 35.1 Scope de verticales

Al crear grant elegir:

- una;
- varias;
- todas actuales;
- todas actuales y futuras.

---

# 35.2 Addons

Flag:

`includesAddons`.

### false

Plans gratis según scope.

Addons pagos.

### true

Addons compatibles pueden utilizarse a costo $0.

NO activarlos automáticamente.

---

# 35.3 Subscription existente

Cancelar toda obligación de pago cubierta.

Incluye:

- Mercado Pago;
- manual.

---

# 35.4 Auditoría

Guardar:

- super admin;
- beneficiary;
- scope;
- addon flag;
- timestamp;
- reason;
- affected subscriptions.

---

# 36. ENTITLEMENTS

Representan capabilities.

Deben poder provenir de:

- plan;
- Turista VIP inheritance;
- addon;
- courtesy;
- grant.

Si varias sources lo otorgan:

permanece activo mientras al menos una exista.

---

# 36.1 Vertical scope

Un entitlement/capability no debe escapar accidentalmente a otra vertical.

---

# 36.2 AI Chat

Chat de ficha corresponde a verticales comerciales con fichas.

Turista autenticado puede utilizar gratuitamente el chat disponible.

Guest no es equivalente a Turista.

---

# 37. LIMITS

Scope explícito.

Pueden acumularse.

Ejemplo:

Plan 20 fotos
+
Addon +30
=
50.

Al desaparecer source:

recalcular effective limit.

Si queda excedido:

enforcement controlado.

---

# 38. ADDONS

Solo pueden adquirirse teniendo una subscription válida compatible.

NO durante trial.

Tipos:

- one-time;
- recurrent.

---

# 39. ADDON PRODUCT VS INSTANCE

## Product

Define:

- capability;
- price;
- recurrence;
- compatible verticals;
- duration;
- effects;
- scope type.

## Instance

Define:

- owner;
- target;
- start;
- end;
- state;
- payment/subscription;
- specific resource.

---

# 40. ADDON SCOPE

Como mínimo:

- `LISTING`;
- `VERTICAL_SUBSCRIPTION`;
- `USER`;
- `GLOBAL`.

---

# 40.1 Ejemplos

`+20 fotos`

Compatible con varias verticales.

Scope:

`LISTING`.

User selecciona ficha concreta.

---

`+5 fichas`

Scope:

`VERTICAL_SUBSCRIPTION`.

---

`Boost 7 días`

Normalmente:

`LISTING`.

---

# 41. ADDON ORPHANING

Al cancelar una vertical:

NO cancelar ciegamente cualquier addon.

Verificar si el addon todavía tiene target/context válido.

Solo cancelar cuando queda efectivamente huérfano.

---

# 42. EMAILS

Schedules configurables desde DB.

No código.

---

# 42.1 Trial

Pre-vencimiento configurable.

Post-vencimiento:

- +1;
- +5;
- +15;
- +30;
- +60.

---

# 42.2 Renewal

Defaults:

- -5 días;
- -1 día.

---

# 42.3 Grace

Schedule configurable durante 10 días.

---

# 43. EMAIL NO CONTROLA DOMAIN

Si falla mail:

acción de dominio permanece.

---

# 44. EMAIL OUTBOX

Hospeda debe garantizar que el intento de notificación quede registrado.

Soportar:

- pending;
- processing;
- sent;
- failed;
- retry;
- provider id;
- attempts.

---

# 45. MI CUENTA

Cada vertical aporta menú/sección adecuada.

Roles pueden influir qué se muestra.

Autorización backend jamás depende de ocultar UI.

---

# 46. MI SUSCRIPCIÓN

Mostrar:

- todas las verticales;
- trials;
- subscriptions;
- billing cycle;
- grace;
- pause;
- scheduled cancellation;
- addons;
- courtesy;
- Free Forever.

Claridad total de scope.

---

# 47. PRICING

Cada vertical:

pricing propia.

Turista incluida.

---

## First use

`Empezar`

inicia ESA vertical.

---

## Trial

Elegir plan -> iniciar subscription.

---

## Active

Plan actual.

Cambio de plan.

---

# 48. ADMIN

Debe permitir inspeccionar:

- users;
- verticals;
- trial plans;
- commercial plans;
- billing options;
- subscriptions;
- payments;
- attempts;
- MP ids;
- manual payments;
- grace;
- pause;
- cancellation;
- promo;
- temporary courtesy;
- permanent grants;
- addons;
- audit;
- email;
- reconciliation;
- errors.

---

# 49. AUDITORÍA

Registrar eventos de dominio completos.

No limitarse a logs técnicos.

---

# 50. OBSERVABILIDAD

Logs estructurados con correlation.

Como mínimo:

- userId;
- vertical;
- subscriptionId;
- paymentId;
- provider identifiers;
- webhook id;
- request id;
- correlation id;
- listing;
- addon.

---

# 51. IDEMPOTENCIA

Diseñar explícitamente para:

- double click;
- retries;
- duplicated webhooks;
- out-of-order;
- duplicated jobs;
- network failures.

---

# 52. CONCURRENCIA

Analizar explícitamente:

- payment + cancellation;
- payment + pause;
- webhook + plan change;
- addon + downgrade;
- admin + customer;
- multiple webhook.

Definir:

- transaction boundaries;
- unique constraints;
- locks;
- optimistic concurrency;
- idempotency keys.

---

# 53. FACTURACIÓN FUTURA

Preparado para integrar ARCA posteriormente.

No implementarla ahora salvo decisión separada.

---

# 54. COMPROBANTE NO FISCAL

Hasta ARCA:

cada cobro genera comprobante/recibo PDF.

NO llamarlo factura fiscal.

---

# 55. COMMERCE DEBE DESAPARECER

Eliminar de fuentes activas:

- code;
- schema;
- types;
- tests;
- docs;
- specs;
- artifacts;
- comments;
- prompts;
- memory;
- Engram;
- TODO;
- naming.

---

# 55.1 Excepción histórica

Solo conservar referencias realmente necesarias para:

- auditoría;
- migration history;
- comprender datos legacy.

Marcadas inequívocamente:

`LEGACY`
o
`OBSOLETE`.

Si pueden confundir a agentes futuros:

eliminarlas de fuentes activas.

---

# 56. MIGRACIÓN ACTUAL

Preferir automática solamente si es:

- simple;
- segura;
- verificable.

Como hay pocos customers actuales:

si migrar automáticamente agrega mucha complejidad/riesgo:

preferir coordinación manual y nueva subscription.

NO contaminar la arquitectura nueva para salvar unas pocas relaciones legacy.

---

# 57. PAYMENT PROVIDER ABSTRACTION

Dominio no acoplado a MP.

Soportar conceptualmente:

- MercadoPago;
- Manual;
- provider futuro.

Sin sobrearquitectura.

---

# 58. MERCADO PAGO: VALIDACIÓN EXPERIMENTAL OBLIGATORIA

ANTES DE IMPLEMENTAR CÓDIGO PRODUCTIVO DE BILLING:

debemos comprobar experimentalmente absolutamente todas las variantes necesarias.

NO alcanza documentación.

NO alcanza código legacy.

NO alcanza memoria.

NO alcanza "parece soportarlo".

---

# 59. ORDEN DE INVESTIGACIÓN MP

Para cada comportamiento:

1. leer documentación oficial ACTUAL;
2. revisar limitaciones;
3. preparar prueba;
4. ejecutar contra API/sandbox;
5. probar happy path;
6. probar error paths;
7. probar estados ambiguos;
8. probar retries;
9. registrar request;
10. registrar response;
11. observar webhook;
12. documentar conclusión.

---

# 60. MATRIZ MP MÍNIMA

## Preapproval

- creación por API;
- linking;
- authorization;
- rejection;
- cancellation.

## Billing frequencies

- monthly;
- quarterly;
- semiannual;
- annual.

## Renewals

- success;
- failure;
- recovery.

## Grace

- recovery during grace;
- late payment;
- retry.

## Pause

- pause;
- no charge;
- early resume;
- automatic resume;
- date behavior;
- billing date behavior.

## Cancel

- scheduled end;
- immediate provider behavior.

## Price changes

- existing subscription;
- limitations;
- notification/consent behavior.

## Upgrade

- immediate;
- price effect.

## Downgrade

- next cycle;
- provider support.

## Temporary courtesy

- N free months;
- possible strategies;
- side effects.

## Permanent grant

- proper cancellation of MP subscriptions.

## Webhooks

- duplicate;
- delayed;
- out-of-order;
- retry;
- missing.

## Reconciliation

- query actual state;
- payment history;
- repairing local state.

---

# 61. RESULTADO DE PRUEBAS MP

Cada prueba debe terminar categorizada como:

- `VERIFIED`;
- `NOT_SUPPORTED`;
- `PARTIALLY_SUPPORTED`;
- `UNKNOWN`.

No comenzar implementación de una capability crítica mientras siga:

`UNKNOWN`.

---

# 62. TESTING STRATEGY

Testing forma parte del diseño desde el comienzo.

---

# 62.1 Domain / Integration

Cubrir 100% de escenarios funcionales relevantes.

No obsesionarse con 100% lines.

Cubrir especialmente:

- states;
- transitions;
- trial;
- billing;
- grace;
- pause;
- cancel;
- upgrade;
- downgrade;
- promo;
- courtesy;
- grant;
- addons;
- entitlements;
- limits;
- auth;
- reconciliation;
- races;
- idempotency.

---

# 62.2 Provider fake/stub

La gran mayoría de escenarios se prueba contra provider falso/controlado.

---

# 62.3 MP Sandbox

Suite real más pequeña pero obligatoria.

Verifica assumptions e integración real.

---

# 62.4 E2E

Cubrir los flujos críticos que hoy requieren smoke manual.

El objetivo es que cambios futuros no obliguen a repetir manualmente todo billing.

---

# 63. STATE MACHINES

La spec debe modelar explícitamente estados/transiciones de:

- Trial;
- Subscription;
- Payment;
- Manual Payment;
- Addon;
- Publication;
- Grace;
- Pause.

Aunque finalmente no utilicemos librería de state machines.

---

# 64. INVARIANTES FUNDAMENTALES

1. Trial máximo una vez por `user + vertical`.

2. Borrar ficha no devuelve trial.

3. Trial comienza al publicar.

4. Trial usa Trial Plan especial por vertical.

5. Trial Plan hereda dinámicamente entitlements de Premium y limits de Basic.

6. Trial permite máximo una ficha.

7. No se pueden comprar addons durante trial.

8. Un user puede tener máximo una main subscription por vertical.

9. Puede tener distintas verticales simultáneamente.

10. Una acción en una vertical no puede afectar otra accidentalmente.

11. Una ficha tiene un único owner.

12. Role no equivale a acceso activo.

13. Role no equivale a entitlement.

14. Los services validan vertical, access, entitlement y limits.

15. Toda configuración comercial viene de DB.

16. No usar archivos de configuración como source of truth de negocio.

17. Hospeda gobierna domain.

18. MP gobierna hechos ocurridos en MP.

19. Webhooks deben ser idempotentes.

20. Debe existir reconciliation.

21. `RECONCILIATION_REQUIRED` notifica SUPER_ADMIN.

22. Cancelación normal conserva período pagado.

23. Solo planes mensuales pueden pausarse.

24. Pause puede terminar anticipadamente por decisión del user.

25. Email nunca controla transacción de dominio.

26. Addon Product != Addon Instance.

27. Free Forever no activa addons automáticamente.

28. Free Forever puede incluir addons gratis opcionalmente.

29. Free Forever puede tener scope parcial o global.

30. Solo SUPER_ADMIN otorga Free Forever.

31. Partner no es self-service.

32. Commerce no existe en arquitectura nueva.

33. No implementar assumptions MP sin pruebas.

34. Código legacy dudoso se reescribe en vez de continuar refactor eterno.

35. Solo conservar legacy 100% correcto, genérico y compatible con el nuevo dominio.

36. Documentación se mantiene desde el minuto cero.

37. Cada handoff debe poder reconstruir exactamente lo realizado.

---

# 65. METODOLOGÍA

NO saltar fases.

---

# FASE 0 - BOOTSTRAP DE DOCUMENTACIÓN

ANTES DE TODO:

1. guardar este PDR en el repo;
2. crear Decision Log;
3. crear Progress/Worklog;
4. crear Handoff document;
5. registrar fecha/inicio;
6. dejar instrucciones para que futuros agentes lean estos documentos primero.

Esta fase es obligatoria.

---

# FASE 1A - DOMAIN ANALYSIS PURO

NO usar código actual para diseñar la solución.

Analizar este documento.

Buscar:

- contradiction;
- ambiguity;
- missing rule;
- edge case;
- impossible state;
- security problem;
- UX issue;
- business issue.

---

## Entrega 1A

### Contradictions

### Ambiguities

### Open Decisions

### Blocking Decisions

### Edge Cases

### Risks

### Missing Requirements

### Objections

### Suggested Improvements

### Questions for Owner

NO implementar.

---

# FASE 1B - DISCOVERY DE SISTEMA ACTUAL

Después de cerrar 1A.

Investigar:

- memory;
- Engram;
- issues;
- Linear;
- docs;
- specs;
- artifacts;
- source code;
- schema;
- migrations;
- tests;
- Web;
- API;
- Admin;
- jobs;
- logs.

Buscar funcionalidades olvidadas.

No asumir que se conservan.

---

# FASE 1C - EXPERIMENTACIÓN MERCADO PAGO

Ejecutar matriz descrita.

No diseñar integración final basándose solamente en documentación.

---

# FASE 2 - MASTER SPEC

Crear spec desde cero conceptual.

Debe incluir:

- domain;
- DB;
- entities;
- relations;
- constraints;
- states;
- transitions;
- invariants;
- services;
- API;
- jobs;
- provider;
- MP;
- manual payments;
- outbox;
- trial;
- subscription;
- billing;
- pause;
- grace;
- cancellation;
- plans;
- billing options;
- promo;
- courtesy;
- grants;
- addons;
- entitlements;
- limits;
- auth;
- UI;
- Admin;
- audit;
- observability;
- reconciliation;
- testing;
- migration.

---

# FASE 3 - ÉPICAS

Dividir Master Spec.

Cada épica con:

- objetivo;
- boundaries;
- dependencies;
- acceptance criteria;
- risks.

---

# FASE 4 - SPEC POR ÉPICA

Detallada.

---

# FASE 5 - GAP ANALYSIS CONTRA LEGACY

Clasificar:

## KEEP

Solo si estamos prácticamente 100% seguros de que:

- es correcto;
- genérico;
- bien testeado;
- usable por todas las verticales necesarias;
- representa el modelo nuevo.

## ADAPT

Solo cuando el cambio sea pequeño, claro y seguro.

## REWRITE

DEFAULT PREFERIDO cuando:

- adaptación es costosa;
- hay deuda;
- es específico de vertical;
- existen dudas;
- mezcla legacy;
- hubo múltiples refactors;
- no tenemos plena confianza.

## DELETE

Incorrecto/obsoleto.

## MISSING

No existe.

---

# FASE 6 - DECISIÓN REWRITE / REUSE

IMPORTANTE:

NO buscar maximizar reutilización.

Buscar maximizar:

- claridad;
- consistencia;
- mantenibilidad;
- corrección;
- testabilidad.

Debido a la experiencia del último mes:

**ante duda razonable entre seguir refactorizando una pieza problemática y reescribirla limpiamente, preferir reescribir.**

No debemos terminar otra vez con una mitad vieja y una mitad nueva.

---

# FASE 7 - IMPLEMENTATION STRATEGY

Definir:

- implementation order;
- dependency graph;
- migration;
- rollout;
- coexistence;
- staging;
- feature flags;
- rollback;
- observability;
- acceptance gates.

Todavía no implementar hasta aprobación.

---

# FASE 8 - ADVERSARIAL REVIEW

Subagente nuevo.

Instrucción:

**intentá romper el diseño.**

Buscar:

- double charge;
- payment loss;
- broken transitions;
- cross-vertical access;
- race;
- orphan;
- data loss;
- impossible migration;
- gaps;
- hidden coupling.

---

# FASE 9 - FINAL DESIGN REVIEW

Resolver findings.

Actualizar:

- Decision Log;
- Master Spec;
- Handoff;
- Worklog.

---

# FASE 10 - IMPLEMENTACIÓN

Solo ahora código productivo.

Cada cambio:

- spec-backed;
- tests;
- observability;
- audit;
- acceptance criteria.

Si código contradice spec:

STOP.

No adaptar silenciosamente la spec al código.

Discutir primero.

---

# 66. HANDOFF POLICY DURANTE TODO EL PROYECTO

Cuando el contexto se aproxime al límite:

ANTES DE TERMINAR:

1. actualizar Worklog;
2. actualizar Handoff;
3. listar decisiones cerradas;
4. listar pendientes;
5. indicar último punto completado;
6. indicar próximo paso exacto;
7. indicar documentos obligatorios a leer.

El nuevo agente debe leer primero:

1. PDR Rector;
2. Decision Log;
3. Worklog;
4. Handoff actual;
5. specs relacionadas.

Solo después continuar.

---

# 67. PRIMER TRABAJO A REALIZAR AHORA

Ejecutá únicamente:

## FASE 0

y después:

## FASE 1A

NO revisar todavía implementación para elegir arquitectura.

NO empezar FASE 1B hasta que yo responda las preguntas de 1A.

NO modificar código productivo.

NO implementar.

NO refactorizar.

NO crear migrations.

Primero:

1. guardar y documentar este PDR;
2. establecer mecanismos de continuidad/handoff;
3. analizar críticamente el dominio.

Tu respuesta de FASE 1A debe contener:

1. contradicciones;
2. ambigüedades;
3. decisiones abiertas;
4. blocking decisions;
5. edge cases;
6. riesgos;
7. requisitos aparentemente olvidados;
8. objeciones;
9. mejoras sugeridas;
10. preguntas concretas para mí.

Todo agrupado por dominio.

No completar silenciosamente ningún hueco.

Si algo depende de MP:

`PENDING MP VALIDATION`.

Si contradice legacy:

no elegir legacy automáticamente.

El objetivo NO es empezar a programar cuanto antes.

El objetivo es llegar a una arquitectura suficientemente clara, comprobada y documentada para dejar de rehacer Billing una y otra vez.
