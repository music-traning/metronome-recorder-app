import React, { useState, useRef, useEffect, useCallback } from 'react';
import Waveform from './components/Waveform';
import { PlayIcon, PauseIcon, MicIcon, StopIcon, DownloadIcon } from './components/Icons';

const PRESET_PATTERNS: Record<string, boolean[]> = {
  'standard': Array(16).fill(true),
  'backbeat': Array(4).fill([false, true, false, true]).flat(),
  'gallop': Array(4).fill([true, true, false, true]).flat(),
  'tresillo': Array(2).fill([true, false, false, true, false, true, false, false]).flat(),
  'sonClave': [true, false, false, true, false, true, false, false, false, true, true, false, false, true, false, false],
};

const PRESET_LABELS: Record<string, string> = {
  standard: 'Standard 4/4',
  backbeat: 'Jazz Swing (Backbeat)',
  gallop: 'Metal (Gallop)',
  tresillo: 'Latin (Tresillo)',
  sonClave: 'Latin (Son Clave 3-2)',
};

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export default function App() {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isCountingIn, setIsCountingIn] = useState<boolean>(false);
  const [tempo, setTempo] = useState<number>(120);
  const [volume, setVolume] = useState<number>(0.5);
  const [currentPreset, setCurrentPreset] = useState<string>('standard');
  const [clickPattern, setClickPattern] = useState<boolean[]>(PRESET_PATTERNS.standard);
  const [currentBeat, setCurrentBeat] = useState<number>(-1);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<{ url: string; type: string } | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const schedulerIntervalRef = useRef<number | null>(null);
  const nextNoteTimeRef = useRef<number>(0);
  const currentBeatRef = useRef<number>(0);
  const visualTimeoutIdsRef = useRef<Set<number>>(new Set());
  const isCountingInRef = useRef(isCountingIn);

  useEffect(() => {
    isCountingInRef.current = isCountingIn;
  }, [isCountingIn]);

  const prevIsPlaying = usePrevious(isPlaying);

  const playClick = useCallback((beat: number, time: number) => {
    if (!audioContextRef.current) return;
    const context = audioContextRef.current;
    
    if (context.state === 'suspended') {
      context.resume();
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    oscillator.frequency.setValueAtTime(beat % 4 === 0 ? 880 : 660, time);
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0, time);
    gainNode.gain.linearRampToValueAtTime(volume, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

    oscillator.start(time);
    oscillator.stop(time + 0.08);
  }, [volume]);

  useEffect(() => {
    const clearVisualTimeouts = () => {
      visualTimeoutIdsRef.current.forEach(id => clearTimeout(id));
      visualTimeoutIdsRef.current.clear();
    };

    if (!isPlaying) {
      if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
      clearVisualTimeouts();
      setCurrentBeat(-1);
      setIsCountingIn(false);
      return;
    }
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume();
    }

    const justStarted = !prevIsPlaying && isPlaying;

    if (justStarted) {
      currentBeatRef.current = -4; // Start with a 4-beat count-in.
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.1;
      setIsCountingIn(true);
    } else if (isPlaying) { // Tempo or pattern change while playing
      currentBeatRef.current = 0;
      nextNoteTimeRef.current = audioContextRef.current.currentTime + 0.1;
      setIsCountingIn(false);
    }

    const scheduleAheadTime = 0.1;
    const schedulerLookahead = 25.0;

    const scheduler = () => {
      const context = audioContextRef.current!;
      while (nextNoteTimeRef.current < context.currentTime + scheduleAheadTime) {
        const beat = currentBeatRef.current;
        const time = nextNoteTimeRef.current;
        
        const isCountInBeat = beat < 0;
        const visualBeat = isCountInBeat ? beat + 4 : beat;

        if (isCountInBeat) {
          playClick(visualBeat, time);
        } else {
          if (beat === 0 && isCountingInRef.current) {
            const delay = (time - context.currentTime) * 1000;
            setTimeout(() => setIsCountingIn(false), delay > 0 ? delay : 0);
          }
          if (clickPattern[beat]) {
            playClick(beat, time);
          }
        }
        
        const delay = (time - context.currentTime) * 1000;
        const timeoutId = window.setTimeout(() => {
          setCurrentBeat(visualBeat);
          visualTimeoutIdsRef.current.delete(timeoutId);
        }, delay > 0 ? delay : 0);
        visualTimeoutIdsRef.current.add(timeoutId);

        const secondsPerBeat = 60.0 / tempo;
        nextNoteTimeRef.current += secondsPerBeat;
        currentBeatRef.current++;
        if (currentBeatRef.current >= 16) {
          currentBeatRef.current = 0;
        }
      }
    };

    if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
    scheduler();
    schedulerIntervalRef.current = window.setInterval(scheduler, schedulerLookahead);

    return () => {
      if (schedulerIntervalRef.current) clearInterval(schedulerIntervalRef.current);
      clearVisualTimeouts();
    };
  }, [isPlaying, tempo, clickPattern, playClick]);

  useEffect(() => {
    const startRecording = async () => {
      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
        
        if (!audioContextRef.current) {
           audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        await audioContextRef.current.resume();

        const source = audioContextRef.current.createMediaStreamSource(stream);
        const analyser = audioContextRef.current.createAnalyser();
        source.connect(analyser);
        setAnalyserNode(analyser);
        
        const supportedMimeTypes = [
            'audio/mp4', // Preferred for iOS/Safari
            'audio/webm;codecs=opus', // High quality for Chrome/Firefox
            'audio/webm', // Fallback
        ];
        const supportedType = supportedMimeTypes.find(type => MediaRecorder.isTypeSupported(type));

        if (!supportedType) {
            setRecordingError('お使いのブラウザは、サポートされている形式での録音に対応していません。');
            console.error("No supported MIME type for MediaRecorder found.");
            setIsRecording(false);
            stream.getTracks().forEach(track => track.stop());
            setAnalyserNode(null);
            return;
        }

        const options = { mimeType: supportedType };
        mediaRecorderRef.current = new MediaRecorder(stream, options);
        recordedChunksRef.current = [];
        
        mediaRecorderRef.current.ondataavailable = (event) => {
            if(event.data.size > 0) {
                recordedChunksRef.current.push(event.data);
            }
        };
        
        mediaRecorderRef.current.onstop = () => {
            if (recordedChunksRef.current.length === 0) {
                return;
            }
            const mimeType = mediaRecorderRef.current?.mimeType || supportedType;
            const audioBlob = new Blob(recordedChunksRef.current, { type: mimeType });
            const url = URL.createObjectURL(audioBlob);
            
            setRecordedAudio({ url, type: audioBlob.type });
            setRecordingError(null);
            recordedChunksRef.current = [];
        };

        mediaRecorderRef.current.onerror = (event) => {
          const errorMessage = (event as any).error?.message || '不明なエラー';
          console.error('MediaRecorder error:', event);
          setRecordingError(`録音中にエラーが発生しました: ${errorMessage}`);
          setIsRecording(false);
        };
        
        mediaRecorderRef.current.start();

      } catch (err) {
        console.error("マイクへのアクセスエラー:", err);
        setRecordingError("マイクへのアクセスが拒否されました。");
        setIsRecording(false);
      }
    };

    const stopRecording = () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setAnalyserNode(null);
    };

    if (isRecording) {
      startRecording();
    } else {
      stopRecording();
    }
    
    return () => {
        stopRecording();
    };
  }, [isRecording]);

  const handlePlayStop = () => setIsPlaying(current => !current);
  const handleTempoChange = (e: React.ChangeEvent<HTMLInputElement>) => setTempo(Number(e.target.value));
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => setVolume(Number(e.target.value));
  
  const handlePatternToggle = (index: number) => {
    const newPattern = [...clickPattern];
    newPattern[index] = !newPattern[index];
    setClickPattern(newPattern);
    setCurrentPreset('custom');
  };
  
  const handleRecordToggle = () => {
      setRecordingError(null);
      if (!isRecording && recordedAudio) {
        URL.revokeObjectURL(recordedAudio.url);
        setRecordedAudio(null);
      }
      setIsRecording(!isRecording)
  };

  const handlePresetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const presetKey = e.target.value;
    if (presetKey in PRESET_PATTERNS) {
      setClickPattern(PRESET_PATTERNS[presetKey]);
      setCurrentPreset(presetKey);
    }
  };

  const handleSaveRecording = async () => {
    if (!recordedAudio) return;
    
    const extension = recordedAudio.type.includes('mp4') ? 'mp4' : 'webm';
    const mimeType = recordedAudio.type.includes('mp4') ? 'audio/mp4' : 'audio/webm';
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
    const filename = `metronome-recording_${timestamp}.${extension}`;

    try {
      const response = await fetch(recordedAudio.url);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: mimeType });

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '録音を保存',
          text: filename,
        });
      } else {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
      }
    } catch (err) {
      if ((err as DOMException).name === 'AbortError') {
        console.log('共有がキャンセルされました。');
      } else {
        console.error("録音の保存/共有に失敗しました:", err);
        setRecordingError("録音の保存に失敗しました。");
      }
    }
  };

  const playButtonLabel = !isPlaying ? '再生' : (isCountingIn ? '開始中...' : '停止');

  return (
    <div className="bg-slate-900 text-slate-200 min-h-screen flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-800 rounded-2xl shadow-2xl p-6 space-y-6 border border-slate-700">
        <h1 className="text-3xl font-bold text-center text-cyan-400">メトロノーム＆レコーダー</h1>
        
        <div className="bg-slate-900 rounded-lg p-2 h-[120px] flex items-center justify-center">
            <Waveform analyserNode={analyserNode} />
        </div>

        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-700/50 rounded-lg">
          {Array.from({ length: 16 }).map((_, beat) => (
             <div className="flex justify-center items-center" key={beat}>
                <div
                className={`w-5 h-5 rounded-full transition-all duration-100 ${
                    currentBeat === beat ? 'bg-cyan-400 scale-110 shadow-lg shadow-cyan-400/50' : 'bg-slate-600'
                }`}
                />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="tempo" className="font-medium text-slate-300">テンポ</label>
            <span className="text-2xl font-bold text-white tabular-nums">{tempo} BPM</span>
          </div>
          <input
            type="range"
            id="tempo"
            min="40"
            max="240"
            value={tempo}
            onChange={handleTempoChange}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <label htmlFor="presets" className="font-medium text-slate-300">クリックパターン</label>
                <select 
                    id="presets" 
                    value={currentPreset}
                    onChange={handlePresetChange}
                    className="bg-slate-700 border border-slate-600 text-slate-200 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2"
                >
                    <option value="custom" disabled>カスタム</option>
                    {Object.entries(PRESET_LABELS).map(([key, label]) => (
                        <option key={key} value={key}>{label}</option>
                    ))}
                </select>
            </div>
            <div className="grid grid-cols-4 gap-2 bg-slate-700/50 p-3 rounded-lg">
                {clickPattern.map((isActive, index) => (
                    <button
                        key={index}
                        onClick={() => handlePatternToggle(index)}
                        className={`w-full aspect-square rounded-lg flex items-center justify-center font-bold text-lg transition-all duration-200 ease-in-out transform hover:scale-105 ${
                            isActive ? 'bg-cyan-500 text-slate-900 shadow-md' : 'border-2 border-slate-500 text-slate-500 hover:bg-slate-600'
                        }`}
                        aria-pressed={isActive}
                    >
                        {index + 1}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="flex items-center gap-4">
            <button
              onClick={handlePlayStop}
              className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors"
              aria-label={playButtonLabel}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
              <span>{playButtonLabel}</span>
            </button>
            <button
              onClick={handleRecordToggle}
              className={`flex-1 font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                  isRecording ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-slate-600 hover:bg-slate-500 text-slate-200'
              }`}
               aria-label={isRecording ? '録音停止' : '録音開始'}
            >
              {isRecording ? <StopIcon /> : <MicIcon />}
              <span>{isRecording ? '録音停止' : '録音'}</span>
            </button>
        </div>

        {isRecording && (
          <div className="text-center text-sm text-slate-400 mt-3 p-3 bg-slate-700/50 rounded-lg">
            <p>🎧 よりクリアな録音のために、ヘッドホンの使用をお勧めします。</p>
          </div>
        )}

        {recordingError && (
          <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg my-4 text-sm" role="alert">
            <p className="font-bold">エラー</p>
            <p>{recordingError}</p>
          </div>
        )}

        {recordedAudio && !recordingError && (
          <div className="space-y-2 pt-2">
            <label className="font-medium text-slate-300">録音の再生</label>
            <div className="flex items-center gap-3">
              <audio
                controls
                src={recordedAudio.url}
                className="w-full flex-grow"
                onError={() => {
                  setRecordingError('録音の再生に失敗しました。ファイルは保存可能ですが、このブラウザでは再生できない可能性があります。');
                }}
              ></audio>
              <button
                onClick={handleSaveRecording}
                className="shrink-0 bg-slate-600 hover:bg-slate-500 text-slate-200 font-bold p-3 rounded-lg flex items-center justify-center transition-colors"
                aria-label="録音を保存"
                title="録音を保存"
              >
                <DownloadIcon />
              </button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="volume" className="font-medium text-slate-300">クリック音量</label>
          <input
            type="range"
            id="volume"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={handleVolumeChange}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
          />
        </div>

      </div>
    </div>
  );
}
