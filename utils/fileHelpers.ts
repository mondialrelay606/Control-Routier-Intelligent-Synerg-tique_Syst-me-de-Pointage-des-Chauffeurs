import * as XLSX from 'xlsx';
import saveAs from 'file-saver';
import { CheckinRecord, Driver, ReturnReport } from '../types';
import { getDrivers, getReports } from '../services/dataService';

// --- Excel Import Helper ---
export const parseDriverExcel = (file: File): Promise<Driver[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        // Assume data is in the first sheet
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
        
        const drivers: Driver[] = jsonData.map((row: any) => {
            // Flexible column mapping to handle variations in headers
            return {
                name: row['Nom'] || row['nom'] || row['Name'] || '',
                subcontractor: row['Sous-traitant'] || row['sous-traitant'] || row['Subcontractor'] || '',
                plate: row['Plaque'] || row['plaque'] || row['Plate'] || '',
                tour: row['Tournée'] || row['Tournee'] || row['tournee'] || row['Tour'] || '',
                // Ensure ID is a string and handle common column names for ID
                id: String(row['Identifiant'] || row['ID'] || row['id'] || row['Matricule'] || '').trim(),
                telephone: row['Telephone'] || row['Téléphone'] || row['telephone'] || ''
            };
        }).filter(d => d.id && d.name); // Filter out empty or invalid rows

        resolve(drivers);
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsArrayBuffer(file);
  });
};

// --- Excel Helpers ---

export const exportCheckinsToExcel = (checkins: CheckinRecord[], customFileName?: string) => {
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
  
  const fileName = customFileName || `Pointages_${new Date().toISOString().slice(0,10)}.xlsx`;
  saveAs(new Blob([wbout], { type: 'application/octet-stream' }), fileName);
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
    
    // Uniform Compliance
    const uniformOk = departures.filter(d => d.hasUniform).length;
    const uniformRate = totalTours > 0 ? Math.round((uniformOk / totalTours) * 100) : 0;

    // Duration Calculation & Top Drivers Logic
    let totalDurationMinutes = 0;
    let completedDurations = 0;
    const driverStats: Record<string, { name: string, sub: string, incidents: number }> = {};

    returns.forEach(ret => {
        // Match with departure
        const dep = departures.find(d => 
            d.driverId === ret.driverId && 
            new Date(d.timestamp) < new Date(ret.timestamp)
        );

        if (dep) {
            const diffMs = new Date(ret.timestamp).getTime() - new Date(dep.timestamp).getTime();
            const diffMins = Math.floor(diffMs / 60000);
            // Ignore outliers (> 24h or negative)
            if (diffMins > 0 && diffMins < 1440) {
                totalDurationMinutes += diffMins;
                completedDurations++;
            }
        }
        
        // Count incidents per driver
        const r = reports.find(rep => rep.checkinId === ret.id);
        if (r) {
            let count = r.saturationLockers.length + r.livraisonsManquantes.length + r.pudosApmFermes.length + (r.refus?.length || 0);
            if(r.devoyes && (r.devoyes.sacs > 0 || r.devoyes.vracs > 0)) count++;
            
            if (count > 0) {
                if (!driverStats[ret.driverId]) {
                    driverStats[ret.driverId] = { name: ret.driverName, sub: ret.subcontractor, incidents: 0 };
                }
                driverStats[ret.driverId].incidents += count;
            }
        }
    });

    const avgDuration = completedDurations > 0 ? Math.floor(totalDurationMinutes / completedDurations) : 0;
    const avgDurationStr = `${Math.floor(avgDuration / 60)}h ${avgDuration % 60}m`;

    // Top 3 Drivers with incidents
    const topOffenders = Object.values(driverStats)
        .sort((a, b) => b.incidents - a.incidents)
        .slice(0, 3);

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

    // --- CREATE WORKBOOK ---
    const wb = XLSX.utils.book_new();

    // 1. DASHBOARD SHEET
    const dashboard: any[][] = [];
    dashboard.push(["RAPPORT DE CONTRÔLE LOGISTIQUE - CRIS"]);
    dashboard.push([`Date du rapport: ${new Date().toLocaleDateString('fr-FR')}`]);
    dashboard.push([""]); 

    dashboard.push(["1. PERFORMANCE OPÉRATIONNELLE"]);
    dashboard.push(["Indicateur", "Valeur", "Objectif / Description"]);
    dashboard.push(["Taux de Retour", `${completionRate}%`, "Objectif: 100%"]);
    dashboard.push(["Conformité Tenue", `${uniformRate}%`, "Port du gilet/chaussures au départ"]);
    dashboard.push(["Durée Moyenne Tournée", avgDurationStr, "Temps moyen Départ-Retour"]);
    dashboard.push(["Rapports d'Incidents", totalReports, `Sur ${totalReturns} retours effectués`]);
    dashboard.push([""]);

    dashboard.push(["2. ANALYSE VOLUMÉTRIQUE DES INCIDENTS"]);
    dashboard.push(["Catégorie", "Total", "Détail (Sacs / Vracs)"]);
    dashboard.push(["Saturations", totalSatSacs + totalSatVracs, `${totalSatSacs} Sacs / ${totalSatVracs} Vracs`]);
    dashboard.push(["Manquants", totalManqSacs + totalManqVracs, `${totalManqSacs} Sacs / ${totalManqVracs} Vracs`]);
    dashboard.push(["Refus", totalRefusSacs + totalRefusVracs, `${totalRefusSacs} Sacs / ${totalRefusVracs} Vracs`]);
    dashboard.push(["Dévoyés", totalDevoyesSacs + totalDevoyesVracs, `${totalDevoyesSacs} Sacs / ${totalDevoyesVracs} Vracs`]);
    dashboard.push(["Fermetures", totalClosed, "Magasins ou Lockers fermés"]);
    dashboard.push([""]);

    dashboard.push(["3. FLOP 3 CHAUFFEURS (Plus d'incidents)"]);
    dashboard.push(["Nom", "Sous-traitant", "Nombre d'Incidents"]);
    topOffenders.forEach(d => {
        dashboard.push([d.name, d.sub, d.incidents]);
    });
    if (topOffenders.length === 0) dashboard.push(["Aucun incident majeur", "-", "-"]);
    dashboard.push([""]);

    dashboard.push(["4. CLASSEMENT SOUS-TRAITANTS"]);
    dashboard.push([
        "Sous-traitant", "Tournées", "Incidents Totaux", "Moyenne/Tour", "Saturations", "Manquants"
    ]);

    const subRows = Object.keys(subStats).map(key => {
        const s = subStats[key];
        const avg = s.tours > 0 ? (s.incidents / s.tours).toFixed(2) : "0.00";
        return [key, s.tours, s.incidents, avg, s.sat, s.manq];
    });
    subRows.sort((a: any, b: any) => b[2] - a[2]); 
    subRows.forEach(row => dashboard.push(row));

    const wsDashboard = XLSX.utils.aoa_to_sheet(dashboard);
    wsDashboard['!cols'] = [{ wch: 35 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsDashboard, "Tableau de Bord");

    // 2. DETAILED INCIDENTS SHEET (Restored)
    const allIncidents: any[] = [];
    returns.forEach(c => {
        const r = reports.find(rep => rep.checkinId === c.id);
        if (!r) return;

        const baseRow = {
            'Date': new Date(c.timestamp).toLocaleDateString('fr-FR'),
            'Chauffeur': c.driverName,
            'Sous-traitant': c.subcontractor,
            'Tournée': c.tour
        };

        r.saturationLockers.forEach(i => {
            allIncidents.push({ ...baseRow, 'Type': 'SATURATION', 'Lieu': i.lockerName, 'Détail': `${i.sacs} S / ${i.vracs} V ${i.isReplacement ? '(Rempl.)' : ''}` });
        });
        r.livraisonsManquantes.forEach(i => {
            allIncidents.push({ ...baseRow, 'Type': 'MANQUANT', 'Lieu': i.pudoApmName, 'Détail': `${i.sacs} S / ${i.vracs} V` });
        });
        r.refus?.forEach(i => {
            allIncidents.push({ ...baseRow, 'Type': 'REFUS', 'Lieu': i.pudoApmName, 'Détail': `${i.sacs} S / ${i.vracs} V` });
        });
        r.pudosApmFermes.forEach(i => {
            allIncidents.push({ ...baseRow, 'Type': 'FERMETURE', 'Lieu': i.pudoApmName, 'Détail': i.reason });
        });
        if (r.devoyes && (r.devoyes.sacs > 0 || r.devoyes.vracs > 0)) {
            allIncidents.push({ ...baseRow, 'Type': 'DÉVOYÉS', 'Lieu': 'Global', 'Détail': `${r.devoyes.sacs} S / ${r.devoyes.vracs} V` });
        }
    });

    if (allIncidents.length > 0) {
        const wsIncidents = XLSX.utils.json_to_sheet(allIncidents);
        wsIncidents['!cols'] = [{ wch: 12 }, { wch: 25 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 25 }, { wch: 25 }];
        XLSX.utils.book_append_sheet(wb, wsIncidents, "Détail Incidents");
    } else {
        // Create empty sheet structure if no incidents
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Aucun incident à signaler"]]), "Détail Incidents");
    }

    // 3. SUBCONTRACTOR SHEETS
    const allSubs = Array.from(new Set(checkins.map(c => c.subcontractor).filter(s => s && s !== '')));
    allSubs.forEach(sub => {
        const subSheet: any[][] = [];
        subSheet.push([`RAPPORT DÉTAILLÉ: ${sub.toUpperCase()}`]);
        subSheet.push([`Date: ${new Date().toLocaleDateString('fr-FR')}`]);
        subSheet.push([""]);

        const sStats = subStats[sub] || { tours: 0, incidents: 0 };
        subSheet.push(["Tournées du jour", sStats.tours]);
        subSheet.push(["Incidents signalés", sStats.incidents]);
        subSheet.push([""]);

        subSheet.push(["LISTE DES CHAUFFEURS"]);
        subSheet.push(["Chauffeur", "Tournée", "Départ", "Retour", "Durée", "Statut"]);
        
        const subReturns = returns.filter(r => r.subcontractor === sub);
        const subDepartures = departures.filter(d => d.subcontractor === sub);
        const subDrivers = new Set([...subReturns.map(r => r.driverId), ...subDepartures.map(d => d.driverId)]);

        subDrivers.forEach(did => {
            const dep = subDepartures.find(d => d.driverId === did);
            const ret = subReturns.find(r => r.driverId === did);
            const driverName = dep?.driverName || ret?.driverName || 'Inconnu';
            const tourName = dep?.tour || ret?.tour || '?';
            
            let durationStr = "-";
            if (dep && ret) {
                 const diffMs = new Date(ret.timestamp).getTime() - new Date(dep.timestamp).getTime();
                 const h = Math.floor(diffMs / 3600000);
                 const m = Math.floor((diffMs % 3600000) / 60000);
                 durationStr = `${h}h ${m}m`;
            }

            let status = "OK";
            if (dep && !ret) status = "EN COURS";
            if (!dep && ret) status = "RETOUR SANS DEPART";

            subSheet.push([
                driverName,
                tourName,
                dep ? new Date(dep.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '-',
                ret ? new Date(ret.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'}) : '-',
                durationStr,
                status
            ]);
        });
        subSheet.push([""]);

        subSheet.push(["DÉTAIL DES ANOMALIES (Pour action)"]);
        subSheet.push(["Chauffeur", "Type", "Lieu / Locker", "Détails (Sacs/Vracs)"]);
        
        let hasAnomalies = false;
        subReturns.forEach(ret => {
            const r = reports.find(rep => rep.checkinId === ret.id);
            if (r) {
                 r.saturationLockers.forEach(i => {
                    subSheet.push([ret.driverName, "SATURATION", i.lockerName, `${i.sacs} S / ${i.vracs} V ${i.isReplacement ? '(Rempl.)' : ''}`]);
                    hasAnomalies = true;
                 });
                 r.livraisonsManquantes.forEach(i => {
                    subSheet.push([ret.driverName, "MANQUANT", i.pudoApmName, `${i.sacs} S / ${i.vracs} V`]);
                    hasAnomalies = true;
                 });
                 r.refus?.forEach(i => {
                    subSheet.push([ret.driverName, "REFUS", i.pudoApmName, `${i.sacs} S / ${i.vracs} V`]);
                    hasAnomalies = true;
                 });
                 r.pudosApmFermes.forEach(i => {
                    subSheet.push([ret.driverName, "FERMETURE", i.pudoApmName, i.reason]);
                    hasAnomalies = true;
                 });
                 if (r.devoyes && (r.devoyes.sacs > 0 || r.devoyes.vracs > 0)) {
                    subSheet.push([ret.driverName, "DÉVOYÉS", "Global", `${r.devoyes.sacs} S / ${r.devoyes.vracs} V`]);
                    hasAnomalies = true;
                 }
            }
        });

        if(!hasAnomalies) subSheet.push(["Aucune anomalie signalée.", "", "", ""]);

        const wsSub = XLSX.utils.aoa_to_sheet(subSheet);
        wsSub['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 15 }];
        const safeName = sub.replace(/[*?\/\[\]]/g, '');
        XLSX.utils.book_append_sheet(wb, wsSub, `Rap_${safeName.slice(0, 20)}`);
    });

    // 4. RAW DATA SHEET
    const flatData = returns.map(c => {
        const report = reports.find(r => r.checkinId === c.id);
        return {
            'Date': new Date(c.timestamp).toLocaleDateString('fr-FR'),
            'Heure': new Date(c.timestamp).toLocaleTimeString('fr-FR'),
            'Chauffeur': c.driverName,
            'Sous-traitant': c.subcontractor,
            'Tournée': c.tour,
            'Nb Saturation': report?.saturationLockers.length || 0,
            'Nb Manquants': report?.livraisonsManquantes.length || 0,
            'Nb Refus': report?.refus ? report.refus.length : 0,
            'Notes': report?.notes || ''
        };
    });
    const wsData = XLSX.utils.json_to_sheet(flatData);
    XLSX.utils.book_append_sheet(wb, wsData, "Données Brutes");

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbout], { type: 'application/octet-stream' }), `Rapport_CRIS_Complet_${new Date().toISOString().slice(0,10)}.xlsx`);
};