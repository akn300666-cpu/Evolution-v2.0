
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { EVE_SYSTEM_INSTRUCTION, MODELS, EVE_APPEARANCE, EVE_REFERENCE_IMAGE_URL } from '../constants';
import { ModelTier, Message } from '../types';

// Singleton chat instance to maintain history during the session
let chatSession: Chat | null = null;
let currentTier: ModelTier = 'free';

export const initializeChat = (tier: ModelTier = 'free', history?: any[]) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    currentTier = tier;
    
    // Validate history to prevent SDK crashes
    const validHistory = Array.isArray(history) ? history : [];

    chatSession = ai.chats.create({
      model: MODELS[tier].chat,
      config: {
        systemInstruction: EVE_SYSTEM_INSTRUCTION,
        temperature: 1.0,
        topP: 0.95,
        topK: 40,
      },
      history: validHistory,
    });
    console.log(`[System] Eve v2.0 Initialized on ${tier} tier with ${validHistory.length} context items.`);
  } catch (error) {
    console.error("Failed to initialize chat session with history:", error);
    // Fallback to empty session if history is corrupt
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
    chatSession = ai.chats.create({
      model: MODELS[tier].chat,
      config: { systemInstruction: EVE_SYSTEM_INSTRUCTION },
    });
  }
};

// Helper to determine intent
const isImageGenerationIntent = (text: string): boolean => {
  const keywords = ['generate', 'create', 'draw', 'imagine', 'render', 'visualize', 'make an image', 'image of', 'picture of'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
};

const isImageEditingIntent = (text: string): boolean => {
  const keywords = ['edit', 'change', 'filter', 'style', 'make it', 'turn it', 'add', 'remove', 'background', 'modify', 'bananafy'];
  const lower = text.toLowerCase();
  return keywords.some(k => lower.includes(k));
};

/**
 * Main entry point for communicating with Eve.
 * Routes between Chat (Text/Vision) and Flash Image (Generation/Editing).
 * Accepts 'history' to restore context if the session was lost (e.g. HMR or reload).
 */
export const sendMessageToEve = async (
  message: string, 
  tier: ModelTier, 
  history: Message[],
  attachmentBase64?: string,
  forceImageGeneration: boolean = false
): Promise<{ text: string; image?: string }> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

  // Auto-init/Restore if missing or tier changed
  if (!chatSession || currentTier !== tier) {
    console.log("Restoring session before sending message...");
    await startChatWithHistory(tier, history);
  }

  const mimeType = attachmentBase64 ? getMimeType(attachmentBase64) : 'image/jpeg';
  const cleanBase64 = attachmentBase64 ? attachmentBase64.replace(/^data:image\/\w+;base64,/, "") : null;
  const imageModel = MODELS[tier].image;

  try {
    // ROUTE 1: Image Editing (User provides image + edit intent OR forced mode)
    if (attachmentBase64 && (isImageEditingIntent(message) || forceImageGeneration)) {
      const response = await ai.models.generateContent({
        model: imageModel,
        contents: {
          parts: [
            { inlineData: { data: cleanBase64!, mimeType } },
            { text: message }
          ]
        }
      });
      return processImageResponse(response, "I've evolved the visual based on your request.");
    }

    // ROUTE 2: Image Generation (No Attachment + (Gen Intent OR Forced Mode))
    if (!attachmentBase64 && (isImageGenerationIntent(message) || forceImageGeneration)) {
      // If user asks for "Selfie" in generation mode, append Eve's description
      let prompt = message;
      if (message.toLowerCase().includes('selfie')) {
         prompt = `${message}. Subject: ${EVE_APPEARANCE}`;
      }

      const response = await ai.models.generateContent({
        model: imageModel,
        contents: {
          parts: [{ text: prompt }]
        }
      });
      return processImageResponse(response, "Here is what I visualized for you.");
    }

    // ROUTE 3: Standard Chat / Vision (History aware)
    let msgContent: any = message;
    if (attachmentBase64) {
      msgContent = {
        parts: [
          { inlineData: { data: cleanBase64!, mimeType } },
          { text: message }
        ]
      };
    }

    // Safety check: if session is still null (rare init failure), try one last force init
    if (!chatSession) {
         initializeChat(tier, []); 
    }

    const result: GenerateContentResponse = await chatSession!.sendMessage({ message: msgContent });
    let replyText = result.text || "";

    // --- VISUAL TRIGGER PROTOCOL HANDLER ---
    // If Eve triggers the visual tool via [SELFIE] tag
    if (replyText.includes('[SELFIE]')) {
      console.log("[System] Visual Trigger Protocol Activated");
      
      // Clean the tag from the text
      replyText = replyText.replace(/\[SELFIE\]/g, "").trim();

      // Generate the selfie with Reference Image if available
      try {
        const selfiePrompt = `A photorealistic selfie of ${EVE_APPEARANCE}. The character is looking at the camera. High quality, detailed, cinematic lighting, 1:1 aspect ratio.`;
        
        let parts: any[] = [{ text: selfiePrompt }];

        // Try to fetch reference image to guide generation (Image-to-Image style)
        if (EVE_REFERENCE_IMAGE_URL) {
            try {
                const imgRes = await fetch(EVE_REFERENCE_IMAGE_URL);
                const blob = await imgRes.blob();
                const arrayBuffer = await blob.arrayBuffer();
                const base64Ref = arrayBufferToBase64(arrayBuffer);
                parts.unshift({ inlineData: { mimeType: 'image/png', data: base64Ref } });
                console.log("[System] Reference image attached to generation.");
            } catch (e) {
                console.warn("Could not fetch reference image, proceeding with text only.");
            }
        }

        const selfieResponse = await ai.models.generateContent({
          model: imageModel,
          contents: { parts: parts }
        });
        
        const selfieData = processImageResponse(selfieResponse, "");
        return { text: replyText, image: selfieData.image };

      } catch (err) {
        console.error("Selfie generation failed:", err);
        // Fail gracefully - just return text
        return { text: replyText };
      }
    }

    return { text: replyText };

  } catch (error) {
    console.error("Error communicating with Eve:", error);
    throw error;
  }
};

export const startChatWithHistory = async (tier: ModelTier, history: Message[]) => {
  if (!history || history.length === 0) {
    initializeChat(tier, []);
    return;
  }

  try {
    const geminiHistory: any[] = [];
    let lastRole: string | null = null;

    // 1. Process History & Merge same-role turns
    // The API fails if you have User -> User. We must combine them.
    for (const h of history) {
      if (h.isError) continue;

      const parts: any[] = [];
      
      // Image Parts
      if (h.image) {
         try {
            const mimeType = getMimeType(h.image);
            const data = h.image.replace(/^data:image\/\w+;base64,/, "");
            if (data && mimeType) {
              // Only allow images in 'user' role for history context in some models,
              // but Flash supports multimodal history. We keep it standard.
              if (h.role === 'user') {
                parts.push({ inlineData: { mimeType, data } });
              }
            }
         } catch(e) { console.warn("Skipping invalid image in history"); }
      }

      // Text Parts
      if (h.text && h.text.trim() !== "") {
        parts.push({ text: h.text });
      }

      if (parts.length === 0) parts.push({ text: "..." }); // Fallback for empty messages

      // MERGE LOGIC
      if (lastRole === h.role) {
         // Append to previous message parts
         const lastMsg = geminiHistory[geminiHistory.length - 1];
         lastMsg.parts.push(...parts);
      } else {
         geminiHistory.push({ role: h.role, parts: parts });
         lastRole = h.role;
      }
    }

    // 2. CRITICAL FIX: Ensure history starts with a 'user' message.
    while (geminiHistory.length > 0 && geminiHistory[0].role === 'model') {
      geminiHistory.shift();
    }

    // 3. Ensure alternating turns
    if (geminiHistory.length > 0 && geminiHistory[geminiHistory.length - 1].role === 'user') {
       geminiHistory.push({ role: 'model', parts: [{ text: "..." }] });
    }

    initializeChat(tier, geminiHistory);
  } catch (e) {
    console.error("Failed to reconstruct history:", e);
    // Init clean if reconstruction fails to prevent app death
    initializeChat(tier, []);
  }
};

const processImageResponse = (response: GenerateContentResponse, fallbackText: string): { text: string, image?: string } => {
  let image: string | undefined;
  let text = "";

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        image = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      } else if (part.text) {
        text += part.text;
      }
    }
  }

  return { 
    text: text || fallbackText, 
    image 
  };
};

const getMimeType = (dataUrl: string): string => {
  const match = dataUrl.match(/^data:(.*);base64,/);
  return match ? match[1] : 'image/jpeg';
};

// Helper to convert ArrayBuffer to Base64 (Browser compatible)
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
};

// Deprecated direct export
export const editImageWithEve = async (base64Image: string, prompt: string, tier: ModelTier) => {
  const res = await sendMessageToEve(prompt, tier, [], base64Image, true);
  return res.image || null;
};
