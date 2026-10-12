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

let initialized = false;

/**
 * Initialize Google Analytics by injecting the gtag.js script.
 * Call once at app startup (e.g. in main.tsx or App.tsx).
 */
export function initGA(): void {
  if (initialized) return;
  if (!GA_MEASUREMENT_ID) {
    console.warn('[Analytics] VITE_GA_MEASUREMENT_ID not set. Analytics disabled.');
    return;
  }

  try {
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    window.gtag('js', new Date());
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
  } catch {
    console.warn('[Analytics] Failed to initialize Google Analytics.');
  }
}

/**
 * Track a virtual page view (for SPA navigation).
 */
export function trackPageView(path: string, title?: string): void {
  if (!initialized || !window.gtag) return;
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
  if (!initialized || !window.gtag) return;
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
