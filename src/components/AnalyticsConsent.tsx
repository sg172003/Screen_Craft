import { useEffect, useState } from 'react';
import {
  getAnalyticsConsent,
  addAnalyticsSettingsListener,
  isAnalyticsConfigured,
  saveAnalyticsConsent,
} from '@/lib/analytics';

export function AnalyticsConsent() {
  const [visible, setVisible] = useState(
    () => isAnalyticsConfigured() && getAnalyticsConsent() === null
  );

  useEffect(() => {
    if (!isAnalyticsConfigured()) return;

    const openSettings = () => setVisible(true);
    return addAnalyticsSettingsListener(openSettings);
  }, []);

  if (!visible || !isAnalyticsConfigured()) return null;

  const choose = (allowed: boolean) => {
    saveAnalyticsConsent(allowed);
    setVisible(false);
  };

  return (
    <aside
      aria-label="Optional analytics choices"
      className="fixed inset-x-3 bottom-3 z-[90] mx-auto max-w-3xl rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-800 sm:inset-x-6 sm:bottom-6 sm:flex sm:items-center sm:gap-5 sm:p-5"
    >
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Optional usage analytics</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
          Allow Google Analytics to measure feature use and technical details. ScreenCraft never sends your media or filenames. Read the{' '}
          <a className="font-medium text-indigo-600 underline underline-offset-2 hover:text-indigo-700 dark:text-indigo-300" href="/privacy">
            privacy details
          </a>.
        </p>
      </div>
      <div className="mt-3 flex shrink-0 flex-wrap gap-2 sm:mt-0">
        <button
          type="button"
          onClick={() => choose(false)}
          className="min-h-10 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          Continue without analytics
        </button>
        <button
          type="button"
          onClick={() => choose(true)}
          className="min-h-10 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
        >
          Allow analytics
        </button>
      </div>
    </aside>
  );
}
