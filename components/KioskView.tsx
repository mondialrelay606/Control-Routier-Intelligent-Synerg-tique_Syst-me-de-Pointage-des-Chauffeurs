import React, { useState, useEffect, useRef } from 'react';
import { Icons } from './Icons';
import { CheckinType, Driver } from '../types';
import { getCheckins, validateScan, addCheckin, getDrivers, getNotificationSettings } from '../services/dataService';
import { exportCheckinsToExcel } from '../utils/fileHelpers';
import { sendLocalNotification } from '../services/notificationService';

const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <div className="text-center mb-8">
      <p className="text-xl text-brand-pink mb-1 capitalize">{time.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1 className="text-6xl font-bold text-white font-mono">{time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</h1>
    </div>
  );
};

export const KioskView: React.FC<{ onSwitch: () => void }> = ({ onSwitch }) => {
  const [scanInput, setScanInput] = useState('');
  const [type, setType] = useState<CheckinType>('Départ Chauffeur');
  const [hasUniform, setHasUniform] = useState(false);
  const [hasIssues, setHasIssues] = useState(false);
  const [incidentDetails, setIncidentDetails] = useState(''); // New state for details
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string; detail?: string } | null>(null);
  const [dailyCheckins, setDailyCheckins] = useState(getCheckins());
  
  const inputRef = useRef<HTMLInputElement>(null);

  // Refresh list on mount and keep focus
  useEffect(() => {
    const updateList = () => {
        const today = new Date().toDateString();
        setDailyCheckins(getCheckins().filter(c => new Date(c.timestamp).toDateString() === today).reverse());
    };
    updateList();
    
    // Auto focus maintainer
    const interval = setInterval(() => {
        if(document.activeElement !== inputRef.current && document.activeElement?.tagName !== 'TEXTAREA') {
            inputRef.current?.focus();
        }
    }, 2000);

    return () => clearInterval(interval);
  }, [feedback]); // Update list when feedback changes (implies action taken)

  const handleScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const inputId = scanInput.trim();
      if (!inputId) return;

      const validation = validateScan(inputId, type);

      if (validation.success && validation.driver) {
        const d = validation.driver;
        // Process valid scan
        addCheckin({
          id: crypto.randomUUID(),
          driverId: d.id,
          driverName: d.name,
          subcontractor: d.subcontractor,
          tour: d.tour,
          timestamp: new Date().toISOString(),
          type: type,
          hasUniform: type === 'Départ Chauffeur' ? hasUniform : undefined,
          driverReportedIssues: type === 'Retour Tournée' ? hasIssues : undefined,
          driverIncidentDetails: (type === 'Retour Tournée' && hasIssues) ? incidentDetails : undefined
        });
        
        // Notification Logic
        if (type === 'Retour Tournée' && hasIssues) {
            const settings = getNotificationSettings();
            if (settings.enableIncidentAlerts) {
                sendLocalNotification(
                    '⚠️ Incident Signalé',
                    `Le chauffeur ${d.name} a signalé: "${incidentDetails || 'Pas de détails'}"`
                );
            }
        }

        setFeedback({ 
            type: 'success', 
            msg: `${type === 'Départ Chauffeur' ? 'Bonne route' : 'Bon retour'}, ${d.name.split(' ')[0]} !`,
            detail: `${d.subcontractor} - ${d.tour}`
        });
        
        // Reset inputs
        setHasUniform(false);
        setHasIssues(false);
        setIncidentDetails('');
      } else {
        setFeedback({ type: 'error', msg: 'Erreur', detail: validation.message });
      }

      setScanInput('');
      // Clear feedback after 3 seconds
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left: Interaction Zone */}
      <div className="w-1/2 bg-brand-primary p-8 flex flex-col relative">
        <button 
          onClick={onSwitch} 
          className="absolute top-6 left-6 bg-white/10 hover:bg-white/20 text-white px-6 py-3 rounded-lg transition text-base font-semibold shadow-sm backdrop-blur-sm border border-white/10 z-10"
        >
          Administration
        </button>
        
        <div className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full">
          <Clock />
          
          {/* Type Selector */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <button 
              onClick={() => setType('Départ Chauffeur')}
              className={`p-6 rounded-xl flex flex-col items-center transition-all border-2 ${type === 'Départ Chauffeur' ? 'bg-white border-white text-brand-primary shadow-xl scale-105' : 'bg-brand-primary border-brand-pink text-brand-pink hover:bg-brand-primary/50'}`}
            >
              <Icons.Truck className="w-10 h-10 mb-2" />
              <span className="font-bold text-lg">DÉPART</span>
            </button>
            <button 
              onClick={() => setType('Retour Tournée')}
              className={`p-6 rounded-xl flex flex-col items-center transition-all border-2 ${type === 'Retour Tournée' ? 'bg-white border-white text-brand-secondary shadow-xl scale-105' : 'bg-brand-primary border-brand-secondary text-brand-secondary hover:bg-brand-primary/50'}`}
            >
              <Icons.ArrowLeft className="w-10 h-10 mb-2" />
              <span className="font-bold text-lg">RETOUR</span>
            </button>
          </div>

          {/* Options */}
          {type === 'Départ Chauffeur' && (
             <label className="flex items-center justify-center gap-3 mb-6 text-white cursor-pointer bg-white/10 p-3 rounded-lg hover:bg-white/20 transition">
               <input type="checkbox" checked={hasUniform} onChange={e => setHasUniform(e.target.checked)} className="w-6 h-6 rounded accent-brand-secondary" />
               <span className="text-lg">Porte la tenue complète</span>
             </label>
          )}
          
          {type === 'Retour Tournée' && (
             <div className="mb-6 space-y-3">
                 <label className={`flex items-center justify-center gap-3 cursor-pointer p-3 rounded-lg transition border ${hasIssues ? 'bg-brand-yellow text-gray-900 border-brand-yellow shadow-lg' : 'bg-brand-yellow/10 border-brand-yellow/30 text-brand-yellow hover:bg-brand-yellow/20'}`}>
                   <input type="checkbox" checked={hasIssues} onChange={e => setHasIssues(e.target.checked)} className="w-6 h-6 rounded accent-brand-yellow" />
                   <span className="text-lg font-bold">⚠️ Signaler un Incident / Problème</span>
                 </label>
                 
                 {/* Incident Text Input */}
                 {hasIssues && (
                    <textarea 
                        value={incidentDetails}
                        onChange={e => setIncidentDetails(e.target.value)}
                        placeholder="Décrivez le problème ici (Optionnel)..."
                        className="w-full p-3 rounded-lg text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-brand-yellow shadow-inner h-24 resize-none"
                    />
                 )}
             </div>
          )}

          {/* Input */}
          <div className="relative">
             <input 
                ref={inputRef}
                autoFocus
                value={scanInput}
                onChange={e => setScanInput(e.target.value)}
                onKeyDown={handleScan}
                placeholder="Scanner Badge / ID..."
                className="w-full p-4 text-center text-2xl font-mono rounded-xl shadow-inner border-2 border-brand-pink focus:outline-none focus:border-brand-secondary text-gray-800"
             />
             <div className="text-center text-white/60 text-sm mt-2">Appuyez sur Entrée après le scan</div>
          </div>

          {/* Feedback Result */}
          {feedback && (
            <div className={`mt-8 p-6 rounded-xl text-center animate-bounce-short shadow-lg ${feedback.type === 'success' ? 'bg-white text-brand-success border-l-8 border-brand-success' : 'bg-white text-brand-error border-l-8 border-brand-error'}`}>
                <h2 className="text-3xl font-bold mb-1">{feedback.type === 'success' ? 'Validé !' : 'Refusé'}</h2>
                <p className="text-xl font-medium text-gray-800">{feedback.msg}</p>
                {feedback.detail && <p className="text-gray-500 mt-1">{feedback.detail}</p>}
            </div>
          )}
        </div>
        
        <div className="mt-auto text-center text-white/60 text-sm">
            <p>Système v1.2 - Notifications Actives</p>
            <p className="text-xs mt-2 text-white font-semibold opacity-90">Développé par cviguera</p>
        </div>
      </div>

      {/* Right: Log */}
      <div className="w-1/2 bg-gray-50 flex flex-col h-full">
         <div className="p-6 border-b bg-white shadow-sm flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
                <Icons.Document className="w-6 h-6 text-brand-secondary" />
                Activité du Jour
            </h2>
            <button onClick={() => exportCheckinsToExcel(dailyCheckins)} className="text-brand-primary font-medium hover:underline text-sm">Exporter Excel</button>
         </div>
         
         <div className="flex-1 overflow-auto p-4">
            {dailyCheckins.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Icons.Clock className="w-16 h-16 mb-4 opacity-20" />
                    <p>Aucun mouvement aujourd'hui</p>
                </div>
            ) : (
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-xs font-semibold text-gray-500 border-b">
                            <th className="p-3">Heure</th>
                            <th className="p-3">Chauffeur</th>
                            <th className="p-3">Tournée</th>
                            <th className="p-3">Mouvement</th>
                            <th className="p-3">Info</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        {dailyCheckins.map(record => (
                            <tr key={record.id} className="border-b border-gray-100 hover:bg-white transition-colors group">
                                <td className="p-3 text-gray-500 font-mono">{new Date(record.timestamp).toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}</td>
                                <td className="p-3 font-medium text-gray-800">{record.driverName}</td>
                                <td className="p-3 text-gray-500">{record.tour}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${record.type === 'Départ Chauffeur' ? 'bg-brand-pink/30 text-brand-primary' : 'bg-brand-secondary/20 text-brand-secondary'}`}>
                                        {record.type === 'Départ Chauffeur' ? 'DEPART' : 'RETOUR'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    {record.type === 'Départ Chauffeur' && record.hasUniform && (
                                        <span title="Tenue OK" className="text-green-500">👕</span>
                                    )}
                                    {record.type === 'Départ Chauffeur' && !record.hasUniform && (
                                        <span title="Pas de tenue" className="text-red-300">⚠️</span>
                                    )}
                                    {record.type === 'Retour Tournée' && record.driverReportedIssues && (
                                        <div className="flex flex-col">
                                            <span title="Incident Signalé" className="text-brand-yellow font-bold text-xs flex items-center gap-1">⚠️ Incident</span>
                                            {record.driverIncidentDetails && (
                                                <span className="text-[10px] text-gray-500 truncate max-w-[100px]" title={record.driverIncidentDetails}>{record.driverIncidentDetails}</span>
                                            )}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
         </div>
      </div>
    </div>
  );
};