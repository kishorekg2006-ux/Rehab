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
  getPatientProfile,
  savePatientProfile,
  getSessionRecords,
  saveSessionRecord,
  deleteSessionRecord,
  clearAllSessionRecords,
  calculateTotalTherapySeconds,
  calculateTotalTherapyMinutes,
  formatRehabDuration,
} from './data/patientStore';
import { ARHandTracker } from './components/ar/ARHandTracker';
import { TherapistDashboard } from './components/therapist/TherapistDashboard';
import { BaselineAssessmentModal } from './components/assessment/BaselineAssessmentModal';
import { LoginPortal } from './components/auth/LoginPortal';
import { UserAccount } from './types/auth';

// 5 Gamified Interactive Rehabilitation Modules
import { FruitDropCatchGame } from './components/exercises/FruitDropCatchGame';
import { FingerIsolationGame } from './components/exercises/FingerIsolationGame';
import { PinchHarvestGame } from './components/exercises/PinchHarvestGame';
import { LotusBloomGame } from './components/exercises/LotusBloomGame';
import { StarReachGame } from './components/exercises/StarReachGame';
import { WristGliderGame } from './components/exercises/WristGliderGame';

import { audioBiofeedback } from './utils/audioBiofeedback';
import {
  Activity,
  Award,
  Calendar,
  Volume2,
  VolumeX,
  Sliders,
  Sparkles,
  ArrowRight,
  Trash2,
  CheckCircle2,
  User,
  LogOut,
  Maximize2,
  Minimize2,
  Hand,
  Clock,
  Layers,
} from 'lucide-react';

const STORAGE_KEY_AUTH = 'neurohand_active_user_v1';

export const App: React.FC = () => {
  // Authentication State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(STORAGE_KEY_AUTH);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return null;
  });

  // Clinical Profile & Session State
  const [patientProfile, setPatientProfile] = useState<PatientProfile>(getPatientProfile());
  const [sessions, setSessions] = useState<SessionRecord[]>(getSessionRecords());

  // Navigation & View Mode
  const [viewMode, setViewMode] = useState<'patient' | 'therapist'>('patient');
  const [selectedExerciseId, setSelectedExerciseId] = useState<ExerciseId>('fruit_catcher');

  // Monitor Size: 'large' (theater expanded) vs 'small' (split view)
  const [monitorSize, setMonitorSize] = useState<'large' | 'small'>('large');

  // Hand Mode: 'auto' | 'right' | 'left'
  const [targetHandMode, setTargetHandMode] = useState<'auto' | 'right' | 'left'>('auto');

  // Biomechanical Telemetry & Finger Prompts
  const [currentMetrics, setCurrentMetrics] = useState<HandMetrics | null>(null);
  const [currentLandmarks, setCurrentLandmarks] = useState<HandLandmarks | null>(null);
  const [promptedFingerIndex, setPromptedFingerIndex] = useState<number>(2);

  // Modals & Settings
  const [showCalibrationModal, setShowCalibrationModal] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [voiceCoachEnabled, setVoiceCoachEnabled] = useState<boolean>(true);

  // Session completion modal
  const [lastCompletedSession, setLastCompletedSession] = useState<SessionRecord | null>(null);
  const [notificationToast, setNotificationToast] = useState<string | null>(null);

  // Sync audio biofeedback settings
  useEffect(() => {
    audioBiofeedback.setSoundEnabled(soundEnabled);
    audioBiofeedback.setVoiceEnabled(voiceCoachEnabled);
  }, [soundEnabled, voiceCoachEnabled]);

  // Sync view mode when logging in
  const handleLogin = (user: UserAccount) => {
    setCurrentUser(user);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_AUTH, JSON.stringify(user));
    }

    const updatedProfile: PatientProfile = {
      ...patientProfile,
      fullName: user.name,
      phoneNumber: user.phoneNumber,
      condition: user.condition,
      therapistNotes: `Case: ${user.condition}. Phone: ${user.phoneNumber}. Upper-limb therapy prescribed.`,
    };
    setPatientProfile(updatedProfile);
    savePatientProfile(updatedProfile);

    setViewMode('patient');
    audioBiofeedback.playSuccessChime();
  };

  const handleLogout = () => {
    setCurrentUser(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY_AUTH);
    }
    setLastCompletedSession(null);
  };

  const showToast = (message: string) => {
    setNotificationToast(message);
    setTimeout(() => {
      setNotificationToast(null);
    }, 3000);
  };

  // Handle hand metrics update from AR engine
  const handleMetricsUpdate = useCallback((metrics: HandMetrics, landmarks: HandLandmarks | null) => {
    setCurrentMetrics(metrics);
    setCurrentLandmarks(landmarks);
  }, []);

  // Handle session finished
  const handleSessionComplete = useCallback(
    (recordPartial: Partial<SessionRecord>) => {
      const activeHand =
        (currentMetrics?.detectedHand as 'left' | 'right') ||
        (targetHandMode !== 'auto' ? targetHandMode : patientProfile.affectedSide) ||
        'right';

      const exactDuration = recordPartial.durationSeconds && recordPartial.durationSeconds > 0
        ? recordPartial.durationSeconds
        : 60;

      const newSession: SessionRecord = {
        id: `sess-${Date.now()}`,
        timestamp: Date.now(),
        exerciseId: recordPartial.exerciseId || selectedExerciseId,
        exerciseTitle: recordPartial.exerciseTitle || EXERCISE_DEFINITIONS[selectedExerciseId].name,
        durationSeconds: exactDuration,
        repsCompleted: recordPartial.repsCompleted || 15,
        targetReps: recordPartial.targetReps || 15,
        accuracyScore: recordPartial.accuracyScore || 92,
        peakExtensionAngle: recordPartial.peakExtensionAngle || 135,
        bestPinchMm: recordPartial.bestPinchMm || 24,
        avgTremorIndex: recordPartial.avgTremorIndex || 2.2,
        smoothnessScore: recordPartial.smoothnessScore || 88,
        affectedHand: activeHand,
        therapistFeedback: `${activeHand.toUpperCase()} hand protocol: Target repetitions completed with verified kinematics.`,
      };

      const updated = saveSessionRecord(newSession);
      setSessions(updated);
      setLastCompletedSession(newSession);
      setPatientProfile((prev) => ({
        ...prev,
        totalTherapyMinutes: calculateTotalTherapyMinutes(updated),
      }));
    },
    [selectedExerciseId, currentMetrics, targetHandMode, patientProfile.affectedSide]
  );

  // If user is not logged in, render clinical login portal
  if (!currentUser) {
    return <LoginPortal onLogin={handleLogin} />;
  }

  const currentExerciseDef = EXERCISE_DEFINITIONS[selectedExerciseId];
  const prescription = patientProfile.prescriptions[selectedExerciseId];

  // Daily summary numbers & Total therapy duration
  const todaySessionsCount = sessions.filter(
    (s) => new Date(s.timestamp).toDateString() === new Date().toDateString()
  ).length;
  const totalRehabSeconds = calculateTotalTherapySeconds(sessions);
  const totalRehabMinutes = calculateTotalTherapyMinutes(sessions);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-indigo-50/40 to-teal-50/30 flex flex-col font-sans text-slate-900 selection:bg-indigo-500 selection:text-white">
      {/* Top Clinical Header - Vibrant Energetic Health-Tech Theme */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-b border-indigo-900/60 sticky top-0 z-40 text-white shadow-lg shadow-indigo-950/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand Logo & Clinical Title */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-teal-400 p-0.5 shadow-md shadow-indigo-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950/80 rounded-[14px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-white">
                  NeuroHand <span className="text-teal-400">AR</span>
                </span>
                <span className="bg-gradient-to-r from-indigo-500 to-teal-500 text-white font-mono text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs">
                  v2.6 60FPS
                </span>
              </div>
              <span className="text-[11px] text-indigo-200/80 font-medium tracking-wide block">
                Upper Limb Stroke Neuro-Rehabilitation Studio
              </span>
            </div>
          </div>

          {/* Right Action Bar: Profile & Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* User Profile Badge: Name, Phone, Condition */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-800/80 border border-indigo-800/60 rounded-xl px-3 py-1.5 shadow-xs">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-black shadow-xs">
                Pt
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white block leading-tight">
                    {currentUser.name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">
                    {currentUser.phoneNumber}
                  </span>
                </div>
                <span className="text-[10px] text-teal-300 font-semibold block truncate max-w-[210px]">
                  {currentUser.condition || 'Rehabilitation Case'}
                </span>
              </div>
            </div>

            {/* Role View Toggle */}
            <button
              type="button"
              onClick={() => {
                const nextView = viewMode === 'patient' ? 'therapist' : 'patient';
                setViewMode(nextView);
                showToast(`Switched to ${nextView === 'therapist' ? 'Clinician Portal' : 'Patient Studio'}`);
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
            >
              <User className="w-3.5 h-3.5 text-teal-300" />
              <span>{viewMode === 'patient' ? 'Clinician View' : 'Rehab Studio'}</span>
            </button>

            {/* Audio Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              title={soundEnabled ? 'Mute Biofeedback Sound' : 'Enable Biofeedback Sound'}
              className={`p-2 rounded-xl border text-xs transition-all ${
                soundEnabled
                  ? 'bg-teal-500/20 border-teal-400 text-teal-300 shadow-xs'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={handleLogout}
              title="Log out of clinical portal"
              className="p-2 bg-slate-800/80 hover:bg-rose-950/40 border border-slate-700 hover:border-rose-500 text-slate-300 hover:text-rose-400 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Clinical Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6">
        {/* Toast Notification */}
        {notificationToast && (
          <div className="mb-4 p-3.5 bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl text-xs font-semibold shadow-xl flex items-center justify-between border border-indigo-500/30 animate-fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{notificationToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotificationToast(null)}
              className="text-slate-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {viewMode === 'therapist' ? (
          <TherapistDashboard
            patientProfile={patientProfile}
            sessions={sessions}
            onUpdateProfile={(updated) => {
              setPatientProfile(updated);
              savePatientProfile(updated);
              showToast('Therapist prescription updated successfully.');
            }}
            onDeleteSession={(id) => {
              const updated = deleteSessionRecord(id);
              setSessions(updated);
              setPatientProfile((prev) => ({
                ...prev,
                totalTherapyMinutes: calculateTotalTherapyMinutes(updated),
              }));
              showToast('Session record deleted.');
            }}
            onClearAllSessions={() => {
              const updated = clearAllSessionRecords();
              setSessions(updated);
              setPatientProfile((prev) => ({
                ...prev,
                totalTherapyMinutes: 0,
              }));
              showToast('All session records have been deleted.');
            }}
          />
        ) : (
          <div className="space-y-6">
            {/* Daily Rehabilitation Status & Controls Bar */}
            <div className="bg-gradient-to-r from-white via-indigo-50/50 to-teal-50/40 border-2 border-indigo-200/80 rounded-3xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-md shadow-indigo-500/5">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-extrabold text-slate-900">
                    Daily Neuro-Rehabilitation Plan
                  </h3>
                  <span className="text-slate-300">·</span>
                  <span className="text-xs text-indigo-700 font-mono font-bold bg-indigo-100/80 px-2.5 py-0.5 rounded-full border border-indigo-200">
                    {todaySessionsCount} of {patientProfile.dailyTargetSessions} sets completed today
                  </span>
                </div>
              </div>

              {/* Hand Selector & Quick Controls */}
              <div className="flex items-center flex-wrap gap-2.5">
                {/* Active Hand Mode Selector */}
                <div className="flex items-center bg-white border border-indigo-200 rounded-2xl p-1 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-500 px-2 flex items-center gap-1">
                    <Hand className="w-3.5 h-3.5 text-indigo-600" /> Target Hand:
                  </span>
                  <button
                    type="button"
                    onClick={() => setTargetHandMode('auto')}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      targetHandMode === 'auto'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Auto ⚡
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetHandMode('right');
                      setPatientProfile((prev) => ({ ...prev, affectedSide: 'right' }));
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      targetHandMode === 'right'
                        ? 'bg-amber-500 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Right 🖐️
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetHandMode('left');
                      setPatientProfile((prev) => ({ ...prev, affectedSide: 'left' }));
                    }}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      targetHandMode === 'left'
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    Left 🤚
                  </button>
                </div>

                {/* Monitor Size Toggle (Large vs Small) */}
                <div className="flex items-center bg-white border border-teal-200 rounded-2xl p-1 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setMonitorSize('large')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      monitorSize === 'large'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Large Monitor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMonitorSize('small')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                      monitorSize === 'small'
                        ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>Small</span>
                  </button>
                </div>

                {/* Delete All Data Button */}
                {sessions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete all recorded session data? This will clear all historical sets.')) {
                        const updated = clearAllSessionRecords();
                        setSessions(updated);
                        showToast('All session records cleared.');
                      }
                    }}
                    className="px-3.5 py-2 bg-white hover:bg-rose-50 border border-rose-200 hover:border-rose-300 text-rose-600 hover:text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-1.5 transition-colors shadow-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Delete All Data</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setShowCalibrationModal(true)}
                  className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-2xl flex items-center gap-2 border border-slate-200 transition-colors shadow-xs"
                >
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Calibrate ROM</span>
                </button>
              </div>
            </div>

            {/* Exercise Selector Carousel Cards - Vibrant Distinct Game Colors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
              {Object.values(EXERCISE_DEFINITIONS).map((ex) => {
                const isSelected = selectedExerciseId === ex.id;
                const rx = patientProfile.prescriptions[ex.id];

                // Vibrant Theme Styles per Game
                let cardStyle = '';
                let emoji = '🎮';
                let tagColor = '';

                if (ex.id === 'fruit_catcher') {
                  emoji = '🍓';
                  tagColor = 'text-rose-700 bg-rose-100';
                  cardStyle = isSelected
                    ? 'bg-gradient-to-br from-rose-500 to-red-600 text-white border-rose-600 shadow-lg shadow-rose-500/25 ring-2 ring-rose-300'
                    : 'bg-gradient-to-br from-rose-50/70 via-red-50/30 to-white border-rose-200 hover:border-rose-400 text-slate-900';
                } else if (ex.id === 'finger_isolation') {
                  emoji = '🎈';
                  tagColor = 'text-purple-700 bg-purple-100';
                  cardStyle = isSelected
                    ? 'bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white border-purple-600 shadow-lg shadow-purple-500/25 ring-2 ring-purple-300'
                    : 'bg-gradient-to-br from-purple-50/70 via-fuchsia-50/30 to-white border-purple-200 hover:border-purple-400 text-slate-900';
                } else if (ex.id === 'pinch_harvest') {
                  emoji = '🍒';
                  tagColor = 'text-amber-800 bg-amber-100';
                  cardStyle = isSelected
                    ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-amber-600 shadow-lg shadow-amber-500/25 ring-2 ring-amber-300'
                    : 'bg-gradient-to-br from-amber-50/70 via-yellow-50/30 to-white border-amber-200 hover:border-amber-400 text-slate-900';
                } else if (ex.id === 'lotus_bloom') {
                  emoji = '🪷';
                  tagColor = 'text-teal-800 bg-teal-100';
                  cardStyle = isSelected
                    ? 'bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-teal-600 shadow-lg shadow-teal-500/25 ring-2 ring-teal-300'
                    : 'bg-gradient-to-br from-teal-50/70 via-cyan-50/30 to-white border-teal-200 hover:border-teal-400 text-slate-900';
                } else if (ex.id === 'wrist_glider') {
                  emoji = '⭐';
                  tagColor = 'text-indigo-800 bg-indigo-100';
                  cardStyle = isSelected
                    ? 'bg-gradient-to-br from-indigo-600 via-purple-600 to-sky-500 text-white border-indigo-400 shadow-lg shadow-indigo-500/25 ring-2 ring-sky-300'
                    : 'bg-gradient-to-br from-indigo-50/70 via-sky-50/30 to-white border-indigo-200 hover:border-indigo-400 text-slate-900';
                }

                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(ex.id);
                      audioBiofeedback.playSuccessChime();
                    }}
                    className={`text-left p-4 rounded-3xl border transition-all relative overflow-hidden flex flex-col justify-between cursor-pointer ${cardStyle}`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`text-[10px] font-mono font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isSelected ? 'bg-white/20 text-white' : tagColor
                          }`}
                        >
                          {ex.category.split('&')[0].trim()}
                        </span>
                        {isSelected && (
                          <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                        )}
                      </div>

                      <h4 className="text-sm font-black mb-1 flex items-center gap-1.5">
                        <span className="text-base">{emoji}</span>
                        <span>{ex.name}</span>
                      </h4>
                      <p
                        className={`text-xs line-clamp-2 leading-relaxed font-medium ${
                          isSelected ? 'text-white/90' : 'text-slate-600'
                        }`}
                      >
                        {ex.clinicalGoal}
                      </p>
                    </div>

                    <div
                      className={`mt-4 pt-3 border-t flex items-center justify-between text-xs font-mono font-bold ${
                        isSelected ? 'border-white/20 text-white' : 'border-slate-100 text-slate-500'
                      }`}
                    >
                      <span>{rx?.targetReps || ex.recommendedReps} reps</span>
                      <span className="font-sans flex items-center gap-1 font-bold">
                        {isSelected ? 'Active' : 'Play'} <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Active Rehab Studio & AR Viewport - Dynamic Layout for Large vs Small Monitor */}
            <div
              className={`grid grid-cols-1 ${
                monitorSize === 'large' ? 'lg:grid-cols-12' : 'lg:grid-cols-12'
              } gap-6`}
            >
              {/* AR Tracker Viewport with Overlaid Games */}
              <div
                className={`${
                  monitorSize === 'large' ? 'lg:col-span-12' : 'lg:col-span-8'
                } flex flex-col gap-4`}
              >
                <ARHandTracker
                  exerciseId={selectedExerciseId}
                  affectedSide={patientProfile.affectedSide}
                  targetHandMode={targetHandMode}
                  onHandModeChange={setTargetHandMode}
                  monitorSize={monitorSize}
                  onToggleMonitorSize={() => setMonitorSize((m) => (m === 'large' ? 'small' : 'large'))}
                  targetPinchMm={32}
                  bloomThresholdPercent={65}
                  promptedFingerIndex={promptedFingerIndex}
                  onMetricsUpdate={handleMetricsUpdate}
                  showBiofeedbackOverlay={true}
                >
                  {/* GAME 1: Fruit Drop & Catch */}
                  {selectedExerciseId === 'fruit_catcher' && (
                    <FruitDropCatchGame
                      metrics={currentMetrics}
                      landmarks={currentLandmarks}
                      targetReps={prescription?.targetReps || 15}
                      onSessionComplete={handleSessionComplete}
                    />
                  )}

                  {/* GAME 2: Color Balloon Pop */}
                  {selectedExerciseId === 'finger_isolation' && (
                    <FingerIsolationGame
                      metrics={currentMetrics}
                      landmarks={currentLandmarks}
                      targetReps={prescription?.targetReps || 16}
                      onSessionComplete={handleSessionComplete}
                      onSetPromptedFinger={setPromptedFingerIndex}
                    />
                  )}

                  {/* GAME 3: Pinch & Fruit Harvest */}
                  {selectedExerciseId === 'pinch_harvest' && (
                    <PinchHarvestGame
                      metrics={currentMetrics}
                      landmarks={currentLandmarks}
                      targetReps={prescription?.targetReps || 15}
                      onSessionComplete={handleSessionComplete}
                    />
                  )}

                  {/* GAME 4: Lotus Bloom */}
                  {selectedExerciseId === 'lotus_bloom' && (
                    <LotusBloomGame
                      metrics={currentMetrics}
                      landmarks={currentLandmarks}
                      targetReps={prescription?.targetReps || 12}
                      bloomThresholdPercent={65}
                      onSessionComplete={handleSessionComplete}
                    />
                  )}

                  {/* GAME 5: Cosmic Star Reach & Touch */}
                  {selectedExerciseId === 'wrist_glider' && (
                    <StarReachGame
                      metrics={currentMetrics}
                      landmarks={currentLandmarks}
                      targetReps={prescription?.targetReps || 14}
                      onSessionComplete={handleSessionComplete}
                    />
                  )}
                </ARHandTracker>
              </div>

              {/* Side/Bottom Columns: Biometrics & Rehabilitation Directives */}
              <div
                className={`${
                  monitorSize === 'large'
                    ? 'lg:col-span-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    : 'lg:col-span-4 flex flex-col'
                } gap-5`}
              >
                {/* Protocol Card */}
                <div className="bg-white border-2 border-indigo-100 rounded-3xl p-5 space-y-4 shadow-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span>{currentExerciseDef.name}</span>
                    </h4>
                    <span className="text-xs bg-indigo-50 border border-indigo-200 text-indigo-800 font-bold px-2.5 py-0.5 rounded-full">
                      {prescription?.targetReps || currentExerciseDef.recommendedReps} Rep Target
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-1 font-bold">Target Muscle Groups</span>
                    <span className="text-xs text-indigo-950 font-mono block bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-2xl border border-indigo-200 font-bold">
                      {currentExerciseDef.focusMuscles}
                    </span>
                  </div>

                  <div>
                    <span className="text-xs text-slate-500 block mb-2 font-bold">Clinical Instructions</span>
                    <ol className="space-y-1.5 text-xs text-slate-700 list-decimal pl-4 leading-relaxed font-medium">
                      {currentExerciseDef.instructions.map((inst, idx) => (
                        <li key={idx}>{inst}</li>
                      ))}
                    </ol>
                  </div>
                </div>

                {/* Live Joint Telemetry Card with Vibrant Colorful Gauges */}
                <div className="bg-white border-2 border-teal-100 rounded-3xl p-5 space-y-4 shadow-sm text-slate-800">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                      <span>Live Kinematics</span>
                    </h4>
                    <span
                      className={`text-xs font-mono font-black px-2.5 py-0.5 rounded-full border ${
                        currentMetrics?.detectedHand === 'right'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-cyan-100 text-cyan-900 border-cyan-300'
                      }`}
                    >
                      {currentMetrics?.detectedHand
                        ? `${currentMetrics.detectedHand.toUpperCase()} HAND`
                        : 'WAITING HAND'}
                    </span>
                  </div>

                  <div className="space-y-3 font-mono text-xs">
                    <div>
                      <div className="flex justify-between text-slate-600 mb-1 font-sans text-xs font-bold">
                        <span>Pinch Contact Aperture</span>
                        <span className="text-amber-700 font-mono font-black">
                          {currentMetrics?.pinchAperture || 0} mm
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-75"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, ((50 - (currentMetrics?.pinchAperture || 0)) / 50) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-600 mb-1 font-sans text-xs font-bold">
                        <span>Finger Extension (AROM)</span>
                        <span className="text-teal-700 font-mono font-black">
                          {currentMetrics?.avgFingerExtension || 0}°
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-teal-400 to-emerald-500 transition-all duration-75"
                          style={{
                            width: `${Math.max(
                              0,
                              Math.min(100, (((currentMetrics?.avgFingerExtension || 90) - 60) / 120) * 100)
                            )}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-slate-600 mb-1 font-sans text-xs font-bold">
                        <span>Motor Stability & Smoothness</span>
                        <span className="text-emerald-700 font-mono font-black">
                          {currentMetrics?.smoothnessScore || 85}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-cyan-500 transition-all duration-75"
                          style={{ width: `${currentMetrics?.smoothnessScore || 85}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600 font-sans font-medium">
                      <span>Tremor Index:</span>
                      <span className="text-slate-900 font-black font-mono">
                        {currentMetrics?.tremorIndex || 1.2} / 10
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Prescription Progress Card */}
                <div className="bg-gradient-to-br from-indigo-900 via-purple-950 to-slate-900 rounded-3xl p-5 text-white flex flex-col justify-between shadow-lg shadow-indigo-900/10">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-mono text-teal-300 font-bold uppercase tracking-wider">
                        Patient Profile
                      </span>
                      <Award className="w-4 h-4 text-amber-400" />
                    </div>
                    <h4 className="text-base font-black text-white">{patientProfile.fullName}</h4>
                    <p className="text-xs font-semibold text-teal-300 mt-0.5">
                      {patientProfile.condition || currentUser?.condition || 'Upper Limb Neuromotor Case'}
                    </p>
                    <p className="text-[11px] font-mono text-indigo-200 mt-0.5">
                      📱 {patientProfile.phoneNumber || currentUser?.phoneNumber}
                    </p>
                    <p className="text-xs text-indigo-200/90 mt-2 leading-relaxed">
                      Target Hand:{' '}
                      <span className="font-bold text-white uppercase">{targetHandMode}</span> (Prescribed:{' '}
                      <span className="font-bold text-teal-300 uppercase">
                        {patientProfile.affectedSide}
                      </span>
                      )
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-indigo-800/80 flex items-center justify-between">
                    <div className="text-left">
                      <span className="text-[10px] text-indigo-300 block font-semibold">Total Rehab Time</span>
                      <div className="flex items-baseline gap-1.5 font-mono">
                        <span className="text-sm font-bold text-white">
                          {formatRehabDuration(totalRehabSeconds)}
                        </span>
                        <span className="text-[11px] text-teal-300 font-sans font-medium">
                          ({totalRehabMinutes}m logged)
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCalibrationModal(true)}
                      className="px-3 py-1.5 bg-gradient-to-r from-teal-400 to-emerald-500 hover:from-teal-300 hover:to-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all shadow-md"
                    >
                      Recalibrate ROM
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Patient Session History Table with Direct Delete Buttons */}
            {sessions.length > 0 && (
              <div className="bg-white border-2 border-indigo-100 rounded-3xl overflow-hidden shadow-md shadow-indigo-500/5 mt-6">
                <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 via-indigo-50/30 to-slate-50">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">Recent Rehabilitation History</h4>
                    <span className="text-xs text-slate-500 font-medium">
                      {sessions.length} sets logged in session memory · Click Delete to remove any entry
                    </span>
                  </div>

                    <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('Delete all recorded session data? This will clear all historical sets.')) {
                        const updated = clearAllSessionRecords();
                        setSessions(updated);
                        setPatientProfile((prev) => ({
                          ...prev,
                          totalTherapyMinutes: 0,
                        }));
                        showToast('All session records cleared.');
                      }
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <span>Clear All</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-mono uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="p-3.5 pl-5">Date & Time</th>
                        <th className="p-3.5">Exercise Protocol</th>
                        <th className="p-3.5">Hand</th>
                        <th className="p-3.5">Repetitions</th>
                        <th className="p-3.5">Duration</th>
                        <th className="p-3.5">Peak Extension</th>
                        <th className="p-3.5">Pinch Contact</th>
                        <th className="p-3.5 pr-5">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {sessions.slice(0, 5).map((s) => (
                        <tr key={s.id} className="hover:bg-indigo-50/40 transition-colors">
                          <td className="p-3.5 pl-5 text-slate-600 font-medium">
                            {new Date(s.timestamp).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="p-3.5 text-slate-900 font-sans font-bold">{s.exerciseTitle}</td>
                          <td className="p-3.5 font-bold">
                            <span
                              className={`px-2 py-0.5 rounded-md text-[11px] uppercase ${
                                s.affectedHand === 'right'
                                   ? 'bg-amber-100 text-amber-900'
                                  : 'bg-cyan-100 text-cyan-900'
                              }`}
                            >
                              {s.affectedHand}
                            </span>
                          </td>
                          <td className="p-3.5 text-indigo-700 font-black">
                            {s.repsCompleted} / {s.targetReps}
                          </td>
                          <td className="p-3.5 text-slate-600 font-mono font-bold">{formatRehabDuration(s.durationSeconds || 0)}</td>
                          <td className="p-3.5 text-teal-700 font-bold">{s.peakExtensionAngle || 135}°</td>
                          <td className="p-3.5 text-amber-700 font-bold">{s.bestPinchMm || 24} mm</td>
                          <td className="p-3.5 pr-5 font-sans">
                            <button
                              type="button"
                              onClick={() => {
                                const updated = deleteSessionRecord(s.id);
                                setSessions(updated);
                                setPatientProfile((prev) => ({
                                  ...prev,
                                  totalTherapyMinutes: calculateTotalTherapyMinutes(updated),
                                }));
                                showToast('Session record deleted.');
                              }}
                              className="px-2.5 py-1 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>Delete</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
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
              prescriptions: {
                ...patientProfile.prescriptions,
                fruit_catcher: {
                  ...patientProfile.prescriptions.fruit_catcher,
                  customHoldTime: baseline.maxExtension > 140 ? 0.4 : 0.8,
                },
              },
            };
            setPatientProfile(updated);
            savePatientProfile(updated);
            setShowCalibrationModal(false);
            showToast('Biomechanical baseline calibrated successfully.');
          }}
          onClose={() => setShowCalibrationModal(false)}
        />
      )}

      {/* Session Completed Celebration Modal with Working Delete Option */}
      {lastCompletedSession && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border-2 border-indigo-200 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl relative animate-scale-in">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-amber-400 to-orange-500 flex items-center justify-center text-white mx-auto mb-4 shadow-lg shadow-orange-500/25">
              <Award className="w-8 h-8" />
            </div>

            <h3 className="text-xl font-extrabold text-slate-900">
              Session Goal Accomplished! 🎉
            </h3>
            <p className="text-xs text-slate-600 mt-1 font-medium">
              {lastCompletedSession.exerciseTitle} · {lastCompletedSession.repsCompleted} repetitions logged
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-5 p-3.5 bg-gradient-to-br from-indigo-50/70 to-teal-50/50 rounded-2xl border border-indigo-100 font-mono text-xs">
              <div className="text-left">
                <span className="text-slate-500 block text-[10px] font-sans">Session Duration</span>
                <span className="text-indigo-800 font-bold text-sm">
                  {formatRehabDuration(lastCompletedSession.durationSeconds)}
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[10px] font-sans">Total Rehab Time</span>
                <span className="text-teal-700 font-bold text-sm">
                  {formatRehabDuration(totalRehabSeconds)}
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[10px] font-sans">Accuracy</span>
                <span className="text-emerald-700 font-bold text-sm">
                  {lastCompletedSession.accuracyScore}%
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[10px] font-sans">Hand Exercised</span>
                <span className="text-indigo-800 font-bold text-sm uppercase">
                  {lastCompletedSession.affectedHand} Hand
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[10px] font-sans">Peak Extension</span>
                <span className="text-teal-700 font-bold text-sm">
                  {lastCompletedSession.peakExtensionAngle}°
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[10px] font-sans">Best Pinch</span>
                <span className="text-amber-700 font-bold text-sm">
                  {lastCompletedSession.bestPinchMm} mm
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => setLastCompletedSession(null)}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-indigo-600/25 transition-all"
              >
                Continue Rehabilitation
              </button>

              <button
                type="button"
                onClick={() => {
                  if (lastCompletedSession) {
                    const updated = deleteSessionRecord(lastCompletedSession.id);
                    setSessions(updated);
                    setPatientProfile((prev) => ({
                      ...prev,
                      totalTherapyMinutes: calculateTotalTherapyMinutes(updated),
                    }));
                    setLastCompletedSession(null);
                    showToast('Session record deleted.');
                  }
                }}
                className="w-full py-2.5 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-slate-500 hover:text-rose-700 font-bold text-xs rounded-2xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                <span>Delete This Session Data</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
