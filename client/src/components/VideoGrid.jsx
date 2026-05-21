import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { VideoOff, MicOff } from 'lucide-react';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { 
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

const VideoGrid = forwardRef(({ socket, roomId, userName, isMuted, isVideoOff, onScreenShareEnd, onScreenShareStart }, ref) => {
  const [peers, setPeers] = useState([]);
  const [peerStates, setPeerStates] = useState({});
  const userVideo = useRef();
  const peersRef = useRef([]); 
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Keep refs of latest state to avoid remounting WebRTC on toggle
  const stateRef = useRef({ isMuted, isVideoOff });
  
  useEffect(() => {
    stateRef.current = { isMuted, isVideoOff };
    if (socket && socket.connected) {
      socket.emit('user-state-change', {
        userId: socket.id,
        isMuted,
        isVideoOff
      });
    }
  }, [isMuted, isVideoOff, socket]);

  useEffect(() => {
    let isMounted = true;

    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
      if (!isMounted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      localStreamRef.current = stream;
      
      // Apply initial mute/video state to tracks directly
      stream.getAudioTracks()[0].enabled = !stateRef.current.isMuted;
      stream.getVideoTracks()[0].enabled = !stateRef.current.isVideoOff;

      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
      
      socket.emit('join-room', roomId, socket.id);

      socket.on('user-state-change', (data) => {
        setPeerStates(prev => ({ ...prev, [data.userId]: data }));
      });

      socket.on('user-connected', userId => {
        // Broadcast current state to the new user
        socket.emit('user-state-change', {
          userId: socket.id,
          ...stateRef.current
        });

        const pc = createPeerConnection(userId, stream);
        peersRef.current.push({ peerId: userId, peerConnection: pc });
        
        pc.createOffer().then(offer => {
          return pc.setLocalDescription(offer);
        }).then(() => {
          socket.emit('signal', {
            userToSignal: userId,
            callerID: socket.id,
            signal: { type: 'offer', sdp: pc.localDescription }
          });
        });
      });

      socket.on('signal', async data => {
        const { callerID, signal } = data;
        let peerObj = peersRef.current.find(p => p.peerId === callerID);
        let pc;

        if (signal.type === 'offer') {
          pc = createPeerConnection(callerID, stream);
          peersRef.current.push({ peerId: callerID, peerConnection: pc });
          
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          
          socket.emit('signal', {
            userToSignal: callerID,
            callerID: socket.id,
            signal: { type: 'answer', sdp: pc.localDescription }
          });
        } else if (signal.type === 'answer') {
          if (peerObj) {
            await peerObj.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.candidate) {
          if (peerObj) {
            try {
              await peerObj.peerConnection.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } catch (e) {
              console.error('Error adding ICE candidate', e);
            }
          }
        }
      });

      socket.on('user-disconnected', userId => {
        const peerObj = peersRef.current.find(p => p.peerId === userId);
        if (peerObj) peerObj.peerConnection.close();
        
        peersRef.current = peersRef.current.filter(p => p.peerId !== userId);
        setPeers(prev => prev.filter(p => p.peerId !== userId));
        setPeerStates(prev => {
          const newStates = { ...prev };
          delete newStates[userId];
          return newStates;
        });
      });
    });

    return () => {
      isMounted = false;
      if (socket) {
        socket.off('user-connected');
        socket.off('signal');
        socket.off('user-disconnected');
        socket.off('user-state-change');
      }
      
      peersRef.current.forEach(p => p.peerConnection.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [roomId, socket]); // NO isMuted or isVideoOff here

  function createPeerConnection(peerId, stream) {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    stream.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = event => {
      if (event.candidate) {
        socket.emit('signal', {
          userToSignal: peerId,
          callerID: socket.id,
          signal: { candidate: event.candidate }
        });
      }
    };

    pc.ontrack = event => {
      setPeers(prevPeers => {
        if (prevPeers.find(p => p.peerId === peerId)) return prevPeers;
        return [...prevPeers, { peerId, stream: event.streams[0] }];
      });
    };
    return pc;
  }

  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  useImperativeHandle(ref, () => ({
    toggleAudio: (enabled) => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks()[0].enabled = enabled;
      }
    },
    toggleVideo: (enabled) => {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks()[0].enabled = enabled;
      }
    },
    toggleScreenShare: async (startSharing) => {
      if (startSharing) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = screenStream;
          const screenTrack = screenStream.getVideoTracks()[0];
          
          peersRef.current.forEach(peerObj => {
            const sender = peerObj.peerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) sender.replaceTrack(screenTrack);
          });

          onScreenShareStart();

          screenTrack.onended = () => stopScreenShare();
        } catch (err) {
          console.error("Error sharing screen:", err);
          onScreenShareEnd();
        }
      } else {
        stopScreenShare();
      }
    },
    startRecording: async () => {
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        
        if (localStreamRef.current && localStreamRef.current.getAudioTracks().length > 0) {
          displayStream.addTrack(localStreamRef.current.getAudioTracks()[0]);
        }

        const mediaRecorder = new MediaRecorder(displayStream, { mimeType: 'video/webm' });
        mediaRecorderRef.current = mediaRecorder;
        recordedChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) recordedChunksRef.current.push(event.data);
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          document.body.appendChild(a);
          a.style = 'display: none';
          a.href = url;
          a.download = `recording-${roomId}-${Date.now()}.webm`;
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);
          displayStream.getTracks().forEach(track => track.stop());
        };

        displayStream.getVideoTracks()[0].onended = () => {
          if (mediaRecorder.state !== 'inactive') mediaRecorder.stop();
        };

        mediaRecorder.start();
      } catch (err) {
        console.error("Error starting recording:", err);
      }
    },
    stopRecording: () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    }
  }));

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      peersRef.current.forEach(peerObj => {
        const sender = peerObj.peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender && videoTrack) sender.replaceTrack(videoTrack);
      });
      if (userVideo.current) userVideo.current.srcObject = localStreamRef.current;
    }
    onScreenShareEnd();
  };

  const totalVideos = peers.length + 1;
  let gridClass = "grid-cols-1";
  if (totalVideos === 2) gridClass = "grid-cols-1 md:grid-cols-2";
  else if (totalVideos === 3 || totalVideos === 4) gridClass = "grid-cols-2";
  else if (totalVideos > 4) gridClass = "grid-cols-2 md:grid-cols-3";

  return (
    <div className="w-full h-full bg-slate-900 rounded-xl overflow-hidden p-2">
      <div className={`grid gap-4 w-full h-full ${gridClass} p-2 auto-rows-fr`}>
        
        {/* Local Video */}
        <div className="relative bg-black rounded-lg overflow-hidden shadow-md flex items-center justify-center group">
          <video 
            ref={userVideo} 
            autoPlay 
            muted 
            playsInline
            className={`w-full h-full object-cover transition-opacity ${isVideoOff ? 'opacity-0' : 'opacity-100'}`}
          />
          {isVideoOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
               <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-2">
                 <VideoOff className="w-8 h-8 text-slate-400" />
               </div>
               <span className="text-slate-400 text-sm">Camera Off</span>
            </div>
          )}
          <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-md backdrop-blur-sm">
            <span className="text-white text-sm font-medium">{userName} (You) {isMuted ? '(Muted)' : ''}</span>
          </div>
        </div>

        {/* Remote Videos */}
        {peers.map((peer) => (
          <RemoteVideo 
            key={peer.peerId} 
            stream={peer.stream} 
            peerId={peer.peerId} 
            peerState={peerStates[peer.peerId]}
          />
        ))}
        
      </div>
    </div>
  );
});

const RemoteVideo = ({ stream, peerId, peerState }) => {
  const ref = useRef();
  
  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream;
    }
  }, [stream]);

  const remoteVideoOff = peerState?.isVideoOff;
  const remoteMuted = peerState?.isMuted;

  return (
    <div className="relative bg-black rounded-lg overflow-hidden shadow-md flex items-center justify-center">
      <video 
        ref={ref}
        autoPlay 
        playsInline
        className={`w-full h-full object-cover transition-opacity ${remoteVideoOff ? 'opacity-0' : 'opacity-100'}`}
      />
      {remoteVideoOff && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800">
           <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mb-2">
             <VideoOff className="w-8 h-8 text-slate-400" />
           </div>
           <span className="text-slate-400 text-sm">Camera Off</span>
        </div>
      )}
      <div className="absolute bottom-4 left-4 bg-black/60 px-3 py-1 rounded-md backdrop-blur-sm flex items-center gap-2">
        <span className="text-white text-sm font-medium flex items-center gap-1">
          User {peerId.substring(0,4)}
          {remoteMuted && <MicOff className="w-3 h-3 text-danger" />}
        </span>
      </div>
    </div>
  );
};

export default VideoGrid;
