import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Send, Plus, Trash2, Search, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateText } from '@/lib/genai';
import { buildPlatformContext } from '@/lib/kb';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at?: string;
  updated_at?: string;
}

type StorageMode = 'local' | 'supabase';

const Chat: React.FC = () => {
const { t, language } = useLanguage();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'assistant', content: t('chat.welcome') },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [storageMode, setStorageMode] = useState<StorageMode>((import.meta.env.VITE_CHAT_STORAGE || 'local') === 'supabase' ? 'supabase' : 'local');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Typing effect state (one assistant message at a time)
  const segmenter = useMemo(() => {
    try {
      // Use grapheme segmentation for multi-language correctness
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const S: any = (Intl as any).Segmenter;
      if (S) return new S(undefined, { granularity: 'grapheme' });
    } catch {}
    return null;
  }, []);

  const segmentText = useCallback((text: string): string[] => {
    if (!text) return [];
    if (segmenter) {
      const out: string[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const seg of (segmenter as any).segment(text)) out.push(seg.segment);
      return out;
    }
    // Fallback: split by code unit (may split surrogate pairs but acceptable fallback)
    return Array.from(text);
  }, [segmenter]);

  const typingRef = useRef<{
    id: number | null;
    buffer: string;
    bufferG: string[];
    displayedG: string[];
    timer: number | null;
    speed: number; // ms per tick
  } | null>(null);

  const ensureTypingTimer = useCallback(() => {
    const ts = typingRef.current;
    if (!ts || ts.timer) return;
    ts.timer = window.setInterval(() => {
      const cur = typingRef.current;
      if (!cur || cur.id == null) return;
      const total = cur.bufferG.length;
      const shown = cur.displayedG.length;
      if (shown >= total) {
        // finalize
        window.clearInterval(cur.timer!);
        cur.timer = null;
        // commit final content without cursor
        const finalText = cur.buffer;
        setMessages(prev => prev.map(m => (
          m.id === cur.id ? { ...m, content: finalText } : m
        )));
        return;
      }
      // Dynamic step size to avoid excessive delay for long texts
      const remaining = total - shown;
      const step = remaining > 400 ? 4 : remaining > 200 ? 3 : remaining > 80 ? 2 : 1;
      const nextShown = Math.min(total, shown + step);
      cur.displayedG = cur.bufferG.slice(0, nextShown);
      const withCursor = cur.displayedG.join('') + ' |';
      setMessages(prev => prev.map(m => (
        m.id === cur.id ? { ...m, content: withCursor } : m
      )));
    }, typingRef.current!.speed || 50);
  }, [setMessages]);

  const skipTyping = useCallback(() => {
    const ts = typingRef.current;
    if (!ts || ts.id == null) return;
    if (ts.timer) {
      window.clearInterval(ts.timer);
      ts.timer = null;
    }
    ts.displayedG = ts.bufferG.slice();
    setMessages(prev => prev.map(m => (
      m.id === ts.id ? { ...m, content: ts.buffer } : m
    )));
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update the initial assistant welcome message when language changes
  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 1 && prev[0].role === 'assistant') {
        return [{ ...prev[0], content: t('chat.welcome') }];
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Helper for local storage
  const LS_KEY = 'smart-shelf:chats';
  const loadLocalConversations = () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [] as Conversation[];
      const parsed = JSON.parse(raw) as Conversation[];
      return Array.isArray(parsed) ? parsed : [];
    } catch { return [] as Conversation[]; }
  };
  const saveLocalConversations = (items: Conversation[]) => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(items)); } catch { /* ignore */ }
  };

  // Load conversations on mount based on storageMode
  useEffect(() => {
    const init = async () => {
      if (storageMode === 'supabase') {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes?.user?.id || null;
        if (!userId) {
          setConversations([]);
          return;
        }
        const { data, error } = await supabase.from('conversations').select('id,title,created_at,updated_at').order('updated_at', { ascending: false }).limit(100);
        if (error) {
          console.warn('Failed to load conversations:', error.message);
          setConversations([]);
        } else {
          const items: Conversation[] = (data || []).map((c: any) => ({ id: c.id, title: c.title || t('chat.title'), messages: [], created_at: c.created_at, updated_at: c.updated_at }));
          setConversations(items);
        }
      } else {
        const items = loadLocalConversations();
        setConversations(items);
        if (items.length > 0 && !conversationId) {
          setConversationId(items[0].id);
          setMessages(items[0].messages.length ? items[0].messages : messages);
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageMode]);

  // Auto-save current conversation locally
  useEffect(() => {
    if (storageMode !== 'local') return;
    if (!conversationId) return;
    setConversations((prev) => {
      const title = prev.find(c => c.id === conversationId)?.title || (messages.find(m => m.role === 'user')?.content?.slice(0, 60) || (t('chat.title') || 'New Chat'));
      const next = prev.map(c => c.id === conversationId ? { ...c, title, messages } : c);
      saveLocalConversations(next);
      return next;
    });
  }, [messages, conversationId, storageMode, t]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now(),
      role: 'user',
      content: input,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsTyping(true);

    try {
      // Create conversation if not exists (for logged-in users)
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id || null;
      if (userId && !conversationId && storageMode === 'supabase') {
        const { data: conv, error: convErr } = await supabase
          .from('conversations')
          .insert({ user_id: userId, title: input.slice(0, 60) })
          .select('id')
          .single();
        if (!convErr && conv?.id) setConversationId(conv.id as string);
      }
      if (!userId && !conversationId && storageMode === 'local') {
        const newId = crypto.randomUUID();
        setConversationId(newId);
        const newConv: Conversation = { id: newId, title: input.slice(0, 60) || (t('chat.title') || 'New Chat'), messages: updatedMessages };
        setConversations((prev) => {
          const next = [newConv, ...prev];
          saveLocalConversations(next);
          return next;
        });
      }

      // Persist the user message if possible
      if (userId && conversationId && storageMode === 'supabase') {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'user',
          content: input,
        });
      }
      const CHAT_URL = import.meta.env.DEV
        ? '/functions/v1/chat'
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

      // Inject platform knowledge as a system message to ground the model
      const systemContext = buildPlatformContext(input, language);
      const payload = {
        messages: [
          { role: 'system', content: systemContext },
          ...updatedMessages
            .filter(m => m.role !== 'assistant' || m.content.trim())
            .map(m => ({ role: m.role, content: m.content })),
        ]
      };

      const streamSSE = async (response: Response) => {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let assistantMessage = '';
        let assistantMessageId: number | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantMessage += content;
                  if (assistantMessageId === null) {
                    assistantMessageId = Date.now();
                    // Initialize typing state and add empty assistant message
                    typingRef.current = {
                      id: assistantMessageId,
                      buffer: assistantMessage,
                      bufferG: segmentText(assistantMessage),
                      displayedG: [],
                      timer: null,
                      speed: 50,
                    };
                    setMessages(prev => [...prev, { id: assistantMessageId!, role: 'assistant', content: '' }]);
                    ensureTypingTimer();
                  } else {
                    // Update buffer and keep typing forward
                    if (typingRef.current && typingRef.current.id === assistantMessageId) {
                      typingRef.current.buffer = assistantMessage;
                      typingRef.current.bufferG = segmentText(assistantMessage);
                      ensureTypingTimer();
                    } else {
                      // Fallback: direct update
                      setMessages(prev => prev.map(m => (
                        m.id === assistantMessageId ? { ...m, content: assistantMessage } : m
                      )));
                    }
                  }
                }
              } catch {
                // Skip invalid JSON lines
              }
            }
          }
        }

        // Finalize typing state when stream ends
        if (typingRef.current && typingRef.current.id === assistantMessageId) {
          typingRef.current.buffer = assistantMessage;
          typingRef.current.bufferG = segmentText(assistantMessage);
          // Let the timer flush remaining; if no timer, commit final content
          if (!typingRef.current.timer) {
            setMessages(prev => prev.map(m => (
              m.id === assistantMessageId ? { ...m, content: assistantMessage } : m
            )));
          }
        }
        return assistantMessage;
      };

      // أولاً نحاول عبر دالة Supabase
      let assistantMessage = '';
      try {
        const response = await fetch(CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok || !response.body) {
          throw new Error('Supabase function failed');
        }

        assistantMessage = await streamSSE(response);
        // إذا كانت الاستجابة المتدفقة فارغة، اعتبرها فشلًا لتفعيل المسار الاحتياطي
        if (!assistantMessage || !assistantMessage.trim()) {
          throw new Error('Supabase function returned empty stream');
        }
      } catch (supabaseError) {
        console.warn('Supabase chat failed, falling back to OpenRouter...', supabaseError);
        // مسار احتياطي: الاستدعاء مباشرة لـ OpenRouter، ثم Google GenAI إن فشل
        try {
          const OR_KEY = import.meta.env.VITE_ASSISTANT_CLIENT_KEY;
          if (!OR_KEY) throw new Error('Missing assistant client key for fallback');

          const orResp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${OR_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': window.location.origin,
              'X-Title': 'Smart Shelf',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.0-flash-exp:free',
              ...payload,
              stream: true,
            }),
          });

          if (!orResp.ok || !orResp.body) {
            const errorText = await orResp.text().catch(() => '');
            throw new Error(`OpenRouter fallback failed: ${errorText || orResp.statusText}`);
          }

          assistantMessage = await streamSSE(orResp);
        } catch (orError) {
          console.warn('OpenRouter fallback failed, trying Google GenAI...', orError);
          const prompt = updatedMessages.map(m => `${m.role}: ${m.content}`).join('\n');
          const text = await generateText(prompt);
          assistantMessage = text || '';
          // عرض تدريجي للرسالة النهائية إذا لم تكن متدفقة
          const assistantId = Date.now();
          typingRef.current = {
            id: assistantId,
            buffer: assistantMessage,
            bufferG: segmentText(assistantMessage),
            displayedG: [],
            timer: null,
            speed: 50,
          };
          setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);
          ensureTypingTimer();
        }
      }

      // After streaming completes, persist assistant message if possible
      setIsTyping(false);
      if (userId && conversationId && assistantMessage && storageMode === 'supabase') {
        await supabase.from('messages').insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'assistant',
          content: assistantMessage,
        });
      }
      if (!userId && conversationId && assistantMessage && storageMode === 'local') {
        setConversations((prev) => {
          const next = prev.map(c => c.id === conversationId ? { ...c, messages: [...messages, { id: Date.now(), role: 'assistant', content: assistantMessage }] } : c);
          saveLocalConversations(next);
          return next;
        });
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get AI response. Please try again.',
        variant: 'destructive',
      });
      setIsTyping(false);
    }
  };

  // Sidebar actions
  const startNewChat = async () => {
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes?.user?.id || null;
    const defaultTitle = t('chat.title') || (language === 'ar' ? 'محادثة جديدة' : 'New Chat');
    setMessages([{ id: Date.now(), role: 'assistant', content: t('chat.welcome') }]);
    setInput('');
    setIsTyping(false);
    if (storageMode === 'supabase' && userId) {
      const { data: conv, error } = await supabase.from('conversations').insert({ user_id: userId, title: defaultTitle }).select('id,title,created_at,updated_at').single();
      if (!error && conv?.id) {
        setConversationId(conv.id as string);
        setConversations((prev) => [{ id: conv.id as string, title: conv.title || defaultTitle, messages: [], created_at: conv.created_at, updated_at: conv.updated_at }, ...prev]);
      }
    } else {
      const newId = crypto.randomUUID();
      setConversationId(newId);
      const newConv: Conversation = { id: newId, title: defaultTitle, messages: [{ id: Date.now(), role: 'assistant', content: t('chat.welcome') }] };
      setConversations((prev) => {
        const next = [newConv, ...prev];
        saveLocalConversations(next);
        return next;
      });
    }
  };

  const selectConversation = async (id: string) => {
    setConversationId(id);
    if (storageMode === 'supabase') {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id || null;
      if (!userId) return;
      const { data, error } = await supabase.from('messages').select('id,role,content').eq('conversation_id', id).order('id', { ascending: true });
      if (!error) {
        const msgs: Message[] = (data || []).map((m: any) => ({ id: m.id, role: m.role, content: m.content }));
        setMessages(msgs.length ? msgs : [{ id: Date.now(), role: 'assistant', content: t('chat.welcome') }]);
      }
    } else {
      const conv = conversations.find(c => c.id === id);
      setMessages(conv?.messages?.length ? conv.messages : [{ id: Date.now(), role: 'assistant', content: t('chat.welcome') }]);
    }
  };

  const deleteConversation = async (id: string) => {
    if (storageMode === 'supabase') {
      try {
        await supabase.from('messages').delete().eq('conversation_id', id);
        await supabase.from('conversations').delete().eq('id', id);
      } catch (e) { console.warn('Failed to delete conversation:', e); }
    } else {
      const next = conversations.filter(c => c.id !== id);
      saveLocalConversations(next);
      setConversations(next);
    }
    if (conversationId === id) {
      setConversationId(null);
      setMessages([{ id: Date.now(), role: 'assistant', content: t('chat.welcome') }]);
    }
  };

  const deleteAllConversations = async () => {
    if (storageMode === 'supabase') {
      try {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes?.user?.id || null;
        if (!userId) return;
        // Assuming RLS allows deletion by user
        await supabase.rpc('delete_all_conversations_for_user', { uid: userId }).catch(async () => {
          // Fallback: brute-force delete
          const { data } = await supabase.from('conversations').select('id').eq('user_id', userId);
          for (const c of (data || [])) {
            await supabase.from('messages').delete().eq('conversation_id', c.id);
            await supabase.from('conversations').delete().eq('id', c.id);
          }
        });
      } catch (e) { console.warn('Failed to delete all conv:', e); }
    } else {
      saveLocalConversations([]);
      setConversations([]);
    }
    setConversationId(null);
    setMessages([{ id: Date.now(), role: 'assistant', content: t('chat.welcome') }]);
  };

  return (
    <div className="min-h-screen pt-24 px-6 pb-12">
      <div className="max-w-6xl mx-auto h-[calc(100vh-12rem)] flex flex-col animate-fade-in">
        <h1 className="text-4xl font-bold mb-6">{t('chat.title')}</h1>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4">
          {/* Sidebar */}
          <aside className="bg-white rounded-3xl shadow-apple-lg p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <Button className="w-full bg-secondary hover:bg-secondary/90 rounded-2xl" onClick={startNewChat}>
                <Plus className="w-4 h-4 mr-2" /> { (t('chat.new') || (language === 'ar' ? 'دردشة جديدة' : 'New Chat')) }
              </Button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={language === 'ar' ? 'بحث في المحادثات' : 'Search conversations'} className="rounded-2xl" />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2">
              {conversations.filter(c => {
                const q = searchQuery.trim().toLowerCase();
                if (!q) return true;
                return (c.title || '').toLowerCase().includes(q) || (c.messages?.[0]?.content || '').toLowerCase().includes(q);
              }).map(c => (
                <div key={c.id} className={`group flex items-center justify-between p-3 rounded-2xl border ${c.id === conversationId ? 'border-primary bg-primary/5' : 'border-muted'} hover:border-primary transition-smooth`}>
                  <button className="flex items-center gap-2 text-left flex-1" onClick={() => selectConversation(c.id)}>
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm line-clamp-1">{c.title || (c.messages?.[0]?.content?.slice(0, 60) || (language === 'ar' ? 'محادثة' : 'Conversation'))}</span>
                  </button>
                  <button className="opacity-0 group-hover:opacity-100 transition" onClick={() => deleteConversation(c.id)} aria-label={language === 'ar' ? 'حذف' : 'Delete'}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
              {conversations.length === 0 && (
                <div className="text-sm text-muted-foreground">{language === 'ar' ? 'لا توجد محادثات' : 'No conversations yet'}</div>
              )}
            </div>
            <div className="pt-3">
              <Button variant="destructive" className="w-full rounded-2xl" onClick={deleteAllConversations}>
                <Trash2 className="w-4 h-4 mr-2" /> {language === 'ar' ? 'حذف جميع المحادثات' : 'Delete all conversations'}
              </Button>
            </div>
          </aside>

          {/* Main chat area */}
          <div
            className="bg-white rounded-3xl shadow-apple-lg p-6 overflow-y-auto space-y-4 mb-0"
            onClick={skipTyping}
          >
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              } animate-slide-up`}
            >
              <div
                className={`max-w-[70%] p-4 rounded-2xl ${
                  message.role === 'user'
                    ? 'bg-primary text-white'
                    : 'bg-muted text-foreground'
                }`}
              >
                <p className="text-base whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex justify-start animate-slide-up">
              <div className="bg-muted p-4 rounded-2xl">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  <div
                    className="w-2 h-2 bg-primary rounded-full animate-pulse"
                    style={{ animationDelay: '0.2s' }}
                  />
                  <div
                    className="w-2 h-2 bg-primary rounded-full animate-pulse"
                    style={{ animationDelay: '0.4s' }}
                  />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
          </div>
          </div>

        <form onSubmit={handleSend} className="flex gap-3 mt-4">
          <Input
            type="text"
            placeholder={t('chat.placeholder')}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 h-14 px-6 text-base rounded-2xl border-2 border-muted focus-visible:border-secondary transition-smooth"
          />
          <Button
            type="submit"
            size="lg"
            className="h-14 px-8 bg-secondary hover:bg-secondary/90 transition-smooth rounded-2xl"
          >
            <Send className="w-5 h-5 mr-2" />
            {t('chat.send')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default Chat;