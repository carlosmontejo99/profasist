# ProfAsist

Aplicación Android local-first para asistencia, evaluación y seguimiento docente.
Está construida con React, TypeScript, Vite y Capacitor.

## Estado actual

- Versión de aplicación: `3.0.1` (`versionCode 301`).
- Estado de liberación: **candidata funcional con limitaciones**.
- Dispositivo real revisado: Poco F5, 1080 × 2400.
- APK candidata instalada mediante actualización, conservando los datos existentes.
- La APK actual está firmada con certificado Android Debug. No es todavía una
  entrega pública definitiva.

La navegación principal, Evaluación, las vistas vertical/horizontal y Atrás de
Android pasaron una prueba visual de humo en el Poco F5. Sigue pendiente completar
las pruebas exhaustivas de audio, restauración y PDF/XLSX en aplicaciones externas.
Consulta [FINAL_RELEASE_AUDIT.md](FINAL_RELEASE_AUDIT.md) y
[KNOWN_LIMITATIONS.md](KNOWN_LIMITATIONS.md) antes de distribuirla.

## Desarrollo

Requisitos: Node.js 24, npm y Android SDK. La aplicación no requiere una clave de
Gemini para funcionar.

```bash
npm install
npm test
npm run build
npx cap sync android
cd android
JAVA_HOME=/ruta/a/un/jdk/compatible ./gradlew assembleRelease
```

La APK se genera en
`android/app/build/outputs/apk/release/app-release.apk`.

## Documentación

- `USER_GUIDE.md`: instalación y uso inicial.
- `PRIVACY_AND_STORAGE.md`: datos almacenados y eliminación.
- `TEST_MATRIX.md`: pruebas realmente ejecutadas y pendientes.
- `KNOWN_LIMITATIONS.md`: riesgos conocidos.
- `CHANGELOG.md`: historial de cambios.
- `CITATION.cff`: metadatos de autoría y citación académica.

Las carpetas locales `evidence/` y `export_samples/` se conservan fuera del
repositorio público porque pueden contener datos o muestras de auditoría.

## Licencia y citación

ProfAsist se distribuye bajo la licencia GNU GPL versión 3 exclusivamente.
Consulta [LICENSE](LICENSE) para conocer las condiciones completas. GitHub puede
generar una cita desde `CITATION.cff`; el DOI se añadirá únicamente después de
archivar una Release estable mediante Zenodo.

## Preparación para GitHub

Antes de publicar una Release estable: crear un keystore de producción,
documentar su custodia, configurar secretos de CI y repetir la prueba de
actualización usando la firma definitiva. Después se podrá activar la integración
con Zenodo y archivar la Release para obtener el DOI.
