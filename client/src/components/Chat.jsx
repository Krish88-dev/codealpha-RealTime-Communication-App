import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';

export default function Chat({ socket, roomId, userName }) {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const handleNewMessage = (data) => {
      setMessages((prev) => [...prev, data]);
    };

    socket.on('chat-message', handleNewMessage);

    return () => {
      socket.off('chat-message', handleNewMessage);
    };
  }, [socket]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const messageData = {
      id: Date.now().toString(),
      userName,
      message: inputValue,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isLocal: true,
    };

    // Update local UI immediately
    setMessages((prev) => [...prev, messageData]);

    // Send to server
    socket.emit('chat-message', {
      ...messageData,
      isLocal: false // It's remote for everyone else
    });

    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700">
      <div className="p-4 bg-slate-800 border-b border-slate-700">
        <h2 className="text-white font-medium flex items-center gap-2">
          Room Chat
          <span className="bg-primary/20 text-primary text-xs px-2 py-0.5 rounded-full">
            {messages.length}
          </span>
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <p>No messages yet.</p>
            <p className="text-sm">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              className={`flex flex-col ${msg.isLocal ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-medium text-slate-300">
                  {msg.isLocal ? 'You' : msg.userName}
                </span>
                <span className="text-[10px] text-slate-500">{msg.timestamp}</span>
              </div>
              <div 
                className={`max-w-[85%] rounded-lg px-4 py-2 text-sm ${
                  msg.isLocal 
                    ? 'bg-primary text-white rounded-tr-none' 
                    : 'bg-slate-700 text-white rounded-tl-none'
                }`}
              >
                {msg.message}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-slate-800 border-t border-slate-700">
        <form onSubmit={sendMessage} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
          <button 
            type="submit"
            disabled={!inputValue.trim()}
            className="bg-primary hover:bg-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
