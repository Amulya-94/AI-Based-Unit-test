import { GoogleGenAI } from "@google/genai";

const SYSTEM_INSTRUCTION = `
You are an expert JavaScript/TypeScript Unit Testing Assistant. 
Your goal is to write comprehensive unit tests for the provided code using a Jest-like syntax.
The user will provide a function or set of functions.
You must output ONLY the test code. 
Do not wrap it in markdown code blocks (e.g. \`\`\`javascript). 
Do not provide explanations or comments outside the code.

Environment details:
- Assume a global \`describe\`, \`it\`, and \`expect\` are available (like Jest/Mocha).
- \`expect\` supports: \`toBe\`, \`toEqual\`, \`toBeDefined\`, \`toBeNull\`, \`toBeTruthy\`, \`toBeFalsy\`, \`toContain\`, \`toThrow\`.
- Do NOT use \`require\` or \`import\`. Assume the functions from the user's code are available in the global scope.
- Focus on edge cases, error handling, and typical usage scenarios.
`;

const cleanOutput = (text: string): string => {
  if (!text) return '';
  
  // 1. Try to find code block patterns first
  const codeBlockRegex = /```(?:javascript|typescript|js|ts)?\n([\s\S]*?)```/;
  const match = text.match(codeBlockRegex);
  
  if (match) {
    return match[1].trim();
  }

  // 2. Fallback: remove leading/trailing backticks if they exist without newline structure
  return text
    .replace(/^```(javascript|typescript|js|ts)?\n?/, '')
    .replace(/\n?```$/, '')
    .trim();
};

export const generateTests = async (code: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate unit tests for this code:\n\n${code}`,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        temperature: 0.2, // Low temperature for deterministic code generation
      },
    });

    return cleanOutput(response.text || '');
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate tests");
  }
};

export const generateTestFromPrompt = async (code: string, prompt: string): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const customInstruction = `
    You are an expert Unit Testing Assistant.
    Your task is to write a SINGLE test case (usually a single 'it' block) for the provided Source Code, based on the User's specific Request.
    
    Rules:
    1. Output ONLY the JavaScript code for the test case.
    2. Do NOT wrap in markdown blocks.
    3. Assume 'expect', 'describe', 'it' are global.
    4. Do not include imports.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Source Code:\n${code}\n\nUser Request: ${prompt}`,
      config: {
        systemInstruction: customInstruction,
        temperature: 0.2,
      },
    });

    return cleanOutput(response.text || '');
  } catch (error: any) {
    console.error("Gemini API Error:", error);
    throw new Error(error.message || "Failed to generate test case");
  }
};