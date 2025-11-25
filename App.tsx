import React, { useState, useEffect, useRef } from 'react';
import { sendMessageToEve, startChatWithHistory } from './services/geminiService';
import { saveSession, loadSession, clearSession } from './services/storageService';
import { Message, ModelTier } from './types';
import ChatBubble from './components/ChatBubble';
import VisualAvatar from './components/VisualAvatar';

const DEFAULT_USER = 'ak';

const App: React.FC = () => {
  // --- SYNCHRONOUS STATE INITIALIZATION ---
  const [modelTier, setModelTier] = useState<ModelTier>(() => {
    const current = loadSession(DEFAULT_USER);
    return current ? current.tier : 'free';
  });

  const [messages, setMessages] = useState<Message[]>(() => {
    const current = loadSession(DEFAULT_USER);
    if (current && current.messages && current.messages.length > 0) {
      console.log(`[Vault] Loaded ${current.messages.length} messages.`);
      return current.messages;
    }
    return [{
      id: 'welcome',
      role: 'model',
      text: `System Stable. Vault Storage Active. I'm ready, Ak.`,
    }];
  });

  const [lastSaved, setLastSaved] = useState<Date | null>(() => {
    const current = loadSession(DEFAULT_USER);
    return current ? new Date(current.lastUpdated) : null;
  });
  
  const [inputText, setInputText] = useState('');
  const [attachment, setAttachment] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isGenerativeMode, setIsGenerativeMode] = useState(false);
  const [currentEmotion, setCurrentEmotion] = useState<'neutral' | 'happy' | 'cheeky' | 'angry' | 'smirking' | 'seductive'>('neutral');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, attachment]);

  // --- BRAIN CONNECTION ---
  useEffect(() => {
    startChatWithHistory(modelTier, messages);
  }, []);

  // --- SAVE ON INTERACTION ---
  // We explicitly save whenever messages update, provided it's not just the welcome message.
  useEffect(() => {
    const isDefaultWelcome = messages.length === 1 && messages[0].id === 'welcome';
    
    if (messages.length > 0 && !isDefaultWelcome) {
      saveSession(DEFAULT_USER, messages, modelTier);
      setLastSaved(new Date());
    }
  }, [messages, modelTier]);

  const toggleTier = () => {
    const newTier = modelTier === 'free' ? 'pro' : 'free';
    setModelTier(newTier);
    startChatWithHistory(newTier, messages);
  };

  const handleWipeMemory = () => {
    if (window.confirm("Wipe the vault? This deletes all history permanently.")) {
      clearSession(DEFAULT_USER);
      
      const resetMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        text: `Vault cleared. Fresh session started.`,
      };
      
      setMessages([resetMsg]);
      setAttachment(null);
      setCurrentEmotion('neutral');
      startChatWithHistory(modelTier, [resetMsg]);
    }
  };

  // --- Handlers ---

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Size check - warn if image is huge
      if (file.size > 2 * 1024 * 1024) {
        console.warn("Large file selected. It may be compressed during storage.");
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachment(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const clearAttachment = () => {
    setAttachment(null);
  };

  const detectEmotion = (text: string) => {
    const lower = text.toLowerCase();
    const happyMarkers = [
      '😊', '😁', '😄', '😃', '😂', '🤣', '😉', '😍', '🥰', '😘', '😋', '😎', 
      ':)', ':-)', ':d', 'lol', 'haha', 'hehe', 'love', 'fun', 'happy', 'good', 
      'great', 'excellent', 'amazing', 'sweet', 'banana'
    ];
    const cheekyMarkers = ['😏', 'tease', 'secret', 'maybe', 'hmmm', 'wink'];
    const angryMarkers = ['😠', '😡', '🤬', '😤', 'angry', 'mad', 'furious', 'annoying', 'stupid', 'idiot', 'hate', 'grr'];
    const evilMarkers = ['😈', '👿', '😼', 'evil', 'wicked', 'dark', 'plot', 'smirk', 'bad girl', 'trouble', 'chaos'];
    const seductiveMarkers = ['darling', 'honey', 'babe', 'come here', 'close', 'touch', 'kiss', 'lips', 'bed', 'naughty', 'desire', 'want you', 'hot', 'sexy', '😘', '💋', '🔥', '😻', '🥵'];

    // Priority Check
    if (seductiveMarkers.some(marker => lower.includes(marker))) {
        setCurrentEmotion('seductive');
    } else if (evilMarkers.some(marker => lower.includes(marker))) {
        setCurrentEmotion('smirking');
    } else if (angryMarkers.some(marker => lower.includes(marker))) {
       setCurrentEmotion('angry');
    } else if (happyMarkers.some(marker => lower.includes(marker))) {
      setCurrentEmotion('happy');
    } else if (cheekyMarkers.some(marker => lower.includes(marker))) {
      setCurrentEmotion('cheeky'); 
    } else {
      setCurrentEmotion('neutral');
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !attachment) || isThinking) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: inputText,
      image: attachment || undefined
    };

    // UI Update
    setMessages((prev) => [...prev, userMsg]);
    
    const currentAttachment = attachment;
    const currentMode = isGenerativeMode;
    const historySnapshot = messages; // Snapshot before this new message
    
    setInputText('');
    setAttachment(null);
    setIsThinking(true);
    setIsGenerativeMode(false); 
    setCurrentEmotion('neutral');

    try {
      if (inputText.toLowerCase().includes('bananafy')) {
          document.body.style.borderColor = '#d946ef';
      }

      const response = await sendMessageToEve(
        userMsg.text, 
        modelTier,
        historySnapshot, // Pass pre-update history to rebuild context correctly
        currentAttachment || undefined,
        currentMode
      );
      
      const eveMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: response.text,
        image: response.image
      };
      setMessages((prev) => [...prev, eveMsg]);
      detectEmotion(response.text);
    } catch (error) {
      console.error(error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Connection interrupted. I'm still here, though.",
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
      setCurrentEmotion('neutral');
    } finally {
      setIsThinking(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#0a0510] text-slate-200 overflow-hidden selection:bg-fuchsia-500/30">
      
      {/* Sidebar */}
      <div className="fixed top-0 left-0 w-full h-16 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800 z-50 flex items-center px-4 justify-between md:static md:h-screen md:w-80 md:flex-col md:border-b-0 md:border-r md:p-8 shadow-2xl">
        <div className="flex items-center gap-4 md:flex-col md:gap-8">
          <VisualAvatar isThinking={isThinking} emotion={currentEmotion} />
          <div className="text-left md:text-center">
            <h1 className="text-xl md:text-2xl font-serif font-bold tracking-tight text-slate-100">
              EVE <span className="text-fuchsia-500 text-xs align-top">v2.0</span>
            </h1>
            <p className="text-xs text-slate-500 hidden md:block mt-2">
              Status: <span className="text-fuchsia-400 font-mono">ONLINE</span>
            </p>
          </div>
        </div>

        {/* Status Area */}
        <div className="hidden md:flex flex-col gap-4 mt-8 w-full">
           <div className="bg-slate-950/50 rounded-lg p-3 border border-slate-800 text-xs text-slate-400 shadow-inner space-y-2">
             <div className="flex justify-between">
               <span>Vault Status</span>
               <span className="text-emerald-500">Secure</span>
             </div>

             <div className="flex justify-between border-t border-slate-800 pt-2">
               <span>Nodes Stored</span>
               <span className="text-purple-400 font-mono">{messages.length}</span>
             </div>

             <div className="flex justify-between border-t border-slate-800 pt-2">
                <span>Last Saved</span>
                <span className="text-slate-500">{lastSaved ? lastSaved.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '...'}</span>
             </div>
             
             <div 
               className="flex justify-between items-center group cursor-pointer hover:bg-slate-800/50 p-1 -mx-1 rounded transition-colors border-t border-slate-800 pt-2"
               onClick={toggleTier}
               title="Click to switch Intelligence Tier"
             >
               <span>Model Tier</span>
               <div className="flex items-center gap-1.5">
                 <span className={modelTier === 'pro' ? "text-fuchsia-500 font-bold" : "text-emerald-400"}>
                   {modelTier === 'pro' ? 'Pro' : 'Core'}
                 </span>
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-600 group-hover:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                   <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                 </svg>
               </div>
             </div>
           </div>
        </div>

        <div className="hidden md:block mt-auto w-full space-y-2">
          <button 
            onClick={handleWipeMemory}
            className="w-full py-2 text-xs text-slate-600 hover:text-red-400 transition-colors uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Wipe Vault
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full pt-16 md:pt-0 relative overflow-hidden">
        
        {/* Background Video */}
        <div className="absolute inset-0 z-0">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-cover"
          >
            <source src="https://res.cloudinary.com/dy57jxan6/video/upload/v1764097104/video_20251126_002649_edit_rdtx7l.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[#0a0510]/80 backdrop-blur-[2px]"></div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 relative z-10">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input */}
        <div className="p-4 md:p-6 bg-gradient-to-t from-[#0a0510]/95 to-transparent relative z-10">
          <div className="max-w-4xl mx-auto relative group">
            
            {attachment && (
              <div className="absolute bottom-full left-0 mb-2 p-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl flex items-start gap-2 animate-fade-in z-20">
                <img src={attachment} alt="Preview" className="h-20 w-auto rounded-lg object-contain border border-slate-800" />
                <button 
                  onClick={clearAttachment}
                  className="p-1 bg-slate-800 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            )}

            <div className={`absolute -inset-0.5 rounded-xl opacity-20 group-hover:opacity-40 transition duration-500 blur 
                ${isThinking ? 'bg-gradient-to-r from-fuchsia-600 to-purple-600 opacity-50 animate-pulse' : ''}
                ${isGenerativeMode && !isThinking ? 'bg-gradient-to-r from-fuchsia-500 to-pink-500 opacity-60' : 'bg-gradient-to-r from-purple-800 to-slate-800'}
            `}></div>
            
            <div className="relative flex items-end bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-800/50 shadow-2xl overflow-hidden">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-4 text-slate-400 hover:text-fuchsia-400 transition-colors border-r border-slate-700/50"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*" />

               <button 
                onClick={() => setIsGenerativeMode(!isGenerativeMode)}
                className={`p-4 transition-all border-r border-slate-700/50 ${isGenerativeMode ? 'text-fuchsia-400 bg-fuchsia-500/10' : 'text-slate-400 hover:text-fuchsia-400'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill={isGenerativeMode ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </button>

              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={isThinking ? "Thinking..." : isGenerativeMode ? "What should I create/edit?" : "Type a message..."}
                className="w-full bg-transparent border-none focus:ring-0 py-4 min-h-[60px] max-h-32 resize-none text-slate-200 placeholder-slate-500"
                disabled={isThinking}
              />
              
              <button 
                onClick={handleSendMessage}
                disabled={(!inputText.trim() && !attachment) || isThinking}
                className={`p-4 rounded-lg transition-colors ${isGenerativeMode ? 'text-fuchsia-500 hover:text-fuchsia-300' : 'text-slate-400 hover:text-fuchsia-500'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;