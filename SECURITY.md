# Seguridad

ProfAsist almacena datos académicos sensibles localmente. No publiques respaldos,
capturas con datos reales, archivos de audio, tokens, claves OAuth ni keystores.

## Reportar una vulnerabilidad

Mientras el repositorio sea privado, usa un issue privado o contacta directamente
al propietario. Antes de hacerlo público, configura Security Advisories de GitHub
y añade un correo de contacto mantenido por el propietario.

## Secretos de compilación

La firma Release usa exclusivamente estas variables:

- `PROFASIST_KEYSTORE_FILE`
- `PROFASIST_KEYSTORE_PASSWORD`
- `PROFASIST_KEY_ALIAS`
- `PROFASIST_KEY_PASSWORD`

El keystore y sus contraseñas deben guardarse fuera del repositorio y respaldarse
de forma segura. Perder esa clave impide publicar actualizaciones compatibles.
