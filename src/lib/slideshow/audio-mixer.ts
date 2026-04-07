// PROJ-34: Audio mixer for slideshow rendering.
//
// MediaRecorder needs a single MediaStream containing both video (canvas) and
// audio (music) tracks. AudioContext cannot run inside a Worker, so we mix on
// the main thread and pass the combined stream to MediaRecorder.

export interface AudioMixerHandle {
  audio: HTMLAudioElement;
  audioStream: MediaStream;
  context: AudioContext;
  destroy: () => void;
}

export async function createAudioMixer(trackUrl: string): Promise<AudioMixerHandle> {
  const audio = new Audio();
  audio.crossOrigin = "anonymous";
  audio.src = trackUrl;
  audio.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    audio.addEventListener("canplaythrough", () => resolve(), { once: true });
    audio.addEventListener("error", () => reject(new Error("Music load failed")), { once: true });
    audio.load();
  });

  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const context = new AudioCtx();
  const source = context.createMediaElementSource(audio);
  const dest = context.createMediaStreamDestination();
  source.connect(dest);
  // Also connect to speakers so the user can preview if needed (but we mute
  // by default during rendering — caller can unmute).
  source.connect(context.destination);
  audio.muted = true;

  return {
    audio,
    audioStream: dest.stream,
    context,
    destroy: () => {
      try {
        audio.pause();
        audio.src = "";
      } catch {
        /* ignore */
      }
      try {
        context.close();
      } catch {
        /* ignore */
      }
    },
  };
}

export function combineStreams(videoStream: MediaStream, audioStream: MediaStream | null): MediaStream {
  const tracks = [...videoStream.getVideoTracks()];
  if (audioStream) tracks.push(...audioStream.getAudioTracks());
  return new MediaStream(tracks);
}
