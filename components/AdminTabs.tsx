import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CheckinRecord, Driver, ReturnReport, SaturationItem, MissingItem, ClosedItem, RefusItem, NotificationSettings } from '../types';
import { getCheckins, getDrivers, getReports, saveDriver, deleteDriver, saveReport, updateCheckinDepartureComment, clearOldData, importDrivers, getNotificationSettings, saveNotificationSettings, updateCheckinTour, resetAllData } from '../services/dataService';
import { exportCheckinsToExcel, exportReportsToExcel, parseDriverExcel } from '../utils/fileHelpers';
import { requestNotificationPermission, sendLocalNotification } from '../services/notificationService';
import { Icons } from './Icons';

// --- Tab A: Statistics ---

export const StatsTab: React.FC = () => {
  const [checkins, setCheckins] = useState<CheckinRecord[]>(getCheckins());
  const [reports, setReports] = useState<ReturnReport[]>(getReports());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [allDrivers] = useState<Driver[]>(getDrivers()); // To lookup phones

  // Filter for today for KPIs
  const todayStr = new Date().toDateString();
  const todayCheckins = checkins.filter(c => new Date(c.timestamp).toDateString() === todayStr);
  
  // Calculate Pending Returns (Drivers currently out)
  const latestCheckinsByDriver = new Map<string, CheckinRecord>();
  todayCheckins.forEach(c => {
      const current = latestCheckinsByDriver.get(c.driverId);
      if (!current || new Date(c.timestamp) > new Date(current.timestamp)) {
          latestCheckinsByDriver.set(c.driverId, c);
      }
  });

  const pendingReturns = Array.from(latestCheckinsByDriver.values())
      .filter(c => c.type === 'Départ Chauffeur')
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  const uniqueDrivers = new Set(todayCheckins.map(c => c.driverId)).size;

  // Chart Data: Hourly
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    departs: 0,
    retours: 0
  }));

  todayCheckins.forEach(c => {
    const h = new Date(c.timestamp).getHours();
    if (c.type === 'Départ Chauffeur') hourlyData[h].departs++;
    else hourlyData[h].retours++;
  });

  // Chart Data: Incident Types
  const incidentData = reports.reduce((acc: any[], r) => {
    const sub = checkins.find(c => c.id === r.checkinId)?.subcontractor || 'Inconnu';
    const existing = acc.find(a => a.name === sub);
    const sat = r.saturationLockers.length;
    const mis = r.livraisonsManquantes.length;
    const clo = r.pudosApmFermes.length;
    const ref = (r.refus || []).length;

    if (existing) {
      existing.saturation += sat;
      existing.manquant += mis;
      existing.ferme += clo;
      existing.refus += ref;
    } else {
      acc.push({ name: sub, saturation: sat, manquant: mis, ferme: clo, refus: ref });
    }
    return acc;
  }, []);

  // Handling comment edit
  const startEdit = (c: CheckinRecord) => {
    setEditingId(c.id);
    setEditComment(c.departureComment || '');
  };
  const saveEdit = (id: string) => {
    updateCheckinDepartureComment(id, editComment);
    setCheckins(getCheckins());
    setEditingId(null);
  };

  const handleClean = () => {
      if(confirm("Voulez-vous vraiment supprimer l'historique (sauf aujourd'hui) ?")) {
          clearOldData();
          setCheckins(getCheckins());
          setReports(getReports());
      }
  };

  const handleExportYesterday = () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    const yesterdayCheckins = checkins.filter(c => 
        new Date(c.timestamp).toDateString() === yesterdayStr
    );

    if (yesterdayCheckins.length === 0) {
        alert("Aucune donnée trouvée pour la journée d'hier.");
        return;
    }

    exportCheckinsToExcel(yesterdayCheckins, `Pointages_Hier_${yesterday.toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-8">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-brand-primary">
          <h3 className="text-gray-500 text-sm">Total Pointages (Auj.)</h3>
          <p className="text-3xl font-bold text-brand-primary">{todayCheckins.length}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-brand-secondary">
          <h3 className="text-gray-500 text-sm">Chauffeurs Uniques</h3>
          <p className="text-3xl font-bold text-brand-secondary">{uniqueDrivers}</p>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border-l-4 border-brand-yellow">
          <h3 className="text-gray-500 text-sm">En Attente de Retour</h3>
          <p className="text-3xl font-bold text-brand-yellow">{pendingReturns.length}</p>
        </div>
      </div>

      {/* PENDING RETURNS LIST */}
      {pendingReturns.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden border border-brand-yellow">
            <div className="bg-yellow-50 px-4 py-3 border-b border-yellow-100 flex justify-between items-center">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <Icons.Clock className="w-5 h-5 text-brand-yellow" />
                    Tours en cours (Non retournés)
                </h3>
                <span className="text-xs font-bold bg-brand-yellow text-white px-2 py-1 rounded-full shadow-sm">
                    {pendingReturns.length} en cours
                </span>
            </div>
            <div className="overflow-x-auto max-h-64">
                <table className="w-full text-sm text-left">
                    <thead className="bg-white text-gray-600 border-b">
                        <tr>
                            <th className="px-4 py-2">Heure Départ</th>
                            <th className="px-4 py-2">Chauffeur</th>
                            <th className="px-4 py-2">Tournée</th>
                            <th className="px-4 py-2">Sous-traitant</th>
                            <th className="px-4 py-2">Contact</th>
                            <th className="px-4 py-2">Durée</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {pendingReturns.map(c => {
                            const driver = allDrivers.find(d => d.id === c.driverId);
                            const durationMs = new Date().getTime() - new Date(c.timestamp).getTime();
                            const hours = Math.floor(durationMs / (1000 * 60 * 60));
                            const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
                            
                            return (
                                <tr key={c.id} className="hover:bg-yellow-50/30">
                                    <td className="px-4 py-2 font-mono text-gray-600">
                                        {new Date(c.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
                                    </td>
                                    <td className="px-4 py-2 font-medium text-gray-800">{c.driverName}</td>
                                    <td className="px-4 py-2 text-gray-600">{c.tour}</td>
                                    <td className="px-4 py-2 text-gray-600">{c.subcontractor}</td>
                                    <td className="px-4 py-2">
                                        {driver?.telephone ? (
                                            <a href={`tel:${driver.telephone}`} className="text-brand-secondary hover:text-brand-primary hover:underline flex items-center gap-1 font-medium">
                                                📞 {driver.telephone}
                                            </a>
                                        ) : <span className="text-gray-300 italic">Non renseigné</span>}
                                    </td>
                                    <td className="px-4 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${hours >= 8 ? 'bg-red-100 text-red-600' : hours >= 5 ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                                            {hours}h {minutes}m
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-bold text-gray-700 mb-4">Distribution Horaire</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="departs" name="Départs" fill="#9c0058" />
                <Bar dataKey="retours" name="Retours" fill="#57c4c1" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="font-bold text-gray-700 mb-4">Incidents par Sous-traitant</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={incidentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="saturation" name="Saturations" stackId="a" fill="#ffcc10" />
                <Bar dataKey="manquant" name="Manquants" stackId="a" fill="#ef4444" />
                <Bar dataKey="ferme" name="Fermés" stackId="a" fill="#9c0058" />
                <Bar dataKey="refus" name="Refus" stackId="a" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Historical Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 border-b flex flex-wrap justify-between items-center gap-2">
          <h3 className="font-bold text-brand-primary">Historique Complet</h3>
          <div className="flex gap-2 items-center flex-wrap">
            <button onClick={handleExportYesterday} className="px-3 py-1 text-xs bg-gray-500 text-white hover:bg-gray-600 rounded flex items-center gap-1">
                <Icons.Document className="w-3 h-3" /> Export Hier
            </button>
            <button onClick={() => exportCheckinsToExcel(checkins)} className="px-3 py-1 text-xs bg-brand-primary text-white hover:bg-brand-primary/90 rounded">Export Tout</button>
            <button onClick={handleClean} className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded text-red-600">Nettoyer Anciens</button>
          </div>
        </div>
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700 sticky top-0">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Heure</th>
                <th className="px-4 py-2">Nom</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Commentaire</th>
                <th className="px-4 py-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {checkins.slice().reverse().map(c => (
                <tr key={c.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2">{new Date(c.timestamp).toLocaleDateString('fr-FR')}</td>
                  <td className="px-4 py-2">{new Date(c.timestamp).toLocaleTimeString('fr-FR')}</td>
                  <td className="px-4 py-2 font-medium">{c.driverName}</td>
                  <td className="px-4 py-2">
                    <span className={`px-2 py-1 rounded text-xs ${c.type === 'Départ Chauffeur' ? 'bg-brand-pink text-brand-primary' : 'bg-brand-secondary/20 text-brand-secondary'}`}>
                      {c.type === 'Départ Chauffeur' ? 'Départ' : 'Retour'}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    {editingId === c.id ? (
                      <input 
                        value={editComment} 
                        onChange={e => setEditComment(e.target.value)} 
                        className="border rounded px-2 py-1 w-full"
                      />
                    ) : (
                      c.departureComment
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {editingId === c.id ? (
                       <button onClick={() => saveEdit(c.id)} className="text-green-600 text-xs font-bold">OK</button>
                    ) : (
                       c.type === 'Départ Chauffeur' && (
                         <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-brand-primary">
                            <Icons.Pencil className="w-4 h-4" />
                         </button>
                       )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// --- Tab B: Reports ---

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkin: CheckinRecord;
  existingReport?: ReturnReport;
  onSave: (r: ReturnReport) => void;
  departureComment?: string;
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, checkin, existingReport, onSave, departureComment }) => {
  if (!isOpen) return null;

  const [tampon, setTampon] = useState(existingReport?.tamponDuRelais || false);
  const [horaire, setHoraire] = useState(existingReport?.horaireDePassageLocker || false);
  const [notes, setNotes] = useState(existingReport?.notes || '');
  const [requiresReview, setRequiresReview] = useState(existingReport?.requiresReview || false);

  // New: Tour State
  const [tour, setTour] = useState(checkin.tour);
  
  const [saturations, setSaturations] = useState<SaturationItem[]>(existingReport?.saturationLockers || []);
  const [manquants, setManquants] = useState<MissingItem[]>(existingReport?.livraisonsManquantes || []);
  const [fermes, setFermes] = useState<ClosedItem[]>(existingReport?.pudosApmFermes || []);
  const [refus, setRefus] = useState<RefusItem[]>(existingReport?.refus || []);
  const [devoyes, setDevoyes] = useState<{sacs: number, vracs: number}>(existingReport?.devoyes || {sacs: 0, vracs: 0});

  // Local state for adding items
  const [newSat, setNewSat] = useState<Partial<SaturationItem>>({});
  const [newMis, setNewMis] = useState<Partial<MissingItem>>({});
  const [newRefus, setNewRefus] = useState<Partial<RefusItem>>({});
  const [newClo, setNewClo] = useState<Partial<ClosedItem>>({ reason: 'Fermeture sauvage' });

  const handleSubmit = () => {
    // Update tour if changed
    if (tour !== checkin.tour) {
        updateCheckinTour(checkin.id, tour);
    }

    const report: ReturnReport = {
      id: existingReport?.id || crypto.randomUUID(),
      checkinId: checkin.id,
      tamponDuRelais: tampon,
      horaireDePassageLocker: horaire,
      saturationLockers: saturations,
      livraisonsManquantes: manquants,
      pudosApmFermes: fermes,
      refus: refus,
      devoyes: devoyes,
      notes,
      requiresReview
    };
    onSave(report);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b bg-gray-50 flex justify-between sticky top-0 z-10">
          <h3 className="text-xl font-bold text-brand-primary">Rapport de Retour: {checkin.driverName}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-black">✕</button>
        </div>
        
        <div className="p-6 space-y-6">

             {/* Tour Modification */}
            <div className="bg-gray-50 p-3 rounded border border-gray-200 flex items-center gap-4">
                <label className="text-sm font-bold text-gray-700">Numéro de Tournée :</label>
                <input 
                    type="text" 
                    value={tour} 
                    onChange={e => setTour(e.target.value)}
                    className="font-mono font-bold text-lg border-b-2 border-brand-primary bg-transparent focus:outline-none px-2 w-32" 
                />
                <span className="text-xs text-gray-400">Modifiable</span>
            </div>
            
            {/* Driver Reported Issue Warning */}
            {checkin.driverReportedIssues && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <span className="text-2xl">⚠️</span>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-yellow-800">Signalement du Chauffeur</h3>
                            <div className="mt-2 text-sm text-yellow-700">
                                <p>{checkin.driverIncidentDetails || "Le chauffeur a signalé un incident mais n'a laissé aucun détail."}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Departure Comment Display */}
            {departureComment && (
                <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded mb-2">
                    <div className="flex items-start">
                        <div className="flex-shrink-0 pt-0.5">
                            <span className="text-xl">📝</span>
                        </div>
                        <div className="ml-3">
                            <h3 className="text-sm font-bold text-blue-800">Note au Départ</h3>
                            <p className="mt-1 text-sm text-blue-700 italic">"{departureComment}"</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Checkboxes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                    <input type="checkbox" checked={tampon} onChange={e => setTampon(e.target.checked)} className="w-5 h-5 text-brand-primary accent-brand-primary" />
                    <span className="font-medium">Tampon du Relais Présent</span>
                </label>
                <label className="flex items-center gap-3 p-3 border rounded hover:bg-gray-50">
                    <input type="checkbox" checked={horaire} onChange={e => setHoraire(e.target.checked)} className="w-5 h-5 text-brand-primary accent-brand-primary" />
                    <span className="font-medium">Horaires Présents</span>
                </label>
            </div>

            {/* Dévoyés Section */}
            <div className="bg-indigo-50 p-4 rounded border border-indigo-100">
                <h4 className="font-bold text-indigo-800 border-b border-indigo-200 pb-2 mb-3">DÉVOYÉS (Total)</h4>
                <div className="flex gap-4 items-center">
                    <div className="flex flex-col">
                        <label className="text-xs text-indigo-600 font-bold uppercase mb-1">Sacs</label>
                        <input 
                            type="number" 
                            min="0"
                            className="border border-indigo-300 rounded p-2 w-24 text-center font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                            value={devoyes.sacs} 
                            onChange={e => setDevoyes({...devoyes, sacs: parseInt(e.target.value) || 0})} 
                        />
                    </div>
                    <div className="flex flex-col">
                        <label className="text-xs text-indigo-600 font-bold uppercase mb-1">Vracs</label>
                        <input 
                            type="number" 
                            min="0"
                            className="border border-indigo-300 rounded p-2 w-24 text-center font-bold text-indigo-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none" 
                            value={devoyes.vracs} 
                            onChange={e => setDevoyes({...devoyes, vracs: parseInt(e.target.value) || 0})} 
                        />
                    </div>
                    <div className="text-xs text-indigo-400 italic ml-2 mt-4">
                        Indiquer le nombre total de colis dévoyés rapportés.
                    </div>
                </div>
            </div>

            {/* Dynamic Lists */}
            <div className="grid grid-cols-1 gap-6">
                {/* Saturation */}
                <div className="space-y-3">
                    <h4 className="font-bold text-brand-secondary border-b pb-1">Saturations Lockers</h4>
                    <div className="flex gap-2 items-end">
                        <input placeholder="Nom Locker" className="border p-2 text-sm rounded flex-1" value={newSat.lockerName || ''} onChange={e => setNewSat({...newSat, lockerName: e.target.value})} />
                        <input type="number" placeholder="Sacs" className="border p-2 text-sm rounded w-16" value={newSat.sacs || ''} onChange={e => setNewSat({...newSat, sacs: parseInt(e.target.value)})} />
                        <input type="number" placeholder="Vracs" className="border p-2 text-sm rounded w-16" value={newSat.vracs || ''} onChange={e => setNewSat({...newSat, vracs: parseInt(e.target.value)})} />
                        
                        {/* Replacement Checkbox */}
                        <div className="flex items-center gap-1 border p-2 rounded bg-gray-50">
                           <input 
                              type="checkbox" 
                              id="sat-replacement"
                              checked={newSat.isReplacement || false}
                              onChange={e => setNewSat({...newSat, isReplacement: e.target.checked})}
                              className="w-4 h-4 text-brand-secondary accent-brand-secondary"
                           />
                           <label htmlFor="sat-replacement" className="text-xs font-bold text-gray-600 cursor-pointer">Remplacement ?</label>
                        </div>

                        <button onClick={() => { if(newSat.lockerName) { setSaturations([...saturations, newSat as SaturationItem]); setNewSat({}); }}} className="bg-brand-secondary text-white px-3 py-2 rounded hover:bg-opacity-90">+</button>
                    </div>
                    <ul className="text-sm space-y-1">
                        {saturations.map((s, i) => (
                            <li key={i} className="flex justify-between items-center bg-gray-50 p-2 rounded border-l-4 border-brand-secondary">
                                <span>
                                    <span className="font-medium">{s.lockerName}</span> (Sacs: {s.sacs}, Vracs: {s.vracs}) 
                                    {s.isReplacement && <span className="ml-2 text-xs bg-brand-secondary text-white px-1.5 py-0.5 rounded">Remplacement</span>}
                                </span>
                                <button onClick={() => setSaturations(saturations.filter((_, idx) => idx !== i))} className="text-red-500 font-bold px-2">x</button>
                            </li>
                        ))}
                    </ul>
                </div>
                
                {/* Manquants */}
                <div className="space-y-3">
                    <h4 className="font-bold text-red-500 border-b pb-1">Livraisons Manquantes</h4>
                    <div className="flex gap-2 items-end">
                        <input placeholder="Nom PUDO/APM" className="border p-2 text-sm rounded flex-1" value={newMis.pudoApmName || ''} onChange={e => setNewMis({...newMis, pudoApmName: e.target.value})} />
                        <input type="number" placeholder="Sacs" className="border p-2 text-sm rounded w-16" value={newMis.sacs || ''} onChange={e => setNewMis({...newMis, sacs: parseInt(e.target.value)})} />
                        <input type="number" placeholder="Vracs" className="border p-2 text-sm rounded w-16" value={newMis.vracs || ''} onChange={e => setNewMis({...newMis, vracs: parseInt(e.target.value)})} />
                        <button onClick={() => { if(newMis.pudoApmName) { setManquants([...manquants, newMis as MissingItem]); setNewMis({}); }}} className="bg-red-500 text-white px-3 py-2 rounded hover:bg-opacity-90">+</button>
                    </div>
                    <ul className="text-sm space-y-1">
                        {manquants.map((s, i) => <li key={i} className="flex justify-between bg-gray-50 p-2 rounded border-l-4 border-red-500">{s.pudoApmName} (Sacs: {s.sacs}, Vracs: {s.vracs}) <button onClick={() => setManquants(manquants.filter((_, idx) => idx !== i))} className="text-red-500 font-bold px-2">x</button></li>)}
                    </ul>
                </div>

                {/* Refus (New) */}
                <div className="space-y-3">
                    <h4 className="font-bold text-orange-500 border-b pb-1">REFUS par PUDO/APM</h4>
                    <div className="flex gap-2 items-end">
                        <input placeholder="Nom PUDO/APM" className="border p-2 text-sm rounded flex-1" value={newRefus.pudoApmName || ''} onChange={e => setNewRefus({...newRefus, pudoApmName: e.target.value})} />
                        <input type="number" placeholder="Sacs" className="border p-2 text-sm rounded w-16" value={newRefus.sacs || ''} onChange={e => setNewRefus({...newRefus, sacs: parseInt(e.target.value)})} />
                        <input type="number" placeholder="Vracs" className="border p-2 text-sm rounded w-16" value={newRefus.vracs || ''} onChange={e => setNewRefus({...newRefus, vracs: parseInt(e.target.value)})} />
                        <button onClick={() => { if(newRefus.pudoApmName) { setRefus([...refus, newRefus as RefusItem]); setNewRefus({}); }}} className="bg-orange-500 text-white px-3 py-2 rounded hover:bg-opacity-90">+</button>
                    </div>
                    <ul className="text-sm space-y-1">
                        {refus.map((s, i) => <li key={i} className="flex justify-between bg-orange-50 p-2 rounded border-l-4 border-orange-500">{s.pudoApmName} (Sacs: {s.sacs}, Vracs: {s.vracs}) <button onClick={() => setRefus(refus.filter((_, idx) => idx !== i))} className="text-red-500 font-bold px-2">x</button></li>)}
                    </ul>
                </div>

                {/* Fermetures */}
                <div className="space-y-3">
                    <h4 className="font-bold text-gray-700 border-b pb-1">Fermetures</h4>
                    <div className="flex gap-2 items-end">
                        <input placeholder="Nom PUDO/APM" className="border p-2 text-sm rounded flex-1" value={newClo.pudoApmName || ''} onChange={e => setNewClo({...newClo, pudoApmName: e.target.value})} />
                        <select className="border p-2 text-sm rounded" value={newClo.reason} onChange={e => setNewClo({...newClo, reason: e.target.value as any})}>
                            <option value="Fermeture sauvage">Fermeture sauvage</option>
                            <option value="Panne">Panne</option>
                        </select>
                        <button onClick={() => { if(newClo.pudoApmName) { setFermes([...fermes, newClo as ClosedItem]); setNewClo({reason: 'Fermeture sauvage'}); }}} className="bg-gray-600 text-white px-3 py-2 rounded hover:bg-opacity-90">+</button>
                    </div>
                    <ul className="text-sm space-y-1">
                        {fermes.map((s, i) => <li key={i} className="flex justify-between bg-gray-50 p-2 rounded border-l-4 border-gray-600">{s.pudoApmName} ({s.reason}) <button onClick={() => setFermes(fermes.filter((_, idx) => idx !== i))} className="text-red-500 font-bold px-2">x</button></li>)}
                    </ul>
                </div>
            </div>

            <div className="pt-4">
                 <label className="block text-sm font-bold text-gray-700 mb-2">Notes Générales</label>
                <textarea 
                    className="w-full border rounded p-2 text-sm h-20" 
                    placeholder="Commentaires supplémentaires..."
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                />
            </div>
        </div>
        
        {/* Verification Checkbox */}
        <div className="px-6 py-2 bg-purple-50 border-t border-purple-100">
             <label className="flex items-center gap-3 cursor-pointer">
                <input 
                    type="checkbox" 
                    checked={requiresReview} 
                    onChange={e => setRequiresReview(e.target.checked)} 
                    className="w-5 h-5 text-purple-600 accent-purple-600 border-gray-300 rounded focus:ring-purple-500" 
                />
                <span className="font-bold text-purple-800 flex items-center gap-2">
                    <Icons.Flag className="w-4 h-4" />
                    Marquer pour vérification ultérieure
                </span>
             </label>
             <p className="text-xs text-purple-600 mt-1 ml-8">Cochez cette case si ce rapport nécessite un suivi ou une correction en fin de journée.</p>
        </div>

        <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 sticky bottom-0 z-10">
            <button onClick={onClose} className="px-4 py-2 rounded border bg-white hover:bg-gray-100">Annuler</button>
            <button onClick={handleSubmit} className="px-4 py-2 rounded bg-brand-primary text-white hover:bg-brand-primary/90 font-bold shadow-sm">Sauvegarder Rapport</button>
        </div>
      </div>
    </div>
  );
};

export const ReportsTab: React.FC = () => {
    const [checkins] = useState<CheckinRecord[]>(getCheckins());
    const [reports, setReports] = useState<ReturnReport[]>(getReports());
    const [filterDate, setFilterDate] = useState(new Date().toISOString().slice(0, 10));
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedCheckin, setSelectedCheckin] = useState<CheckinRecord | null>(null);

    const handleOpenReport = (checkin: CheckinRecord) => {
        setSelectedCheckin(checkin);
        setModalOpen(true);
    };

    const handleSaveReport = (report: ReturnReport) => {
        saveReport(report);
        setReports(getReports());
        setModalOpen(false);
    };

    const filteredReturns = checkins
        .filter(c => c.type === 'Retour Tournée' && new Date(c.timestamp).toDateString() === new Date(filterDate).toDateString())
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const getDeparture = (ret: CheckinRecord) => {
        return checkins.find(c => 
            c.driverId === ret.driverId && 
            c.type === 'Départ Chauffeur' && 
            new Date(c.timestamp) < new Date(ret.timestamp) &&
            new Date(c.timestamp).toDateString() === new Date(ret.timestamp).toDateString()
        ); 
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 rounded-lg shadow-sm">
                <h2 className="text-xl font-bold text-gray-800">Gestion des Rapports</h2>
                <div className="flex gap-4 items-center">
                    <input 
                        type="date" 
                        value={filterDate} 
                        onChange={e => setFilterDate(e.target.value)} 
                        className="border p-2 rounded"
                    />
                    <button 
                        onClick={() => exportReportsToExcel(checkins.filter(c => new Date(c.timestamp).toDateString() === new Date(filterDate).toDateString()))}
                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 flex items-center gap-2"
                    >
                        <Icons.Document className="w-4 h-4" /> Export Rapport
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            <th className="px-4 py-3">Heure Retour</th>
                            <th className="px-4 py-3">Chauffeur</th>
                            <th className="px-4 py-3">Tournée</th>
                            <th className="px-4 py-3">Sous-traitant</th>
                            <th className="px-4 py-3">Statut Rapport</th>
                            <th className="px-4 py-3 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {filteredReturns.map(ret => {
                            const report = reports.find(r => r.checkinId === ret.id);
                            const dep = getDeparture(ret);
                            const hasIncidents = report && (
                                report.saturationLockers.length > 0 || 
                                report.livraisonsManquantes.length > 0 || 
                                report.pudosApmFermes.length > 0 || 
                                (report.refus && report.refus.length > 0) ||
                                (report.devoyes && (report.devoyes.sacs > 0 || report.devoyes.vracs > 0))
                            );

                            return (
                                <tr key={ret.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-mono">{new Date(ret.timestamp).toLocaleTimeString('fr-FR', {hour: '2-digit', minute: '2-digit'})}</td>
                                    <td className="px-4 py-3 font-medium">{ret.driverName}</td>
                                    <td className="px-4 py-3">{ret.tour}</td>
                                    <td className="px-4 py-3">{ret.subcontractor}</td>
                                    <td className="px-4 py-3">
                                        {report ? (
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex w-fit px-2 py-1 rounded-full text-xs font-bold ${hasIncidents ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                                    {hasIncidents ? 'Incidents' : 'RAS'}
                                                </span>
                                                {report.requiresReview && (
                                                    <span className="inline-flex w-fit items-center gap-1 text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded border border-purple-200">
                                                        <Icons.Flag className="w-3 h-3" /> À vérifier
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400 italic">En attente</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <button 
                                            onClick={() => handleOpenReport(ret)}
                                            className={`px-3 py-1 rounded text-xs font-bold transition ${report ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' : 'bg-brand-primary text-white hover:bg-brand-primary/90'}`}
                                        >
                                            {report ? 'Éditer' : 'Créer'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {filteredReturns.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun retour enregistré pour cette date.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {selectedCheckin && (
                <ReportModal 
                    isOpen={modalOpen}
                    onClose={() => setModalOpen(false)}
                    checkin={selectedCheckin}
                    existingReport={reports.find(r => r.checkinId === selectedCheckin.id)}
                    onSave={handleSaveReport}
                    departureComment={getDeparture(selectedCheckin)?.departureComment}
                />
            )}
        </div>
    );
};

// --- Tab C: Drivers ---

interface DriverModalProps {
  isOpen: boolean;
  onClose: () => void;
  driver?: Driver;
  onSave: (d: Driver) => void;
}

const DriverModal: React.FC<DriverModalProps> = ({ isOpen, onClose, driver, onSave }) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<Driver>(driver || {
    id: '',
    name: '',
    subcontractor: '',
    plate: '',
    tour: '',
    telephone: ''
  });

  const handleChange = (field: keyof Driver, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.id && formData.name) {
      onSave(formData);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h3 className="text-xl font-bold mb-4">{driver ? 'Modifier Chauffeur' : 'Ajouter Chauffeur'}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">ID / Matricule *</label>
            <input 
              required
              className="mt-1 block w-full border rounded p-2"
              value={formData.id}
              onChange={e => handleChange('id', e.target.value)}
              disabled={!!driver} // ID typically shouldn't change for existing records or it creates a new one
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Nom Complet *</label>
            <input 
              required
              className="mt-1 block w-full border rounded p-2"
              value={formData.name}
              onChange={e => handleChange('name', e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700">Sous-traitant</label>
                <input 
                  className="mt-1 block w-full border rounded p-2"
                  value={formData.subcontractor}
                  onChange={e => handleChange('subcontractor', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Tournée</label>
                <input 
                  className="mt-1 block w-full border rounded p-2"
                  value={formData.tour}
                  onChange={e => handleChange('tour', e.target.value)}
                />
             </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-sm font-medium text-gray-700">Téléphone</label>
                <input 
                  className="mt-1 block w-full border rounded p-2"
                  value={formData.telephone}
                  onChange={e => handleChange('telephone', e.target.value)}
                />
             </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Plaque</label>
                <input 
                  className="mt-1 block w-full border rounded p-2"
                  value={formData.plate}
                  onChange={e => handleChange('plate', e.target.value)}
                />
             </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
             <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50">Annuler</button>
             <button type="submit" className="px-4 py-2 bg-brand-primary text-white rounded hover:bg-brand-primary/90">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const DriversTab: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>(getDrivers());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | undefined>(undefined);

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.subcontractor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = (d: Driver) => {
    saveDriver(d);
    setDrivers(getDrivers());
  };

  const handleDelete = (id: string) => {
    if(confirm('Supprimer ce chauffeur ?')) {
      deleteDriver(id);
      setDrivers(getDrivers());
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const newDrivers = await parseDriverExcel(e.target.files[0]);
        if (newDrivers.length > 0) {
            if(confirm(`Importer ${newDrivers.length} chauffeurs ? Cela remplacera la liste actuelle.`)) {
                importDrivers(newDrivers);
                setDrivers(getDrivers());
                alert('Import réussi !');
            }
        } else {
            alert('Aucun chauffeur trouvé dans le fichier.');
        }
      } catch (err) {
        alert('Erreur lors de la lecture du fichier Excel.');
        console.error(err);
      }
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex justify-between items-center">
          <div className="relative w-64">
             <input 
               placeholder="Rechercher (Nom, ID, Sous-traitant)..."
               className="w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-yellow focus:outline-none"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
             <span className="absolute left-2.5 top-2.5 text-gray-400">🔍</span>
          </div>
          <div className="flex gap-2">
            <label className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium text-sm flex items-center gap-2">
               <Icons.Document className="w-4 h-4" /> Import Excel
               <input type="file" accept=".xlsx, .xls" className="hidden" onChange={handleImport} />
            </label>
            <button 
              onClick={() => { setEditingDriver(undefined); setIsModalOpen(true); }}
              className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary/90 font-medium text-sm flex items-center gap-2"
            >
              <Icons.Users className="w-4 h-4" /> Ajouter Chauffeur
            </button>
          </div>
       </div>

       <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-700">
               <tr>
                 <th className="px-4 py-3">ID</th>
                 <th className="px-4 py-3">Nom</th>
                 <th className="px-4 py-3">Sous-traitant</th>
                 <th className="px-4 py-3">Tournée</th>
                 <th className="px-4 py-3">Téléphone</th>
                 <th className="px-4 py-3 text-right">Actions</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
               {filteredDrivers.map(d => (
                 <tr key={d.id} className="hover:bg-gray-50">
                   <td className="px-4 py-3 font-mono font-medium">{d.id}</td>
                   <td className="px-4 py-3 font-bold text-gray-800">{d.name}</td>
                   <td className="px-4 py-3">{d.subcontractor}</td>
                   <td className="px-4 py-3">{d.tour}</td>
                   <td className="px-4 py-3 text-gray-500">{d.telephone}</td>
                   <td className="px-4 py-3 text-right">
                      <button 
                        onClick={() => { setEditingDriver(d); setIsModalOpen(true); }}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        <Icons.Pencil className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(d.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                         <Icons.Trash className="w-4 h-4" />
                      </button>
                   </td>
                 </tr>
               ))}
               {filteredDrivers.length === 0 && (
                 <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun chauffeur trouvé.</td>
                 </tr>
               )}
            </tbody>
          </table>
       </div>

       <DriverModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          driver={editingDriver}
          onSave={handleSave}
       />
    </div>
  );
};

// --- Tab D: Settings ---

export const SettingsTab: React.FC = () => {
    const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
    const [permissionStatus, setPermissionStatus] = useState(Notification.permission);

    useEffect(() => {
        // Poll permission status occasionally in case it changes
        const interval = setInterval(() => {
            setPermissionStatus(Notification.permission);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleChange = (key: keyof NotificationSettings, value: any) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        saveNotificationSettings(newSettings);
    };

    const handleRequestPermission = async () => {
        const granted = await requestNotificationPermission();
        if (granted) {
            setPermissionStatus('granted');
            alert("Permissions accordées !");
        } else {
            setPermissionStatus(Notification.permission);
            // Don't show generic alert here, rely on the UI update below for 'denied'
        }
    };

    const handleTestNotification = () => {
        sendLocalNotification("Test de Notification", "Ceci est un test pour vérifier que les alertes fonctionnent.");
    };

    return (
        <div className="max-w-2xl mx-auto space-y-8">
            <div className="bg-white p-6 rounded-lg shadow border-t-4 border-gray-700">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Icons.Settings className="w-6 h-6 text-gray-700" />
                    Configuration des Alertes
                </h2>

                <div className="space-y-6">
                    {/* Master Switch */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                            <h3 className="font-bold text-gray-700">Activer les Notifications</h3>
                            <p className="text-sm text-gray-500">Active ou désactive todas les alertes du système.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={settings.masterEnabled}
                                onChange={e => handleChange('masterEnabled', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                        </label>
                    </div>

                    <hr />

                    {/* Delay Alerts */}
                    <div className={`space-y-4 ${!settings.masterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                         <div className="flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-700">Alertes de Retard</h3>
                                <p className="text-sm text-gray-500">Notifier quand un chauffeur dépasse la durée maximale.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer"
                                    checked={settings.enableDelayAlerts}
                                    onChange={e => handleChange('enableDelayAlerts', e.target.checked)}
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                         </div>

                         {settings.enableDelayAlerts && (
                             <div className="flex items-center gap-4 pl-4 border-l-2 border-blue-200">
                                 <label className="text-sm font-medium text-gray-600">Seuil de retard (Heures) :</label>
                                 <input 
                                    type="number" 
                                    min="1" 
                                    max="24"
                                    className="border rounded p-2 w-20 text-center font-bold"
                                    value={settings.delayThresholdHours}
                                    onChange={e => handleChange('delayThresholdHours', parseInt(e.target.value) || 12)}
                                 />
                             </div>
                         )}
                    </div>

                    <hr />

                    {/* Incident Alerts */}
                    <div className={`flex items-center justify-between ${!settings.masterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                        <div>
                            <h3 className="font-bold text-gray-700">Alertes d'Incidents</h3>
                            <p className="text-sm text-gray-500">Notifier immédiatement quand un chauffeur signale un problema au kiosque.</p>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={settings.enableIncidentAlerts}
                                onChange={e => handleChange('enableIncidentAlerts', e.target.checked)}
                            />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                    </div>
                </div>
            </div>

            {/* Permission Status */}
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="font-bold text-gray-800 mb-4">Statut Système</h3>
                
                {permissionStatus === 'denied' && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-6 rounded">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <Icons.Info className="h-5 w-5 text-red-500" />
                            </div>
                            <div className="ml-3">
                                <h3 className="text-sm font-bold text-red-800">
                                    Les notifications sont bloquées par votre navigateur.
                                </h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>Le bouton "Demander" ne fonctionnera pas car vous (ou le navigateur) avez refusé la permission précédemment.</p>
                                    <p className="mt-2 font-bold">Pour corriger cela :</p>
                                    <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                                        <li>Cliquez sur l'icône de <b>Cadenas 🔒</b> ou de paramètres dans la barre d'adresse (à gauche de l'URL).</li>
                                        <li>Cherchez "Notifications".</li>
                                        <li>Changez le statut de "Bloquer" à <b>"Autoriser" (Allow)</b>.</li>
                                        <li>Actualisez la page.</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center justify-between mb-4">
                     <span className="text-gray-600">Permissions du Navigateur :</span>
                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${permissionStatus === 'granted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {permissionStatus === 'granted' ? 'Accordé' : permissionStatus === 'denied' ? 'Refusé' : 'Par défaut'}
                     </span>
                </div>
                
                <div className="flex gap-4">
                     {permissionStatus !== 'granted' && permissionStatus !== 'denied' && (
                        <button onClick={handleRequestPermission} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm">
                            Demander Permissions
                        </button>
                     )}
                     {permissionStatus === 'denied' && (
                         <button disabled className="px-4 py-2 bg-gray-300 text-gray-500 rounded cursor-not-allowed text-sm">
                            Permission Refusée
                        </button>
                     )}
                     <button onClick={handleTestNotification} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 text-sm">
                        Envoyer Test
                     </button>
                </div>
            </div>
        </div>
    );
};