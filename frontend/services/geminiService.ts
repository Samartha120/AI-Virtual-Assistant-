import { GoogleGenAI, Type } from "@google/genai";

// Standard initialization as per guidelines
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const askNexus = async (prompt: string, context?: string, useSearch: boolean = false): Promise<string> => {
  const ai = getAI();
  const systemInstruction = `You are NexusAI, an elite academic and professional virtual assistant. 
  Your primary goal is to provide high-fidelity, accurate, and strategically valuable information.
  
  CONTEXTUAL RULES:
  1. If context is provided from the [YOUR DATASET CONTEXT] section, prioritize it.
  2. If web search is enabled, use it for up-to-date facts and news.
  3. Maintain a professional, concise tone.
  4. ALWAYS cite specific search sources if Google Search is utilized.`;

  const contextPrompt = context ? `\n\n[YOUR DATASET CONTEXT]:\n${context}\n\n` : '';
  const finalPrompt = `${contextPrompt}[USER QUESTION]: ${prompt}`;

  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: finalPrompt,
    config: {
      systemInstruction: systemInstruction,
      tools: useSearch ? [{ googleSearch: {} }] : undefined,
    }
  });

  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const analyzeDocument = async (text: string, context?: string): Promise<string> => {
  const ai = getAI();
  const contextPrompt = context ? `\n\nReference Dataset Context: ${context}` : '';
  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Exhaustively analyze the following content. Return a JSON object with:
    - summary: A 3-sentence executive summary.
    - keyPoints: Array of most critical technical or conceptual insights.
    - actionItems: Array of specific next steps.
    ${contextPrompt}
    Target Content: ${text}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
        },
        required: ['summary', 'keyPoints', 'actionItems']
      }
    }
  });
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const brainstormIdeas = async (prompt: string, context?: string): Promise<string> => {
  const ai = getAI();
  const contextPrompt = context ? `\n\nReference the following dataset knowledge: ${context}` : '';
  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Generate 5 innovative ideas for: ${prompt}. Return as a JSON array.${contextPrompt}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING }
          },
          required: ['title', 'description', 'category']
        }
      }
    }
  });
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const generateTaskAnalysis = async (tasks: string): Promise<string> => {
  const ai = getAI();
  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Analyze these tasks and provide a strategic execution plan. Tasks: ${tasks}`,
  });
  return result.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

export const decomposeTask = async (task: string): Promise<{ title: string; priority: 'low' | 'medium' | 'high' }[]> => {
  const ai = getAI();
  const result = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Break down the following task into 3-5 actionable subtasks. Return a JSON array where each item has "title" and "priority" (low, medium, or high).
    
    Task: ${task}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
          },
          required: ['title', 'priority']
        }
      }
    }
  });

  try {
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? JSON.parse(text) : [];
  } catch (e) {
    console.error("Failed to parse decomposition", e);
    return [];
  }
};
