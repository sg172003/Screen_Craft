import { memo } from 'react';
import { ArrowRight, Shield, Zap, Download, Code2, Palette, Sparkles, Upload, Sliders, Image as ImageIcon, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';

interface LandingPageProps {
  onStartCrafting: () => void;
}

export const LandingPage = memo(function LandingPage({ onStartCrafting }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 transition-colors">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-gray-900/90 backdrop-blur-md border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="logo-wrap" tabIndex={-1}>
              <img src="/logo.png" alt="ScreenCraft" className="logo-glow w-7 h-7 sm:w-8 sm:h-8" />
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
            <ThemeToggle />
            <Button 
              onClick={onStartCrafting}
              size="sm"
              className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white text-xs sm:text-sm"
            >
              <span className="hidden sm:inline">Launch Editor</span>
              <span className="sm:hidden">Start</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-24 sm:pt-32 pb-12 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-bold text-gray-900 dark:text-white leading-tight mb-4 sm:mb-6">
            Turn raw screenshots into{' '}
            <span className="gradient-text">professional visuals.</span>
          </h1>
          
          <p className="text-base sm:text-xl text-gray-600 dark:text-gray-400 max-w-xl mx-auto mb-6 sm:mb-8 px-4 sm:px-0">
            We beautify, not modify. Polish screenshots for Chrome Web Store, portfolios, 
            and product pages instantly.
          </p>

          <Button 
            onClick={onStartCrafting}
            size="lg"
            className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-xl w-full sm:w-auto"
          >
            Start Crafting — Free & No Signup
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 mt-6 sm:mt-8 text-xs sm:text-sm text-gray-500 dark:text-gray-500">
            <span className="flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Client-side
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              No storage
            </span>
            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-700" />
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Instant
            </span>
          </div>
        </div>
      </section>

      {/* Before/After Comparison */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 bg-gray-50 dark:bg-gray-800 transition-colors">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-2 gap-6 sm:gap-8 items-center">
            {/* Before */}
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Raw Screenshot</p>
              <div className="bg-white dark:bg-gray-700 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-600 card-hover relative">
                <div className="bg-gray-100 dark:bg-gray-600 p-3 sm:p-4">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="bg-white dark:bg-gray-700 rounded-lg p-3 sm:p-4 shadow-sm">
                    <div className="h-3 sm:h-4 w-24 sm:w-32 bg-gray-200 dark:bg-gray-600 rounded mb-2 sm:mb-3" />
                    <div className="h-2.5 sm:h-3 w-full bg-gray-100 dark:bg-gray-600 rounded mb-1.5 sm:mb-2" />
                    <div className="h-2.5 sm:h-3 w-4/5 bg-gray-100 dark:bg-gray-600 rounded mb-1.5 sm:mb-2" />
                    <div className="h-2.5 sm:h-3 w-3/5 bg-gray-100 dark:bg-gray-600 rounded" />
                  </div>
                </div>
              </div>
            </div>

            {/* After */}
            <div className="space-y-3 sm:space-y-4">
              <p className="text-xs sm:text-sm font-medium text-[hsl(245,79%,55%)] uppercase tracking-wider">ScreenCraft Polish</p>
              <div 
                className="rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden card-hover relative"
                style={{
                  background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
                  padding: '24px',
                }}
              >
                <div 
                  className="bg-white dark:bg-gray-700 rounded-lg sm:rounded-xl shadow-xl overflow-hidden"
                  style={{
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                  }}
                >
                  <div className="bg-gray-50 dark:bg-gray-600 px-2 sm:px-3 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-2 border-b border-gray-100 dark:border-gray-600">
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-400" />
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-green-400" />
                    <div className="flex-1 mx-2 sm:mx-3">
                      <div className="bg-white dark:bg-gray-700 rounded-md h-4 sm:h-5 w-full border border-gray-200 dark:border-gray-600" />
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <div className="h-3 sm:h-4 w-24 sm:w-32 bg-gray-200 dark:bg-gray-600 rounded mb-2 sm:mb-3" />
                    <div className="h-2.5 sm:h-3 w-full bg-gray-100 dark:bg-gray-600 rounded mb-1.5 sm:mb-2" />
                    <div className="h-2.5 sm:h-3 w-4/5 bg-gray-100 dark:bg-gray-600 rounded mb-1.5 sm:mb-2" />
                    <div className="h-2.5 sm:h-3 w-3/5 bg-gray-100 dark:bg-gray-600 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-16 sm:py-24 px-4 sm:px-6 dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4">
              How it works
            </h2>
            <p className="text-base sm:text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
              Three simple steps to transform your screenshots
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
                Upload Screenshot
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Drag and drop or click to upload your PNG or JPG screenshot. Everything stays in your browser.
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
                Customize Style
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Choose device frames, backgrounds, padding, and shadows. See changes instantly in the preview.
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
                Download & Share
              </h3>
              <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 leading-relaxed">
                Export high-resolution PNG with one click. Perfect for Chrome Web Store, social media, or portfolios.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 bg-gray-50 dark:bg-gray-800 transition-colors">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-gray-900 dark:text-white mb-10 sm:mb-12">
            Built for creators
          </h2>
          
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            <div className="text-center p-4 sm:p-6 bg-white dark:bg-gray-700 rounded-xl shadow-sm card-hover relative overflow-hidden">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Code2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5 sm:mb-2">Developers</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Create polished screenshots for GitHub repos, documentation, and portfolios.
              </p>
            </div>

            <div className="text-center p-4 sm:p-6 bg-white dark:bg-gray-700 rounded-xl shadow-sm card-hover relative overflow-hidden">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Palette className="w-5 h-5 sm:w-6 sm:h-6 text-purple-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5 sm:mb-2">Designers</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Showcase your work with beautiful device frames and gradients.
              </p>
            </div>

            <div className="text-center p-4 sm:p-6 bg-white dark:bg-gray-700 rounded-xl shadow-sm card-hover relative overflow-hidden">
              <div className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 bg-pink-50 dark:bg-pink-900/30 rounded-xl flex items-center justify-center">
                <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500" />
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1.5 sm:mb-2">Product Builders</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Perfect for Chrome Web Store, Product Hunt, and app store listings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features List */}
      <section className="py-16 sm:py-20 px-4 sm:px-6 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <div className="grid sm:grid-cols-2 gap-8 sm:gap-12">
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Everything you need
              </h3>
              <ul className="space-y-3 sm:space-y-4">
                {[
                  'Canvas presets for Chrome Web Store & social',
                  'Device frames: Browser, Desktop, Mobile',
                  'Gradient & solid color backgrounds',
                  'Blurred background from screenshot',
                  'Adjustable padding & corner radius',
                  'Shadow effects with intensity control',
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
                  '100% client-side processing',
                  'No images uploaded to servers',
                  'No account required',
                  'No tracking or analytics',
                  'Open source & transparent',
                  'Your data stays yours',
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

      {/* Privacy Note */}
      <section className="py-12 sm:py-16 px-4 sm:px-6 bg-gray-900 dark:bg-gray-950 text-white">
        <div className="max-w-3xl mx-auto text-center">
          <Shield className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-green-400" />
          <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4">Privacy First</h2>
          <p className="text-gray-400 max-w-lg mx-auto text-sm sm:text-base">
            ScreenCraft runs entirely in your browser. Your screenshots never leave your device. 
            No uploads, no storage, no tracking.
          </p>
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
            className="bg-[hsl(245,79%,55%)] hover:bg-[hsl(245,79%,45%)] text-white text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 h-auto rounded-xl w-full sm:w-auto"
          >
            Start Crafting Now
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-6 sm:py-8 px-4 sm:px-6 border-t border-gray-100 dark:border-gray-800 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="ScreenCraft" className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">ScreenCraft</span>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 text-center">
            © 2026 ScreenCraft. All rights reserved. <br />
       <b>🚀 Author : Sarthak 😊 </b>
          </p>
        </div>
      </footer>
    </div>
  );
});
