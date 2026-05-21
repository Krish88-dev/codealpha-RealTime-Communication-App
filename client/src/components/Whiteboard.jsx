import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Download } from 'lucide-react';

export default function Whiteboard({ socket, roomId }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);

  // Initialize Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    
    // Make canvas fill the container, but we need fixed dimensions for coordinate mapping
    // We'll use a virtual fixed size mapped to CSS size
    const VIRTUAL_WIDTH = 1200;
    const VIRTUAL_HEIGHT = 800;
    
    canvas.width = VIRTUAL_WIDTH;
    canvas.height = VIRTUAL_HEIGHT;

    const context = canvas.getContext('2d');
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = brushSize;
    contextRef.current = context;

    // Listen for remote drawing events
    const handleDraw = (data) => {
      const { startX, startY, endX, endY, color: remoteColor, thickness } = data;
      const ctx = contextRef.current;
      
      const currentStroke = ctx.strokeStyle;
      const currentWidth = ctx.lineWidth;
      
      ctx.strokeStyle = remoteColor;
      ctx.lineWidth = thickness;
      
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
      ctx.closePath();
      
      // Restore local settings
      ctx.strokeStyle = currentStroke;
      ctx.lineWidth = currentWidth;
    };

    socket.on('whiteboard-draw', handleDraw);

    return () => {
      socket.off('whiteboard-draw', handleDraw);
    };
  }, [socket, roomId]);

  // Update context when color or brush size changes
  useEffect(() => {
    if (contextRef.current) {
      contextRef.current.strokeStyle = color;
      contextRef.current.lineWidth = brushSize;
    }
  }, [color, brushSize]);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    setIsDrawing(true);
  };

  const finishDrawing = () => {
    contextRef.current.closePath();
    setIsDrawing(false);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    
    // Current position is where we just moved from
    // We need to keep track of the previous position to draw the line segment properly and emit it
    // But for simplicity in this implementation, we draw and emit small segments
    
    // We can get the current cursor position, but we need the last position to broadcast the segment
    // Let's use a simpler approach: get coordinates and stroke to them.
    
    // A better way is to store last position
  };

  // Improved drawing with tracking last position
  const lastPosRef = useRef({ x: 0, y: 0 });

  const startDrawingImproved = (e) => {
    const coords = getCoordinates(e);
    lastPosRef.current = coords;
    setIsDrawing(true);
  };

  const drawImproved = (e) => {
    if (!isDrawing) return;
    
    const currentCoords = getCoordinates(e);
    const { x: startX, y: startY } = lastPosRef.current;
    const { x: endX, y: endY } = currentCoords;

    // Draw locally
    contextRef.current.beginPath();
    contextRef.current.moveTo(startX, startY);
    contextRef.current.lineTo(endX, endY);
    contextRef.current.stroke();
    contextRef.current.closePath();

    // Broadcast
    socket.emit('whiteboard-draw', {
      roomId, // Not strictly needed here if handled on server correctly, but good for context
      startX,
      startY,
      endX,
      endY,
      color,
      thickness: brushSize
    });

    lastPosRef.current = currentCoords;
  };

  // Helper to calculate coordinates based on scaled canvas
  const getCoordinates = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Support for both mouse and touch events
    let clientX, clientY;
    if (event.touches && event.touches.length > 0) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX || event.nativeEvent.clientX;
      clientY = event.clientY || event.nativeEvent.clientY;
    }

    // Scale coordinates to virtual canvas size
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    context.clearRect(0, 0, canvas.width, canvas.height);
    // Note: We might want to broadcast clear event as well, but skipped for brevity
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `whiteboard-${roomId}.png`;
    link.href = dataUrl;
    link.click();
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Color</label>
          <input 
            type="color" 
            value={color} 
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer bg-transparent border-0 p-0"
          />
        </div>
        
        <div className="w-px h-6 bg-slate-700"></div>
        
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 font-medium uppercase tracking-wider">Size</label>
          <input 
            type="range" 
            min="1" 
            max="20" 
            value={brushSize} 
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24 accent-primary"
          />
        </div>
        
        <div className="w-px h-6 bg-slate-700"></div>
        
        <div className="flex gap-2 ml-auto">
          <button 
            onClick={clearCanvas}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
            title="Clear Canvas (Local only)"
          >
            <Eraser className="w-4 h-4" />
            Clear
          </button>
          <button 
            onClick={downloadCanvas}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary/20 hover:bg-primary/30 text-primary rounded border border-primary/20 transition-colors"
            title="Download Image"
          >
            <Download className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
      
      {/* Canvas Area */}
      <div className="flex-1 overflow-hidden relative cursor-crosshair">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawingImproved}
          onMouseUp={finishDrawing}
          onMouseOut={finishDrawing}
          onMouseMove={drawImproved}
          onTouchStart={startDrawingImproved}
          onTouchEnd={finishDrawing}
          onTouchMove={drawImproved}
          className="w-full h-full block touch-none"
          style={{ background: '#0f172a' }}
        />
      </div>
    </div>
  );
}
