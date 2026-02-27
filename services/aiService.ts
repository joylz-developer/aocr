import { GoogleGenAI } from '@google/genai';
import { ProjectSettings } from '../types';
import { convertPdfToImage } from '../utils/pdfConverter';

export interface AiResponse {
    text: string;
}

export const generateContent = async (
    settings: ProjectSettings,
    prompt: string,
    initialMimeType?: string,
    initialBase64Data?: string,
    jsonMode: boolean = false
): Promise<AiResponse> => {
    const model = settings.aiModel === 'custom' ? settings.customAiModel : (settings.aiModel || 'gemini-2.5-flash');
    
    // Use local variables to allow modification
    let mimeType = initialMimeType;
    let base64Data = initialBase64Data;
    
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

        if (mimeType && mimeType.toLowerCase().includes('pdf')) {
            try {
                console.log("Converting PDF to image for non-Gemini model...");
                if (!base64Data) throw new Error("No PDF data provided");
                
                // Convert PDF to image
                const convertedImage = await convertPdfToImage(base64Data);
                
                // Update mimeType and base64Data to use the converted image
                mimeType = 'image/jpeg';
                base64Data = convertedImage;
                
                console.log("PDF successfully converted to image");
            } catch (error: any) {
                console.error("PDF conversion failed:", error);
                throw new Error(`Не удалось конвертировать PDF в изображение: ${error.message}. Пожалуйста, загрузите изображение (JPG/PNG) вручную.`);
            }
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
            max_tokens: 4096,
        };
        
        if (jsonMode && !model.includes('qwen')) {
            body.response_format = { type: "json_object" };
        }
        
        console.log(`Sending request to ${endpoint} with model ${model}`);
        
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
            console.error("AI API Error:", errorData);
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData.error?.message || JSON.stringify(errorData)}`);
        }
        
        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;
        
        console.log("AI Response:", text);
        
        if (!text) {
            throw new Error("Empty response from AI");
        }
        
        return { text };
    }
};
