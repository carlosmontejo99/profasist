# Matriz de pruebas — ProfAsist 3.0.1

`APROBADO` significa que se ejecutó la prueba descrita. `PENDIENTE` no debe
interpretarse como fallo, pero tampoco como compatibilidad demostrada.

| ID | Área | Prueba ejecutada | Resultado | Evidencia | Estado |
|---|---|---|---|---|---|
| SMK-01 | Instalación | Actualización APK con `adb install -r` | Success; datos de 14 alumnos visibles | `evidence/profasist_final_home.png` | APROBADO |
| SMK-02 | Vertical | Inicio y materia | Sin solapamiento visible | capturas portrait | APROBADO |
| SMK-03 | Horizontal | Materia y seis pestañas | Abren; contenido inferior exige scroll | capturas landscape | APROBADO CON LIMITACIONES |
| SMK-04 | Evaluación | Abrir y desplazar esquema | 4 categorías, suma 100%, sin pantalla negra | `profasist_evaluation_table_landscape.png` | APROBADO CON LIMITACIONES |
| SMK-05 | Logcat | Buscar errores críticos por PID | 0 coincidencias críticas | `logcat_profasist_visual_smoke_errors.txt` | APROBADO |
| NAV-01 | Atrás Android | Atrás con Temporizador, Ruleta y materia | Cerró modales y volvió al Inicio | capturas `profasist_301_*_after_back.png` | APROBADO |
| UNIT-01 | Matemáticas | Suite `tests/audit.test.ts` | 7/7 | salida npm | APROBADO CON COBERTURA LIMITADA |
| BUILD-01 | Web | `npm run build` | Build exitoso; chunk grande | salida Vite | APROBADO CON LIMITACIONES |
| APK-01 | Firma | `apksigner verify` | Firma válida v2, certificado Debug | salida apksigner | FALLÓ PARA PRODUCCIÓN |
| XLSX-01 | Muestra | Confirmar archivo de asistencia | Archivo presente | `export_samples/` | APROBADO SOLO EXISTENCIA |
| XLSX-02 | LibreOffice/OnlyOffice/Excel | Abrir y re-guardar | Apps no disponibles | — | PENDIENTE |
| PDF-01 | Android Guardar como PDF | Generar y abrir externamente | No ejecutada | — | PENDIENTE |
| AUDIO-01 | Grabación larga/reinicio/compartir | Flujo completo | No repetido en esta ronda | — | PENDIENTE |
| BACKUP-01 | Restauración limpia/fusión/reemplazo | Comparar datos antes/después | No ejecutada | — | PENDIENTE |
| SCALE-01 | 100 alumnos/30 actividades | Rendimiento y asociación por ID | No ejecutada | — | PENDIENTE |
| UPDATE-01 | Firma definitiva | Actualizar versión anterior sin perder datos | No posible hasta crear keystore | — | PENDIENTE |
| SEC-01 | Dependencias | `npm audit --omit=dev` | 0 vulnerabilidades con SheetJS oficial 0.20.3 | salida npm | APROBADO |
