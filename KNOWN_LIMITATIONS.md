# Limitaciones Conocidas y Comportamiento Documentado — ProfAsist v3.0.1

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
- **Estado**: Validación estructural realizada.
- **Explicación**: Los archivos `.xlsx` generados por ProfAsist utilizan el estándar oficial OpenXML SpreadsheetML de la librería `SheetJS/xlsx`. Se validó su integridad interna comprobando que la compresión ZIP/XML no posea ningún error (`unzip -t` limpio).
- **Aviso**: El equipo de desarrollo no cuenta con Microsoft Excel comercial instalado en el servidor de pruebas Linux; el archivo fue validado mediante visores de hojas de cálculo y utilidades de línea de comandos.
