import { Message, ModelTier } from '../types';

const STORAGE_PREFIX = 'eve_vault_v1_'; // New key for fresh start

interface StoredSession {
  messages: Message[];
  tier: ModelTier;
  lastUpdated: number;
}

// Helper to reduce storage footprint
// We keep full images only for the last 5 messages. Older images are stripped to text-only.
const compressMessages = (messages: Message[]): Message[] => {
  const cutoffIndex = Math.max(0, messages.length - 5);
  
  return messages.map((msg, index) => {
    // If it's an old message and has an image, strip the image data
    if (index < cutoffIndex && msg.image) {
      return {
        ...msg,
        image: undefined, // Remove the heavy base64 data
        text: msg.text + ' [Visual Memory Archived]' // Add a marker
      };
    }
    return msg;
  });
};

export const saveSession = (username: string, messages: Message[], tier: ModelTier = 'free') => {
  if (!username) return;

  const mainKey = `${STORAGE_PREFIX}${username}`;
  
  // 1. SMART COMPRESSION
  // Before we even try to save, we optimize the data to ensure we don't hit the 5MB limit.
  const optimizedMessages = compressMessages(messages);

  const data: StoredSession = { 
    messages: optimizedMessages, 
    tier, 
    lastUpdated: Date.now() 
  };

  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(mainKey, serialized);
    console.log(`[Storage] Saved ${optimizedMessages.length} messages for ${username}.`);
  } catch (e: any) {
    console.error("Critical Storage Error:", e);
    
    // Fallback: If we STILL hit the limit (very rare with compression), save ONLY text.
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      console.warn("Storage quota critical. Stripping ALL images to save text history.");
      const textOnly = messages.map(m => ({ ...m, image: undefined }));
      try {
        localStorage.setItem(mainKey, JSON.stringify({ messages: textOnly, tier, lastUpdated: Date.now() }));
      } catch (inner) {
        console.error("Failed to save emergency text backup.", inner);
      }
    }
  }
};

export const loadSession = (username: string): StoredSession | null => {
  if (!username) return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${username}`);
    if (!raw) return null;
    
    const parsed = JSON.parse(raw);
    
    // Handle legacy format (array only) if encountered, though we switched keys.
    if (Array.isArray(parsed)) {
      return { messages: parsed, tier: 'free', lastUpdated: Date.now() };
    }
    return parsed as StoredSession;
  } catch (e) {
    console.error("Failed to load session", e);
    return null;
  }
};

export const clearSession = (username: string) => {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${username}`);
    console.log("[Storage] Vault cleared.");
  } catch (e) {
    console.error("Failed to clear session", e);
  }
};

export const restoreFromBackup = (username: string): StoredSession | null => {
  // Not implemented for Vault v1 yet as we rely on compression stability
  return null; 
};