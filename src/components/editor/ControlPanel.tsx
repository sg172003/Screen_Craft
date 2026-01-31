import { memo, useCallback } from 'react';
import { ChevronDown, RotateCcw, X } from 'lucide-react';
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
}: ControlPanelProps) {
  const updateSetting = useCallback(<K extends keyof CanvasSettings>(
    key: K,
    value: CanvasSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  }, [settings, onSettingsChange]);

  const handlePresetChange = useCallback((presetName: string) => {
    const preset = CANVAS_PRESETS.find(p => p.name === presetName);
    if (preset) {
      onSettingsChange({
        ...settings,
        width: preset.width,
        height: preset.height,
      });
    }
  }, [settings, onSettingsChange]);

  const handleGradientPreset = useCallback((start: string, end: string) => {
    onSettingsChange({
      ...settings,
      gradientStart: start,
      gradientEnd: end,
    });
  }, [settings, onSettingsChange]);

  const panelContent = (
    <div className="p-4 space-y-4 overflow-y-auto flex-1">
      {/* Canvas Size Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
          Canvas Size
          <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div>
            <Label className="text-xs text-white/50 mb-1.5 block">Preset</Label>
            <Select onValueChange={handlePresetChange}>
              <SelectTrigger className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9">
                <SelectValue placeholder="Custom" />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] max-h-60">
                {CANVAS_PRESETS.map((preset) => (
                  <SelectItem 
                    key={preset.name} 
                    value={preset.name}
                    className="text-white/90 focus:bg-white/10 focus:text-white text-xs"
                  >
                    {preset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">Width</Label>
              <Input
                type="number"
                value={settings.width}
                onChange={(e) => updateSetting('width', parseInt(e.target.value) || 0)}
                className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-white/50 mb-1.5 block">Height</Label>
              <Input
                type="number"
                value={settings.height}
                onChange={(e) => updateSetting('height', parseInt(e.target.value) || 0)}
                className="bg-[hsl(220,12%,18%)] border-[hsl(220,10%,20%)] text-white/90 text-sm h-9"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Device Frame Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
          Device Frame
          <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {FRAME_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => updateSetting('frameType', option.value as CanvasSettings['frameType'])}
                className={`px-2 py-2 text-xs rounded-md border transition-colors ${
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
            <div className="flex items-center justify-between pt-2">
              <Label className="text-xs text-white/70">Dark Mode</Label>
              <Switch
                checked={settings.frameDarkMode}
                onCheckedChange={(checked) => updateSetting('frameDarkMode', checked)}
                className="data-[state=checked]:bg-[hsl(245,79%,55%)]"
              />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Background Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
          Background
          <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          <div className="grid grid-cols-3 gap-2">
            {BACKGROUND_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => updateSetting('backgroundType', option.value as CanvasSettings['backgroundType'])}
                className={`px-2 py-2 text-xs rounded-md border transition-colors ${
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
            <div className="pt-2">
              <Label className="text-xs text-white/50 mb-1.5 block">Color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => updateSetting('backgroundColor', e.target.value)}
                  className="w-8 h-8 rounded cursor-pointer border-0 p-0"
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
            <div className="space-y-3 pt-2">
              <div>
                <Label className="text-xs text-white/50 mb-1.5 block">Presets</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GRADIENT_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => handleGradientPreset(preset.start, preset.end)}
                      className="w-6 h-6 rounded-full border border-white/20 transition-transform hover:scale-110"
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
                  <Label className="text-xs text-white/50 mb-1.5 block">Start</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.gradientStart}
                      onChange={(e) => updateSetting('gradientStart', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <span className="text-xs text-white/60">{settings.gradientStart}</span>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-white/50 mb-1.5 block">End</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.gradientEnd}
                      onChange={(e) => updateSetting('gradientEnd', e.target.value)}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <span className="text-xs text-white/60">{settings.gradientEnd}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {settings.backgroundType === 'blurred' && (
            <div className="pt-2">
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs text-white/50">Blur Amount</Label>
                <span className="text-xs text-white/60">{settings.blurAmount}px</span>
              </div>
              <Slider
                value={[settings.blurAmount]}
                onValueChange={([value]) => updateSetting('blurAmount', value)}
                min={5}
                max={50}
                step={1}
                className="w-full"
              />
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Polish Section */}
      <Collapsible defaultOpen>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium text-white/90 hover:text-white group">
          Polish
          <ChevronDown className="w-4 h-4 text-white/40 group-data-[state=open]:rotate-180 transition-transform" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-2">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-white/50">Padding</Label>
              <span className="text-xs text-white/60">{settings.padding}px</span>
            </div>
            <Slider
              value={[settings.padding]}
              onValueChange={([value]) => updateSetting('padding', value)}
              min={0}
              max={100}
              step={4}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-white/50">Shadow</Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/60">{settings.shadowIntensity}</span>
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
              max={50}
              step={1}
              disabled={!settings.shadowEnabled}
              className="w-full"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label className="text-xs text-white/50">Roundness</Label>
              <span className="text-xs text-white/60">{settings.cornerRadius}px</span>
            </div>
            <Slider
              value={[settings.cornerRadius]}
              onValueChange={([value]) => updateSetting('cornerRadius', value)}
              min={0}
              max={32}
              step={1}
              className="w-full"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );

  return (
    <>
      {/* Desktop Panel */}
      <div className="hidden md:flex w-80 bg-[hsl(220,15%,14%)] border-r border-[hsl(220,10%,20%)] h-full flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[hsl(220,10%,20%)]">
          <span className="text-sm font-medium text-white/90">Controls</span>
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
        {panelContent}
      </div>

      {/* Mobile Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
          />
          
          {/* Drawer */}
          <div className="absolute right-0 top-0 bottom-0 w-80 max-w-[85vw] bg-[hsl(220,15%,14%)] border-l border-[hsl(220,10%,20%)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-[hsl(220,10%,20%)]">
              <span className="text-sm font-medium text-white/90">Controls</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onReset}
                  className="h-8 text-xs text-white/60 hover:text-white hover:bg-white/10"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0 text-white/60 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
            {panelContent}
          </div>
        </div>
      )}
    </>
  );
});
