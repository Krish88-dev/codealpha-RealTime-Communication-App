import React, { useState } from 'react';
import VideoConference from './components/VideoConference';
import { Video, Users } from 'lucide-react';

function App() {
  const [inRoom, setInRoom] = useState(false);
  const [userName, setUserName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    if (userName.trim() && roomId.trim()) {
      setInRoom(true);
    }
  };

  const handleCreateRoom = () => {
    if (!userName.trim()) {
      alert("Please enter your name first!");
      return;
    }
    const newRoomId = Math.random().toString(36).substring(2, 9);
    setRoomId(newRoomId);
    setInRoom(true);
  };

  if (inRoom) {
    return (
      <VideoConference
        userName={userName}
        roomId={roomId}
        onLeave={() => setInRoom(false)}
      />
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md p-8 rounded-2xl bg-surface shadow-2xl border border-slate-700">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">ConnectLive</h1>
          <p className="text-slate-400 text-center">Collaborate in real-time with video and whiteboard</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Your Name</label>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                required
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                placeholder="Enter your name"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Room ID</label>
            <input
              type="text"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
              placeholder="Enter Room ID to join"
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={!userName.trim() || !roomId.trim()}
              className="w-full py-3 px-4 bg-primary hover:bg-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex justify-center items-center"
            >
              Join Room
            </button>
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm">OR</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>
            <button
              type="button"
              onClick={handleCreateRoom}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-lg border border-slate-700 transition-colors"
            >
              Create New Room
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
