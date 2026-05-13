---
title: Cómo intentar romper el sistema
description: Convertite en detective de bugs — 9 maneras de encontrar lo raro.
order: 3
role: reportar-bugs
section: Reportar bugs
---

# Cómo intentar romper el sistema

OK, esta sección es divertida. **Convertite en detective de bugs.**

Ahora que ya probaste el uso "normal" del sitio, queremos que te metas en cosas raras. Imaginá que sos un usuario distraído, apurado, malicioso, o que tiene mala conexión.

## 1. El usuario distraído

- **Apretá un botón muchas veces seguidas, rápido.** Por ejemplo, "Crear cuenta" 5 veces seguidas. ¿Crea 5 cuentas? ¿Tira error?
- **Doble clic en todo.** ¿Hace algo raro?
- **Tocá pantalla mientras está cargando algo.** ¿Se rompe la pantalla?

## 2. El usuario que tipea raro

Probá poner en cualquier campo (nombre, email, descripción, etc.):

- **Texto larguísimo.** Pegá un párrafo de Wikipedia. ¿Aguanta?
- **Solo espacios en blanco.** ¿Lo deja guardar?
- **Emojis.** "Hola 🏖️🌴🌊 que tal 😎". ¿Los muestra bien después?
- **Caracteres raros.** "Hôtel Belém — Náutica" (con acentos, guiones largos, eñes).
- **Caracteres especiales.** `<script>alert('hola')</script>`, `'; DROP TABLE users; --`. (Son cosas que un usuario malo intentaría. Queremos asegurarnos que el sitio aguanta.)
- **Vacío.** Dejá el campo vacío y mandá. ¿Te avisa que falta?

## 3. El usuario con mala conexión

- **Cortá tu WiFi mientras carga algo.** ¿El sitio te avisa que perdió conexión?
- **Volvé a conectarte.** ¿Se recupera?
- **Si tenés celular**: probá el sitio con datos móviles, en una zona con poca señal.
- **Modo avión**: activalo de golpe mientras estás en una página. Después salí del modo avión.

## 4. El usuario que va para atrás

- Apretá el botón **"Atrás"** del navegador en cualquier momento. ¿Mantiene el contexto? ¿Te perdiste lo que escribiste?
- **Refrescá la página** (F5 / pull-to-refresh) en medio de un formulario. ¿Se mantuvieron los datos?
- **Cerrá la pestaña** y volvé a abrir el sitio. ¿Seguís logueado?
- **Abrí el sitio en 2 pestañas a la vez** y hacé acciones distintas en cada una.

## 5. El usuario con la pantalla rara

- En la compu, hacé la ventana del navegador **muy chiquita** (del tamaño de una calculadora). ¿Se ve bien?
- Después hacela **muy ancha** (estiralá al máximo). ¿Se ve bien?
- En el celular, **giralo** (vertical / horizontal / vertical). ¿Se acomoda bien?
- **Ampliá el zoom del navegador** (en compu: `Ctrl +` varias veces). ¿Aguanta?

## 6. El usuario que llena de cosas

- **Marcá 200 favoritos.** ¿Aguanta? ¿Se siguen viendo bien?
- **Intentá subir más de 20 fotos a un alojamiento.** El sistema limita a 20 — anotá qué pasa al intentar la #21 (¿bloquea el botón? ¿descarta las extras? ¿da error?).
- **Mandá 30 mensajes seguidos** en una conversación.

## 7. El usuario sin permisos

- Logueate como turista, copiá una URL de admin, pegala en tu navegador. ¿Te frena? ¿Te dice "no podés"?
- Cerrá sesión y entrá a una URL que requiere login (ej. "Mi cuenta"). ¿Te lleva al login?

## 8. El usuario que clickea cosas raras

- **Encontrá todos los botones / links rotos** que puedas. Si un botón no hace nada, eso es un bug.
- **Buscá tipografías cortadas, imágenes que no cargan, iconos faltantes.**
- **Encontrá errores de ortografía.** Aunque sea uno.

## 9. Bonus: reportá una sola cosa muy bien

Si encontraste **una cosa especialmente rara**, reportala con cariño. Ese reporte vale por 10. Incluí:

- Qué estabas haciendo
- Qué pasó
- Qué esperabas que pasara
- Captura de pantalla
- Qué dispositivo (celular / compu) y qué navegador

## Próximo paso

Cuando hayas encontrado algo, mirá **[Ejemplos de buenos reportes](/beta/reportar-bugs/ejemplos/)**.
