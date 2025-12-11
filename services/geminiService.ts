import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleSegment } from '../types';

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

export const translateSubtitles = async (subtitles: SubtitleSegment[]): Promise<SubtitleSegment[]> => {
  // We process in batches to avoid hitting output token limits and to maintain high accuracy
  const BATCH_SIZE = 15; 
  const result: SubtitleSegment[] = [];

  // Helper to process a single batch
  const processBatch = async (batch: SubtitleSegment[]): Promise<SubtitleSegment[]> => {
    try {
      const inputForAi = batch.map(s => ({ id: s.id, text: s.text }));
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
          You are a professional subtitle translator for NBC Nightly News.
          Translate the following English subtitle segments into natural, concise Simplified Chinese.
          
          Strict Rules:
          1. Do not translate proper nouns if they are better left in English, but generally translate common names/places.
          2. Match the tone of a professional news broadcast.
          3. Return a JSON array where each object contains the 'id' (matching input) and the 'translation'.
          
          Input Segments:
          ${JSON.stringify(inputForAi)}
        `,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.INTEGER },
                translation: { type: Type.STRING }
              },
              required: ["id", "translation"]
            }
          }
        }
      });

      const translatedData = JSON.parse(response.text || "[]");
      
      // Merge translations back into segments
      return batch.map(segment => {
        const found = translatedData.find((t: any) => t.id === segment.id);
        if (found && found.translation) {
            // Append translation after a newline. The UI handles this format.
            return { ...segment, text: `${segment.text}\n${found.translation}` };
        }
        return segment;
      });

    } catch (e) {
      console.error("Translation batch error:", e);
      // Fallback: return original segments if translation fails for this batch
      return batch;
    }
  };

  // Execute batches sequentially to be safe with rate limits, 
  // though Promise.all could be used if limits allow.
  for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
    const batch = subtitles.slice(i, i + BATCH_SIZE);
    const processedBatch = await processBatch(batch);
    result.push(...processedBatch);
  }

  return result;
};