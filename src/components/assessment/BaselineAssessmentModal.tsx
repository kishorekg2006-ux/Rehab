import React, { useState, useEffect } from 'react';
import { HandMetrics } from '../../types/rehab';
import { audioBiofeedback } from '../../utils/audioBiofeedback';
import { ShieldCheck, ChevronRight } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <h3 className="text-base font-bold text-slate-900">Clinical Range of Motion Baseline</h3>
          </div>
          <span className="text-xs font-mono text-slate-500 font-semibold">Step {step} of 3</span>
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Step 1: Active Finger Extension (AROM)</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Show your affected hand to the camera and open your fingers as wide as possible without straining. We will measure your extensor range.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 font-mono">
              <div>
                <span className="text-[11px] text-slate-500 block font-sans font-semibold">Current Extension</span>
                <span className="text-2xl font-bold text-teal-700">{metrics?.avgFingerExtension || 110}°</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block font-sans font-semibold">Peak Recorded</span>
                <span className="text-2xl font-bold text-slate-900">{recordedMaxExtension}°</span>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Step 2: Pincer Grasp Calibration</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bring your thumb and index finger together into a gentle pinch. This sets your individual target threshold so exercises stay within your therapeutic capacity.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 grid grid-cols-2 gap-4 font-mono">
              <div>
                <span className="text-[11px] text-slate-500 block font-sans font-semibold">Current Pinch Gap</span>
                <span className="text-2xl font-bold text-amber-600">{metrics?.pinchAperture || 35} mm</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block font-sans font-semibold">Best Contact Aperture</span>
                <span className="text-2xl font-bold text-slate-900">{recordedMinAperture} mm</span>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Baseline Assessment Completed</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your rehabilitation targets have been customized to your current motor capacity:
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Active Extension Baseline:</span>
                <span className="font-mono text-teal-700 font-bold">{recordedMaxExtension}°</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Pinch Aperture Sensitivity:</span>
                <span className="font-mono text-amber-600 font-bold">{recordedMinAperture} mm</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span className="font-semibold">Recommended Bloom Threshold:</span>
                <span className="font-mono text-slate-900 font-bold">{Math.max(50, recordedMaxBloom - 5)}%</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 font-semibold"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleNextStep}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <span>{step === 3 ? 'Apply Clinical Baseline' : 'Next Step'}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
