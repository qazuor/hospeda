# Guía de Instalación - Claude Code en Ubuntu

## 📋 Pre-requisitos

### 1. Instalar Dependencias Necesarias

```bash

# jq - REQUERIDO (para procesar JSON en los hooks)

sudo apt update
sudo apt install jq

# libnotify-bin - REQUERIDO (para notificaciones de escritorio)

sudo apt install libnotify-bin

# beep - OPCIONAL (para sonido de sistema)

sudo apt install beep
```text

### 2. Verificar Instalación

Ejecuta el script de verificación:

```bash
chmod +x check-dependencies.sh
./check-dependencies.sh
```text

Deberías ver:

```bash
✅ jq está instalado: jq-1.6
✅ notify-send está instalado
✅ bash está instalado: GNU bash, version 5.x
```text

## 🚀 Instalación de Claude Code Config

### Paso 1: Crear Estructura de Directorios

```bash

# Navega a la raíz de tu proyecto

cd /ruta/a/tu/proyecto

# Crea la estructura .claude

mkdir -p .claude/hooks
mkdir -p .claude/commands
mkdir -p .claude/sessions
```text

### Paso 2: Copiar Archivos de Configuración

```bash

# Copiar CLAUDE.md a la raíz

cp CLAUDE.md ./

# Copiar settings.json

cp settings.json .claude/settings.local.json

# Copiar el hook para Ubuntu

cp on-notification-ubuntu.sh .claude/hooks/on-notification.sh

# Hacer ejecutable el hook

chmod +x .claude/hooks/on-notification.sh
```text

### Paso 3: Verificar Estructura

```bash
tree .claude
```text

Deberías ver:

```bash
.claude/
├── hooks/
│   └── on-notification.sh
├── commands/
│   └── (tus comandos aquí)
├── sessions/
│   └── (se creará automáticamente)
└── settings.local.json
```text

### Paso 4: Probar el Hook

```bash

# Prueba manual del hook

echo '{"message":"Hola desde Claude Code"}' | .claude/hooks/on-notification.sh
```text

Deberías:

1. Escuchar un beep
2. Ver una notificación de escritorio
3. Ver el mensaje en `.claude/notifications.log`

## 🔧 Configuración del Hook

El archivo `.claude/hooks/on-notification.sh` hace lo siguiente:

### 1. **Beep Básico** (sin instalar nada)

```bash
echo -ne '\007'

```bash

Funciona en cualquier terminal de Ubuntu.

### 2. **Notificación Visual** (requiere libnotify-bin)

```bash
notify-send "Claude Code" "$message" --icon=dialog-information --urgency=normal
```text

Opciones de urgencia:

- `--urgency=low` - Notificación discreta
- `--urgency=normal` - Notificación normal (default)
- `--urgency=critical` - Notificación importante (permanece más tiempo)

### 3. **Sonido del Sistema** (opcional - requiere beep)

Si instalaste `beep`, descomenta estas líneas en el hook:

```bash
if command -v beep &> /dev/null; then
    beep -f 800 -l 200
fi
```text

Parámetros de beep:

- `-f 800` - Frecuencia en Hz (800 = agudo)
- `-l 200` - Duración en milisegundos

## 🎨 Personalizar Notificaciones

### Cambiar el Icono

Iconos disponibles en Ubuntu:

```bash
notify-send "Título" "Mensaje" --icon=dialog-information  # Info
notify-send "Título" "Mensaje" --icon=dialog-warning      # Advertencia
notify-send "Título" "Mensaje" --icon=dialog-error        # Error
notify-send "Título" "Mensaje" --icon=emblem-success      # Éxito
```text

### Agregar Tiempo de Visualización

```bash
notify-send "Claude Code" "$message" --expire-time=5000  # 5 segundos
```text

### Agregar Acciones (Botones)

```bash
notify-send "Claude Code" "$message" \
    --action="ok=Ver Detalles" \
    --action="dismiss=Cerrar"
```text

## 🔊 Alternativas de Sonido

### Opción 1: Usar `paplay` (sin instalar nada adicional)

```bash

# Agregar al hook

paplay /usr/share/sounds/freedesktop/stereo/complete.oga

```bash

### Opción 2: Usar `aplay` con WAV

```bash

# Crear un sonido simple

aplay /usr/share/sounds/alsa/Front_Center.wav
```text

### Opción 3: Usar `spd-say` (Text-to-Speech)

```bash

# Instalar

sudo apt install speech-dispatcher

# Usar en el hook

spd-say "$message"

```bash

## 🐛 Solución de Problemas

### Problema: El hook no se ejecuta

**Solución 1**: Verificar permisos

```bash

ls -l .claude/hooks/on-notification.sh

# Debe mostrar: -rwxr-xr-x

# Si no, hacer ejecutable:

chmod +x .claude/hooks/on-notification.sh

```bash

**Solución 2**: Verificar que jq está instalado

```bash

which jq

# Debe mostrar: /usr/bin/jq

```text

**Solución 3**: Probar el hook manualmente

```bash
echo '{"message":"Test"}' | .claude/hooks/on-notification.sh
```text

### Problema: No aparecen notificaciones visuales

**Verificar notify-send**:

```bash
notify-send "Test" "Esto es una prueba"
```text

**Si no funciona, reinstalar**:

```bash
sudo apt install --reinstall libnotify-bin
```text

### Problema: No se escucha el beep

**Opción 1**: Verificar volumen del sistema

**Opción 2**: Usar sonido alternativo

```bash

# Reemplazar echo -ne '\007' con:

paplay /usr/share/sounds/freedesktop/stereo/bell.oga
```text

### Problema: Permisos denegados en beep

`beep` requiere permisos especiales. Alternativas:

```bash

# Usar paplay en su lugar

paplay /usr/share/sounds/freedesktop/stereo/complete.oga
```text

### Problema: El log no se crea

**Verificar permisos del directorio**:

```bash
ls -ld .claude

# Debe permitir escritura

# Si no, corregir:

chmod 755 .claude
```text

## 📝 Ver el Log de Notificaciones

```bash

# Ver todas las notificaciones

cat .claude/notifications.log

# Ver en tiempo real

tail -f .claude/notifications.log

# Ver las últimas 10

tail -n 10 .claude/notifications.log

# Buscar notificaciones específicas

grep "ERROR" .claude/notifications.log
```text

## 🎯 Ejemplo de Hook Personalizado

Si quieres un hook más elaborado para Ubuntu:

```bash
#!/usr/bin/env bash
set -euo pipefail

payload="$(cat)"
message=$(echo "$payload" | jq -r '.message')

# Log

mkdir -p .claude
timestamp=$(date '+%Y-%m-%d %H:%M:%S')
echo "[$timestamp] $message" >> .claude/notifications.log

# Beep

echo -ne '\007'

# Notificación visual con más opciones

if command -v notify-send &> /dev/null; then
    # Determinar urgencia según el mensaje
    urgency="normal"
    icon="dialog-information"

    if [[ "$message" == *"ERROR"* ]] || [[ "$message" == *"FAIL"* ]]; then
        urgency="critical"
        icon="dialog-error"
    elif [[ "$message" == *"SUCCESS"* ]] || [[ "$message" == *"COMPLETE"* ]]; then
        icon="emblem-success"
    elif [[ "$message" == *"WARNING"* ]]; then
        urgency="normal"
        icon="dialog-warning"
    fi

    notify-send "Claude Code" "$message" \
        --icon="$icon" \
        --urgency="$urgency" \
        --expire-time=5000
fi

# Sonido según el tipo de mensaje

if [[ "$message" == *"ERROR"* ]]; then
    paplay /usr/share/sounds/freedesktop/stereo/dialog-error.oga 2>/dev/null || true
elif [[ "$message" == *"SUCCESS"* ]]; then
    paplay /usr/share/sounds/freedesktop/stereo/complete.oga 2>/dev/null || true
else
    paplay /usr/share/sounds/freedesktop/stereo/message.oga 2>/dev/null || true
fi
```text

## ✅ Checklist Final

- [ ] `jq` instalado
- [ ] `libnotify-bin` instalado
- [ ] Estructura `.claude/` creada
- [ ] `CLAUDE.md` en la raíz del proyecto
- [ ] `settings.local.json` copiado a `.claude/`
- [ ] `on-notification.sh` copiado y ejecutable
- [ ] Hook probado manualmente
- [ ] Notificaciones funcionando

## 🚀 ¡Listo para Usar

Ahora cuando Claude Code ejecute tareas, deberías:

1. ✅ Escuchar beeps cuando termine tareas
2. ✅ Ver notificaciones de escritorio
3. ✅ Tener un log de todas las notificaciones

## 📚 Recursos Adicionales

- [Documentación de notify-send](https://manpages.ubuntu.com/manpages/focal/man1/notify-send.1.html)
- [Documentación de jq](https://stedolan.github.io/jq/manual/)
- [Sonidos del sistema en Ubuntu](https://wiki.ubuntu.com/Sound)

