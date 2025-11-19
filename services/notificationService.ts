import { getCheckins, getDrivers, getNotificationSettings } from './dataService';

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }
  return false;
};

export const sendLocalNotification = (title: string, body: string, tag?: string) => {
  if (!("Notification" in window)) return;

  const settings = getNotificationSettings();
  if (!settings.masterEnabled) return;
  
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: '/vite.svg', // Uses the default Vite icon, can be replaced with app logo
      tag, // Tag prevents duplicate notifications for the same event if needed
      requireInteraction: true, // Keeps notification active until user interacts
    });
  }
};

const NOTIFIED_DELAYS_KEY = 'spc_notified_delays';

export const checkDelaysAndNotify = () => {
  const settings = getNotificationSettings();
  
  // Exit if global switch or delay specific switch is off
  if (!settings.masterEnabled || !settings.enableDelayAlerts) return;

  const DELAY_THRESHOLD_HOURS = settings.delayThresholdHours || 12; // Fallback to 12 if undefined

  const checkins = getCheckins();
  const today = new Date().toDateString();
  const now = new Date();

  // Get list of IDs already notified today to avoid spam
  const notifiedRaw = sessionStorage.getItem(NOTIFIED_DELAYS_KEY);
  const notifiedIds = notifiedRaw ? JSON.parse(notifiedRaw) : [];
  const newNotifiedIds = [...notifiedIds];

  // Filter for today's departures
  const todayDepartures = checkins.filter(c => 
    c.type === 'Départ Chauffeur' && 
    new Date(c.timestamp).toDateString() === today
  );

  todayDepartures.forEach(dep => {
    // Check if they have returned
    const hasReturned = checkins.some(c => 
      c.driverId === dep.driverId && 
      c.type === 'Retour Tournée' && 
      new Date(c.timestamp) > new Date(dep.timestamp)
    );

    if (!hasReturned) {
      const departureTime = new Date(dep.timestamp);
      const hoursDiff = (now.getTime() - departureTime.getTime()) / (1000 * 60 * 60);

      if (hoursDiff > DELAY_THRESHOLD_HOURS && !notifiedIds.includes(dep.id)) {
        // Trigger Notification
        sendLocalNotification(
          `⏳ Retard Important Détecté`,
          `Le chauffeur ${dep.driverName} est sorti depuis plus de ${Math.floor(hoursDiff)} heures.`,
          `delay-${dep.id}`
        );
        
        newNotifiedIds.push(dep.id);
      }
    }
  });

  sessionStorage.setItem(NOTIFIED_DELAYS_KEY, JSON.stringify(newNotifiedIds));
};