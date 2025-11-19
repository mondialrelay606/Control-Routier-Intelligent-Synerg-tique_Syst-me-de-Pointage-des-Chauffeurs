import * as XLSX from 'xlsx';
import saveAs from 'file-saver';
import { CheckinRecord, Driver, ReturnReport } from '../types';
import { getDrivers, getReports } from '../services/dataService';

// --- CSV Helper ---
export const parseDriverCSV = (file: File): Promise<Driver[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n');
        const drivers: Driver[] = [];
        
        // Skip header if exists, assuming simple structure
        // Nom, Sous-traitant, Plaque, Tournée, Identifiant, Telephone
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',');
            if (cols.length >= 5) {
                drivers.push({
                    name: cols[0].trim(),
                    subcontractor: cols[1].trim(),
                    plate: cols[2].trim(),
                    tour: cols[3].trim(),
                    id: cols[4].trim(),
                    telephone: cols[5]?.trim() || ''
                });
            }
        }
        resolve(drivers);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};

// --- Excel Helpers ---

export const exportCheckinsToExcel = (checkins: CheckinRecord[]) => {
  const data = checkins.map(c => ({
    'Date': new Date(c.timestamp).toLocaleDateString('fr-FR'),
    'Heure': new Date(c.timestamp).toLocaleTimeString('fr-FR'),
    'Type': c.type,
    'Chauffeur': c.driverName,
    'ID': c.driverId,
    'Sous-traitant': c.subcontractor,
    'Tournée': c.tour,
    'Tenue': c.hasUniform ? 'Oui' : (c.type === 'Départ Chauffeur' ? 'Non' : ''),
    'Note': c.departureComment || ''
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pointages");
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Pointages_${new Date().toISOString().slice(0,10)}.xlsx`);
};

export const exportReportsToExcel = (checkins: CheckinRecord[]) => {
    const reports = getReports();
    const returnCheckins = checkins.filter(c => c.type === 'Retour Tournée');

    // Sheet 1: Raw Data
    const flatData = returnCheckins.map(c => {
        const report = reports.find(r => r.checkinId === c.id);
        return {
            'Date': new Date(c.timestamp).toLocaleDateString('fr-FR'),
            'Heure': new Date(c.timestamp).toLocaleTimeString('fr-FR'),
            'Chauffeur': c.driverName,
            'Sous-traitant': c.subcontractor,
            'Rapport Créé': report ? 'Oui' : 'Non',
            'Tampon Relais': report?.tamponDuRelais ? 'OK' : 'NOK',
            'Horaire Passage': report?.horaireDePassageLocker ? 'OK' : 'NOK',
            'Nb Saturation': report?.saturationLockers.length || 0,
            'Nb Manquants': report?.livraisonsManquantes.length || 0,
            'Nb Refus': report?.refus ? report.refus.length : 0,
            'Nb Dévoyés (Sacs)': report?.devoyes ? report.devoyes.sacs : 0,
            'Nb Dévoyés (Vracs)': report?.devoyes ? report.devoyes.vracs : 0,
            'Nb Fermés': report?.pudosApmFermes.length || 0,
            'Notes': report?.notes || ''
        };
    });

    // Sheet 2: Dashboard / Detailed Incidents
    const incidentRows: any[] = [];
    reports.forEach(r => {
        const relatedCheckin = checkins.find(c => c.id === r.checkinId);
        const baseInfo = {
            'Chauffeur': relatedCheckin?.driverName,
            'Date': relatedCheckin ? new Date(relatedCheckin.timestamp).toLocaleDateString('fr-FR') : '',
            'Sous-traitant': relatedCheckin?.subcontractor || ''
        };

        r.saturationLockers.forEach(item => {
            incidentRows.push({ ...baseInfo, Type: 'Saturation', Lieu: item.lockerName, Détail: `Sacs: ${item.sacs}, Vracs: ${item.vracs}` });
        });
        r.livraisonsManquantes.forEach(item => {
            incidentRows.push({ ...baseInfo, Type: 'Manquant', Lieu: item.pudoApmName, Détail: `Sacs: ${item.sacs}, Vracs: ${item.vracs}` });
        });
        if (r.refus) {
            r.refus.forEach(item => {
                incidentRows.push({ ...baseInfo, Type: 'Refus', Lieu: item.pudoApmName, Détail: `Sacs: ${item.sacs}, Vracs: ${item.vracs}` });
            });
        }
        if (r.devoyes && (r.devoyes.sacs > 0 || r.devoyes.vracs > 0)) {
             incidentRows.push({ ...baseInfo, Type: 'Dévoyés', Lieu: 'Tournée', Détail: `Sacs: ${r.devoyes.sacs}, Vracs: ${r.devoyes.vracs}` });
        }
        r.pudosApmFermes.forEach(item => {
            incidentRows.push({ ...baseInfo, Type: 'Fermé', Lieu: item.pudoApmName, Détail: item.reason });
        });
    });

    const wb = XLSX.utils.book_new();
    const ws1 = XLSX.utils.json_to_sheet(flatData);
    const ws2 = XLSX.utils.json_to_sheet(incidentRows);
    
    XLSX.utils.book_append_sheet(wb, ws1, "Synthèse");
    XLSX.utils.book_append_sheet(wb, ws2, "Détails Incidents");
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Rapports_Incidents_${new Date().toISOString().slice(0,10)}.xlsx`);
};