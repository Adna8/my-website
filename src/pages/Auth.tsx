import React, { useState } from 'react';
import logoFallback from '@/assets/smart-shelf-logo.jpg';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const Auth: React.FC = () => {
  const { t } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'خطأ', description: 'البريد الإلكتروني مطلوب', variant: 'destructive' });
      return;
    }
    if (!password.trim()) {
      toast({ title: 'خطأ', description: 'كلمة المرور مطلوبة', variant: 'destructive' });
      return;
    }
    if (!isLogin && !fullName.trim()) {
      toast({ title: 'خطأ', description: 'الاسم الكامل مطلوب', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast({ title: t('auth.login'), description: 'تم تسجيل الدخول بنجاح' });
        navigate('/home');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + '/auth',
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast({ title: t('auth.register'), description: 'تم إرسال رسالة التفعيل إلى بريدك الإلكتروني' });
      }
    } catch (err: any) {
      toast({ title: 'خطأ', description: err.message ?? 'تعذر إتمام العملية', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pt-24 px-6 pb-12 flex items-center justify-center relative overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 animate-pulse" />
      
      {/* Floating orbs for visual interest */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }} />
      
      <div className="w-full max-w-md animate-scale-in relative z-10">
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center justify-center w-24 h-24 mb-6 rounded-2xl overflow-hidden glass-card shadow-glow-primary animate-glow ring-1 ring-white/10 bg-gradient-to-br from-primary/15 via-secondary/15 to-background">
            <img
              src={logoFallback}
              alt="Smart Shelf Logo"
              className="w-full h-full object-contain p-2"
              onError={(e) => {
                const img = e.currentTarget as HTMLImageElement;
                if (img.src !== logoFallback) img.src = logoFallback;
              }}
            />
          </div>
          <h1 className="text-4xl font-bold text-gradient-hero mb-2">{t('home.title')}</h1>
          <p className="text-muted-foreground">Welcome back to your digital library</p>
        </div>

        <div className="glass-card rounded-3xl p-8 space-y-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex gap-2 p-1 bg-muted rounded-xl">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 rounded-lg font-semibold transition-smooth ${
                isLogin
                  ? 'bg-primary text-white shadow-apple'
                  : 'text-muted-foreground'
              }`}
            >
              {t('auth.login')}
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 rounded-lg font-semibold transition-smooth ${
                !isLogin
                  ? 'bg-primary text-white shadow-apple'
                  : 'text-muted-foreground'
              }`}
            >
              {t('auth.register')}
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="space-y-2">
                <Label>{t('auth.name')}</Label>
                <Input
                  type="text"
                  placeholder={t('auth.name')}
                  className="h-12 border-2 focus-visible:border-primary transition-smooth"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>{t('auth.email')}</Label>
              <Input
                type="email"
                placeholder={t('auth.email')}
                className="h-12 border-2 focus-visible:border-primary transition-smooth"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('auth.password')}</Label>
              <Input
                type="password"
                placeholder={t('auth.password')}
                className="h-12 border-2 focus-visible:border-primary transition-smooth"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button
              type="submit"
              size="lg"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:opacity-90 transition-smooth shadow-glow-primary hover:shadow-glow-secondary transform hover:scale-105"
              disabled={loading}
            >
              {loading ? '...' : t('auth.submit')}
            </Button>
            
            <p className="text-center text-sm text-muted-foreground">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline font-semibold"
              >
                {isLogin ? "Sign up" : "Sign in"}
              </button>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Auth;