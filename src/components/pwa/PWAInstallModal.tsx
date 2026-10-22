import { memo, useState, useEffect } from 'react';
import { X, Download, Zap, Shield, Rocket, Check, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UsePWAInstallReturn } from '@/hooks/usePWAInstall';
import { trackPWAPromptShown, trackPWAInstallAccepted, trackPWAInstallDismissed } from '@/lib/analytics';

interface PWAInstallModalProps {
  pwa: UsePWAInstallReturn;
}

export const PWAInstallModal = memo(function PWAInstallModal({ pwa }: PWAInstallModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isAutoVisible, setIsAutoVisible] = useState(false);

  // Auto-prompt after engagement (reduced delay to 6s)
  useEffect(() => {
    if (pwa.isInstalled || pwa.isDismissed) return;
    if (!pwa.isInstallable && !pwa.isIOS) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const showPrompt = () => {
      if (timer) return;
      timer = setTimeout(() => {
        setIsAutoVisible(true);
        trackPWAPromptShown();
      }, 6000);
      window.removeEventListener('pointerdown', onEngage);
      window.removeEventListener('keydown', onEngage);
      window.removeEventListener('scroll', onEngage);
    };
    const onEngage = () => showPrompt();

    window.addEventListener('pointerdown', onEngage, { once: true, passive: true });
    window.addEventListener('keydown', onEngage, { once: true });
    window.addEventListener('scroll', onEngage, { once: true, passive: true });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener('pointerdown', onEngage);
      window.removeEventListener('keydown', onEngage);
      window.removeEventListener('scroll', onEngage);
    };
  }, [pwa.isInstallable, pwa.isIOS, pwa.isInstalled, pwa.isDismissed]);

  // Modal displays if triggered manually via pwa.openModal OR automatically
  const isVisible = pwa.isModalOpen || (isAutoVisible && !pwa.isDismissed && !pwa.isInstalled);

  if (!isVisible) return null;

  const handleInstall = async () => {
    if (pwa.isIOS || (!pwa.isInstallable && !pwa.isIOS)) {
      pwa.closeModal();
      setIsAutoVisible(false);
      pwa.dismissPrompt(dontShowAgain);
      trackPWAInstallAccepted();
      return;
    }

    const accepted = await pwa.promptInstall();
    if (accepted) {
      trackPWAInstallAccepted();
    } else {
      trackPWAInstallDismissed();
    }
    pwa.closeModal();
    setIsAutoVisible(false);
  };

  const handleDismiss = () => {
    pwa.closeModal();
    setIsAutoVisible(false);
    pwa.dismissPrompt(dontShowAgain);
    trackPWAInstallDismissed();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="
            pointer-events-auto w-full max-w-md
            bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800
            rounded-2xl shadow-2xl shadow-black/30
            animate-modal-scale-in overflow-hidden transition-colors
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-slate-850 p-1 flex items-center justify-center shadow-md">
                <img src="/logo.png?v=2" alt="ScreenCraft" className="w-10 h-10 rounded-lg object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">Install ScreenCraft</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Desktop & Mobile Web App (PWA)</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="px-6 pb-4 space-y-2.5">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#181c28] border border-slate-200/70 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">100% Offline Access</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Launches instantly without an internet connection once cached.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#181c28] border border-slate-200/70 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Total Privacy on Device</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Zero remote uploads. All captures remain securely in your local memory.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#181c28] border border-slate-200/70 dark:border-slate-800">
              <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Rocket className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Native Dock & Taskbar Shortcut</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Opens in a distraction-free window without browser URL bars.</p>
              </div>
            </div>
          </div>

          {/* iOS Instructions */}
          {pwa.isIOS && (
            <div className="px-6 pb-3">
              <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs text-indigo-900 dark:text-indigo-300 leading-relaxed">
                <p className="font-semibold mb-1">To install on iOS / Safari:</p>
                <p>1. Tap the <strong>Share</strong> button in Safari toolbar</p>
                <p>2. Scroll down and tap <strong>Add to Home Screen</strong> ➕</p>
              </div>
            </div>
          )}

          {/* Desktop Manual Instructions when browser hasn't fired prompt */}
          {!pwa.isInstallable && !pwa.isIOS && (
            <div className="px-6 pb-3">
              <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-slate-100 mb-1">
                  <Monitor className="w-3.5 h-3.5 text-[hsl(245,79%,55%)]" />
                  <span>How to install on Desktop:</span>
                </div>
                <p>• <strong>Chrome / Edge / Brave:</strong> Click the <strong>Install (⊕)</strong> icon on the right side of the address bar, or click Menu <strong>⋮</strong> &rarr; <strong>Install ScreenCraft</strong>.</p>
                <p className="mt-1">• <strong>macOS Safari:</strong> Click <strong>File</strong> in the top menu bar &rarr; <strong>Add to Dock...</strong></p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-4 pt-1 space-y-2">
            <Button
              onClick={handleInstall}
              className="w-full bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,47%)] text-white h-11 text-sm font-medium shadow-md shadow-[hsl(245,79%,55%)]/20 rounded-xl transition-all"
            >
              {pwa.isInstallable ? (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Install ScreenCraft Now
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Got It, Thanks!
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="w-full text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 h-9 text-xs rounded-xl"
            >
              Not Now
            </Button>
          </div>

          {/* Don't show again toggle */}
          <div className="px-6 pb-5 flex items-center justify-center">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 dark:border-white/20 bg-slate-100 dark:bg-white/5 text-[hsl(245,79%,55%)] focus:ring-[hsl(245,79%,55%)]/30 focus:ring-2 cursor-pointer"
              />
              <span className="text-xs text-slate-500 dark:text-slate-400 group-hover:text-slate-800 dark:group-hover:text-slate-200 transition-colors select-none">
                Don't show automatic prompt again
              </span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
});
