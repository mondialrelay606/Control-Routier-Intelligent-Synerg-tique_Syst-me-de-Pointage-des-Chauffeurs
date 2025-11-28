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
    
    // Filter data (usually 'checkins' passed here are filtered by today or specific range in UI)
    const departures = checkins.filter(c => c.type === 'Départ Chauffeur');
    const returns = checkins.filter(c => c.type === 'Retour Tournée');
    
    // --- 1. DATA CALCULATION ---

    // Global KPIs
    const uniqueDrivers = new Set(checkins.map(c => c.driverId)).size;
    const totalTours = departures.length;
    const totalReturns = returns.length;
    const completionRate = totalTours > 0 ? Math.round((totalReturns / totalTours) * 100) : 0;

    // Incident Totals
    let totalSatSacs = 0, totalSatVracs = 0;
    let totalManqSacs = 0, totalManqVracs = 0;
    let totalRefusSacs = 0, totalRefusVracs = 0;
    let totalDevoyesSacs = 0, totalDevoyesVracs = 0;
    let totalClosed = 0;
    let totalReports = 0;

    const subStats: Record<string, any> = {};

    returns.forEach(c => {
        const sub = c.subcontractor || 'Non assigné';
        if (!subStats[sub]) {
            subStats[sub] = { tours: 0, reports: 0, incidents: 0, sat: 0, manq: 0, refus: 0, closed: 0 };
        }
        subStats[sub].tours++;

        const r = reports.find(rep => rep.checkinId === c.id);
        if (r) {
            totalReports++;
            subStats[sub].reports++;

            // Saturation
            r.saturationLockers.forEach(i => {
                totalSatSacs += (i.sacs || 0);
                totalSatVracs += (i.vracs || 0);
                subStats[sub].incidents++;
                subStats[sub].sat++;
            });

            // Manquants
            r.livraisonsManquantes.forEach(i => {
                totalManqSacs += (i.sacs || 0);
                totalManqVracs += (i.vracs || 0);
                subStats[sub].incidents++;
                subStats[sub].manq++;
            });

            // Refus
            if (r.refus) {
                r.refus.forEach(i => {
                    totalRefusSacs += (i.sacs || 0);
                    totalRefusVracs += (i.vracs || 0);
                    subStats[sub].incidents++;
                    subStats[sub].refus++;
                });
            }

            // Devoyés
            if (r.devoyes) {
                totalDevoyesSacs += (r.devoyes.sacs || 0);
                totalDevoyesVracs += (r.devoyes.vracs || 0);
                if ((r.devoyes.sacs || 0) + (r.devoyes.vracs || 0) > 0) subStats[sub].incidents++;
            }

            // Closed
            totalClosed += r.pudosApmFermes.length;
            subStats[sub].incidents += r.pudosApmFermes.length;
            subStats[sub].closed += r.pudosApmFermes.length;
        }
    });

    // Hourly Distribution
    const hourlyData: Record<number, { dep: number, ret: number }> = {};
    for(let i=0; i<24; i++) hourlyData[i] = { dep: 0, ret: 0 };
    
    checkins.forEach(c => {
        const h = new Date(c.timestamp).getHours();
        if (c.type === 'Départ Chauffeur') hourlyData[h].dep++;
        else hourlyData[h].ret++;
    });

    // --- 2. CONSTRUCTING THE DASHBOARD SHEET (Array of Arrays) ---
    
    const dashboard: any[][] = [];

    // Title Section
    dashboard.push(["RAPPORT D'ACTIVITÉ OPÉRATIONNELLE - CRIS"]);
    dashboard.push([`Généré le: ${new Date().toLocaleString('fr-FR')}`]);
    dashboard.push([""]); // Spacer

    // Section 1: KPIs Overview
    dashboard.push(["1. SYNTHÈSE DE L'ACTIVITÉ"]);
    dashboard.push(["Indicateur", "Valeur", "Description"]);
    dashboard.push(["Total Départs (Tournées)", totalTours, "Nombre total de chauffeurs partis."]);
    dashboard.push(["Total Retours", totalReturns, "Nombre de chauffeurs revenus au dépôt."]);
    dashboard.push(["Taux de Retour", `${completionRate}%`, "Proportion de tournées terminées."]);
    dashboard.push(["Chauffeurs Uniques", uniqueDrivers, "Nombre de personnes distinctes."]);
    dashboard.push(["Rapports d'Incidents", totalReports, "Nombre de retours avec incidents signalés."]);
    dashboard.push([""]);

    // Section 2: Incident Breakdown
    dashboard.push(["2. DÉTAIL DES INCIDENTS LOGISTIQUES"]);
    dashboard.push(["Catégorie", "Total Incidents", "Détail Volumétrique (Sacs / Vracs)"]);
    
    dashboard.push([
        "Saturations Lockers", 
        totalSatSacs + totalSatVracs, 
        `${totalSatSacs} Sacs / ${totalSatVracs} Vracs`
    ]);
    dashboard.push([
        "Livraisons Manquantes", 
        totalManqSacs + totalManqVracs, 
        `${totalManqSacs} Sacs / ${totalManqVracs} Vracs`
    ]);
    dashboard.push([
        "Refus PUDO/APM", 
        totalRefusSacs + totalRefusVracs, 
        `${totalRefusSacs} Sacs / ${totalRefusVracs} Vracs`
    ]);
    dashboard.push([
        "Colis Dévoyés", 
        totalDevoyesSacs + totalDevoyesVracs, 
        `${totalDevoyesSacs} Sacs / ${totalDevoyesVracs} Vracs`
    ]);
    dashboard.push([
        "Points Fermés (Panne/Sauvage)", 
        totalClosed, 
        "N/A"
    ]);
    dashboard.push([""]);

    // Section 3: Hourly Analysis
    dashboard.push(["3. DISTRIBUTION HORAIRE"]);
    dashboard.push(["Heure", "Flux Départs", "Flux Retours", "Activité Totale"]);
    Object.keys(hourlyData).forEach(h => {
        const hour = parseInt(h);
        if (hourlyData[hour].dep > 0 || hourlyData[hour].ret > 0) {
            dashboard.push([
                `${h}h00 - ${h}h59`,
                hourlyData[hour].dep,
                hourlyData[hour].ret,
                hourlyData[hour].dep + hourlyData[hour].ret
            ]);
        }
    });
    dashboard.push([""]);

    // Section 4: Subcontractor Performance
    dashboard.push(["4. PERFORMANCE PAR SOUS-TRAITANT"]);
    dashboard.push([
        "Sous-traitant", 
        "Tournées Effectuées", 
        "Saturations", 
        "Manquants", 
        "Refus", 
        "Fermetures", 
        "Total Incidents",
        "Moyenne Incidents/Tour"
    ]);

    const subRows = Object.keys(subStats).map(key => {
        const s = subStats[key];
        const avg = s.tours > 0 ? (s.incidents / s.tours).toFixed(2) : "0.00";
        return [
            key,
            s.tours,
            s.sat,
            s.manq,
            s.refus,
            s.closed,
            s.incidents,
            avg
        ];
    });

    // Sort by most incidents
    subRows.sort((a: any, b: any) => b[6] - a[6]);
    subRows.forEach(row => dashboard.push(row));

    // --- CREATE WORKBOOK ---

    const wb = XLSX.utils.book_new();

    // Sheet 1: Dashboard (AOA)
    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboard);
    
    // Styling Column Widths for Dashboard
    wsDashboard['!cols'] = [
        { wch: 35 }, // Label Column
        { wch: 20 }, // Value Column
        { wch: 35 }, // Description/Detail Column
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 20 }
    ];

    // Sheet 2: Raw Data
    const flatData = returns.map(c => {
        const report = reports.find(r => r.checkinId === c.id);
        return {
            'Date': new Date(c.timestamp).toLocaleDateString('fr-FR'),
            'Heure': new Date(c.timestamp).toLocaleTimeString('fr-FR'),
            'Chauffeur': c.driverName,
            'Sous-traitant': c.subcontractor,
            'Tournée': c.tour,
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
    const wsData = XLSX.utils.json_to_sheet(flatData);

    // Sheet 3: Detailed Incidents
    const incidentRows: any[] = [];
    reports.forEach(r => {
        // Ensure report belongs to the filtered dataset (e.g. today)
        const relatedCheckin = returns.find(rc => rc.id === r.checkinId);
        if (!relatedCheckin) return;

        const baseInfo = {
            'Chauffeur': relatedCheckin.driverName,
            'Tournée': relatedCheckin.tour,
            'Sous-traitant': relatedCheckin.subcontractor,
            'Heure Retour': new Date(relatedCheckin.timestamp).toLocaleTimeString('fr-FR')
        };

        r.saturationLockers.forEach(item => {
            incidentRows.push({ ...baseInfo, Catégorie: 'SATURATION', Lieu: item.lockerName, Détail: `Sacs: ${item.sacs}, Vracs: ${item.vracs}${item.isReplacement ? ' (Remplacement effectué)' : ''}` });
        });
        r.livraisonsManquantes.forEach(item => {
            incidentRows.push({ ...baseInfo, Catégorie: 'MANQUANT', Lieu: item.pudoApmName, Détail: `Sacs: ${item.sacs}, Vracs: ${item.vracs}` });
        });
        if (r.refus) {
            r.refus.forEach(item => {
                incidentRows.push({ ...baseInfo, Catégorie: 'REFUS', Lieu: item.pudoApmName, Détail: `Sacs: ${item.sacs}, Vracs: ${item.vracs}` });
            });
        }
        r.pudosApmFermes.forEach(item => {
            incidentRows.push({ ...baseInfo, Catégorie: 'FERMETURE', Lieu: item.pudoApmName, Détail: item.reason });
        });
        if (r.devoyes && (r.devoyes.sacs > 0 || r.devoyes.vracs > 0)) {
             incidentRows.push({ ...baseInfo, Catégorie: 'DÉVOYÉS', Lieu: 'Global Tournée', Détail: `Sacs: ${r.devoyes.sacs}, Vracs: ${r.devoyes.vracs}` });
        }
    });
    const wsIncidents = XLSX.utils.json_to_sheet(incidentRows);

    // Append Sheets
    XLSX.utils.book_append_sheet(wb, wsDashboard, "Tableau de Bord");
    XLSX.utils.book_append_sheet(wb, wsData, "Données Brutes");
    XLSX.utils.book_append_sheet(wb, wsIncidents, "Détail Incidents");
    
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Rapport_CRIS_Complet_${new Date().toISOString().slice(0,10)}.xlsx`);
};