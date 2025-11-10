// Lightweight knowledge base for Smart Shelf and a helper to build a context string
// The assistant will inject this as a system message to ground answers.

export type KBSection = {
  id: string;
  tags: string[]; // simple keyword tags for retrieval
  ar: string;
  en: string;
};

// Curated platform knowledge (concise to keep prompt small)
const KB: KBSection[] = [
  {
    id: "overview",
    tags: ["smart shelf", "الرف الذكي", "المنصة", "overview"],
    ar: "الرف الذكي (Smart Shelf) منصة حديثة لإدارة المكتبات مبنية بـ React + Vite. تهدف إلى تسريع العثور على الكتب وتقديم مساعد ذكي يعتمد على الذكاء الاصطناعي مع دعم العربية والإنجليزية.",
    en: "Smart Shelf is a modern library assistant built with React + Vite. It helps users quickly find books and provides an AI assistant with Arabic and English support.",
  },
  {
    id: "features",
    tags: ["features", "مميزات", "خصائص"],
    ar: "المميزات: بحث مدعوم بالذكاء الاصطناعي، بحث صوتي (عربي/إنجليزي)، خريطة رف تفاعلية لتحديد الموقع، مصادقة المستخدم، ودردشة مع حفظ المحادثات عبر Supabase.",
    en: "Features: AI-powered search, voice search (Arabic/English), interactive shelf map, user authentication, and chat with persistence via Supabase.",
  },
  {
    id: "pages",
    tags: ["pages", "صفحات", "navigation", "التنقل"],
    ar: "أهم الصفحات: الصفحة الرئيسية، البحث، النتائج، تفاصيل الكتاب، خريطة الرف، المساعد الذكي، والإدارة.",
    en: "Key pages: Home, Search, Results, Book Details, Shelf Map, AI Assistant, and Admin.",
  },
  {
    id: "search",
    tags: ["search", "البحث", "voice", "الصوت"],
    ar: "البحث: يدعم نصاً وصوتاً مع رسائل واجهة مترجمة. البحث الصوتي يوفّر تجربة سريعة، مع رسائل مثل 'جاري الاستماع' و'جاري المعالجة'.",
    en: "Search: Supports text and voice with localized UI messages. Voice search provides a fast experience with cues like 'Listening' and 'Processing'.",
  },
  {
    id: "shelf",
    tags: ["shelf", "خريطة الرف", "الموقع"],
    ar: "خريطة الرف: واجهة تفاعلية لعرض مواقع الكتب، والانتقال على الرفوف باستخدام مخطط مرئي.",
    en: "Shelf Map: An interactive UI to visualize book locations and navigate shelves with a visual map.",
  },
  {
    id: "chat",
    tags: ["chat", "الدردشة", "assistant", "المساعد"],
    ar: "الدردشة: ترسل الرسائل إلى دالة حافة في Supabase وتعرض الردود بشكل متدرّج مع مؤشّر كتابة. يمكن التخطي بالنقر والحفاظ على تنسيق النص.",
    en: "Chat: Sends messages to a Supabase edge function and renders replies gradually with a typing indicator. Skipping is supported by click while preserving formatting.",
  },
  {
    id: "tech",
    tags: ["tech", "التقنيات", "stack"],
    ar: "التقنيات: Vite، TypeScript، React، shadcn-ui، Tailwind CSS، و Supabase.",
    en: "Tech stack: Vite, TypeScript, React, shadcn-ui, Tailwind CSS, and Supabase.",
  },
  {
    id: "admin",
    tags: ["admin", "الإدارة"],
    ar: "الإدارة: لوحة تحكم لإضافة الكتب ومتابعة الإعارات والتحليلات (وفق الإعدادات).",
    en: "Admin: Dashboard to add books and track loans and analytics (as configured).",
  },
];

function detectLanguage(query: string): 'ar' | 'en' {
  // Simple heuristic: presence of Arabic letters
  const hasArabic = /[\u0600-\u06FF]/.test(query);
  return hasArabic ? 'ar' : 'en';
}

export function buildPlatformContext(query: string, preferred?: 'ar' | 'en'): string {
  const lang = preferred || detectLanguage(query);
  const q = (query || '').toLowerCase();
  // Match sections whose tags appear in the query; otherwise include overview + features + pages
  const matched = KB.filter(s => s.tags.some(tag => q.includes(tag.toLowerCase())));
  const base = matched.length ? matched : KB.filter(s => ['overview', 'features', 'pages'].includes(s.id));
  const lines = base.map(s => (lang === 'ar' ? s.ar : s.en));

  const directive = lang === 'ar'
    ? "أنت خبير بمنصة الرف الذكي. استخدم المعرفة التالية للإجابة بدقة وثقة. اجعل الإجابة منظمة وقابلة للقراءة (نقاط/أسطر جديدة)، وبنفس لغة المستخدم. إذا سُئلت عن تفاصيل المنصة، اشرح كل جزء باختصار واضح."
    : "You are an expert on Smart Shelf. Use the following knowledge to answer accurately and confidently. Structure the answer (bullets/newlines) and reply in the user’s language. When asked about the platform, explain each part clearly.";

  return `${directive}\n\nKnowledge:\n- ${lines.join('\n- ')}`;
}