"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export interface UseVideoRecorderOptions {
  maxDurationSeconds?: number;
  /** Called when recording stops unexpectedly (e.g. phone call interruption) */
  onInterrupted?: () => void;
}

export interface UseVideoRecorderReturn {
  /** The camera+mic stream (set when recording or idle-with-permission) */
  stream: MediaStream | null;
  /** Whether recording is in progress */
  isRecording: boolean;
  /** Elapsed recording time in seconds */
  elapsedSeconds: number;
  /** The recorded video blob (available after stop) */
  blob: Blob | null;
  /** The blob's object URL for preview */
  previewUrl: string | null;
  /** MIME type used for recording */
  mimeType: string | null;
  /** Error message if something went wrong */
  error: string | null;
  /** Request camera+mic access and start recording */
  start: () => Promise<void>;
  /** Stop the current recording */
  stop: () => void;
  /** Discard the recording and reset state */
  discard: () => void;
  /** Release camera stream entirely */
  cleanup: () => void;
}

const MAX_DURATION_DEFAULT = 90; // seconds

/**
 * Detect the best supported MIME type for MediaRecorder.
 * Safari prefers MP4, Chrome/Firefox prefer WebM.
 */
function detectMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  const candidates = [
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=vp8",
    "video/webm",
    "video/mp4",
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }

  return null;
}

/**
 * Hook for recording video using the browser's MediaRecorder API.
 * Manages stream, recording state, timer, and blob output.
 */
export function useVideoRecorder(
  options?: UseVideoRecorderOptions
): UseVideoRecorderReturn {
  const maxDuration = options?.maxDurationSeconds ?? MAX_DURATION_DEFAULT;
  const onInterrupted = options?.onInterrupted;

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intentionalStopRef = useRef(false);

  // Cleanup timer
  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Stop all stream tracks
  const stopStreamTracks = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Full cleanup
  const cleanup = useCallback(() => {
    clearTimer();
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setBlob(null);
    setPreviewUrl(null);
    setIsRecording(false);
    setElapsedSeconds(0);
    setError(null);
  }, [clearTimer, stopStreamTracks, previewUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
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
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setElapsedSeconds(0);
    chunksRef.current = [];

    // Check for MediaRecorder support
    if (typeof MediaRecorder === "undefined") {
      setError(
        "Video-Aufnahme nicht verfuegbar in diesem Browser. Bitte lade ein Video aus der Galerie hoch."
      );
      return;
    }

    const detectedMime = detectMimeType();
    if (!detectedMime) {
      setError(
        "Video-Aufnahme nicht verfuegbar in diesem Browser. Bitte lade ein Video aus der Galerie hoch."
      );
      return;
    }
    setMimeType(detectedMime);

    // Request camera + mic
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: true,
      });
      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Create MediaRecorder
      const recorder = new MediaRecorder(mediaStream, {
        mimeType: detectedMime,
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        clearTimer();
        setIsRecording(false);

        const recordedBlob = new Blob(chunksRef.current, {
          type: detectedMime,
        });
        setBlob(recordedBlob);
        const url = URL.createObjectURL(recordedBlob);
        setPreviewUrl(url);

        // Stop camera after recording ends
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          setStream(null);
        }

        // Notify if stop was unexpected (e.g. phone call, browser interruption)
        if (!intentionalStopRef.current && onInterrupted) {
          onInterrupted();
        }
        intentionalStopRef.current = false;
      };

      recorder.onerror = () => {
        clearTimer();
        setIsRecording(false);
        setError("Aufnahme-Fehler. Moeglicherweise ist der Geratespeicher voll.");
        stopStreamTracks();
      };

      // Start recording
      intentionalStopRef.current = false;
      recorder.start(1000); // collect data every 1s
      setIsRecording(true);

      // Timer
      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setElapsedSeconds(seconds);

        if (seconds >= maxDuration) {
          clearTimer();
          intentionalStopRef.current = true;
          if (
            recorderRef.current &&
            recorderRef.current.state === "recording"
          ) {
            recorderRef.current.stop();
          }
        }
      }, 1000);
    } catch (err) {
      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setError(
            "Kamera-Zugriff benoetigt. Bitte erlaube den Zugriff in den Browser-Einstellungen."
          );
        } else if (err.name === "NotFoundError") {
          setError(
            "Keine Kamera gefunden. Bitte stelle sicher, dass eine Kamera angeschlossen ist."
          );
        } else if (err.name === "NotReadableError") {
          setError(
            "Kamera wird von einer anderen App verwendet. Bitte schliesse andere Apps und versuche es erneut."
          );
        } else {
          setError(`Kamera-Fehler: ${err.message}`);
        }
      } else {
        setError("Kamera konnte nicht gestartet werden.");
      }
      stopStreamTracks();
    }
  }, [maxDuration, clearTimer, stopStreamTracks, previewUrl, onInterrupted]);

  const stop = useCallback(() => {
    clearTimer();
    intentionalStopRef.current = true;
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
  }, [clearTimer]);

  const discard = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setBlob(null);
    setPreviewUrl(null);
    setElapsedSeconds(0);
    setError(null);
    chunksRef.current = [];
  }, [previewUrl]);

  return {
    stream,
    isRecording,
    elapsedSeconds,
    blob,
    previewUrl,
    mimeType,
    error,
    start,
    stop,
    discard,
    cleanup,
  };
}
