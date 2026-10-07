import React, { useState, useEffect } from 'react';
import { HandMetrics } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import { ShieldCheck, CheckCircle2, ChevronRight, RotateCcw } from 'lucide-react';

interface BaselineAssessmentModalProps {
  metrics: HandMetrics | null;
  onComplete: (baseline: { minAperture: number; maxExtension: number; maxBloom: number }) => void;
  onClose: () => void;
}

export const BaselineAssessmentModal: React.FC<BaselineAssessmentModalProps> = ({
  metrics,
  onComplete,
  onClose,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recordedMinAperture, setRecordedMinAperture] = useState<number>(35);
  const [recordedMaxExtension, setRecordedMaxExtension] = useState<number>(115);
  const [recordedMaxBloom, setRecordedMaxBloom] = useState<number>(60);
  const [sampleCountdown, setSampleCountdown] = useState<number>(3);

  // Step 1: Open Hand Extension Test
  // Step 2: Pinch Aperture Test
  // Step 3: Confirmation & Dynamic Calibration

  useEffect(() => {
    if (!metrics) return;

    if (step === 1) {
      if (metrics.avgFingerExtension > recordedMaxExtension) {
        setRecordedMaxExtension(metrics.avgFingerExtension);
      }
      if (metrics.handOpenRatio > recordedMaxBloom) {
        setRecordedMaxBloom(metrics.handOpenRatio);
      }
    } else if (step === 2) {
      if (metrics.pinchAperture < recordedMinAperture && metrics.pinchAperture > 5) {
        setRecordedMinAperture(metrics.pinchAperture);
      }
    }
  }, [metrics, step, recordedMaxExtension, recordedMaxBloom, recordedMinAperture]);

  const handleNextStep = () => {
    audioBiofeedback.playSuccessChime();
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      onComplete({
        minAperture: recordedMinAperture,
        maxExtension: recordedMaxExtension,
        maxBloom: recordedMaxBloom,
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-teal-400" />
            <h3 className="text-base font-semibold text-white">Clinical Range of Motion Baseline</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">Step {step} of 3</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Step 1: Active Finger Extension (AROM)</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Show your affected hand to the camera and open your fingers as wide as possible without straining. Hold for 3 seconds so we can measure your current extensor reach.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 font-mono">
              <div>
                <span className="text-[11px] text-slate-400 block font-sans">Current Extension</span>
                <span className="text-2xl font-bold text-teal-400">{metrics?.avgFingerExtension || 110}°</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-sans">Peak Recorded</span>
                <span className="text-2xl font-bold text-white">{recordedMaxExtension}°</span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Step 2: Pincer Grasp Calibration</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Bring your thumb and index finger together into a gentle pinch. This sets your individual target threshold so exercises stay within your therapeutic capacity.
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 grid grid-cols-2 gap-4 font-mono">
              <div>
                <span className="text-[11px] text-slate-400 block font-sans">Current Pinch Gap</span>
                <span className="text-2xl font-bold text-amber-400">{metrics?.pinchAperture || 35} mm</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 block font-sans">Best Contact Aperture</span>
                <span className="text-2xl font-bold text-white">{recordedMinAperture} mm</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-white">Baseline Assessment Completed</h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Your rehabilitation targets have been customized to your current motor capacity:
            </p>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Active Extension Baseline:</span>
                <span className="font-mono text-teal-400 font-semibold">{recordedMaxExtension}°</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Pinch Aperture Sensitivity:</span>
                <span className="font-mono text-amber-400 font-semibold">{recordedMinAperture} mm</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span>Recommended Bloom Threshold:</span>
                <span className="font-mono text-white font-semibold">{Math.max(50, recordedMaxBloom - 5)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleNextStep}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>{step === 3 ? 'Apply Clinical Baseline' : 'Next Step'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
