import { GoogleGenAI } from "@google/genai";
import fs from "node:fs";

const ai = new GoogleGenAI({
  apiKey: "AIzaSyAWFCtpXMgU5ggiqhOVfSVAxs8LFs5izqA",
});

async function main() {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: "Explain how AI works in a few words",
  });
  const text = typeof response?.text === "function" ? await response.text() : response?.text;
  console.log("Text:", text ?? "<empty>");
  try {
    fs.writeFileSync("scripts/genai-test-output.txt", typeof text === "string" ? text : String(text ?? ""), "utf8");
  } catch (e) {
    console.error("Failed to write output file:", e?.message || e);
  }
}

main().catch((err) => {
  console.error("genai-test error:", err?.message || err);
  process.exit(1);
});