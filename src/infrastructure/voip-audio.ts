/**
 * VoIP Audio handling and microphone mute/unmute control.
 */
export async function captureMicrophone(): Promise<MediaStream | null> {
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      return await navigator.mediaDevices.getUserMedia({ audio: true });
    }
  } catch (err) {
    console.warn("Microphone capture failed: ", err);
  }
  return null;
}

export function setStreamAudioEnabled(stream: MediaStream | null, enabled: boolean): void {
  if (stream) {
    stream.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
  }
}
