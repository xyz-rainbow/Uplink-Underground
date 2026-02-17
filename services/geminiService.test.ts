import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to create mock functions that can be used in vi.mock factory
const mocks = vi.hoisted(() => {
  return {
    generateContent: vi.fn(),
  };
});

// Mock @google/genai module
vi.mock('@google/genai', () => {
  // Return a mock class for GoogleGenAI
  return {
    GoogleGenAI: class {
      constructor() {
        return {
          models: {
            generateContent: mocks.generateContent,
          },
        };
      }
    },
    Type: {},
    Modality: {},
  };
});

describe('decodeAudio', () => {
  let mockCtx: any;
  let decodeAudio: (base64: string, ctx: AudioContext) => Promise<AudioBuffer>;

  beforeEach(async () => {
    // Reset modules to ensure fresh import for each test
    vi.resetModules();

    // Set environment variable required by the service
    vi.stubEnv('API_KEY', 'test-api-key');

    // Dynamically import the service to ensure env vars are set before module evaluation
    const module = await import('./geminiService');
    decodeAudio = module.decodeAudio;

    // Mock AudioContext behavior
    mockCtx = {
      createBuffer: vi.fn().mockImplementation((channels, length, rate) => {
        if (length <= 0) {
          throw new Error("The number of sample-frames must be at least 1.");
        }
        return {
          getChannelData: vi.fn().mockReturnValue(new Float32Array(length)),
          duration: length / rate,
          length: length,
          numberOfChannels: channels,
          sampleRate: rate
        };
      }),
    };
  });

  it('should throw robust error when input string is empty', async () => {
    const emptyBase64 = '';

    await expect(decodeAudio(emptyBase64, mockCtx)).rejects.toThrow("Decode Error: Empty audio data received.");
  });
});
