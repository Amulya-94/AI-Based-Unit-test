import { GoogleGenAI } from "@google/genai";

const getApiKey = () => {
    // Safely check for process.env to avoid ReferenceError in browser
    const envKey = typeof process !== 'undefined' && process.env ? process.env.API_KEY : undefined;
    return localStorage.getItem('gemini_api_key') || envKey;
};

export const generateTests = async (code: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("API Key not found. Please set your Gemini API Key in Settings.");

  const ai = new GoogleGenAI({ apiKey });

  const systemInstruction = `
    You are an expert JavaScript/TypeScript Unit Testing Assistant. 
    Your goal is to write comprehensive unit tests for the provided code using a Jest-like syntax.
    Output ONLY the test code. Do not wrap in markdown (no \`\`\` code blocks).
    Assume global describe, it, expect.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate unit tests for this code:\n\n${code}`,
      config: { systemInstruction, temperature: 0.2 },
    });
    
    let text = response.text || '';
    // Clean up markdown if present
    text = text.replace(/^```(javascript|typescript|js|ts)?\n?/, '').replace(/\n?```$/, '').trim();
    return text;
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate tests");
  }
};

export const generateTestFromPrompt = async (code: string, prompt: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key not found. Please set your Gemini API Key in Settings.");
  
    const ai = new GoogleGenAI({ apiKey });

    const systemInstruction = `
        You are an expert Unit Testing Assistant.
        Your task is to write a SINGLE test case (one 'it' block) based on the user request.
        Output ONLY the code. No markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Source Code:\n${code}\n\nUser Request: ${prompt}`,
        config: { systemInstruction, temperature: 0.2 },
      });
  
      let text = response.text || '';
      text = text.replace(/^```(javascript|typescript|js|ts)?\n?/, '').replace(/\n?```$/, '').trim();
      return text;
    } catch (error: any) {
      console.error("Gemini API Error:", error);
      throw new Error(error.message || "Failed to generate test");
    }
};