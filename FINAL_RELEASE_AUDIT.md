# Auditoría de liberación — ProfAsist 3.0.1

> **Documento histórico.** La validación vigente de v3.1.1 está en
> [`docs/VALIDACION_v3.1.1.md`](docs/VALIDACION_v3.1.1.md).

Fecha: 2026-07-22  
Commit revisado: `bc228ff`  
Etiqueta previa: `v3.0.0-final-release` (el nombre de la etiqueta no implica
aprobación actual)  
Recomendación: **LISTA CON LIMITACIONES para evaluación personal y repositorio
GitHub privado; NO LISTA todavía como APK pública definitiva**.

## Entorno comprobado

- Poco F5 físico conectado por ADB, pantalla 1080 × 2400.
- Package ID `com.carlos.profasist`.
- APK `versionName 3.0.1`, `versionCode 301`, minSdk 24, targetSdk 36.
- Node 24.16.0 y npm 11.13.0.
- Microsoft Excel, LibreOffice Calc, OnlyOffice, qpdf: no disponibles en este entorno.
- `pdfinfo` sí está disponible, pero no se generó un PDF de muestra durante esta ronda.

## Resultados reproducidos en esta ronda

| Función | Prueba | Esperado | Obtenido | Evidencia | Estado |
|---|---|---|---|---|---|
| Instalación | `adb install -r` de la APK candidata | Actualizar sin borrar datos | Instalación exitosa; grupo de 14 alumnos conservado | salida ADB y `evidence/profasist_final_home.png` | APROBADO |
| Inicio | Forzar cierre, iniciar y capturar | Inicio visible | Inicio renderizado | `evidence/profasist_home_portrait.png` | APROBADO |
| Navegación principal | Abrir materia y recorrer pestañas | Sin pantalla negra | Sesiones, Alumnos, Evaluación, Calendario, Análisis y Cierre abrieron | capturas `profasist_*` | APROBADO CON LIMITACIONES |
| Orientación | Rotación forzada vertical/horizontal | Contenido utilizable | Cabeceras sin superposición evidente; en horizontal requiere desplazamiento vertical | capturas portrait/landscape | APROBADO CON LIMITACIONES |
| Evaluación | Abrir y desplazar hasta ponderaciones | Vista renderizada | Esquema 20/20/20/40 visible | `evidence/profasist_evaluation_table_landscape.png` | APROBADO CON LIMITACIONES |
| Logcat | Filtrar por PID durante recorrido | Sin errores críticos | 0 coincidencias para FATAL/ReferenceError/TypeError/uncaught/OOM | `evidence/logcat_profasist_visual_smoke_errors.txt` | APROBADO |
| Atrás Android | Temporizador, Ruleta y materia | Cerrar modal y regresar | Cerró ambos modales; segundo Atrás volvió al Inicio | capturas `profasist_301_*_after_back.png` | APROBADO |
| Offline service worker | Repetir navegación y revisar promesas rechazadas | Sin error de fetch no capturado | 0 coincidencias críticas tras manejar fallo de red | `evidence/logcat_profasist_301_final_errors.txt` | APROBADO |
| Pruebas unitarias | `npm test -- --run` | Todas pasan | 7/7 pasan | salida de consola, 2026-07-22 | APROBADO CON LIMITACIONES |
| Build web | `npm run build` | Compilación exitosa | Exitosa; advertencia de chunk JS de 1.33 MB | salida de Vite | APROBADO CON LIMITACIONES |
| Firma APK | `apksigner verify --print-certs` | Firma de producción | APK válida v2, pero certificado `CN=Android Debug` | `apksigner` | FALLÓ para distribución pública |
| Dependencias | `npm audit --omit=dev` | Sin vulnerabilidades conocidas | 0 vulnerabilidades tras SheetJS oficial 0.20.3 | salida npm, 2026-07-22 | APROBADO |
| XLSX muestra | Inspección de existencia | Archivo disponible | Existe muestra de asistencia de 60 alumnos | `export_samples/Asistencia_60_Alumnos_Sample.xlsx` | NO REVALIDADO EN APP EXTERNA |

## Hallazgos

1. La APK candidata es funcional e instalable, pero usa firma Debug.
2. El fallo de Atrás de Android fue corregido en 3.0.1 y reproducido mediante ADB.
3. Algunas capturas históricas no prueban por sí mismas la operación completa que
   su nombre sugiere. Se conservan como contexto, no como aprobación.
4. No se demostró apertura o re-guardado XLSX en Excel, LibreOffice u OnlyOffice.
5. No se generaron ni validaron PDF reales en esta ronda.
6. No se completó todavía la matriz extrema de 100 alumnos/30 actividades.
7. El bundle principal supera 1 MB minificado; no bloqueó el Poco F5, pero conviene
   dividirlo antes de escalar grupos y grabaciones.

## Decisión

La versión puede seguir usándose con una política estricta de respaldos y el
repositorio puede subirse a GitHub. Antes de entregar una APK pública deben
resolverse como mínimo la firma de producción, restauración transaccional
comprobada y validación real de los formatos exportados.
