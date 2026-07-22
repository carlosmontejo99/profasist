# Registro de Cambios (Changelog) — ProfAsist

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
