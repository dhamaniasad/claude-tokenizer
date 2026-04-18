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

// Available Claude models, with per-million-token input pricing (USD)
const CLAUDE_MODELS = [
    { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', inputPricePerMTok: 15 },
    { id: 'claude-opus-4-6', name: 'Claude Opus 4.6', inputPricePerMTok: 15 },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', inputPricePerMTok: 3 },
    { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', inputPricePerMTok: 3 },
    { id: 'claude-opus-4-1-20250805', name: 'Claude Opus 4.1', inputPricePerMTok: 15 },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', inputPricePerMTok: 1 },
    { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', inputPricePerMTok: 3 },
    { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', inputPricePerMTok: 15 },
    { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', inputPricePerMTok: 3 },
];

// Input pricing (USD per million tokens) for comparison models.
const GPT4O_INPUT_PRICE_PER_MTOK = 2.5;
const GEMINI_INPUT_PRICE_PER_MTOK = 0.3;

// Format a token-based cost estimate as a dollar amount. Uses more decimal
// places for very small values so the figure doesn't just display as "$0.00".
const formatCost = (tokens: number, pricePerMTok: number): string => {
    const cost = (tokens / 1_000_000) * pricePerMTok;
    if (cost === 0) return '$0.00';
    if (cost < 0.01) return `$${cost.toFixed(5)}`;
    if (cost < 1) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
};

// Opus 4.7 introduced a new tokenizer — when it's selected we also run
// Opus 4.6 for a side-by-side comparison.
const OPUS_47_ID = 'claude-opus-4-7';
const OPUS_46_ID = 'claude-opus-4-6';
const OPUS_46_NAME = 'Claude Opus 4.6';

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
        comparisonTokens: number | null;
        comparisonModel: string | null;
        chars: number;
        fileName?: string
    }>({
        tokens: null,
        gpt4oTokens: null,
        geminiTokens: null,
        comparisonTokens: null,
        comparisonModel: null,
        chars: 0
    });
    const [error, setError] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [showModelDropdown, setShowModelDropdown] = useState(false);

    const handleAnalyzeText = async (text: string) => {
        if (!text.trim()) {
            setStats({
                tokens: null,
                gpt4oTokens: null,
                geminiTokens: null,
                comparisonTokens: null,
                comparisonModel: null,
                chars: 0
            });
            setError(null);
            return;
        }

        try {
            setIsProcessing(true);

            const comparisonModel = selectedModel === OPUS_47_ID ? OPUS_46_ID : null;

            // Get all token counts from the API
            const response = await fetch('/api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text,
                    model: selectedModel,
                    comparisonModel
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
                comparisonTokens:
                    data.comparisonTokens != null && data.comparisonTokens > 7
                        ? data.comparisonTokens - 7
                        : data.comparisonTokens,
                comparisonModel: data.comparisonModel ?? null,
                chars: text.length,
            });
            setError(null);
        } catch (err) {
            console.error("Token counting error:", err);
            setError("Failed to analyze text. Please try again.");
            setStats({
                tokens: null,
                gpt4oTokens: null,
                geminiTokens: null,
                comparisonTokens: null,
                comparisonModel: null,
                chars: text.length
            });
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
            if (selectedModel === OPUS_47_ID) {
                formData.append('comparisonModel', OPUS_46_ID);
            }

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
                comparisonTokens:
                    data.comparisonTokens != null && data.comparisonTokens > 7
                        ? data.comparisonTokens - 7
                        : data.comparisonTokens,
                comparisonModel: data.comparisonModel ?? null,
                chars: data.fileChars || 0,
                fileName: file.name
            });
            setError(null);
        } catch (err) {
            console.error("Token counting error:", err);
            setError("Failed to analyze file. Please try again.");
            setStats({
                tokens: null,
                gpt4oTokens: null,
                geminiTokens: null,
                comparisonTokens: null,
                comparisonModel: null,
                chars: 0
            });
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
            setStats({
                tokens: null,
                gpt4oTokens: null,
                geminiTokens: null,
                comparisonTokens: null,
                comparisonModel: null,
                chars: 0,
                fileName: selectedFile.name
            });
            
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
        setStats({
            tokens: null,
            gpt4oTokens: null,
            geminiTokens: null,
            comparisonTokens: null,
            comparisonModel: null,
            chars: 0
        });
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

    const selectedModelInfo = CLAUDE_MODELS.find(m => m.id === selectedModel);
    const selectedModelName = selectedModelInfo?.name || selectedModel;
    const selectedModelPrice = selectedModelInfo?.inputPricePerMTok ?? null;
    const comparisonModelInfo = stats.comparisonModel
        ? CLAUDE_MODELS.find(m => m.id === stats.comparisonModel)
        : null;
    const comparisonModelPrice = comparisonModelInfo?.inputPricePerMTok ?? null;

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

            {/* Opus 4.7 new-tokenizer notice */}
            {selectedModel === OPUS_47_ID && (
                <div className="rounded-md border border-amber-600/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                    <span className="font-medium">Heads up:</span> Claude Opus 4.7 uses a
                    new tokenizer that typically produces <em>more</em> tokens for the same
                    input than Opus 4.6 and earlier models. For reference we also run the
                    Opus 4.6 tokenizer and show both counts below.
                </div>
            )}

            {/* Token metrics display */}
            <TokenMetrics
                tokens={stats.tokens ?? 0}
                gpt4oTokens={stats.gpt4oTokens}
                geminiTokens={stats.geminiTokens}
                comparisonTokens={stats.comparisonTokens}
                comparisonModelName={
                    stats.comparisonModel === OPUS_46_ID
                        ? OPUS_46_NAME
                        : stats.comparisonModel
                }
                chars={stats.chars}
                isProcessing={isProcessing}
                fileName={stats.fileName}
                fileType={file ? fileType : 'text'}
                model={selectedModelName}
                modelInputPricePerMTok={selectedModelPrice}
                comparisonInputPricePerMTok={comparisonModelPrice}
            />
        </div>
    );
};

interface TokenMetricsProps {
    tokens: number;
    gpt4oTokens: number | null;
    geminiTokens: number | null;
    comparisonTokens: number | null;
    comparisonModelName: string | null;
    chars: number;
    isProcessing: boolean;
    fileName?: string;
    fileType: 'image' | 'pdf' | 'text' | 'unknown';
    model: string;
    modelInputPricePerMTok: number | null;
    comparisonInputPricePerMTok: number | null;
}

export const TokenMetrics = ({ tokens, gpt4oTokens, geminiTokens, comparisonTokens, comparisonModelName, chars, isProcessing, fileName, fileType, model, modelInputPricePerMTok, comparisonInputPricePerMTok }: TokenMetricsProps) => {
    // Calculate percentage differences when tokens are available
    const calculatePercentageDiff = (compareTokens: number | null, baseTokens: number): string => {
        if (compareTokens === null || baseTokens === 0) return '';
        
        const diff = ((compareTokens - baseTokens) / baseTokens) * 100;
        const formattedDiff = Math.abs(diff).toFixed(1);
        
        // Return formatted string with plus or minus sign
        return diff < 0
            ? ` (−${formattedDiff}%)` // minus sign (use Unicode minus for better typography)
            : ` (+${formattedDiff}%)`;
    };
    
    // Get percentage differences
    const gpt4oDiff = tokens > 0 && gpt4oTokens !== null
        ? calculatePercentageDiff(gpt4oTokens, tokens)
        : '';
    
    const geminiDiff = tokens > 0 && geminiTokens !== null
        ? calculatePercentageDiff(geminiTokens, tokens)
        : '';

    // Comparison shows how many fewer (or more) tokens the other Claude tokenizer
    // produced vs. the currently selected model.
    const comparisonDiff = tokens > 0 && comparisonTokens !== null
        ? calculatePercentageDiff(comparisonTokens, tokens)
        : '';

    return (
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
                {!isProcessing && tokens > 0 && modelInputPricePerMTok !== null && (
                    <p className="text-xs text-neutral-500">
                        Est. input cost: {formatCost(tokens, modelInputPricePerMTok)}
                        <span className="text-neutral-600"> @ ${modelInputPricePerMTok}/MTok</span>
                    </p>
                )}
            </div>

            {/* Comparison Claude tokenizer (e.g. Opus 4.6 vs selected Opus 4.7) */}
            {comparisonModelName && (
                <div className="space-y-1">
                    <h2 className="text-xs font-medium text-neutral-400">
                        {comparisonModelName} Tokens
                    </h2>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-light">
                            {isProcessing ? (
                                <span className="animate-pulse">...</span>
                            ) : comparisonTokens !== null ? (
                                comparisonTokens.toLocaleString()
                            ) : (
                                "—"
                            )}
                        </p>
                        {!isProcessing && comparisonTokens !== null && tokens > 0 && (
                            <span className={`text-sm ${comparisonDiff.includes('−') ? 'text-green-400' : 'text-orange-400'}`}>
                                {comparisonDiff}
                            </span>
                        )}
                    </div>
                    {!isProcessing && comparisonTokens !== null && comparisonTokens > 0 && comparisonInputPricePerMTok !== null && (
                        <p className="text-xs text-neutral-500">
                            Est. input cost: {formatCost(comparisonTokens, comparisonInputPricePerMTok)}
                            <span className="text-neutral-600"> @ ${comparisonInputPricePerMTok}/MTok</span>
                        </p>
                    )}
                </div>
            )}

            {/* GPT-4o Tokens - only show for text inputs */}
            {(fileType === 'text' || !fileName) && (
                <div className="space-y-1">
                    <h2 className="text-xs font-medium text-neutral-400">GPT-4o Tokens</h2>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-light">
                            {isProcessing ? (
                                <span className="animate-pulse">...</span>
                            ) : gpt4oTokens !== null ? (
                                gpt4oTokens.toLocaleString()
                            ) : (
                                "—"
                            )}
                        </p>
                        {!isProcessing && gpt4oTokens !== null && tokens > 0 && (
                            <span className={`text-sm ${gpt4oDiff.includes('−') ? 'text-green-400' : 'text-orange-400'}`}>
                                {gpt4oDiff}
                            </span>
                        )}
                    </div>
                    {!isProcessing && gpt4oTokens !== null && gpt4oTokens > 0 && (
                        <p className="text-xs text-neutral-500">
                            Est. input cost: {formatCost(gpt4oTokens, GPT4O_INPUT_PRICE_PER_MTOK)}
                            <span className="text-neutral-600"> @ ${GPT4O_INPUT_PRICE_PER_MTOK}/MTok</span>
                        </p>
                    )}
                </div>
            )}

            {/* Gemini Tokens - only show for text inputs */}
            {(fileType === 'text' || !fileName) && (
                <div className="space-y-1">
                    <h2 className="text-xs font-medium text-neutral-400">Gemini Tokens</h2>
                    <div className="flex items-baseline gap-2">
                        <p className="text-3xl font-light">
                            {isProcessing ? (
                                <span className="animate-pulse">...</span>
                            ) : geminiTokens !== null ? (
                                geminiTokens.toLocaleString()
                            ) : (
                                "—"
                            )}
                        </p>
                        {!isProcessing && geminiTokens !== null && tokens > 0 && (
                            <span className={`text-sm ${geminiDiff.includes('−') ? 'text-green-400' : 'text-orange-400'}`}>
                                {geminiDiff}
                            </span>
                        )}
                    </div>
                    {!isProcessing && geminiTokens !== null && geminiTokens > 0 && (
                        <p className="text-xs text-neutral-500">
                            Est. input cost: {formatCost(geminiTokens, GEMINI_INPUT_PRICE_PER_MTOK)}
                            <span className="text-neutral-600"> @ ${GEMINI_INPUT_PRICE_PER_MTOK}/MTok</span>
                        </p>
                    )}
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
};