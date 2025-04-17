import { useState, useEffect, useCallback } from 'react';
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Upload, FileText, Image as ImageIcon, X, ChevronDown } from "lucide-react";

// Debounce utility function
const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Available Claude models
const CLAUDE_MODELS = [
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet' },
    { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet' },
    { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku' },
    { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
    { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
    { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' },
];

// List of supported file types
const ACCEPTED_FILE_TYPES = {
    image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'],
    pdf: ['.pdf'],
    text: ['.txt', '.md', '.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.csv']
};

// Get accepted file types string for file input
const getAcceptedFileTypes = () => {
    return [
        ...ACCEPTED_FILE_TYPES.image,
        ...ACCEPTED_FILE_TYPES.pdf,
        ...ACCEPTED_FILE_TYPES.text
    ].join(',');
};

// Determine file type category
const getFileTypeCategory = (file: File): 'image' | 'pdf' | 'text' | 'unknown' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type === 'application/pdf') return 'pdf';
    if (file.type.includes('text') ||
        file.type.includes('javascript') ||
        file.type.includes('json') ||
        file.type.includes('html') ||
        file.type.includes('css') ||
        file.name.endsWith('.md') ||
        file.name.endsWith('.csv')) return 'text';
    return 'unknown';
};

export const TokenizerInput = () => {
    const [text, setText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [fileType, setFileType] = useState<'image' | 'pdf' | 'text' | 'unknown'>('unknown');
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [selectedModel, setSelectedModel] = useState(CLAUDE_MODELS[0].id);
    const [stats, setStats] = useState<{
        tokens: number | null;
        gpt4oTokens: number | null;
        geminiTokens: number | null;
        chars: number;
        fileName?: string
    }>({
        tokens: null, 
        gpt4oTokens: null,
        geminiTokens: null,
        chars: 0 
    });
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    const handleAnalyzeText = async (text: string) => {
        if (!text.trim()) {
            setStats({ tokens: null, gpt4oTokens: null, geminiTokens: null, chars: 0 });
            setError(null);
            return;
        }

        try {
            setIsProcessing(true);
            
            // Get all token counts from the API
            const response = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    model: selectedModel
                }),
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            setStats({
                tokens: data.input_tokens > 7 ? data.input_tokens - 7 : 0,
                gpt4oTokens: data.gpt4oTokens,
                geminiTokens: data.geminiTokens,
                chars: text.length,
            });
            setError(null);
        } catch (err) {
            console.error("Token counting error:", err);
            setError("Failed to analyze text. Please try again.");
            setStats({ tokens: null, gpt4oTokens: null, geminiTokens: null, chars: text.length });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAnalyzeFile = async () => {
        if (!file) return;
        
        setIsProcessing(true);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('model', selectedModel);
            formData.append('fileType', fileType);
            
            const response = await fetch('/api', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`API request failed with status ${response.status}`);
            }

            const data = await response.json();
            setStats({
                tokens: data.input_tokens > 7 ? data.input_tokens - 7 : 0,
                gpt4oTokens: data.gpt4oTokens,
                geminiTokens: data.geminiTokens,
                chars: data.fileChars || 0,
                fileName: file.name
            });
            setError(null);
        } catch (err) {
            console.error("Token counting error:", err);
            setError("Failed to analyze file. Please try again.");
            setStats({ tokens: null, gpt4oTokens: null, geminiTokens: null, chars: 0 });
        } finally {
            setIsProcessing(false);
        }
    };

    // Debounced version of handleAnalyzeText
    const debouncedHandleAnalyzeText = useCallback(debounce(handleAnalyzeText, 300), [selectedModel]);

    useEffect(() => {
        if (!file && text) {
            debouncedHandleAnalyzeText(text);
        }
    }, [text, debouncedHandleAnalyzeText, file]);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0] || null;
        if (selectedFile) {
            const type = getFileTypeCategory(selectedFile);
            setFile(selectedFile);
            setFileType(type);
            setText('');
            setStats({ tokens: null, gpt4oTokens: null, geminiTokens: null, chars: 0, fileName: selectedFile.name });
            
            // Create preview for image files
            if (type === 'image') {
                const reader = new FileReader();
                reader.onload = (e) => {
                    setFilePreview(e.target?.result as string);
                };
                reader.readAsDataURL(selectedFile);
            } else {
                setFilePreview(null);
            }
        }
    };

    const clearFile = () => {
        setFile(null);
        setFileType('unknown');
        setFilePreview(null);
        setStats({ tokens: null, gpt4oTokens: null, geminiTokens: null, chars: 0 });
        // Reset the file input
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if (fileInput) {
            fileInput.value = '';
        }
    };

    const toggleModelDropdown = () => {
        setShowModelDropdown(!showModelDropdown);
    };

    const selectModel = (modelId: string) => {
        setSelectedModel(modelId);
        setShowModelDropdown(false);
    };

    const selectedModelName = CLAUDE_MODELS.find(m => m.id === selectedModel)?.name || selectedModel;

    return (
        <div className="flex flex-col space-y-4 max-w-3xl mx-auto">
            {/* Model selector */}
            <div className="flex justify-end mb-2 relative">
                <div
                    className="flex items-center gap-2 cursor-pointer rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
                    onClick={toggleModelDropdown}
                >
                    <span>{selectedModelName}</span>
                    <ChevronDown size={16} className={`transition-transform ${showModelDropdown ? 'rotate-180' : ''}`} />
                </div>
                
                {showModelDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-neutral-700 bg-neutral-800 shadow-lg z-10">
                        <div className="py-1">
                            {CLAUDE_MODELS.map((model) => (
                                <div
                                    key={model.id}
                                    className={`px-4 py-2 text-sm cursor-pointer hover:bg-neutral-700 ${model.id === selectedModel ? 'bg-neutral-700' : ''}`}
                                    onClick={() => selectModel(model.id)}
                                >
                                    {model.name}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* File upload and display area */}
            <div className="flex items-center justify-between gap-4 mb-3">
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <input
                            type="file"
                            id="file-upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                            accept={getAcceptedFileTypes()}
                        />
                        <button className="flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700 border border-neutral-700">
                            <Upload size={16} />
                            Upload File
                        </button>
                    </div>
                    {file && (
                        <div className="flex items-center rounded-md bg-neutral-800 border border-neutral-700 px-3 py-1.5 text-sm">
                            {fileType === 'image' && <ImageIcon size={14} className="mr-2" />}
                            {fileType === 'pdf' && <FileText size={14} className="mr-2" />}
                            {fileType === 'text' && <FileText size={14} className="mr-2" />}
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <button 
                                onClick={clearFile}
                                className="ml-2 text-neutral-400 hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>
                {file && (
                    <button
                        onClick={handleAnalyzeFile}
                        disabled={isProcessing}
                        className="whitespace-nowrap rounded-md bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 border border-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isProcessing ? 'Processing...' : 'Count Tokens'}
                    </button>
                )}
            </div>
            
            {/* Image preview */}
            {filePreview && fileType === 'image' && (
                <div className="rounded-xl border border-neutral-700 bg-neutral-800 p-4 flex justify-center">
                    <img
                        src={filePreview}
                        alt="Preview"
                        className="max-h-64 object-contain rounded-md"
                    />
                </div>
            )}
            
            {/* Text input area */}
            {!file && (
                <div className="rounded-xl border border-neutral-700 bg-neutral-800 overflow-hidden">
                    <Textarea
                        placeholder="Enter some text to count tokens..."
                        rows={10}
                        className="font-mono bg-transparent border-0 focus-visible:ring-0 resize-none p-4"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        disabled={isProcessing}
                    />
                </div>
            )}
            
            {error && <p className="text-orange-400 mb-2">{error}</p>}
            
            {/* Token metrics display */}
            <TokenMetrics 
                tokens={stats.tokens ?? 0} 
                gpt4oTokens={stats.gpt4oTokens}
                geminiTokens={stats.geminiTokens}
                chars={stats.chars} 
                isProcessing={isProcessing}
                fileName={stats.fileName}
                fileType={file ? fileType : 'text'}
                model={selectedModelName}
            />
        </div>
    );
};

interface TokenMetricsProps {
    tokens: number;
    gpt4oTokens: number | null;
    geminiTokens: number | null;
    chars: number;
    isProcessing: boolean;
    fileName?: string;
    fileType: 'image' | 'pdf' | 'text' | 'unknown';
    model: string;
}

export const TokenMetrics = ({ tokens, gpt4oTokens, geminiTokens, chars, isProcessing, fileName, fileType, model }: TokenMetricsProps) => (
    <div className="flex flex-wrap gap-6 p-4 rounded-xl bg-neutral-800 border border-neutral-700">
        {/* Claude Tokens */}
        <div className="space-y-1">
            <h2 className="text-xs font-medium text-neutral-400">Claude Tokens</h2>
            <p className="text-3xl font-light">
                {isProcessing ? (
                    <span className="animate-pulse">...</span>
                ) : (
                    tokens.toLocaleString()
                )}
            </p>
        </div>
        
        {/* GPT-4o Tokens - only show for text inputs */}
        {(fileType === 'text' || !fileName) && (
            <div className="space-y-1">
                <h2 className="text-xs font-medium text-neutral-400">GPT-4o Tokens</h2>
                <p className="text-3xl font-light">
                    {isProcessing ? (
                        <span className="animate-pulse">...</span>
                    ) : gpt4oTokens !== null ? (
                        gpt4oTokens.toLocaleString()
                    ) : (
                        "—"
                    )}
                </p>
            </div>
        )}
        
        {/* Gemini Tokens - only show for text inputs */}
        {(fileType === 'text' || !fileName) && (
            <div className="space-y-1">
                <h2 className="text-xs font-medium text-neutral-400">Gemini Tokens</h2>
                <p className="text-3xl font-light">
                    {isProcessing ? (
                        <span className="animate-pulse">...</span>
                    ) : geminiTokens !== null ? (
                        geminiTokens.toLocaleString()
                    ) : (
                        "—"
                    )}
                </p>
            </div>
        )}
        
        {/* Character Count */}
        <div className="space-y-1">
            <h2 className="text-xs font-medium text-neutral-400">Characters</h2>
            <p className="text-3xl font-light">
                {isProcessing ? (
                    <span className="animate-pulse">...</span>
                ) : (
                    chars.toLocaleString()
                )}
            </p>
        </div>
        
        {/* Model */}
        <div className="space-y-1">
            <h2 className="text-xs font-medium text-neutral-400">Model</h2>
            <p className="text-sm">{model}</p>
        </div>
        
        {/* File info if applicable */}
        {fileName && (
            <div className="space-y-1 flex-1">
                <h2 className="text-xs font-medium text-neutral-400">
                    {fileType === 'image' ? 'Image' : fileType === 'pdf' ? 'PDF' : 'File'}
                </h2>
                <p className="text-sm truncate">{fileName}</p>
            </div>
        )}
    </div>
);