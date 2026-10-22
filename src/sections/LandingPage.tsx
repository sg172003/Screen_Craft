import { memo, useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowRight,
  Monitor,
  Smartphone,
  Laptop,
  Video,
  ShieldCheck,
  Maximize2,
  Layers,
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

// Crisp, high-contrast sample UI mockup SVG for the live interactive stage
const SAMPLE_MOCKUP_SVG = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="1024" height="600" viewBox="0 0 1024 600">
    <rect width="1024" height="600" fill="#0d0f12"/>
    <!-- Top Bar -->
    <rect width="1024" height="52" fill="#14171d"/>
    <line x1="0" y1="52" x2="1024" y2="52" stroke="#22262f" stroke-width="1"/>
    
    <!-- Logo / Brand element -->
    <rect x="24" y="16" width="20" height="20" rx="5" fill="#ff6b35"/>
    <rect x="54" y="21" width="96" height="10" rx="4" fill="#f4f5f7"/>
    
    <!-- Search pill -->
    <rect x="362" y="12" width="300" height="28" rx="6" fill="#1b1e26" stroke="#2a2e39" stroke-width="1"/>
    <circle cx="382" cy="26" r="5" fill="none" stroke="#606674" stroke-width="1.5"/>
    <line x1="386" y1="30" x2="391" y2="35" stroke="#606674" stroke-width="1.5" stroke-linecap="round"/>
    <rect x="402" y="22" width="120" height="8" rx="3" fill="#606674"/>

    <!-- Right Controls -->
    <rect x="880" y="15" width="50" height="22" rx="4" fill="#20242e"/>
    <rect x="942" y="15" width="58" height="22" rx="4" fill="#ff6b35"/>
    <rect x="954" y="22" width="34" height="8" rx="3" fill="#ffffff"/>

    <!-- Left Sidebar -->
    <rect x="0" y="53" width="220" height="547" fill="#111318"/>
    <line x1="220" y1="53" x2="220" y2="600" stroke="#22262f" stroke-width="1"/>
    
    <!-- Nav Items -->
    <rect x="18" y="76" width="184" height="32" rx="6" fill="#1c2029"/>
    <rect x="32" y="87" width="10" height="10" rx="2" fill="#ff6b35"/>
    <rect x="52" y="88" width="80" height="8" rx="3" fill="#f4f5f7"/>

    <rect x="32" y="132" width="10" height="10" rx="2" fill="#464b58"/>
    <rect x="52" y="133" width="96" height="8" rx="3" fill="#8e94a0"/>

    <rect x="32" y="172" width="10" height="10" rx="2" fill="#464b58"/>
    <rect x="52" y="173" width="70" height="8" rx="3" fill="#8e94a0"/>

    <rect x="32" y="212" width="10" height="10" rx="2" fill="#464b58"/>
    <rect x="52" y="213" width="110" height="8" rx="3" fill="#8e94a0"/>

    <!-- Main Content Stage -->
    <rect x="256" y="85" width="280" height="18" rx="5" fill="#f4f5f7"/>
    <rect x="256" y="115" width="420" height="10" rx="4" fill="#606674"/>

    <!-- Metric Panels -->
    <rect x="256" y="155" width="224" height="100" rx="8" fill="#15181f" stroke="#22262f" stroke-width="1"/>
    <rect x="274" y="175" width="70" height="8" rx="3" fill="#8e94a0"/>
    <rect x="274" y="195" width="100" height="24" rx="4" fill="#f4f5f7"/>
    <rect x="274" y="231" width="54" height="6" rx="2" fill="#10b981"/>

    <rect x="496" y="155" width="224" height="100" rx="8" fill="#15181f" stroke="#22262f" stroke-width="1"/>
    <rect x="514" y="175" width="80" height="8" rx="3" fill="#8e94a0"/>
    <rect x="514" y="195" width="90" height="24" rx="4" fill="#f4f5f7"/>
    <rect x="514" y="231" width="60" height="6" rx="2" fill="#3b82f6"/>

    <rect x="736" y="155" width="248" height="100" rx="8" fill="#15181f" stroke="#22262f" stroke-width="1"/>
    <rect x="754" y="175" width="70" height="8" rx="3" fill="#8e94a0"/>
    <rect x="754" y="195" width="110" height="24" rx="4" fill="#f4f5f7"/>
    <rect x="754" y="231" width="48" height="6" rx="2" fill="#ff6b35"/>

    <!-- Data Chart Block -->
    <rect x="256" y="275" width="728" height="280" rx="8" fill="#15181f" stroke="#22262f" stroke-width="1"/>
    <rect x="280" y="300" width="120" height="12" rx="4" fill="#f4f5f7"/>
    
    <!-- Chart waveform -->
    <path d="M 280 480 Q 360 420 440 450 T 600 360 T 760 410 T 920 330" fill="none" stroke="#ff6b35" stroke-width="3"/>
    <path d="M 280 480 Q 360 420 440 450 T 600 360 T 760 410 T 920 330 L 920 520 L 280 520 Z" fill="#ff6b35" opacity="0.08"/>
  </svg>
`)}`;

const COLOR_PRESETS = [
  { name: 'Obsidian Noir', start: '#16191f', end: '#090a0d', type: 'gradient' as const },
  { name: 'Titanium Slate', start: '#334155', end: '#0f172a', type: 'gradient' as const },
  { name: 'Industrial Amber', start: '#9a3412', end: '#431407', type: 'gradient' as const },
  { name: 'Minimal Graphite', start: '#1e2229', end: '#121418', type: 'gradient' as const },
  { name: 'Studio Frost', start: '#38bdf8', end: '#1e1b4b', type: 'gradient' as const },
];

export const LandingPage = memo(function LandingPage({ onStartCrafting }: LandingPageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Live interactive hero stage state
  const [frameType, setFrameType] = useState<'browser' | 'desktop' | 'mobile'>('browser');
  const [activeColor, setActiveColor] = useState(0);
  const [padding, setPadding] = useState(40);
  const [frameDarkMode, setFrameDarkMode] = useState(true);

  // Load sample image once
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = SAMPLE_MOCKUP_SVG;
    img.onload = () => {
      imageRef.current = img;
      renderCurrentStage();
    };
  }, []);

  // Re-render canvas whenever controls change
  const renderCurrentStage = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const selectedColor = COLOR_PRESETS[activeColor];
    const isMobile = frameType === 'mobile';

    const stageWidth = isMobile ? 640 : 1080;
    const stageHeight = isMobile ? 860 : 660;

    canvas.width = stageWidth;
    canvas.height = stageHeight;

    const settings: CanvasSettings = {
      width: stageWidth,
      height: stageHeight,
      padding: padding,
      cornerRadius: isMobile ? 32 : 12,
      shadowIntensity: 28,
      shadowEnabled: true,
      backgroundType: 'gradient',
      backgroundColor: selectedColor.start,
      gradientStart: selectedColor.start,
      gradientEnd: selectedColor.end,
      gradientDirection: 145,
      blurAmount: 20,
      frameType: frameType,
      frameDarkMode: frameDarkMode,
      exportScale: 1,
    };

    renderToCanvas(ctx, stageWidth, stageHeight, settings, img);
  }, [activeColor, frameType, padding, frameDarkMode]);

  useEffect(() => {
    renderCurrentStage();
  }, [renderCurrentStage]);

  return (
    <div className="min-h-screen bg-[#090a0c] text-[#f4f5f7] selection:bg-[#ff6b35]/25 selection:text-[#ff8f66]">
      {/* Accessibility skip link */}
      <a
        href="#workbench"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-[#ff6b35] focus:text-white focus:rounded focus:font-mono focus:text-xs"
      >
        Skip to Workbench
      </a>

      {/* Top Precision Navigation */}
      <header className="sticky top-0 z-50 bg-[#090a0c]/85 backdrop-blur-md border-b border-[#1c1f26]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          {/* Brand Mark */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#14161c] border border-[#272b35] flex items-center justify-center shadow-xs">
              <span className="font-mono font-bold text-sm text-[#ff6b35]">S</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base tracking-tight text-white">ScreenCraft</span>
              <span className="hidden md:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono tracking-wide bg-[#171920] border border-[#262a34] text-[#8e94a0]">
                STUDIO v2.5
              </span>
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#8e94a0]">
            <a href="#workbench" className="hover:text-white transition-colors">
              Live Stage
            </a>
            <a href="#capabilities" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              Architecture
            </a>
            <a href="#faq" className="hover:text-white transition-colors">
              Documentation
            </a>
          </nav>

          {/* Right Action Stack */}
          <div className="flex items-center gap-3">
            <span className="hidden lg:flex items-center gap-1.5 text-xs font-mono text-[#8e94a0] bg-[#121418] px-2.5 py-1 rounded-md border border-[#20232c]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              100% In-Browser
            </span>
            <ThemeToggle />
            <Button
              onClick={onStartCrafting}
              size="sm"
              className="bg-[#f4f5f7] hover:bg-white text-[#090a0c] font-medium text-xs sm:text-sm px-4 h-9 rounded-lg shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Launch Studio</span>
              <span className="hidden sm:inline-block ml-1.5 text-[10px] font-mono opacity-60">↵</span>
            </Button>
          </div>
        </div>
      </header>

      <main id="workbench" tabIndex={-1} className="outline-none">
        {/* Hero Section — The Architectural Framing Stage */}
        <section className="pt-16 sm:pt-24 pb-12 sm:pb-16 px-4 sm:px-6">
          <div className="max-w-5xl mx-auto text-center space-y-6">
            {/* Status Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#13151b] border border-[#222631] text-xs font-mono text-[#9ca3af]">
              <span className="text-[#ff6b35]">●</span>
              <span>Zero Server Transfer</span>
              <span className="text-[#374151]">|</span>
              <span className="text-white font-medium">Native 3× Retina Rendering</span>
            </div>

            {/* Main Headline (Pure typographic authority, no gradient slop) */}
            <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold tracking-tight text-white leading-[1.1] max-w-4xl mx-auto">
              Turn raw screen captures into studio-grade visuals in seconds.
            </h1>

            {/* Direct Value Narrative */}
            <p className="text-sm sm:text-lg text-[#8e94a0] max-w-2xl mx-auto leading-relaxed">
              Wrap raw screenshots and screen recordings in authentic macOS, desktop, or mobile frames. Add measured canvas padding, multi-stop drop shadows, and export crisp 3× Retina PNGs or MP4 videos — entirely inside your browser memory.
            </p>

            {/* Action Ribbon */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
              <Button
                onClick={onStartCrafting}
                size="lg"
                className="w-full sm:w-auto h-12 px-7 bg-[#ff6b35] hover:bg-[#e05622] text-white font-medium text-sm sm:text-base rounded-xl shadow-lg shadow-[#ff6b35]/20 transition-all hover:translate-y-[-1px]"
              >
                <span>Start Crafting — No Signup</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="flex items-center gap-2 text-xs font-mono text-[#8e94a0] px-3 py-2.5 rounded-xl bg-[#12141a] border border-[#222530]">
                <span className="tactile-key">⌘V</span>
                <span>or</span>
                <span className="tactile-key">Ctrl+V</span>
                <span className="text-[#c4c9d4]">to paste image directly</span>
              </div>
            </div>

            {/* Format specifier line */}
            <div className="flex items-center justify-center gap-4 text-xs font-mono text-[#626875] pt-1">
              <span>INPUTS: PNG &bull; JPG &bull; WebP &bull; MP4 &bull; WebM</span>
              <span>&bull;</span>
              <span>OUTPUTS: 1× &bull; 2× &bull; 3× RETINA PNG &bull; VIDEO</span>
            </div>
          </div>
        </section>

        {/* Live Interactive Framing Workbench (Centerpiece Demo) */}
        <section className="pb-20 sm:pb-28 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            {/* Workbench Frame Chassis */}
            <div className="rounded-2xl bg-[#101217] border border-[#222631] shadow-2xl overflow-hidden">
              {/* Tactical Rig Header Controls */}
              <div className="bg-[#14171e] px-4 sm:px-6 py-3.5 border-b border-[#222631] flex flex-wrap items-center justify-between gap-4">
                {/* Frame Switcher */}
                <div className="flex items-center gap-1.5 bg-[#0a0c0f] p-1 rounded-lg border border-[#222631]">
                  <button
                    type="button"
                    onClick={() => setFrameType('browser')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      frameType === 'browser'
                        ? 'bg-[#1c202a] text-white shadow-xs'
                        : 'text-[#8e94a0] hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>macOS Browser</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrameType('desktop')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      frameType === 'desktop'
                        ? 'bg-[#1c202a] text-white shadow-xs'
                        : 'text-[#8e94a0] hover:text-white'
                    }`}
                  >
                    <Laptop className="w-3.5 h-3.5" />
                    <span>Desktop Window</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFrameType('mobile')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                      frameType === 'mobile'
                        ? 'bg-[#1c202a] text-white shadow-xs'
                        : 'text-[#8e94a0] hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Mobile Phone</span>
                  </button>
                </div>

                {/* Color Preset Palette */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#686f7d] hidden sm:inline">TONE:</span>
                  <div className="flex items-center gap-1.5 bg-[#0a0c0f] p-1 rounded-lg border border-[#222631]">
                    {COLOR_PRESETS.map((preset, idx) => (
                      <button
                        key={preset.name}
                        type="button"
                        title={preset.name}
                        onClick={() => setActiveColor(idx)}
                        className={`w-6 h-6 rounded-md transition-all relative ${
                          activeColor === idx ? 'ring-2 ring-[#ff6b35] scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        style={{
                          background: `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                        }}
                      >
                        {activeColor === idx && (
                          <span className="absolute inset-0 flex items-center justify-center text-white text-[10px]">
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Padding Slider */}
                <div className="hidden lg:flex items-center gap-3 text-xs font-mono text-[#8e94a0]">
                  <span>PADDING:</span>
                  <input
                    type="range"
                    min="20"
                    max="64"
                    value={padding}
                    onChange={(e) => setPadding(Number(e.target.value))}
                    className="w-24 accent-[#ff6b35]"
                  />
                  <span className="w-8 text-right text-white font-medium">{padding}px</span>
                </div>

                {/* Frame Mode Toggle & Launch Link */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setFrameDarkMode(!frameDarkMode)}
                    className="text-xs font-mono px-2.5 py-1.5 rounded-md bg-[#0a0c0f] border border-[#222631] text-[#8e94a0] hover:text-white"
                  >
                    {frameDarkMode ? 'FRAME: DARK' : 'FRAME: LIGHT'}
                  </button>
                  <Button
                    onClick={onStartCrafting}
                    size="sm"
                    className="bg-[#202530] hover:bg-[#2b313f] text-white border border-[#313745] text-xs h-8 px-3 rounded-md"
                  >
                    <span>Open in Studio</span>
                    <Maximize2 className="w-3 h-3 ml-1.5" />
                  </Button>
                </div>
              </div>

              {/* The Live Render Canvas Well */}
              <div className="p-4 sm:p-10 bg-[#07080a] flex items-center justify-center overflow-x-auto min-h-[460px] sm:min-h-[560px]">
                <div className="relative max-w-full transition-all duration-300">
                  <canvas
                    ref={canvasRef}
                    className="max-h-[500px] w-auto h-auto object-contain rounded-xl workbench-rig-shadow transition-all"
                  />
                </div>
              </div>

              {/* Workbench Status Footer Bar */}
              <div className="bg-[#0e1015] px-6 py-2.5 border-t border-[#1e222c] flex items-center justify-between text-xs font-mono text-[#717786]">
                <div className="flex items-center gap-4">
                  <span>CANVAS: {frameType.toUpperCase()} FRAME</span>
                  <span>&bull;</span>
                  <span>PRESET: {COLOR_PRESETS[activeColor].name}</span>
                </div>
                <div className="flex items-center gap-2 text-[#ff6b35]">
                  <span>Interactive Live Preview</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Studio Capabilities Section (Asymmetric Architectural Grid, No Lazy Cards) */}
        <section id="capabilities" className="py-20 sm:py-28 px-4 sm:px-6 border-t border-[#1a1d24] bg-[#0c0d11]">
          <div className="max-w-6xl mx-auto space-y-16">
            <div className="max-w-2xl">
              <span className="font-mono text-xs uppercase tracking-widest text-[#ff6b35]">ENGINE ARCHITECTURE</span>
              <h2 className="text-2xl sm:text-4xl font-bold tracking-tight text-white mt-2">
                Built for builders who refuse generic, compressed screenshots.
              </h2>
              <p className="text-sm sm:text-base text-[#8e94a0] mt-3">
                Every feature is engineered for precision output: Chrome Web Store compliance, Twitter/X cards, and Retina resolution preservation.
              </p>
            </div>

            {/* Asymmetric Technical Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Feature 1 (Large 8 cols): The Frame Forge */}
              <div className="md:col-span-8 p-6 sm:p-8 rounded-2xl bg-[#111318] border border-[#22252e] space-y-4">
                <div className="w-10 h-10 rounded-xl bg-[#1a1e27] border border-[#2b313e] flex items-center justify-center text-[#ff6b35]">
                  <Layers className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">The Frame Forge</h3>
                <p className="text-sm text-[#8e94a0] leading-relaxed max-w-xl">
                  Authentic macOS Safari/Chrome window chrome with accurate traffic lights and address capsule. Switch to modern smartphone frames with dynamic camera notches or minimalist border frames without losing aspect ratio.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-[#c4c9d4]">
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">macOS Browser</span>
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">Desktop Window</span>
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">Smartphone Frame</span>
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">Clean Borderless</span>
                </div>
              </div>

              {/* Feature 2 (4 cols): Native 0% Downscaling Engine */}
              <div className="md:col-span-4 p-6 sm:p-8 rounded-2xl bg-[#111318] border border-[#22252e] space-y-4">
                <div className="w-10 h-10 rounded-xl bg-[#1a1e27] border border-[#2b313e] flex items-center justify-center text-emerald-400">
                  <Maximize2 className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">0% Downscaling</h3>
                <p className="text-sm text-[#8e94a0] leading-relaxed">
                  Automatic dimension inspection detects your exact screen resolution on import. Canvas sizes to <code className="font-mono text-xs text-white">nativeWidth + padding*2</code> for 100% pixel sharpness.
                </p>
                <div className="text-xs font-mono text-emerald-400">✓ 1×, 2×, and 3× Retina offscreen exports</div>
              </div>

              {/* Feature 3 (4 cols): Frame-by-Frame Video Studio */}
              <div className="md:col-span-4 p-6 sm:p-8 rounded-2xl bg-[#111318] border border-[#22252e] space-y-4">
                <div className="w-10 h-10 rounded-xl bg-[#1a1e27] border border-[#2b313e] flex items-center justify-center text-sky-400">
                  <Video className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Video Darkroom</h3>
                <p className="text-sm text-[#8e94a0] leading-relaxed">
                  Beautify screen recordings with the exact same frames and backgrounds. Scrub timelines, export MP4/WebM at 60fps, or grab any frame as a high-res still image.
                </p>
                <div className="text-xs font-mono text-sky-400">✓ MP4 / WebM hardware-accelerated stream</div>
              </div>

              {/* Feature 4 (8 cols): Zero-Cloud Cryptographic Privacy */}
              <div className="md:col-span-8 p-6 sm:p-8 rounded-2xl bg-[#111318] border border-[#22252e] space-y-4">
                <div className="w-10 h-10 rounded-xl bg-[#1a1e27] border border-[#2b313e] flex items-center justify-center text-amber-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-xl font-bold text-white tracking-tight">Complete Memory Isolation</h3>
                <p className="text-sm text-[#8e94a0] leading-relaxed max-w-xl">
                  Client-side binary magic-number validation checks file signatures (<code className="font-mono text-xs text-white">89 50 4E 47</code> for PNG, <code className="font-mono text-xs text-white">ftyp</code> for MP4) before rendering. No files, logs, or pixels ever touch a remote server.
                </p>
                <div className="pt-2 flex flex-wrap gap-2 text-xs font-mono text-[#c4c9d4]">
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">Zero Network Storage</span>
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">Offline Service Worker</span>
                  <span className="px-2.5 py-1 rounded bg-[#181a22] border border-[#282d38]">No Account Wall</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Technical Architecture Comparison Table */}
        <section id="comparison" className="py-20 sm:py-24 px-4 sm:px-6 border-t border-[#1a1d24]">
          <div className="max-w-5xl mx-auto space-y-12">
            <div className="text-center space-y-3">
              <span className="font-mono text-xs uppercase tracking-widest text-[#ff6b35]">TECHNICAL COMPARISON</span>
              <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
                Why developers choose ScreenCraft
              </h2>
              <p className="text-sm sm:text-base text-[#8e94a0] max-w-xl mx-auto">
                No paywalls, no image uploads, and zero watermarks.
              </p>
            </div>

            <div className="rounded-2xl border border-[#222631] bg-[#111317] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#222631] bg-[#14171e] text-xs font-mono text-[#8e94a0]">
                      <th className="py-4 px-6 font-semibold">CAPABILITY</th>
                      <th className="py-4 px-6 font-semibold text-[#ff6b35]">SCREENCRAFT</th>
                      <th className="py-4 px-6 font-semibold">SAAS MOCKUP TOOLS</th>
                      <th className="py-4 px-6 font-semibold">MANUAL DESIGN (FIGMA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1e212b] text-xs font-mono">
                    <tr>
                      <td className="py-4 px-6 text-white font-medium">Data Privacy</td>
                      <td className="py-4 px-6 text-emerald-400 font-semibold">100% In-Browser Memory</td>
                      <td className="py-4 px-6 text-[#717786]">Uploaded to Cloud Storage</td>
                      <td className="py-4 px-6 text-[#717786]">Local / Cloud Workspace</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 text-white font-medium">Video Beautification</td>
                      <td className="py-4 px-6 text-emerald-400 font-semibold">Yes (MP4 / WebM with Frames)</td>
                      <td className="py-4 px-6 text-[#717786]">Locked behind $29/mo plan</td>
                      <td className="py-4 px-6 text-[#717786]">Requires AfterEffects / Plugins</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 text-white font-medium">Native Resolution</td>
                      <td className="py-4 px-6 text-emerald-400 font-semibold">Auto-Preserved (0% Loss)</td>
                      <td className="py-4 px-6 text-[#717786]">Downscaled to 1200px</td>
                      <td className="py-4 px-6 text-[#717786]">Manual Artboard Setup</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 text-white font-medium">Instant Clipboard Import</td>
                      <td className="py-4 px-6 text-emerald-400 font-semibold">Cmd+V / Ctrl+V from OS</td>
                      <td className="py-4 px-6 text-[#717786]">File Dialog Upload Only</td>
                      <td className="py-4 px-6 text-[#717786]">Paste into Canvas</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 text-white font-medium">Retina Export Options</td>
                      <td className="py-4 px-6 text-emerald-400 font-semibold">1×, 2×, 3× Crisp PNG</td>
                      <td className="py-4 px-6 text-[#717786]">Watermarked on Free Tier</td>
                      <td className="py-4 px-6 text-[#717786]">Custom Export Multiplier</td>
                    </tr>
                    <tr>
                      <td className="py-4 px-6 text-white font-medium">Cost & Accounts</td>
                      <td className="py-4 px-6 text-emerald-400 font-semibold">Free &bull; No Login Required</td>
                      <td className="py-4 px-6 text-[#717786]">Freemium / Monthly Billing</td>
                      <td className="py-4 px-6 text-[#717786]">Paid Subscription</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* Documentation / FAQ (Architectural Hairlines, No Card Clutter) */}
        <section id="faq" className="py-20 sm:py-24 px-4 sm:px-6 border-t border-[#1a1d24] bg-[#0c0d11]">
          <div className="max-w-3xl mx-auto space-y-10">
            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-[#ff6b35]">TECHNICAL REFERENCE</span>
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Frequently Asked Questions</h2>
            </div>

            <Accordion type="single" collapsible className="w-full divide-y divide-[#22252c] border-y border-[#22252c]">
              <AccordionItem value="item-1" className="border-none py-2">
                <AccordionTrigger className="text-base font-semibold text-white hover:text-[#ff6b35] hover:no-underline py-4 text-left">
                  How does ScreenCraft maintain 100% native resolution?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#8e94a0] leading-relaxed pb-4">
                  When you upload or paste an image, the engine reads the natural image dimensions (<code className="font-mono text-xs text-white">naturalWidth</code> & <code className="font-mono text-xs text-white">naturalHeight</code>) and calculates the canvas as <code className="font-mono text-xs text-white">width = naturalWidth + padding*2</code>. There is zero resampling or downscaling prior to export.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-2" className="border-none py-2">
                <AccordionTrigger className="text-base font-semibold text-white hover:text-[#ff6b35] hover:no-underline py-4 text-left">
                  Are my private screenshots or videos ever uploaded?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#8e94a0] leading-relaxed pb-4">
                  Never. ScreenCraft runs strictly client-side using the HTML5 2D Canvas API and the browser MediaRecorder stream API. No files, metadata, or frames leave your local machine.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-3" className="border-none py-2">
                <AccordionTrigger className="text-base font-semibold text-white hover:text-[#ff6b35] hover:no-underline py-4 text-left">
                  Can I create assets for the Chrome Web Store?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#8e94a0] leading-relaxed pb-4">
                  Yes. The editor includes exact canvas presets for Chrome Web Store screenshots (1280×800) and promotional marquees (1400×560), alongside Twitter/X (1200×675), Instagram, and Product Hunt dimensions.
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="item-4" className="border-none py-2">
                <AccordionTrigger className="text-base font-semibold text-white hover:text-[#ff6b35] hover:no-underline py-4 text-left">
                  How does direct clipboard copy work?
                </AccordionTrigger>
                <AccordionContent className="text-sm text-[#8e94a0] leading-relaxed pb-4">
                  ScreenCraft uses the modern <code className="font-mono text-xs text-white">navigator.clipboard.write</code> API with Blob rendering. In one click, your beautified 2×/3× PNG is loaded into your operating system clipboard, ready to paste into Slack, Notion, Twitter, or Figma.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Final Studio Call to Action */}
        <section className="py-20 sm:py-28 px-4 sm:px-6 border-t border-[#1a1d24]">
          <div className="max-w-4xl mx-auto rounded-2xl bg-[#111317] border border-[#22252c] p-8 sm:p-14 text-center space-y-6">
            <h2 className="text-2xl sm:text-4xl font-bold text-white tracking-tight">
              Ready to craft clean, studio-grade visuals?
            </h2>
            <p className="text-sm sm:text-base text-[#8e94a0] max-w-xl mx-auto">
              Launch the canvas editor, paste your capture, and download your high-DPI export in seconds.
            </p>
            <div className="pt-2">
              <Button
                onClick={onStartCrafting}
                size="lg"
                className="h-12 px-8 bg-[#ff6b35] hover:bg-[#e05622] text-white font-medium text-base rounded-xl shadow-lg shadow-[#ff6b35]/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>Launch Canvas Studio</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Studio Colophon Footer */}
      <footer className="py-8 px-4 sm:px-6 border-t border-[#1a1d24] bg-[#07080a] text-xs font-mono text-[#686f7d]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#ff6b35]">ScreenCraft Studio</span>
            <span>&bull;</span>
            <span>Local Darkroom & Metrology</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-[#8e94a0]">
            <a href="#workbench" className="hover:text-white transition-colors">
              Stage
            </a>
            <a href="#capabilities" className="hover:text-white transition-colors">
              Capabilities
            </a>
            <a href="#comparison" className="hover:text-white transition-colors">
              Architecture
            </a>
            <a href="/help" className="hover:text-white transition-colors">
              Help
            </a>
            <a href="/privacy" className="hover:text-white transition-colors">
              Privacy
            </a>
            {isAnalyticsConfigured() && (
              <button
                type="button"
                onClick={openAnalyticsSettings}
                className="hover:text-white transition-colors"
              >
                Telemetry
              </button>
            )}
            <a
              href="https://github.com/sg172003/Screen_Craft"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </div>

          <p className="text-center sm:text-right text-[#555a64]">
            &copy; {new Date().getFullYear()} ScreenCraft. MIT License.
          </p>
        </div>
      </footer>
    </div>
  );
});
