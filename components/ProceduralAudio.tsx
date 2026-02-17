
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
  const lfoRef = useRef<OscillatorNode | null>(null);
  const lfoGainRef = useRef<GainNode | null>(null);
  const intervalIdRef = useRef<number | null>(null);
  const droneOscsRef = useRef<OscillatorNode[]>([]);

  const SCALES = {
    AGGRESSIVE: [0, 1, 3, 4, 6, 7, 10], // Locrio / Frigio agresivo
    MELANCHOLY: [0, 2, 3, 5, 7, 8, 11], // Menor Armónica
    CORPORATE: [0, 2, 4, 7, 9],        // Pentatónica mayor limpia
    CHAOTIC: [0, 1, 6, 7, 8, 11],      // Escala simétrica / Disminuida
    NEUTRAL: [0, 2, 3, 5, 7, 9, 10],   // Dórico
  };

  const AUDIO_CONFIG = {
    AGGRESSIVE: { baseFreq: 40, tempo: 140, q: 15, distortion: 0.8, wave: 'sawtooth' as OscillatorType, noise: 0.4 },
    MELANCHOLY: { baseFreq: 30, tempo: 65, q: 2, distortion: 0.1, wave: 'sine' as OscillatorType, noise: 0.05 },
    CORPORATE: { baseFreq: 55, tempo: 120, q: 5, distortion: 0.05, wave: 'square' as OscillatorType, noise: 0.01 },
    CHAOTIC: { baseFreq: 45, tempo: 160, q: 25, distortion: 0.9, wave: 'triangle' as OscillatorType, noise: 0.8 },
    NEUTRAL: { baseFreq: 35, tempo: 110, q: 8, distortion: 0.2, wave: 'sawtooth' as OscillatorType, noise: 0.1 },
  };

  const initAudioEngine = (ctx: AudioContext) => {
    if (masterGainRef.current) return;

    // Nodo Maestro
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, ctx.currentTime);
    masterGain.connect(ctx.destination);
    if (captureNode) masterGain.connect(captureNode);
    masterGainRef.current = masterGain;

    // Filtro Principal con Resonancia
    const mainFilter = ctx.createBiquadFilter();
    mainFilter.type = 'lowpass';
    mainFilter.connect(masterGain);
    filterRef.current = mainFilter;

    // LFO para modular el filtro (el "Wah" cyberpunk)
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.type = 'sine';
    lfo.frequency.value = 0.2; // Muy lento
    lfoGain.gain.value = 500; // Intensidad de modulación
    lfo.connect(lfoGain);
    lfoGain.connect(mainFilter.frequency);
    lfo.start();
    lfoRef.current = lfo;
    lfoGainRef.current = lfoGain;

    // Capa de Drones (Fondo constante)
    const createDrone = (freq: number, detune: number) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      osc.detune.value = detune;
      g.gain.value = 0.05;
      osc.connect(g);
      g.connect(mainFilter);
      osc.start();
      return osc;
    };

    const cfg = AUDIO_CONFIG[sentiment];
    droneOscsRef.current = [
      createDrone(cfg.baseFreq, -10),
      createDrone(cfg.baseFreq * 1.5, 5),
      createDrone(cfg.baseFreq * 0.5, 0)
    ];
  };

  const playSynthFM = (ctx: AudioContext, time: number, freq: number, dur: number) => {
    if (!filterRef.current) return;
    
    // Carrier
    const carrier = ctx.createOscillator();
    const carrierGain = ctx.createGain();
    
    // Modulator (FM Synthesis)
    const modulator = ctx.createOscillator();
    const modulatorGain = ctx.createGain();
    
    const cfg = AUDIO_CONFIG[sentiment];
    carrier.type = cfg.wave;
    modulator.type = 'sine';
    
    modulator.frequency.value = freq * 2;
    modulatorGain.gain.value = freq * (sentiment === 'AGGRESSIVE' ? 5 : 1);
    
    modulator.connect(modulatorGain);
    modulatorGain.connect(carrier.frequency);
    
    carrierGain.gain.setValueAtTime(0, time);
    carrierGain.gain.linearRampToValueAtTime(0.12, time + 0.05);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, time + dur);
    
    carrier.connect(carrierGain);
    carrierGain.connect(filterRef.current);
    
    carrier.start(time);
    modulator.start(time);
    carrier.stop(time + dur);
    modulator.stop(time + dur);
  };

  const playIndustrialDrum = (ctx: AudioContext, time: number, type: 'kick' | 'snare' | 'glitch') => {
    if (!masterGainRef.current) return;
    const g = ctx.createGain();
    
    if (type === 'kick') {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(150, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.4);
      g.gain.setValueAtTime(0.6, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
      osc.connect(g);
      g.connect(masterGainRef.current);
      osc.start(time);
      osc.stop(time + 0.4);
    } else {
      const noise = ctx.createBufferSource();
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      noise.buffer = buffer;
      
      const f = ctx.createBiquadFilter();
      f.type = type === 'snare' ? 'lowpass' : 'highpass';
      f.frequency.value = type === 'snare' ? 800 : 5000;
      
      g.gain.setValueAtTime(type === 'snare' ? 0.2 : 0.05, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + (type === 'snare' ? 0.2 : 0.05));
      
      noise.connect(f);
      f.connect(g);
      g.connect(masterGainRef.current);
      noise.start(time);
    }
  };

  useEffect(() => {
    if (masterGainRef.current && sharedContext) {
      const targetGain = isPlaying ? 0.4 * volume : 0;
      masterGainRef.current.gain.setTargetAtTime(targetGain, sharedContext.currentTime, 0.2);
    }
  }, [volume, isPlaying, sharedContext]);

  useEffect(() => {
    if (!isPlaying || !sharedContext) {
      if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
      droneOscsRef.current.forEach(o => { try { o.stop(); } catch(e) {} });
      droneOscsRef.current = [];
      return;
    }

    const ctx = sharedContext;
    initAudioEngine(ctx);

    const cfg = AUDIO_CONFIG[sentiment];
    const scale = SCALES[sentiment];
    
    if (filterRef.current) {
      filterRef.current.frequency.value = sentiment === 'AGGRESSIVE' ? 1200 : 600;
      filterRef.current.Q.value = cfg.q;
    }

    let step = 0;
    const stepTime = (60 / cfg.tempo) / 4;

    intervalIdRef.current = window.setInterval(() => {
      if (ctx.state !== 'running') return;
      const now = ctx.currentTime + 0.05;
      const sixteen = step % 16;

      // Percusión Cyberpunk
      if (sixteen % 4 === 0) playIndustrialDrum(ctx, now, 'kick');
      if (sixteen % 8 === 4) playIndustrialDrum(ctx, now, 'snare');
      if (Math.random() > 0.8) playIndustrialDrum(ctx, now, 'glitch');

      // Secuenciador FM
      if (sixteen % 2 === 0 && Math.random() > 0.4) {
        const octave = Math.random() > 0.8 ? 2 : 1;
        const note = scale[Math.floor(Math.random() * scale.length)];
        const freq = cfg.baseFreq * octave * 2 * Math.pow(2, note / 12);
        playSynthFM(ctx, now, freq, stepTime * 3);
      }

      // Variación de LFO basada en sentimiento
      if (lfoRef.current) {
        lfoRef.current.frequency.setTargetAtTime(cfg.tempo / 400, ctx.currentTime, 1);
      }

      step++;
    }, stepTime * 1000);

    return () => {
      if (intervalIdRef.current) window.clearInterval(intervalIdRef.current);
      droneOscsRef.current.forEach(o => { try { o.stop(); } catch(e) {} });
    };
  }, [isPlaying, sentiment, sharedContext, volume]);

  return null;
};

export default ProceduralAudio;
