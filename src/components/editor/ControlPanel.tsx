import { memo, useCallback, useState } from 'react';
import { ChevronDown, RotateCcw, X, Sparkles, Sliders, Palette, Monitor, Scaling } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { CanvasSettings } from '@/types';
import { CANVAS_PRESETS, GRADIENT_PRESETS } from '@/types';

interface ControlPanelProps {
  settings: CanvasSettings;
  onSettingsChange: (settings: CanvasSettings) => void;
  onReset: () => void;
  isOpen: boolean;
  onClose: () => void;
  image?: HTMLImageElement | HTMLVideoElement | null;
}

const FRAME_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'browser', label: 'Browser' },
  { value: 'desktop', label: 'Desktop' },
  { value: 'mobile', label: 'Mobile' },
];

const BACKGROUND_OPTIONS = [
  { value: 'solid', label: 'Solid' },
  { value: 'gradient', label: 'Gradient' },
  { value: 'blurred', label: 'Blurred' },
];

export const ControlPanel = memo(function ControlPanel({
  settings,
  onSettingsChange,
  onReset,
  isOpen,
  onClose,
  image,
}: ControlPanelProps) {
  const [mobileTab, setMobileTab] = useState<'frame' | 'bg' | 'polish' | 'size'>('frame');

  const updateSetting = useCallback(
    <K extends keyof CanvasSettings>(key: K, value: CanvasSettings[K]) => {
      onSettingsChange({ ...settings, [key]: value });
    },
    [settings, onSettingsChange]
  );

  const handleMatchScreenshot = useCallback(() => {
    if (!image) return;
    const mediaWidth = 'naturalWidth' in image ? image.naturalWidth : image.videoWidth;
    const mediaHeight = 'naturalHeight' in image ? image.naturalHeight : image.videoHeight;
    const padding = settings.padding || 40;
    let frameOffset = 0;
    if (settings.frameType === 'browser') frameOffset = 32;
    else if (settings.frameType === 'desktop') frameOffset = 28;

    onSettingsChange({
      ...settings,
      width: Math.round(mediaWidth + padding * 2),
      height: Math.round(mediaHeight + padding * 2 + frameOffset),
    });
  }, [image, settings, onSettingsChange]);

  const handlePresetChange = useCallback(
    (presetName: string) => {
      if (presetName === 'Auto (Match Screenshot)') {
        handleMatchScreenshot();
        return;
      }
      const preset = CANVAS_PRESETS.find((p) => p.name === presetName);
      if (preset && preset.width > 0 && preset.height > 0) {
        onSettingsChange({
          ...settings,
          width: preset.width,
          height: preset.height,
        });
      }
    },
    [settings, onSettingsChange, handleMatchScreenshot]
  );

  const handleGradientPreset = useCallback(
    (start: string, end: string) => {
      onSettingsChange({
        ...settings,
        gradientStart: start,
        gradientEnd: end,
      });
    },
    [settings, onSettingsChange]
  );

  // Common Sections
  const sizeSection = (
    <div className="space-y-3">
      {image && (
        <button
          type="button"
          onClick={handleMatchScreenshot}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-[hsl(245,79%,55%)]/15 border border-[hsl(245,79%,55%)]/30 text-white hover:bg-[hsl(245,79%,55%)]/25 transition-all text-xs font-medium"
        >
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[hsl(245,79%,65%)]" />
            Match Media (100% Native)
          </span>
          <span className="text-[11px] text-white/50">
            {'naturalWidth' in image ? image.naturalWidth : image.videoWidth}×
            {'naturalHeight' in image ? image.naturalHeight : image.videoHeight}
          </span>
        </button>
      )}

      <div>
        <Label className="text-xs text-white/50 mb-1.5 block">Preset</Label>
        <Select onValueChange={handlePresetChange}>
          <SelectTrigger className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9">
            <SelectValue placeholder="Select preset..." />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] max-h-60 text-white">
            {CANVAS_PRESETS.map((preset) => (
              <SelectItem
                key={preset.name}
                value={preset.name}
                className="text-white/90 focus:bg-white/10 focus:text-white text-xs"
              >
                {preset.name} {preset.width > 0 ? `(${preset.width}×${preset.height})` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-white/50 mb-1.5 block">Width (px)</Label>
          <Input
            type="number"
            value={settings.width}
            onChange={(e) => updateSetting('width', Math.max(100, parseInt(e.target.value) || 0))}
            className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9"
          />
        </div>
        <div>
          <Label className="text-xs text-white/50 mb-1.5 block">Height (px)</Label>
          <Input
            type="number"
            value={settings.height}
            onChange={(e) => updateSetting('height', Math.max(100, parseInt(e.target.value) || 0))}
            className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9"
          />
        </div>
      </div>

      <div className="pt-2 border-t border-white/5">
        <Label className="text-xs text-white/50 mb-1.5 block">Export Scale (Resolution)</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { scale: 1, label: '1x Normal' },
            { scale: 2, label: '2x Retina' },
            { scale: 3, label: '3x Ultra HD' },
          ].map((item) => (
            <button
              key={item.scale}
              type="button"
              onClick={() => updateSetting('exportScale', item.scale)}
              className={`py-1.5 px-2 text-xs rounded-md border font-medium transition-all ${
                (settings.exportScale || 2) === item.scale
                  ? 'bg-[hsl(245,79%,55%)] border-[hsl(245,79%,55%)] text-white shadow-sm'
                  : 'bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/70 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-white/40 mt-1">
          Export resolution: {settings.width * (settings.exportScale || 2)} × {settings.height * (settings.exportScale || 2)}px
        </p>
      </div>
    </div>
  );

  const frameSection = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {FRAME_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateSetting('frameType', option.value as CanvasSettings['frameType'])}
            className={`px-3 py-2 text-xs rounded-md border font-medium transition-colors ${
              settings.frameType === option.value
                ? 'bg-[hsl(245,79%,55%)] border-[hsl(245,79%,55%)] text-white'
                : 'bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/70 hover:text-white hover:border-white/30'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {settings.frameType !== 'none' && (
        <div className="flex items-center justify-between pt-1">
          <Label className="text-xs text-white/70">Frame Dark Mode</Label>
          <Switch
            checked={settings.frameDarkMode}
            onCheckedChange={(checked) => updateSetting('frameDarkMode', checked)}
            className="data-[state=checked]:bg-[hsl(245,79%,55%)]"
          />
        </div>
      )}
    </div>
  );

  const bgSection = (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {BACKGROUND_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => updateSetting('backgroundType', option.value as CanvasSettings['backgroundType'])}
            className={`px-2 py-2 text-xs rounded-md border font-medium transition-colors ${
              settings.backgroundType === option.value
                ? 'bg-[hsl(245,79%,55%)] border-[hsl(245,79%,55%)] text-white'
                : 'bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/70 hover:text-white hover:border-white/30'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {settings.backgroundType === 'solid' && (
        <div className="pt-1">
          <Label className="text-xs text-white/50 mb-1.5 block">Solid Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={settings.backgroundColor}
              onChange={(e) => updateSetting('backgroundColor', e.target.value)}
              className="w-8 h-8 rounded cursor-pointer border-0 p-0 shrink-0"
            />
            <Input
              type="text"
              value={settings.backgroundColor}
              onChange={(e) => updateSetting('backgroundColor', e.target.value)}
              className="flex-1 bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9"
            />
          </div>
        </div>
      )}

      {settings.backgroundType === 'gradient' && (
        <div className="space-y-3 pt-1">
          <div>
            <Label className="text-xs text-white/50 mb-1.5 block">Gradient Presets</Label>
            <div className="flex flex-wrap gap-2">
              {GRADIENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => handleGradientPreset(preset.start, preset.end)}
                  className="w-7 h-7 rounded-full border border-white/20 transition-transform hover:scale-110 active:scale-95"
                  style={{
                    background: `linear-gradient(135deg, ${preset.start}, ${preset.end})`,
                  }}
                  title={preset.name}
                />
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">Start Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.gradientStart}
                  onChange={(e) => updateSetting('gradientStart', e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs text-white/60 font-mono">{settings.gradientStart}</span>
              </div>
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">End Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.gradientEnd}
                  onChange={(e) => updateSetting('gradientEnd', e.target.value)}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0"
                />
                <span className="text-xs text-white/60 font-mono">{settings.gradientEnd}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {settings.backgroundType === 'blurred' && (
        <div className="pt-1">
          <div className="flex items-center justify-between mb-1.5">
            <Label className="text-xs text-white/50">Blur Intensity</Label>
            <span className="text-xs text-white/60 font-mono">{settings.blurAmount}px</span>
          </div>
          <Slider
            value={[settings.blurAmount]}
            onValueChange={([value]) => updateSetting('blurAmount', value)}
            min={5}
            max={60}
            step={1}
            className="w-full"
          />
        </div>
      )}
    </div>
  );

  const polishSection = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-white/50">Padding</Label>
          <span className="text-xs text-white/60 font-mono">{settings.padding}px</span>
        </div>
        <Slider
          value={[settings.padding]}
          onValueChange={([value]) => updateSetting('padding', value)}
          min={0}
          max={120}
          step={4}
          className="w-full"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-white/50">Drop Shadow</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60 font-mono">{settings.shadowIntensity}</span>
            <Switch
              checked={settings.shadowEnabled}
              onCheckedChange={(checked) => updateSetting('shadowEnabled', checked)}
              className="data-[state=checked]:bg-[hsl(245,79%,55%)] scale-75"
            />
          </div>
        </div>
        <Slider
          value={[settings.shadowIntensity]}
          onValueChange={([value]) => updateSetting('shadowIntensity', value)}
          min={0}
          max={60}
          step={2}
          disabled={!settings.shadowEnabled}
          className="w-full"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label className="text-xs text-white/50">Corner Radius</Label>
          <span className="text-xs text-white/60 font-mono">{settings.cornerRadius}px</span>
        </div>
        <Slider
          value={[settings.cornerRadius]}
          onValueChange={([value]) => updateSetting('cornerRadius', value)}
          min={0}
          max={40}
          step={1}
          className="w-full"
        />
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Left Sidebar */}
      <div className="hidden md:flex w-80 bg-[hsl(220,15%,14%)] border-r border-[hsl(220,10%,20%)] h-full flex-col shrink-0 select-none">
        <div className="flex items-center justify-between p-4 border-b border-[hsl(220,10%,20%)]">
          <span className="text-sm font-semibold text-white/90">Controls</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-8 text-xs text-white/60 hover:text-white hover:bg-white/10"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Canvas Size Section */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
              <span className="flex items-center gap-2">
                <Scaling className="w-4 h-4 text-white/50" />
                Canvas Size & Scale
              </span>
              <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">{sizeSection}</CollapsibleContent>
          </Collapsible>

          {/* Device Frame Section */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
              <span className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-white/50" />
                Device Frame
              </span>
              <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">{frameSection}</CollapsibleContent>
          </Collapsible>

          {/* Background Section */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
              <span className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-white/50" />
                Background
              </span>
              <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">{bgSection}</CollapsibleContent>
          </Collapsible>

          {/* Polish Section */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
              <span className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-white/50" />
                Polish
              </span>
              <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">{polishSection}</CollapsibleContent>
          </Collapsible>
        </div>
      </div>

      {/* Mobile Bottom Sheet (Keeps canvas preview visible above on phones!) */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex flex-col justify-end">
          {/* Semi-transparent backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          {/* Bottom Sheet Card */}
          <div className="relative z-10 bg-[hsl(220,15%,14%)] border-t border-[hsl(220,10%,20%)] rounded-t-2xl max-h-[68vh] flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200">
            {/* Sheet Handle & Header */}
            <div className="px-4 pt-3 pb-2 border-b border-white/10 shrink-0">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-3" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-white/90">Edit Controls</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    className="h-7 text-xs text-white/60 hover:text-white px-2"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Reset
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onClose}
                    className="h-7 w-7 p-0 text-white/60 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Mobile Tab Pills */}
              <div className="grid grid-cols-4 gap-1 mt-3 bg-black/30 p-1 rounded-lg">
                {[
                  { id: 'frame', label: 'Frame', icon: Monitor },
                  { id: 'bg', label: 'Background', icon: Palette },
                  { id: 'polish', label: 'Polish', icon: Sliders },
                  { id: 'size', label: 'Size', icon: Scaling },
                ].map((tab) => {
                  const Icon = tab.icon;
                  const isActive = mobileTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setMobileTab(tab.id as typeof mobileTab)}
                      className={`flex flex-col sm:flex-row items-center justify-center gap-1 py-1.5 px-2 rounded-md text-[11px] font-medium transition-colors ${
                        isActive
                          ? 'bg-[hsl(245,79%,55%)] text-white shadow-sm'
                          : 'text-white/60 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mobile Tab Content */}
            <div className="p-4 overflow-y-auto flex-1 min-h-[220px]">
              {mobileTab === 'frame' && frameSection}
              {mobileTab === 'bg' && bgSection}
              {mobileTab === 'polish' && polishSection}
              {mobileTab === 'size' && sizeSection}
            </div>
          </div>
        </div>
      )}
    </>
  );
});
