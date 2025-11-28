export interface Driver {
  id: string;
  name: string;
  subcontractor: string;
  plate: string;
  tour: string;
  telephone: string;
}

export type CheckinType = 'Départ Chauffeur' | 'Retour Tournée';

export interface CheckinRecord {
  id: string; // Unique ID for the record
  driverId: string;
  driverName: string;
  subcontractor: string;
  tour: string;
  timestamp: string; // ISO string
  type: CheckinType;
  hasUniform?: boolean; // Only for Departure
  driverReportedIssues?: boolean; // New: Driver flagged an issue at kiosk
  driverIncidentDetails?: string; // New: Specific details from driver
  departureComment?: string;
}

// Sub-interfaces for Return Reports
export interface SaturationItem {
  lockerName: string;
  sacs: number;
  vracs: number;
  isReplacement?: boolean; // New: Checkbox for replacement
}

export interface MissingItem {
  pudoApmName: string;
  sacs: number;
  vracs: number;
}

export interface RefusItem {
  pudoApmName: string;
  sacs: number;
  vracs: number;
}

export interface ClosedItem {
  pudoApmName: string;
  reason: 'Fermeture sauvage' | 'Panne';
}

export interface ReturnReport {
  id: string;
  checkinId: string; // Links to the 'Retour Tournée' record
  tamponDuRelais: boolean;
  horaireDePassageLocker: boolean;
  saturationLockers: SaturationItem[];
  livraisonsManquantes: MissingItem[];
  pudosApmFermes: ClosedItem[];
  refus: RefusItem[]; // New: Refus par PUDO
  devoyes: { sacs: number; vracs: number }; // New: Dévoyés global count
  notes: string;
}

export interface DashboardStats {
  totalPointages: number;
  uniqueDrivers: number;
  pendingReturns: number;
}

export interface NotificationSettings {
  masterEnabled: boolean;
  enableDelayAlerts: boolean;
  delayThresholdHours: number;
  enableIncidentAlerts: boolean;
}