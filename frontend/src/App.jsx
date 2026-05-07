import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const SUGGESTION_CHIPS = [
  'Summarize this document',
  'What are the key points?',
  'Explain the main concepts',
];

function App() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadState, setUploadState] = useState('idle'); // idle | uploading | success | error
  const [uploadedFile, setUploadedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleUpload = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setUploadState('error');
      setErrorMsg('Please upload a PDF file.');
      return;
    }

    setUploadState('uploading');
    setUploadedFile(null);
    setErrorMsg('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      setUploadState('success');
      setUploadedFile(file.name);
      setMessages([]);
      inputRef.current?.focus();
    } catch (err) {
      setUploadState('error');
      setErrorMsg('Failed to upload. Is your backend running?');
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const sendMessage = async (text) => {
    const query = text || input.trim();
    if (!query || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: query }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userQuery: query }),
      });

      if (!res.ok) throw new Error('Chat failed');

      const data = await res.json();
      setMessages((prev) => [...prev, { role: 'ai', content: data.answer }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'ai', content: 'Sorry, something went wrong. Make sure your backend is running and a document is uploaded.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage();
  };

  const handleReset = async () => {
    setMessages([]);
    setUploadState('idle');
    setUploadedFile(null);
    setInput('');
  };

  const isReady = uploadState === 'success';

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="logo">📓</div>
          <h1>NotebookLM</h1>
          <span className="tag">RAG</span>
        </div>

        <div className="upload-section">
          <h3>Sources</h3>

          <div
            className={`upload-dropzone ${isDragging ? 'dragging' : ''} ${uploadState === 'uploading' ? 'uploading' : ''} ${uploadState === 'success' ? 'success' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="upload-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <span className="label">Upload PDF</span>
            <span className="hint">Click or drag & drop</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>

          {uploadState === 'uploading' && (
            <div className="upload-progress">
              <div className="spinner" />
              <span className="text">Processing document...</span>
            </div>
          )}

          {uploadState === 'error' && (
            <div className="upload-error">
              <span className="text">⚠ {errorMsg}</span>
            </div>
          )}

          {uploadedFile && uploadState === 'success' && (
            <div className="doc-card">
              <div className="file-icon">PDF</div>
              <div className="file-info">
                <div className="file-name">{uploadedFile}</div>
                <div className="file-status">✓ Indexed & ready</div>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <button className="btn-reset" onClick={handleReset}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            New Session
          </button>
        </div>
      </aside>

      {/* Chat */}
      <main className="chat-area">
        <div className="chat-header">
          <div className="dot" />
          <span className="title">Document Chat</span>
          <span className="model-tag">GPT-OSS-20B</span>
        </div>

        <div className="chat-messages">
          {messages.length === 0 && !isLoading ? (
            <div className="welcome-screen">
              <div className="welcome-icon">🔍</div>
              <h2>Chat with your document</h2>
              <p>
                {isReady
                  ? 'Your document is ready! Ask any question and I\'ll find the answer from it.'
                  : 'Upload a PDF from the sidebar to get started. I\'ll help you extract insights from it.'}
              </p>
              {isReady && (
                <div className="welcome-chips">
                  {SUGGESTION_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      className="welcome-chip"
                      onClick={() => sendMessage(chip)}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div key={i} className={`message ${msg.role}`}>
                  <div className="message-avatar">
                    {msg.role === 'ai' ? '✦' : '👤'}
                  </div>
                  <div className="message-bubble">
                    {msg.role === 'ai' ? (
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="typing-indicator">
                  <div className="message-avatar" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, fontSize: 14 }}>
                    ✦
                  </div>
                  <div className="typing-dots">
                    <span /><span /><span />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        <div className="chat-input-area">
          <form className="chat-form" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isReady ? 'Ask a question about your document...' : 'Upload a document first...'}
              disabled={!isReady || isLoading}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn-send"
              disabled={!isReady || !input.trim() || isLoading}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default App;
