import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Allow toggling local dev chat handler. By default, rely on Supabase proxy.
  const USE_LOCAL_CHAT = env.USE_LOCAL_CHAT === "true";
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/functions/": {
          target: "https://ppixvdwwqesijssftvml.supabase.co",
          changeOrigin: true,
          secure: true,
        },
      },
    },
    plugins: [
      react(),
      {
        name: "openrouter-chat-dev",
        enforce: "pre",
        configureServer(server) {
          // إضافة middleware لمعالجة طلبات voice-to-text
          server.middlewares.use("/functions/v1/voice-to-text", async (req, res, next) => {
            if (req.method === "OPTIONS") {
              res.writeHead(204, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Max-Age": "86400",
              });
              res.end();
              return;
            }

            if (req.method !== "POST") return next();

            function getBody(req: any): Promise<any> {
              return new Promise((resolve, reject) => {
                let data = "";
                req.on("data", (chunk: any) => (data += chunk));
                req.on("end", () => {
                  try {
                    resolve(JSON.parse(data || "{}"));
                  } catch (e) {
                    reject(e);
                  }
                });
                req.on("error", reject);
              });
            }

            try {
              const body = await getBody(req);
              
              // معالجة محلية للصوت - إرجاع نص افتراضي
              res.writeHead(200, { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
              });
              
              // إرجاع نص افتراضي للتطوير المحلي
              res.end(JSON.stringify({ 
                text: "تم تحويل الصوت إلى نص بنجاح في بيئة التطوير المحلية" 
              }));
              
            } catch (err: any) {
              console.error("[voice-to-text-dev] Handler exception:", err);
              res.writeHead(500, { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
              });
              res.end(JSON.stringify({ error: err?.message || "Unknown error" }));
            }
          });

          // Register local chat handler only when explicitly enabled.
          if (!USE_LOCAL_CHAT) {
            // Skip local handler; let Vite proxy forward to Supabase edge function
            return;
          }
          server.middlewares.use("/functions/v1/chat", async (req, res, next) => {
            if (req.method === "OPTIONS") {
              res.writeHead(204, {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Max-Age": "86400",
              });
              res.end();
              return;
            }

            if (req.method !== "POST") return next();

            function getBody(req: any): Promise<any> {
              return new Promise((resolve, reject) => {
                let data = "";
                req.on("data", (chunk: any) => (data += chunk));
                req.on("end", () => {
                  try {
                    resolve(JSON.parse(data || "{}"));
                  } catch (e) {
                    reject(e);
                  }
                });
                req.on("error", reject);
              });
            }

            try {
              const body = await getBody(req);
              const incoming = Array.isArray(body?.messages) ? body.messages : [];
              const messages = incoming.slice(-6);
              console.log("[chat-dev] Incoming messages:", { count: messages.length, roles: messages.map((m: any) => m.role) });

              const COHERE_API_KEY = process.env.COHERE_API_KEY || "";
              const COHERE_MODEL = process.env.COHERE_MODEL || "c4";
              const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "";
              const REFERER = process.env.OPENROUTER_REFERER || "http://localhost:8080";
              const TITLE = process.env.OPENROUTER_TITLE || "Smart Shelf";
              const useCohere = !!COHERE_API_KEY;
              const useOffline = !OPENROUTER_API_KEY && !COHERE_API_KEY;
              if (useOffline) {
                console.warn("No provider key found. Using offline dev fallback stream.");
              }

              async function callModel(model: string) {
                const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": REFERER,
                    "X-Title": TITLE,
                  },
                  body: JSON.stringify({ model, messages, stream: true }),
                });
                console.log("[chat-dev] OpenRouter status:", resp.status, resp.statusText, "model:", model);
                return resp;
              }

              if (useCohere) {
                // Stream through Cohere and transform into OpenAI-style SSE
                try {
                  const lastAssistant = messages.findLast?.((m: any) => m.role === "assistant") || messages.slice().reverse().find((m: any) => m.role === "assistant");
                  const lastUser = messages.findLast?.((m: any) => m.role === "user") || messages.slice().reverse().find((m: any) => m.role === "user");
                  const messageText = (lastUser?.content || messages[messages.length - 1]?.content || "").toString();
                  const chat_history = messages
                    .filter((m: any) => m !== lastUser)
                    .map((m: any) => ({ role: m.role === "assistant" ? "CHATBOT" : "USER", text: (m.content || "").toString() }));

                  console.log("[chat-dev] Using Cohere streaming...");
                  const cohereResp = await fetch("https://api.cohere.ai/v1/chat", {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${COHERE_API_KEY}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ model: COHERE_MODEL, stream: true, message: messageText, chat_history }),
                  });
                  console.log("[chat-dev] Cohere status:", cohereResp.status, cohereResp.statusText);

                  if (!cohereResp.ok || !cohereResp.body) {
                    const errorText = await cohereResp.text();
                    console.error("[chat-dev] Cohere error:", errorText);
                    // Fall back to offline summary for developer UX
                    const base = messageText;
                    let tone = "friendly";
                    let intent = "assist_user";
                    if (/تحليل|حلّل|analy/i.test(base)) intent = "analyze_text";
                    if (/json/i.test(base)) intent = "return_json";
                    const isArabic = /[\u0600-\u06FF]/.test(base) || /عربي|العربية/i.test(base);
                    if (isArabic) tone = "supportive-arabic";
                    const summary = base
                      ? (isArabic ? "ملخص مختصر: الرسالة تطلب مساعدة وفهم الغرض." : "Brief summary: The message seeks help and clarifies intent.")
                      : (isArabic ? "تحية عامة: كيف أستطيع مساعدتك اليوم؟" : "General greeting: How can I help you today?");

                    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
                    const json = JSON.stringify({ choices: [{ delta: { content: summary } }] });
                    res.write(`data: ${json}\n\n`);
                    res.write("data: [DONE]\n\n");
                    res.end();
                    return;
                  }

                  res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", "Access-Control-Allow-Origin": "*" });
                  const reader = cohereResp.body.getReader();
                  const decoder = new TextDecoder();
                  let buffer = "";
                  let parseMode: "auto" | "sse" | "ndjson" = "auto";
                  const emitDelta = (content: string) => {
                    if (!content) return;
                    const json = JSON.stringify({ choices: [{ delta: { content } }] });
                    res.write(`data: ${json}\n\n`);
                  };

                  type ExtractResult = { text: string; kind: "token" | "full" | "unknown" };
                  const extractParts = (obj: any): ExtractResult => {
                    try {
                      if (!obj || typeof obj !== "object") return { text: "", kind: "unknown" };
                      // Token-like pieces
                      if (typeof obj.text === "string") return { text: obj.text, kind: "token" };
                      if (typeof obj.token === "string") return { text: obj.token, kind: "token" };
                      if (obj.delta) {
                        if (typeof obj.delta === "string") return { text: obj.delta, kind: "token" };
                        if (typeof obj.delta?.text === "string") return { text: obj.delta.text, kind: "token" };
                        if (Array.isArray(obj.delta?.content)) {
                          const parts = obj.delta.content
                            .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
                            .filter(Boolean);
                          if (parts.length) return { text: parts.join(""), kind: "token" };
                        }
                      }
                      // Full response fallbacks (often at stream end)
                      if (obj.response && typeof obj.response?.text === "string") return { text: obj.response.text, kind: "full" };
                      if (obj.message?.content && Array.isArray(obj.message.content)) {
                        const parts = obj.message.content
                          .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
                          .filter(Boolean);
                        if (parts.length) return { text: parts.join(""), kind: "full" };
                      }
                      if (Array.isArray(obj.content)) {
                        const parts = obj.content
                          .map((p: any) => (typeof p?.text === "string" ? p.text : ""))
                          .filter(Boolean);
                        if (parts.length) return { text: parts.join(""), kind: "full" };
                      }
                      return { text: "", kind: "unknown" };
                    } catch { return { text: "", kind: "unknown" }; }
                  };

                  // Track streaming state to avoid duplicate content when a final full payload arrives
                  let seenTokens = false;
                  let aggregated = "";
                  const longestCommonPrefix = (a: string, b: string) => {
                    const n = Math.min(a.length, b.length);
                    let i = 0;
                    while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
                    return i;
                  };
                  const processParsedObject = (obj: any) => {
                    const { text, kind } = extractParts(obj);
                    if (!text) return;
                    if (kind === "token") {
                      seenTokens = true;
                      aggregated += text;
                      emitDelta(text);
                      return;
                    }
                    // kind === 'full' or 'unknown'
                    if (!seenTokens) {
                      aggregated = text;
                      emitDelta(text);
                      return;
                    }
                    // We have already streamed tokens; emit only the new suffix
                    if (text.startsWith(aggregated)) {
                      const delta = text.slice(aggregated.length);
                      aggregated = text;
                      if (delta) emitDelta(delta);
                      return;
                    }
                    // Fallback: compute LCP and emit remainder
                    const lcp = longestCommonPrefix(aggregated, text);
                    const delta = text.slice(lcp);
                    aggregated = text;
                    if (delta) emitDelta(delta);
                  };

                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value || new Uint8Array(), { stream: true });

                    // Decide parse mode on first meaningful data
                    if (parseMode === "auto") {
                      const probe = buffer;
                      if (/^data:\s*\{/.test(probe) || /\nevent:\s*\w+/.test(probe) || /\ndata:\s*\{/.test(probe)) {
                        parseMode = "sse";
                      } else if (/^\s*\{/.test(probe) || /\}\s*\n\s*\{/.test(probe)) {
                        parseMode = "ndjson";
                      }
                    }

                    if (parseMode === "sse") {
                      const sseFrames = buffer.split(/\n\n/);
                      buffer = sseFrames.pop() || ""; // keep possible incomplete frame
                      for (const frame of sseFrames) {
                        const dataLines = frame
                          .split(/\r?\n/)
                          .filter((l) => l.startsWith("data: "))
                          .map((l) => l.slice(6));
                        if (!dataLines.length) continue;
                        const jsonStr = dataLines.join("");
                        try {
                          const obj = JSON.parse(jsonStr);
                          processParsedObject(obj);
                        } catch {}
                      }
                    } else {
                      // ndjson
                      const ndjsonPieces = buffer.split(/\r?\n/);
                      buffer = ndjsonPieces.pop() || "";
                      for (const piece of ndjsonPieces) {
                        const trimmed = piece.trim();
                        if (!trimmed) continue;
                        const jsonStr = trimmed.startsWith("data: ") ? trimmed.slice(6) : trimmed;
                        if (!jsonStr.startsWith("{") && !jsonStr.startsWith("[")) continue;
                        try {
                          const obj = JSON.parse(jsonStr);
                          processParsedObject(obj);
                        } catch {}
                      }
                    }
                  }
                  res.write("data: [DONE]\n\n");
                  res.end();
                  return;
                } catch (err: any) {
                  console.error("[chat-dev] Cohere stream exception:", err);
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: err?.message || "Cohere streaming error" }));
                  return;
                }
              } else if (!useOffline) {
                const primaryModel = "google/gemini-2.0-flash-exp:free";
                const fallbackModels = [
                  // Try a couple of alternatives in case of 429
                  "openai/gpt-4o-mini",
                  "anthropic/claude-3-haiku:free",
                ];

                let oaiResponse = await callModel(primaryModel);
                let attempt = 0;
                while (attempt < 2 && oaiResponse.status === 429) {
                  attempt++;
                  const backoffMs = 800 * attempt;
                  console.log("[chat-dev] Backoff due to 429:", backoffMs, "ms");
                  await new Promise((r) => setTimeout(r, backoffMs));
                  oaiResponse = await callModel(primaryModel);
                }

                let fbIndex = 0;
                while (((!oaiResponse.ok) || !oaiResponse.body) && fbIndex < fallbackModels.length) {
                  const fbModel = fallbackModels[fbIndex++];
                  console.log("[chat-dev] Trying fallback model:", fbModel);
                  oaiResponse = await callModel(fbModel);
                }

                if (!oaiResponse.ok || !oaiResponse.body) {
                  const errorText = await oaiResponse.text();
                  console.error("[chat-dev] OpenRouter error:", errorText);
                  res.writeHead(500, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: errorText }));
                  return;
                }

                res.writeHead(200, {
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache",
                  Connection: "keep-alive",
                  "Access-Control-Allow-Origin": "*",
                });

                const reader = oaiResponse.body.getReader();
                const decoder = new TextDecoder();
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  try { console.log("[chat-dev] SSE chunk bytes:", value?.length); } catch {}
                  res.write(decoder.decode(value));
                }
                res.end();
              } else {
                // Offline fallback: generate a simple summary + JSON fields (no test filler)
                const lastAssistant = messages.findLast?.((m: any) => m.role === "assistant") || messages.slice().reverse().find((m: any) => m.role === "assistant");
                const lastUser = messages.findLast?.((m: any) => m.role === "user") || messages.slice().reverse().find((m: any) => m.role === "user");
                const base = lastUser?.content || "";
                let tone = "friendly";
                let intent = "assist_user";
                if (/تحليل|حلّل|analy/i.test(base)) intent = "analyze_text";
                if (/json/i.test(base)) intent = "return_json";
                const isArabic = /[\u0600-\u06FF]/.test(base) || /عربي|العربية/i.test(base);
                if (isArabic) tone = "supportive-arabic";

                const summary = base
                  ? (isArabic ? "ملخص مختصر: الرسالة تطلب مساعدة وفهم الغرض." : "Brief summary: The message seeks help and clarifies intent.")
                  : (isArabic ? "تحية عامة: كيف أستطيع مساعدتك اليوم؟" : "General greeting: How can I help you today?");
                res.writeHead(200, {
                  "Content-Type": "text/event-stream",
                  "Cache-Control": "no-cache",
                  Connection: "keep-alive",
                  "Access-Control-Allow-Origin": "*",
                });
                const json = JSON.stringify({ choices: [{ delta: { content: summary } }] });
                res.write(`data: ${json}\n\n`);
                res.write("data: [DONE]\n\n");
                res.end();
              }
            } catch (err: any) {
              console.error("[chat-dev] Handler exception:", err);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: err?.message || "Unknown error" }));
            }
          });
        },
      },
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
