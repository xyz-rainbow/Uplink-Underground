
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SpeakerProfile, Sentiment } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fetchCyberpunkNews = async (
  lat: number, 
  lng: number, 
  language: string, 
  topic: string, 
  speaker: SpeakerProfile
) => {
  const targetLanguage = language === 'Spanish' ? 'Castellano de España (peninsular)' : language;

  const prompt = `Actúa como el terminal de noticias clandestino "UPLINK UNDERGROUND". 
  Tu misión es interceptar noticias reales actuales sobre "${topic}" cerca de las coordenadas (${lat}, ${lng}) y retransmitirlas de forma distópica para el año 2077 en ${targetLanguage}.
  
  REGLAS DE LENGUAJE:
  - Usa estrictamente español de España (vosotros, ordenador, móvil, vale).
  
  ESTILO DEL EMISOR (${speaker.name}):
  ${speaker.personality}

  REQUISITOS DEL CONTENIDO:
  - Mantén la base real de la noticia (hechos, lugares y protagonistas reales).
  - Formatea 'cyberStory' exactamente como 3 párrafos cortos separados por dobles saltos de línea (\\n\\n). 
  - Cada párrafo debe ser una sola frase impactante que describa una fase de la noticia.
  - Genera un JSON array de objetos con:
    - originalHeadline: Titular real original.
    - cyberHeadline: Titular estilizado, breve y potente.
    - cyberStory: Reportaje (3 párrafos con \\n\\n).
    - imagePrompts: ARRAY de exactamente 3 descripciones visuales detalladas (estilo cyberpunk digital art, alto contraste, neón).
    - sentiment: [AGGRESSIVE, NEUTRAL, MELANCHOLY, CORPORATE, CHAOTIC]. Elige el que mejor encaje con la noticia real.
    - source: Nombre de la fuente real.
    - timestamp: Marca temporal tipo "CY-2077.MM.DD".`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              originalHeadline: { type: Type.STRING },
              cyberHeadline: { type: Type.STRING },
              cyberStory: { type: Type.STRING },
              imagePrompts: { 
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              sentiment: { type: Type.STRING },
              source: { type: Type.STRING },
              timestamp: { type: Type.STRING },
            },
            required: ["originalHeadline", "cyberHeadline", "cyberStory", "imagePrompts", "sentiment", "source", "timestamp"]
          }
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Uplink caído: No se recibió señal.");
    
    return {
      data: JSON.parse(text),
      sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  } catch (error) {
    console.error("Error fetching news:", error);
    throw new Error("Interferencia masiva detectada. No se pudo establecer el enlace con el satélite.");
  }
};

export const generateStoryImage = async (prompt: string) => {
  try {
    const localAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await localAi.models.generateContent({
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
    AGGRESSIVE: "muy agresivo, gritando con urgencia, voz distorsionada por la rabia",
    MELANCHOLY: "deprimido, voz temblorosa, pausas largas y tristes",
    CORPORATE: "optimismo aterrador y artificial, voz sintética perfecta, autoridad implacable",
    CHAOTIC: "maníaco, risas erráticas entre frases, velocidad variable e inestable",
    NEUTRAL: "periodismo dramático de última hora, voz seria y profunda"
  };

  const targetLanguage = language === 'Spanish' ? 'Español de España' : language;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ 
      parts: [{ 
        text: `Eres ${speaker.name} del terminal Uplink Underground. Lee el siguiente texto con una emoción ${emotionMap[sentiment]}. 
               Idioma: ${targetLanguage}. Acento marcado de España. 
               Texto: ${text}` 
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
  if (!base64Audio) throw new Error("Error en la síntesis: El emisor ha perdido la voz.");
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
