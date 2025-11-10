import React, { useState } from 'react';
import logoFallback from '@/assets/smart-shelf-logo.jpg';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import { Search, MessageCircle, LogIn, Menu, X, Home, ArrowLeft, ArrowRight, Shield } from 'lucide-react';

const Navbar: React.FC = () => {
  const { t, language } = useLanguage();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  
  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  // توجيه إلى الصفحة الرئيسية من القائمة المنسدلة
  const handleHomeClick = () => {
    navigate('/home');
    setIsMenuOpen(false);
  };

  const isRTL = language === 'ar';
  const canGoBack = (typeof window !== 'undefined' && window.history && window.history.length > 1) && location.pathname !== '/';
  const handleBack = () => {
    if (!canGoBack) return;
    navigate(-1);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-secondary/95 backdrop-blur-md shadow-apple transition-smooth">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
          {/* مجموعة الشعار + زر الرجوع */}
          <div className={`flex items-center gap-2 ${isRTL ? 'pl-2' : 'pr-2'}`}>
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              aria-label={language === 'ar' ? 'رجوع' : 'Back'}
              className={`p-2 rounded-lg transition-smooth ${canGoBack ? 'text-white hover:bg-white/10' : 'text-white/40 cursor-not-allowed'}`}
            >
              {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>

            <Link to="/" className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-2 transition-fast hover:opacity-80`}>
              <div className="inline-flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden bg-white/5">
                <img
                  src={logoFallback}
                  alt="Smart Shelf Logo"
                  className="w-full h-full object-contain p-1"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (img.src !== logoFallback) img.src = logoFallback;
                  }}
                />
              </div>
              <span className="text-lg font-bold text-white">Smart Shelf</span>
            </Link>
          </div>

          {/* زر القائمة للأجهزة المحمولة */}
          <button
            onClick={toggleMenu}
            className="lg:hidden p-2 text-white hover:bg-white/10 rounded-lg transition-smooth"
            aria-label={isMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* القائمة الرئيسية - تظهر على الشاشات الكبيرة */}
          <div className={`hidden lg:flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-8`}>
            <Link
              to="/search"
              className={`flex items-center space-x-2 transition-fast ${
                isActive('/search')
                  ? 'text-white font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>{t('nav.search')}</span>
            </Link>

            <Link
              to="/chat"
              className={`flex items-center space-x-2 transition-fast ${
                isActive('/chat')
                  ? 'text-white font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span>{t('nav.assistant')}</span>
            </Link>

            {/* زر الإدارة لسطح المكتب */}
            <Link
              to="/admin"
              aria-label={t('nav.admin')}
              className={`flex items-center space-x-2 transition-fast ${
                isActive('/admin')
                  ? 'text-white font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>{t('nav.admin')}</span>
            </Link>

            <Link
              to="/auth"
              className={`flex items-center space-x-2 transition-fast ${
                isActive('/auth')
                  ? 'text-white font-semibold'
                  : 'text-white/70 hover:text-white'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>{t('nav.login')}</span>
            </Link>

            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>

        {/* القائمة المتجاوبة للأجهزة المحمولة */}
          <div
            className={`lg:hidden ${
              isMenuOpen ? 'block' : 'hidden'
            } pt-4 pb-3 border-t border-white/10 mt-4 space-y-3`}
          >
          {/* زر رجوع للجوال */}
          <button
            onClick={() => { handleBack(); setIsMenuOpen(false); }}
            disabled={!canGoBack}
            className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 p-2 rounded-lg transition-smooth ${
              canGoBack ? 'text-white/90 hover:bg-white/10 hover:text-white' : 'text-white/40 cursor-not-allowed'
            }`}
          >
            {isRTL ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            <span>{language === 'ar' ? 'رجوع' : 'Back'}</span>
          </button>

          <Link
            to="/home"
            className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 p-2 rounded-lg transition-smooth ${
              isActive('/home')
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            onClick={handleHomeClick}
          >
            <Home className="w-5 h-5" />
            <span>Home</span>
          </Link>

          <Link
            to="/chat"
            className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 p-2 rounded-lg transition-smooth ${
              isActive('/chat')
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => setIsMenuOpen(false)}
          >
            <MessageCircle className="w-5 h-5" />
            <span>{t('nav.assistant')}</span>
          </Link>

          {/* زر الإدارة للجوال */}
          <Link
            to="/admin"
            className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 p-2 rounded-lg transition-smooth ${
              isActive('/admin')
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Shield className="w-5 h-5" />
            <span>{t('nav.admin')}</span>
          </Link>

          <Link
            to="/auth"
            className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 p-2 rounded-lg transition-smooth ${
              isActive('/auth')
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => setIsMenuOpen(false)}
          >
            <LogIn className="w-5 h-5" />
            <span>{t('nav.login')}</span>
          </Link>

          <Link
            to="/search"
            className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-3 p-2 rounded-lg transition-smooth ${
              isActive('/search')
                ? 'bg-white/10 text-white font-semibold'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Search className="w-5 h-5" />
            <span>{t('nav.search')}</span>
          </Link>

          <div className={`flex items-center ${isRTL ? 'space-x-reverse' : ''} space-x-4 p-2 mt-2 border-t border-white/10 pt-4`}>
            <ThemeToggle />
            <LanguageToggle />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;