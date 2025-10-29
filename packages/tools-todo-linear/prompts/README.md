# 📝 Custom AI Prompts

Esta carpeta contiene los prompts personalizables para cada proveedor de IA del sistema de análisis de comentarios TODO.

## 🎯 Cómo Personalizar Prompts

### 1. Copiar Template Base

```bash
# Ejemplo para OpenAI
cp openai.example.md openai.md
```

### 2. Editar Variables

Los prompts soportan las siguientes variables que se reemplazan automáticamente:

- `{{$languageInstructions}}` - Instrucciones de idioma (español, inglés, etc.)
- `{{$filePath}}` - Ruta del archivo que contiene el TODO
- `{{$lineNumber}}` - Número de línea del comentario
- `{{$comment}}` - Texto del comentario TODO/HACK/DEBUG
- `{{$beforeContext}}` - Líneas de código antes del comentario
- `{{$afterContext}}` - Líneas de código después del comentario
- `{{$fileType}}` - Tipo de archivo (.ts, .js, .py, etc.)
- `{{$packageName}}` - Nombre del paquete/módulo
- `{{$imports}}` - Imports disponibles en el archivo

### 3. Sistema de Fallback

- **Prompt personalizado**: `{provider}.md` (ej: `openai.md`)
- **Prompt ejemplo**: `{provider}.example.md` (ej: `openai.example.md`)

El sistema busca primero el archivo personalizado, si no existe usa el de ejemplo.

## 📋 Prompts Disponibles

### OpenAI (`openai.example.md`)

- Diseñado para GPT-3.5/GPT-4
- Enfoque en análisis detallado y estructurado
- Formato JSON específico

### Anthropic (`anthropic.example.md`)  

- Optimizado para Claude
- Énfasis en comprensión de contexto empresarial
- Guías específicas para implementación

### Google Gemini (`gemini.example.md`)

- Compatible con Gemini 1.5 Flash
- Criterios de análisis técnico
- Evaluación de complejidad y dependencias

### DeepSeek (`deepseek.example.md`)

- Proveedor **GRATUITO** con límites generosos
- Enfoque en soluciones prácticas e implementables  
- Consideraciones de rendimiento y escalabilidad

### Groq (`groq.example.md`)

- Proveedor **GRATUITO** ultra-rápido
- Balance entre excelencia técnica y restricciones de entrega
- Análisis de valor empresarial y urgencia técnica

## ✏️ Ejemplos de Personalización

### Cambiar Formato de Respuesta

```markdown
# En tu prompt personalizado
Responde con este formato específico:
{
  "prioridad": "{{$priority}}",
  "descripcion": "{{$description}}",
  "miCampoPersonalizado": "valor específico"
}
```

### Personalizar por Proyecto

```markdown
# Para proyectos de e-commerce
Considera siempre el impacto en:
- Experiencia del usuario final
- Rendimiento de checkout
- Seguridad de pagos
- SEO y conversión
```

### Ajustar Idioma Específico

```markdown
# Override automático de idioma
{{$languageInstructions}}

IMPORTANTE: Además del idioma, usa terminología específica de {{$packageName}}.
```

## 🔧 Variables de Contexto Avanzadas

### Ejemplo de Uso Completo

```markdown
# Análisis TODO: {{$comment}}

**Ubicación:** {{$filePath}}:{{$lineNumber}}
**Contexto:**
```{{$fileType}}
{{$beforeContext}}
// --> {{$comment}} <--
{{$afterContext}}
```

**Metadatos:**

- Paquete: {{$packageName}}
- Dependencias: {{$imports}}

```

## 🚨 Mejores Prácticas

### ✅ Hacer
- Usar todas las variables disponibles para contexto completo
- Mantener coherencia en el formato JSON de respuesta
- Incluir ejemplos específicos en el prompt
- Considerar el idioma objetivo con `{{$languageInstructions}}`

### ❌ Evitar
- Hardcodear valores que pueden cambiar
- Ignorar el contexto de código proporcionado
- Cambiar la estructura básica del JSON de respuesta
- Sobrecomplicar el prompt innecesariamente

## 🔄 Recargar Prompts

El sistema cachea los prompts cargados. Para forzar la recarga después de modificaciones:

```typescript
// En código
promptManager.clearCache();

// O reinicia el proceso
```

## 📊 Testing de Prompts

Usa el script de prueba para validar tus prompts personalizados:

```bash
# Probar con prompts personalizados
node src/scripts/test-batch-processing.ts
```

El script mostrará qué tipo de prompt está usando (personalizado vs ejemplo) y los resultados del análisis.
