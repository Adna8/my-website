import { GoogleGenAI } from "@google/genai";

// تم إعداد عميل GoogleGenAI باستخدام مفتاح API المزوَّد
export const ai = new GoogleGenAI({
  apiKey: "AIzaSyAWFCtpXMgU5ggiqhOVfSVAxs8LFs5izqA",
});

// دالة مساعدة بسيطة لتوليد نص باستخدام نموذج Gemini
export async function generateText(prompt: string): Promise<string> {
  const response: any = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  // بعض إصدارات الحزمة تُرجع text كـ خاصية أو كدالة
  const text = typeof response?.text === "function" ? response.text() : response?.text;
  if (typeof text === "string" && text.trim()) return text;
  try {
    return String(text ?? "");
  } catch {
    return "";
  }
}