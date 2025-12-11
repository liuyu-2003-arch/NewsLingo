import { GoogleGenAI, Type } from "@google/genai";
import { SubtitleSegment } from '../types';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to clean potential Markdown output from the model
const cleanJsonOutput = (text: string): string => {
    if (!text) return "[]";
    // Remove markdown code blocks like ```json ... ```
    let cleaned = text.replace(/```json/g, '').replace(/```/g, '');
    
    // Attempt to extract just the array part if there's extra text
    const startIndex = cleaned.indexOf('[');
    const endIndex = cleaned.lastIndexOf(']');
    if (startIndex !== -1 && endIndex !== -1) {
        cleaned = cleaned.substring(startIndex, endIndex + 1);
    }
    return cleaned.trim();
};

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

export const translateSubtitles = async (
    subtitles: SubtitleSegment[],
    onProgress?: (completed: number, total: number) => void
): Promise<SubtitleSegment[]> => {
  // Process in batches
  const BATCH_SIZE = 15; 
  const result: SubtitleSegment[] = [];

  const processBatch = async (batch: SubtitleSegment[]): Promise<SubtitleSegment[]> => {
    try {
      const inputForAi = batch.map(s => ({ id: s.id, text: s.text }));
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `
          You are a professional subtitle translator for NBC Nightly News.
          Translate the following English subtitle segments into natural, concise Simplified Chinese.
          
          STRICT OUTPUT RULES:
          1. Return ONLY a raw JSON array. Do not wrap in markdown or code blocks.
          2. Each item must have 'id' (integer) and 'translation' (string).
          3. Do not translate proper nouns if they are better left in English.
          
          Input Data:
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

      const cleanText = cleanJsonOutput(response.text || "");
      let translatedData = [];
      try {
          translatedData = JSON.parse(cleanText);
      } catch (parseError) {
          console.error("JSON Parse Error on batch:", parseError, "Raw Text:", response.text);
          return batch; // Fail gracefully for this batch
      }
      
      // Merge translations back into segments
      return batch.map(segment => {
        const found = translatedData.find((t: any) => t.id === segment.id);
        if (found && found.translation) {
            return { ...segment, text: `${segment.text}\n${found.translation}` };
        }
        return segment;
      });

    } catch (e) {
      console.error("Translation batch error:", e);
      return batch;
    }
  };

  // Execute batches sequentially
  for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
    const batch = subtitles.slice(i, i + BATCH_SIZE);
    const processedBatch = await processBatch(batch);
    result.push(...processedBatch);
    
    if (onProgress) {
        onProgress(Math.min(i + BATCH_SIZE, subtitles.length), subtitles.length);
    }
  }

  return result;
};