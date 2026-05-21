import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Mic, MicOff, Video as VideoIcon, VideoOff, MonitorUp, MonitorOff, PenTool, PhoneOff, MessageSquare, Circle, Square } from 'lucide-react';
import VideoGrid from './VideoGrid';
import Whiteboard from './Whiteboard';
import Chat from './Chat';

export default function VideoConference({ userName, roomId, onLeave }) {
  const [socket, setSocket] = useState(null);
  const [activePanel, setActivePanel] = useState(null); // 'whiteboard' | 'chat' | null
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  // References to pass down methods from child components if needed
  const videoGridRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    if (videoGridRef.current) {
      videoGridRef.current.toggleAudio(!newMutedState);
    }
  };

  const toggleVideo = () => {
    const newVideoOffState = !isVideoOff;
    setIsVideoOff(newVideoOffState);
    if (videoGridRef.current) {
      videoGridRef.current.toggleVideo(!newVideoOffState);
    }
  };

  const toggleScreenShare = () => {
    if (videoGridRef.current) {
      videoGridRef.current.toggleScreenShare(!isScreenSharing);
    }
  };

  const toggleRecording = () => {
    if (videoGridRef.current) {
      if (!isRecording) {
        videoGridRef.current.startRecording();
        setIsRecording(true);
      } else {
        videoGridRef.current.stopRecording();
        setIsRecording(false);
      }
    }
  };

  const togglePanel = (panelName) => {
    setActivePanel(prev => prev === panelName ? null : panelName);
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="flex justify-between items-center p-4 bg-surface border-b border-slate-700 h-16 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
            <VideoIcon className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Room: {roomId}</h1>
            <p className="text-xs text-slate-400">Welcome, {userName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => togglePanel('chat')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
              activePanel === 'chat' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Chat
          </button>
          <button
            onClick={() => togglePanel('whiteboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-medium text-sm ${
              activePanel === 'whiteboard' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <PenTool className="w-4 h-4" />
            Whiteboard
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden flex relative">
        <div className={`flex-1 transition-all duration-300 p-4 h-full ${activePanel ? 'w-1/2' : 'w-full'}`}>
          {socket && (
            <VideoGrid
              ref={videoGridRef}
              socket={socket}
              roomId={roomId}
              userName={userName}
              isMuted={isMuted}
              isVideoOff={isVideoOff}
              onScreenShareEnd={() => setIsScreenSharing(false)}
              onScreenShareStart={() => setIsScreenSharing(true)}
            />
          )}
        </div>
        
        {/* Side Panel */}
        <div className={`transition-all duration-300 h-full bg-slate-900 ${activePanel ? 'w-1/2 border-l border-slate-700' : 'w-0 overflow-hidden border-0'}`}>
          {socket && (
            <>
              <div className={`w-full h-full ${activePanel === 'whiteboard' ? 'block' : 'hidden'}`}>
                <Whiteboard socket={socket} roomId={roomId} />
              </div>
              <div className={`w-full h-full ${activePanel === 'chat' ? 'block' : 'hidden'}`}>
                <Chat socket={socket} roomId={roomId} userName={userName} />
              </div>
            </>
          )}
        </div>
      </main>

      {/* Control Bar */}
      <footer className="h-20 shrink-0 bg-surface border-t border-slate-700 flex items-center justify-center gap-4 px-4">
        <ControlButton
          icon={isMuted ? <MicOff /> : <Mic />}
          label={isMuted ? 'Unmute' : 'Mute'}
          onClick={toggleMute}
          active={!isMuted}
          danger={isMuted}
        />
        <ControlButton
          icon={isVideoOff ? <VideoOff /> : <VideoIcon />}
          label={isVideoOff ? 'Start Video' : 'Stop Video'}
          onClick={toggleVideo}
          active={!isVideoOff}
          danger={isVideoOff}
        />
        <ControlButton
          icon={isScreenSharing ? <MonitorOff /> : <MonitorUp />}
          label={isScreenSharing ? 'Stop Sharing' : 'Share Screen'}
          onClick={toggleScreenShare}
          active={isScreenSharing}
          primary={!isScreenSharing}
        />
        <ControlButton
          icon={isRecording ? <Square className="fill-current" /> : <Circle className="fill-current" />}
          label={isRecording ? 'Stop Recording' : 'Record'}
          onClick={toggleRecording}
          active={isRecording}
          danger={isRecording}
          primary={!isRecording}
        />
        <div className="w-px h-8 bg-slate-700 mx-2"></div>
        <ControlButton
          icon={<PhoneOff />}
          label="Leave Call"
          onClick={onLeave}
          danger
          solid
        />
      </footer>
    </div>
  );
}

function ControlButton({ icon, label, onClick, active, danger, primary, solid }) {
  let baseClass = "flex flex-col items-center justify-center w-14 h-14 rounded-full transition-all group relative ";
  
  if (solid && danger) {
    baseClass += "bg-danger hover:bg-dangerHover text-white";
  } else if (danger) {
    baseClass += "bg-danger/10 text-danger hover:bg-danger/20 border border-danger/20";
  } else if (primary) {
    baseClass += "bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20";
  } else if (active) {
    baseClass += "bg-slate-700 text-white hover:bg-slate-600";
  } else {
    baseClass += "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white";
  }

  return (
    <button onClick={onClick} className={baseClass} aria-label={label}>
      <div className="w-6 h-6 flex justify-center items-center">{icon}</div>
      {/* Tooltip */}
      <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-transform bg-slate-800 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap border border-slate-700 z-50">
        {label}
      </span>
    </button>
  );
}
