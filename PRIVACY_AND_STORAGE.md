# Privacidad y almacenamiento — ProfAsist v3.0.1

---

## 🔒 1. Diseño local-first

ProfAsist busca mantener la información académica en el dispositivo. Esto no
equivale a seguridad absoluta: quien tenga acceso al teléfono desbloqueado, a un
respaldo compartido o a los datos de la aplicación podría acceder a información
sensible.

- **Cero servidores remotos propios**: La aplicación no envía listas de alumnos, calificaciones, matrículas ni audios a ningún servidor externo.
- **Sin rastreo ni analíticas**: No incluye SDKs de rastreo (como Google Analytics, Firebase Analytics, Facebook SDK, etc.).
- **Almacenamiento Local Aislado**:
  - **IndexedDB (`ProfAsistAudioDB`)**: Guarda los archivos binarios (`Blob`) de las grabaciones de voz de forma segura en la memoria interna de la app.
  - **localStorage (`profasist_groups`, `profasist_settings`)**: Almacena las estructuras de clases, asistencias, ponderaciones e información académica del profesor.

---

## 💾 2. Copias de Seguridad y Portabilidad

- **Formatos de Exportación**: Los respaldos se generan en formato estándar `.json` enriquecido con esquema versionado (`schemaVersion: 2`).
- **Control del Profesor**: El profesor es el único propietario y responsable de sus copias de seguridad. Al exportar un respaldo, se utiliza el API de compartir nativa del sistema operativo para que el docente decida a qué servicio personal (Google Drive, OneDrive, Correo Institucional, WhatsApp o Almacenamiento Local) enviar el archivo.

Los respaldos contienen datos académicos sensibles y actualmente no se describen
como cifrados por ProfAsist. Deben guardarse en una cuenta y dispositivo protegidos.
Los archivos de audio pueden requerir respaldo separado; compruébalo antes de
restaurar o cambiar de teléfono.

---

## 🗑️ 3. Eliminación de Datos

Si el profesor desea eliminar completamente sus datos de ProfAsist:
1. En la pestaña de Ajustes puede desinstalar la app o borrar los datos en `Ajustes del Sistema > Aplicaciones > ProfAsist > Limpiar Datos`.
2. Todas las clases, asistencias y grabaciones en IndexedDB serán purgadas de inmediato del almacenamiento interno del celular.

Los archivos que el usuario haya exportado o compartido quedan fuera del control
de ProfAsist y deben eliminarse por separado en Archivos, Drive, correo u otras apps.
