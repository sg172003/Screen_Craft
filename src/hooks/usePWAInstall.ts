import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const PWA_DISMISS_KEY = 'screencraft_pwa_dismissed';
const PWA_SNOOZE_DAYS = 7;

function isDismissedPermanently(): boolean {
  try {
    const value = localStorage.getItem(PWA_DISMISS_KEY);
    if (!value) return false;
    const data = JSON.parse(value);
    if (data.permanent) return true;
    if (data.until && Date.now() < data.until) return true;
    return false;
  } catch {
    return false;
  }
}

function setDismissed(permanent: boolean): void {
  try {
    if (permanent) {
      localStorage.setItem(PWA_DISMISS_KEY, JSON.stringify({ permanent: true }));
    } else {
      const until = Date.now() + PWA_SNOOZE_DAYS * 24 * 60 * 60 * 1000;
      localStorage.setItem(PWA_DISMISS_KEY, JSON.stringify({ until }));
    }
  } catch {
    // localStorage quota or access error — silently ignore
  }
}

export interface UsePWAInstallReturn {
  /** Whether the browser supports installing and the prompt is available */
  isInstallable: boolean;
  /** Whether the app has already been installed */
  isInstalled: boolean;
  /** Whether the user has dismissed the prompt (within snooze or permanently) */
  isDismissed: boolean;
  /** Whether the user is on iOS (shows manual instructions instead) */
  isIOS: boolean;
  /** Whether the install modal is currently open */
  isModalOpen: boolean;
  /** Open the install modal on demand */
  openModal: () => void;
  /** Close the install modal */
  closeModal: () => void;
  /** Trigger the native install prompt. Returns true if accepted. */
  promptInstall: () => Promise<boolean>;
  /** Dismiss the popup, optionally permanently */
  dismissPrompt: (permanent?: boolean) => void;
}

export function usePWAInstall(): UsePWAInstallReturn {
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isDismissed, setIsDismissedState] = useState(() => isDismissedPermanently());
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openModal = useCallback(() => {
    setIsModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window);

  // Check if already in standalone mode (already installed)
  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone
    ) {
      setIsInstalled(true);
    }
  }, []);

  // Listen for beforeinstallprompt
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  // Listen for appinstalled
  useEffect(() => {
    const handler = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      deferredPromptRef.current = null;
    };

    window.addEventListener('appinstalled', handler);
    return () => window.removeEventListener('appinstalled', handler);
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return false;

    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    deferredPromptRef.current = null;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      return true;
    }
    return false;
  }, []);

  const dismissPrompt = useCallback((permanent = false) => {
    setDismissed(permanent);
    setIsDismissedState(true);
  }, []);

  return {
    isInstallable,
    isInstalled,
    isDismissed,
    isIOS,
    isModalOpen,
    openModal,
    closeModal,
    promptInstall,
    dismissPrompt,
  };
}
