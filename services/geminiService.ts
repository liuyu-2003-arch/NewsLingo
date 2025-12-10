import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const explainText = async (text: string, context: string): Promise<string> => {
  try {
    const prompt = `
      You are an expert English language teacher helping a student learn from a news broadcast.
      
      The student has paused on this subtitle: "${text}"
      The overall context is a news segment (NBC Nightly News).
      
      Please provide a concise but helpful explanation. 
      1. Define any difficult words or idioms in this specific sentence.
      2. Briefly explain any complex grammar used.
      3. If the sentence refers to a specific cultural or political concept common in US news, briefly mention it.
      
      Keep the output plain text, friendly, and easy to read. Max 150 words.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "Sorry, I couldn't generate an explanation at this time.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "An error occurred while contacting the AI tutor.";
  }
};
