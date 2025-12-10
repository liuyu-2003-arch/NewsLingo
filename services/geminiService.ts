import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const explainText = async (text: string, context: string): Promise<string> => {
  try {
    const prompt = `
      You are an expert English language teacher helping a Chinese student learn from a news broadcast.
      
      The student has paused on this subtitle: "${text}"
      The overall context is a news segment (NBC Nightly News).
      
      Please provide a concise but helpful explanation in Simplified Chinese. 
      1. Define any difficult words or idioms in this specific sentence.
      2. Briefly explain any complex grammar used.
      3. If the sentence refers to a specific cultural or political concept common in US news, briefly mention it.
      
      Keep the output plain text, friendly, and easy to read. Max 150 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "抱歉，暂时无法生成解释。";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "连接 AI 导师时发生错误。";
  }
};