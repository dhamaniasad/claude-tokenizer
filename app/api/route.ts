import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';
import { encodingForModel } from 'js-tiktoken';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Ensure API keys are present
if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('missing ANTHROPIC_API_KEY');
}

if (!process.env.GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not found - Gemini token counting will be disabled');
}

// Default model to use if none is provided
const DEFAULT_MODEL = 'claude-opus-4-7';

// Function to get GPT-4o token count
function getGPT4oTokenCount(text: string) {
    try {
        // Use the 'gpt-4o' encoder which is used for GPT-4o as well
        const encoder = encodingForModel('gpt-4o');
        return encoder.encode(text).length;
    } catch (error) {
        console.error('GPT-4o tokenization error:', error);
        return null;
    }
}

async function getGeminiTokenCount(text: string) {
    try {
        if (!process.env.GEMINI_API_KEY) return null;

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        
        const result = await model.countTokens({
            contents: [{ role: 'user', parts: [{ text }] }]
        });
        
        return result.totalTokens;
    } catch (error) {
        console.error('Gemini tokenization error:', error);
        return null;
    }
}

export async function POST(req: NextRequest) {
    try {
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        let text = '';
        let fileChars = 0;
        let model = DEFAULT_MODEL;
        let comparisonModel: string | null = null;
        let gpt4oTokens = null;
        let geminiTokens = null;

        // Determine request type based on content-type header
        const contentType = req.headers.get('content-type') || '';

        if (contentType.includes('multipart/form-data')) {
            // Handle file upload
            const formData = await req.formData();
            const file = formData.get('file') as File | null;
            const formModel = formData.get('model') as string | null;
            const formComparisonModel = formData.get('comparisonModel') as string | null;
            const fileType = formData.get('fileType') as string | null;

            if (formModel) {
                model = formModel;
            }
            if (formComparisonModel) {
                comparisonModel = formComparisonModel;
            }
            
            if (file) {
                const arrayBuffer = await file.arrayBuffer();
                const fileContent = new Uint8Array(arrayBuffer);
                fileChars = fileContent.length;
                
                if (fileType === 'pdf') {
                    // Convert PDF to base64
                    const base64Content = Buffer.from(fileContent).toString('base64');

                    const pdfMessages = [{
                        role: 'user' as const,
                        content: [
                            {
                                type: 'document' as const,
                                source: {
                                    type: 'base64' as const,
                                    media_type: 'application/pdf' as const,
                                    data: base64Content
                                }
                            }
                        ]
                    }];

                    // Count tokens using Anthropic API for PDF
                    const [count, comparison] = await Promise.all([
                        anthropic.beta.messages.countTokens({
                            betas: ["token-counting-2024-11-01", "pdfs-2024-09-25"],
                            model: model,
                            messages: pdfMessages
                        }),
                        comparisonModel
                            ? anthropic.beta.messages.countTokens({
                                betas: ["token-counting-2024-11-01", "pdfs-2024-09-25"],
                                model: comparisonModel,
                                messages: pdfMessages
                            })
                            : Promise.resolve(null)
                    ]);

                    return Response.json({
                        ...count,
                        fileChars,
                        model: model,
                        gpt4oTokens,
                        geminiTokens,
                        comparisonModel,
                        comparisonTokens: comparison?.input_tokens ?? null
                    });
                }
                else if (fileType === 'image') {
                    // Handle image file
                    const base64Content = Buffer.from(fileContent).toString('base64');

                    // Ensure the media type is one of the supported formats
                    let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg';

                    if (file.type === 'image/png') mediaType = 'image/png';
                    else if (file.type === 'image/gif') mediaType = 'image/gif';
                    else if (file.type === 'image/webp') mediaType = 'image/webp';
                    // Default to JPEG for any other format

                    const imageMessages = [{
                        role: 'user' as const,
                        content: [
                            {
                                type: 'image' as const,
                                source: {
                                    type: 'base64' as const,
                                    media_type: mediaType,
                                    data: base64Content
                                }
                            }
                        ]
                    }];

                    // Count tokens for image using Anthropic API
                    const [count, comparison] = await Promise.all([
                        anthropic.beta.messages.countTokens({
                            betas: ["token-counting-2024-11-01"],
                            model: model,
                            messages: imageMessages
                        }),
                        comparisonModel
                            ? anthropic.beta.messages.countTokens({
                                betas: ["token-counting-2024-11-01"],
                                model: comparisonModel,
                                messages: imageMessages
                            })
                            : Promise.resolve(null)
                    ]);

                    return Response.json({
                        ...count,
                        fileChars,
                        model: model,
                        gpt4oTokens,
                        geminiTokens,
                        comparisonModel,
                        comparisonTokens: comparison?.input_tokens ?? null
                    });
                }
                else {
                    // For text files, convert to UTF-8 string
                    text = new TextDecoder().decode(fileContent);
                    
                    // For text files, we can attempt to get token counts from other models
                    gpt4oTokens = await getGPT4oTokenCount(text);
                    geminiTokens = await getGeminiTokenCount(text);
                }
            }
        } else {
            // Handle direct text input (JSON)
            const jsonData = await req.json();
            text = jsonData.text || '';
            model = jsonData.model || DEFAULT_MODEL;
            comparisonModel = jsonData.comparisonModel || null;

            // Get token counts from other models for text input
            gpt4oTokens = await getGPT4oTokenCount(text);
            geminiTokens = await getGeminiTokenCount(text);
        }

        const textMessages = [{
            role: 'user' as const,
            content: text
        }];

        // Count tokens using Anthropic API for text, plus optional comparison model
        const [count, comparison] = await Promise.all([
            anthropic.beta.messages.countTokens({
                betas: ["token-counting-2024-11-01"],
                model: model,
                messages: textMessages
            }),
            comparisonModel
                ? anthropic.beta.messages.countTokens({
                    betas: ["token-counting-2024-11-01"],
                    model: comparisonModel,
                    messages: textMessages
                })
                : Promise.resolve(null)
        ]);

        return Response.json({
            ...count,
            fileChars,
            model: model,
            gpt4oTokens,
            geminiTokens,
            comparisonModel,
            comparisonTokens: comparison?.input_tokens ?? null
        });
    } catch (error) {
        console.error('Token counting error:', error);
        return Response.json(
            { error: 'Failed to count tokens' },
            { status: 500 }
        );
    }
}