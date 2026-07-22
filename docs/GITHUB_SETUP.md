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

- Confirmar que la licencia GPL-3.0-only sea la elegida para la publicación.
- Sustituir datos y capturas de prueba que puedan identificar personas.
- Configurar Security Advisories y método de contacto.
- Revisar la política de privacidad y limitaciones.
- Validar restauración, XLSX y PDF en aplicaciones externas.

## DOI con Zenodo

1. Conectar GitHub y ORCID desde la cuenta de Zenodo.
2. Sincronizar la lista de repositorios y habilitar `carlosmontejo99/profasist`.
3. Revisar `CITATION.cff` antes de cada Release estable.
4. Crear la Release en GitHub solamente cuando la APK y documentación estén
   preparadas para quedar archivadas permanentemente.
5. Esperar a que Zenodo archive la Release y asigne el DOI de esa versión.

No se necesita ni se debe guardar un token de Zenodo o GitHub dentro del código
para utilizar la integración normal entre ambos servicios.
