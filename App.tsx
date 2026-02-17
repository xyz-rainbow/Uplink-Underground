
import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import { fetchCyberpunkNews, generateNarration, decodeAudio, generateStoryImage } from './services/geminiService';
import { NewsItem, BroadcastState, SPEAKER_PROFILES, SpeakerProfile, Sentiment } from './types';
import MusicVisualizer from './components/MusicVisualizer';
import ProceduralAudio from './components/ProceduralAudio';
import ApiKeyModal from './components/ApiKeyModal';
import { MapPin, Radio, Zap, AlertTriangle, RefreshCw, ChevronRight, ExternalLink, Cpu, UserCheck, Bookmark, Trash2, Archive, X, Navigation, Infinity, Share2, Download, StopCircle, Volume2, VolumeX, Terminal, Image as ImageIcon, Activity, Play, Music, Mic, ScrollText, Loader2, Key } from 'lucide-react';
import L from 'leaflet';

const TOPICS = ['Technology', 'Crime', 'Politics', 'Economy', 'Corporate', 'General'];

const App: React.FC = () => {
  const [state, setState] = useState<BroadcastState>({
    isBroadcasting: false,
    isFetching: false,
    location: { lat: 40.4168, lng: -3.7038, city: "Madrid" },
    news: [],
    sources: [],
    error: null,
    language: 'English',
    topic: 'General',
    speaker: SPEAKER_PROFILES[0]
  });

  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [currentNewsIndex, setCurrentNewsIndex] = useState(0);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [savedStories, setSavedStories] = useState<NewsItem[]>([]);
  const [showArchives, setShowArchives] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isWaitingForNext, setIsWaitingForNext] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [countdown, setCountdown] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [storyImages, setStoryImages] = useState<(string | null)[]>([null]);
  
  const [isMusicActive, setIsMusicActive] = useState(false);
  const [isNarrationActive, setIsNarrationActive] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);

  const [apiKey, setApiKey] = useState<string | null>(null);

  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const effectsGainRef = useRef<GainNode | null>(null);
  const destNodeRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);
  const paragraphRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  const currentNewsListRef = useRef<NewsItem[]>([]);
  const currentChunksRef = useRef<string[]>([]);
  const isTransitioningRef = useRef(false);
  const isNarrationActiveRef = useRef(false);

  const currentSentiment: Sentiment = state.news[currentNewsIndex]?.sentiment || 'NEUTRAL';

  const themeColors = {
    AGGRESSIVE: 'text-red-500 border-red-600 bg-red-950/20 shadow-[0_0_15px_rgba(220,38,38,0.2)]',
    MELANCHOLY: 'text-blue-400 border-blue-600 bg-blue-950/20 shadow-[0_0_15px_rgba(37,99,235,0.2)]',
    CORPORATE: 'text-purple-400 border-purple-600 bg-purple-950/20 shadow-[0_0_15px_rgba(147,51,234,0.2)]',
    CHAOTIC: 'text-yellow-400 border-yellow-600 bg-yellow-950/20 shadow-[0_0_15px_rgba(202,138,4,0.2)]',
    NEUTRAL: 'text-cyan-400 border-cyan-600 bg-cyan-950/20 shadow-[0_0_15px_rgba(8,145,178,0.2)]'
  }[currentSentiment];

  const primaryHex = {
    AGGRESSIVE: '#dc2626',
    MELANCHOLY: '#2563eb',
    CORPORATE: '#9333ea',
    CHAOTIC: '#ca8a04',
    NEUTRAL: '#0891b2'
  }[currentSentiment];

  useEffect(() => {
    const stored = localStorage.getItem('uplink_underground_archives');
    if (stored) setSavedStories(JSON.parse(stored));

    const storedKey = localStorage.getItem('uplink_gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    } else if (import.meta.env.VITE_GEMINI_API_KEY) {
      setApiKey(import.meta.env.VITE_GEMINI_API_KEY);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('uplink_underground_archives', JSON.stringify(savedStories));
  }, [savedStories]);

  useEffect(() => {
    if (effectsGainRef.current && audioCtx) {
      effectsGainRef.current.gain.setTargetAtTime(volume, audioCtx.currentTime, 0.05);
    }
  }, [volume, audioCtx]);

  useEffect(() => {
    if (!state.isBroadcasting) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('paragraph-visible');
          }
        });
      },
      { threshold: 0.1 }
    );

    paragraphRefs.current.forEach((ref) => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, [state.isBroadcasting, currentNewsIndex]);

  useEffect(() => {
    const container = document.getElementById('map');
    if (container && !mapRef.current) {
      mapRef.current = L.map('map', { zoomControl: false }).setView([state.location?.lat || 40.4168, state.location?.lng || -3.7038], 3);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
      if (state.location) {
        markerRef.current = L.marker([state.location.lat, state.location.lng]).addTo(mapRef.current);
      }
      mapRef.current.on('click', (e: any) => {
        const { lat, lng } = e.latlng;
        setState(prev => ({ ...prev, location: { ...prev.location!, lat, lng } }));
        if (markerRef.current) {
          markerRef.current.setLatLng(e.latlng);
        } else {
          markerRef.current = L.marker(e.latlng).addTo(mapRef.current!);
        }
      });
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!state.isBroadcasting && !showArchives && mapRef.current) {
      // Small timeout to allow the DOM to update visibility before invalidating size
      setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 100);
    }
  }, [state.isBroadcasting, showArchives]);

  const handleSaveApiKey = (key: string) => {
    localStorage.setItem('uplink_gemini_api_key', key);
    setApiKey(key);
  };

  const handleClearApiKey = () => {
    localStorage.removeItem('uplink_gemini_api_key');
    setApiKey(null);
    window.location.reload();
  };

  const initAudio = async () => {
    let currentCtx = audioCtx;
    if (!currentCtx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      currentCtx = new AudioCtx({ sampleRate: 24000 });
      
      const gain = currentCtx.createGain();
      gain.gain.value = volume;
      
      const dest = currentCtx.createMediaStreamDestination();
      gain.connect(currentCtx.destination);
      gain.connect(dest);
      
      effectsGainRef.current = gain;
      destNodeRef.current = dest;
      setAudioCtx(currentCtx);
    }
    
    if (currentCtx.state !== 'running') {
      await currentCtx.resume();
    }
    return currentCtx;
  };

  const playChunk = useCallback(async (chunkIdx: number, chunks: string[], sentiment: Sentiment, ctxToUse: AudioContext | null) => {
    const activeCtx = ctxToUse || audioCtx;
    if (!chunks[chunkIdx] || !activeCtx || !state.isBroadcasting || !isNarrationActiveRef.current) {
      setIsVoiceLoading(false);
      return;
    }

    if (!apiKey) {
      setIsVoiceLoading(false);
      return;
    }

    setCurrentChunkIndex(chunkIdx);
    setIsVoiceLoading(true);
    
    try {
      const base64 = await generateNarration(apiKey, chunks[chunkIdx], state.language, state.speaker, sentiment);
      const buffer = await decodeAudio(base64, activeCtx);
      setIsVoiceLoading(false);

      if (!isNarrationActiveRef.current) return;
      
      if (audioSourceRef.current) {
        audioSourceRef.current.onended = null;
        try { audioSourceRef.current.stop(); } catch(e) {}
      }

      const source = activeCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(effectsGainRef.current!);
      
      source.onended = () => {
        const nextChunk = chunkIdx + 1;
        if (nextChunk < chunks.length && isNarrationActiveRef.current) {
          playChunk(nextChunk, chunks, sentiment, activeCtx);
        } else if (isAutoMode && isNarrationActiveRef.current) {
          triggerCountdown();
        }
      };

      source.start();
      audioSourceRef.current = source;
    } catch (e: any) {
      console.error("Playback error:", e?.message || e);
      setIsVoiceLoading(false);
      if (isAutoMode && isNarrationActiveRef.current) triggerCountdown();
    }
  }, [state.isBroadcasting, state.language, state.speaker, isAutoMode, audioCtx, apiKey]);

  const prepareStoryChunks = useCallback(async (index: number, newsList: NewsItem[]) => {
    const item = newsList[index];
    if (!item) return;

    setCurrentNewsIndex(index);
    setCurrentChunkIndex(0);
    setIsWaitingForNext(false);
    setStoryImages([null]);
    isTransitioningRef.current = false;

    const paragraphs = item.cyberStory.split('\n\n').filter(p => p.trim().length > 0);
    currentChunksRef.current = paragraphs.length > 0 ? paragraphs : [item.cyberStory];

    item.imagePrompts.forEach(async (p, idx) => {
      if (idx < 1 && apiKey) {
        const url = await generateStoryImage(apiKey, p);
        setStoryImages(prev => {
          const next = [...prev];
          next[idx] = url;
          return next;
        });
      }
    });

    paragraphRefs.current.forEach(ref => ref?.classList.remove('paragraph-visible'));
    
    if (isNarrationActiveRef.current && audioCtx) {
      setTimeout(() => playChunk(0, currentChunksRef.current, item.sentiment, audioCtx), 300);
    }
  }, [playChunk, audioCtx, apiKey]);

  const handleNext = useCallback(() => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.onended = null;
      try { audioSourceRef.current.stop(); } catch(e) {}
    }
    const nextIdx = (currentNewsIndex + 1) % currentNewsListRef.current.length;
    prepareStoryChunks(nextIdx, currentNewsListRef.current);
  }, [currentNewsIndex, prepareStoryChunks]);

  const triggerCountdown = useCallback(() => {
    if (isTransitioningRef.current) return;
    isTransitioningRef.current = true;
    setIsWaitingForNext(true);
    let count = 5;
    setCountdown(count);
    
    if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
    
    countdownIntervalRef.current = window.setInterval(() => {
      count--;
      setCountdown(count);
      if (count <= 0) {
        if (countdownIntervalRef.current) window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        handleNext();
      }
    }, 1000);
  }, [handleNext]);

  const startBroadcast = async () => {
    if (state.isFetching || !state.location || !apiKey) return;
    try {
      setState(p => ({ ...p, isFetching: true, error: null }));
      const { data, sources } = await fetchCyberpunkNews(apiKey, state.location!.lat, state.location!.lng, state.language, state.topic, state.speaker);
      
      if (!data || data.length === 0) throw new Error("Weak signal: No reports found in this sector.");
      
      currentNewsListRef.current = data;
      setState(p => ({ ...p, isFetching: false, news: data, sources, isBroadcasting: true }));
      prepareStoryChunks(0, data);
    } catch (err: any) {
      setState(p => ({ ...p, isFetching: false, error: err.message || "Satellite link failure." }));
    }
  };

  const stopEverything = () => {
    if (countdownIntervalRef.current) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.onended = null;
      try { audioSourceRef.current.stop(); } catch(e) {}
    }
    isNarrationActiveRef.current = false;
    setState(s => ({ ...s, isBroadcasting: false }));
    setIsMusicActive(false);
    setIsNarrationActive(false);
  };

  const handleShare = async () => {
    const news = state.news[currentNewsIndex];
    if (!news) return;

    const shareData = {
      title: 'UPLINK UNDERGROUND',
      text: `${news.cyberHeadline}\n\n${news.cyberStory}\n\nBroadcast from: ${state.location?.city || 'Unknown Sector'}`,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
        alert('Link copied to cortical clipboard.');
      }
    } catch (err: any) {
      console.error('Share error:', err?.message || err);
    }
  };

  const toggleMusic = async () => {
    if (!audioCtx) await initAudio();
    setIsMusicActive(!isMusicActive);
  };

  const toggleNarration = async () => {
    const ctx = await initAudio();
    const nextState = !isNarrationActive;
    
    isNarrationActiveRef.current = nextState;
    setIsNarrationActive(nextState);

    if (nextState) {
      playChunk(currentChunkIndex, currentChunksRef.current, currentSentiment, ctx);
    } else {
      setIsVoiceLoading(false);
      if (audioSourceRef.current) {
        audioSourceRef.current.onended = null;
        try { audioSourceRef.current.stop(); } catch(e) {}
      }
    }
  };

  return (
    <div className="min-h-screen cyber-grid flex flex-col items-center p-4 lg:p-8" role="application">
      {!apiKey && <ApiKeyModal onSave={handleSaveApiKey} />}

      <ProceduralAudio 
        isPlaying={isMusicActive && state.isBroadcasting} 
        sentiment={currentSentiment} 
        sharedContext={audioCtx}
        captureNode={destNodeRef.current}
        volume={volume}
      />

      <header className={`w-full max-w-6xl mb-8 flex flex-col md:flex-row items-center justify-between border-b pb-6 transition-colors duration-500 ${state.isBroadcasting ? themeColors : 'border-cyan-500/30'}`}>
        <div className="flex items-center gap-4 group cursor-pointer" onClick={stopEverything}>
          <Radio className={`w-10 h-10 ${state.isBroadcasting ? 'animate-pulse' : 'text-cyan-400'}`} style={{ color: state.isBroadcasting ? primaryHex : '' }} aria-hidden="true" />
          <h1 className="text-4xl font-black orbitron tracking-tighter glitch" data-text="UPLINK UNDERGROUND">UPLINK UNDERGROUND</h1>
        </div>
        
        <div className="flex items-center gap-6 mt-6 md:mt-0 font-mono text-[11px] uppercase font-bold">
          <div className="flex items-center gap-3 bg-black/60 px-4 py-2 border border-cyan-900/50 rounded-full">
            {volume === 0 ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            <input 
              type="range" min="0" max="1" step="0.01" value={volume} 
              onChange={e => setVolume(parseFloat(e.target.value))} 
              className="w-24 accent-cyan-400 cursor-pointer h-1 bg-cyan-950 rounded-lg appearance-none" 
              aria-label="Master volume"
            />
          </div>
          <button onClick={() => setShowArchives(!showArchives)} className="flex items-center gap-2 hover:text-white transition-colors">
            <Archive className="w-4 h-4" /> {showArchives ? 'EXIT' : 'ARCHIVES'}
          </button>
          <span className="flex items-center gap-2 text-red-500">
            <MapPin className="w-3 h-3" /> {state.location?.lat.toFixed(2)}, {state.location?.lng.toFixed(2)}
          </span>
        </div>
      </header>

      <main className={`w-full max-w-6xl bg-black/80 border rounded-xl overflow-hidden backdrop-blur-md transition-all duration-700 ${state.isBroadcasting ? themeColors : 'neon-border'}`}>
        {/* Archives Section */}
        <div className={`p-8 max-h-[70vh] overflow-y-auto animate-in fade-in duration-500 ${showArchives ? '' : 'hidden'}`}>
           <div className="flex justify-between items-center mb-8 border-b border-cyan-900/30 pb-4">
            <h2 className="text-2xl font-black orbitron flex items-center gap-3"><Terminal className="text-cyan-400" /> ENCRYPTED RECORDS</h2>
            <div className="flex gap-4">
               {apiKey && (
                <button onClick={handleClearApiKey} className="text-[10px] text-red-500 border border-red-900/50 px-3 py-1 rounded hover:bg-red-950/30 flex items-center gap-2">
                   <Key className="w-3 h-3" /> DISCONNECT KEY
                </button>
               )}
               <button onClick={() => setShowArchives(false)} aria-label="Close"><X className="w-8 h-8 text-cyan-400" /></button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedStories.map((s, i) => (
              <div key={i} className="p-5 border border-cyan-900/40 bg-cyan-950/5 rounded hover:bg-cyan-900/10 transition-colors group">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] opacity-40">{s.timestamp}</span>
                  <button onClick={() => setSavedStories(prev => prev.filter(x => x.cyberHeadline !== s.cyberHeadline))} className="text-red-900 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-4 h-4" /></button>
                </div>
                <h3 className="font-bold text-white mb-2 uppercase">{s.cyberHeadline}</h3>
                <p className="text-xs italic opacity-70">"{s.cyberStory.slice(0, 100)}..."</p>
              </div>
            ))}
          </div>
        </div>

        {/* Setup Section */}
        <div className={`p-8 lg:p-12 space-y-12 animate-in fade-in zoom-in duration-500 ${!showArchives && !state.isBroadcasting && !state.isFetching ? '' : 'hidden'}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <label className="text-xs font-black uppercase tracking-widest text-cyan-600">01. Tracking Coordinates</label>
                <button onClick={() => { setIsLocating(true); navigator.geolocation.getCurrentPosition(p => {
                  const loc = { lat: p.coords.latitude, lng: p.coords.longitude };
                  setState(s => ({ ...s, location: { ...s.location!, ...loc } }));
                  if (mapRef.current) mapRef.current.setView([loc.lat, loc.lng], 10);
                  setIsLocating(false);
                }, () => setIsLocating(false)); }} className="text-[10px] border border-cyan-800 px-3 py-1 hover:bg-cyan-900 transition-colors">
                  {isLocating ? 'CALIBRATING...' : 'AUTO-GPS'}
                </button>
              </div>
              <div id="map" className="rounded-lg border border-cyan-900/50 overflow-hidden shadow-inner cursor-crosshair"></div>
            </div>
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-cyan-600">02. Link Parameters</label>
                <div className="flex flex-wrap gap-2">
                  {TOPICS.map(t => (
                    <button key={t} onClick={() => setState(p => ({ ...p, topic: t }))}
                      className={`text-[11px] px-4 py-2 border transition-all font-bold ${state.topic === t ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(0,255,204,0.3)]' : 'border-cyan-900 text-cyan-700 hover:border-cyan-400'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                 <label className="text-xs font-black uppercase tracking-widest text-cyan-600">03. Identity Profile</label>
                 <div className="grid grid-cols-1 gap-3">
                  {SPEAKER_PROFILES.map(p => (
                    <button key={p.id} onClick={() => setState(s => ({ ...s, speaker: p }))}
                      className={`p-4 border text-left transition-all ${state.speaker.id === p.id ? 'bg-cyan-500/10 border-cyan-400' : 'border-cyan-900/40 opacity-50 hover:opacity-100'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold orbitron text-xs tracking-wider">{p.name}</span>
                        {state.speaker.id === p.id && <UserCheck className="w-4 h-4 text-cyan-400" />}
                      </div>
                      <p className="text-[10px] opacity-60 leading-tight">{p.description}</p>
                    </button>
                  ))}
                 </div>
              </div>
            </div>
          </div>
          <button onClick={startBroadcast} disabled={!apiKey} className={`w-full py-6 bg-cyan-600 hover:bg-cyan-400 text-black font-black uppercase tracking-[0.5em] text-xl transition-all shadow-[0_0_30px_rgba(0,255,204,0.3)] flex items-center justify-center gap-4 ${!apiKey ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <Zap className="animate-pulse" /> INITIATE NEURAL UPLINK
          </button>
        </div>

        {/* Fetching Section */}
        <div className={`p-32 flex flex-col items-center justify-center space-y-6 ${!showArchives && state.isFetching ? '' : 'hidden'}`}>
          <RefreshCw className="w-16 h-16 text-cyan-400 animate-spin" />
          <div className="text-center">
            <p className="text-xl font-black orbitron animate-pulse">EXTRACTING DATA FROM THE ETHER...</p>
            <p className="text-[10px] opacity-40 font-mono italic mt-2">"Hacking local networks for the underground report"</p>
          </div>
        </div>

        {/* Broadcasting Section */}
        <div className={`flex flex-col ${!showArchives && state.isBroadcasting ? '' : 'hidden'}`}>
            <div className="p-8 lg:p-14 relative overflow-hidden min-h-[600px] animate-in slide-in-from-bottom duration-700">
              <div className="flex justify-between items-start mb-8">
                <div className={`px-4 py-1 border text-[10px] font-black uppercase tracking-widest ${themeColors} flex items-center gap-2`}>
                   <Activity className="w-3 h-3 animate-pulse" aria-hidden="true" /> PROTOCOL {currentSentiment}
                </div>
                <div className="flex gap-3">
                   <button onClick={handleShare} className="p-2 border border-cyan-900 text-cyan-500 hover:bg-cyan-900/20 transition-all" title="Share Report"><Share2 className="w-5 h-5" /></button>
                   <button onClick={() => setIsAutoMode(!isAutoMode)} className={`p-2 border transition-all ${isAutoMode ? 'bg-yellow-500 text-black' : 'border-cyan-900 text-cyan-800'}`} title="Auto Mode">
                    <Infinity className="w-5 h-5" />
                   </button>
                   <button onClick={() => {
                     const currentNews = state.news[currentNewsIndex];
                     if (currentNews) setSavedStories(prev => [...prev, currentNews]);
                   }} className="p-2 border border-cyan-900 text-cyan-500 hover:bg-cyan-900/20 transition-all" title="Bookmark Report"><Bookmark className="w-5 h-5" /></button>
                   <button onClick={stopEverything} className="p-2 border border-red-900 text-red-500 hover:bg-red-900/20 transition-all"><X className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="space-y-12 relative z-10 pb-32">
                <div className="space-y-4">
                  <span className="text-[10px] font-mono opacity-30 uppercase tracking-[0.3em] block">{state.news[currentNewsIndex]?.timestamp}</span>
                  <h2 className="text-4xl lg:text-7xl font-black uppercase tracking-tighter leading-[0.9] glitch mb-12" style={{ color: primaryHex }} data-text={state.news[currentNewsIndex]?.cyberHeadline}>
                    {state.news[currentNewsIndex]?.cyberHeadline}
                  </h2>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
                  <div className="lg:col-span-3 space-y-32">
                    {currentChunksRef.current.map((chunk, i) => (
                      <div 
                        key={i} 
                        ref={el => paragraphRefs.current[i] = el}
                        data-index={i}
                        className={`paragraph-entry transition-all duration-1000 transform opacity-0 translate-y-10 blur-md`}
                      >
                         <div className="flex items-start gap-4">
                            <span className="text-[10px] font-mono opacity-20 mt-2">0{i+1}</span>
                            <p className="text-xl lg:text-3xl font-light italic leading-relaxed border-l-4 pl-8 mb-8" style={{ borderLeftColor: primaryHex }}>
                              "{chunk}"
                            </p>
                         </div>
                         
                         {i === 0 && (
                           <div className="my-8 ml-8">
                            {storyImages[0] ? (
                              <div className="relative overflow-hidden rounded-lg border border-white/10 shadow-2xl transition-all duration-1000">
                                <img src={storyImages[0]!} alt={`Visual representation of fragment ${i+1}`} className="w-full h-auto object-cover max-h-[500px]" />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60"></div>
                              </div>
                            ) : (
                              <div className="w-full h-64 bg-white/5 border border-dashed border-white/10 rounded-lg flex items-center justify-center gap-4 animate-pulse">
                                <Cpu className="w-8 h-8 text-white/10 animate-spin" />
                                <span className="text-[10px] uppercase tracking-widest text-white/20">Rendering visual from the ether...</span>
                              </div>
                            )}
                           </div>
                         )}
                      </div>
                    ))}
                    <div className="h-40 flex items-center justify-center opacity-20 italic font-mono text-sm">
                        --- END OF VISUAL REPORT ---
                    </div>
                  </div>

                  <div className="space-y-6 font-mono sticky top-32 h-fit">
                    <div className="text-[10px] opacity-40 border-t border-white/10 pt-4 uppercase tracking-widest">Audio Controls</div>
                    <div className="grid grid-cols-2 gap-2">
                        <button 
                            onClick={toggleMusic}
                            className={`flex flex-col items-center justify-center p-4 border transition-all ${isMusicActive ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(0,255,204,0.2)]' : 'border-white/10 text-white/40 hover:border-white/30'}`}
                        >
                            <Music className={`w-6 h-6 mb-2 ${isMusicActive ? 'animate-pulse' : ''}`} />
                            <span className="text-[10px] font-bold">MUSIC</span>
                        </button>
                        <button 
                            onClick={toggleNarration}
                            disabled={isVoiceLoading}
                            className={`relative flex flex-col items-center justify-center p-4 border transition-all ${isNarrationActive ? 'bg-purple-500 text-black border-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'border-white/10 text-white/40 hover:border-white/30'} ${isVoiceLoading ? 'opacity-80 cursor-wait' : ''}`}
                        >
                            {isVoiceLoading ? (
                                <Loader2 className="w-6 h-6 mb-2 animate-spin" />
                            ) : (
                                <Mic className={`w-6 h-6 mb-2 ${isNarrationActive ? 'animate-bounce' : ''}`} />
                            )}
                            <span className="text-[10px] font-bold">{isVoiceLoading ? 'SYNCING' : 'NARRATOR'}</span>
                        </button>
                    </div>

                    <div className="text-[10px] opacity-40 border-t border-white/10 pt-4 uppercase tracking-widest">Verification Sources</div>
                    <div className="text-[11px] leading-tight opacity-60 italic">"{state.news[currentNewsIndex]?.originalHeadline}"</div>
                    <div className="space-y-3">
                      {state.sources.map((s, i) => s.web && (
                        <a key={i} href={s.web.uri} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3 text-[10px] text-cyan-400 hover:text-white transition-colors bg-cyan-950/20 p-3 border border-cyan-400/10 rounded-md">
                          <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" /> 
                          <span className="truncate">{s.web.title}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {isWaitingForNext && (
                <div className="absolute inset-0 z-50 bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
                  <div className="w-32 h-32 rounded-full border-4 border-white/5 flex flex-col items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: `${primaryHex} transparent transparent transparent`, animationDuration: '0.6s' }}></div>
                    <span className="text-4xl font-black orbitron">{countdown}</span>
                  </div>
                  <p className="mt-8 font-black tracking-[1em] text-white opacity-40 uppercase text-xs animate-pulse">Switching underground frequency...</p>
                </div>
              )}
            </div>

            <div className="bg-black/90 border-t border-white/5 sticky bottom-0 z-40 backdrop-blur-md">
              <MusicVisualizer isPlaying={isMusicActive || (isNarrationActive && !isVoiceLoading)} color={isNarrationActive ? '#a855f7' : primaryHex} />
              <div className="p-6 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex items-center gap-8 w-full md:w-auto">
                  <button onClick={handleNext} className="p-6 rounded-full border border-white/10 hover:bg-white/10 transition-all group relative overflow-hidden" aria-label="Next news">
                    <ChevronRight className="w-10 h-10 group-hover:translate-x-2 transition-transform relative z-10" style={{ color: primaryHex }} />
                  </button>
                  <div className="flex flex-col">
                    <div className="text-[10px] font-black uppercase opacity-40 flex items-center gap-2 mb-1">
                       <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" aria-hidden="true"></span> ACTIVE TRANSMISSION 
                       {isAutoMode && <span className="bg-cyan-500 text-black px-2 py-0.5 rounded-[2px] text-[8px] font-bold ml-2">AUTO</span>}
                    </div>
                    <div className="text-2xl lg:text-3xl font-black orbitron uppercase tracking-tighter" style={{ color: primaryHex }}>{state.speaker.name}</div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-3 w-full md:w-auto">
                  <div className="flex items-center gap-4">
                    <span className="text-[11px] font-mono opacity-50 uppercase tracking-widest">Uplink {currentNewsIndex + 1} / {state.news.length}</span>
                    <div className="w-48 lg:w-80 h-3 bg-white/5 rounded-full overflow-hidden border border-white/10" role="progressbar" aria-valuenow={((currentNewsIndex + 1) / state.news.length) * 100} aria-valuemin={0} aria-valuemax={100}>
                      <div className="h-full transition-all duration-1000" style={{ backgroundColor: primaryHex, width: `${((currentNewsIndex + 1) / state.news.length) * 100}%` }}></div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono opacity-30 uppercase">
                    <Navigation className="w-3 h-3" /> NODE: {state.location?.lat.toFixed(4)}x{state.location?.lng.toFixed(4)}
                  </div>
                </div>
              </div>
            </div>
          </div>
      </main>

      {state.error && (
        <div className="mt-8 p-6 bg-red-950/60 border-2 border-red-600 text-red-400 rounded-lg flex items-center gap-6 max-w-xl shadow-[0_0_40px_rgba(239,68,68,0.3)] animate-bounce" role="alert">
          <AlertTriangle className="w-10 h-10 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-black uppercase tracking-widest">UPLINK DISCONNECT</span>
            <span className="text-sm font-mono opacity-80 leading-tight">{state.error}</span>
          </div>
        </div>
      )}
      
      <footer className="mt-16 opacity-20 font-black tracking-[1.5em] text-[10px] uppercase text-center w-full hover:opacity-100 transition-all duration-700 cursor-default">
        UPLINK UNDERGROUND v2.6.2 • KNOWLEDGE IS THE ONLY HACK • CY-2077
      </footer>
    </div>
  );
};

export default App;
