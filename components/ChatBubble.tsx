import React from 'react';
import { Message } from '../types';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';
  const hasImage = !!message.image;
  const hasText = !!message.text;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] md:max-w-[75%] p-4 rounded-2xl relative backdrop-blur-md shadow-lg border 
        ${
          isUser
            ? 'bg-slate-800/30 border-slate-700 text-slate-100 rounded-tr-sm'
            : 'bg-gradient-to-br from-purple-900/30 to-slate-900/30 border-fuchsia-500/30 text-slate-200 rounded-tl-sm'
        }`}
      >
        {/* Label */}
        <div className="text-xs font-bold uppercase tracking-widest mb-3 opacity-50 flex items-center gap-2">
           {isUser ? (
             <span className="text-slate-400">AK</span>
           ) : (
             <span className="text-fuchsia-400">EVE v2.0</span>
           )}
        </div>

        {/* Content Layout - Flex on Desktop if both image and text exist */}
        <div className={`flex flex-col ${(!isUser && hasImage && hasText) ? 'lg:flex-row lg:gap-6 lg:items-start' : 'gap-4'}`}>
          
          {/* Image Content */}
          {hasImage && (
            <div className={`${(!isUser && hasText) ? 'lg:w-1/2 lg:flex-shrink-0' : 'w-full'}`}>
              <div className="rounded-lg overflow-hidden border border-slate-700/50 bg-black/20 group relative">
                <img src={message.image} alt="Visual Content" className="w-full h-auto object-cover max-h-96" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                </div>
                <div className="px-3 py-2 bg-black/60 backdrop-blur-sm text-[10px] text-slate-300 flex justify-between absolute bottom-0 w-full">
                    <span className="font-mono opacity-70">{isUser ? 'UPLOAD' : 'GENERATION'}</span>
                    {!isUser && (
                       <a href={message.image} download={`eve_evolution_${message.id}.png`} className="hover:text-fuchsia-400 transition-colors font-bold tracking-wider pointer-events-auto">DOWNLOAD</a>
                    )}
                </div>
              </div>
            </div>
          )}

          {/* Text Content */}
          {hasText && (
            <div className={`leading-relaxed whitespace-pre-wrap font-light text-sm md:text-base ${(!isUser && hasImage) ? 'lg:pt-0' : ''}`}>
              {message.text}
            </div>
          )}

        </div>

        {/* Decorative corner accent for Eve */}
        {!isUser && (
           <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-fuchsia-500/50 to-transparent opacity-50 rounded-l-2xl"></div>
        )}
      </div>
    </div>
  );
};

export default ChatBubble;