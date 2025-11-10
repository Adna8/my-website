import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, conversation_id, user_id, language } = await req.json();
    // استخدم مفتاح OpenRouter من أسرار الوظيفة
    const OPENROUTER_API_KEY = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENAI_API_KEY');
    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    // عميل Supabase اختياري للتسجيل البسيط (بدون تعقيد)
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const sb = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    const oaiMessages = [
      { role: 'system', content: 'You are a helpful Smart Shelf assistant.' },
      ...Array.isArray(messages) ? messages.map((m: { role: string; content: string }) => ({ role: m.role, content: m.content })) : []
    ];

    // تسجيل الطلب بشكل خفيف لمنع فقدان السياق (اختياري)
    try {
      if (sb) {
        await sb.from('chat_logs').insert({
          conversation_id,
          user_id,
          language,
          request: { messages: oaiMessages },
        });
      }
    } catch (e) {
      console.warn('Skipped logging chat request:', e);
    }

    // استدعاء واجهة OpenRouter المتوافقة مع OpenAI
    const oaiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // رؤوس اختيارية لتحسين التصنيف لدى OpenRouter
        'HTTP-Referer': Deno.env.get('OPENROUTER_REFERER') ?? req.headers.get('origin') ?? '',
        'X-Title': Deno.env.get('OPENROUTER_TITLE') ?? 'Smart Shelf',
      },
      body: JSON.stringify({
        // النموذج المطلوب من المستخدم
        model: 'google/gemini-2.0-flash-exp:free',
        messages: oaiMessages,
        stream: true,
      }),
    });

    if (!oaiResponse.ok || !oaiResponse.body) {
      const errorText = await oaiResponse.text();
      throw new Error(`OpenRouter API error: ${errorText}`);
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = oaiResponse.body!.getReader();
        let hasAnyContent = false;
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          if (value && value.length) hasAnyContent = true;
        }
        controller.close();

        // إذا لم يصل أي محتوى فعلياً، نعيد خطأ لتفعيل المسار الاحتياطي على الواجهة
        if (!hasAnyContent) {
          throw new Error('Empty response stream');
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
