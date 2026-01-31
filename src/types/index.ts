export interface CanvasSettings {
  width: number;
  height: number;
  padding: number;
  cornerRadius: number;
  shadowIntensity: number;
  shadowEnabled: boolean;
  backgroundType: 'solid' | 'gradient' | 'blurred';
  backgroundColor: string;
  gradientStart: string;
  gradientEnd: string;
  gradientDirection: number;
  blurAmount: number;
  frameType: 'none' | 'browser' | 'desktop' | 'mobile';
  frameDarkMode: boolean;
}

export interface CanvasPreset {
  name: string;
  width: number;
  height: number;
  category: 'chrome-web-store' | 'social' | 'custom';
}

export const CANVAS_PRESETS: CanvasPreset[] = [
  { name: 'Chrome Web Store Marquee', width: 1400, height: 560, category: 'chrome-web-store' },
  { name: 'Chrome Web Store Screenshot', width: 1280, height: 800, category: 'chrome-web-store' },
  { name: 'Twitter/X Post', width: 1200, height: 675, category: 'social' },
  { name: 'Instagram Post', width: 1080, height: 1080, category: 'social' },
  { name: 'Instagram Story', width: 1080, height: 1920, category: 'social' },
  { name: 'LinkedIn Post', width: 1200, height: 627, category: 'social' },
  { name: 'Dribbble Shot', width: 1600, height: 1200, category: 'social' },
  { name: 'Product Hunt', width: 1270, height: 760, category: 'social' },
];

export const GRADIENT_PRESETS = [
  { start: '#3B82F6', end: '#8B5CF6', name: 'Blue to Purple' },
  { start: '#10B981', end: '#3B82F6', name: 'Green to Blue' },
  { start: '#F59E0B', end: '#EF4444', name: 'Amber to Red' },
  { start: '#EC4899', end: '#8B5CF6', name: 'Pink to Purple' },
  { start: '#06B6D4', end: '#3B82F6', name: 'Cyan to Blue' },
  { start: '#84CC16', end: '#10B981', name: 'Lime to Green' },
];

export const DEFAULT_SETTINGS: CanvasSettings = {
  width: 1400,
  height: 560,
  padding: 40,
  cornerRadius: 12,
  shadowIntensity: 20,
  shadowEnabled: true,
  backgroundType: 'gradient',
  backgroundColor: '#1e293b',
  gradientStart: '#3B82F6',
  gradientEnd: '#8B5CF6',
  gradientDirection: 135,
  blurAmount: 20,
  frameType: 'browser',
  frameDarkMode: false,
};
