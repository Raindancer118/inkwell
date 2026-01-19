
import { GoogleGenAI, Type } from "@google/genai";
import { Chapter, Character, Location, WorldSettings, LoreEntry, Beat } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const getContext = (settings: WorldSettings, lore: LoreEntry[]) => `
WORLD CONTEXT (LANGUAGE: ${settings.language}):
- Genre: ${settings.genre}
- Tone: ${settings.tone}
- Prose Style: ${settings.proseStyle}
- Lore: ${lore.map(l => `[${l.category}]: ${l.content}`).join('\n')}
`;

export const verifyBeatCompletion = async (beat: Beat, prose: string, settings: WorldSettings): Promise<boolean> => {
  if (!prose || prose.length < 50) return false;
  
  const prompt = `Act as a narrative auditor. 
  BEAT GOAL: ${beat.title} - ${beat.description}
  CURRENT PROSE: ${prose}
  
  TASK: Has the author successfully written the events described in the Beat Goal? 
  Be lenient but ensure the core event occurred.
  Return JSON: {"completed": true/false}`;

  try {
    // Correctly using ai.models.generateContent with gemini-3-flash-preview
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: { completed: { type: Type.BOOLEAN } },
          required: ["completed"]
        }
      }
    });
    // Use .text property directly
    const result = JSON.parse(response.text || "{}");
    return !!result.completed;
  } catch (e) {
    return false;
  }
};

export const consultCoWriter = async (
  currentBeat: Beat, 
  nextBeat: Beat | null, 
  characters: Character[], 
  settings: WorldSettings, 
  lore: LoreEntry[],
  requestProse: boolean
) => {
  const prompt = `You are Inkwell, a master co-writer. 
  CURRENT BEAT GOAL: ${currentBeat.title} - ${currentBeat.description}
  CURRENT PROSE: ${currentBeat.draft || "(Empty)"}
  NEXT INTENDED PLOT POINT: ${nextBeat ? `${nextBeat.title} - ${nextBeat.description}` : "End of Story"}
  
  CONTEXT: ${getContext(settings, lore)}
  CHARACTERS: ${JSON.stringify(characters.map(c => c.name))}

  TASK: 
  ${requestProse ? "Write the next 3-5 sentences." : "Provide bridge advice."}
  Return JSON: {"advice": "...", "prose": "..."}`;

  // Correctly using ai.models.generateContent with gemini-3-pro-preview
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          advice: { type: Type.STRING },
          prose: { type: Type.STRING }
        },
        required: ["advice"]
      }
    }
  });

  // Use .text property directly
  return JSON.parse(response.text || "{}");
};

export const analyzePlot = async (chapters: Chapter[], characters: Character[], locations: Location[], settings: WorldSettings, lore: LoreEntry[]) => {
  const prompt = `You are Inkwell. Analyze story for consistency and propose additions.
  ${getContext(settings, lore)}
  CHAPTERS: ${JSON.stringify(chapters)}`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          consistency: { type: Type.STRING },
          suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          suggestedBeats: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { chapterId: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING }, rationale: { type: Type.STRING } } } },
          suggestedChapterFlow: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { chapterId: { type: Type.STRING }, suggestedBeatIds: { type: Type.ARRAY, items: { type: Type.STRING } }, reasoning: { type: Type.STRING } } } },
          proposedLore: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, content: { type: Type.STRING }, rationale: { type: Type.STRING } } } },
          proposedCharacters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, description: { type: Type.STRING }, rationale: { type: Type.STRING } } } },
          proposedLocations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, atmosphere: { type: Type.STRING }, description: { type: Type.STRING }, rationale: { type: Type.STRING } } } }
        }
      }
    }
  });
  // Use .text property directly
  return JSON.parse(response.text || "{}");
};

export const chatWithInkwell = async (history: any[], message: string, settings: WorldSettings, lore: LoreEntry[], chapters: Chapter[]) => {
  const contents = [...history.map(m => ({ role: m.role, parts: [{ text: m.text }] })), { role: 'user', parts: [{ text: message }] }];
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents,
    config: { systemInstruction: `You are Inkwell. ${getContext(settings, lore)}` }
  });
  // Use .text property directly
  return response.text;
};

export const visualizeAsset = async (type: 'character' | 'location', data: Character | Location, settings: WorldSettings) => {
  const prompt = type === 'character' ? `Portrait: ${(data as Character).name}. ${(data as Character).description}` : `Setting: ${(data as Location).name}. ${(data as Location).description}`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: { parts: [{ text: prompt }] },
    config: { imageConfig: { aspectRatio: type === 'character' ? "3:4" : "16:9" } }
  });
  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return null;
};

export const extractFromText = async (text: string, settings: WorldSettings) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: `Extract chapters, beats, characters, and locations from: ${text}`,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          chapters: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                title: { type: Type.STRING },
                beats: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING } } } }
              } 
            } 
          },
          characters: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, role: { type: Type.STRING }, description: { type: Type.STRING } } } },
          locations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, atmosphere: { type: Type.STRING }, description: { type: Type.STRING } } } }
        }
      }
    }
  });
  // Use .text property directly
  return JSON.parse(response.text || "{}");
};

export const generateBeatTitle = async (description: string, settings: WorldSettings) => {
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Title for: ${description}` });
  // Use .text property directly
  return (response.text || "").trim().replace(/^"|"$/g, '');
};

export const generateChapterTitle = async (beats: Beat[], settings: WorldSettings) => {
  const response = await ai.models.generateContent({ model: "gemini-3-flash-preview", contents: `Title for beats: ${beats.map(b => b.title).join(", ")}` });
  // Use .text property directly
  return (response.text || "").trim().replace(/^"|"$/g, '');
}