import { useState, useCallback, lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import './App.css';

// Lazy load pages for better bundle splitting
const LandingPage = lazy(() => import('@/sections/LandingPage').then(m => ({ default: m.LandingPage })));
const EditorPage = lazy(() => import('@/sections/EditorPage').then(m => ({ default: m.EditorPage })));

function App() {
  const [showEditor, setShowEditor] = useState(false);

  const handleStartCrafting = useCallback(() => {
    setShowEditor(true);
  }, []);

  const handleBack = useCallback(() => {
    setShowEditor(false);
  }, []);

  return (
    <Suspense 
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <Spinner className="w-8 h-8 text-[hsl(245,79%,55%)]" />
        </div>
      }
    >
      {showEditor ? (
        <EditorPage onBack={handleBack} />
      ) : (
        <LandingPage onStartCrafting={handleStartCrafting} />
      )}
    </Suspense>
  );
}

export default App;
