import React, { useState } from 'react';
import { UserAccount, COMMON_CONDITIONS, DEFAULT_USER } from '../../types/auth';
import { Activity, User, Phone, Stethoscope, ArrowRight, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react';

interface LoginPortalProps {
  onLogin: (user: UserAccount) => void;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ onLogin }) => {
  const [name, setName] = useState<string>('Eleanor Vance');
  const [phoneNumber, setPhoneNumber] = useState<string>('+1 (555) 839-2019');
  const [condition, setCondition] = useState<string>('Stroke / Hemiparesis');
  const [customCondition, setCustomCondition] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!phoneNumber.trim()) {
      setErrorMessage('Please enter a valid phone number.');
      return;
    }

    const finalCondition = condition === 'Other' && customCondition.trim()
      ? customCondition.trim()
      : condition.trim() || 'General Upper Limb Rehabilitation';

    const account: UserAccount = {
      id: `pt-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      phoneNumber: phoneNumber.trim(),
      condition: finalCondition,
      role: 'patient',
      title: `${finalCondition} Patient`,
      patientId: `PT-${Math.floor(1000 + Math.random() * 9000)}`,
      organization: 'AR Neuro-Rehabilitation Clinic',
    };

    onLogin(account);
  };

  const handleQuickFill = (presetName: string, presetPhone: string, presetCondition: string) => {
    setName(presetName);
    setPhoneNumber(presetPhone);
    setCondition(presetCondition);
    setCustomCondition('');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 flex flex-col justify-between font-sans text-slate-100 selection:bg-indigo-500 selection:text-white">
      {/* Top Clinical Header Banner */}
      <div className="bg-slate-950/70 backdrop-blur-md border-b border-indigo-900/60 py-3.5 px-6 shadow-xl">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-teal-400 p-0.5 shadow-md flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Activity className="w-5 h-5 text-teal-400" />
              </div>
            </div>
            <div>
              <span className="font-extrabold text-base text-white tracking-tight block">
                NeuroHand <span className="text-teal-400">AR</span>
              </span>
              <span className="text-[11px] text-indigo-300 font-semibold tracking-wide block uppercase">
                Patient Intake & Tele-Rehabilitation Portal
              </span>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-indigo-200/90 font-medium bg-indigo-950/70 border border-indigo-800/60 px-3.5 py-1.5 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-teal-400" />
            <span>Private & Encrypted · Local On-Device AI</span>
          </div>
        </div>
      </div>

      {/* Main Patient Intake Card */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-auto">
        <div className="max-w-lg w-full bg-white/95 backdrop-blur-xl border-2 border-indigo-200/90 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-900 space-y-6">
          {/* Header Title */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-purple-600 to-teal-400 text-white shadow-lg shadow-indigo-500/25 mb-1">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Patient Information Portal</h2>
            <p className="text-xs text-slate-600 font-medium">
              Please enter your name, phone number, and type of condition to launch your AR rehabilitation session
            </p>
          </div>

          {/* Quick Preset Selector Buttons */}
          <div className="p-3 bg-gradient-to-r from-indigo-50/80 via-teal-50/60 to-purple-50/60 border border-indigo-200/80 rounded-2xl space-y-2">
            <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 block flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Quick Example Cases:
            </span>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickFill('Eleanor Vance', '+1 (555) 839-2019', 'Stroke / Hemiparesis')}
                className="px-2.5 py-1 bg-white hover:bg-indigo-50 border border-indigo-200 text-indigo-900 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                🧠 Stroke Case
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('Robert Miller', '+1 (555) 492-1102', "Parkinson's Disease (Hand Tremor & Rigidity)")}
                className="px-2.5 py-1 bg-white hover:bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                ✋ Parkinson's Case
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('Sarah Jenkins', '+1 (555) 728-9941', 'Carpal Tunnel & Peripheral Nerve Injury')}
                className="px-2.5 py-1 bg-white hover:bg-teal-50 border border-teal-200 text-teal-900 rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                ⚡ Carpal Tunnel
              </button>
            </div>
          </div>

          {/* Strict 3-Field Intake Form */}
          <form onSubmit={handleSubmit} className="space-y-4.5">
            {errorMessage && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold">
                {errorMessage}
              </div>
            )}

            {/* FIELD 1: Full Name */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-indigo-600" />
                <span>Patient Full Name</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eleanor Vance"
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold shadow-xs outline-none transition-all"
              />
            </div>

            {/* FIELD 2: Phone Number */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-teal-600" />
                <span>Phone Number</span>
                <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +1 (555) 839-2019"
                className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-mono font-bold shadow-xs outline-none transition-all"
              />
            </div>

            {/* FIELD 3: Type of Disease, Disorder or Case */}
            <div>
              <label className="text-xs font-bold text-slate-800 block mb-1.5 flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
                <span>Type of Disease, Disorder or Case</span>
                <span className="text-rose-500">*</span>
              </label>

              {/* Quick Disease Selection Pills */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2.5 max-h-48 overflow-y-auto pr-1">
                {COMMON_CONDITIONS.map((cond) => {
                  const isSelected = condition === cond;
                  return (
                    <button
                      key={cond}
                      type="button"
                      onClick={() => {
                        setCondition(cond);
                        setCustomCondition('');
                      }}
                      className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all border flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      <span className="line-clamp-1">{cond}</span>
                      {isSelected && <CheckCircle2 className="w-3.5 h-3.5 text-teal-300 shrink-0 ml-1" />}
                    </button>
                  );
                })}

                {/* Option for custom condition */}
                <button
                  type="button"
                  onClick={() => setCondition('Other')}
                  className={`p-2.5 rounded-xl text-left text-xs font-bold transition-all border flex items-center justify-between cursor-pointer ${
                    condition === 'Other'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-indigo-600 shadow-md shadow-indigo-500/20'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                  }`}
                >
                  <span>✏️ Other Custom Condition / Case</span>
                  {condition === 'Other' && <CheckCircle2 className="w-3.5 h-3.5 text-teal-300 shrink-0 ml-1" />}
                </button>
              </div>

              {/* Text Input for Custom or Specific Condition */}
              {condition === 'Other' && (
                <div className="mt-2">
                  <input
                    type="text"
                    required
                    value={customCondition}
                    onChange={(e) => setCustomCondition(e.target.value)}
                    placeholder="Enter specific diagnosis, injury, or case details..."
                    className="w-full bg-white border-2 border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 font-semibold shadow-xs outline-none"
                  />
                </div>
              )}
            </div>

            {/* Launch Button */}
            <div className="pt-2">
              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-teal-500 hover:from-indigo-500 hover:via-purple-500 hover:to-teal-400 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 transition-all shadow-xl shadow-indigo-600/25 group cursor-pointer"
              >
                <span>Start AR Rehabilitation Session</span>
                <ArrowRight className="w-4 h-4 text-teal-200 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-indigo-200/70 border-t border-indigo-900/60 bg-slate-950/70">
        <p className="text-[11px]">
          NeuroHand AR System v2.6 · Digital Upper-Limb Neuromotor Therapeutics · Private Camera Stream
        </p>
      </footer>
    </div>
  );
};
