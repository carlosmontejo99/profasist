# Validación de liberación — ProfAsist v3.1.0

**Fecha:** 2026-11-13  
**Rama:** `feat/v3.1-agent-bridge`  
**Dispositivo:** Poco F5 (`12337fdb`), Android, `com.carlos.profasist`  
**Build:** `versionCode 310` · `versionName 3.1.0`

---

## 1. Pruebas automatizadas

| Suite | Resultado |
|---|---|
| TypeScript (`npm test`) | **54/54** |
| Puente ADB (`python3 -m unittest discover -s tools/adb_bridge/tests`) | **11/11** |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Correcto |
| `assembleAgent` / `assembleRelease` | Correctos |

Cobertura relevante:

- Cálculo de categoría, parcial y final; re-normalización; `Pendiente`; redondeo half-up; compuerta de asistencia; `finalOverrides`.
- Migración v1 → v2 e idempotencia.
- Metadatos institucionales y nombres de archivo.
- Actas XLSX: 4 pestañas, fórmulas, congelado, semáforo, columnas ocultas, override y asistencia.
- Auditoría: CSV/JSON, acentos, `dd/mm/yyyy`, coma decimal, duplicados, cobertura y aplicación de nota.
- Merge ADB: agregado, idempotencia, conflictos, sesiones preservadas, traducción de ids y no mutación de entradas.

---

## 2. Actas institucionales

| Verificación | Resultado |
|---|---|
| 3 libros × 4 pestañas | Correcto |
| Nombres oficiales | `Acta_Oficial_Enzimologia_AL3_2026B.xlsx`, etc. |
| Fórmulas nativas + `fullCalcOnLoad` | Correcto |
| Congelado `C5` / `C6` | Correcto |
| Semáforo `#DCFCE7` / `#FEE2E2` | Correcto |
| openpyxl | Estructura y rellenos válidos |
| LibreOffice recalc | Valores coincidentes con el motor |

Comparación con actas históricas:

- Enzimología A-L3: **11/11 finales exactos**; 4 parciales P1 difieren 0.1 por redondeo binario histórico.
- Bioquímica Metabólica A-L1: **12/12 exactos**.
- Enzimología A-L2: **9/11 finales exactos**; Evelyn se resuelve con `finalOverrides`; Christye difiere 0.1 por frontera `.x5`.
- La app y el XLSX usan half-up y son internamente consistentes.

---

## 3. Auditoría de entregas

| Flujo | Resultado |
|---|---|
| Registro manual | Correcto |
| Importación CSV de Teams/Outlook | Correcto |
| Detección de duplicado | 1 omitido y reportado |
| Aplicación de nota | Correcto, con confirmación propia |
| Bitácora | 3 entradas en la prueba |
| Cobertura | 2/6 = 33 % en la prueba |
| Diálogos nativos | Eliminados; modales propios de la app |

---

## 4. Puente ADB y APK agent

| Verificación | Resultado |
|---|---|
| `doctor` | Socket detectado, estado válido |
| `pull` | Snapshot correcto |
| `diff` | Detecta cambios sin escribir |
| `push` dry-run | No escribe |
| `push --apply` | Hash verificado; solo se añadió una entrada de bitácora |
| Segundo `push --apply` | “Sin cambios” (idempotente) |
| Forward ADB | Eliminado al terminar |
| Datos tras instalar agent | 3 grupos · 34 alumnos · 162 sesiones preservados |
| Versión instalada | `versionName 3.1.0`, `versionCode 310` |

Artefactos:

| APK | Tamaño | SHA-256 |
|---|---:|---|
| `agent/app-agent.apk` | 3.9 MB | `42d11bb93962478464aa9c7bd73c2a1ee656d834d8ae531f7e856eeb0f501e1e` |
| `release/app-release-unsigned.apk` | 3.9 MB | `b307d8ccca2dd32a80341959876c0e385a29b25102d2516d78bd14a61593ea9f` |

- `agent` está firmada con el certificado debug existente para conservar datos.
- `release` queda **unsigned** porque no se configuraron las variables `PROFASIST_KEYSTORE_*`.
- La release normal compila con `AGENT_BRIDGE=false` y no expone CDP.

---

## 5. Splash y pulido visual

| Verificación | Resultado |
|---|---|
| Splash presente tras recargar | Sí |
| Duración visible | 1.5 s (3× la original) |
| Logotipo cargado | 92 × 92 px |
| Fade-out | 450 ms |
| Fallback | 4 s |
| `prefers-reduced-motion` | Respetado |
| Pestañas de Ajustes con SVG | 5/5 |
| Texto atenuado claro | `#475569` sobre blanco ≈ 7.5:1 |
| Texto atenuado oscuro | `#cbd5e1` sobre `#020617` ≈ 12:1 |
| Foco visible | Anillo índigo en controles |

---

## 6. Limitaciones conocidas

- No se validó en Microsoft Excel de escritorio; sí en LibreOffice Calc y openpyxl.
- La APK release no está firmada para distribución pública.
- Teams/Outlook se integran por CSV/JSON, no por OAuth/Graph.
- El bridge requiere la APK `agent` y Playwright en el host.
- La bitácora del dispositivo conserva una entrada `bridge_smoke_test` de la prueba de escritura.
