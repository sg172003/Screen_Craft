import { memo } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/context/ThemeContext';

export const ThemeToggle = memo(function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <Button
      onClick={toggleTheme}
      variant="ghost"
      size="sm"
      className="w-9 h-9 p-0 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-all duration-150 active:scale-90"
      aria-label="Toggle theme"
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {theme === 'light' ? (
          <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300 transition-transform duration-300 hover:-rotate-12" />
        ) : (
          <Sun className="w-4 h-4 text-amber-400 transition-transform duration-300 hover:rotate-45" />
        )}
      </div>
    </Button>
  );
});
