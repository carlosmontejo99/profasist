# 🤖 ProfAsist Agent & Developer Interoperability Protocol (AGENT_BRIDGE)
> **Versión del Protocolo:** 1.0.0 · **Aplica a:** ProfAsist v3.x / v4.x  
> **Destinatarios:** Agentes de IA autónomos (Antigravity, OpenCode, Claude Code) y Desarrolladores Humanos.  
> **Misión:** Garantizar interoperabilidad determinista, auditoría local y sincronización soberana de evaluaciones académicas sin pérdida de datos ni duplicación de estado.

---

## 🧭 1. Manifiesto de Co-Existencia Humano-IA

ProfAsist está diseñado con una arquitectura **Local-First y Soberana**. Todo dato evaluativo reside en el dispositivo del docente.
Cualquier agente de inteligencia artificial que interactúe con ProfAsist debe adherirse a tres reglas inviolables:
1. **Soberanía del Docente (Human-in-the-Loop):** La IA propone, audita, formatea y valida; el docente autoriza y tiene la última palabra sobre cualquier calificación o publicación externa.
2. **Determinismo y Cero Alucinación:** Las fórmulas de cálculo deben ser exactas. Jamás redondear arbitrariamente sin seguir las reglas institucionales (e.g. escala UACJ, calificación mínima 7.0).
3. **No-Duplicación de Estado:** Modificar o inyectar datos requiere preservar la integridad referencial de `students`, `categories` y `activities`. Prohibido crear claves huérfanas en `evaluations`.

---

## 🔌 2. Mecanismo Canónico de Conexión en Vivo (ADB CDP)

Cuando el dispositivo móvil (físico o emulador) está conectado por USB o red local con depuración activada:

### Topografía de Conexión
```
[Antigravity / OpenCode] 
       │ (Playwright / CDP Protocol)
       ▼
   localhost:9223 
       │ (adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>)
       ▼
[Android WebView: com.carlos.profasist]
       │ (localStorage: profasist_v1_data)
       ▼
[State Engine: React / TypeScript]
```

### Pasos de Vinculación Determinista
1. **Detectar PID de la aplicación:**
   ```bash
   adb shell pidof com.carlos.profasist
   ```
2. **Enrutar el socket de inspección Chrome DevTools:**
   ```bash
   adb forward tcp:9223 localabstract:webview_devtools_remote_<PID>
   ```
3. **Conectar cliente CDP (Python Playwright o Chromium):**
   ```python
   browser = await playwright.chromium.connect_over_cdp("http://localhost:9223")
   page = browser.contexts[0].pages[0]
   data = await page.evaluate("localStorage.getItem('profasist_v1_data')")
   ```

---

## 📊 3. Ontología y Esquema de Datos (`profasist_v1_data`)

El estado global de la aplicación se almacena serializado en `localStorage['profasist_v1_data']`.

### Jerarquía
```typescript
interface ProfAsistState {
  version: string;
  groups: Group[];
}

interface Group {
  id: string;                     // UUID único del grupo
  name: string;                   // Nombre visible (e.g. "Enzimología A-L3")
  schedule?: string;
  students: Student[];
  evaluations: {
    [parcialId: string]: ParcialEvaluation; // "parcial1", "parcial2", "parcial3"
  };
}

interface ParcialEvaluation {
  categories: Category[];
  grades: {
    [studentId: string]: {
      [activityId: string]: number; // 0.0 a 10.0
    };
  };
}

interface Category {
  id: string;        // e.g. "cat_tareas", "cat_resumenes", "cat_reportes", "cat_bitacora"
  name: string;      // Tareas (20%), Resúmenes (20%), Reportes (20%), Bitácora (40%)
  weight: number;    // Ponderación porcentual (suma total = 100)
  activities: Activity[];
}

interface Activity {
  id: string;        // ID único de la actividad (e.g. "act_p3_t1")
  name: string;      // Nombre descriptivo (e.g. "Presentación final P12 y 13")
}
```

---

## 📑 4. Estándar de Generación de Actas Institucionales (Excel XLSX)

Cualquier exportación de calificaciones debe cumplir el estándar oficial de 4 pestañas:

| Pestaña | Propósito | Columnas Clave |
|---|---|---|
| **Resumen Semestral** | Concentrado ordinario | Matrícula, Nombre, Parcial 1, Parcial 2, Parcial 3, Calificación Final, Estatus (`Acreditado` / `No Acreditado`). |
| **Parcial 1** | Desglose P1 | Tareas (20%), Resúmenes (20%), Reportes (20%), Bitácora (40%), Total P1. |
| **Parcial 2** | Desglose P2 | Tareas (20%), Resúmenes (20%), Reportes (20%), Bitácora (40%), Total P2. |
| **Parcial 3** | Desglose P3 | Tareas (20%), Resúmenes (20%), Reportes (20%), Bitácora (40%), Total P3. |

### Semáforo de Formato Condicional Invariable
- **Acreditado ($\ge 7.0$):** Relleno verde sólido `#dcfce7` con tipografía oscura/negrita.
- **No Acreditado ($< 7.0$):** Relleno rojo sólido `#fee2e2` con tipografía oscura/negrita.

---

## 🚀 5. Hoja de Ruta de Modernización (Roadmap v3.1 / v4.0)

1. **Módulo Nativo de Exportación Excel Institucional:** Integrar `xlsx` (SheetJS) directamente en la interfaz móvil para exportar las 4 pestañas con semáforo sin depender de scripts externos.
2. **Punto de Enlace P2P / Local Sync:** Un botón en la app "Modo Agente / Conectar Exocórtex" que levante un socket o servicio local para sincronizar con Orange Pi / Laptop por WiFi o USB con un solo toque.
3. **Módulo de Auditoría de Entregas Multicanal:** Registro de entregas recibidas vía Teams Chat, WhatsApp o correo institucional con metadatos de contingencia para trazabilidad docente.
4. **Respaldo Automático Snapshot:** Exportación automática de `profasist_snapshot_<timestamp>.json` cada vez que se modifique una calificación para prevención total de pérdida de datos.
