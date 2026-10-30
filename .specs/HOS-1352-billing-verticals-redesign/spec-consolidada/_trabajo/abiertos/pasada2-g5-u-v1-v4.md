# Abiertos de la pasada 2 · g5 (U1, U2, U3, V1, V2, V3, V4)

Fuentes en `17f9702675`. Sin letra: la asigna el orquestador.

## Lo que BS y BT resolvieron de la primera pasada

De los doce abiertos de `g5-u-v1-v4.md`, estos quedan resueltos por las letras del owner. La spec
ya dice que los propone el PR de la pieza dueña (BS) o que se miden antes del merge (BT):

| abierto de la pasada 1 | resuelto por | dónde quedó escrito |
|---|---|---|
| 1. etiquetas `kind-*`/`area-*` | BS (labels de Linear) | *«Labels de Linear»* de `U1`, `U2` y `U3` |
| 2. nombre de la tabla del outbox y nombre neutro de la bitácora | BS (nombre de una tabla auxiliar) | `U2`, *«Modelo de datos»*; `U1`, *«Variables de entorno»* |
| 3. vencimiento de `processing` y frecuencia del envío | BS (cadencias) | `U2`, *«Cron y outbox»* |
| 4. destino de las filas vivas del rol de dueño de comercio | BT (la medición) | `U1`: FILA, AC:U1:3, TEST:U1:24 y *«Abiertos»*. Si la medición no da cero, vuelve al owner con el número |
| 5. lista nominal de las diez variables | BS (listas que viven en el código) | `U1`, *«Variables de entorno»* |
| 6. cuáles son las tres tablas de `is_featured` | BS (listas que viven en el código) | `U1`, *«Variables de entorno»* |
| 7. credenciales del script del corte (sólo esa mitad) | BS (credenciales) | `U3`, *«Variables de entorno»* |
| 10. rutas, permisos y `error.code` de las acciones 18 y 11 | BS | `V2` y `V4`, *«API»* |

Siguen abiertos, sin cambios: el 7 en su mitad del monto del pago chico del 4b (es un cobro real,
no un detalle de implementación), el 8 (qué pieza arma con `db:migrate` las bases de desarrollo),
el 9 (dónde vive el script que genera el SQL), el 11 (dónde vive el caché y cómo se observa una
entrada sospechosa: cambia el comportamiento con varias instancias, así que BS no lo alcanza) y
el 12 (los mínimos de tipos de test derivados del texto).

## 1. Qué pieza emite las dos superficies de la suspensión de `V/15` §6.3

- **Qué falta**: la pieza que construye las dos obligaciones de `V/15` §6.3. La primera es el
  aviso de suspensión que nombra lo que se pierde como turista. La segunda es la advertencia en la
  pantalla de compra de VIP de un suspendido, que dice que al regularizar se le cancela.
- **Afecta**: `V3`, donde la pasada 2 escribió la sección (marcada *inferido* como superficie
  ajena), y por extensión `B3`, dueña de `DEC-ENT-003`, y las piezas de superficie (`V8a`, `B13a`).
- **Por qué no lo deciden**: `V/descomposicion.md:63` le da a `V3` el `15` §1–3. La regla del
  orquestador puso el §6 en `V3`. La fila de `V3` sólo dice que la resolución de la herencia es suya
  (`V/15` §6.2: *«Lo resuelve `V3`»*). Ninguna fila de pieza nombra el aviso ni la advertencia.
- **Pregunta**: ¿quién construye las dos superficies?
  1. **(recomendada)** El aviso de suspensión, la pieza que encola los avisos del grace y la
     suspensión en billing. La advertencia de compra de VIP, `B13a`, espejo de la pantalla de compra.
     Costo: dos líneas en sus filas. Riesgo: bajo.
  2. `V3`. Costo: igual. Riesgo: `V3` no tiene superficies ni encola correos.
- **Ejemplo**: si el plan de Juan heredara Turista VIP y Juan cayera en `SUSPENDED`, el aviso le dice
  que también pierde VIP como turista. Si compra VIP estando suspendido, la pantalla le avisa que se
  cancela al regularizar.
