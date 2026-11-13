# Registro de Cambios (Changelog) — ProfAsist

## [v3.1.0] - 2026-11-13

### Motor académico
- **Motor único de cálculo** (`services/grading.ts`): categorías, parciales, final, redondeo determinista y compuerta de asistencia.
- Las categorías sin notas se **re-normalizan**; un parcial completo ausente produce `Pendiente` en lugar de un falso `No Acreditado`.
- Resoluciones docentes auditadas mediante `finalOverrides` (nota, motivo, fecha y actor).
- Corrección del bug que borraba `evaluations` y `closureConfig` al editar nombre, semestre u horario de una materia.
- Semestre editable en Ajustes del grupo y migración `AppData` v1 → v2.

### Reportes institucionales
- Perfil institucional parametrizable: Universidad, Instituto, Laboratorio, Semestre y Profesor, con override por materia.
- Actas de **4 pestañas** (`Resumen Semestral`, `Parcial 1`, `Parcial 2`, `Parcial 3`) con fórmulas nativas, congelado y `fullCalcOnLoad`.
- Semáforo de acreditación `#DCFCE7` / `#FEE2E2` y columnas ocultas de auditoría.
- Exportación individual y por lote de las tres actas del semestre.

### Auditoría y sincronización
- Módulo de **auditoría de entregas** con CSV/JSON de Teams/Outlook, detección de duplicados, cobertura y aplicación de notas.
- Bitácora de auditoría local con límite de 500 entradas.
- Snapshots automáticos en IndexedDB (máx. 20) y panel **Modo Agente**.
- CLI `tools/adb_bridge/`: `doctor`, `pull`, `diff`, `push` y `audit`; dry-run por defecto, backups y verificación de hash.
- Build Android **agent** con el mismo `applicationId`, WebView debugging aislado y release normal sin CDP.

### Interfaz
- Splash screen animada de ~1.5 s con fade-out y respeto a `prefers-reduced-motion`.
- Iconografía SVG consistente en pestañas de Ajustes y cabeceras; retiro de emojis de navegación.
- Contraste reforzado para lectura en laboratorio (slate-600/300) y foco visible en controles.

### Calidad
- 54 pruebas TypeScript y 11 pruebas Python del puente.
- Validación openpyxl + recálculo LibreOffice para las actas.
- `push --apply` verificado en Poco F5 sin alterar grupos, alumnos, sesiones ni calificaciones.
- Regla de redondeo **half-up** documentada; las actas 2026-B generadas con redondeo binario de Python pueden diferir 0.1 en fronteras `.x5`.


## [v3.0.1] - 2026-07-22

- Atrás de Android ahora cierra primero Temporizador y Ruleta.
- Eliminado el cambio de User-Agent que intentaba eludir restricciones OAuth.
- Ocultado el flujo OAuth directo de Google Drive y desactivada su sincronización
  automática; los respaldos usan el selector nativo de Android.
- Firma Release configurable exclusivamente mediante variables de entorno.
- Workflow de GitHub Actions para pruebas, build web y APK Debug de evaluación.

## [Auditoría documental] - 2026-07-22

- Se corrigieron afirmaciones no demostradas en la documentación.
- Se registró que la APK 3.0.0 actual usa certificado Android Debug.
- Se agregó el hallazgo pendiente del botón Atrás de Android.
- Se separaron claramente pruebas ejecutadas, validaciones estructurales y
  pruebas todavía pendientes.

## [v3.0.0] - 2026-07-22 (Auditoría Final de Liberación)

### 🌟 Novedades y Mejoras Principales
- **React Error Boundary (`ErrorBoundary.tsx`)**: Protección global contra fallos JS inesperados. Muestra una pantalla de rescate amigable sin dejar la app en negro.
- **Arquitectura de Almacenamiento de Audio (`IndexedDB`)**: Migración de grabaciones de `localStorage` a `IndexedDB` (`ProfAsistAudioDB`), liberando memoria en la WebView y permitiendo grabaciones más largas.
- **Rediseño del Panel Nube**: Eliminación de botones redundantes. Unificación en 1 tarjeta de respaldo nativa (`navigator.share`) para guardar en Google Drive/WhatsApp/Almacenamiento local.
- **Exportación Excel (.xlsx) Profesional**: Ancho dinámico de columnas, congelamiento de paneles (`Freeze Panes`) en matrículas y nombres, y formateo numérico de calificaciones.
- **Impresión / PDF Optimizado**: Reglas `@media print` en blanco pulcro que ocultan controles interactivos y previenen el corte erróneo de filas entre páginas.
- **Prioridad a Correo Institucional**: Modales y botones pre-diligenciados para comunicación por correo (`@universidad.edu.mx`) mediante Gmail o Outlook.
- **Candidata Android**: `versionCode 300` / `versionName 3.0.0` instalada en
  Xiaomi Poco F5; posteriormente se confirmó que usaba certificado Android Debug.
- **Pruebas Automatizadas**: Suite unitaria en `tests/audit.test.ts` con 7/7 casos probados y pasados.

---

## [v2.9.0] - 2026-07-22
- Pre-audit baseline commit y etiqueta Git.
