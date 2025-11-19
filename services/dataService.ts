import { Driver, CheckinRecord, ReturnReport, CheckinType, NotificationSettings } from '../types';

const KEYS = {
  DRIVERS: 'spc_drivers',
  CHECKINS: 'spc_checkins',
  REPORTS: 'spc_reports',
  SETTINGS: 'spc_settings',
};

// --- Mock Data Initialization (Full List) ---
// IDs have been deduplicated to ensure React renders correctly and deletion works
const MOCK_DRIVERS: Driver[] = [
  { id: 'C132132', name: 'Karim Mekki', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)6.04.14.83.06' },
  { id: 'C068480', name: 'Mohammad Amin Rekan', subcontractor: 'BA', plate: '', tour: '9008', telephone: '+33(0)7.69.59.32.94' },
  { id: 'C166317', name: 'Sid ahmed', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)6.05.98.45.17' },
  { id: 'C178508', name: 'IDRISS Abdelkader', subcontractor: 'BA', plate: '', tour: '9004', telephone: '+33(0)6.04.14.42.18' },
  { id: 'C333554', name: 'SAID BARTOUTILE', subcontractor: 'BA', plate: '', tour: '9003', telephone: '+33(0)6.50.97.76.40' },
  { id: 'C416861', name: 'TAOURIT El-Amine', subcontractor: 'BA', plate: '', tour: '9007', telephone: '+33(0)6.04.09.42.33' },
  { id: 'C552108', name: 'Mustafa AL-SAADI', subcontractor: 'BA', plate: '', tour: '9006', telephone: '+33(0)7.58.90.30.36' },
  { id: 'C582682', name: 'Mohammed Benkrama', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)6.95.79.49.03' },
  { id: 'C552252', name: 'Ibrahim Riazi', subcontractor: 'BA', plate: '', tour: '9002', telephone: '+33(0)6.95.74.09.85' },
  { id: 'C643825', name: 'Mohammed Fawzi', subcontractor: 'BA', plate: '', tour: '9009', telephone: '+33(0)6.51.41.61.74' },
  { id: 'C711100', name: 'Nicolas Aoun', subcontractor: 'BA', plate: '', tour: '9001', telephone: '+33(0)6.74.66.32.12' },
  { id: 'C711176', name: 'Bloufa BENKRAMA', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)6.95.43.81.11' },
  { id: 'C735861', name: 'Chaoui Oussama', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)7.44.24.70.09' },
  { id: 'C903956', name: 'Ilyes Fathi', subcontractor: 'BA', plate: '', tour: '9005', telephone: '+33(0)7.82.13.32.45' },
  { id: 'C595424', name: 'Benichou ILIAS', subcontractor: 'BA', plate: '', tour: '9005', telephone: '+33(0)7.82.13.32.45' },
  { id: 'C273997', name: 'Maurice Mikaele', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)6.71.76.24.85' },
  { id: 'C821732', name: 'Naafi Furnadzhiev', subcontractor: 'BA', plate: '', tour: '', telephone: '+33(0)7.53.38.34.90' },
  { id: 'C950100', name: 'Lotfi Medallel', subcontractor: 'M&A', plate: '', tour: '5001', telephone: '+33(0)7.45.92.73.83' },
  { id: 'C708361', name: 'Isak Abraham', subcontractor: 'M&A', plate: '', tour: '5002', telephone: '+33(0)7.66.86.39.41' },
  { id: 'C103730', name: 'Yassine Lakhdar', subcontractor: 'M&A', plate: '', tour: '5003', telephone: '+33(0)6.59.32.57.45' },
  { id: 'C438291', name: 'DION HIBTIZGI', subcontractor: 'M&A', plate: '', tour: '5004', telephone: '+33(0)6.17.27.25.08' },
  { id: 'C776818', name: 'DJafar Mohammed', subcontractor: 'M&A', plate: '', tour: '5005', telephone: '+33(0)6.05.51.10.31' },
  { id: 'C841047', name: 'Alsadig MOHAMED', subcontractor: 'M&A', plate: '', tour: '5006', telephone: '' },
  { id: 'C429226', name: 'ahmed alkuraishi', subcontractor: 'M&A', plate: '', tour: '5004', telephone: '+33(0)7.68.79.25.00' },
  { id: 'C635924', name: 'Maan al khuzaee', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)6.42.00.65.02' },
  { id: 'C463722', name: 'Adam Mansour MohsenMR', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.49.35.93.97' },
  { id: 'C784486', name: 'Mondher Benglail', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.79.34.74.36' },
  { id: 'C660713', name: 'BAKHRI IDRISS', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.49.27.19.39' },
  { id: 'C453596', name: 'Mohamad Nasserdine', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)6.44.04.16.85' },
  { id: 'C467592', name: 'ALI ALLAHMED', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.86.02.05.29' },
  { id: 'C538202', name: 'Arsen Avahimian', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.49.81.76.03' },
  { id: 'C810342', name: 'Salim Amroune', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.45.69.15.99' },
  { id: 'C841352', name: 'mohamed lemrhari', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.59.78.96.63' },
  { id: 'C969240', name: 'issam HASSAN MOHAMMED HASSAN', subcontractor: 'M&A', plate: '', tour: '', telephone: '+33(0)7.68.69.60.33' },
  { id: 'C268094', name: 'Hacen Negaa', subcontractor: 'TM', plate: '', tour: '', telephone: '+33(0)6.24.14.11.24' },
  { id: 'C118995', name: 'Merakeb Merakeb', subcontractor: 'TM', plate: '', tour: '2002', telephone: '+33(0)7.82.61.16.22' },
  { id: 'C818669', name: 'mohammed babas', subcontractor: 'TM', plate: '', tour: '2001', telephone: '+33(0)6.52.07.93.47' },
  { id: 'C235123', name: 'Arisqui babas', subcontractor: 'Boue', plate: '', tour: '6003', telephone: '+33(0)6.10.65.79.89' },
  { id: 'C998756', name: 'Youssouf Camara', subcontractor: 'Boue', plate: '', tour: '6002', telephone: '+33(0)7.44.20.57.11' },
  { id: 'C092055', name: 'CAMARA MOUSTAPHA', subcontractor: 'Boue', plate: '', tour: '6001', telephone: '+33(0)7.51.23.16.84' },
  { id: 'C260226', name: 'Diallo Ibrahime', subcontractor: 'Boue', plate: '', tour: '6004', telephone: '+33(0)6.95.65.07.02' },
  { id: 'C325049', name: 'Yacine Yahia', subcontractor: 'Boue', plate: '', tour: '6001', telephone: '+33(0)6.17.67.59.68' },
  { id: 'C385647', name: 'Siham KACI', subcontractor: 'Boue', plate: '', tour: '', telephone: '+33(0)7.54.11.02.89' },
  { id: 'C531675', name: 'Kaci boualem', subcontractor: 'Boue', plate: '', tour: '', telephone: '+33(0)6.52.22.97.17' },
  { id: 'C172984', name: 'DJIR ABOUBAKAR', subcontractor: 'Boue', plate: '', tour: '', telephone: '+33(0)6.50.35.85.82' },
  { id: 'C419673', name: 'Ayoub loulichki', subcontractor: 'Boue', plate: '', tour: '', telephone: '+33(0)7.60.40.46.29' },
  { id: 'C819385', name: 'razik taibi', subcontractor: 'Boue', plate: '', tour: '', telephone: '+33(0)6.21.65.16.12' },
  { id: 'C281563', name: 'Mohamed KAHLA', subcontractor: 'KARR', plate: '', tour: '7999', telephone: '+33(0)7.51.38.39.59' },
  { id: 'C020697', name: 'Abdelali OUBIDA', subcontractor: 'KARR', plate: '', tour: '7004', telephone: '+33(0)7.84.56.46.81' },
  { id: 'C304476', name: 'Cyril Barbe', subcontractor: 'KARR', plate: '', tour: '7006', telephone: '+33(0)6.44.08.76.17' },
  { id: 'C294104', name: 'karim BELGACEM', subcontractor: 'KARR', plate: '', tour: '7005', telephone: '+33(0)7.80.80.54.81' },
  { id: 'C991824', name: 'Margaux Filali', subcontractor: 'KARR', plate: '', tour: '7003', telephone: '+33(0)6.20.38.50.31' },
  { id: 'C838770', name: 'Nour El karrat', subcontractor: 'KARR', plate: '', tour: '', telephone: '+33(0)6.27.38.87.98' },
  { id: 'C506975', name: 'Rahal Faycal', subcontractor: 'KARR', plate: '', tour: '', telephone: '+33(0)6.69.96.85.25' },
  { id: 'C082977', name: 'NASSIM LAURACH', subcontractor: 'PADO', plate: '', tour: '8003', telephone: '+33(0)6.51.19.17.11' },
  { id: 'C080653', name: 'Salim Bechikh', subcontractor: 'PADO', plate: '', tour: '8007', telephone: '+33(0)7.45.19.74.87' },
  { id: 'C417169', name: 'Rachid Moncif', subcontractor: 'PADO', plate: '', tour: '', telephone: '' },
  { id: 'C118423', name: 'HARIATE Abdel', subcontractor: 'PADO', plate: '', tour: '8005', telephone: '+33(0)7.80.28.49.63' },
  { id: 'C173203', name: 'MOMAN SECK', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)6.66.83.45.63' },
  { id: 'C189221', name: 'Abdelillah Fatri', subcontractor: 'PADO', plate: '', tour: '8002', telephone: '+33(0)6.41.11.94.95' },
  { id: 'C458997', name: 'GUEYE Momar', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)7.66.83.45.63' },
  { id: 'C651830', name: 'Mohammed El achaby', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)6.65.24.86.44' },
  { id: 'C898763', name: 'SOUFIANE BECHEIKH', subcontractor: 'PADO', plate: '', tour: '8004', telephone: '+33(0)6.95.60.66.90' },
  { id: 'C949253', name: 'AMID GHABOURI', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)7.58.64.35.45' },
  { id: 'C942414', name: 'Hicham Krad', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)7.80.61.86.69' },
  { id: 'C953340', name: 'Souleymane Sylla', subcontractor: 'PADO', plate: '', tour: '8001', telephone: '+33(0)6.51.23.08.81' },
  { id: 'C253285', name: 'Mohamed amarat', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)7.80.37.02.88' },
  { id: 'C376914', name: 'Abdelssalam chbiki', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)7.80.42.30.01' },
  { id: 'C426258', name: 'Otmane Bounsal', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)6.04.16.94.66' },
  { id: 'C976921', name: 'Adel Merabet', subcontractor: 'PADO', plate: '', tour: '', telephone: '+33(0)7.53.28.92.13' }
];

const initStorage = () => {
  const existingDriversStr = localStorage.getItem(KEYS.DRIVERS);
  
  // IDs to be removed from storage if present (legacy data cleanup)
  const BANNED_IDS = ['C841047_2', 'C294104_2'];

  if (!existingDriversStr) {
    localStorage.setItem(KEYS.DRIVERS, JSON.stringify(MOCK_DRIVERS));
  } else {
    // Robust duplicate and banned ID cleaning on load
    try {
        let drivers = JSON.parse(existingDriversStr) as Driver[];
        const seen = new Set();
        const cleanDrivers: Driver[] = [];
        let hasChanges = false;

        // Check if we need to remove banned IDs
        const initialLength = drivers.length;
        drivers = drivers.filter(d => !BANNED_IDS.includes(d.id));
        if (drivers.length !== initialLength) {
            hasChanges = true;
        }
        
        drivers.forEach(d => {
            const id = String(d.id).trim(); // Normalize ID
            if (!seen.has(id)) {
                seen.add(id);
                cleanDrivers.push({...d, id});
            } else {
                // If duplicate found, we just remove it
                hasChanges = true;
            }
        });
        
        if (hasChanges) {
             console.log('Cleaned duplicate or banned drivers from storage on init.');
             localStorage.setItem(KEYS.DRIVERS, JSON.stringify(cleanDrivers));
        }
    } catch (e) {
        console.error("Error cleaning drivers", e);
        localStorage.setItem(KEYS.DRIVERS, JSON.stringify(MOCK_DRIVERS));
    }
  }
  
  if (!localStorage.getItem(KEYS.CHECKINS)) {
    localStorage.setItem(KEYS.CHECKINS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.REPORTS)) {
    localStorage.setItem(KEYS.REPORTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(KEYS.SETTINGS)) {
      const defaultSettings: NotificationSettings = {
          masterEnabled: true,
          enableDelayAlerts: true,
          delayThresholdHours: 12,
          enableIncidentAlerts: true
      };
      localStorage.setItem(KEYS.SETTINGS, JSON.stringify(defaultSettings));
  }
};

initStorage();

// --- Drivers Service ---

export const getDrivers = (): Driver[] => {
  const data = localStorage.getItem(KEYS.DRIVERS);
  return data ? JSON.parse(data) : [];
};

export const saveDriver = (driver: Driver): void => {
  const drivers = getDrivers();
  const index = drivers.findIndex(d => d.id === driver.id);
  if (index >= 0) {
    drivers[index] = driver;
  } else {
    drivers.push(driver);
  }
  localStorage.setItem(KEYS.DRIVERS, JSON.stringify(drivers));
};

export const deleteDriver = (id: string): void => {
  const targetId = String(id).trim().toLowerCase();
  const currentDrivers = getDrivers();
  
  // Filter out the driver. Using trim/lowercase ensures loose matching against messy data.
  const filteredDrivers = currentDrivers.filter(d => String(d.id).trim().toLowerCase() !== targetId);
  
  localStorage.setItem(KEYS.DRIVERS, JSON.stringify(filteredDrivers));
};

export const importDrivers = (newDrivers: Driver[]): void => {
  localStorage.setItem(KEYS.DRIVERS, JSON.stringify(newDrivers));
};

// --- Checkin Service ---

export const getCheckins = (): CheckinRecord[] => {
  const data = localStorage.getItem(KEYS.CHECKINS);
  return data ? JSON.parse(data) : [];
};

export const addCheckin = (record: CheckinRecord): void => {
  const checkins = getCheckins();
  checkins.push(record);
  localStorage.setItem(KEYS.CHECKINS, JSON.stringify(checkins));
};

export const updateCheckinDepartureComment = (id: string, comment: string): void => {
    const checkins = getCheckins();
    const idx = checkins.findIndex(c => c.id === id);
    if (idx !== -1) {
        checkins[idx].departureComment = comment;
        localStorage.setItem(KEYS.CHECKINS, JSON.stringify(checkins));
    }
};

export const clearOldData = (): void => {
    const today = new Date().toDateString();
    const checkins = getCheckins().filter(c => new Date(c.timestamp).toDateString() === today);
    localStorage.setItem(KEYS.CHECKINS, JSON.stringify(checkins));
    
    // Also clean orphan reports
    const currentCheckinIds = new Set(checkins.map(c => c.id));
    const reports = getReports().filter(r => currentCheckinIds.has(r.checkinId));
    localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
};

// --- Reports Service ---

export const getReports = (): ReturnReport[] => {
  const data = localStorage.getItem(KEYS.REPORTS);
  return data ? JSON.parse(data) : [];
};

export const saveReport = (report: ReturnReport): void => {
  const reports = getReports();
  const index = reports.findIndex(r => r.checkinId === report.checkinId);
  if (index >= 0) {
    reports[index] = report;
  } else {
    reports.push(report);
  }
  localStorage.setItem(KEYS.REPORTS, JSON.stringify(reports));
};

// --- Settings Service ---

export const getNotificationSettings = (): NotificationSettings => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    if (data) return JSON.parse(data);
    return {
        masterEnabled: true,
        enableDelayAlerts: true,
        delayThresholdHours: 12,
        enableIncidentAlerts: true
    };
};

export const saveNotificationSettings = (settings: NotificationSettings): void => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
};

// --- Business Logic Helpers ---

export const validateScan = (driverId: string, type: CheckinType): { success: boolean; message: string; driver?: Driver } => {
  const drivers = getDrivers();
  // Robust ID matching
  const driver = drivers.find(d => String(d.id).trim().toLowerCase() === String(driverId).trim().toLowerCase());

  if (!driver) {
    return { success: false, message: 'Chauffeur non trouvé.' };
  }

  const today = new Date().toDateString();
  const checkins = getCheckins();
  const driverCheckinsToday = checkins.filter(c => 
    c.driverId === driver.id && 
    new Date(c.timestamp).toDateString() === today
  ).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const lastCheckin = driverCheckinsToday[driverCheckinsToday.length - 1];

  if (type === 'Départ Chauffeur') {
    // Cannot depart if already out (last record was departure)
    if (lastCheckin && lastCheckin.type === 'Départ Chauffeur') {
      return { success: false, message: 'Le chauffeur est déjà en tournée.', driver };
    }
  } else {
    // Cannot return if never left or already returned
    if (!lastCheckin || lastCheckin.type === 'Retour Tournée') {
      return { success: false, message: 'Aucun départ enregistré pour ce chauffeur aujourd\'hui.', driver };
    }
  }

  return { success: true, message: 'Scan valide.', driver };
};