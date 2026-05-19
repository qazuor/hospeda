---
title: Cómo intentar romper el sistema
description: Convertite en detective de bugs — 9 maneras de encontrar lo raro.
order: 3
role: reportar-bugs
section: Reportar bugs
---

# Cómo intentar romper el sistema

Sección divertida. **Convertite en detective de bugs.**

Ya probaste el uso normal. Ahora metete en cosas raras: sé un usuario distraído, apurado, malicioso o con mala conexión.

## 1. El usuario distraído

- **Apretá un botón muchas veces rápido** ("Crear cuenta" 5 veces). ¿Crea 5 cuentas? ¿Da error?
- **Doble clic en todo.** ¿Hace algo raro?
- **Tocá la pantalla mientras está cargando.** ¿Se rompe?

## 2. El usuario que tipea raro

En cualquier campo:

- **Texto larguísimo** (pegá un párrafo de Wikipedia). ¿Aguanta?
- **Solo espacios en blanco.** ¿Deja guardar?
- **Emojis**: "Hola 🏖️🌴🌊 que tal 😎". ¿Los muestra bien?
- **Caracteres raros**: "Hôtel Belém — Náutica".
- **Caracteres especiales**: `<script>alert('hola')</script>`, `'; DROP TABLE users; --`. (Lo que un malicioso intentaría.)
- **Vacío.** Mandá sin completar. ¿Te avisa que falta?

## 3. El usuario con mala conexión

- **Cortá tu WiFi mientras carga algo.** ¿El sitio te avisa?
- **Volvé a conectarte.** ¿Se recupera?
- **Celular con datos móviles** en zona con poca señal.
- **Modo avión** de golpe en medio de una página, después salí.

## 4. El usuario que va para atrás

- **Botón "Atrás"** del navegador en cualquier momento. ¿Mantiene contexto?
- **Refrescá** (F5) en medio de un formulario. ¿Se mantuvieron los datos?
- **Cerrá la pestaña** y volvé a abrir. ¿Seguís logueado?
- **Abrí el sitio en 2 pestañas** y hacé acciones distintas en cada una.

## 5. El usuario con la pantalla rara

- En compu, ventana **muy chiquita** (tamaño calculadora). ¿Se ve bien?
- Después **muy ancha** (estirá al máximo). ¿Se ve bien?
- En celular, **giralo** vertical/horizontal varias veces.
- **Ampliá el zoom** (`Ctrl +` varias veces). ¿Aguanta?

## 6. El usuario que llena de cosas

- **Marcá 200 favoritos.** ¿Aguanta?
- **Subí más de 20 fotos a un alojamiento.** El límite es 20 — anotá qué pasa con la #21.
- **Mandá 30 mensajes seguidos** en una conversación.

## 7. El usuario sin permisos

- Logueate como turista, pegá una dirección web (URL) de admin en el navegador. ¿Te frena? ¿Te dice "no podés"?
- Cerrá sesión y entrá a "Mi cuenta". ¿Te redirige a iniciar sesión?

## 8. El usuario que clickea cosas raras

- **Encontrá botones / enlaces rotos** (un botón que no hace nada es error (bug)).
- **Tipografías cortadas, imágenes que no cargan, íconos faltantes.**
- **Errores de ortografía.** Aunque sea uno.

## 9. Bonus: reportá una sola cosa muy bien

Si encontraste algo especialmente raro, reportalo con cariño. Ese reporte vale por 10. Incluí: qué hacías, qué pasó, qué esperabas, captura, dispositivo y navegador.

## Próximo paso

Mirá **[Ejemplos de buenos reportes](/beta/reportar-bugs/ejemplos/)**.
