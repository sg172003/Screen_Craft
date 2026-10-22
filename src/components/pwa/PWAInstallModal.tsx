import { memo, useState } from 'react';
import { X, Download, Zap, Shield, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UsePWAInstallReturn } from '@/hooks/usePWAInstall';
import { trackPWAPromptShown, trackPWAInstallAccepted, trackPWAInstallDismissed } from '@/lib/analytics';
import { useEffect } from 'react';

interface PWAInstallModalProps {
  pwa: UsePWAInstallReturn;
}

export const PWAInstallModal = memo(function PWAInstallModal({ pwa }: PWAInstallModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Ask only after visitors engage with the landing page, then give them time to explore.
  useEffect(() => {
    if (pwa.isInstalled || pwa.isDismissed) return;
    if (!pwa.isInstallable && !pwa.isIOS) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const showPrompt = () => {
      if (timer) return;
      timer = setTimeout(() => {
        setIsVisible(true);
        trackPWAPromptShown();
      }, 20000);
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

  if (!isVisible || pwa.isInstalled || pwa.isDismissed) return null;

  const handleInstall = async () => {
    if (pwa.isIOS) {
      // On iOS, we just show instructions, then dismiss
      pwa.dismissPrompt(false);
      trackPWAInstallAccepted();
      setIsVisible(false);
      return;
    }
    const accepted = await pwa.promptInstall();
    if (accepted) {
      trackPWAInstallAccepted();
    } else {
      trackPWAInstallDismissed();
    }
    setIsVisible(false);
  };

  const handleDismiss = () => {
    pwa.dismissPrompt(dontShowAgain);
    trackPWAInstallDismissed();
    setIsVisible(false);
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
            bg-[hsl(220,15%,13%)] border border-white/10
            rounded-2xl shadow-2xl shadow-black/40
            animate-fade-in overflow-hidden
          "
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative px-6 pt-6 pb-4">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-white/40 hover:text-white/80 transition-colors p-1 rounded-lg hover:bg-white/5"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[hsl(245,79%,55%)] to-[hsl(280,70%,55%)] flex items-center justify-center shadow-lg shadow-[hsl(245,79%,55%)]/30">
                <img src="/logo.png?v=2" alt="ScreenCraft" className="w-8 h-8 rounded-lg" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Install ScreenCraft</h2>
                <p className="text-xs text-white/50">Get the full app experience</p>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="px-6 pb-4 space-y-3">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 card-hover">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">Offline Access After Caching</p>
                <p className="text-xs text-white/45 mt-0.5">After its app assets are cached, ScreenCraft can open without a connection.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 card-hover">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Shield className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">Your Media Stays on This Device</p>
                <p className="text-xs text-white/45 mt-0.5">Images and videos are processed in your browser and are not uploaded.</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5 card-hover">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                <Rocket className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white/90">Quick Access</p>
                <p className="text-xs text-white/45 mt-0.5">Launch ScreenCraft from your Dock, taskbar, or home screen.</p>
              </div>
            </div>
          </div>

          {/* iOS Instructions */}
          {pwa.isIOS && (
            <div className="px-6 pb-3">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-300 leading-relaxed">
                <p className="font-medium mb-1">Install on iOS:</p>
                <p>1. Tap the <strong>Share</strong> icon in Safari</p>
                <p>2. Scroll down and tap <strong>Add to Home Screen</strong> ➕</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="px-6 pb-4 pt-2 space-y-3">
            <Button
              onClick={handleInstall}
              className="w-full bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white h-11 text-sm font-medium shadow-lg shadow-[hsl(245,79%,55%)]/25 rounded-xl"
            >
              <Download className="w-4 h-4 mr-2" />
              {pwa.isIOS ? 'Got it, thanks!' : 'Install ScreenCraft'}
            </Button>

            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="w-full text-white/50 hover:text-white/80 hover:bg-white/5 h-10 text-sm rounded-xl"
            >
              Not Now
            </Button>
          </div>

          {/* Don't show again */}
          <div className="px-6 pb-5 flex items-center justify-center">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 text-[hsl(245,79%,55%)] focus:ring-[hsl(245,79%,55%)]/30 focus:ring-2 cursor-pointer"
              />
              <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors select-none">
                Don't show this again
              </span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
});
