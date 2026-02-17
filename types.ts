
export type Sentiment = 'AGGRESSIVE' | 'NEUTRAL' | 'MELANCHOLY' | 'CORPORATE' | 'CHAOTIC';

export interface SpeakerProfile {
  id: string;
  name: string;
  description: string;
  personality: string;
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
}

export interface NewsItem {
  originalHeadline: string;
  cyberHeadline: string;
  cyberStory: string;
  imagePrompts: string[];
  source: string;
  timestamp: string;
  sentiment: Sentiment;
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface BroadcastState {
  isBroadcasting: boolean;
  isFetching: boolean;
  location: { lat: number; lng: number; city: string } | null;
  news: NewsItem[];
  sources: GroundingChunk[];
  error: string | null;
  language: string;
  topic: string;
  speaker: SpeakerProfile;
}

export const SPEAKER_PROFILES: SpeakerProfile[] = [
  {
    id: 'rogue-ai',
    name: 'X-7 "REBEL" AI',
    description: 'A glitched AI that escaped corporate firewalls. Sarcastic, anti-establishment, and erratic.',
    personality: 'highly cynical, anti-corporate, uses glitchy metaphors, refers to humans as "organic units", often questions the reality of the news.',
    voiceName: 'Puck'
  },
  {
    id: 'corp-news-bot',
    name: 'ARASAKA-VOX 900',
    description: 'Clean, professional, and slightly menacing. Everything is fine as long as profits are up.',
    personality: 'clinical, strictly hierarchical, prioritizes corporate stability, uses financial jargon, speaks with a fake sense of optimistic authority.',
    voiceName: 'Kore'
  },
  {
    id: 'low-life-dj',
    name: 'DJ NEON-DIRT',
    description: 'A street journalist broadcasting from the sewers. Tired, gravelly, and street-smart.',
    personality: 'gritty, use of street slang, empathetic to the lower class, focuses on the human cost of the tech, speaks like someone who hasn\'t slept in days.',
    voiceName: 'Charon'
  }
];
