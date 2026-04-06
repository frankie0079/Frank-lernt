"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// --- Web Speech API typings (not in standard lib.dom) ---
interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export interface UseAudioRecorderOptions {
  maxDurationSeconds?: number;
  onInterrupted?: () => void;
  onSilenceDetected?: () => void;
}

export interface UseAudioRecorderReturn {
  isRecording: boolean;
  elapsedSeconds: number;
  blob: Blob | null;
  previewUrl: string | null;
  mimeType: string | null;
  /** Live + final transcript text */
  transcript: string;
  /** Whether Web Speech API is available */
  speechSupported: boolean;
  /** Latest amplitude data (Uint8Array, time-domain) for waveform rendering */
  amplitudeData: Uint8Array | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  discard: () => void;
  /** Manually override the transcript (after user edits) */
  setTranscript: (text: string) => void;
  cleanup: () => void;
}

const MAX_DURATION_DEFAULT = 180; // 3 minutes

function detectAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/**
 * Hook for audio recording with live waveform + Web Speech API transcription.
 */
export function useAudioRecorder(
  options?: UseAudioRecorderOptions
): UseAudioRecorderReturn {
  const maxDuration = options?.maxDurationSeconds ?? MAX_DURATION_DEFAULT;
  const onInterrupted = options?.onInterrupted;
  const onSilenceDetected = options?.onSilenceDetected;

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [transcript, setTranscriptState] = useState("");
  const [amplitudeData, setAmplitudeData] = useState<Uint8Array | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // BUG-4 fix: mirror previewUrl in a ref so cleanup() is a stable callback
  // (otherwise cleanup is recreated on every URL change, invalidating start()'s
  // captured reference mid-recording).
  const previewUrlRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const finalTranscriptRef = useRef("");
  const intentionalStopRef = useRef(false);
  const silenceFramesRef = useRef(0);
  const silenceNotifiedRef = useRef(false);

  const speechSupported = typeof window !== "undefined" && !!getSpeechRecognitionCtor();

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAnalyser = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
    }
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const stopStreamTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }, []);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    }
  }, []);

  const cleanup = useCallback(() => {
    clearTimer();
    stopAnalyser();
    stopRecognition();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        // ignore
      }
    }
    recorderRef.current = null;
    chunksRef.current = [];
    stopStreamTracks();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setBlob(null);
    setPreviewUrl(null);
    setIsRecording(false);
    setElapsedSeconds(0);
    setTranscriptState("");
    finalTranscriptRef.current = "";
    setAmplitudeData(null);
    setError(null);
  }, [clearTimer, stopAnalyser, stopRecognition, stopStreamTracks]);

  useEffect(() => {
    return () => {
      clearTimer();
      stopAnalyser();
      stopRecognition();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setBlob(null);
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }
    setElapsedSeconds(0);
    setTranscriptState("");
    finalTranscriptRef.current = "";
    silenceFramesRef.current = 0;
    silenceNotifiedRef.current = false;
    chunksRef.current = [];

    if (typeof MediaRecorder === "undefined") {
      setError(
        "Audio-Aufnahme nicht verfuegbar in diesem Browser."
      );
      return;
    }

    const detectedMime = detectAudioMimeType();
    if (!detectedMime) {
      setError(
        "Audio-Aufnahme nicht verfuegbar in diesem Browser."
      );
      return;
    }
    setMimeType(detectedMime);

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      streamRef.current = mediaStream;

      // --- Set up Web Audio API analyser for waveform + silence detection ---
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(mediaStream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyserRef.current = analyser;

        const buffer = new Uint8Array(analyser.frequencyBinCount);
        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteTimeDomainData(buffer);
          // Copy because React only re-renders on new reference
          setAmplitudeData(new Uint8Array(buffer));

          // Silence detection: amplitude near 128 means flat line
          let max = 0;
          for (let i = 0; i < buffer.length; i++) {
            const dev = Math.abs(buffer[i] - 128);
            if (dev > max) max = dev;
          }
          if (max < 4) {
            silenceFramesRef.current += 1;
          } else {
            silenceFramesRef.current = 0;
          }
          // ~60fps -> 5 seconds = 300 frames
          if (
            !silenceNotifiedRef.current &&
            silenceFramesRef.current > 300 &&
            onSilenceDetected
          ) {
            silenceNotifiedRef.current = true;
            onSilenceDetected();
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // analyser is non-critical
      }

      // --- MediaRecorder ---
      const recorder = new MediaRecorder(mediaStream, { mimeType: detectedMime });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        clearTimer();
        stopAnalyser();
        stopRecognition();
        setIsRecording(false);

        const recordedBlob = new Blob(chunksRef.current, { type: detectedMime });
        setBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        previewUrlRef.current = url;
        setPreviewUrl(url);

        stopStreamTracks();

        if (!intentionalStopRef.current && onInterrupted) {
          onInterrupted();
        }
        intentionalStopRef.current = false;
      };

      recorder.onerror = () => {
        clearTimer();
        stopAnalyser();
        stopRecognition();
        setIsRecording(false);
        setError("Aufnahme-Fehler.");
        stopStreamTracks();
      };

      // --- Web Speech API ---
      const SR = getSpeechRecognitionCtor();
      if (SR) {
        try {
          const recognition = new SR();
          recognition.lang = "de-DE";
          recognition.interimResults = true;
          recognition.continuous = true;
          recognition.onresult = (event: SpeechRecognitionEventLike) => {
            let interim = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
              const result = event.results[i];
              const text = result[0].transcript;
              if (result.isFinal) {
                finalTranscriptRef.current += text + " ";
              } else {
                interim += text;
              }
            }
            setTranscriptState(
              (finalTranscriptRef.current + interim).trimStart()
            );
          };
          recognition.onerror = () => {
            // Silent fail — user can still record + edit manually
          };
          recognition.onend = () => {
            // Auto-restart if still recording (continuous can pause)
            if (recorderRef.current?.state === "recording" && recognitionRef.current) {
              try {
                recognitionRef.current.start();
              } catch {
                // ignore
              }
            }
          };
          recognitionRef.current = recognition;
          recognition.start();
        } catch {
          // ignore — recording still works
        }
      }

      intentionalStopRef.current = false;
      recorder.start(1000);
      setIsRecording(true);

      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setElapsedSeconds(seconds);
        if (seconds >= maxDuration) {
          clearTimer();
          intentionalStopRef.current = true;
          if (recorderRef.current && recorderRef.current.state === "recording") {
            recorderRef.current.stop();
          }
        }
      }, 1000);
    } catch (err) {
      stopAnalyser();
      stopStreamTracks();
      if (err instanceof DOMException) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError(
            "Mikrofon-Zugriff benoetigt. Bitte erlaube den Zugriff in den Browser-Einstellungen."
          );
        } else if (err.name === "NotFoundError") {
          setError("Kein Mikrofon gefunden.");
        } else if (err.name === "NotReadableError") {
          setError("Mikrofon wird von einer anderen App verwendet.");
        } else {
          setError(`Mikrofon-Fehler: ${err.message}`);
        }
      } else {
        setError("Mikrofon konnte nicht gestartet werden.");
      }
    }
  }, [
    maxDuration,
    clearTimer,
    stopAnalyser,
    stopRecognition,
    stopStreamTracks,
    onInterrupted,
    onSilenceDetected,
  ]);

  const stop = useCallback(() => {
    clearTimer();
    intentionalStopRef.current = true;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, [clearTimer]);

  const discard = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setBlob(null);
    setPreviewUrl(null);
    setElapsedSeconds(0);
    setTranscriptState("");
    finalTranscriptRef.current = "";
    setAmplitudeData(null);
    setError(null);
    chunksRef.current = [];
  }, []);

  const setTranscript = useCallback((text: string) => {
    finalTranscriptRef.current = text;
    setTranscriptState(text);
  }, []);

  return {
    isRecording,
    elapsedSeconds,
    blob,
    previewUrl,
    mimeType,
    transcript,
    speechSupported,
    amplitudeData,
    error,
    start,
    stop,
    discard,
    setTranscript,
    cleanup,
  };
}
