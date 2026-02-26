import { GoogleGenAI } from '@google/genai';
import { ProjectSettings } from '../types';

export interface AiResponse {
    text: string;
}

export const generateContent = async (
    settings: ProjectSettings,
    prompt: string,
    mimeType?: string,
    base64Data?: string,
    jsonMode: boolean = false
): Promise<AiResponse> => {
    const model = settings.aiModel || 'gemini-2.5-flash';
    
    if (model === 'gemini-2.5-flash') {
        if (!settings.geminiApiKey) {
            throw new Error("Gemini API ключ не настроен");
        }
        
        const ai = new GoogleGenAI({ apiKey: settings.geminiApiKey });
        const parts: any[] = [];
        
        if (mimeType && base64Data) {
            parts.push({ inlineData: { mimeType, data: base64Data } });
        }
        parts.push({ text: prompt });
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: { parts },
            config: jsonMode ? { responseMimeType: "application/json" } : undefined
        });
        
        if (!response.text) {
            throw new Error("Empty response from AI");
        }
        
        return { text: response.text };
    } else {
        // OpenAI Compatible (e.g. OpenRouter, Qwen)
        if (!settings.openAiApiKey) {
            throw new Error("OpenRouter API ключ не настроен");
        }
        
        const baseUrl = settings.openAiBaseUrl || 'https://openrouter.ai/api/v1';
        const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
        
        const messages: any[] = [];
        
        if (mimeType && base64Data) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    { 
                        type: 'image_url', 
                        image_url: { 
                            url: `data:${mimeType};base64,${base64Data}` 
                        } 
                    }
                ]
            });
        } else {
            messages.push({
                role: 'user',
                content: prompt
            });
        }
        
        const body: any = {
            model: model,
            messages: messages,
        };
        
        if (jsonMode) {
            body.response_format = { type: "json_object" };
        }
        
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.openAiApiKey}`,
                'HTTP-Referer': window.location.origin, // Required by OpenRouter
                'X-Title': 'Acts Generator', // Required by OpenRouter
            },
            body: JSON.stringify(body)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || ''}`);
        }
        
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        
        if (!text) {
            throw new Error("Empty response from AI");
        }
        
        return { text };
    }
};
