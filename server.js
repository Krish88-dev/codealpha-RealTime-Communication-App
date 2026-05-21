const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Map to track which room and user ID a socket is associated with
const socketDataMap = new Map();

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // Join a room
  socket.on('join-room', (roomId, userId) => {
    // Leave previous room if remounting
    const prevData = socketDataMap.get(socket.id);
    if (prevData && prevData.roomId) {
      socket.leave(prevData.roomId);
    }
    
    socket.join(roomId);
    socketDataMap.set(socket.id, { roomId, userId });
    
    console.log(`User ${userId} joined room ${roomId}`);
    
    // Broadcast to everyone else in the room
    socket.to(roomId).emit('user-connected', userId);
  });

  // Handle incoming WebRTC signaling data
  socket.on('signal', (data) => {
    // Send it specifically to the target user
    io.to(data.userToSignal).emit('signal', {
      signal: data.signal,
      callerID: data.callerID
    });
  });

  // Handle whiteboard drawing
  socket.on('whiteboard-draw', (data) => {
    const sData = socketDataMap.get(socket.id);
    if (sData) socket.to(sData.roomId).emit('whiteboard-draw', data);
  });

  // Handle chat messages
  socket.on('chat-message', (data) => {
    const sData = socketDataMap.get(socket.id);
    if (sData) socket.to(sData.roomId).emit('chat-message', data);
  });

  // Handle user media state changes (mute/video off)
  socket.on('user-state-change', (data) => {
    const sData = socketDataMap.get(socket.id);
    if (sData) socket.to(sData.roomId).emit('user-state-change', data);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    const sData = socketDataMap.get(socket.id);
    if (sData) {
      console.log(`User disconnected: ${socket.id}, (UserId: ${sData.userId})`);
      socket.to(sData.roomId).emit('user-disconnected', sData.userId);
      socketDataMap.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
