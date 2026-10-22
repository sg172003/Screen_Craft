import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';
import { ThemeProvider } from '@/context/ThemeContext';
import { PWAInstallModal } from '@/components/pwa/PWAInstallModal';
import { AnalyticsConsent } from '@/components/AnalyticsConsent';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { initGA, trackPageView } from '@/lib/analytics';
import './App.css';

// Lazy load pages for better bundle splitting
const LandingPage = lazy(() => import('@/sections/LandingPage').then(m => ({ default: m.LandingPage })));
const EditorPage = lazy(() => import('@/sections/EditorPage').then(m => ({ default: m.EditorPage })));

function AppContent() {
  const [showEditor, setShowEditor] = useState(false);
  const pwa = usePWAInstall();

  // Initialize analytics and service worker on mount
  useEffect(() => {
    initGA();

    // Register service worker for PWA support and offline caching
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').catch((err) => {
          console.warn('[SW] Registration failed:', err);
        });
      });
    }

    // Initial page view
    trackPageView('/', 'ScreenCraft — Landing');
  }, []);

  const handleStartCrafting = useCallback(() => {
    setShowEditor(true);
    trackPageView('/editor', 'ScreenCraft — Editor');
  }, []);

  const handleBack = useCallback(() => {
    setShowEditor(false);
    trackPageView('/', 'ScreenCraft — Landing');
  }, []);

  return (
    <>
      <Suspense 
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
            <Spinner className="w-8 h-8 text-[hsl(245,79%,55%)]" />
          </div>
        }
      >
        {showEditor ? (
          <EditorPage onBack={handleBack} onInstallClick={pwa.openModal} />
        ) : (
          <LandingPage
            onStartCrafting={handleStartCrafting}
            onInstallClick={pwa.openModal}
            isInstalled={pwa.isInstalled}
          />
        )}
      </Suspense>

      {/* PWA Install Modal (Downloadable popup, cancelable with snooze support) */}
      <PWAInstallModal pwa={pwa} />
      <AnalyticsConsent />
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
