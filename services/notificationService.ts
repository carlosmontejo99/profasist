// Native Local Notifications & Web Notifications Service for ProfAsist
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';

export interface NotificationStatus {
  supported: boolean;
  granted: boolean;
  isNative: boolean;
}

class NotificationService {
  private isNative: boolean;

  constructor() {
    this.isNative = Capacitor.isNativePlatform();
    if (this.isNative) {
      this.initNativeChannels();
    }
  }

  /**
   * Initializes notification channels for Android 8+
   */
  private async initNativeChannels() {
    if (!this.isNative) return;
    try {
      await LocalNotifications.createChannel({
        id: 'profasist_reminders',
        name: 'Recordatorios de Clases',
        description: 'Alertas automáticas al inicio o previo a tus clases programadas',
        importance: 4, // High importance
        visibility: 1,  // Public on lockscreen
        sound: 'res://raw/notification',
        vibration: true
      });
    } catch (e) {
      console.warn('Could not create notification channel:', e);
    }
  }

  /**
   * Check current notification permissions status
   */
  public async getStatus(): Promise<NotificationStatus> {
    if (this.isNative) {
      try {
        const perm = await LocalNotifications.checkPermissions();
        const webGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        return {
          supported: true,
          granted: perm.display === 'granted' || webGranted,
          isNative: true
        };
      } catch (e) {
        const webGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
        return { supported: true, granted: webGranted, isNative: true };
      }
    } else {
      const supported = typeof Notification !== 'undefined';
      const granted = supported && Notification.permission === 'granted';
      return { supported, granted, isNative: false };
    }
  }

  /**
   * Request notification permission from user
   */
  public async requestPermissions(): Promise<boolean> {
    if (this.isNative) {
      try {
        const req = await LocalNotifications.requestPermissions();
        await this.initNativeChannels();
        const status = await this.getStatus();
        return status.granted;
      } catch (e) {
        console.error('Error requesting native notification permissions:', e);
        if (typeof Notification !== 'undefined') {
          const res = await Notification.requestPermission();
          return res === 'granted';
        }
        return false;
      }
    } else {
      if (typeof Notification === 'undefined') return false;
      const result = await Notification.requestPermission();
      return result === 'granted';
    }
  }

  /**
   * Send an immediate test notification
   */
  public async sendTestNotification(): Promise<boolean> {
    const status = await this.getStatus();
    if (!status.granted) {
      const granted = await this.requestPermissions();
      if (!granted) return false;
    }

    if (this.isNative) {
      try {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: 'ProfAsist: Alerta de Prueba',
              body: '¡Notificaciones nativas en Android funcionando correctamente! 🔔',
              id: Math.floor(Math.random() * 10000) + 1,
              schedule: { at: new Date(Date.now() + 1000) }, // 1 second in future
              channelId: 'profasist_reminders',
              actionTypeId: '',
              extra: { test: true }
            }
          ]
        });
        return true;
      } catch (e) {
        console.error('Error sending native test notification:', e);
        return false;
      }
    } else {
      try {
        const n = new Notification('ProfAsist: Alerta de Prueba', {
          body: '¡Notificaciones locales en navegador listas! 🔔',
          requireInteraction: true
        });
        n.onclick = () => window.focus();
        return true;
      } catch (e) {
        console.error('Error sending web notification:', e);
        return false;
      }
    }
  }

  /**
   * Parse scheduleSummary strings (e.g. "Lun y Mie 10:00 - 12:00" or "Mar 09:30")
   * to find hour and minute targets.
   */
  private parseScheduleTime(scheduleSummary: string): { hour: number; minute: number; days: number[] } | null {
    if (!scheduleSummary) return null;
    const lower = scheduleSummary.toLowerCase();
    
    // Day detection
    const days: number[] = [];
    if (lower.includes('lun') || lower.includes('mon')) days.push(1);
    if (lower.includes('mar') || lower.includes('tue')) days.push(2);
    if (lower.includes('mie') || lower.includes('wed')) days.push(3);
    if (lower.includes('jue') || lower.includes('thu')) days.push(4);
    if (lower.includes('vie') || lower.includes('fri')) days.push(5);
    if (lower.includes('sab') || lower.includes('sat')) days.push(6);
    if (lower.includes('dom') || lower.includes('sun')) days.push(0);

    // Time detection: matches HH:MM
    const timeMatch = lower.match(/(\d{1,2}):(\d{2})/);
    if (!timeMatch) return null;

    const hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);

    return { hour, minute, days: days.length > 0 ? days : [1, 2, 3, 4, 5] };
  }

  /**
   * Schedule recurring local notification reminders for groups with schedule summaries
   */
  public async scheduleGroupReminders(groups: Array<{ id: string; name: string; scheduleSummary?: string; archived?: boolean }>): Promise<void> {
    const status = await this.getStatus();
    if (!status.granted) return;

    if (this.isNative) {
      try {
        // Pending notifications cancel
        await this.cancelAll();

        const notifications: any[] = [];
        let notifId = 100;

        for (const group of groups) {
          if (group.archived || !group.scheduleSummary) continue;
          const parsed = this.parseScheduleTime(group.scheduleSummary);
          if (!parsed) continue;

          for (const day of parsed.days) {
            notifId++;
            notifications.push({
              title: `ProfAsist: Clase ${group.name}`,
              body: `Es hora del pase de lista en ${group.name} (${group.scheduleSummary}).`,
              id: notifId,
              schedule: {
                on: {
                  weekday: day === 0 ? 7 : day, // Capacitor uses 1=Sun, 2=Mon... 7=Sat
                  hour: parsed.hour,
                  minute: parsed.minute
                },
                repeats: true,
                allowWhileIdle: true
              },
              channelId: 'profasist_reminders',
              extra: { groupId: group.id }
            });
          }
        }

        if (notifications.length > 0) {
          await LocalNotifications.schedule({ notifications });
          console.log(`[NotificationService] Scheduled ${notifications.length} native reminders.`);
        }
      } catch (e) {
        console.error('Error scheduling native group reminders:', e);
      }
    }
  }

  /**
   * Cancel all scheduled local notifications
   */
  public async cancelAll(): Promise<void> {
    if (this.isNative) {
      try {
        const pending = await LocalNotifications.getPending();
        if (pending.notifications.length > 0) {
          await LocalNotifications.cancel(pending);
        }
      } catch (e) {
        console.warn('Error cancelling pending notifications:', e);
      }
    }
  }
}

export const NotificationServ = new NotificationService();
