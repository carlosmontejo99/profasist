# 🤖 ProfAsist Agent & Developer Interoperability Protocol (AGENT_BRIDGE)
> **Versión del Protocolo:** 1.1.0 · **Aplica a:** ProfAsist v3.1.x / v4.x
> **Destinatarios:** Agentes de IA autónomos (Antigravity, OpenCode, Claude Code) y desarrolladores humanos.
> **Misión:** Garantizar interoperabilidad determinista, auditoría local y sincronización soberana de evaluaciones académicas sin pérdida de datos ni duplicación de estado.

---

## 🧭 1. Manifiesto de Co-Existencia Humano-IA

ProfAsist es **Local-First y soberano**. Todo dato evaluativo reside en el dispositivo del docente. Tres reglas inviolables:

1. **Soberanía del docente (Human-in-the-Loop):** la IA propone, audita, formatea y valida; el docente autoriza y tiene la última palabra sobre cualquier calificación o publicación.
2. **Determinismo y cero alucinación:** las fórmulas son explícitas y auditables. La app usa redondeo **half-up** a 1 decimal; el XLSX usa `ROUND(...,1)` con `fullCalcOnLoad`.
3. **No duplicación de estado:** toda escritura preserva la integridad referencial de `groups`, `students`, `categories`, `activities` y `evaluations`. Prohibido crear claves huérfanas.

> **Corrección v1.1.0:** la versión 1.0.0 describía `evaluations` como un mapa `{[parcialId]: ...}` y omitía `sessions`, `attendance`, `reporting` y `deliveries`. El esquema real es el de `types.ts`; este documento se alinea con el código.

---

## 🔌 2. Mecanismo Canónico de Conexión (ADB CDP)

```
[Antigravity / OpenCode]
       │ (Playwright / Chrome DevTools Protocol)
       ▼
   localhost:9223
       │ (adb forward tcp:9223 localabstract:webview_devtools_remote_<pid>)
       ▼
[Android WebView: com.carlos.profasist]
       │ (localStorage: profasist_v1_data)
       ▼
[State Engine: React / TypeScript]
```

### Requisito de build

El socket solo existe en la APK **agent**. La release normal compila con
`BuildConfig.AGENT_BRIDGE = false` y no expone WebView debugging.

```bash
npx cap sync android
cd android
JAVA_HOME=/ruta/a/jdk21 ./gradlew assembleAgent
adb install -r app/build/outputs/apk/agent/app-agent.apk
```

La configuración `android.webContentsDebuggingEnabled=true` vive en
`android/app/src/agent/assets/capacitor.config.json`. El build `agent` usa el
mismo `applicationId`, por lo que conserva los datos al reemplazar la app.

### Vinculación determinista

```bash
adb shell pidof com.carlos.profasist
adb forward tcp:9223 localabstract:webview_devtools_remote_<PID>
python3 tools/adb_bridge/cli.py doctor
```

El CLI resuelve el socket, valida el target y elimina el forward al terminar.

---

## 📊 3. Esquema Real de Datos (`profasist_v1_data`)

```ts
interface AppData {
  version: 2;                       // 1 se migra automáticamente a 2
  settings: AppSettings;            // incluye institution
  groups: Group[];
  deliveries?: DeliveryRecord[];
  auditLog?: AuditLogEntry[];
  syncMeta?: { lastPullAt?: string; lastPushAt?: string; source?: string; hash?: string };
}

interface Group {
  id: string;
  name: string;
  semester: string;
  scheduleSummary: string;
  students: Student[];
  sessions: Session[];              // asistencia + grabaciones
  color: string;
  archived: boolean;
  evaluations?: GroupEvaluations;
  closureConfig?: ClosureConfig;
  reporting?: GroupReporting;       // override institucional por materia
  finalOverrides?: Record<string, GradeOverride>;
}

interface GroupEvaluations {
  parcial1: ParcialEvaluation;
  parcial2: ParcialEvaluation;
  parcial3: ParcialEvaluation;
}

interface ParcialEvaluation {
  categories: EvaluationCategory[];
  grades: Record<string, Record<string, number>>; // studentId -> activityId -> 0..10
}

interface EvaluationCategory {
  id: string;                       // "cat_tareas", "cat_resumenes", ...
  name: string;
  weight: number;                   // 0..100
  activities: Activity[];
}

interface Activity {
  id: string;
  name: string;
}

interface DeliveryRecord {
  id: string;
  groupId: string;
  studentId: string;
  parcialId: 'parcial1' | 'parcial2' | 'parcial3';
  activityId: string;
  channel: 'teams' | 'outlook' | 'whatsapp' | 'presencial' | 'usb' | 'otro';
  receivedAt: string;               // ISO 8601
  evidenceRef: string;              // archivo, URL o id de mensaje
  status: 'pendiente' | 'validada' | 'rechazada' | 'duplicada';
  grade?: number;
  note?: string;
  validatedAt?: string;
  actor: 'docente' | 'agente';
}

interface AuditLogEntry {
  id: string;
  at: string;
  actor: 'docente' | 'agente';
  action: string;
  target: string;
  before?: string;
  after?: string;
}
```

### Reglas de cálculo

- La nota de una actividad solo participa si es un número finito entre 0 y 10.
- Una categoría sin notas **se excluye** y los pesos restantes se re-normalizan.
- Un parcial sin actividades o sin notas devuelve `null`.
- Si falta un parcial completo, el final es `Pendiente`, no `No Acreditado`.
- Los parciales se redondean a 1 decimal antes del promedio final.
- `ROUND` es half-up (`6.95 → 7.0`). Las actas 2026-B generadas con redondeo binario de Python pueden diferir 0.1 en fronteras `.x5`; la app y el XLSX son internamente consistentes.
- `finalOverrides` permite una resolución docente auditada sin alterar el desglose P1/P2/P3.

---

## 📑 4. Estándar de Actas Institucionales (XLSX)

Un libro por materia, generado con **ExcelJS**, con 4 pestañas exactas:

| Pestaña | Contenido |
|---|---|
| `Resumen Semestral` | `No.`, `Matrícula`, `Nombre del Alumno`, `Parcial 1`, `Parcial 2`, `Parcial 3`, `Calificación Final`, `Estatus` |
| `Parcial 1` | Actividades por categoría, `Prom <Categoría>`, `Calificación Parcial 1` |
| `Parcial 2` | Ídem P1 |
| `Parcial 3` | Ídem P1 |

### Fórmulas y formato

- Promedio de categoría: `=IF(COUNT(rango)=0,"",ROUND(AVERAGE(rango),1))`.
- Parcial: suma ponderada con `IF(ISNUMBER(...))` y denominador de pesos presentes.
- Resumen: referencia a la celda total de cada parcial.
- Final: `Pendiente` si falta un parcial; si no, promedio simple o ponderado configurado.
- `#DCFCE7` para `Acreditado`, `#FEE2E2` para `No Acreditado`, ámbar para `Sin derecho`; `Pendiente` sin relleno.
- Columnas ocultas I-K: asistencia, calificación por resolución y motivo.
- `fullCalcOnLoad = true`; paneles congelados en `C5` / `C6`.
- Nombre: `Acta_Oficial_<Materia>_<Semestre>.xlsx`.

### Metadatos

```ts
interface InstitutionProfile {
  university: string;
  institute: string;
  laboratoryPrefix: string;
  professor: string;
  semesterDefault: string;
  email?: string;
}
```

Resolución: `reporting` del grupo → perfil global → valor derivado. La cabecera
es `Universidad · Instituto` y `Laboratorio · Semestre · Prof.`; los emojis y el
sufijo `· Profesor` se eliminan con `cleanGroupName`.

---

## 📥 5. Auditoría de Entregas

- Canales: Teams, Outlook, WhatsApp, presencial, USB u otro.
- Ingesta CSV/JSON con columnas `Matrícula, Nombre, Parcial, Actividad, Canal, Fecha, Evidencia, Nota, Estado, Motivo`.
- Matching por matrícula, luego nombre normalizado; actividades por id o nombre.
- Duplicados por alumno + actividad + mismo día o misma evidencia: se omiten y se reportan.
- `Aplicar nota` escribe en `evaluations[parcial].grades[studentId][activityId]` y exige confirmación si ya existía otra nota.
- Cada acción se registra en `auditLog` (máx. 500 entradas).
- Sin OAuth/Graph: la app sigue siendo local-first; el docente exporta el listado desde Teams/Outlook.

---

## 🚀 6. CLI Determinista (`tools/adb_bridge/`)

```bash
python3 tools/adb_bridge/cli.py doctor
python3 tools/adb_bridge/cli.py pull --out backups/phone.json
python3 tools/adb_bridge/cli.py diff --in master.json
python3 tools/adb_bridge/cli.py push  --in master.json          # dry-run
python3 tools/adb_bridge/cli.py push  --in master.json --apply  # escribe
python3 tools/adb_bridge/cli.py audit --in master.json
```

- `push` es dry-run por defecto; `--apply` exige confirmación humana.
- Antes de escribir: snapshot local en `backups/` y copia en el dispositivo (`profasist_v1_data__prev`).
- Después de escribir: relee, valida y compara hash; si no coincide, restaura la copia previa (código 4).
- Merge: grupos por id → nombre+semestre; alumnos por id → matrícula → nombre; categorías/actividades por id → nombre; calificaciones traducidas al id local.
- `sessions`, `attendance`, `recordings` y `closureConfig` se preservan salvo `--include-attendance`.
- Segundo `push --apply` con el mismo input reporta “Sin cambios”.

---

## 🗂️ 7. Snapshots

- IndexedDB `ProfAsistSnapshotDB`, store `snapshots`, retención de 20.
- Auto-snapshot debounced 4 s tras cambios de grupo/entrega; hash para evitar duplicados.
- Panel **Ajustes → Nube → Modo Agente**: exportar, crear, historial, restaurar y activar/desactivar.
- Restauración validada con `migrateData`; reemplaza el estado completo.

---

## 🛡️ 8. Invariantes de Escritura

1. Validar el esquema antes y después de escribir.
2. No borrar grupos, alumnos, sesiones ni notas por defecto.
3. No crear notas huérfanas; validar `studentId` y `activityId`.
4. No duplicar ids; deduplicar arrays por id.
5. No escribir si el hash semántico no cambia.
6. No dejar forwards ADB abiertos.
7. No exponer CDP en la release normal.
8. No publicar calificaciones sin confirmación del docente.

---

## 🧪 9. Verificación Mínima

```bash
npm test                                   # 54 pruebas TS
python3 -m unittest discover -s tools/adb_bridge/tests  # 11 pruebas
npm run build
npx cap sync android
JAVA_HOME=/ruta/a/jdk21 ./android/gradlew -p android assembleAgent assembleRelease
python3 scripts/verify_institutional_xlsx.py /tmp/Acta.xlsx --recalc
```

---

## 🗺️ 10. Roadmap

- **v3.1 (entregado):** motor único, metadatos, actas de 4 pestañas, auditoría de entregas, snapshots, CLI ADB, build agent, splash y contraste.
- **v4.0 (pendiente):** extracción modular de `App.tsx`, integración opcional con Microsoft Graph, firma de release de producción y validación en Excel de escritorio.
