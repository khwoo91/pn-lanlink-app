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
const activeAgents = new Map(); // publicIp -> agentWs

function sendFilteredRoomList(ws) {
  const rooms = Array.from(activeRooms.values());
  const filtered = rooms.filter(room => {
    return room.publicIp === ws.clientPublicIp;
  });

  ws.send(JSON.stringify({
    type: 'room-list-response',
    from: 'server',
    to: 'client',
    rooms: filtered
  }));
}

function broadcastRoomList() {
  for (const client of wss.clients) {
    if (client.readyState === 1 && !client.isAgent) { // OPEN and not an agent
      sendFilteredRoomList(client);
    }
  }
}

function broadcastAgentStatus(publicIp, connected) {
  const payload = JSON.stringify({
    type: 'agent-status',
    from: 'server',
    to: 'client',
    connected: connected
  });
  for (const client of wss.clients) {
    if (client.readyState === 1 && !client.isAgent) {
      if (client.clientPublicIp === publicIp || publicIp === '127.0.0.1' || client.clientPublicIp === '127.0.0.1') {
        client.send(payload);
      }
    }
  }
}

wss.on('connection', (ws, req) => {
  let clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
  if (clientIp.includes(',')) {
    clientIp = clientIp.split(',')[0].trim();
  }
  if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    clientIp = '127.0.0.1';
  }

  ws.clientPublicIp = clientIp;
  ws.isAgent = false;

  // Send initial server info with agent status to host
  const agentExists = activeAgents.has(clientIp);
  ws.send(JSON.stringify({
    type: 'server-info',
    from: 'server',
    to: 'client',
    ip: clientIp,
    agentConnected: agentExists
  }));

  sendFilteredRoomList(ws);

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());

      // 1. Agent Registration from LANLink_Helper.exe
      if (msg.type === 'agent-register') {
        ws.isAgent = true;
        activeAgents.set(ws.clientPublicIp, ws);
        console.log(`🔌 [LANLink Server] Agent registered for IP: ${ws.clientPublicIp}`);
        broadcastAgentStatus(ws.clientPublicIp, true);
      } 
      // 2. Host query agent connection status
      else if (msg.type === 'agent-check') {
        const exists = activeAgents.has(ws.clientPublicIp);
        ws.send(JSON.stringify({
          type: 'agent-status',
          from: 'server',
          to: 'client',
          connected: exists
        }));
      }
      // 3. Relay mouse/keyboard action events to the registered agent
      else if (msg.type === 'agent-control') {
        const agentWs = activeAgents.get(ws.clientPublicIp);
        if (agentWs && agentWs.readyState === 1) {
          agentWs.send(JSON.stringify(msg.control));
        }
      }
      // 4. Room Register & Signaling messages
      else if (msg.type === 'room-register') {
        ws.roomIp = msg.room.ip;
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
        broadcast(msg, ws);
      }
    } catch (e) {
      console.error('Error handling WebSocket message in server:', e);
    }
  });

  ws.on('close', () => {
    if (ws.isAgent) {
      activeAgents.delete(ws.clientPublicIp);
      console.log(`❌ [LANLink Server] Agent disconnected for IP: ${ws.clientPublicIp}`);
      broadcastAgentStatus(ws.clientPublicIp, false);
    }
    if (ws.roomIp) {
      activeRooms.delete(ws.roomIp);
      broadcastRoomList();
    }
  });
});

function broadcast(data, senderWs) {
  const str = JSON.stringify(data);
  const senderIp = senderWs ? senderWs.clientPublicIp : null;
  for (const client of wss.clients) {
    if (client.readyState === 1 && !client.isAgent) {
      if (!senderIp || 
          client.clientPublicIp === senderIp || 
          senderIp === '127.0.0.1' || 
          client.clientPublicIp === '127.0.0.1') {
        client.send(str);
      }
    }
  }
}

server.listen(port, () => {
  console.log(`⚡ [LANLink Signaling Server] Running on port ${port}`);
});
