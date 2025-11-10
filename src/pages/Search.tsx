import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Mic, Search as SearchIcon, StopCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const Search: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [autoSearchTimeout, setAutoSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const { toast } = useToast();
  const recognitionRef = useRef<any>(null);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/results?q=${encodeURIComponent(query)}`);
    }
  };

  useEffect(() => {
    // Check if browser supports Speech Recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      
      // تحديد اللغة بناءً على لغة المتصفح أو السماح بالتعرف على العربية والإنجليزية
      const userLang = navigator.language || 'ar-SA';
      recognition.lang = userLang.startsWith('ar') ? 'ar-SA' : 'en-US';

      recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        // تحديث النص المباشر للعرض الفوري
        setLiveTranscript(interimTranscript || finalTranscript);

        // تحديث حقل البحث بالنص النهائي
        if (finalTranscript) {
          setQuery(prev => {
            const newQuery = (prev + finalTranscript).trim();
            return newQuery;
          });
        }
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'not-allowed') {
          toast({
            title: "Microphone Access Denied",
            description: "Please allow microphone access to use voice search.",
            variant: "destructive",
          });
        } else if (event.error === 'no-speech') {
          toast({
            title: "No Speech Detected",
            description: "Please try speaking again.",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Error",
            description: "Voice recognition error. Please try again.",
            variant: "destructive",
          });
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        
        // إذا كان هناك نص، قم بالبحث التلقائي بعد ثانية واحدة من انتهاء التسجيل
        if (query.trim()) {
          // إلغاء أي مؤقت سابق
          if (autoSearchTimeout) {
            clearTimeout(autoSearchTimeout);
          }
          
          // تعيين مؤقت جديد للبحث التلقائي
          const timeout = setTimeout(() => {
            navigate(`/results?q=${encodeURIComponent(query)}`);
          }, 1000);
          
          setAutoSearchTimeout(timeout);
        }
        
        // مسح النص المباشر بعد انتهاء التسجيل
        setLiveTranscript('');
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      
      // تنظيف المؤقت عند إلغاء تحميل المكون
      if (autoSearchTimeout) {
        clearTimeout(autoSearchTimeout);
      }
    };
  }, [toast, query, navigate, autoSearchTimeout]);

  const handleVoiceSearch = () => {
    if (!recognitionRef.current) {
      toast({
        title: t('search.notSupported'),
        description: t('search.browserNotSupported'),
        variant: "destructive",
      });
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      
      // إذا كان هناك نص، قم بالبحث التلقائي فوراً عند الضغط على زر الإيقاف
      if (query.trim()) {
        navigate(`/results?q=${encodeURIComponent(query)}`);
      }
    } else {
      setQuery(''); // مسح النص السابق
      setLiveTranscript(''); // مسح النص المباشر
      
      // إلغاء أي مؤقت سابق
      if (autoSearchTimeout) {
        clearTimeout(autoSearchTimeout);
        setAutoSearchTimeout(null);
      }
      
      recognitionRef.current.start();
      setIsListening(true);
      toast({
        title: t('search.listening'),
        description: t('search.speakNow'),
      });
    }
  };

  return (
    <div className="min-h-screen pt-20 sm:pt-24 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto space-y-6 sm:space-y-8 animate-fade-in">
        <h1 className="text-3xl sm:text-4xl font-bold text-center">{t('search.title')}</h1>

        <form onSubmit={handleSearch} className="relative w-full">
          <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white rounded-xl sm:rounded-2xl border-2 border-primary/30 focus-within:border-secondary shadow-apple-lg transition-smooth">
            <SearchIcon className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground ml-2 sm:ml-4" />
            <Input
              type="text"
              placeholder={t('home.search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 border-0 focus-visible:ring-0 text-base sm:text-lg min-w-0"
            />
            <Button
              type="button"
              size="icon"
              onClick={handleVoiceSearch}
              aria-label={isListening ? t('search.stopListening') : t('search.startListening')}
              className={`transition-smooth min-w-[40px] h-10 sm:h-11 ${
                isListening
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {isListening ? (
                <StopCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              ) : (
                <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
            </Button>
          </div>
        </form>

        {isListening && (
          <div className="text-center space-y-3 sm:space-y-4 animate-scale-in">
            <div className="flex items-center justify-center space-x-2">
              <div className="w-2 h-2 sm:w-3 sm:h-3 bg-secondary rounded-full animate-pulse" />
              <div
                className="w-2 h-2 sm:w-3 sm:h-3 bg-secondary rounded-full animate-pulse"
                style={{ animationDelay: '0.2s' }}
              />
              <div
                className="w-2 h-2 sm:w-3 sm:h-3 bg-secondary rounded-full animate-pulse"
                style={{ animationDelay: '0.4s' }}
              />
            </div>
            <p className="text-base sm:text-lg text-secondary font-medium">
              {t('search.listening')}
            </p>
            
            {/* عرض النص المباشر أثناء التسجيل */}
            {liveTranscript && (
              <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-white/80 backdrop-blur-sm rounded-lg sm:rounded-xl border border-secondary/30 shadow-sm mx-2 sm:mx-0">
                <p className="text-base sm:text-lg font-medium text-primary-foreground break-words">{liveTranscript}</p>
              </div>
            )}
          </div>
        )}
        
        {/* عرض رسالة عند البحث التلقائي */}
        {autoSearchTimeout && (
          <div className="text-center animate-fade-in">
            <p className="text-xs sm:text-sm text-muted-foreground">{t('search.searchingAutomatically')}...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Search;