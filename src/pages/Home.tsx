import React, { useState } from 'react';
import logoFallback from '@/assets/smart-shelf-logo.jpg';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mic, MessageCircle, Map, Search } from 'lucide-react';

const Home: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

  const features = [
    {
      icon: Mic,
      title: t('home.voice.title'),
      description: t('home.voice.desc'),
      color: 'primary',
      onClick: () => navigate('/search'),
    },
    {
      icon: MessageCircle,
      title: t('home.assistant.title'),
      description: t('home.assistant.desc'),
      color: 'secondary',
      onClick: () => navigate('/chat'),
    },
    {
      icon: Map,
      title: t('home.shelf.title'),
      description: t('home.shelf.desc'),
      color: 'accent',
      onClick: () => navigate('/shelf'),
    },
  ];

  return (
    <div className="min-h-screen pt-24 px-6 pb-12 relative overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/10 to-transparent animate-pulse" style={{ animationDuration: '4s' }} />
      
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto text-center mb-12 animate-fade-in relative z-10">
        <div className="inline-flex items-center justify-center w-28 h-28 mb-6 glass-card rounded-2xl overflow-hidden shadow-glow-primary animate-float ring-1 ring-white/10 bg-gradient-to-br from-primary/15 via-secondary/15 to-background">
          <img
            src={logoFallback}
            alt="Smart Shelf Logo"
            className="w-full h-full object-contain p-3"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.src !== logoFallback) img.src = logoFallback;
            }}
          />
        </div>
        <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight text-gradient-hero">
          {t('home.title')}
        </h1>
        <p className="text-xl text-muted-foreground mb-8">
          {t('home.subtitle')}
        </p>

        {/* Search Box */}
        <form onSubmit={handleSearch} className="relative">
          <div className="flex items-center gap-3 p-2 glass-card rounded-2xl border-2 border-primary/30 focus-within:border-primary focus-within:shadow-glow-primary shadow-apple transition-smooth">
            <Search className="w-6 h-6 text-muted-foreground ml-4" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search.placeholder')}
              className="flex-1 border-0 focus-visible:ring-0 text-lg h-14 bg-transparent"
            />
            <Button type="submit" size="lg" className="rounded-xl bg-gradient-to-r from-primary to-secondary shadow-glow-primary hover:shadow-glow-secondary transform hover:scale-105 transition-smooth">
              {t('search.button')}
            </Button>
          </div>
        </form>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          {features.map((feature, index) => (
            <button
              key={index}
              onClick={feature.onClick}
              className="group p-8 glass-card rounded-2xl border-2 border-transparent hover:border-primary shadow-apple hover:shadow-glow-primary transition-smooth text-center space-y-4 transform hover:scale-105"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div
                className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-${feature.color}/10 group-hover:bg-${feature.color}/20 transition-smooth`}
              >
                <feature.icon className={`w-8 h-8 text-${feature.color}`} />
              </div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Home;