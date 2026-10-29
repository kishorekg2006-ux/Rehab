import React, { useState } from 'react';
import { PatientProfile, SessionRecord, ExerciseId } from '../../types/rehab';
import { formatRehabDuration } from '../../data/patientStore';
import {
  Activity,
  TrendingUp,
  Settings,
  Calendar,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  Trash2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface TherapistDashboardProps {
  patientProfile: PatientProfile;
  sessions: SessionRecord[];
  onUpdateProfile: (profile: PatientProfile) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAllSessions: () => void;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({
  patientProfile,
  sessions,
  onUpdateProfile,
  onDeleteSession,
  onClearAllSessions,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'prescription' | 'sessions'>('analytics');
  const [editingProfile, setEditingProfile] = useState<PatientProfile>({ ...patientProfile });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);

  const handleSavePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(editingProfile);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Compute longitudinal statistics
  const totalRepsCompleted = sessions.reduce((acc, s) => acc + (s.repsCompleted || 0), 0);
  const totalSeconds = sessions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
  const totalMinutes = Math.round(totalSeconds / 60);
  const peakExtensionEver = sessions.length > 0
    ? Math.max(...sessions.map((s) => s.peakExtensionAngle || 120))
    : 120;
  const bestPinchEver = sessions.length > 0
    ? Math.min(...sessions.map((s) => s.bestPinchMm || 30).filter((n) => n > 5))
    : 24;
  const latestTremor = sessions[0]?.avgTremorIndex || 2.2;

  return (
    <div className="space-y-6">
      {/* Clinical Patient Header Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-slate-900">{patientProfile.fullName}</h2>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs font-bold text-teal-700 uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
              {patientProfile.affectedSide} Upper Limb Hemiparesis
            </span>
            <span className="text-xs text-slate-300">·</span>
            <span className="text-xs font-semibold text-slate-700">
              Brunnstrom Stage {patientProfile.brunnstromStage}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            Patient ID: {patientProfile.id} · Rehabilitation Protocol: Active Finger Extension & Functional Grasp Precision
          </p>
        </div>

        {/* Vital Metrics Summary */}
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-500 block font-semibold">Total Therapy</span>
            <div className="flex items-baseline gap-1.5 font-mono">
              <span className="text-lg font-bold text-slate-900">{formatRehabDuration(totalSeconds)}</span>
              <span className="text-xs text-slate-500 font-sans">({totalMinutes}m logged)</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-xs text-slate-500 block font-semibold">Sessions Logged</span>
            <span className="text-lg font-bold text-teal-700 font-mono">{sessions.length} sets</span>
          </div>
          <div className="h-8 w-px bg-slate-200" />
          <div>
            <span className="text-xs text-slate-500 block font-semibold">Best Pinch Aperture</span>
            <span className="text-lg font-bold text-slate-900 font-mono">{bestPinchEver} mm</span>
          </div>
        </div>
      </div>

      {/* Navigation Segmented Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'analytics'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Longitudinal Kinematics</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('prescription')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'prescription'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Exercise Prescription</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'sessions'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Session Records ({sessions.length})</span>
        </button>
      </div>

      {/* TAB 1: Longitudinal Kinematics & Charts */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 block mb-1 font-semibold">Peak Finger Extension (AROM)</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">{peakExtensionEver}°</span>
                <span className="text-xs text-teal-700 flex items-center font-mono font-bold">
                  <ArrowUpRight className="w-3 h-3" /> Active
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Full range target: 160°</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 block mb-1 font-semibold">Best Pincer Aperture</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">{bestPinchEver} mm</span>
                <span className="text-xs text-emerald-600 flex items-center font-mono font-bold">
                  Precision
                </span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Thumb-index opposition contact</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 block mb-1 font-semibold">Latest Tremor Index</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-700 font-mono">{latestTremor} / 10</span>
                <span className="text-xs text-emerald-600 font-mono font-bold">Controlled</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Smoothness metric</span>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
              <span className="text-xs text-slate-500 block mb-1 font-semibold">Total Repetitions</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 font-mono">{totalRepsCompleted}</span>
                <span className="text-xs text-slate-500">reps</span>
              </div>
              <span className="text-[11px] text-slate-400 mt-1 block">Across all completed sets</span>
            </div>
          </div>

          {/* Active Range of Motion Trajectory Visualizer */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-900">Active Extension Range of Motion Across Sessions</h3>
                <p className="text-xs text-slate-500">Recorded peak finger extension angles per completed rehabilitation set</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600" />
                  <span className="text-slate-700 font-semibold">Extension Angle (°)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                  <span className="text-slate-500">Functional Goal (150°)</span>
                </div>
              </div>
            </div>

            {sessions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs border border-dashed border-slate-200 rounded-xl">
                No session data recorded yet. Have the patient complete exercises in the Rehab Studio.
              </div>
            ) : (
              <div className="h-52 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-200">
                {sessions.slice(0, 10).reverse().map((s, idx) => {
                  const angle = s.peakExtensionAngle || 120;
                  const heightPercent = Math.min(100, Math.max(15, ((angle - 80) / 80) * 100));
                  const dateStr = new Date(s.timestamp).toLocaleDateString('en-US', {
                    month: 'numeric',
                    day: 'numeric',
                  });
                  return (
                    <div key={s.id || idx} className="flex-1 flex flex-col items-center gap-2 group">
                      <span className="text-[11px] font-mono text-teal-700 font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                        {angle}°
                      </span>
                      <div className="w-full bg-slate-100 rounded-t-lg h-40 relative flex items-end">
                        <div className="absolute top-[20%] left-0 right-0 h-px bg-slate-300" />
                        <div
                          className="w-full bg-gradient-to-t from-teal-700 to-teal-500 rounded-t-lg transition-all duration-300 group-hover:brightness-105"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{dateStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Prescription Editor */}
      {activeTab === 'prescription' && (
        <form onSubmit={handleSavePrescription} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-xs">
          <div>
            <h3 className="text-base font-bold text-slate-900">Therapist Exercise Prescription</h3>
            <p className="text-xs text-slate-500">Configure repetition targets, isometric hold durations, and hemiparetic side</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Affected Hemiparetic Side</label>
              <select
                value={editingProfile.affectedSide}
                onChange={(e) => setEditingProfile({ ...editingProfile, affectedSide: e.target.value as 'left' | 'right' })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-600 font-medium"
              >
                <option value="right">Right Upper Limb</option>
                <option value="left">Left Upper Limb</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Brunnstrom Motor Recovery Stage</label>
              <select
                value={editingProfile.brunnstromStage}
                onChange={(e) => setEditingProfile({ ...editingProfile, brunnstromStage: parseInt(e.target.value) as any })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-600 font-medium"
              >
                <option value={2}>Stage 2 - Minimal voluntary movement</option>
                <option value={3}>Stage 3 - Marked spasticity, synergy grasp</option>
                <option value={4}>Stage 4 - Spasticity declining, selective finger extension</option>
                <option value={5}>Stage 5 - Synergies lose dominance, refined finger coordination</option>
                <option value={6}>Stage 6 - Near-normal coordination</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Daily Target Sessions</label>
              <input
                type="number"
                min="1"
                max="6"
                value={editingProfile.dailyTargetSessions}
                onChange={(e) => setEditingProfile({ ...editingProfile, dailyTargetSessions: parseInt(e.target.value) || 2 })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-teal-600 font-mono font-medium"
              />
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-800">Target Repetitions per Exercise</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fruit Catcher */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Fruit Drop & Catch</span>
                  <span className="text-xs text-amber-700 font-semibold">Gross Motor Grasp</span>
                </div>
                <div>
                  <label className="text-slate-600 block mb-1 text-xs">Target Catches</label>
                  <input
                    type="number"
                    min="5"
                    max="50"
                    value={editingProfile.prescriptions.fruit_catcher?.targetReps || 15}
                    onChange={(e) =>
                      setEditingProfile({
                        ...editingProfile,
                        prescriptions: {
                          ...editingProfile.prescriptions,
                          fruit_catcher: {
                            ...editingProfile.prescriptions.fruit_catcher,
                            targetReps: parseInt(e.target.value) || 15,
                          },
                        },
                      })
                    }
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Pinch Harvest */}
              <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-900">Pinch & Fruit Harvest</span>
                  <span className="text-xs text-emerald-700 font-semibold">Fine Pincer Grasp</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-600 block mb-1">Target Reps</label>
                    <input
                      type="number"
                      min="5"
                      max="40"
                      value={editingProfile.prescriptions.pinch_harvest.targetReps}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          prescriptions: {
                            ...editingProfile.prescriptions,
                            pinch_harvest: {
                              ...editingProfile.prescriptions.pinch_harvest,
                              targetReps: parseInt(e.target.value) || 10,
                            },
                          },
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-600 block mb-1">Hold Duration (sec)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5"
                      value={editingProfile.prescriptions.pinch_harvest.customHoldTime}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          prescriptions: {
                            ...editingProfile.prescriptions,
                            pinch_harvest: {
                              ...editingProfile.prescriptions.pinch_harvest,
                              customHoldTime: parseFloat(e.target.value) || 1.0,
                            },
                          },
                        })
                      }
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Therapist Clinical Notes</label>
            <textarea
              rows={3}
              value={editingProfile.therapistNotes}
              onChange={(e) => setEditingProfile({ ...editingProfile, therapistNotes: e.target.value })}
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-sm text-slate-800 focus:outline-none focus:border-teal-600"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-700 flex items-center gap-1.5 font-bold">
                <CheckCircle className="w-4 h-4" /> Prescription updated successfully
              </span>
            )}
            <button
              type="submit"
              className="ml-auto px-5 py-2.5 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
            >
              Save Prescription
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: Session Records with Reliable Delete Functions */}
      {activeTab === 'sessions' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
            <div>
              <h3 className="text-base font-bold text-slate-900">Historical Rehabilitation Session Records</h3>
              <span className="text-xs text-slate-500">{sessions.length} recorded patient sessions</span>
            </div>

            {sessions.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                className="px-3.5 py-1.5 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                <span>Delete All Session Data</span>
              </button>
            )}
          </div>

          {/* Delete All Confirmation Dialog */}
          {showClearConfirm && (
            <div className="p-4 bg-rose-50 border-b border-rose-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-rose-900 text-xs font-medium">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Are you sure you want to delete ALL {sessions.length} session records? This action cannot be undone.</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClearAllSessions();
                    setShowClearConfirm(false);
                  }}
                  className="px-3 py-1 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 shadow-xs"
                >
                  Confirm Delete All
                </button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {sessions.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-xs">
                No session records on file. Complete an exercise set in the Rehab Studio to log a session.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-mono uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-3 pl-4">Timestamp</th>
                    <th className="p-3">Exercise</th>
                    <th className="p-3">Repetitions</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Peak Extension</th>
                    <th className="p-3">Best Pinch</th>
                    <th className="p-3">Tremor Score</th>
                    <th className="p-3 pr-4 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {sessions.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 pl-4 text-slate-600">
                        {new Date(s.timestamp).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="p-3 text-slate-900 font-sans font-bold">{s.exerciseTitle}</td>
                      <td className="p-3 text-teal-800 font-bold">{s.repsCompleted} / {s.targetReps}</td>
                      <td className="p-3 text-slate-600 font-mono font-bold">{formatRehabDuration(s.durationSeconds || 0)}</td>
                      <td className="p-3 text-slate-800">{s.peakExtensionAngle || 135}°</td>
                      <td className="p-3 text-amber-700 font-bold">{s.bestPinchMm || 24} mm</td>
                      <td className="p-3 text-slate-800">{s.avgTremorIndex || 2.2} / 10</td>
                      <td className="p-3 pr-4 text-right font-sans">
                        {confirmDeleteId === s.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteSession(s.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 bg-rose-600 text-white text-[11px] font-bold rounded hover:bg-rose-700"
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 bg-slate-100 text-slate-700 text-[11px] font-bold rounded hover:bg-slate-200"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(s.id)}
                            title="Delete this session record"
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-semibold">Delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
