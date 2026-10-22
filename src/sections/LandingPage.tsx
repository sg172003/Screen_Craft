import { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowRight,
  Upload,
  Sliders,
  Image as ImageIcon,
  Check,
  Monitor,
  Laptop,
  Smartphone,
  Maximize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { renderToCanvas } from '@/lib/canvasRenderer';
import { isAnalyticsConfigured, openAnalyticsSettings } from '@/lib/analytics';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { CanvasSettings } from '@/types';

interface LandingPageProps {
  onStartCrafting: () => void;
}

// Clean sample screenshot for the live preview
const DEMO_SCREENSHOT = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <rect width="960" height="540" fill="#f8fafc"/>
    <rect width="960" height="56" fill="#ffffff"/>
    <line x1="0" y1="56" x2="960" y2="56" stroke="#e2e8f0" stroke-width="1"/>
    
    <!-- Logo / Brand element -->
    <rect x="36" y="18" width="20" height="20" rx="5" fill="#4f46e5"/>
    <rect x="68" y="23" width="90" height="10" rx="4" fill="#0f172a"/>
    
    <!-- Search pill -->
    <rect x="330" y="14" width="300" height="28" rx="6" fill="#f1f5f9" stroke="#e2e8f0" stroke-width="1"/>
    <circle cx="348" cy="28" r="5" fill="none" stroke="#94a3b8" stroke-width="1.5"/>
    <line x1="352" y1="32" x2="357" y2="37" stroke="#94a3b8" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="368" y="24" width="110" height="8" rx="3" fill="#94a3b8"/>

    <!-- Right Controls -->
    <rect x="800" y="17" width="54" height="22" rx="5" fill="#f1f5f9"/>
    <rect x="866" y="17" width="60" height="22" rx="5" fill="#4f46e5"/>

    <!-- Sidebar -->
    <rect x="0" y="57" width="200" height="483" fill="#ffffff"/>
    <line x1="200" y1="57" x2="200" y2="540" stroke="#e2e8f0" stroke-width="1"/>
    
    <!-- Nav Items -->
    <rect x="18" y="80" width="164" height="30" rx="6" fill="#eef2ff"/>
    <rect x="32" y="90" width="10" height="10" rx="2" fill="#4f46e5"/>
    <rect x="52" y="91" width="70" height="8" rx="3" fill="#4f46e5"/>

    <rect x="32" y="130" width="10" height="10" rx="2" fill="#cbd5e1"/>
    <rect x="52" y="131" width="85" height="8" rx="3" fill="#64748b"/>

    <rect x="32" y="170" width="10" height="10" rx="2" fill="#cbd5e1"/>
    <rect x="52" y="171" width="65" height="8" rx="3" fill="#64748b"/>

    <rect x="32" y="210" width="10" height="10" rx="2" fill="#cbd5e1"/>
    <rect x="52" y="211" width="95" height="8" rx="3" fill="#64748b"/>

    <!-- Main Content Area -->
    <rect x="236" y="85" width="240" height="16" rx="4" fill="#0f172a"/>
    <rect x="236" y="112" width="360" height="10" rx="4" fill="#94a3b8"/>

    <!-- Cards Row -->
    <rect x="236" y="145" width="210" height="90" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="252" y="165" width="60" height="8" rx="3" fill="#64748b"/>
    <rect x="252" y="185" width="90" height="20" rx="4" fill="#0f172a"/>
    <rect x="252" y="215" width="50" height="6" rx="2" fill="#10b981"/>

    <rect x="466" y="145" width="210" height="90" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="482" y="165" width="70" height="8" rx="3" fill="#64748b"/>
    <rect x="482" y="185" width="80" height="20" rx="4" fill="#0f172a"/>
    <rect x="482" y="215" width="55" height="6" rx="2" fill="#3b82f6"/>

    <rect x="696" y="145" width="224" height="90" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="712" y="165" width="65" height="8" rx="3" fill="#64748b"/>
    <rect x="712" y="185" width="100" height="20" rx="4" fill="#0f172a"/>
    <rect x="712" y="215" width="45" height="6" rx="2" fill="#8b5cf6"/>

    <!-- Content Chart Block -->
    <rect x="236" y="255" width="684" height="255" rx="8" fill="#ffffff" stroke="#e2e8f0" stroke-width="1"/>
    <rect x="260" y="280" width="120" height="12" rx="4" fill="#0f172a"/>
    <path d="M 260 450 Q 340 380 420 410 T 580 340 T 720 380 T 860 300" fill="none" stroke="#4f46e5" stroke-width="3"/>
    <path d="M 260 450 Q 340 380 420 410 T 580 340 T 720 380 T 860 300 L 860 480 L 260 480 Z" fill="#4f46e5" opacity="0.08"/>
  </svg>
`)}`;

const LIVE_PRESET_COLORS = [
  { name: 'Indigo Dream', start: '#4f46e5', end: '#7c3aed' },
  { name: 'Ocean Breeze', start: '#0284c7', end: '#2563eb' },
  { name: 'Sunset Glow', start: '#f43f5e', end: '#fb923c' },
  { name: 'Emerald Forest', start: '#059669', end: '#0d9488' },
  { name: 'Clean Slate', start: '#475569', end: '#1e293b' },
  { name: 'Obsidian Noir', start: '#1e2229', end: '#090a0d' },
];

export const LandingPage = memo(function LandingPage({ onStartCrafting }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Interactive Live Preview Controls state
  const [frameType, setFrameType] = useState<'browser' | 'desktop' | 'mobile'>('browser');
  const [activeColorIdx, setActiveColorIdx] = useState(0);
  const [padding, setPadding] = useState(36);
  const [frameDarkMode, setFrameDarkMode] = useState(false);

  // Load sample screenshot
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = DEMO_SCREENSHOT;
    img.onload = () => {
      imageRef.current = img;
      drawCanvas();
    };
  }, []);

  // Live Canvas render routine
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const isMobile = frameType === 'mobile';
    const canvasWidth = isMobile ? 600 : 960;
    const canvasHeight = isMobile ? 800 : 580;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const chosenColor = LIVE_PRESET_COLORS[activeColorIdx];

    const settings: CanvasSettings = {
      width: canvasWidth,
      height: canvasHeight,
      padding: padding,
      cornerRadius: isMobile ? 32 : 12,
      shadowIntensity: 22,
      shadowEnabled: true,
      backgroundType: 'gradient',
      backgroundColor: chosenColor.start,
      gradientStart: chosenColor.start,
      gradientEnd: chosenColor.end,
      gradientDirection: 135,
      blurAmount: 20,
      frameType: frameType,
      frameDarkMode: frameDarkMode,
      exportScale: 1,
    };

    renderToCanvas(ctx, canvasWidth, canvasHeight, settings, img);
  }, [activeColorIdx, frameType, padding, frameDarkMode]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0d13] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* Skip to Content */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[hsl(245,79%,55%)] focus:text-white focus:rounded-md focus:shadow-lg focus:text-sm font-medium"
      >
        Skip to content
      </a>

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-[#0b0d13]/85 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Logo & Brand Identity */}
          <div className="flex items-center gap-2.5">
            <span className="logo-wrap" tabIndex={-1}>
              <img
                src="/logo.png"
                alt="ScreenCraft logo"
                width="32"
                height="32"
                className="logo-glow w-7 h-7 sm:w-8 sm:h-8 rounded-lg"
              />
            </span>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
              ScreenCraft
            </span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-2 sm:gap-6">
            <a
              href="#how-it-works"
              className="hidden sm:block text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              How it works
            </a>
            <a
              href="#features"
              className="hidden md:block text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Features
            </a>
            <a
              href="#faq"
              className="hidden sm:block text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              FAQ
            </a>

            {/* Dark / Light Mode Toggle */}
            <ThemeToggle />

            {/* Launch Action */}
            <Button
              onClick={onStartCrafting}
              size="sm"
              className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,47%)] text-white text-xs sm:text-sm font-medium px-3.5 sm:px-4 h-9 rounded-lg shadow-sm transition-all"
            >
              <span className="hidden sm:inline">Launch Editor</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 hidden sm:inline" />
            </Button>
          </div>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1} className="outline-none">
        {/* Hero Section */}
        <section className="pt-12 sm:pt-20 pb-8 sm:pb-12 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-4 sm:space-y-6">
            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15]">
              Turn raw screenshots & recordings into{' '}
              <span className="text-[hsl(245,79%,55%)] dark:text-indigo-400">
                professional visuals.
              </span>
            </h1>

            {/* Core Tagline */}
            <p className="text-base sm:text-xl text-slate-600 dark:text-slate-300 max-w-xl mx-auto font-medium">
              We beautify, not modify.
            </p>

            <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              Add browser or device frames, clean backgrounds, and export high-resolution PNGs or videos. Everything runs completely in your browser.
            </p>

            {/* CTA Group */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                onClick={onStartCrafting}
                size="lg"
                className="w-full sm:w-auto h-12 px-8 bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,47%)] text-white text-base font-medium rounded-xl shadow-lg shadow-[hsl(245,79%,55%)]/20 transition-all hover:scale-[1.01]"
              >
                <span>Start Crafting — Free & No Signup</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-[#131620] px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                <span className="tactile-key">⌘V</span>
                <span>or</span>
                <span className="tactile-key">Ctrl+V</span>
                <span>to paste screenshot</span>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Live Preview Component (Loved by user, fully responsive & theme adaptive) */}
        <section aria-label="Interactive screenshot preview" className="py-6 sm:py-10 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto">
            <div className="bg-white dark:bg-[#131620] border border-slate-200/90 dark:border-slate-800/90 rounded-2xl shadow-xl overflow-hidden transition-colors">
              {/* Interactive Toolbar */}
              <div className="p-3 sm:p-4 bg-slate-50/80 dark:bg-[#161a26]/80 border-b border-slate-200/80 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
                {/* Frame Selectors */}
                <div className="flex items-center gap-1 bg-white dark:bg-[#0c0e14] p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                  <button
                    type="button"
                    onClick={() => setFrameType('browser')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      frameType === 'browser'
                        ? 'bg-[hsl(245,79%,55%)] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Browser</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrameType('desktop')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      frameType === 'desktop'
                        ? 'bg-[hsl(245,79%,55%)] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Desktop</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrameType('mobile')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      frameType === 'mobile'
                        ? 'bg-[hsl(245,79%,55%)] text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile</span>
                  </button>
                </div>

                {/* Color Preset Palette */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:inline">Color:</span>
                  <div className="flex items-center gap-1.5 bg-white dark:bg-[#0c0e14] p-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs">
                    {LIVE_PRESET_COLORS.map((preset, idx) => (
                      <button
                        key={preset.name}
                        type="button"
                        title={preset.name}
                        onClick={() => setActiveColorIdx(idx)}
                        className={`w-6 h-6 rounded-md transition-all relative ${
                          activeColorIdx === idx
                            ? 'ring-2 ring-[hsl(245,79%,55%)] scale-110'
                            : 'opacity-85 hover:opacity-100'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                        }}
                      >
                        {activeColorIdx === idx && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Padding Slider */}
                <div className="hidden lg:flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 font-medium">
                  <span>Padding:</span>
                  <input
                    type="range"
                    min="20"
                    max="60"
                    value={padding}
                    onChange={(e) => setPadding(Number(e.target.value))}
                    className="w-20 sm:w-24 accent-[hsl(245,79%,55%)]"
                  />
                  <span className="w-7 text-right font-mono text-[11px]">{padding}px</span>
                </div>

                {/* Frame Mode & Open Editor */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFrameDarkMode(!frameDarkMode)}
                    className="text-xs px-2.5 py-1.5 rounded-md bg-white dark:bg-[#0c0e14] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-medium"
                  >
                    {frameDarkMode ? 'Dark Frame' : 'Light Frame'}
                  </button>

                  <Button
                    onClick={onStartCrafting}
                    size="sm"
                    className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 text-xs h-8 px-3 rounded-md shadow-xs"
                  >
                    <span>Open Editor</span>
                    <Maximize2 className="w-3 h-3 ml-1.5" />
                  </Button>
                </div>
              </div>

              {/* Responsive Live Canvas Area */}
              <div className="p-4 sm:p-8 bg-slate-100/70 dark:bg-[#08090d] flex items-center justify-center overflow-x-hidden min-h-[360px] sm:min-h-[500px]">
                <div className="max-w-full flex items-center justify-center">
                  <canvas
                    ref={canvasRef}
                    className="max-h-[460px] w-auto max-w-full h-auto object-contain rounded-xl preview-rig-shadow transition-all"
                  />
                </div>
              </div>

              {/* Status bar */}
              <div className="bg-slate-50 dark:bg-[#0f121a] px-4 sm:px-6 py-2 border-t border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono text-[11px]">
                  Preset: {LIVE_PRESET_COLORS[activeColorIdx].name} ({frameType})
                </span>
                <span className="text-[hsl(245,79%,55%)] dark:text-indigo-400 font-medium text-[11px]">
                  ● Interactive Live Preview
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section
          id="how-it-works"
          className="py-16 sm:py-24 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800/80 bg-white/50 dark:bg-transparent scroll-mt-16"
        >
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
                How it works
              </h2>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-xl mx-auto">
                Three simple steps to style screenshots and screen recordings
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
              {/* Step 1 */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-xs">
                  <Upload className="w-5 h-5" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  1
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Upload or Paste
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Drop or browse for images and videos. Paste screenshots with <kbd className="tactile-key">Ctrl+V</kbd> or <kbd className="tactile-key">Cmd+V</kbd>; previews keep their natural aspect ratio.
                </p>
              </div>

              {/* Step 2 */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-800 flex items-center justify-center text-purple-600 dark:text-purple-400 shadow-xs">
                  <Sliders className="w-5 h-5" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  2
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Customize Frames & Style
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Choose macOS browser, desktop, or mobile frames, vibrant gradients, padding, shadows, and platform presets for Twitter, Chrome Web Store, and LinkedIn.
                </p>
              </div>

              {/* Step 3 */}
              <div className="p-6 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-sm text-center space-y-3">
                <div className="w-12 h-12 mx-auto rounded-xl bg-pink-50 dark:bg-pink-950/60 border border-pink-200 dark:border-pink-800 flex items-center justify-center text-pink-600 dark:text-pink-400 shadow-xs">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <div className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                  3
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Download or Copy
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  Choose 1×, 2×, or 3× output size for Retina-crisp PNGs, export MP4/WebM videos, or copy the image directly to your clipboard in one click.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features and Privacy Section */}
        <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800/80 scroll-mt-16">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12">
              {/* Features Column */}
              <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">
                  Everything you need
                </h3>
                <ul className="space-y-3.5">
                  {[
                    'Keep the natural aspect ratio; export at 1×, 2×, or 3× scale',
                    'Add realistic macOS browser, desktop, or smartphone frames',
                    'Choose presets for Chrome Web Store, Twitter/X, and LinkedIn',
                    'Customizable backgrounds: solid colors, gradients, or blur',
                    'Copy directly to clipboard or export high-resolution PNG',
                    'Screen recording beautification with MP4 & WebM exports',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-snug">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Privacy Column */}
              <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#131620] border border-slate-200 dark:border-slate-800 shadow-sm">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mb-4 sm:mb-6">
                  Privacy first
                </h3>
                <ul className="space-y-3.5">
                  {[
                    'Images and videos are processed entirely in your browser',
                    'Your media files are never uploaded to any server or cloud',
                    'No user account or signup is required to use all features',
                    'Optional analytics records app events, never files or filenames',
                    'Works completely offline after assets are cached as a PWA',
                    'Safe client-side binary signature verification for security',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
                      <span className="text-slate-700 dark:text-slate-300 text-sm sm:text-base leading-snug">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section
          id="faq"
          className="py-16 sm:py-24 px-4 sm:px-6 bg-slate-100/60 dark:bg-[#0c0e14] border-t border-slate-200/80 dark:border-slate-800/80 transition-colors scroll-mt-16"
        >
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 dark:text-white mb-3">
                Frequently Asked Questions
              </h2>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400">
                A few quick answers about ScreenCraft
              </p>
            </div>

            <Accordion type="single" collapsible className="w-full space-y-3">
              <AccordionItem
                value="item-1"
                className="bg-white dark:bg-[#131620] rounded-xl px-5 sm:px-6 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <AccordionTrigger className="text-base font-semibold text-slate-900 dark:text-white hover:no-underline text-left py-4">
                  How do I create mockups for the Chrome Web Store?
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pb-4">
                  Choose a Chrome Web Store preset in the editor (1280×800 for screenshots or 1400×560 for promotional marquees) to automatically size your canvas according to Google's store specifications.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-2"
                className="bg-white dark:bg-[#131620] rounded-xl px-5 sm:px-6 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <AccordionTrigger className="text-base font-semibold text-slate-900 dark:text-white hover:no-underline text-left py-4">
                  Does ScreenCraft change my original file?
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pb-4">
                  No. Your original file stays completely unchanged. The canvas wraps your capture in a frame and adds styling around it. PNG exports use the natural dimensions multiplied by the selected 1×, 2×, or 3× export scale.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-3"
                className="bg-white dark:bg-[#131620] rounded-xl px-5 sm:px-6 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <AccordionTrigger className="text-base font-semibold text-slate-900 dark:text-white hover:no-underline text-left py-4">
                  Are my screenshots private and secure?
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pb-4">
                  Yes, 100%. Images and screen recordings are processed entirely in your web browser memory and are never uploaded to any server. If you allow analytics, it only records basic app interactions (such as which frame type was selected), never your files or filenames.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem
                value="item-4"
                className="bg-white dark:bg-[#131620] rounded-xl px-5 sm:px-6 border border-slate-200 dark:border-slate-800 shadow-xs"
              >
                <AccordionTrigger className="text-base font-semibold text-slate-900 dark:text-white hover:no-underline text-left py-4">
                  Can I paste screenshots directly from my clipboard?
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed pb-4">
                  Yes! With ScreenCraft open, simply press <kbd className="tactile-key">Ctrl+V</kbd> on Windows/Linux or <kbd className="tactile-key">Cmd+V</kbd> on Mac to import an image directly from your clipboard without saving it first.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="py-16 sm:py-20 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="max-w-2xl mx-auto text-center space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              Ready to beautify your screenshots?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-sm sm:text-base">
              Open the editor and start creating. No signup required.
            </p>
            <div className="pt-2">
              <Button
                onClick={onStartCrafting}
                size="lg"
                className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,47%)] text-white text-base font-medium px-8 py-5 h-auto rounded-xl shadow-lg shadow-[hsl(245,79%,55%)]/20 transition-all hover:scale-[1.01]"
              >
                <span>Start Crafting Now — Free</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-[#080a0e] text-xs text-slate-500 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2">
            <img
              src="/logo.png"
              alt="ScreenCraft logo"
              width="24"
              height="24"
              className="w-5 h-5 sm:w-6 sm:h-6 rounded-md"
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">ScreenCraft</span>
          </div>

          {/* Links */}
          <div className="flex flex-wrap items-center justify-center gap-4 text-slate-600 dark:text-slate-400">
            <a href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              How it works
            </a>
            <a href="#features" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Features
            </a>
            <a href="#faq" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              FAQ
            </a>
            <a href="/help" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Help
            </a>
            <a href="/privacy" className="hover:text-slate-900 dark:hover:text-white transition-colors">
              Privacy
            </a>
            {isAnalyticsConfigured() && (
              <button
                type="button"
                onClick={openAnalyticsSettings}
                className="hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Analytics settings
              </button>
            )}
            <a
              href="https://github.com/sg172003/Screen_Craft"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>

          {/* Attribution */}
          <p className="text-center sm:text-right text-slate-500 dark:text-slate-400">
            &copy; {new Date().getFullYear()} ScreenCraft. <br />
            <b>Author: Sarthak</b>
          </p>
        </div>
      </footer>
    </div>
  );
});
