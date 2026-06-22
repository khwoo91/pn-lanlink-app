import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

const app = express();
const port = process.env.PORT || 10000;

// HTTP Health Check Endpoint for Render.com
app.get('/', (req, res) => {
  res.send('LANLink Signaling Server is running smoothly.');
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

const activeRooms = new Map(); // ip -> room

// 공인 IP 매칭에 따른 대기방 목록 필터링 전송 (데모/테스트 편의성을 위해 필터링을 비활성화하고 전체 목록 전송)
function sendFilteredRoomList(ws) {
  const rooms = Array.from(activeRooms.values());
  const filtered = rooms; // 전체 목록 반환

  ws.send(JSON.stringify({
    type: 'room-list-response',
    from: 'server',
    to: 'client',
    rooms: filtered
  }));
}

// 모든 접속 중인 클라이언트별 맞춤형 목록 브로드캐스트
function broadcastRoomList() {
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      sendFilteredRoomList(client);
    }
  }
}

wss.on('connection', (ws, req) => {
  // 클라이언트의 공인 IP 추출
  let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }
  // IPv6 로컬 주소들을 IPv4 루프백으로 일치
  if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    clientIp = '127.0.0.1';
  }

  ws.clientPublicIp = clientIp;

  // 1. 최초 연결 시 클라이언트에게 공인 IP 정보를 전송 (client의 serverDetectedIp 획득용)
  ws.send(JSON.stringify({
    type: 'server-info',
    from: 'server',
    to: 'client',
    ip: clientIp
  }));

  // 2. 최초 연결 시 대기방 목록 송신
  sendFilteredRoomList(ws);

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === 'room-register') {
        ws.roomIp = msg.room.ip;
        // 방 등록 정보에 호스트의 공인 IP 속성 부여
        msg.room.publicIp = ws.clientPublicIp;
        activeRooms.set(msg.room.ip, msg.room);
        broadcastRoomList();
      } 
      else if (msg.type === 'room-unregister') {
        const targetIp = msg.ip || ws.roomIp;
        if (targetIp) {
          activeRooms.delete(targetIp);
        }
        ws.roomIp = undefined;
        broadcastRoomList();
      }
      else if (msg.type === 'room-list-request') {
        sendFilteredRoomList(ws);
      }
      else {
        // WebRTC 시그널링 교환 패킷 중계
        broadcast(msg);
      }
    } catch (e) {
      console.error('Error handling WebSocket message in server:', e);
    }
  });

  ws.on('close', () => {
    if (ws.roomIp) {
      activeRooms.delete(ws.roomIp);
      broadcastRoomList();
    }
  });
});

// 시그널링 교환용 기본 브로드캐스트
function broadcast(data) {
  const str = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(str);
    }
  }
}

server.listen(port, () => {
  console.log(`⚡ [LANLink Signaling Server] Running on port ${port}`);
});
