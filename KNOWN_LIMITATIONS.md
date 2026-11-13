# Limitaciones Conocidas y Comportamiento Documentado — ProfAsist v3.1.0

## Estado de distribución

- La APK actual está firmada con el certificado `Android Debug`. Aunque es
  instalable, no es la firma adecuada para una distribución pública estable.
- Atrás de Android fue corregido y probado mediante ADB en Temporizador, Ruleta y
  navegación de materia. Aun conviene repetirlo táctilmente en otros dispositivos.
- La compatibilidad XLSX no se ha probado todavía en Microsoft Excel,
  LibreOffice Calc ni OnlyOffice en este entorno.
- PDF profesional, restauración transaccional, grabación larga y actualización
  firmada siguen pendientes de validación integral.
- El bundle web principal mide aproximadamente 1.33 MB minificado; Vite advierte
  que supera 500 kB. Conviene aplicar división de código si afecta el arranque.

Para garantizar total honestidad y claridad en la distribución entre docentes, se detallan las limitaciones actuales del sistema:

---

## 1. Integración con Google Drive API Directa
- **Estado**: Funcionalidad opcional diferida a favor del **Respaldo Nativo de Android**.
- **Explicación**: El flujo directo OAuth Client ID requiere que el profesor registre la URL origin en la consola de Google Cloud. En WebView móvil de Android, Google restringe con frecuencia los inicios de sesión OAuth sin navegador completo (Error 400 `disallowed_useragent`).
- **Solución Recomendada**: Utilizar el botón **`EXPORTAR Y GUARDAR RESPALDO`** dentro de la pestaña de Nube, el cual abre el menú de compartir nativo de Android y permite guardar el archivo `.json` en la app oficial de Google Drive instalada en el dispositivo en 1 clic.

---

## 2. Formato de Grabación de Audio
- **Estado**: Formato dependiente del dispositivo.
- **Explicación**: El WebView de Android en Xiaomi (Poco F5) produce archivos en contenedor WebM con codec Opus (`audio/webm;codecs=opus`).
- **Comportamiento**: Al exportar grabaciones a la memoria del teléfono, los archivos se guardan con extensión `.webm`. Se pueden reproducir en reproductores multimedia modernos (VLC, MX Player, Chrome, etc.).

---

## 3. Compatibilidad con Microsoft Excel Desktop vs Hojas Libres
- **Estado**: Validación estructural y de recálculo realizada con LibreOffice.
- **Explicación**: Las actas institucionales usan `ExcelJS` para escribir fórmulas nativas, estilos, paneles congelados y `fullCalcOnLoad`. El archivo se validó con `openpyxl` y se recalculó con LibreOffice Calc.
- **Aviso**: El equipo de desarrollo no cuenta con Microsoft Excel comercial instalado en el servidor de pruebas Linux. Se recomienda abrir una muestra en Excel antes de una distribución masiva.

---

## 4. Regla de redondeo institucional
- **Estado**: Documentada y determinista.
- **Regla**: ProfAsist v3.1 redondea a 1 decimal con **half-up** (`6.95 → 7.0`, `9.95 → 10.0`). La app y las fórmulas `ROUND(...,1)` del XLSX usan la misma regla.
- **Diferencia histórica**: Las actas 2026-B se generaron con el redondeo binario de Python. En fronteras exactas `.x5` pueden existir diferencias de **0.1** (`9.95 → 9.9` en el acta histórica vs `10.0` en la app). Los promedios finales afectados son casos aislados; el desglose oficial se conserva en los archivos del vault.
- **Resolución docente**: Los casos ajustados manualmente (por ejemplo, bitácoras validadas) se representan con `finalOverrides`, que conserva el motivo, la fecha y el actor.
