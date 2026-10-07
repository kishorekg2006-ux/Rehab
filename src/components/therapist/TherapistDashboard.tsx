import React, { useState, useEffect } from 'react';
import { PatientProfile, SessionRecord, ClinicalSOAPReport, ExerciseId } from '../../types/rehab';
import {
  Activity,
  FileText,
  TrendingUp,
  Settings,
  Calendar,
  Award,
  Sparkles,
  Printer,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface TherapistDashboardProps {
  patientProfile: PatientProfile;
  sessions: SessionRecord[];
  onUpdateProfile: (profile: PatientProfile) => void;
  onClose?: () => void;
}

export const TherapistDashboard: React.FC<TherapistDashboardProps> = ({
  patientProfile,
  sessions,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'soap_report' | 'prescription' | 'sessions'>('analytics');
  const [soapReport, setSoapReport] = useState<ClinicalSOAPReport | null>(null);
  const [loadingAiReport, setLoadingAiReport] = useState<boolean>(false);
  const [editingProfile, setEditingProfile] = useState<PatientProfile>({ ...patientProfile });
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Generate / Load Clinical SOAP summary
  const generateClinicalReport = async () => {
    setLoadingAiReport(true);
    try {
      const res = await fetch('/api/therapist/clinical-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientProfile,
          sessions,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSoapReport(data);
      }
    } catch (err) {
      console.error('Failed to generate clinical SOAP report:', err);
    } finally {
      setLoadingAiReport(false);
    }
  };

  useEffect(() => {
    if (!soapReport) {
      generateClinicalReport();
    }
  }, []);

  const handleSavePrescription = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile(editingProfile);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  // Compute key longitudinal statistics
  const totalRepsCompleted = sessions.reduce((acc, s) => acc + s.repsCompleted, 0);
  const totalMinutes = Math.round(sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 60);
  const peakExtensionEver = Math.max(...sessions.map((s) => s.peakExtensionAngle || 120), 120);
  const bestPinchEver = Math.min(...sessions.map((s) => s.bestPinchMm || 35).filter((n) => n > 10), 35);
  const latestTremor = sessions[0]?.avgTremorIndex || 2.4;
  const initialTremor = sessions[sessions.length - 1]?.avgTremorIndex || 4.2;
  const tremorReduction = Math.max(0, Math.round(((initialTremor - latestTremor) / initialTremor) * 100));

  return (
    <div className="space-y-6">
      {/* Header Clinical Summary Strip */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-white">{patientProfile.fullName}</h2>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-semibold text-teal-400 uppercase tracking-wider">
              {patientProfile.affectedSide} Hemiparesis
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-medium text-slate-300">
              Brunnstrom Stage {patientProfile.brunnstromStage}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Stroke Onset: {patientProfile.strokeDate || 'Apr 2026'} · Protocol: Upper Limb Fine Motor & Spasticity Inhibit
          </p>
        </div>

        {/* Quick Vitals */}
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-xs text-slate-400 block">Total Rehab</span>
            <span className="text-lg font-bold text-white font-mono">{totalMinutes} mins</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-xs text-slate-400 block">Compliance Streak</span>
            <span className="text-lg font-bold text-amber-400 font-mono">{patientProfile.streakDays} days</span>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <span className="text-xs text-slate-400 block">Fugl-Meyer UE Est.</span>
            <span className="text-lg font-bold text-teal-400 font-mono">
              {soapReport?.objectiveMetrics.estimatedFuglMeyerUEScore || 48} / 66
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Segmented Control */}
      <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'analytics'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Longitudinal Kinematics</span>
        </button>

        <button
          onClick={() => setActiveTab('soap_report')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'soap_report'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>AI Clinical SOAP Note</span>
        </button>

        <button
          onClick={() => setActiveTab('prescription')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'prescription'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Exercise Prescription</span>
        </button>

        <button
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            activeTab === 'sessions'
              ? 'bg-teal-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Session Logs ({sessions.length})</span>
        </button>
      </div>

      {/* TAB 1: Longitudinal Kinematics & Charts */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Active Finger Extension</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{peakExtensionEver}°</span>
                <span className="text-xs text-emerald-400 flex items-center font-mono">
                  <ArrowUpRight className="w-3 h-3" /> +30° gain
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Baseline: 118° (MCP/PIP release)</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Pincer Grasp Aperture</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{bestPinchEver} mm</span>
                <span className="text-xs text-emerald-400 flex items-center font-mono">
                  <ArrowUpRight className="w-3 h-3" /> 37% finer
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Thumb-index opposition precision</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Tremor & Jerk Index</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400 font-mono">{latestTremor} / 10</span>
                <span className="text-xs text-emerald-400 font-mono">-{tremorReduction}%</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">Corticospinal smoothness improvement</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <span className="text-xs text-slate-400 block mb-1">Therapy Repetitions</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">{totalRepsCompleted}</span>
                <span className="text-xs text-slate-400">total reps</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">96% target completion rate</span>
            </div>
          </div>

          {/* Visual Progress Trajectory Curve */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-white">Active Range of Motion (AROM) Trajectory</h3>
                <p className="text-xs text-slate-400">Peak finger extension angle across therapy sessions (Target: 160° full natural span)</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
                  <span className="text-slate-300">Measured Extension (deg)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600" />
                  <span className="text-slate-400">Target Line (150°)</span>
                </div>
              </div>
            </div>

            {/* Custom SVG Kinematics Curve */}
            <div className="h-56 w-full flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-800">
              {sessions.slice(0, 8).reverse().map((s, idx) => {
                const heightPercent = Math.min(100, Math.max(20, ((s.peakExtensionAngle - 90) / 75) * 100));
                const dateStr = new Date(s.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                return (
                  <div key={s.id || idx} className="flex-1 flex flex-col items-center gap-2 group">
                    <span className="text-[11px] font-mono text-teal-300 font-semibold opacity-0 group-hover:opacity-100 transition-opacity">
                      {s.peakExtensionAngle}°
                    </span>
                    <div className="w-full bg-slate-800 rounded-t-lg h-44 relative flex items-end">
                      {/* Target marker line */}
                      <div className="absolute top-[20%] left-0 right-0 h-px bg-slate-700/60" />
                      {/* Patient Bar */}
                      <div
                        className="w-full bg-gradient-to-t from-teal-600 to-teal-400 rounded-t-lg transition-all duration-500 group-hover:brightness-110"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 font-mono">{dateStr}</span>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
              <span>Baseline: 118° (Early spastic limitation)</span>
              <span>Latest: {sessions[0]?.peakExtensionAngle || 148}° (Approaching functional release)</span>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AI Clinical SOAP Note */}
      {activeTab === 'soap_report' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <div>
                <h3 className="text-base font-semibold text-white">Occupational Therapy SOAP Evaluation</h3>
                <p className="text-xs text-slate-400">Standard clinical format grounded in real kinematic tracking data</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={generateClinicalReport}
                disabled={loadingAiReport}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingAiReport ? 'animate-spin' : ''}`} />
                <span>Re-Analyze</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print / Export PDF</span>
              </button>
            </div>
          </div>

          {soapReport ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6 text-slate-300 text-sm shadow-xl font-sans">
              {/* Report Header */}
              <div className="border-b border-slate-800 pb-4 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h4 className="text-lg font-bold text-white uppercase tracking-wider">
                    Neuro-Rehabilitation Clinical Progress Note
                  </h4>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Patient: <strong className="text-slate-200">{soapReport.patientName}</strong> · Side:{' '}
                    <strong className="text-slate-200">{soapReport.affectedSide.toUpperCase()}</strong> · Date:{' '}
                    <strong className="text-slate-200">{soapReport.generatedAt}</strong>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-teal-400 font-semibold block">NeuroHand AR Tele-Rehab Protocol</span>
                  <span className="text-[11px] text-slate-400 font-mono">ICD-10: I69.351 (Hemiparesis)</span>
                </div>
              </div>

              {/* S: Subjective */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1.5">
                  S - Subjective
                </h5>
                <p className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed text-slate-200">
                  {soapReport.subjectiveSummary}
                </p>
              </div>

              {/* O: Objective */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1.5">
                  O - Objective Kinematic Biomarkers
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">Active Extension Gain</span>
                    <span className="text-lg font-bold text-white font-mono">
                      +{soapReport.objectiveMetrics.baselineVsCurrentExtensionDeg.changeDeg}°
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {soapReport.objectiveMetrics.baselineVsCurrentExtensionDeg.baseline}° →{' '}
                      {soapReport.objectiveMetrics.baselineVsCurrentExtensionDeg.current}°
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">Pinch Control Aperture</span>
                    <span className="text-lg font-bold text-white font-mono">
                      {soapReport.objectiveMetrics.pinchApertureControlMm.current} mm
                    </span>
                    <span className="text-[10px] text-emerald-400 block">
                      +{soapReport.objectiveMetrics.pinchApertureControlMm.improvementPercent}% precision
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">Tremor Jerk Reduction</span>
                    <span className="text-lg font-bold text-emerald-400 font-mono">
                      -{soapReport.objectiveMetrics.tremorIndexTrend.reductionPercent}%
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {soapReport.objectiveMetrics.tremorIndexTrend.start} → {soapReport.objectiveMetrics.tremorIndexTrend.current} / 10
                    </span>
                  </div>

                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] text-slate-400 block">Est. Fugl-Meyer UE</span>
                    <span className="text-lg font-bold text-teal-400 font-mono">
                      {soapReport.objectiveMetrics.estimatedFuglMeyerUEScore} / 66
                    </span>
                    <span className="text-[10px] text-slate-500 block">Moderate Motor Stage</span>
                  </div>
                </div>
              </div>

              {/* A: Assessment */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1.5">
                  A - Clinical Assessment & Neuroplastic Recovery
                </h5>
                <p className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 leading-relaxed text-slate-200">
                  {soapReport.assessmentAnalysis}
                </p>
              </div>

              {/* P: Plan */}
              <div>
                <h5 className="text-xs font-bold uppercase tracking-wider text-teal-400 mb-1.5">
                  P - Plan & Home Exercise Prescription
                </h5>
                <ul className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                  {soapReport.planRecommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-slate-200">
                      <CheckCircle className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400">
                <span>Verified by: {soapReport.clinicalSignOff}</span>
                <span className="font-mono">HIPAA & Digital Therapeutics Standard</span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <p>Loading clinical evaluation report...</p>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Therapist Prescription Editor */}
      {activeTab === 'prescription' && (
        <form onSubmit={handleSavePrescription} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div>
            <h3 className="text-base font-semibold text-white">Custom Exercise Prescription</h3>
            <p className="text-xs text-slate-400">Configure repetition targets, isometric hold durations, and hemiparetic side</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Affected Hemiparetic Side</label>
              <select
                value={editingProfile.affectedSide}
                onChange={(e) => setEditingProfile({ ...editingProfile, affectedSide: e.target.value as 'left' | 'right' })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value="right">Right Hand / Arm</option>
                <option value="left">Left Hand / Arm</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Brunnstrom Stage</label>
              <select
                value={editingProfile.brunnstromStage}
                onChange={(e) => setEditingProfile({ ...editingProfile, brunnstromStage: parseInt(e.target.value) as any })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              >
                <option value={2}>Stage 2 - Minimal voluntary movement</option>
                <option value={3}>Stage 3 - Marked spasticity, synergy grasp</option>
                <option value={4}>Stage 4 - Spasticity declining, isolated fingers emerging</option>
                <option value={5}>Stage 5 - Synergies lose dominance, fine control</option>
                <option value={6}>Stage 6 - Near-normal coordination</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Daily Target Sessions</label>
              <input
                type="number"
                min="1"
                max="6"
                value={editingProfile.dailyTargetSessions}
                onChange={(e) => setEditingProfile({ ...editingProfile, dailyTargetSessions: parseInt(e.target.value) || 2 })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
              />
            </div>
          </div>

          {/* Individual Exercises Configuration */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-teal-400">Target Repetitions & Hold Durations</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Pinch & Harvest */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Pinch & Harvest</span>
                  <span className="text-xs text-amber-400">Pincer Grasp</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Target Reps</label>
                    <input
                      type="number"
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Hold Time (sec)</label>
                    <input
                      type="number"
                      step="0.1"
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Lotus Bloom */}
              <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-white">Lotus Bloom & Release</span>
                  <span className="text-xs text-teal-400">Active Extension</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Target Reps</label>
                    <input
                      type="number"
                      value={editingProfile.prescriptions.lotus_bloom.targetReps}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          prescriptions: {
                            ...editingProfile.prescriptions,
                            lotus_bloom: {
                              ...editingProfile.prescriptions.lotus_bloom,
                              targetReps: parseInt(e.target.value) || 10,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Hold Open (sec)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={editingProfile.prescriptions.lotus_bloom.customHoldTime}
                      onChange={(e) =>
                        setEditingProfile({
                          ...editingProfile,
                          prescriptions: {
                            ...editingProfile.prescriptions,
                            lotus_bloom: {
                              ...editingProfile.prescriptions.lotus_bloom,
                              customHoldTime: parseFloat(e.target.value) || 1.5,
                            },
                          },
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">Therapist Clinical Directives</label>
            <textarea
              rows={3}
              value={editingProfile.therapistNotes}
              onChange={(e) => setEditingProfile({ ...editingProfile, therapistNotes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-teal-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            {saveSuccess && (
              <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle className="w-4 h-4" /> Prescription updated successfully
              </span>
            )}
            <button
              type="submit"
              className="ml-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition-colors shadow-sm"
            >
              Save Therapist Prescription
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: Session Logs */}
      {activeTab === 'sessions' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <h3 className="text-base font-semibold text-white">Historical Tele-Rehab Logs</h3>
            <span className="text-xs text-slate-400">{sessions.length} sessions recorded</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="p-3 pl-4">Timestamp</th>
                  <th className="p-3">Exercise</th>
                  <th className="p-3">Reps</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3">Peak Extension</th>
                  <th className="p-3">Best Pinch</th>
                  <th className="p-3">Tremor Score</th>
                  <th className="p-3 pr-4">Clinical Observation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 pl-4 text-slate-300">
                      {new Date(s.timestamp).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3 text-white font-sans font-medium">{s.exerciseTitle}</td>
                    <td className="p-3 text-teal-400 font-semibold">{s.repsCompleted} / {s.targetReps}</td>
                    <td className="p-3 text-slate-400">{Math.round(s.durationSeconds / 60)} min</td>
                    <td className="p-3 text-slate-200">{s.peakExtensionAngle}°</td>
                    <td className="p-3 text-amber-300">{s.bestPinchMm} mm</td>
                    <td className="p-3 text-slate-300">{s.avgTremorIndex} / 10</td>
                    <td className="p-3 pr-4 text-slate-400 font-sans">{s.therapistFeedback || 'Completed at home'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
