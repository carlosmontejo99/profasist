# Validación de liberación — ProfAsist v3.1.2

**Fecha:** 2026-11-13  
**Tipo:** patch de permisos, notificaciones y grabación  
**Rama:** `master`  
**Build:** `versionCode 312` · `versionName 3.1.2`  
**Dispositivo:** Poco F5 (`12337fdb`)

## Permisos Android

| Verificación | Resultado |
|---|---|
| `POST_NOTIFICATIONS` declarado en la APK | Sí |
| `SCHEDULE_EXACT_ALARM` declarado en la APK | Sí |
| Permiso de notificaciones revocado y solicitado en runtime | Diálogo real de Android mostrado |
| Permiso concedido | `granted=true` |
| Notificación de prueba | Visible en la barra: `pkg=com.carlos.profasist`, id 5557 |
| Canal | `profasist_reminders_v2`, importance 4, sonido del sistema |
| Alarmas exactas | La app muestra estado y abre `Settings$AlarmsAndRemindersAppActivity` |

## Notificaciones

- El botón **Permitir Notificaciones Nativas** solicita el permiso en tiempo de ejecución en Android 13+.
- El botón **Enviar Alerta de Prueba** dispara una notificación real; el mensaje de la app confirma el envío.
- Se añadió un panel específico de **alarmas exactas** con estado `Activo/Denegado/Pendiente` y acceso directo a los ajustes de Android.
- El canal heredado con `sound` inválido quedó reemplazado por `profasist_reminders_v2` con sonido predeterminado.

## Micrófono

| Verificación | Resultado |
|---|---|
| Permiso revocado y `Iniciar Grabación` | Diálogo nativo de Android |
| Permiso denegado | Modal propio **Permiso de micrófono** |
| Reintento denegado | Aparece **Abrir ajustes de la app** |
| Permiso concedido | Grabación inicia |
| Indicador activo | 5 barras animadas |
| Pausa | Botón `Pause`, barras en `paused` |
| Reanudar | Botón `Play`, barras en `running` |
| Detener | Botón `Square`, barras desaparecen |
| Cancelar | Botón `Trash2` |

El audio no se envía a ningún servidor; se guarda localmente.

## Build

| APK | Tamaño | SHA-256 |
|---|---:|---|
| `agent/app-agent.apk` | 3.9 MB | `42e3de246a80caa88fc373e77633b43ba06be78edec3cd4a5c3bbb469f929365` |
| `release/app-release-unsigned.apk` | 3.9 MB | `d417cd608ef9a90b2a193699b19b17dc3e0b82b22718f16f033cfeb7bf3b682e` |

- `agent` instalada en el Poco F5 con `adb install -r`; datos preservados.
- `release` continúa unsigned hasta configurar `PROFASIST_KEYSTORE_*`.
- La release normal no expone CDP.

## Pruebas automatizadas

- TypeScript: **54/54**.
- Python ADB: **11/11**.
- `npx tsc --noEmit`: sin errores.
- `npm run build`: correcto.

## Limitaciones

- La comodidad de las alarmas exactas depende de que el usuario conceda el acceso especial en Android 12+.
- No se probó el sonido audible en un entorno silenciado; se verificó que el canal usa `content://settings/system/notification_sound`.
- La validación visual se hizo en el Poco F5; conviene repetirla en tablet.
