import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('missing ANTHROPIC_API_KEY');
}

// Default model to use if none is provided
const DEFAULT_MODEL = 'claude-3-7-sonnet-20250219';

export async function POST(req: NextRequest) {
    try {
        const anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY,
        });
        
        let text = '';
        let fileChars = 0;
        let model = DEFAULT_MODEL;
        
        // Determine request type based on content-type header
        const contentType = req.headers.get('content-type') || '';
        
        if (contentType.includes('multipart/form-data')) {
            // Handle file upload
            const formData = await req.formData();
            const file = formData.get('file') as File | null;
            const formModel = formData.get('model') as string | null;
            
            if (formModel) {
                model = formModel;
            }
            
            if (file) {
                // For PDF files, we'll convert to base64 for the Anthropic API
                const arrayBuffer = await file.arrayBuffer();
                const fileContent = new Uint8Array(arrayBuffer);
                
                if (file.type === 'application/pdf') {
                    // Convert PDF to base64
                    const base64Content = Buffer.from(fileContent).toString('base64');
                    
                    // Count tokens using Anthropic API for PDF
                    const count = await anthropic.beta.messages.countTokens({
                        betas: ["token-counting-2024-11-01", "pdfs-2024-09-25"],
                        model: model,
                        messages: [{
                            role: 'user',
                            content: [
                                {
                                    type: 'document',
                                    source: {
                                        type: 'base64',
                                        media_type: 'application/pdf',
                                        data: base64Content
                                    }
                                }
                            ]
                        }]
                    });
                    
                    return Response.json({ 
                        ...count,
                        fileChars: fileContent.length,
                        model: model
                    });
                } else {
                    // For text files, we'll convert to UTF-8 string
                    text = new TextDecoder().decode(fileContent);
                    fileChars = text.length;
                }
            }
        } else {
            // Handle direct text input (JSON)
            const jsonData = await req.json();
            text = jsonData.text || '';
            model = jsonData.model || DEFAULT_MODEL;
        }

        // Count tokens using Anthropic API for text
        const count = await anthropic.beta.messages.countTokens({
            betas: ["token-counting-2024-11-01"],
            model: model,
            messages: [{
                role: 'user',
                content: text
            }]
        });
        
        return Response.json({ 
            ...count,
            fileChars,
            model: model
        });
    } catch (error) {
        console.error('Token counting error:', error);
        return Response.json(
            { error: 'Failed to count tokens' },
            { status: 500 }
        );
    }
}