# ProfAsist ADB Bridge

CLI determinista para leer, comparar y sincronizar el estado de ProfAsist desde
el WebView de Android mediante `adb forward` + Chrome DevTools Protocol.

## Requisitos

- `adb` en el `PATH` (o variable `ADB`).
- Python 3.10+.
- Playwright para Python:

```bash
python3 -m pip install -r tools/adb_bridge/requirements.txt
python3 -m playwright install chromium
```

- APK **agent** instalada. La release normal no expone el socket de depuración.

## Build agent

```bash
npx cap sync android
cd android
JAVA_HOME=/ruta/a/jdk21 ./gradlew assembleAgent
adb install -r app/build/outputs/apk/agent/app-agent.apk
```

El build type `agent` usa el mismo `applicationId` que la release, por lo que
reemplaza la app sin borrar datos. La configuración de WebView debugging vive en
`android/app/src/agent/assets/capacitor.config.json`.

## Comandos

```bash
# Diagnóstico: dispositivo, PID, socket, targets CDP y estado local
python3 tools/adb_bridge/cli.py doctor

# Leer el teléfono a un snapshot timestamped
python3 tools/adb_bridge/cli.py pull --out backups/phone.json

# Comparar un JSON con el teléfono (no escribe)
python3 tools/adb_bridge/cli.py diff --in master.json

# Dry-run del merge (no escribe)
python3 tools/adb_bridge/cli.py push --in master.json

# Escribir, recargar y verificar hash
python3 tools/adb_bridge/cli.py push --in master.json --apply

# Validar un JSON sin dispositivo
python3 tools/adb_bridge/cli.py audit --in master.json
```

Opciones útiles:

- `--serial <serial>` si hay más de un dispositivo.
- `--prefer incoming|local` para conflictos de calificaciones (default: `incoming`).
- `--include-attendance` para fusionar también sesiones/asistencia (por defecto se
  preservan las locales).
- `--port 9223` para cambiar el puerto local del forward.

## Reglas de merge

1. Grupos por `id`; si no existe, por nombre normalizado + semestre.
2. Alumnos por `id`, luego matrícula normalizada, luego nombre normalizado.
3. Categorías y actividades por `id`, luego nombre normalizado.
4. Las calificaciones se traducen al `id` local cuando el match fue por nombre.
5. `sessions`, `attendance`, `recordings`, `closureConfig` y `reporting` locales
   se preservan salvo `--include-attendance`.
6. `deliveries` y `auditLog` se fusionan por `id`.
7. El merge es idempotente: un segundo `push --apply` reporta “Sin cambios”.

## Seguridad

- `push` es **dry-run** por defecto; escribir exige `--apply`.
- Antes de escribir se guarda un snapshot local en `backups/` y una copia en el
  dispositivo (`profasist_v1_data__prev`).
- Tras escribir se relee el estado y se compara el hash semántico. Si no coincide,
  se restaura la copia previa y se sale con código 4.
- El forward `tcp:9223` se elimina siempre al terminar.
- El estado se valida antes y después de escribir: ids únicos, notas 0–10,
  integridad referencial y pesos válidos.

## Códigos de salida

| Código | Significado |
|---:|---|
| 0 | OK |
| 2 | Error de ADB/CDP/entrada |
| 3 | Esquema inválido |
| 4 | Hash distinto tras escribir; copia restaurada |
| 130 | Interrumpido |

## Pruebas

```bash
python3 -m unittest discover -s tools/adb_bridge/tests -v
```

## Solución de problemas

- **“No se encontró webview_devtools_remote”**: instala la APK agent, abre la app
  y verifica que `adb shell cat /proc/net/unix | grep devtools` muestre el socket.
- **“Hay varios dispositivos ADB”**: usa `--serial`.
- **`INSTALL_FAILED_UPDATE_INCOMPATIBLE`**: la APK instalada usa otra firma. No
  desinstales sin respaldar; usa la misma firma o restaura el snapshot.
- **El hash cambia tras escribir**: normalmente la app migró datos al abrir. El
  bridge restaura la copia previa si la verificación falla; revisa `logcat`.
