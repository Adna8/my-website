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
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const sb = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      : null;

    // نتوقع إما base64 للصوت أو مسار URL للصوت
    const contentType = req.headers.get('content-type') || '';
    let payload: any = {};

    if (contentType.includes('application/json')) {
      payload = await req.json();
    } else {
      // دعم multipart/form-data بشكل مبسط
      const form = await req.formData();
      payload = {
        audioBase64: form.get('audioBase64')?.toString(),
        audioUrl: form.get('audioUrl')?.toString(),
        language: form.get('language')?.toString() || 'ar',
      };
    }

    const { audioBase64, audioUrl, language = 'ar' } = payload;
    if (!audioBase64 && !audioUrl) {
      return new Response(JSON.stringify({ error: 'Missing audio input (audioBase64 or audioUrl)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // هذه نسخة مبسطة: لا نضيف تعقيد باستخدام مزود طرف ثالث هنا.
    // سنعيد استجابة مبدئية قابلة للتطوير لاحقاً.
    const transcript = audioUrl
      ? `Audio received from URL: ${audioUrl}. Transcription stub.`
      : `Audio (base64) received. Transcription stub.`;

    // تسجيل مبسط
    try {
      if (sb) {
        await sb.from('voice_logs').insert({ audio_url: audioUrl ?? null, transcript, language });
      }
    } catch (e) {
      console.warn('Skipped logging voice request:', e);
    }

    return new Response(JSON.stringify({ transcript, language }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Voice-to-text error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});