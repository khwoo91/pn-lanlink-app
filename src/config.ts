// LANLink Signaling Server Configuration
// 로컬 테스트 시: 'ws://localhost:5173/pn-lanlink-app/signaling'
// Render.com 등 무료 클라우드 배포 시: 'wss://your-app.onrender.com'

const getSignalingUrl = (): string => {
  const hostname = window.location.hostname;
  const isLocal =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    window.location.port !== "";

  if (isLocal) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/pn-lanlink-app/signaling`;
  }
  return "wss://lanlink.onrender.com";
};

export const SIGNALING_URL = getSignalingUrl();

// WebRTC ICE Servers Configuration (STUN / TURN)
export const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
  { urls: "stun:stun.nextcloud.com:443" }, // 방화벽 대비 443 포트 STUN 서버 추가
  // 사외 접속 또는 방화벽 NAT 통과가 필요할 경우 아래에 TURN 서버 정보를 입력하세요.
  // {
  //   urls: 'turn:your-turn-server.com:3478',
  //   username: 'username',
  //   credential: 'password'
  // }
];
