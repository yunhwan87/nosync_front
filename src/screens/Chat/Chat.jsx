import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, Sparkles, User, Copy, RotateCcw, ThumbsUp, ThumbsDown } from 'lucide-react';
import './Chat.css';

const Chat = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your OnSync AI assistant. How can I help you with your media production today?' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsTyping(true);

    // Simulate AI Response with streaming-like delay
    setTimeout(() => {
      const aiResponse = { 
        role: 'assistant', 
        content: `I've analyzed your project "Movie Alpha". Based on the current schedule, I recommend checking the "Modern Apartment" location availability for April 12th as well.` 
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  return (
    <div className="chat-container">
      <div className="chat-feed">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-row ${msg.role}`}>
            <div className="avatar-container">
              {msg.role === 'assistant' ? (
                <div className="ai-avatar"><Sparkles size={16} /></div>
              ) : (
                <div className="user-avatar"><User size={16} /></div>
              )}
            </div>
            <div className="message-content">
              <div className="content-text">{msg.content}</div>
              {msg.role === 'assistant' && (
                <div className="message-actions">
                  <button className="action-btn"><Copy size={14} /></button>
                  <button className="action-btn"><RotateCcw size={14} /></button>
                  <button className="action-btn"><ThumbsUp size={14} /></button>
                  <button className="action-btn"><ThumbsDown size={14} /></button>
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="message-row assistant typing">
            <div className="ai-avatar"><Sparkles size={16} /></div>
            <div className="typing-indicator">
              <span></span><span></span><span></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="input-wrapper">
          <button className="attach-btn"><Paperclip size={20} /></button>
          <textarea 
            placeholder="Ask OnSync AI anything..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
            rows={1}
          />
          <button 
            className={`send-btn ${input ? 'active' : ''}`}
            onClick={handleSend}
            disabled={!input}
          >
            <Send size={18} />
          </button>
        </div>
        <p className="disclaimer">OnSync AI can provide insights, but always verify critical production details.</p>
      </div>
    </div>
  );
};

export default Chat;
