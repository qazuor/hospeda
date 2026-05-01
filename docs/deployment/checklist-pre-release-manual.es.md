# Checklist Pre-Release Manual

> **Audiencia**: persona NO técnica que valida la app antes de cada release a producción.
> **Idioma**: castellano.
> **Cuándo correr**: justo antes de cada deploy a producción. Si toda la sección "P0" está OK, podés mergear el deploy.
> **Cuánto tarda**: aprox. 2-3 horas la primera vez. Luego con práctica baja a 1.5 hs.

## Cómo usar este checklist

Cada item tiene:

1. **Para qué**: qué estás validando.
2. **Cómo**: paso a paso, sin asumir conocimiento técnico.
3. **Qué tiene que pasar**: el resultado esperado.
4. **Si algo falla**: a quién avisar.

**Las pruebas se hacen en STAGING**, no en producción.
Staging URL principal: `https://staging.hospeda.ar`
Staging admin: `https://admin.staging.hospeda.ar`

Si vos sos la única persona haciendo el checklist y no sos técnico/a, **NO te saltees items**. Si dudás, pedí ayuda al equipo técnico antes de marcar OK.

Marcá cada item con un `[x]` cuando esté completo.

---

## Tabla de contenidos

- [Autenticación y Sesión](#autenticación-y-sesión) (4 items)
- [Pruebas en Dispositivos Móviles](#pruebas-en-dispositivos-móviles) (5 items)
- [Validación MercadoPago](#validación-mercadopago) (6 items)
- [Accesibilidad](#accesibilidad) (3 items)
- [SEO y Marketing](#seo-y-marketing) (4 items)
- [Otros](#otros) (4 items)

**Total: 26 items**.

---

## Autenticación y Sesión

### [ ] AUTH-1. Signup con verificación por email

**Para qué**: validar que se pueden crear cuentas nuevas y que llegan los mails de verificación.

**Cómo**:

1. Abrir `https://staging.hospeda.ar/auth/signup` en una ventana **incógnita**.
2. Llenar el formulario con un email tuyo personal con sufijo `+test1`. Ejemplo: si tu email es `juan@gmail.com`, usar `juan+test1@gmail.com`.
3. Inventar una contraseña fuerte (mín. 12 caracteres, números, mayúsculas, símbolos).
4. Click "Crear cuenta".
5. Abrir tu casilla de email. Esperar hasta 2 minutos.
6. Buscar un mail de "Hospeda" con asunto tipo "Verificá tu cuenta".
7. Click en el botón de verificación dentro del mail.
8. Te lleva de vuelta a Hospeda con mensaje "Cuenta verificada".

**Qué tiene que pasar**:

- El mail llega a la **bandeja de entrada** (NO a Spam — si va a Spam, **es un problema, anotá**).
- El link de verificación funciona la primera vez.
- Si hacés click otra vez al mismo link, debería decir "este link ya fue usado" o similar (NO debe verificar de nuevo).

**Si algo falla**: contactar al equipo técnico con captura del problema.

---

### [ ] AUTH-2. Signin happy path + credenciales inválidas

**Para qué**: que login funciona con credenciales correctas y rechaza incorrectas sin filtrar info.

**Cómo**:

1. Logout (si estás logueado): click avatar arriba derecha → "Cerrar sesión".
2. Ir a `https://staging.hospeda.ar/auth/signin`.
3. **Caso 1 — Login OK**: poner email + password del usuario que creaste en AUTH-1 → click "Iniciar sesión". Te lleva al dashboard.
4. Hacer logout de nuevo.
5. **Caso 2 — Password incorrecto**: mismo email pero password mal → click "Iniciar sesión". Te muestra error.
6. **Caso 3 — Email inexistente**: poner `noexiste@hospeda.ar` con cualquier password → click. Te muestra error.

**Qué tiene que pasar**:

- Caso 1: te loguea sin problema.
- Caso 2 y 3: el mensaje de error es **el mismo** ("Credenciales inválidas" o similar). NO debe decir "el email no existe" en un caso y "la contraseña es incorrecta" en el otro. Si lo hace, **es un bug de seguridad, anotá**.

**Si algo falla**: avisar al equipo técnico.

---

### [ ] AUTH-3. Recuperación de contraseña

**Para qué**: que el flujo de "olvidé mi contraseña" funciona end-to-end.

**Cómo**:

1. En `/auth/signin` click "Olvidé mi contraseña".
2. Ingresar el email del usuario AUTH-1 → click "Enviar".
3. Esperar el mail (hasta 2 minutos).
4. Click el link del mail → te lleva a una página de "Nueva contraseña".
5. Poner una contraseña distinta a la original. Confirmar.
6. Te dice "Contraseña actualizada".
7. Logout (si estás logueado).
8. Login con la **nueva** password → debe funcionar.
9. Logout de nuevo.
10. Login con la **vieja** password → NO debe funcionar.

**Qué tiene que pasar**:

- El mail llega.
- El link funciona una sola vez. Si lo abrís de nuevo después, dice "expiró" o similar.
- La contraseña vieja deja de servir inmediatamente.

---

### [ ] AUTH-4. Logout y limpieza de sesión

**Para qué**: que cerrar sesión limpia todo y no queda backdoor.

**Cómo**:

1. Login con el usuario AUTH-1.
2. Click avatar → "Cerrar sesión".
3. Te lleva a la home como anónimo.
4. Apretar la flecha "atrás" del navegador. **NO debería volver al área autenticada** — debería seguir mostrando home pública o pedir login.
5. Abrir nueva pestaña → ir a `https://staging.hospeda.ar/mi-cuenta`. Te debería redirigir a `/auth/signin`.

**Qué tiene que pasar**: ningún recurso autenticado accesible después del logout. Si "atrás" te muestra contenido del usuario, es un bug.

---

## Pruebas en Dispositivos Móviles

> **Importante**: estos items requieren dispositivos físicos o emuladores. Si no tenés un iPhone a mano, pedile a alguien del equipo que lo haga, o usá BrowserStack si tenés acceso.

### [ ] MOB-1. iOS Safari en iPhone — formulario de publicar + foto desde cámara

**Para qué**: que el flujo crítico de publicar funciona en el navegador más popular del mercado argentino.

**Dispositivo**: iPhone real (cualquier modelo iOS 16+) con Safari.

**Cómo**:

1. En el iPhone, abrir Safari → `https://staging.hospeda.ar`.
2. Login (usar el mismo de AUTH-1 o crear uno nuevo).
3. Tap "Publicar mi alojamiento".
4. Llenar el formulario inicial (nombre, descripción corta, tipo, ciudad).
5. Click "Continuar" → llegás al editor de la propiedad.
6. En la sección de fotos, tap "Subir foto" → elegir "Tomar foto".
7. iOS abre la cámara → sacá una foto cualquiera.
8. La foto debería aparecer subida con preview.
9. Llenar precio y capacidad → tap "Publicar".

**Qué tiene que pasar**:

- El formulario se ve sin overflow horizontal (no hay scroll lateral indeseado).
- Los campos no se tapan con el teclado virtual.
- La foto se sube en menos de 30 segundos en wifi.
- Hay feedback visual de "subiendo..." mientras se procesa.

**Anotá**: cualquier campo que sea difícil de tapear, cualquier botón que el teclado tape.

---

### [ ] MOB-2. iOS Safari en iPad — navegación general

**Para qué**: que la app funciona en tablet (resolución intermedia que rompe muchos diseños).

**Dispositivo**: iPad (cualquier modelo, iOS 16+).

**Cómo**:

1. Safari → `https://staging.hospeda.ar`.
2. Probar en **vertical** y **horizontal**.
3. Navegar: home → buscar destino → resultado → click una propiedad → detalle.
4. Toggle el favorito (corazón) en una propiedad.
5. Ir al perfil "Mi cuenta" → editar profile.

**Qué tiene que pasar**:

- Layout se adapta correctamente al rotar (no se descuadra).
- Imágenes y mapas se ven nítidos (no pixeleados).
- Menús no se cortan por la pantalla.

---

### [ ] MOB-3. Android Chrome — formularios + upload

**Para qué**: idem MOB-1 pero en el otro 50% del mercado.

**Dispositivo**: cualquier Android 12+ con Chrome.

**Cómo**: mismo procedimiento que MOB-1 pero en Android Chrome.

**Qué tiene que pasar**: lo mismo. Anotá cualquier diferencia visual entre iOS y Android.

---

### [ ] MOB-4. Responsive nav y CTAs en móvil

**Para qué**: que los menús "hamburguesa" y los botones principales son tappeables.

**Dispositivo**: cualquier móvil (iOS o Android).

**Cómo**:

1. Abrir staging en móvil.
2. Tap el menú hamburguesa (3 rayas arriba derecha).
3. Probar cada link del menú: Home, Buscar, Mis Propiedades, Mi Cuenta, Cerrar Sesión.
4. Cerrar el menú y tap el botón principal "Buscar" o "Publicar" (CTA).

**Qué tiene que pasar**:

- Los items del menú son grandes (mínimo el ancho del dedo).
- Tap en CTA no requiere apuntar con precisión.
- No hay items "casi escondidos" abajo.

---

### [ ] MOB-5. Performance percibido en 4G

**Para qué**: validar que la app no es insoportablemente lenta en redes argentinas reales.

**Cómo**:

1. En tu móvil, **DESACTIVAR wifi**, dejar solo datos móviles 4G/3G.
2. Abrir `https://staging.hospeda.ar` en una pestaña nueva.
3. Cronometrar: ¿en cuántos segundos podés interactuar con la página? (ver el primer botón usable).

**Qué tiene que pasar**:

- En 4G estable: < 4 segundos.
- En 4G débil (movido por la calle): < 8 segundos.
- En 3G: < 15 segundos.

Si pasa de 20 segundos, **es un bug, anotá**.

---

## Validación MercadoPago

> **CRÍTICO**: estos items son los que más cuesta replicar después si fallan en prod.
> Para todos: usar tarjeta de prueba **`4509 9535 6623 3704`**, CVV **`123`**, vence **`11/30`**.

### [ ] MP-1. Checkout completo con webhook real (ngrok)

Este es el item más importante. Está documentado paso a paso en `docs/deployment/first-time-setup.md` § 1.7.c "Validación Manual del Webhook MP en Staging". **Seguir esos pasos al pie de la letra**.

**Qué tiene que pasar al final**:

- El pago completa.
- El webhook llega a tu API local vía ngrok (lo ves en ngrok).
- La subscription se marca como `active` en la DB.
- El usuario tiene acceso a las features pagas en staging.

---

### [ ] MP-2. Refund flow

**Para qué**: que el reembolso funciona y deja la subscription en el estado correcto.

**Cómo**:

1. Tener un usuario con subscription `active` (resultado de MP-1).
2. En el panel admin de staging (`https://admin.staging.hospeda.ar`), ir a Billing → Subscriptions → encontrar la del usuario.
3. Click "Refund" o "Reembolsar".
4. Confirmar.
5. Verificar:
   - La subscription queda `refunded` o `canceled`.
   - El usuario pierde acceso a las features pagas.
   - En el panel MP (developers.mercadopago.com.ar), el payment original muestra estado `refunded`.

---

### [ ] MP-3. Cancellation + grace period

**Para qué**: que cuando un user cancela, mantiene acceso hasta el final del período pagado.

**Cómo**:

1. Tener un usuario con subscription `active` (vencimiento al menos 7 días en el futuro).
2. Logueado como ese user en `https://staging.hospeda.ar`, ir a "Mi cuenta" → Billing → "Cancelar suscripción".
3. Confirmar cancelación.
4. Verificar:
   - La subscription queda `canceled`.
   - El user **sigue teniendo acceso** a features pagas hasta `current_period_end`.
   - Aparece banner "Tu suscripción se cancela el [fecha]".
5. (Opcional, pero recomendado) Pedir al equipo técnico que fuerce `current_period_end` al pasado vía DB.
6. Verificar que **ahora sí** el user pierde acceso pago.

---

### [ ] MP-4. Renovación automática

**Para qué**: que MP cobra el siguiente período sin intervención manual.

**Cómo**: este item es difícil de validar sin esperar 30 días reales. Para staging:

1. Pedir al equipo técnico que setee `current_period_end` a 1 hora en el futuro vía DB (sobre un user con subscription `active`).
2. Esperar 1 hora + 5 minutos.
3. Verificar que MP cobró automáticamente:
   - En el panel MP, hay un nuevo `payment` con monto del plan.
   - En la DB, `current_period_end` se extendió 30 días más.
   - El usuario sigue teniendo acceso.

Si MP no cobra dentro de los siguientes 60 minutos, hay un bug.

---

### [ ] MP-5. Addon purchase

**Para qué**: que comprar addons (ej: "fotos extra") se activa al instante.

**Cómo**:

1. Logueado como host con subscription `active`.
2. Ir a "Mi cuenta" → Addons.
3. Comprar el addon "Fotos extra" (o el que esté configurado).
4. Completar checkout MP con tarjeta de prueba.
5. Verificar:
   - El addon aparece como `active` en la cuenta del user.
   - El user puede subir más fotos (o lo que el addon habilite) inmediatamente.

---

### [ ] MP-6. Failed payment handling

**Para qué**: que cuando una tarjeta es rechazada, la subscription NO queda activa.

**Cómo**:

1. Logueado como host sin subscription paga (trial o expired).
2. Ir a Billing → Plans → Upgrade.
3. Llegar al checkout MP.
4. Usar la tarjeta **rechazada** de prueba: `4013 5406 8274 6260`, CVV `123`, vence `11/30`.
5. Completar.
6. MP te muestra "Pago rechazado".

**Qué tiene que pasar**:

- NO se crea ninguna subscription `active` en la DB.
- El usuario sigue en su estado anterior (trial / expired).
- Mensaje claro al usuario en la UI.

---

## Accesibilidad

### [ ] A11Y-1. Navegación 100% con teclado

**Para qué**: que la app es usable sin mouse (gente con discapacidad motriz, power users).

**Cómo**:

1. Abrir `https://staging.hospeda.ar` en desktop.
2. **Soltar el mouse**. Solo teclado.
3. Tab para avanzar entre elementos. Shift+Tab para retroceder. Enter para activar.
4. Probar:
   - Llegar al menú de navegación con Tab.
   - Abrir el menú móvil con Enter (en una ventana angosta).
   - Llegar al campo de búsqueda.
   - Escribir, Tab al botón "Buscar", Enter.
   - En resultados, llegar a un card con Tab y entrar con Enter.

**Qué tiene que pasar**:

- En CADA elemento que recibe foco, hay un anillo visible (azul, verde, lo que sea — pero **se ve**).
- El orden de Tab tiene sentido (no salta de arriba abajo random).
- No hay "trampas" donde Tab te deja encerrado.

**Si algo falla**: anotar qué elemento no recibe foco visible.

---

### [ ] A11Y-2. Lectura con screen reader (VoiceOver / NVDA básico)

**Para qué**: que la app es usable para personas ciegas.

**Cómo (Mac, VoiceOver)**:

1. Activar VoiceOver: `Cmd+F5`.
2. Abrir staging.
3. Escuchar cómo la app se "narra" a sí misma.
4. Navegar con `VO+Right Arrow` (VO = Ctrl+Option).

**Cómo (Windows, NVDA)**:

1. Descargar e instalar NVDA gratis: `https://www.nvaccess.org/download/`.
2. Abrir staging.
3. NVDA narra automáticamente. Usar flechas para moverse.

**Qué tiene que pasar**:

- Cada botón se anuncia por su función (no solo "botón").
- Cada imagen importante tiene texto alternativo (alt text).
- Los formularios anuncian las labels antes de los inputs.

**Si algo falla**: anotar qué se anuncia raro o no se anuncia.

---

### [ ] A11Y-3. Contraste y zoom 200%

**Para qué**: usable por gente con vista reducida.

**Cómo**:

1. Abrir staging en desktop.
2. **Zoom 200%**: `Cmd/Ctrl + +` cuatro veces.
3. Verificar que la página sigue funcional: no hay overflows, no se cortan textos, todos los botones siguen siendo clickeables.
4. **Contraste**: usar la herramienta gratis WebAIM Color Contrast Checker (<https://webaim.org/resources/contrastchecker/>) en al menos 3 colores de la app:
    - Texto del cuerpo sobre el fondo principal.
    - Color del botón primario sobre su fondo.
    - Color de un link sobre el fondo donde aparece.

**Qué tiene que pasar**:

- Zoom 200% no rompe el layout.
- Contraste de cada par de colores **al menos 4.5:1** para texto normal, **3:1** para texto grande (>18px).

---

## SEO y Marketing

### [ ] SEO-1. Verificar meta tags con metatags.io

**Para qué**: que cuando alguien comparte una URL de Hospeda en redes, el preview se ve bien.

**Cómo**:

1. Ir a `https://metatags.io/`.
2. En el campo URL pegar `https://staging.hospeda.ar/`.
3. Click "Test".
4. Verificar la pestaña Google: muestra título y descripción.
5. Verificar la pestaña Facebook: muestra preview con imagen.
6. Verificar Twitter: muestra card con imagen.
7. Repetir para `https://staging.hospeda.ar/alojamientos/{algun-slug-real}`.

**Qué tiene que pasar**: TODAS las pestañas (Google, Facebook, Twitter, LinkedIn) muestran preview con título, descripción e imagen. Si una sale "vacía" o con texto genérico, anotá la URL.

---

### [ ] SEO-2. Validar JSON-LD con schema.org validator

**Para qué**: que los datos estructurados que enviamos a Google son válidos.

**Cómo**:

1. Ir a `https://validator.schema.org/`.
2. En "Fetch URL" pegar `https://staging.hospeda.ar/`.
3. Click "Run test".
4. Repetir con `https://staging.hospeda.ar/alojamientos/{algun-slug-real}`.

**Qué tiene que pasar**:

- Resultado dice "0 ERRORS".
- Tipos esperados: `WebSite`, `Organization` en home; `Accommodation` o `Product` en detalle.
- Warnings son aceptables (anotalos pero no son blocker).

---

### [ ] SEO-3. Probar share en WhatsApp / Twitter / Facebook

**Para qué**: que el preview real (no el simulador) se ve bien en cada red.

**Cómo**:

1. Copiar la URL `https://staging.hospeda.ar/alojamientos/{algun-slug-real}`.
2. **WhatsApp**: pegarla en un chat propio (mensaje a vos mismo). Esperar 5 segundos.
3. **Twitter/X**: nuevo tweet, pegar URL. Antes de enviar, esperar el preview.
4. **Facebook**: pegar URL en el composer de un post. Esperar preview.

**Qué tiene que pasar**: cada plataforma muestra título + descripción + imagen. Si el preview tarda > 30s o no carga, anotá.

---

### [ ] SEO-4. Sitemap accesible y submitted en Google Search Console

**Para qué**: que Google sabe qué URLs indexar.

**Cómo**:

1. Abrir `https://staging.hospeda.ar/sitemap.xml` en el navegador.
2. Verificar que carga sin error y es XML legible.
3. Abrir `https://staging.hospeda.ar/robots.txt`.
4. Verificar que tiene una línea `Sitemap: https://staging.hospeda.ar/sitemap.xml`.
5. (Solo en producción, no staging) Loguearse en Google Search Console → Sitemaps → verificar que `sitemap.xml` está submitted y muestra "Success".

**Qué tiene que pasar**: ambas URLs cargan, robots.txt referencia el sitemap.

---

## Otros

### [ ] OTH-1. Emails transaccionales en bandeja real (NO en spam)

**Para qué**: que nuestros emails no caen en spam.

**Cómo**:

1. Crear una cuenta nueva en staging usando un email **gmail.com** real tuyo.
2. Hacer una segunda cuenta con un email **outlook.com / hotmail.com** real.
3. Para cada cuenta, recibir el mail de verificación.
4. Verificar que el mail aparece en **bandeja de entrada principal**, NO en Promociones, Notificaciones, Social, ni Spam.

**Qué tiene que pasar**: bandeja de entrada principal, ambos proveedores. Si va a Spam o Promociones, **es problema de DNS/SPF/DKIM, anotá urgente**.

---

### [ ] OTH-2. Formulario de contacto público

**Para qué**: que el form "Contactanos" funciona end-to-end.

**Cómo**:

1. Sin login (incógnito), ir a `https://staging.hospeda.ar/contacto`.
2. Llenar nombre, email, mensaje (cualquier texto razonable).
3. Submit.

**Qué tiene que pasar**:

- Mensaje "Tu mensaje fue recibido" o similar.
- El equipo recibe el mensaje en la casilla configurada (preguntar al técnico).
- El user recibe un mail de confirmación.

---

### [ ] OTH-3. Cookie consent banner

**Para qué**: cumplir GDPR/legal y que el banner funciona.

**Cómo**:

1. Abrir staging en una **ventana incógnita** (que no tenga cookies previas).
2. Verificar que aparece un banner abajo o en un costado: "Usamos cookies...".
3. Click "Aceptar".
4. Refrescar la página (`F5`). El banner NO debería volver a aparecer.
5. Cerrar la ventana incógnita y abrir otra incógnita.
6. El banner SÍ debería aparecer de nuevo (porque es ventana nueva, sin cookie).

**Qué tiene que pasar**: el comportamiento descripto. Si aparece tras "Aceptar", la cookie no se guardó.

---

### [ ] OTH-4. Modo oscuro / claro funciona

**Para qué**: que el toggle de tema responde y se persiste.

**Cómo**:

1. En staging desktop, encontrar el toggle de tema (usualmente en el header, ícono sol/luna).
2. Click → la página cambia a oscuro (o claro, lo opuesto a lo que estaba).
3. Refrescar la página.
4. El tema elegido **se mantiene**.
5. Probar lo mismo en móvil.

**Qué tiene que pasar**:

- El cambio es inmediato (no hay flash blanco antes de aplicar el oscuro).
- Persiste después de refresh.
- Todos los elementos (texto, fondos, bordes, imágenes) cambian coherentemente — no quedan partes "viejas".

---

## Cierre

Una vez **todos los items P0 estén OK** ([x] todos en las 6 secciones), tenés luz verde para deploy a producción.

Si **alguno P0 falla**:

1. Anotar el item exacto y qué pasó.
2. Avisar al equipo técnico antes de mergear.
3. Decidir entre: arreglar y re-validar, o aceptar el bug como conocido y deployar igual (con autorización del PM).

---

## Cross-references

- [`first-time-setup.md` § 1.7.c — Validación Manual del Webhook MP](./first-time-setup.md#17c-validación-manual-del-webhook-mp-en-staging-spec-092)
- [`first-time-setup.md` § 1.7.b — Cuentas de Prueba MP](./first-time-setup.md#17b-cuentas-de-prueba-para-suite-e2e-spec-092)
- [`first-time-setup.md` § 1.5.b — Folder E2E Cloudinary](./first-time-setup.md#15b-folder-e2e-en-cloudinary-spec-092)
- [`checklist.md`](./checklist.md) — Checklist técnico de deploy general
- [`billing-checklist.md`](./billing-checklist.md) — Checklist técnico de billing
