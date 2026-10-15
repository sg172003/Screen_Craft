/**
 * Google Analytics 4 (GA4) integration module.
 * 
 * Reads the Measurement ID from VITE_GA_MEASUREMENT_ID environment variable.
 * Gracefully handles ad-blockers and offline mode without throwing errors.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const ANALYTICS_CONSENT_KEY = 'screencraft_analytics_consent';
const ANALYTICS_SETTINGS_EVENT = 'screencraft:analytics-settings';

let initialized = false;
let analyticsEnabled = false;

export function isAnalyticsConfigured(): boolean {
  return Boolean(GA_MEASUREMENT_ID);
}

export function openAnalyticsSettings(): void {
  window.dispatchEvent(new Event(ANALYTICS_SETTINGS_EVENT));
}

export function addAnalyticsSettingsListener(listener: () => void): () => void {
  window.addEventListener(ANALYTICS_SETTINGS_EVENT, listener);
  return () => window.removeEventListener(ANALYTICS_SETTINGS_EVENT, listener);
}

export function getAnalyticsConsent(): boolean | null {
  try {
    const value = localStorage.getItem(ANALYTICS_CONSENT_KEY);
    if (value === 'granted') return true;
    if (value === 'denied') return false;
    return null;
  } catch {
    return null;
  }
}

export function saveAnalyticsConsent(allowed: boolean): void {
  try {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, allowed ? 'granted' : 'denied');
  } catch {
    // If preferences cannot be stored, do not enable analytics for this session.
    allowed = false;
  }

  analyticsEnabled = allowed;
  if (allowed) {
    initGA();
    return;
  }

  if (initialized && window.gtag) {
    window.gtag('consent', 'update', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
  }
}

/**
 * Initialize Google Analytics by injecting the gtag.js script.
 * Call once at app startup (e.g. in main.tsx or App.tsx).
 */
export function initGA(): void {
  if (getAnalyticsConsent() !== true || !GA_MEASUREMENT_ID) return;

  try {
    if (initialized) {
      window.gtag('consent', 'update', {
        analytics_storage: 'granted',
        ad_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
      });
      analyticsEnabled = true;
      return;
    }

    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag('js', new Date());
    window.gtag('consent', 'default', {
      analytics_storage: 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('config', GA_MEASUREMENT_ID, {
      send_page_view: false, // We'll send page views manually for SPA
    });

    // Inject gtag.js script
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
    script.async = true;
    script.onerror = () => {
      console.warn('[Analytics] Failed to load gtag.js (ad-blocker or offline).');
    };
    document.head.appendChild(script);

    initialized = true;
    analyticsEnabled = true;
  } catch {
    console.warn('[Analytics] Failed to initialize Google Analytics.');
  }
}

/**
 * Track a virtual page view (for SPA navigation).
 */
export function trackPageView(path: string, title?: string): void {
  if (!analyticsEnabled || !initialized || !window.gtag) return;
  try {
    window.gtag('event', 'page_view', {
      page_path: path,
      page_title: title,
    });
  } catch {
    // Silently ignore
  }
}

/**
 * Track a custom event.
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>
): void {
  if (!analyticsEnabled || !initialized || !window.gtag) return;
  try {
    window.gtag('event', eventName, params);
  } catch {
    // Silently ignore
  }
}

// ---- Convenience helpers for common ScreenCraft events ----

export function trackMediaUpload(type: 'image' | 'video', sizeKB: number, dimensions: string): void {
  trackEvent('upload_media', { media_type: type, size_kb: sizeKB, dimensions });
}

export function trackImageExport(scale: number, format: string): void {
  trackEvent('export_image', { scale, format });
}

export function trackVideoExport(format: string, durationSec: number): void {
  trackEvent('export_video', { format, duration_sec: durationSec });
}

export function trackFrameSelected(frameType: string): void {
  trackEvent('frame_type_selected', { frame_type: frameType });
}

export function trackPresetSelected(presetName: string): void {
  trackEvent('preset_selected', { preset_name: presetName });
}

export function trackPWAPromptShown(): void {
  trackEvent('pwa_prompt_shown');
}

export function trackPWAInstallAccepted(): void {
  trackEvent('pwa_install_accepted');
}

export function trackPWAInstallDismissed(): void {
  trackEvent('pwa_install_dismissed');
}
