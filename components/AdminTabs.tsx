import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CheckinRecord, Driver, ReturnReport, SaturationItem, MissingItem, ClosedItem, RefusItem, NotificationSettings } from '../types';
import { getCheckins, getDrivers, getReports, saveDriver, deleteDriver, saveReport, updateCheckinDepartureComment, clearOldData, importDrivers, getNotificationSettings, saveNotificationSettings } from '../services/dataService';
import { exportCheckinsToExcel, exportReportsToExcel, parseDriverCSV } from '../utils/fileHelpers';
import { requestNotificationPermission } from '../services/notificationService';
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
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-bold text-brand-primary">Historique Complet</h3>
          <div className="flex gap-2">
            <button onClick={handleClean} className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded">Nettoyer Anciens</button>
            <button onClick={() => exportCheckinsToExcel(checkins)} className="px-3 py-1 text-xs bg-brand-primary text-white hover:bg-brand-primary/90 rounded">Export Excel</button>
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
}

const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, checkin, existingReport, onSave }) => {
  if (!isOpen) return null;

  const [tampon, setTampon] = useState(existingReport?.tamponDuRelais || false);
  const [horaire, setHoraire] = useState(existingReport?.horaireDePassageLocker || false);
  const [notes, setNotes] = useState(existingReport?.notes || '');
  
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
      notes
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
                        <button onClick={() => { if(newSat.lockerName) { setSaturations([...saturations, newSat as SaturationItem]); setNewSat({}); }}} className="bg-brand-secondary text-white px-3 py-2 rounded hover:bg-opacity-90">+</button>
                    </div>
                    <ul className="text-sm space-y-1">
                        {saturations.map((s, i) => <li key={i} className="flex justify-between bg-gray-50 p-2 rounded border-l-4 border-brand-secondary">{s.lockerName} (Sacs: {s.sacs}, Vracs: {s.vracs}) <button onClick={() => setSaturations(saturations.filter((_, idx) => idx !== i))} className="text-red-500 font-bold px-2">x</button></li>)}
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
    const [selectedCheckin, setSelectedCheckin] = useState<CheckinRecord | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const today = new Date().toDateString();
    const returnCheckins = checkins.filter(c => c.type === 'Retour Tournée' && new Date(c.timestamp).toDateString() === today);

    const handleOpen = (c: CheckinRecord) => {
        setSelectedCheckin(c);
        setIsModalOpen(true);
    };

    const handleSave = (report: ReturnReport) => {
        saveReport(report);
        setReports(getReports());
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand-primary">Gestion des Retours (Aujourd'hui)</h2>
                <button onClick={() => exportReportsToExcel(checkins)} className="px-4 py-2 bg-brand-secondary text-white rounded shadow hover:opacity-90 flex items-center gap-2">
                    <Icons.Document className="w-5 h-5" /> Rapport Excel Complet
                </button>
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            <th className="px-4 py-3">Heure</th>
                            <th className="px-4 py-3">Chauffeur</th>
                            <th className="px-4 py-3">Sous-traitant</th>
                            <th className="px-4 py-3">État</th>
                            <th className="px-4 py-3">Incidents</th>
                            <th className="px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {returnCheckins.map(c => {
                            const report = reports.find(r => r.checkinId === c.id);
                            let incidentCount = 0;
                            if (report) {
                                incidentCount += report.saturationLockers.length;
                                incidentCount += report.livraisonsManquantes.length;
                                incidentCount += report.pudosApmFermes.length;
                                incidentCount += (report.refus || []).length;
                                if (report.devoyes && (report.devoyes.sacs > 0 || report.devoyes.vracs > 0)) incidentCount++;
                            }
                            
                            return (
                                <tr key={c.id} className="border-b hover:bg-gray-50">
                                    <td className="px-4 py-3">{new Date(c.timestamp).toLocaleTimeString('fr-FR')}</td>
                                    <td className="px-4 py-3 font-medium">
                                        {c.driverName}
                                        {c.driverReportedIssues && (
                                            <span className="ml-2 text-brand-yellow" title="Incident signalé par le chauffeur">⚠️</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-gray-500">{c.subcontractor}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${report ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                            {report ? 'Rapporté' : 'En attente'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {report && incidentCount > 0 && (
                                            <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded text-xs font-bold">{incidentCount} Incidents</span>
                                        )}
                                        {report && incidentCount === 0 && <span className="text-gray-400 text-xs">RAS</span>}
                                        {!report && c.driverReportedIssues && (
                                            <span className="text-brand-yellow font-bold text-xs">Signalement à traiter !</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button 
                                            onClick={() => handleOpen(c)}
                                            className={`px-3 py-1 rounded text-xs font-medium ${report ? 'bg-gray-100 text-brand-primary border border-gray-300' : 'bg-brand-primary text-white'}`}
                                        >
                                            {report ? 'Modifier' : 'Créer Rapport'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                        {returnCheckins.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">Aucun retour scanné aujourd'hui.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
            {selectedCheckin && (
                <ReportModal 
                    isOpen={isModalOpen} 
                    onClose={() => setIsModalOpen(false)} 
                    checkin={selectedCheckin}
                    existingReport={reports.find(r => r.checkinId === selectedCheckin.id)}
                    onSave={handleSave}
                />
            )}
        </div>
    );
};

// --- Tab C: Drivers ---

export const DriversTab: React.FC = () => {
    const [drivers, setDrivers] = useState<Driver[]>(getDrivers());
    const [isEditing, setIsEditing] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Driver>>({});
    const [fileError, setFileError] = useState('');

    const handleStartEdit = (d: Driver) => {
        setIsEditing(d.id);
        setEditForm(d);
    };

    const handleSave = () => {
        if (editForm.id && editForm.name) {
            saveDriver(editForm as Driver);
            setDrivers(getDrivers());
            setIsEditing(null);
        }
    };

    const handleDelete = (id: string) => {
        if (window.confirm('Supprimer ce chauffeur ?')) {
            deleteDriver(id);
            // Force state update by creating a new array reference from the fresh storage data
            setDrivers([...getDrivers()]); 
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const newDrivers = await parseDriverCSV(file);
                if (newDrivers.length > 0) {
                    if (confirm(`Remplacer la base avec ${newDrivers.length} chauffeurs ?`)) {
                        importDrivers(newDrivers);
                        setDrivers(getDrivers());
                        setFileError('');
                    }
                } else {
                    setFileError('Aucun chauffeur valide trouvé dans le CSV.');
                }
            } catch (err) {
                setFileError('Erreur de lecture du fichier.');
            }
        }
    };

    const handleAddNew = () => {
        const newId = Math.floor(Math.random() * 10000).toString();
        const newDriver: Driver = { id: newId, name: '', subcontractor: '', plate: '', tour: '', telephone: '' };
        handleStartEdit(newDriver);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-lg font-bold text-brand-primary">Base Chauffeurs</h2>
                <div className="flex gap-2 items-center flex-wrap">
                    <div className="relative overflow-hidden">
                         <button className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-3 py-2 rounded text-sm font-medium">Importer CSV</button>
                         <input type="file" accept=".csv" onChange={handleFileUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                    </div>
                    <button onClick={handleAddNew} className="bg-brand-primary text-white px-3 py-2 rounded text-sm font-medium">Ajouter Nouveau</button>
                </div>
            </div>
            {fileError && <p className="text-red-500 text-sm">{fileError}</p>}
            
            <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm text-left">
                     <thead className="bg-gray-50 text-gray-700">
                        <tr>
                            <th className="px-4 py-2">ID</th>
                            <th className="px-4 py-2">Nom</th>
                            <th className="px-4 py-2">Sous-traitant</th>
                            <th className="px-4 py-2">Plaque</th>
                            <th className="px-4 py-2">Tournée</th>
                             <th className="px-4 py-2">Tel</th>
                            <th className="px-4 py-2 w-24">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isEditing && !drivers.find(d => d.id === isEditing) && (
                             <tr className="bg-yellow-50">
                                <td className="p-2"><input className="w-full border rounded p-1" placeholder="ID" value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} /></td>
                                <td className="p-2"><input className="w-full border rounded p-1" placeholder="Nom" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                                <td className="p-2"><input className="w-full border rounded p-1" value={editForm.subcontractor} onChange={e => setEditForm({...editForm, subcontractor: e.target.value})} /></td>
                                <td className="p-2"><input className="w-full border rounded p-1" value={editForm.plate} onChange={e => setEditForm({...editForm, plate: e.target.value})} /></td>
                                <td className="p-2"><input className="w-full border rounded p-1" value={editForm.tour} onChange={e => setEditForm({...editForm, tour: e.target.value})} /></td>
                                <td className="p-2"><input className="w-full border rounded p-1" value={editForm.telephone} onChange={e => setEditForm({...editForm, telephone: e.target.value})} /></td>
                                <td className="p-2 flex gap-2">
                                    <button onClick={handleSave} className="text-green-600 font-bold">V</button>
                                    <button onClick={() => setIsEditing(null)} className="text-red-600 font-bold">X</button>
                                </td>
                            </tr>
                        )}
                        {drivers.map((d, index) => (
                            <tr key={`${d.id}-${index}`} className="border-b hover:bg-gray-50">
                                {isEditing === d.id ? (
                                    <>
                                        <td className="p-2 text-gray-500">{d.id}</td>
                                        <td className="p-2"><input className="w-full border rounded p-1" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} /></td>
                                        <td className="p-2"><input className="w-full border rounded p-1" value={editForm.subcontractor} onChange={e => setEditForm({...editForm, subcontractor: e.target.value})} /></td>
                                        <td className="p-2"><input className="w-full border rounded p-1" value={editForm.plate} onChange={e => setEditForm({...editForm, plate: e.target.value})} /></td>
                                        <td className="p-2"><input className="w-full border rounded p-1" value={editForm.tour} onChange={e => setEditForm({...editForm, tour: e.target.value})} /></td>
                                        <td className="p-2"><input className="w-full border rounded p-1" value={editForm.telephone} onChange={e => setEditForm({...editForm, telephone: e.target.value})} /></td>
                                        <td className="p-2 flex gap-2">
                                            <button onClick={handleSave} className="text-green-600 font-bold">V</button>
                                            <button onClick={() => setIsEditing(null)} className="text-red-600 font-bold">X</button>
                                        </td>
                                    </>
                                ) : (
                                    <>
                                        <td className="px-4 py-2">{d.id}</td>
                                        <td className="px-4 py-2 font-medium">{d.name}</td>
                                        <td className="px-4 py-2">{d.subcontractor}</td>
                                        <td className="px-4 py-2">{d.plate}</td>
                                        <td className="px-4 py-2">{d.tour}</td>
                                        <td className="px-4 py-2">{d.telephone}</td>
                                        <td className="px-4 py-2 flex gap-2">
                                            <button onClick={() => handleStartEdit(d)} className="text-brand-secondary hover:text-brand-primary"><Icons.Pencil className="w-4 h-4"/></button>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} className="text-gray-400 hover:text-red-500 p-1"><Icons.Trash className="w-4 h-4"/></button>
                                        </td>
                                    </>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Tab D: Settings ---

export const SettingsTab: React.FC = () => {
    const [settings, setSettings] = useState<NotificationSettings>(getNotificationSettings());
    const [saved, setSaved] = useState(false);

    const handleSave = () => {
        saveNotificationSettings(settings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleTestNotification = async () => {
        const permission = await requestNotificationPermission();
        if(permission) {
            new Notification("Test Notification", { body: "Le système de notification fonctionne correctement.", icon: '/vite.svg' });
        } else {
            alert("Permission refusée par le navigateur.");
        }
    };

    return (
        <div className="space-y-8 max-w-3xl mx-auto">
             <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold text-brand-primary">Configuration des Notifications</h2>
                <button onClick={handleTestNotification} className="text-sm bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-gray-700">
                    Tester une notification
                </button>
             </div>

             <div className="bg-white rounded-lg shadow p-6 space-y-8">
                 
                 {/* Master Switch */}
                 <div className="flex items-center justify-between border-b pb-6">
                     <div>
                         <h3 className="font-bold text-gray-800 text-lg">Activer les Notifications</h3>
                         <p className="text-sm text-gray-500">Active ou désactive globalement toutes les alertes du système.</p>
                     </div>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={settings.masterEnabled}
                            onChange={e => setSettings({...settings, masterEnabled: e.target.checked})} 
                        />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-secondary"></div>
                     </label>
                 </div>

                 {/* Delay Settings */}
                 <div className={`space-y-4 ${!settings.masterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                     <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-bold text-gray-700">Alertes de Retard Chauffeur</h3>
                            <p className="text-sm text-gray-500">Notifier quand un chauffeur dépasse un temps de tournée spécifique.</p>
                        </div>
                        <input 
                            type="checkbox" 
                            className="w-6 h-6 text-brand-secondary rounded accent-brand-secondary"
                            checked={settings.enableDelayAlerts}
                            onChange={e => setSettings({...settings, enableDelayAlerts: e.target.checked})}
                        />
                     </div>
                     
                     {settings.enableDelayAlerts && (
                         <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 ml-4">
                             <label className="block text-sm font-bold text-gray-700 mb-2">Seuil de déclenchement (Heures)</label>
                             <div className="flex items-center gap-3">
                                 <input 
                                    type="number" 
                                    min="1" max="24" 
                                    className="border rounded p-2 w-24 text-center font-bold"
                                    value={settings.delayThresholdHours}
                                    onChange={e => setSettings({...settings, delayThresholdHours: parseInt(e.target.value)})}
                                 />
                                 <span className="text-sm text-gray-600">heures de tournée avant alerte.</span>
                             </div>
                         </div>
                     )}
                 </div>

                 {/* Incident Settings */}
                 <div className={`flex items-center justify-between border-t pt-6 ${!settings.masterEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
                     <div>
                         <h3 className="font-bold text-gray-700">Alertes Incidents (Kiosque)</h3>
                         <p className="text-sm text-gray-500">Recevoir une notification immédiate quand un chauffeur signale un problème au retour.</p>
                     </div>
                     <input 
                        type="checkbox" 
                        className="w-6 h-6 text-brand-secondary rounded accent-brand-secondary"
                        checked={settings.enableIncidentAlerts}
                        onChange={e => setSettings({...settings, enableIncidentAlerts: e.target.checked})}
                     />
                 </div>

             </div>

             <div className="flex justify-end">
                 <button 
                    onClick={handleSave} 
                    className={`px-6 py-3 rounded-lg font-bold text-white shadow-lg transition-all ${saved ? 'bg-green-500' : 'bg-brand-primary hover:bg-brand-primary/90'}`}
                 >
                     {saved ? 'Sauvegardé !' : 'Enregistrer la Configuration'}
                 </button>
             </div>
        </div>
    );
};