import { memo, useEffect, useRef } from 'react';
import { ArrowRight, Upload, Sliders, Image as ImageIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { renderToCanvas } from '@/lib/canvasRenderer';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface LandingPageProps {
  onStartCrafting: () => void;
}

const DEMO_SCREENSHOT = `data:image/svg+xml,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="960" height="480" viewBox="0 0 960 480">
    <rect width="960" height="480" fill="#f8fafc"/>
    <rect width="960" height="64" fill="#ffffff"/>
    <rect x="48" y="22" width="26" height="20" rx="6" fill="#4f46e5"/>
    <path d="M56 36l5-9 5 9" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="88" y="25" width="118" height="12" rx="6" fill="#111827"/>
    <rect x="700" y="27" width="62" height="9" rx="4" fill="#94a3b8"/>
    <rect x="784" y="27" width="54" height="9" rx="4" fill="#94a3b8"/>
    <rect x="860" y="17" width="58" height="30" rx="8" fill="#4f46e5"/>
    <rect y="64" width="960" height="416" fill="#eef2ff"/>
    <rect x="56" y="126" width="400" height="18" rx="9" fill="#4f46e5" opacity=".16"/>
    <rect x="56" y="170" width="510" height="42" rx="10" fill="#111827"/>
    <rect x="56" y="222" width="350" height="42" rx="10" fill="#111827"/>
    <rect x="56" y="286" width="400" height="13" rx="6" fill="#64748b"/>
    <rect x="56" y="310" width="350" height="13" rx="6" fill="#94a3b8"/>
    <rect x="56" y="354" width="148" height="44" rx="10" fill="#4f46e5"/>
    <rect x="226" y="369" width="112" height="12" rx="6" fill="#64748b"/>
    <rect x="618" y="112" width="286" height="284" rx="24" fill="#fff"/>
    <rect x="646" y="140" width="230" height="120" rx="16" fill="#c7d2fe"/>
    <circle cx="762" cy="200" r="34" fill="#4f46e5" opacity=".82"/>
    <path d="M750 183l29 17-29 17z" fill="#fff"/>
    <rect x="646" y="284" width="180" height="13" rx="6" fill="#1e293b"/>
    <rect x="646" y="309" width="230" height="9" rx="4" fill="#cbd5e1"/>
    <rect x="646" y="328" width="198" height="9" rx="4" fill="#e2e8f0"/>
    <rect x="646" y="356" width="90" height="22" rx="7" fill="#e0e7ff"/>
  </svg>
`)}`;

function ComparisonDemo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const screenshot = new Image();
    screenshot.onload = () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;

      const settings = {
        width: 960,
        height: 560,
        padding: 40,
        cornerRadius: 14,
        shadowIntensity: 20,
        shadowEnabled: true,
        backgroundType: 'gradient' as const,
        backgroundColor: '#ffffff',
        gradientStart: '#3b82f6',
        gradientEnd: '#8b5cf6',
        gradientDirection: 135,
        blurAmount: 20,
        frameType: 'browser' as const,
        frameDarkMode: false,
        exportScale: 1,
      };

      canvas.width = settings.width;
      canvas.height = settings.height;
      renderToCanvas(context, settings.width, settings.height, settings, screenshot);
    };
    screenshot.src = DEMO_SCREENSHOT;
  }, []);

  return (
    <section aria-label="Before and after screenshot example" className="py-12 sm:py-20 px-4 sm:px-6 bg-gray-50 dark:bg-gray-800 transition-colors">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400">Original screenshot</p>
            <div className="aspect-[12/7] bg-white rounded-xl sm:rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-600">
              <img src={DEMO_SCREENSHOT} alt="Original product page screenshot without a device frame" width="960" height="480" className="w-full h-full object-cover" />
            </div>
          </div>
          <div className="space-y-3 sm:space-y-4">
            <p className="text-xs sm:text-sm font-medium text-[hsl(245,79%,55%)]">ScreenCraft result</p>
            <div className="aspect-[12/7] rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-violet-500">
              <canvas ref={canvasRef} aria-label="ScreenCraft rendered browser frame on a gradient background" className="w-full h-full object-contain" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export const LandingPage = memo(function LandingPage({ onStartCrafting }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[110] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-gray-900 focus:shadow-lg">
        Skip to content
      </a>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="logo-wrap" tabIndex={-1}>
              <img src="/logo.png" alt="" width="32" height="32" className="logo-glow w-7 h-7 sm:w-8 sm:h-8" />
            </span>
            <span className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg">ScreenCraft</span>
          </div>
          <div className="flex items-center gap-3 sm:gap-6">
            <a 
              href="#how-it-works" 
              className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              How it works
            </a>
            <a 
              href="#features" 
              className="hidden md:block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Features
            </a>
            <a 
              href="#faq" 
              className="hidden sm:block text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              FAQ
            </a>
            <ThemeToggle />
            <Button 
              onClick={onStartCrafting}
              size="sm"
              className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white text-xs sm:text-sm font-medium shadow-sm"
            >
              <span className="hidden sm:inline">Launch Editor</span>
              <span className="sm:hidden">Start</span>
            </Button>
          </div>
        </div>
      </nav>

      <main id="main-content" tabIndex={-1}>
      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-balance text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-4 sm:mb-6">
            Turn raw screenshots & recordings into{' '}
            <span className="gradient-text">professional visuals.</span>
          </h1>
          
          <p className="text-base sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-6 sm:mb-8 px-4 sm:px-0">
            We beautify, not modify.
          </p>

          <Button 
            onClick={onStartCrafting}
            size="lg"
            className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-xl w-full sm:w-auto shadow-lg shadow-[hsl(245,79%,55%)]/25"
          >
            Start Crafting — Free & No Signup
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>

        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 dark:bg-gray-900 scroll-mt-20">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              How it works
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Three simple steps to transform your screenshots into stunning graphics
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-6">
            {/* Step 1 */}
            <div className="relative text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/25">
                <Upload className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="hidden sm:block absolute top-8 left-[60%] w-full">
                <div className="h-0.5 bg-gradient-to-r from-blue-500/50 to-purple-500/50 w-1/2" />
              </div>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 text-xs font-semibold mb-3">
                1
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Upload or Paste (Ctrl+V)
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Drag, drop, browse, or directly paste with Ctrl+V. Preserves 100% of native screenshot resolution.
              </p>
            </div>

            {/* Step 2 */}
            <div className="relative text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/25">
                <Sliders className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <div className="hidden sm:block absolute top-8 left-[60%] w-full">
                <div className="h-0.5 bg-gradient-to-r from-purple-500/50 to-pink-500/50 w-1/2" />
              </div>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 text-xs font-semibold mb-3">
                2
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Customize Frames & Style
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Choose macOS browser, desktop, or mobile frames, vibrant gradients, shadows, and store presets.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4 sm:mb-6 bg-gradient-to-br from-pink-500 to-rose-600 rounded-2xl flex items-center justify-center shadow-lg shadow-pink-500/25">
                <ImageIcon className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
              </div>
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400 text-xs font-semibold mb-3">
                3
              </span>
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Download 4K Retina PNG
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Export crisp 2x or 3x high-resolution PNGs or copy straight to clipboard for instant sharing.
              </p>
            </div>
          </div>
        </div>
      </section>

      <ComparisonDemo />

      {/* Features and privacy */}
      <section id="features" className="py-16 sm:py-20 px-4 sm:px-6 dark:bg-gray-900 scroll-mt-20">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-8 sm:gap-12">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Everything you need
              </h3>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  'Preserve native resolution; export at 1x, 2x, or 3x',
                  'Add browser, desktop, or phone frames',
                  'Choose a preset, background, padding, and shadow',
                  'Export PNGs or copy them to your clipboard',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Privacy first
              </h3>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  'Images and videos are processed in your browser',
                  'Media is never uploaded; no account is needed',
                  'Optional usage analytics never include media content',
                  'Works offline after the first visit',
                ].map((feature, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    <span className="text-gray-600 dark:text-gray-400 text-sm sm:text-base">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section (Crucial for SEO Rich Snippets) */}
      <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 bg-gray-50 dark:bg-gray-800/60 transition-colors scroll-mt-20">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              Frequently Asked Questions
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400">
              A few quick answers about ScreenCraft
            </p>
          </div>

          <Accordion type="single" collapsible className="w-full space-y-3">
            <AccordionItem value="item-1" className="bg-white dark:bg-gray-700/80 rounded-xl px-4 sm:px-6 border border-gray-200 dark:border-gray-600 shadow-xs">
              <AccordionTrigger className="text-base font-semibold text-gray-900 dark:text-white hover:no-underline">
                How do I create mockups for the Chrome Web Store?
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                Choose a Chrome Web Store preset in the editor to size your canvas for a marquee or store screenshot.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2" className="bg-white dark:bg-gray-700/80 rounded-xl px-4 sm:px-6 border border-gray-200 dark:border-gray-600 shadow-xs">
              <AccordionTrigger className="text-base font-semibold text-gray-900 dark:text-white hover:no-underline">
                Does ScreenCraft compress or reduce my screenshot quality?
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                Your source is kept at its native resolution. Choose 1x, 2x, or 3x when exporting a PNG.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3" className="bg-white dark:bg-gray-700/80 rounded-xl px-4 sm:px-6 border border-gray-200 dark:border-gray-600 shadow-xs">
              <AccordionTrigger className="text-base font-semibold text-gray-900 dark:text-white hover:no-underline">
                Are my screenshots private and secure?
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                Your images and videos stay in your browser and are never uploaded. Optional usage analytics can measure feature use, but do not include media content.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4" className="bg-white dark:bg-gray-700/80 rounded-xl px-4 sm:px-6 border border-gray-200 dark:border-gray-600 shadow-xs">
              <AccordionTrigger className="text-base font-semibold text-gray-900 dark:text-white hover:no-underline">
                Can I paste screenshots directly from my clipboard?
              </AccordionTrigger>
              <AccordionContent className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed">
                Yes! Press Ctrl+V (or Cmd+V on Mac) anywhere in the app after capturing a screenshot to import it instantly without needing to save a temporary file.
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
            Ready to beautify your screenshots?
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">
            Start crafting professional visuals in seconds. No signup required.
          </p>
          <Button 
            onClick={onStartCrafting}
            size="lg"
            className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-xl w-full sm:w-auto shadow-lg shadow-[hsl(245,79%,55%)]/20"
          >
            Start Crafting Now — Free
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>
        </div>
      </section>
      </main>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 sm:px-6 border-t border-gray-100 dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" width="24" height="24" className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ScreenCraft</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <a href="#how-it-works" className="hover:text-gray-900 dark:hover:text-white transition-colors">How it works</a>
            <a href="#features" className="hover:text-gray-900 dark:hover:text-white transition-colors">Features</a>
            <a href="#faq" className="hover:text-gray-900 dark:hover:text-white transition-colors">FAQ</a>
            <a href="https://github.com/sg172003/Screen_Craft" target="_blank" rel="noopener noreferrer" className="hover:text-gray-900 dark:hover:text-white transition-colors">GitHub</a>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center sm:text-right">
            © 2026 ScreenCraft. <br />
            <b>🚀 Author : Sarthak 😊 </b>
          </p>
        </div>
      </footer>
    </div>
  );
});
