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

function broadcast(data) {
  const str = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(str);
    }
  }
}

wss.on('connection', (ws) => {
  // Send current active room list to newly connected client
  ws.send(JSON.stringify({
    type: 'room-list-response',
    from: 'server',
    to: 'client',
    rooms: Array.from(activeRooms.values())
  }));

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      if (msg.type === 'room-register') {
        ws.roomIp = msg.room.ip;
        activeRooms.set(msg.room.ip, msg.room);
        broadcast({
          type: 'room-list-response',
          from: 'server',
          to: 'all',
          rooms: Array.from(activeRooms.values())
        });
      } 
      else if (msg.type === 'room-unregister') {
        activeRooms.delete(msg.ip);
        ws.roomIp = undefined;
        broadcast({
          type: 'room-list-response',
          from: 'server',
          to: 'all',
          rooms: Array.from(activeRooms.values())
        });
      }
      else if (msg.type === 'room-list-request') {
        ws.send(JSON.stringify({
          type: 'room-list-response',
          from: 'server',
          to: 'client',
          rooms: Array.from(activeRooms.values())
        }));
      }
      else {
        // Forward WebRTC signaling (offers, answers, candidates, joins, leaves)
        broadcast(msg);
      }
    } catch (e) {
      console.error('Error handling WebSocket message in server:', e);
    }
  });

  ws.on('close', () => {
    if (ws.roomIp) {
      activeRooms.delete(ws.roomIp);
      broadcast({
        type: 'room-list-response',
        from: 'server',
        to: 'all',
        rooms: Array.from(activeRooms.values())
      });
    }
  });
});

server.listen(port, () => {
  console.log(`⚡ [LANLink Signaling Server] Running on port ${port}`);
});
