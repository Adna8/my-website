import React, { createContext, useContext, useEffect, useState } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: string) => string;
}

const translations = {
  en: {
    // Navigation
    'nav.search': 'Search',
    'nav.assistant': 'Assistant',
    'nav.reference': 'Reference',
    'nav.login': 'Login',
    'nav.dashboard': 'Dashboard',
    'nav.admin': 'Admin',
    
    // Homepage
    'home.title': 'SMART SHELF',
    'home.subtitle': 'Find Your Book in Seconds',
    'home.search.placeholder': 'Search for a book...',
    'home.voice.title': 'Voice Search',
    'home.voice.desc': 'Find a book in 3 seconds',
    'home.assistant.title': 'AI Assistant',
    'home.assistant.desc': 'Get personalized recommendations',
    'home.shelf.title': 'Smart Shelf',
    'home.shelf.desc': 'Interactive shelf navigation',
    
    // Search
    'search.title': 'Search Books',
    'search.voice': 'Search by voice',
    'search.listening': 'Listening...',
    'search.processing': 'Processing...',
    'search.startListening': 'Start voice search',
    'search.stopListening': 'Stop voice search',
    'search.speakNow': 'Start speaking to search for a book',
    'search.notSupported': 'Not Supported',
    'search.browserNotSupported': 'Voice search is not supported in your browser. Please use Chrome, Edge, or Safari.',
    'search.searchingAutomatically': 'Searching automatically',
    
    // Results
    'results.title': 'Search Results',
    'results.details': 'Details',
    'results.notFound': 'No books found',
    
    // Book Details
    'book.author': 'Author',
    'book.category': 'Category',
    'book.location': 'Location',
    'book.viewMap': 'View on Map',
    
    // Chat
    'chat.title': 'AI Assistant',
    'chat.placeholder': 'Ask me anything...',
    'chat.send': 'Send',
    'chat.welcome': "Hello! I'm the Smart Shelf assistant. How can I help you today?",
    
    // Auth
    'auth.login': 'Login',
    'auth.register': 'Register',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.name': 'Full Name',
    'auth.submit': 'Submit',
    
    // Admin
    'admin.title': 'Admin Dashboard',
    'admin.addBook': 'Add Book',
    'admin.loans': 'Loans',
    'admin.analytics': 'Analytics',
    'admin.books': 'Books',
  },
  ar: {
    // Navigation
    'nav.search': 'بحث',
    'nav.assistant': 'المساعد',
    'nav.reference': 'المراجع',
    'nav.login': 'تسجيل الدخول',
    'nav.dashboard': 'لوحة التحكم',
    'nav.admin': 'الإدارة',
    
    // Homepage
    'home.title': 'الرف الذكي',
    'home.subtitle': 'اعثر على كتابك في ثوانٍ',
    'home.search.placeholder': 'ابحث عن كتاب...',
    'home.voice.title': 'البحث الصوتي',
    'home.voice.desc': 'اعثر على كتاب في 3 ثوانٍ',
    'home.assistant.title': 'المساعد الذكي',
    'home.assistant.desc': 'احصل على توصيات مخصصة',
    'home.shelf.title': 'الرف الذكي',
    'home.shelf.desc': 'التنقل التفاعلي بين الرفوف',
    
    // Search
    'search.title': 'البحث عن الكتب',
    'search.voice': 'ابحث بالصوت',
    'search.listening': 'جاري الاستماع...',
    'search.processing': 'جاري المعالجة...',
    'search.startListening': 'بدء البحث الصوتي',
    'search.stopListening': 'إيقاف البحث الصوتي',
    'search.speakNow': 'ابدأ التحدث للبحث عن كتاب',
    'search.notSupported': 'غير مدعوم',
    'search.browserNotSupported': 'البحث الصوتي غير مدعوم في متصفحك. يرجى استخدام Chrome أو Edge أو Safari.',
    'search.searchingAutomatically': 'جاري البحث تلقائياً',
    
    // Results
    'results.title': 'نتائج البحث',
    'results.details': 'التفاصيل',
    'results.notFound': 'لم يتم العثور على كتب',
    
    // Book Details
    'book.author': 'المؤلف',
    'book.category': 'الفئة',
    'book.location': 'الموقع',
    'book.viewMap': 'عرض على الخريطة',
    
    // Chat
    'chat.title': 'المساعد الذكي',
    'chat.placeholder': 'اسألني أي شيء...',
    'chat.send': 'إرسال',
    'chat.welcome': 'مرحباً! أنا المساعد الذكي لمنصة الرف. كيف يمكنني مساعدتك اليوم؟',
    
    // Auth
    'auth.login': 'تسجيل الدخول',
    'auth.register': 'إنشاء حساب',
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.name': 'الاسم الكامل',
    'auth.submit': 'إرسال',
    
    // Admin
    'admin.title': 'لوحة التحكم',
    'admin.addBook': 'إضافة كتاب',
    'admin.loans': 'الاستعارات',
    'admin.analytics': 'التحليلات',
    'admin.books': 'الكتب',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  const toggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  // Ensure document direction and language attribute reflect current language
  useEffect(() => {
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations.en] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}