
import React, { useEffect, useRef } from 'react';
import { Sentiment } from '../types';

interface ProceduralAudioProps {
  sentiment: Sentiment;
  isPlaying: boolean;
  sharedContext: AudioContext | null;
  captureNode?: MediaStreamAudioDestinationNode | null;
  volume?: number;
}

const ProceduralAudio: React.FC<ProceduralAudioProps> = ({ sentiment, isPlaying, sharedContext, captureNode, volume = 0.7 }) => {
  const masterGainRef = useRef<GainNode | null>(null);
  const filterRef = useRef<BiquadFilterNode | null>(null);
  const distortionRef = useRef<WaveShaperNode | null>(null);
  const delayNodeRef = useRef<DelayNode | null>(null);
  const delayGainRef = useRef<GainNode | null>(null);
  const intervalIdRef = useRef<number | null>(null);

  const SCALES = {
    AGGRESSIVE: [0, 1, 3, 4, 7, 8, 10], 
    MELANCHOLY: [0, 2, 3, 5, 7, 8, 10], 
    CORPORATE: [0, 2, 4, 7, 9],       
    CHAOTIC: [0, 1, 6, 7, 10, 11],    
    NEUTRAL: [0, 2, 3, 5, 7, 9, 10],  
  };

  const params = {
    AGGRESSIVE: { root: 41.20, tempo: 135, filter: 1800, resonance: 8, leadType: 'sawtooth' as OscillatorType, drive: 30 },
    MELANCHOLY: { root: 32.70, tempo: 70, filter: 600, resonance: 1, leadType: 'triangle' as OscillatorType, drive: 2 },
    CORPORATE: { root: 55.00, tempo: 120, filter: 2200, resonance: 3, leadType: 'sine' as OscillatorType, drive: 0 },
    CHAOTIC: { root: 48.99, tempo: 155, filter: 3000, resonance: 12, leadType: 'square' as OscillatorType, drive: 50 },
    NEUTRAL: { root: 36.71, tempo: 110, filter: 1200, resonance: 5, leadType: 'sawtooth' as OscillatorType, drive: 10 },
  };

  const initAudioChain = () => {
    if (!sharedContext || masterGainRef.current) return;
    const ctx = sharedContext;

    masterGainRef.current = ctx.createGain();
    masterGainRef.current.gain.setValueAtTime(0, ctx.currentTime);
    masterGainRef.current.connect(ctx.destination);
    if (captureNode) masterGainRef.current.connect(captureNode);

    distortionRef.current = ctx.createWaveShaper();
    distortionRef.current.oversample = '4x';

    filterRef.current = ctx.createBiquadFilter();
    filterRef.current.type = 'lowpass';

    delayNodeRef.current = ctx.createDelay(1.0);
    delayGainRef.current = ctx.createGain();
    delayGainRef.current.gain.value = 0.2;

    filterRef.current.connect(distortionRef.current);
    distortionRef.current.connect(masterGainRef.current);

    distortionRef.current.connect(delayNodeRef.current);
    delayNodeRef.current.connect(delayGainRef.current);
    delayGainRef.current.connect(delayNodeRef.current);
    delayGainRef.current.connect(masterGainRef.current);
  };

  const playKick = (ctx: AudioContext, time: number) => {
    if (!masterGainRef.current) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.2);
    gain.gain.setValueAtTime(0.4, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc.connect(gain);
    gain.connect(masterGainRef.current);
    osc.start(time);
    osc.stop(time + 0.2);
  };

  const playNoise = (ctx: AudioContext, time: number, type: 'hat' | 'snare') => {
    if (!masterGainRef.current) return;
    const bufferSize = ctx.sampleRate * 0.1;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type === 'hat' ? 'highpass' : 'bandpass';
    filter.frequency.setValueAtTime(type === 'hat' ? 8000 : 1000, time);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(type === 'hat' ? 0.05 : 0.15, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + (type === 'hat' ? 0.03 : 0.1));

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGainRef.current);
    noise.start(time);
    noise.stop(time + 0.2);
  };

  const playLeadNote = (ctx: AudioContext, time: number, freq: number, type: OscillatorType, dur: number, vol: number) => {
    if (!filterRef.current) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    osc.connect(gain);
    gain.connect(filterRef.current);
    osc.start(time);
    osc.stop(time + dur);
  };

  useEffect(() => {
    if (masterGainRef.current && sharedContext) {
      const targetGain = isPlaying ? 0.4 * volume : 0;
      masterGainRef.current.gain.setTargetAtTime(targetGain, sharedContext.currentTime, 0.1);
    }
  }, [volume, isPlaying, sharedContext]);

  useEffect(() => {
    if (!isPlaying || !sharedContext) {
      if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
      return;
    }

    initAudioChain();
    const ctx = sharedContext;
    const cur = params[sentiment] || params.NEUTRAL;
    const scale = SCALES[sentiment] || SCALES.NEUTRAL;

    function makeDistortionCurve(amount: number) {
      const n_samples = 44100;
      const curve = new Float32Array(n_samples);
      const deg = Math.PI / 180;
      for (let i = 0; i < n_samples; ++i) {
        const x = (i * 2) / n_samples - 1;
        curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
      }
      return curve;
    }

    if (filterRef.current) {
      filterRef.current.frequency.setTargetAtTime(cur.filter, ctx.currentTime, 0.2);
      filterRef.current.Q.setTargetAtTime(cur.resonance, ctx.currentTime, 0.2);
    }
    if (distortionRef.current) {
      distortionRef.current.curve = makeDistortionCurve(cur.drive);
    }

    let step = 0;
    const beatSec = 60 / cur.tempo;
    
    intervalIdRef.current = window.setInterval(() => {
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime + 0.05;
      const sixteenth = step % 16;

      if (sixteenth % 4 === 0) playKick(ctx, now);
      if (sixteenth % 8 === 4) playNoise(ctx, now, 'snare');
      if (sixteenth % 2 === 0) playNoise(ctx, now, 'hat');

      if (sixteenth % 4 === 0 || (sixteenth % 4 === 2 && Math.random() > 0.6)) {
        const deg = scale[Math.floor(Math.random() * scale.length)];
        const freq = cur.root * (Math.random() > 0.7 ? 8 : 4) * Math.pow(2, deg / 12);
        playLeadNote(ctx, now, freq, cur.leadType, beatSec * 0.5, 0.05);
      }

      step++;
    }, (beatSec * 1000) / 4);

    return () => {
      if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
    };
  }, [isPlaying, sentiment, sharedContext]);

  return null;
};

export default ProceduralAudio;
