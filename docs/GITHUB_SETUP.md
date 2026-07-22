# Preparación de GitHub

El repositorio local está preparado para subirlo sin incluir credenciales.

## Primera publicación

1. Crea en GitHub un repositorio vacío, preferentemente privado durante las pruebas.
2. En la carpeta del repositorio ejecuta `gh auth login`. No pegues el token en
   archivos, commits, comandos compartidos ni documentación.
3. Añade el remoto: `git remote add origin URL_DEL_REPOSITORIO`.
4. Revisa `git status`, `git log --oneline` y `git remote -v`.
5. Sube la rama y etiquetas: `git push -u origin master --follow-tags`.
6. Confirma que la acción **Android checks** pase.

## Firma pública

El workflow actual genera únicamente una APK Debug de evaluación. Para una Release
firmada, crea un keystore permanente fuera del repositorio, configura los cuatro
secretos indicados en `SECURITY.md` y agrega un job de firma sin imprimirlos.

No publiques una APK firmada con `CN=Android Debug` como versión estable.

## Antes de hacerlo público

- Elegir licencia.
- Sustituir datos y capturas de prueba que puedan identificar personas.
- Configurar Security Advisories y método de contacto.
- Revisar la política de privacidad y limitaciones.
- Validar restauración, XLSX y PDF en aplicaciones externas.
