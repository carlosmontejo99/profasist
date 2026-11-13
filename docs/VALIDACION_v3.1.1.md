# Validación de liberación — ProfAsist v3.1.1

**Fecha:** 2026-11-13  
**Tipo:** patch release sobre v3.1.0  
**Rama:** `master`  
**Build:** `versionCode 311` · `versionName 3.1.1`

## Cambio incluido

- Splash visible **1.5 s** (3× los 500 ms originales) antes del fade-out de 450 ms.
- Sin cambios en modelo de datos, cálculo, actas, auditoría, snapshots ni puente ADB.

## Verificación

| Prueba | Resultado |
|---|---|
| TypeScript (`npm test`) | **54/54** |
| Python ADB | **11/11** |
| `npx tsc --noEmit` | Sin errores |
| `npm run build` | Correcto |
| `assembleAgent` / `assembleRelease` | Correctos |
| Asset del splash en la APK | `setTimeout(hide, 1500)` |
| Instalación `adb install -r` | Correcta |
| Versión instalada | `3.1.1` / `311` |
| Datos del Poco F5 | 3 grupos · 34 alumnos · 162 sesiones |
| Bitácora | 0 entradas (`bridge_smoke_test` eliminada) |
| CDP agent | Socket y página `https://localhost/` válidos |

## Artefactos

| APK | Tamaño | SHA-256 |
|---|---:|---|
| `agent/app-agent.apk` | 3.9 MB | `e3178e9df2110745978c92b741db51861629e801d138d7b7b19c36aa2df7e6f7` |
| `release/app-release-unsigned.apk` | 3.9 MB | `9164f2e7fe3504fe85fab874f0a3ec95a7eb24d8adea6cb65a7b2b98f2569df0` |

- `agent` conserva la firma debug para actualizar sin borrar datos.
- `release` permanece unsigned hasta configurar `PROFASIST_KEYSTORE_*`.
- La release normal no expone CDP.

## Matriz completa

La validación funcional completa de motor, actas, auditoría y puente ADB está en
[`VALIDACION_v3.1.0.md`](VALIDACION_v3.1.0.md). v3.1.1 solo modifica la duración
del splash.
