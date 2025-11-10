import React from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const LanguageToggle: React.FC = () => {
  const { language, toggleLanguage } = useLanguage();

  return (
    <Button
      onClick={toggleLanguage}
      variant="ghost"
      size="sm"
      className="font-semibold transition-smooth hover:bg-secondary/10"
    >
      {language === 'en' ? 'AR' : 'EN'}
    </Button>
  );
};

export default LanguageToggle;