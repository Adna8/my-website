import React, { useEffect, useState } from 'react';
import logoFallback from '@/assets/smart-shelf-logo.jpg';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';

const Splash: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          return 100;
        }
        return prev + 2.5; // Will reach 100% in 4 seconds (40 steps * 100ms)
      });
    }, 100);

    // Navigate to auth after 4 seconds
    const timer = setTimeout(() => {
      navigate('/auth');
    }, 4000);

    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-background via-primary/5 to-secondary/5">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center space-y-8 animate-scale-in">
        {/* Logo container with glow effect */}
        <div className="relative inline-flex items-center justify-center w-80 h-80 rounded-3xl overflow-hidden glass-card ring-1 ring-white/10 shadow-glow-primary">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-transparent blur-3xl opacity-30 animate-glow" />
          <img
            src={logoFallback}
            alt="Smart Shelf Logo"
            className="relative w-full h-full object-contain p-6 animate-fade-in drop-shadow-2xl"
            style={{ filter: 'drop-shadow(0 0 40px hsl(var(--primary) / 0.5))' }}
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== logoFallback) img.src = logoFallback;
            }}
          />
        </div>

        {/* Welcome text */}
        <div className="text-center space-y-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <h1 className="text-5xl font-bold text-gradient-hero">
            {t('home.title')}
          </h1>
          <p className="text-xl text-muted-foreground">
            Welcome to Your Digital Library
          </p>
        </div>

        {/* Loading progress */}
        <div className="w-80 space-y-3 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary via-secondary to-accent transition-all duration-300 ease-out rounded-full shadow-glow-primary"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Loading your experience... {Math.round(progress)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default Splash;
