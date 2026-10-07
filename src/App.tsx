import React, { useState, useEffect, useCallback } from 'react';
import {
  ExerciseId,
  HandMetrics,
  HandLandmarks,
  SessionRecord,
  PatientProfile,
} from './types/rehab';
import { EXERCISE_DEFINITIONS } from './data/exerciseDefinitions';
import {
  loadPatientProfile,
  savePatientProfile,
  loadSessionRecords,
  saveSessionRecord,
} from './data/patientStore';
import { ARHandTracker } from './components/ar/ARHandTracker';
import { PinchHarvestGame } from './components/exercises/PinchHarvestGame';
import { FingerIsolationGame } from './components/exercises/FingerIsolationGame';
import { LotusBloomGame } from './components/exercises/LotusBloomGame';
import { WristGliderGame } from './components/exercises/WristGliderGame';
import { TherapistDashboard } from './components/therapist/TherapistDashboard';
import { BaselineAssessmentModal } from './components/assessment/BaselineAssessmentModal';
import { audioBiofeedback } from './utils/audioBiofeedback';
import {
  Activity,
  Heart,
  Volume2,
  VolumeX,
  Volume1,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Shield,
  Sliders,
  CheckCircle2,
  Calendar,
  Award,
  Clock,
  Cherry,
  Flower2,
  Compass,
  ArrowRight,
  UserCheck,
} from 'lucide-react';

export default function App() {
  const [patientProfile, setPatientProfile] = useState<PatientProfile>(loadPatientProfile);
  const [sessions, setSessions] = useState<SessionRecord[]>(loadSessionRecords);
  const [viewMode, setViewMode] = useState<'patient' | 'therapist'>('patient');

  // Exercise selection
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId>('pinch_harvest');
  const [activeSession, setActiveSession] = useState<boolean>(true);

  // Live AR Hand tracking metrics
  const [currentMetrics, setCurrentMetrics] = useState<HandMetrics | null>(null);
  const [currentLandmarks, setCurrentLandmarks] = useState<HandLandmarks | null>(null);
  const [promptedFingerIndex, setPromptedFingerIndex] = useState<number>(2);

  // Calibration modal
  const [showCalibrationModal, setShowCalibrationModal] = useState<boolean>(false);

  // Audio settings
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceCoachEnabled, setVoiceCoachEnabled] = useState<boolean>(true);

  // Session completion feedback modal
  const [lastCompletedSession, setLastCompletedSession] = useState<SessionRecord | null>(null);

  // Sync audio biofeedback settings
  useEffect(() => {
    audioBiofeedback.setSoundEnabled(soundEnabled);
    audioBiofeedback.setVoiceEnabled(voiceCoachEnabled);
  }, [soundEnabled, voiceCoachEnabled]);

  // Handle hand metrics update from AR engine
  const handleMetricsUpdate = useCallback((metrics: HandMetrics, landmarks: HandLandmarks | null) => {
    setCurrentMetrics(metrics);
    setCurrentLandmarks(landmarks);
  }, []);

  // Handle session finished
  const handleSessionComplete = useCallback(
    (recordPartial: Partial<SessionRecord>) => {
      const newSession: SessionRecord = {
        id: `sess-${Date.now()}`,
        timestamp: Date.now(),
        exerciseId: recordPartial.exerciseId || selectedExerciseId,
        exerciseTitle: recordPartial.exerciseTitle || EXERCISE_DEFINITIONS[selectedExerciseId].name,
        durationSeconds: recordPartial.durationSeconds || 180,
        repsCompleted: recordPartial.repsCompleted || 15,
        targetReps: recordPartial.targetReps || 15,
        accuracyScore: recordPartial.accuracyScore || 85,
        peakExtensionAngle: recordPartial.peakExtensionAngle || 135,
        bestPinchMm: recordPartial.bestPinchMm || 26,
        avgTremorIndex: recordPartial.avgTremorIndex || 2.5,
        smoothnessScore: recordPartial.smoothnessScore || 85,
        affectedHand: patientProfile.affectedSide,
        therapistFeedback: 'Great execution. Smooth movement coordination.',
      };

      const updated = saveSessionRecord(newSession);
      setSessions(updated);
      setLastCompletedSession(newSession);
    },
    [selectedExerciseId, patientProfile.affectedSide]
  );

  const currentExerciseDef = EXERCISE_DEFINITIONS[selectedExerciseId];
  const prescription = patientProfile.prescriptions[selectedExerciseId];

  // Daily summary numbers
  const todaySessionsCount = sessions.filter(
    (s) => new Date(s.timestamp).toDateString() === new Date().toDateString()
  ).length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Clinical Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Patient Context */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-white tracking-tight">NeuroHand AR</span>
                <span className="text-slate-600">·</span>
                <span className="text-xs text-teal-400 font-medium">Stroke Motor Rehab</span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <span>Patient: {patientProfile.fullName}</span>
                <span>·</span>
                <span>{patientProfile.affectedSide === 'right' ? 'Right' : 'Left'} Hand</span>
                <span>·</span>
                <span>Stage {patientProfile.brunnstromStage}</span>
              </div>
            </div>
          </div>

          {/* Center Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 border border-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('patient')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'patient'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Rehab Studio
            </button>
            <button
              onClick={() => setViewMode('therapist')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'therapist'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Therapist Portal
            </button>
          </div>

          {/* Right Controls: Audio & Hand Selector */}
          <div className="flex items-center gap-2">
            {/* Affected Hand Switcher */}
            <button
              type="button"
              onClick={() => {
                const nextSide = patientProfile.affectedSide === 'right' ? 'left' : 'right';
                const updated = { ...patientProfile, affectedSide: nextSide as 'left' | 'right' };
                setPatientProfile(updated);
                savePatientProfile(updated);
              }}
              title="Toggle target hand"
              className="px-2.5 py-1.5 bg-slate-900 border border-slate-700/60 hover:border-slate-600 rounded-lg text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-teal-400" />
              <span>{patientProfile.affectedSide.toUpperCase()} Hand</span>
            </button>

            {/* Audio biofeedback toggles */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Chimes' : 'Enable Chimes'}
              className={`p-2 rounded-lg border text-xs transition-colors ${
                soundEnabled
                  ? 'bg-slate-900 border-slate-700 text-teal-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => setVoiceCoachEnabled(!voiceCoachEnabled)}
              title={voiceCoachEnabled ? 'Voice Coach On' : 'Voice Coach Off'}
              className={`p-2 rounded-lg border text-xs transition-colors hidden sm:block ${
                voiceCoachEnabled
                  ? 'bg-slate-900 border-slate-700 text-teal-400'
                  : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}
            >
              <Volume1 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {viewMode === 'therapist' ? (
          <TherapistDashboard
            patientProfile={patientProfile}
            sessions={sessions}
            onUpdateProfile={(updated) => {
              setPatientProfile(updated);
              savePatientProfile(updated);
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Daily Rehab Engagement Bar */}
            <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold font-mono text-lg">
                  {patientProfile.streakDays}d
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">Daily Rehabilitation Goal</h3>
                    <span className="text-slate-600">·</span>
                    <span className="text-xs text-amber-400 font-mono font-medium">
                      {todaySessionsCount} of {patientProfile.dailyTargetSessions} sets completed today
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Consistent daily practice stimulates neuroplastic motor reorganization in the cortex.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowCalibrationModal(true)}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl flex items-center gap-2 border border-slate-700/60 transition-colors"
                >
                  <Sliders className="w-3.5 h-3.5 text-teal-400" />
                  <span>Calibrate Baseline ROM</span>
                </button>
              </div>
            </div>

            {/* Exercise Selection Carousel Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.values(EXERCISE_DEFINITIONS).map((ex) => {
                const isSelected = selectedExerciseId === ex.id;
                const rx = patientProfile.prescriptions[ex.id];

                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(ex.id);
                      audioBiofeedback.playSuccessChime();
                    }}
                    className={`text-left p-4 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
                      isSelected
                        ? 'bg-slate-900 border-teal-500/60 shadow-lg shadow-teal-950/40'
                        : 'bg-slate-900/50 border-slate-800 hover:bg-slate-900/80 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-teal-400 uppercase tracking-wider">
                          {ex.category.split('&')[0].trim()}
                        </span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-white mb-1">{ex.name}</h4>
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {ex.clinicalGoal}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Target: {rx?.targetReps || ex.recommendedReps} reps</span>
                      <span className="text-teal-400 font-sans font-medium flex items-center gap-1">
                        Select <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Exercise Studio & AR Engine */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Augmented Reality Hand Camera & Skeleton Tracking */}
              <div className="lg:col-span-8 flex flex-col gap-4">
                <ARHandTracker
                  exerciseId={selectedExerciseId}
                  affectedSide={patientProfile.affectedSide}
                  targetPinchMm={32}
                  bloomThresholdPercent={65}
                  promptedFingerIndex={promptedFingerIndex}
                  onMetricsUpdate={handleMetricsUpdate}
                  showBiofeedbackOverlay={true}
                />

                {/* Interactive Game Mechanics HUD & Rep Tracker */}
                {selectedExerciseId === 'pinch_harvest' && (
                  <PinchHarvestGame
                    metrics={currentMetrics}
                    landmarks={currentLandmarks}
                    targetReps={prescription?.targetReps || 15}
                    holdTimeRequired={prescription?.customHoldTime || 1.2}
                    pinchThresholdMm={32}
                    onSessionComplete={handleSessionComplete}
                  />
                )}

                {selectedExerciseId === 'finger_isolation' && (
                  <FingerIsolationGame
                    metrics={currentMetrics}
                    landmarks={currentLandmarks}
                    targetReps={prescription?.targetReps || 16}
                    onSessionComplete={handleSessionComplete}
                    onSetPromptedFinger={setPromptedFingerIndex}
                  />
                )}

                {selectedExerciseId === 'lotus_bloom' && (
                  <LotusBloomGame
                    metrics={currentMetrics}
                    landmarks={currentLandmarks}
                    targetReps={prescription?.targetReps || 12}
                    bloomThresholdPercent={65}
                    holdTimeRequired={prescription?.customHoldTime || 2.0}
                    onSessionComplete={handleSessionComplete}
                  />
                )}

                {selectedExerciseId === 'wrist_glider' && (
                  <WristGliderGame
                    metrics={currentMetrics}
                    landmarks={currentLandmarks}
                    targetReps={prescription?.targetReps || 14}
                    onSessionComplete={handleSessionComplete}
                  />
                )}
              </div>

              {/* Right Column: Clinical Guidance & Real-Time Biofeedback Panel */}
              <div className="lg:col-span-4 space-y-4">
                {/* Clinical Focus Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2.5">
                    <Shield className="w-4 h-4 text-teal-400" />
                    <h4 className="text-sm font-semibold text-white">Clinical Exercise Protocol</h4>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Therapeutic Target</span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {currentExerciseDef.clinicalGoal}
                    </p>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-1">Target Musculature</span>
                    <span className="text-xs text-teal-300 font-mono block bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      {currentExerciseDef.focusMuscles}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-400 block mb-2">Instructions for Home</span>
                    <ol className="space-y-2 text-xs text-slate-300 list-decimal pl-4 leading-relaxed">
                      {currentExerciseDef.instructions.map((inst, idx) => (
                        <li key={idx}>{inst}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Real-Time Joint Angle Seismograph Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-white">Live Joint Telemetry</h4>
                    <span className="text-[11px] font-mono text-teal-400">
                      {currentMetrics?.detectedHand ? `${currentMetrics.detectedHand.toUpperCase()} HAND` : 'SEARCHING'}
                    </span>
                  </div>

                  <div className="space-y-2.5 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Pinch Aperture</span>
                        <span className="text-slate-200">{currentMetrics?.pinchAperture || 0} mm</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-amber-400 transition-all duration-75"
                          style={{
                            width: `${Math.max(0, Math.min(100, ((50 - (currentMetrics?.pinchAperture || 0)) / 50) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Finger Extension (AROM)</span>
                        <span className="text-teal-400">{currentMetrics?.avgFingerExtension || 0}°</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-teal-400 transition-all duration-75"
                          style={{
                            width: `${Math.max(0, Math.min(100, (((currentMetrics?.avgFingerExtension || 90) - 60) / 120) * 100))}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>Movement Smoothness</span>
                        <span className="text-emerald-400">{currentMetrics?.smoothnessScore || 85}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-75"
                          style={{ width: `${currentMetrics?.smoothnessScore || 85}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Tremor Jerk Level:</span>
                      <span className="text-slate-200 font-semibold">
                        {currentMetrics?.tremorIndex || 1.2} / 10
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Baseline Calibration Modal */}
      {showCalibrationModal && (
        <BaselineAssessmentModal
          metrics={currentMetrics}
          onComplete={(baseline) => {
            const updated = {
              ...patientProfile,
              therapistNotes: `${patientProfile.therapistNotes} [Calibrated: Ext ${baseline.maxExtension}°, Pinch ${baseline.minAperture}mm]`,
            };
            setPatientProfile(updated);
            savePatientProfile(updated);
          }}
          onClose={() => setShowCalibrationModal(false)}
        />
      )}

      {/* Session Completion Celebration Modal */}
      {lastCompletedSession && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-xl font-bold text-white mb-1">Therapy Set Completed!</h3>
              <p className="text-xs text-slate-400">
                {lastCompletedSession.exerciseTitle} · {lastCompletedSession.repsCompleted} repetitions logged
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 text-left font-mono">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-sans">Active Extension</span>
                <span className="text-lg font-bold text-teal-400">
                  {lastCompletedSession.peakExtensionAngle}°
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-sans">Pincer Grasp</span>
                <span className="text-lg font-bold text-amber-400">
                  {lastCompletedSession.bestPinchMm} mm
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-sans">Smoothness</span>
                <span className="text-lg font-bold text-emerald-400">
                  {lastCompletedSession.smoothnessScore}%
                </span>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block font-sans">Tremor Index</span>
                <span className="text-lg font-bold text-slate-200">
                  {lastCompletedSession.avgTremorIndex} / 10
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-300 italic bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              "{lastCompletedSession.therapistFeedback}"
            </p>

            <button
              type="button"
              onClick={() => setLastCompletedSession(null)}
              className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-sm"
            >
              Continue Daily Rehabilitation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
