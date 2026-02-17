
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SpeakerProfile, Sentiment } from "../types";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error("SATELLITE LINK ERROR: API_KEY not detected in neural buffer. Ensure GEMINI_API_KEY is configured in your .env file.");
}

const ai = new GoogleGenAI({ apiKey });

export const fetchCyberpunkNews = async (
  lat: number,
  lng: number,
  language: string,
  topic: string,
  speaker: SpeakerProfile
) => {
  const prompt = `Act as the clandestine news terminal "UPLINK UNDERGROUND". 
  Your mission is to intercept current real news about "${topic}" near the coordinates (${lat}, ${lng}) and retransmit them in a dystopian way for the year 2077 in ${language}.
  
  LANGUAGE RULES:
  - Respond strictly in ${language}.
  
  SPEAKER STYLE (${speaker.name}):
  ${speaker.personality}

  CONTENT REQUIREMENTS:
  - Keep the real core of the news (real facts, places, and protagonists).
  - Format 'cyberStory' exactly as 3 short paragraphs separated by double newlines (\\n\\n). 
  - Each paragraph must be a single powerful sentence describing a phase of the news.
  - Generate a JSON array of objects with:
    - originalHeadline: Real original headline.
    - cyberHeadline: Stylized, brief, and powerful headline.
    - cyberStory: Report (3 paragraphs with \\n\\n).
    - imagePrompts: ARRAY of exactly 3 detailed visual descriptions (cyberpunk digital art style, high contrast, neon).
    - sentiment: [AGGRESSIVE, NEUTRAL, MELANCHOLY, CORPORATE, CHAOTIC]. Choose the one that best fits the real news.
    - source: Name of the real source.
    - timestamp: Time stamp like "CY-2077.MM.DD".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    let text = response.text;
    if (!text) throw new Error("Uplink down: No signal received.");

    // Extract JSON array from text response (handles potential markdown formatting)
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) {
      throw new Error("SATELLITE INTERFERENCE: Decryption failed. Neural data corrupted.");
    }
    const cleanJson = text.substring(jsonStart, jsonEnd + 1);

    return {
      data: JSON.parse(cleanJson),
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error: any) {
    if (error?.status === 429 || error?.code === 429 || error?.message?.includes('429')) {
      throw new Error("TRANSFERENCIA BLOQUEADA: El cortafuegos corporativo está limitando nuestro enlace. Espera un momento.");
    }
    console.error("Error fetching news:", error);
    throw new Error("Massive interference detected. Satellite link could not be established.");
  }
};

export const generateStoryImage = async (prompt: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: `High-fidelity cyberpunk digital art, dystopian world, neon lighting, dark mood, hyper-detailed, 8k: ${prompt}`,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
        },
      },
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Error generating image:", error);
    return null;
  }
};

export const generateNarration = async (text: string, language: string, speaker: SpeakerProfile, sentiment: Sentiment) => {
  const emotionMap: Record<Sentiment, string> = {
    AGGRESSIVE: "very aggressive, shouting with urgency, voice distorted by rage",
    MELANCHOLY: "depressed, shaky voice, long and sad pauses",
    CORPORATE: "terrifying and artificial optimism, perfect synthetic voice, implacable authority",
    CHAOTIC: "manic, erratic laughter between sentences, variable and unstable speed",
    NEUTRAL: "dramatic breaking news journalism, serious and deep voice"
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{
      parts: [{
        text: `You are ${speaker.name} from the Uplink Underground terminal. Read the following text with an emotion: ${emotionMap[sentiment]}. 
               Language: ${language}. 
               Text: ${text}`
      }]
    }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: speaker.voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Synthesis error: The sender has lost their voice.");
  return base64Audio;
};

export async function decodeAudio(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

  const sampleCount = Math.floor(len / 2);
  const dataView = new DataView(bytes.buffer);
  const numChannels = 1;
  const sampleRate = 24000;
  const buffer = ctx.createBuffer(numChannels, sampleCount, sampleRate);
  const channelData = buffer.getChannelData(0);

  for (let i = 0; i < sampleCount; i++) {
    channelData[i] = dataView.getInt16(i * 2, true) / 32768.0;
  }
  return buffer;
}
