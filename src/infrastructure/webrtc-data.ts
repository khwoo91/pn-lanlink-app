export interface ChatMessagePacket {
  sender: string;
  content: string;
  timestamp: number;
}

/**
 * Sends a message object over WebRTC RTCDataChannel.
 */
export function sendDataChannelMessage(dataChannel: RTCDataChannel | null, packet: ChatMessagePacket): boolean {
  if (dataChannel && dataChannel.readyState === 'open') {
    try {
      dataChannel.send(JSON.stringify(packet));
      return true;
    } catch (e) {
      console.error("Failed to send packet over RTCDataChannel:", e);
    }
  }
  return false;
}
