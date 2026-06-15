import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Send, Mic, Copy, Play, Layout, X, Paperclip, FileText, FileSpreadsheet, Music, Volume2, Code, Terminal, Monitor, Tablet, Smartphone, Download, Eye, Trash2, Image, File, UploadCloud, Brain, ChevronDown, CheckCircle2, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

interface Attachment {
    data: string; // Base64 or text representation
    fileName: string;
    mimeType: string;
    fileSize: number;
    extractedText?: string;
}

interface Message {
    _id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachment?: { data: string, mimeType: string };
    attachments?: Attachment[];
    provider?: string;
}

const VLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}>
        <path d="M3 4L12 21L21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 4L12 11L15.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <path d="M12 21V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
);

// Code Editor with scroll-synced line numbers
const LineNumberTextarea = ({ value, onChange }: { value: string; onChange: (val: string) => void }) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const gutterRef = useRef<HTMLDivElement>(null);

    const handleScroll = () => {
        if (textareaRef.current && gutterRef.current) {
            gutterRef.current.scrollTop = textareaRef.current.scrollTop;
        }
    };

    const lineCount = value.split('\n').length;
    const lineNumbers = Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1);

    return (
        <div className="flex-1 flex overflow-hidden bg-[#0A0A0A] border border-white/10 rounded-2xl relative font-mono text-[13px] leading-[1.6]">
            {/* Gutter */}
            <div 
                ref={gutterRef}
                className="w-12 py-4 select-none text-right pr-3 text-white/30 bg-black/40 border-r border-white/5 overflow-hidden font-mono text-[13px] leading-[1.6] font-variant-numeric-tabular-nums"
            >
                {lineNumbers.map(n => (
                    <div key={n} className="h-[20.8px]">{n}</div>
                ))}
            </div>
            {/* Editor */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                className="flex-grow p-4 bg-transparent text-white outline-none resize-none overflow-y-auto font-mono text-[13px] leading-[1.6] h-full"
                spellCheck={false}
            />
        </div>
    );
};

interface ParsedContent {
    text: string;
    codeBlocks: Array<{ language: string; code: string; isComplete: boolean }>;
}

const parseMessageContent = (content: string): ParsedContent => {
    const codeBlocks: Array<{ language: string; code: string; isComplete: boolean }> = [];
    let text = '';
    
    const parts = content.split('```');
    
    for (let i = 0; i < parts.length; i++) {
        if (i % 2 === 0) {
            text += parts[i];
        } else {
            const blockContent = parts[i];
            const lines = blockContent.split('\n');
            const language = lines[0].trim();
            const code = lines.slice(1).join('\n');
            const isComplete = i < parts.length - 1;
            
            codeBlocks.push({
                language,
                code,
                isComplete
            });
        }
    }
    
    return {
        text: text.trim(),
        codeBlocks
    };
};

interface ThinkingProcessProps {
    msgId: string;
    model: string;
    isGenerating: boolean;
    contentLength: number;
    expandedThoughts: Record<string, boolean>;
    toggleThought: (id: string) => void;
    codeBlocks: Array<{ language: string; code: string; isComplete: boolean }>;
    setActiveArtifact: (artifact: { code: string; id: string } | null) => void;
}

const ThinkingProcess = ({
    msgId,
    model,
    isGenerating,
    contentLength,
    expandedThoughts,
    toggleThought,
    codeBlocks,
    setActiveArtifact
}: ThinkingProcessProps) => {
    const isExpanded = expandedThoughts[msgId] !== undefined ? expandedThoughts[msgId] : isGenerating;

    // Define steps based on model
    let steps: Array<{ title: string; desc: string }> = [];
    if (model === 'gemini') {
        steps = [
            { title: "Analyzing Inputs", desc: "Reading prompt context and attachment tokens..." },
            { title: "Multimodal Mapping", desc: "Mapping image/document vectors into Gemini context window..." },
            { title: "Cross-Attention Reasoning", desc: "Structuring response weights via multi-head attention..." },
            { title: "Content Stream", desc: "Streaming finalized response content..." }
        ];
    } else if (model === 'gemma-local') {
        steps = [
            { title: "Initializing Context", desc: "Loading localized token sequences into GPU/CPU RAM..." },
            { title: "Local Matrix Processing", desc: "Evaluating weights using Gemma 4 neural layers..." },
            { title: "Sampling & Filtering", desc: "Applying top-p/temperature scaling & refining tokens..." },
            { title: "Token Generation", desc: "Streaming response chunks to frontend view..." }
        ];
    } else { // offline
        steps = [
            { title: "Cache Scan", desc: "Searching local database index for matching embeddings..." },
            { title: "RAG Vector Search", desc: "Ranking nearest database vectors and pulling RAG text..." },
            { title: "Synthesizing Answers", desc: "Formulating answer structures from offline repository..." },
            { title: "Static Output", desc: "Streaming static local database content..." }
        ];
    }

    // Determine current active step based on generation state and length
    let activeStepIdx = 3; // default to completed
    if (isGenerating) {
        if (contentLength === 0) activeStepIdx = 0;
        else if (contentLength < 100) activeStepIdx = 1;
        else if (contentLength < 400) activeStepIdx = 2;
        else activeStepIdx = 3;
    }

    // Color theme classes based on model
    const theme = {
        gemini: {
            text: 'text-blue-400',
            bg: 'bg-blue-500/5 hover:bg-blue-500/10',
            border: 'border-blue-500/10',
            glow: 'shadow-[0_0_15px_rgba(59,130,246,0.05)]',
            iconColor: 'text-blue-400',
            accentBg: 'bg-blue-500/10'
        },
        'gemma-local': {
            text: 'text-amber-500',
            bg: 'bg-amber-500/5 hover:bg-amber-500/10',
            border: 'border-amber-500/10',
            glow: 'shadow-[0_0_15px_rgba(245,158,11,0.05)]',
            iconColor: 'text-amber-500',
            accentBg: 'bg-amber-500/10'
        },
        offline: {
            text: 'text-emerald-500',
            bg: 'bg-emerald-500/5 hover:bg-emerald-500/10',
            border: 'border-emerald-500/10',
            glow: 'shadow-[0_0_15px_rgba(16,185,129,0.05)]',
            iconColor: 'text-emerald-500',
            accentBg: 'bg-emerald-500/10'
        }
    }[model] || {
        text: 'text-gray-400',
        bg: 'bg-white/5 hover:bg-white/10',
        border: 'border-white/10',
        glow: '',
        iconColor: 'text-gray-400',
        accentBg: 'bg-white/10'
    };

    return (
        <div className={`mb-3.5 w-full rounded-[16px] border ${theme.border} bg-[#0c0c0e]/40 ${theme.glow} overflow-hidden backdrop-blur-md transition-all duration-300`}>
            {/* Header */}
            <button
                type="button"
                onClick={() => toggleThought(msgId)}
                className="w-full flex items-center justify-between px-4 py-2 hover:bg-white/5 transition-all text-left group cursor-pointer"
            >
                <div className="flex items-center gap-2">
                    <Brain size={14} className={`${theme.text} ${isGenerating ? 'animate-pulse' : ''}`} />
                    <span className="text-[11px] font-bold tracking-wider uppercase text-white/90">
                        {isGenerating ? 'Thinking Process' : 'Thought Process'}
                    </span>
                    {isGenerating && (
                        <span className="flex h-1.5 w-1.5 relative">
                            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${model === 'gemini' ? 'bg-blue-400' : model === 'gemma-local' ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>
                            <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${model === 'gemini' ? 'bg-blue-500' : model === 'gemma-local' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <span className={`text-[9px] uppercase tracking-widest font-bold font-mono px-2 py-0.5 rounded-md border bg-white/5 ${theme.text} ${theme.border}`}>
                        {model === 'gemini' ? 'Gemini AI' : model === 'gemma-local' ? 'Gemma 4' : 'Offline'}
                    </span>
                    <ChevronDown 
                        size={12} 
                        className={`text-gray-400 group-hover:text-white transition-transform duration-250 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </button>

            {/* Steps list & Code blocks */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="border-t border-white/5 px-4 py-2.5 min-h-0 flex flex-col gap-3 bg-black/10"
                    >
                        {/* Process Steps */}
                        <div className="flex flex-col gap-2">
                            {steps.map((step, idx) => {
                                const isCompleted = !isGenerating || idx < activeStepIdx;
                                const isActive = isGenerating && idx === activeStepIdx;
                                const isPending = isGenerating && idx > activeStepIdx;

                                return (
                                    <div 
                                        key={idx} 
                                        className={`flex gap-3 items-center transition-all duration-300 ${isPending ? 'opacity-35' : 'opacity-100'}`}
                                    >
                                        {/* Icon Column */}
                                        <div className="flex items-center justify-center h-4 shrink-0">
                                            {isCompleted ? (
                                                <CheckCircle2 size={13} className={theme.iconColor} />
                                            ) : isActive ? (
                                                <Loader2 size={13} className={`${theme.iconColor} animate-spin`} />
                                            ) : (
                                                <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                                            )}
                                        </div>

                                        {/* Details Column */}
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className={`text-[11px] font-bold tracking-wide transition-all shrink-0 ${isActive ? theme.text : isCompleted ? 'text-white/80' : 'text-gray-500'}`}>
                                                {step.title}
                                            </span>
                                            <span className="text-[10px] text-gray-500 hidden sm:inline select-none">•</span>
                                            <span className="text-[10px] text-gray-400 truncate">
                                                {step.desc}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Extracted Code Blocks */}
                        {codeBlocks.length > 0 && (
                            <div className="mt-2 border-t border-white/5 pt-3.5 flex flex-col gap-2.5">
                                <div className="flex items-center gap-2 px-1">
                                    <Code size={13} className={theme.text} />
                                    <span className="text-[10px] font-bold tracking-wider uppercase text-white/80">
                                        Generated Code ({codeBlocks.length})
                                    </span>
                                </div>
                                
                                {codeBlocks.map((block, bIdx) => {
                                    const isHtml = block.language === 'html';
                                    const showPreviewButton = isHtml && !isGenerating;
                                    
                                    return (
                                        <div key={bIdx} className="relative group/code overflow-hidden rounded-xl border border-white/10 shadow-lg bg-[#050505]">
                                            {showPreviewButton && (
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveArtifact({ code: block.code, id: Date.now().toString() })}
                                                    className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover/code:opacity-100 transition-opacity bg-blue-600/90 hover:bg-blue-500 text-white text-[11px] px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg font-medium backdrop-blur-md border border-blue-400/30 cursor-pointer"
                                                >
                                                    <Layout size={13} />
                                                    Preview UI
                                                </button>
                                            )}
                                            {block.language && (
                                                <div className="bg-white/5 px-3 py-1 text-[10px] text-gray-400 font-semibold font-mono border-b border-white/5 flex items-center justify-between">
                                                    <span>{block.language.toUpperCase()}</span>
                                                    {!block.isComplete && isGenerating && (
                                                        <span className="text-[9px] text-blue-400 animate-pulse font-sans font-bold uppercase tracking-wider">
                                                            Generating...
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <div className="overflow-x-auto w-full max-w-full text-xs">
                                                <SyntaxHighlighter
                                                    PreTag="div"
                                                    children={block.code.replace(/\n$/, '')}
                                                    language={block.language || 'text'}
                                                    style={vscDarkPlus}
                                                    className="m-0 p-3 text-[12px] font-mono leading-[1.5]"
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default function ChatView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { chats, setChats } = useStore();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini');
    const [activeArtifact, setActiveArtifact] = useState<{code: string, id: string} | null>(null);
    
    // Upload Category & Drag-and-Drop States
    const [isUploadMenuOpen, setIsUploadMenuOpen] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    
    // Collapsible Thinking Process state
    const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});

    const toggleThought = (msgId: string) => {
        setExpandedThoughts(prev => ({
            ...prev,
            [msgId]: !prev[msgId]
        }));
    };
    
    // File inputs refs
    const docInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);
    const spreadsheetInputRef = useRef<HTMLInputElement>(null);
    const codeInputRef = useRef<HTMLInputElement>(null);
    const audioInputRef = useRef<HTMLInputElement>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);
    
    const handleChatScroll = () => {
        const container = chatContainerRef.current;
        if (!container) return;
        const threshold = 100;
        const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
        isAtBottomRef.current = isNearBottom;
    };

    // Sandbox upgrades state
    const [artifactTab, setArtifactTab] = useState<'preview' | 'code' | 'console'>('preview');
    const [artifactViewport, setArtifactViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [artifactCode, setArtifactCode] = useState<string>('');
    const [consoleLogs, setConsoleLogs] = useState<Array<{ level: 'log' | 'warn' | 'error'; text: string; timestamp: string }>>([]);

    // Debounced code for iframe updates to avoid heavy reloads
    const [debouncedArtifactCode, setDebouncedArtifactCode] = useState<string>('');

    // Audio note recording state
    const [isRecordingAudio, setIsRecordingAudio] = useState(false);
    const [recordingDuration, setRecordingDuration] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingIntervalRef = useRef<any>(null);

    const recognitionRef = useRef<any>(null);

    // Sync artifact code state when active artifact changes
    useEffect(() => {
        if (activeArtifact) {
            setArtifactCode(activeArtifact.code);
            setDebouncedArtifactCode(activeArtifact.code);
            setConsoleLogs([]);
            setArtifactTab('preview');
            setArtifactViewport('desktop');
        } else {
            setArtifactCode('');
            setDebouncedArtifactCode('');
            setConsoleLogs([]);
        }
    }, [activeArtifact]);

    // Debounce the code editor inputs to update the iframe
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedArtifactCode(artifactCode);
        }, 400); // 400ms is standard for responsive editing updates
        return () => clearTimeout(timer);
    }, [artifactCode]);

    // Handle console log postMessage events from iframe
    useEffect(() => {
        const handleIframeMessage = (e: MessageEvent) => {
            if (e.data && e.data.type === 'CONSOLE_LOG') {
                setConsoleLogs(prev => [...prev, {
                    level: e.data.level,
                    text: e.data.text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                }]);
            }
        };
        window.addEventListener('message', handleIframeMessage);
        return () => window.removeEventListener('message', handleIframeMessage);
    }, []);

    useEffect(() => {
        if (id) {
            fetchMessages().then(() => {
                const initialMsg = location.state?.initialMessage;
                const initialAttachment = location.state?.initialAttachment;
                const initialAttachments = location.state?.initialAttachments;
                const passedModel = location.state?.selectedModel;
                
                if (passedModel) {
                    setSelectedModel(passedModel);
                }

                if ((initialMsg || initialAttachment || initialAttachments) && messages.length === 0) {
                    navigate(location.pathname, { replace: true, state: {} });
                    setInput('');
                    setAttachments([]);
                    
                    let targetAttachments: Attachment[] = [];
                    if (initialAttachments && Array.isArray(initialAttachments)) {
                        targetAttachments = initialAttachments;
                    } else if (initialAttachment) {
                        targetAttachments = [initialAttachment];
                    }
                    // Provide the passed model directly to handleSend to ensure it uses the right one
                    // even before state has updated
                    handleSend(undefined, initialMsg, targetAttachments, passedModel);
                }
            });
        } else {
            setMessages([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const prevMessagesLength = useRef(0);
    useEffect(() => {
        if (messages.length > prevMessagesLength.current) {
            isAtBottomRef.current = true;
            chatContainerRef.current?.scrollTo({
                top: chatContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        } else if (isAtBottomRef.current && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
        prevMessagesLength.current = messages.length;
    }, [messages, isTyping]);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recognition = new SpeechRecognition();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = 'en-US';

            recognition.onresult = (event: any) => {
                const text = event.results[0][0].transcript;
                setInput(prev => prev ? prev + ' ' + text : text);
            };

            recognition.onend = () => setIsListening(false);
            recognition.onerror = (e: any) => {
                console.error("Speech recognition error", e);
                setIsListening(false);
            };

            recognitionRef.current = recognition;
        }
    }, []);

    const fetchMessages = async () => {
        try {
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats/${id}/messages`);
            if (!res.ok) {
                throw new Error('Failed to fetch messages');
            }
            const data = await res.json();
            setMessages(data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFiles = (files: FileList | File[]) => {
        const promises = Array.from(files).map(file => {
            return new Promise<Attachment>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    let mimeType = file.type;
                    if (!mimeType) {
                        const ext = file.name.split('.').pop()?.toLowerCase();
                        if (ext === 'pdf') mimeType = 'application/pdf';
                        else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        else if (ext === 'xls') mimeType = 'application/vnd.ms-excel';
                        else if (ext === 'csv') mimeType = 'text/csv';
                        else if (ext === 'txt') mimeType = 'text/plain';
                        else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                        else mimeType = 'application/octet-stream';
                    }
                    resolve({
                        data: reader.result as string,
                        fileName: file.name,
                        mimeType: mimeType,
                        fileSize: file.size
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises)
            .then(newAtts => {
                setAttachments(prev => [...prev, ...newAtts]);
            })
            .catch(err => {
                console.error("Error reading files:", err);
            });
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        handleFiles(files);
        
        // Clear all inputs so user can select the same file again if desired
        if (docInputRef.current) docInputRef.current.value = '';
        if (imageInputRef.current) imageInputRef.current.value = '';
        if (spreadsheetInputRef.current) spreadsheetInputRef.current.value = '';
        if (codeInputRef.current) codeInputRef.current.value = '';
        if (audioInputRef.current) audioInputRef.current.value = '';
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFiles(files);
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        let filesToProcess: File[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile();
                if (file) {
                    filesToProcess.push(file);
                }
            }
        }

        if (filesToProcess.length === 0) return;

        e.preventDefault();

        const promises = filesToProcess.map(file => {
            return new Promise<Attachment>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    let mimeType = file.type;
                    if (!mimeType) {
                        const ext = file.name ? file.name.split('.').pop()?.toLowerCase() : 'png';
                        if (ext === 'pdf') mimeType = 'application/pdf';
                        else if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                        else if (ext === 'xls') mimeType = 'application/vnd.ms-excel';
                        else if (ext === 'csv') mimeType = 'text/csv';
                        else if (ext === 'txt') mimeType = 'text/plain';
                        else if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext || '')) mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
                        else mimeType = 'application/octet-stream';
                    }
                    resolve({
                        data: reader.result as string,
                        fileName: file.name || `pasted_file_${Date.now()}`,
                        mimeType: mimeType,
                        fileSize: file.size
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        });

        Promise.all(promises)
            .then(newAtts => {
                setAttachments(prev => [...prev, ...newAtts]);
            })
            .catch(err => {
                console.error("Error reading pasted files:", err);
            });
    };

    const startAudioRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64Data = reader.result as string;
                    const newAttachment: Attachment = {
                        data: base64Data,
                        fileName: `voice_note_${Date.now()}.webm`,
                        mimeType: 'audio/webm',
                        fileSize: audioBlob.size
                    };
                    setAttachments(prev => [...prev, newAttachment]);
                };
                reader.readAsDataURL(audioBlob);
                
                stream.getTracks().forEach(track => track.stop());
            };

            mediaRecorder.start();
            setIsRecordingAudio(true);
            setRecordingDuration(0);
            recordingIntervalRef.current = setInterval(() => {
                setRecordingDuration(prev => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Failed to start audio recording", err);
            alert("Could not access microphone for voice note recording.");
        }
    };

    const stopAudioRecording = () => {
        if (mediaRecorderRef.current && isRecordingAudio) {
            mediaRecorderRef.current.stop();
            setIsRecordingAudio(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
        }
    };

    const cancelAudioRecording = () => {
        if (mediaRecorderRef.current && isRecordingAudio) {
            mediaRecorderRef.current.onstop = null;
            mediaRecorderRef.current.stop();
            setIsRecordingAudio(false);
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
            }
            if (mediaRecorderRef.current.stream) {
                mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
            }
        }
    };

    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
            }
        };
    }, []);

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setIsTyping(false);
        }
    };

    const handleSend = async (e?: React.FormEvent, initialMessageText?: string, initialAttachments?: Attachment[], forceModel?: string) => {
        e?.preventDefault();
        const textToSend = initialMessageText !== undefined ? initialMessageText : input.trim();
        const currentAttachments = initialAttachments !== undefined ? initialAttachments : attachments;
        const modelToUse = forceModel || selectedModel;

        if (!textToSend && currentAttachments.length === 0) return;

        if (!id) {
            try {
                setInput('');
                setAttachments([]);
                const reqTitle = textToSend.length > 20 ? textToSend.substring(0, 20) + '...' : (textToSend || 'New Chat');
                const res = await fetch(`http://${window.location.hostname}:5000/api/chats`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ title: reqTitle })
                });
                if (res.ok) {
                    const newChat = await res.json();
                    setChats([newChat, ...chats]);
                    navigate(`/c/${newChat._id}`, { state: { initialMessage: textToSend, initialAttachments: currentAttachments, selectedModel } });
                }
            } catch (err) {
                console.error(err);
            }
            return;
        }

        const userMessage: Message = { _id: Date.now().toString(), role: 'user', content: textToSend, attachments: currentAttachments };
        setMessages(prev => [...prev, userMessage]);
        if (initialMessageText === undefined) {
            setInput('');
            setAttachments([]);
        }
        setIsTyping(true);

        const controller = new AbortController();
        setAbortController(controller);

        const userId = localStorage.getItem('vchat_user_id') || 'default_user';

        try {
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({ chatId: id, message: textToSend, attachments: currentAttachments, personality: 'assistant', provider: modelToUse, userId })
            });

            if (!res.ok) throw new Error('API Error');

            const reader = res.body?.getReader();
            const decoder = new TextDecoder("utf-8");

            let assistantReplyText = '';
            const replyId = Date.now().toString() + 'reply';

            setMessages(prev => [...prev, { _id: replyId, role: 'assistant', content: '', provider: modelToUse }]);
            let lastUpdateTime = Date.now();

            while (true) {
                const { done, value } = await reader!.read();
                if (done) {
                    // Ensure final state is updated
                    setMessages(prev => prev.map(m =>
                        m._id === replyId ? { ...m, content: assistantReplyText } : m
                    ));
                    break;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6);
                        if (dataStr === '[DONE]') {
                            // Ensure final state is updated
                            setMessages(prev => prev.map(m =>
                                m._id === replyId ? { ...m, content: assistantReplyText } : m
                            ));
                            setIsTyping(false);
                            fetch(`http://${window.location.hostname}:5000/api/chats`).then(async (r) => {
                                if (r.ok) {
                                    const d = await r.json();
                                    setChats(d);
                                }
                            }).catch(() => { });
                            break;
                        }
                        try {
                            const data = JSON.parse(dataStr);
                            if (data.error) {
                                assistantReplyText += `\n**API Error:** ${data.error}`;
                                setMessages(prev => prev.map(m =>
                                    m._id === replyId ? { ...m, content: assistantReplyText } : m
                                ));
                                setIsTyping(false);
                            } else if (data.text) {
                                assistantReplyText += data.text;
                                // Throttle UI updates to prevent lagging on fast code generation
                                if (Date.now() - lastUpdateTime > 50) {
                                    setMessages(prev => prev.map(m =>
                                        m._id === replyId ? { ...m, content: assistantReplyText } : m
                                    ));
                                    lastUpdateTime = Date.now();
                                }
                            }
                        } catch (e) { }
                    }
                }
            }
        } catch (err: any) {
            if (err.name === 'AbortError') {
                console.log('Stream stopped by user');
            } else {
                console.error(err);
            }
            setIsTyping(false);
        } finally {
            setAbortController(null);
        }
    };

    const toggleListen = () => {
        if (isListening) {
            recognitionRef.current?.stop();
        } else {
            recognitionRef.current?.start();
            setIsListening(true);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const handleTTS = (text: string) => {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel(); // Stop any ongoing speech
            
            // Strip markdown for clean audio reading
            const cleanText = text
                .replace(/```[\s\S]*?```/g, ' [Code block omitted for audio] ') // replace code blocks
                .replace(/`([^`]+)`/g, '$1') // remove inline code
                .replace(/#+\s/g, '') // remove headers
                .replace(/\*\*(.*?)\*\*/g, '$1') // remove bold
                .replace(/\*(.*?)\*/g, '$1') // remove italic
                .replace(/\[(.*?)\]\(.*?\)/g, '$1') // replace links
                .replace(/>\s/g, '') // remove blockquotes
                .replace(/\n+/g, '. ') // replace newlines with periods for pausing
                .trim();

            const utterance = new SpeechSynthesisUtterance(cleanText);
            
            const voices = window.speechSynthesis.getVoices();
            // Try to find a common male English voice
            const maleVoice = voices.find(v => 
                v.name.toLowerCase().includes('male') || 
                v.name.includes('David') || 
                v.name.includes('Mark') || 
                v.name.includes('Arthur') ||
                v.name.includes('Daniel') ||
                v.name.includes('Brian')
            );
            
            if (maleVoice) {
                utterance.voice = maleVoice;
            }
            
            // Slightly lower pitch for a deeper/male voice effect
            utterance.pitch = 0.9;
            
            window.speechSynthesis.speak(utterance);
        }
    };

    const renderInputArea = (isFixed = true) => (
        <div className={isFixed ? "fixed bottom-0 left-0 right-0 p-3 pb-6 md:p-8 bg-gradient-to-t from-[#050505] via-[#050505]/80 to-transparent pointer-events-none z-50" : "w-full pointer-events-none z-50 px-2 pb-4 md:pb-6 shrink-0 pt-2 bg-gradient-to-t from-[#050505] to-transparent"}>
            <form onSubmit={handleSend} className="max-w-3xl mx-auto flex flex-col gap-2 glass rounded-[24px] md:rounded-[32px] p-1.5 md:p-2 focus-within:ring-1 focus-within:ring-white/20 transition-all shadow-[0_8px_32px_rgba(0,0,0,0.5)] pointer-events-auto backdrop-blur-2xl bg-white/5 border border-white/10">

                {attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 px-3 pt-2 pb-1 max-h-40 overflow-y-auto scrollbar-hide border-b border-white/5">
                        {attachments.map((att, idx) => {
                            const isImage = att.mimeType.startsWith('image/');
                            const isAudio = att.mimeType.startsWith('audio/');
                            const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
                            const isSpreadsheet = att.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                                  att.mimeType === 'application/vnd.ms-excel' ||
                                                  att.mimeType === 'text/csv' ||
                                                  att.fileName.toLowerCase().endsWith('.xlsx') ||
                                                  att.fileName.toLowerCase().endsWith('.xls') ||
                                                  att.fileName.toLowerCase().endsWith('.csv');

                            return (
                                <div 
                                    key={idx} 
                                    className="relative flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl p-1.5 pr-8 max-w-[200px] group transition-all hover:bg-white/10 hover:border-white/20 animate-fade-in"
                                >
                                    {isImage ? (
                                        <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0">
                                            <img src={att.data} className="w-full h-full object-cover" alt={att.fileName} />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white/70">
                                            {isPdf ? (
                                                <FileText size={16} className="text-red-400" />
                                            ) : isSpreadsheet ? (
                                                <FileSpreadsheet size={16} className="text-emerald-400" />
                                            ) : isAudio ? (
                                                <Music size={16} className="text-blue-400 animate-pulse" />
                                            ) : (
                                                <FileText size={16} className="text-purple-400" />
                                            )}
                                        </div>
                                    )}
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-xs text-white/90 truncate font-medium max-w-[100px]">{att.fileName}</span>
                                        <span className="text-[10px] text-gray-500">{(att.fileSize ? (att.fileSize / 1024).toFixed(1) : 0)} KB</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))} 
                                        className="absolute top-1/2 right-1.5 -translate-y-1/2 bg-black/60 hover:bg-black/80 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X size={10} className="text-white" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
                <div className="flex items-end gap-2 md:gap-3 w-full pr-2 md:pr-3">
                    <input 
                        type="file" 
                        ref={docInputRef} 
                        className="hidden" 
                        multiple 
                        accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,text/*,.txt,.md,.rtf,application/json,.json" 
                        onChange={handleFileSelect} 
                    />
                    <input 
                        type="file" 
                        ref={imageInputRef} 
                        className="hidden" 
                        multiple 
                        accept="image/*" 
                        onChange={handleFileSelect} 
                    />
                    <input 
                        type="file" 
                        ref={spreadsheetInputRef} 
                        className="hidden" 
                        multiple 
                        accept="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls,text/csv,.csv" 
                        onChange={handleFileSelect} 
                    />
                    <input 
                        type="file" 
                        ref={codeInputRef} 
                        className="hidden" 
                        multiple 
                        accept=".py,.js,.ts,.tsx,.jsx,.html,.css,.json,.sh,.cpp,.java,.rs,.go,.php,.swift,.kt,.sql" 
                        onChange={handleFileSelect} 
                    />
                    <input 
                        type="file" 
                        ref={audioInputRef} 
                        className="hidden" 
                        multiple 
                        accept="audio/*,.mp3,.wav,.webm,.m4a,.ogg" 
                        onChange={handleFileSelect} 
                    />
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        multiple 
                        accept="image/*,application/pdf,.pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx,application/vnd.ms-excel,.xls,text/csv,.csv,text/*,.txt,application/json,.json,application/javascript,.js,.py,audio/*,.mp3,.wav,.webm" 
                        onChange={handleFileSelect} 
                    />
                    
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsUploadMenuOpen(!isUploadMenuOpen)}
                            className={`p-2.5 md:p-3.5 rounded-full transition-all duration-200 animate-fade-in ${isUploadMenuOpen ? 'bg-white/10 text-white scale-105' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            title="Attach files (PDF, Spreadsheets, Images, Audio, Code, Text)"
                        >
                            <Paperclip size={20} className={isUploadMenuOpen ? "rotate-45 transition-transform duration-200" : "transition-transform duration-200"} />
                        </button>

                        <AnimatePresence>
                            {isUploadMenuOpen && (
                                <>
                                    <div 
                                        className="fixed inset-0 z-40 cursor-default" 
                                        onClick={() => setIsUploadMenuOpen(false)} 
                                    />
                                    <motion.div
                                        initial={{ opacity: 0, y: 15, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                        transition={{ duration: 0.15, ease: "easeOut" }}
                                        className="absolute bottom-full left-0 mb-3 w-64 rounded-2xl border border-white/10 bg-[#0c0c0e]/95 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.8)] backdrop-blur-2xl z-50 flex flex-col gap-0.5"
                                    >
                                        <div className="px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                            Upload Options
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUploadMenuOpen(false);
                                                docInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full p-2 text-left hover:bg-white/5 rounded-xl transition-all group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 text-red-400 group-hover:scale-105 transition-transform duration-250">
                                                <FileText size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-semibold text-white/90">Documents & PDFs</span>
                                                <span className="text-[10px] text-gray-500 truncate">PDF, Word, Text, Markdown</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUploadMenuOpen(false);
                                                imageInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full p-2 text-left hover:bg-white/5 rounded-xl transition-all group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center shrink-0 text-purple-400 group-hover:scale-105 transition-transform duration-250">
                                                <Image size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-semibold text-white/90">Images & Photos</span>
                                                <span className="text-[10px] text-gray-500 truncate">PNG, JPEG, WebP, SVG</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUploadMenuOpen(false);
                                                spreadsheetInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full p-2 text-left hover:bg-white/5 rounded-xl transition-all group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0 text-emerald-400 group-hover:scale-105 transition-transform duration-250">
                                                <FileSpreadsheet size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-semibold text-white/90">Spreadsheets</span>
                                                <span className="text-[10px] text-gray-500 truncate">Excel files, CSV tables</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUploadMenuOpen(false);
                                                codeInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full p-2 text-left hover:bg-white/5 rounded-xl transition-all group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0 text-blue-400 group-hover:scale-105 transition-transform duration-250">
                                                <Code size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-semibold text-white/90">Code Files</span>
                                                <span className="text-[10px] text-gray-500 truncate">Python, JS, TS, HTML, JSON</span>
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUploadMenuOpen(false);
                                                audioInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full p-2 text-left hover:bg-white/5 rounded-xl transition-all group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0 text-amber-400 group-hover:scale-105 transition-transform duration-250">
                                                <Music size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-semibold text-white/90">Audio Clips</span>
                                                <span className="text-[10px] text-gray-500 truncate">MP3, WAV, Voice recordings</span>
                                            </div>
                                        </button>

                                        <div className="h-[1px] bg-white/5 my-1" />

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsUploadMenuOpen(false);
                                                fileInputRef.current?.click();
                                            }}
                                            className="flex items-center gap-3 w-full p-2 text-left hover:bg-white/5 rounded-xl transition-all group cursor-pointer"
                                        >
                                            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white/70 group-hover:scale-105 transition-transform duration-250">
                                                <File size={16} />
                                            </div>
                                            <div className="flex flex-col min-w-0">
                                                <span className="text-xs font-semibold text-white/90">Browse All Files</span>
                                                <span className="text-[10px] text-gray-500 truncate">Select any generic file</span>
                                            </div>
                                        </button>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    <button
                        type="button"
                        onClick={toggleListen}
                        className={`p-2.5 md:p-3.5 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-500 scale-105' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        title="Dictate message (Speech-to-Text)"
                    >
                        <Mic size={20} />
                    </button>
                    
                    <button
                        type="button"
                        onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                        className={`p-2.5 md:p-3.5 rounded-full transition-all ${isRecordingAudio ? 'bg-red-500/20 text-red-500 scale-105' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        title="Record voice note"
                    >
                        <Volume2 size={20} />
                    </button>

                {isRecordingAudio ? (
                    <div className="flex-1 flex items-center justify-between px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-2xl animate-pulse">
                        <div className="flex items-center gap-3">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                            </span>
                            <span className="text-sm font-medium text-red-400 tracking-wider">Recording Voice Note... ({recordingDuration}s)</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={cancelAudioRecording}
                                className="text-gray-400 hover:text-white text-xs px-2.5 py-1 hover:bg-white/5 rounded-lg transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={stopAudioRecording}
                                className="bg-red-500 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-600 transition-all font-semibold"
                            >
                                Stop & Queue
                            </button>
                        </div>
                    </div>
                ) : (
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                if (!isTyping) handleSend();
                            }
                        }}
                        onPaste={handlePaste}
                        placeholder="Ask anything..."
                        className="flex-1 bg-transparent border-none outline-none resize-none max-h-40 min-h-[40px] md:min-h-[44px] py-2.5 md:py-3.5 px-2 text-[14px] md:text-base scrollbar-hide text-white/90 placeholder-gray-500"
                        rows={1}
                        style={{ height: 'auto' }}
                    />
                )}

                <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-black/40 text-white/90 border border-white/10 hover:border-white/20 rounded-xl px-2 py-1.5 text-[11px] md:text-xs outline-none focus:border-blue-500 transition-colors backdrop-blur-md cursor-pointer self-center mr-1"
                >
                    <option value="gemini">✨ Gemini</option>
                    <option value="gemma-local">💻 Gemma 4 (Local)</option>
                    <option value="offline">🔌 Offline Model</option>
                </select>

                {isTyping ? (
                    <button
                        type="button"
                        onClick={handleStop}
                        className="p-2 md:p-2.5 bg-red-500/10 text-red-500 rounded-full hover:bg-red-500/20 transition-all group flex-shrink-0 flex items-center justify-center border border-red-500/30 w-[38px] h-[38px] md:w-[42px] md:h-[42px]"
                        title="Stop Generation"
                    >
                        <VLogo className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                    </button>
                ) : (
                    <button
                        type="submit"
                        disabled={(!input.trim() && attachments.length === 0)}
                        className="p-2.5 md:p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex-shrink-0 w-[38px] h-[38px] md:w-[42px] md:h-[42px] flex items-center justify-center"
                    >
                        <Send size={18} className="translate-x-0.5 -translate-y-0.5" />
                    </button>
                )}
                </div>
            </form>
        </div>
    );

    const renderDragOverlay = () => (
        <AnimatePresence>
            {isDragging && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/75 backdrop-blur-md z-50 flex flex-col items-center justify-center pointer-events-none"
                >
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="max-w-md p-8 rounded-3xl border border-white/10 bg-[#0c0c0e]/80 flex flex-col items-center gap-4 text-center pointer-events-auto shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl m-4"
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="relative w-20 h-20 bg-white/5 rounded-full flex items-center justify-center border border-white/10 shadow-inner">
                            <motion.div
                                animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
                                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                                className="absolute inset-0 bg-blue-500/10 rounded-full"
                            />
                            <UploadCloud size={40} className="text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                        </div>
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-white tracking-tight">Drop files to attach</h3>
                            <p className="text-xs text-gray-400 max-w-[260px] leading-relaxed">
                                Release your files here to instantly add them as prompt attachments.
                            </p>
                        </div>
                        <div className="flex flex-wrap justify-center gap-2 mt-2">
                            <span className="px-2.5 py-1 rounded-lg bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-semibold tracking-wider uppercase text-center">PDF / Docs</span>
                            <span className="px-2.5 py-1 rounded-lg bg-purple-500/10 border border-purple-500/20 text-[10px] text-purple-400 font-semibold tracking-wider uppercase text-center">Images</span>
                            <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-semibold tracking-wider uppercase text-center">Excel / CSV</span>
                            <span className="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-[10px] text-blue-400 font-semibold tracking-wider uppercase text-center">Code</span>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );

    if (!id) {
        return (
            <div 
                className="flex-1 flex flex-col bg-[#050505] text-white relative overflow-hidden h-full"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Animated Futuristic Background */}
                <motion.div 
                    animate={{ 
                        x: [0, 100, -50, 0], 
                        y: [0, 50, -100, 0],
                        scale: [1, 1.2, 0.8, 1]
                    }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[120px] pointer-events-none" 
                />
                <motion.div 
                    animate={{ 
                        x: [0, -100, 50, 0], 
                        y: [0, -50, 100, 0],
                        scale: [1, 0.8, 1.2, 1]
                    }}
                    transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] pointer-events-none" 
                />
                <motion.div 
                    animate={{ 
                        x: [0, 50, -50, 0], 
                        y: [0, -100, 50, 0],
                        scale: [1, 1.5, 1, 1]
                    }}
                    transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute top-[30%] left-[40%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" 
                />
                
                {/* Floating Particles */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[...Array(20)].map((_, i) => (
                        <motion.div
                            key={`particle-${i}`}
                            initial={{
                                opacity: 0,
                                y: `${Math.random() * 100 + 100}%`,
                                x: `${Math.random() * 100}%`,
                                scale: Math.random() * 0.5 + 0.5
                            }}
                            animate={{
                                opacity: [0, 0.4, 0],
                                y: ["100%", "-20%"],
                                x: [`${Math.random() * 100}%`, `${Math.random() * 100}%`]
                            }}
                            transition={{
                                duration: Math.random() * 15 + 15,
                                repeat: Infinity,
                                ease: "linear",
                                delay: Math.random() * 10
                            }}
                            className="absolute w-1 h-1 bg-blue-200/30 rounded-full blur-[0.5px] shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                        />
                    ))}
                </div>

                {/* Glowing Wave Animation */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none flex items-center opacity-30">
                    <motion.svg 
                        className="w-[200%] h-[300px] absolute left-0"
                        viewBox="0 0 1000 200" 
                        preserveAspectRatio="none"
                        animate={{ x: ["0%", "-50%"] }}
                        transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                    >
                        <path 
                            d="M 0,100 Q 125,200 250,100 T 500,100 T 750,100 T 1000,100" 
                            fill="none" 
                            stroke="url(#wave-gradient-1)" 
                            strokeWidth="2"
                            className="drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]"
                        />
                        <path 
                            d="M 0,100 Q 125,50 250,100 T 500,100 T 750,100 T 1000,100" 
                            fill="none" 
                            stroke="url(#wave-gradient-2)" 
                            strokeWidth="1.5"
                            opacity="0.6"
                            className="drop-shadow-[0_0_10px_rgba(147,51,234,0.8)]"
                        />
                        <defs>
                            <linearGradient id="wave-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="rgba(59,130,246,0)" />
                                <stop offset="10%" stopColor="rgba(59,130,246,0.5)" />
                                <stop offset="25%" stopColor="rgba(147,51,234,0.8)" />
                                <stop offset="40%" stopColor="rgba(59,130,246,0.5)" />
                                <stop offset="50%" stopColor="rgba(59,130,246,0)" />
                                <stop offset="60%" stopColor="rgba(59,130,246,0.5)" />
                                <stop offset="75%" stopColor="rgba(147,51,234,0.8)" />
                                <stop offset="90%" stopColor="rgba(59,130,246,0.5)" />
                                <stop offset="100%" stopColor="rgba(59,130,246,0)" />
                            </linearGradient>
                            <linearGradient id="wave-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="rgba(147,51,234,0)" />
                                <stop offset="10%" stopColor="rgba(147,51,234,0.4)" />
                                <stop offset="25%" stopColor="rgba(59,130,246,0.6)" />
                                <stop offset="40%" stopColor="rgba(147,51,234,0.4)" />
                                <stop offset="50%" stopColor="rgba(147,51,234,0)" />
                                <stop offset="60%" stopColor="rgba(147,51,234,0.4)" />
                                <stop offset="75%" stopColor="rgba(59,130,246,0.6)" />
                                <stop offset="90%" stopColor="rgba(147,51,234,0.4)" />
                                <stop offset="100%" stopColor="rgba(147,51,234,0)" />
                            </linearGradient>
                        </defs>
                    </motion.svg>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 md:p-8 z-10 w-full">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="max-w-3xl w-full flex flex-col items-center"
                >
                    <div className="flex items-center justify-center gap-3 md:gap-5 mb-8 md:mb-12 pointer-events-none mt-2">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
                            className="relative w-14 h-14 md:w-20 md:h-20 flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ rotate: 360, scale: [1, 1.05, 1] }}
                                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-0 rounded-full border-[1.5px] border-transparent border-t-white/80 border-r-white/20"
                            />
                            <motion.div
                                animate={{ rotate: -360, scale: [1, 1.1, 1] }}
                                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-2 md:inset-2.5 rounded-full border-[1px] border-blue-500/40 border-b-blue-400 blur-[0.5px]"
                            />
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: [0.4, 1, 0.4], scale: [0.9, 1.1, 0.9] }}
                                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                className="absolute w-8 h-8 md:w-12 md:h-12 bg-white/10 rounded-full shadow-[0_0_40px_rgba(255,255,255,0.3)] backdrop-blur-3xl flex items-center justify-center border border-white/20"
                            />
                            <VLogo className="w-5 h-5 md:w-7 md:h-7 text-white z-10" />
                        </motion.div>
                        <span className="text-2xl md:text-3xl font-bold tracking-[0.4em] text-white uppercase drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] opacity-90">CHAT</span>
                    </div>

                    <h1 className="text-3xl md:text-5xl font-medium mb-2 md:mb-3 tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-white to-white/60 px-2 md:px-0">
                        How can I help you today?
                    </h1>

                    <p className="text-gray-500 text-sm md:text-lg mb-8 md:mb-12 max-w-xl">
                        An advanced neural intelligence engineered by Viswas.
                    </p>
                </motion.div>
                </div>
                {renderInputArea(false)}
                {renderDragOverlay()}
            </div>
        );
    }

    return (
        <div 
            className="flex-1 flex h-full w-full bg-[#050505] text-white relative overflow-hidden"
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* Chat Area */}
            <div className={`flex flex-col h-full transition-all duration-500 z-10 ${activeArtifact ? 'w-full md:w-[45%] lg:w-[40%] xl:w-[35%] border-r border-white/10 bg-[#050505]/95 backdrop-blur-xl shrink-0' : 'w-full'}`}>
                <div 
                    ref={chatContainerRef}
                    onScroll={handleChatScroll}
                    className="flex-1 overflow-y-auto px-2 md:px-0 scrollbar-hide pt-4 md:pt-8 min-h-0 w-full flex flex-col"
                >
                    <div className={`flex-1 ${activeArtifact ? 'w-full px-4 md:px-6' : 'max-w-3xl mx-auto w-full px-2 md:px-0'} space-y-6 md:space-y-8 flex flex-col transition-all duration-500`}>
                    {messages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center my-auto pt-32 opacity-60">
                            <div className="relative w-16 h-16 mb-4 flex items-center justify-center pointer-events-none">
                                <motion.div
                                    animate={{ rotate: 360, scale: [1, 1.05, 1] }}
                                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-0 rounded-full border border-transparent border-t-white/50 border-r-white/20"
                                />
                                <motion.div
                                    animate={{ rotate: -360, scale: [1, 1.1, 1] }}
                                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                                    className="absolute inset-2 rounded-full border border-blue-500/20 border-b-blue-400/50"
                                />
                                <VLogo className="w-4 h-4 text-white z-10" />
                            </div>
                            <p className="text-gray-500 text-sm">Send a message to start chatting</p>
                        </div>
                    ) : (
                        <AnimatePresence initial={false}>
                            {messages.map((msg, index) => (
                                <motion.div
                                    key={msg._id || index}
                                    initial={{ opacity: 0, x: msg.role === 'user' ? 20 : -20, filter: 'blur(5px)' }}
                                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                    className={`flex flex-col w-full ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-4`}
                                >
                                    {/* Unique Generative Layer Connector */}
                                    {msg.role === 'assistant' && (
                                        <motion.div
                                            initial={{ opacity: 0, scaleX: 0 }}
                                            animate={{ opacity: 1, scaleX: 1 }}
                                            transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }}
                                            className="w-full flex items-center justify-center gap-4 my-8 opacity-60 pointer-events-none"
                                        >
                                            <div className="h-[1px] w-full max-w-[200px] bg-gradient-to-r from-transparent to-blue-500/40"></div>
                                            <div className="relative flex items-center justify-center">
                                                <div className="absolute w-8 h-8 bg-blue-500/20 blur-md rounded-full animate-pulse"></div>
                                                {isTyping && index === messages.length - 1 ? (
                                                    <motion.div animate={{ rotate: 360, scale: [1, 1.25, 1] }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                                                        <VLogo className="w-4 h-4 text-white z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                                                    </motion.div>
                                                ) : (
                                                    <VLogo className="w-3.5 h-3.5 text-blue-400 z-10" />
                                                )}
                                            </div>
                                            <div className="h-[1px] w-full max-w-[200px] bg-gradient-to-l from-transparent to-purple-500/40"></div>
                                        </motion.div>
                                    )}

                                    <div className={`group relative min-w-0 max-w-[95%] md:max-w-full ${msg.role === 'user'
                                        ? 'bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-2xl border border-white/10 rounded-[28px] rounded-br-[8px] px-5 py-3 md:px-6 md:py-4 shadow-2xl'
                                        : 'bg-transparent py-2 w-full pl-0 md:pl-8'
                                        }`}>

                                        {msg.attachments && msg.attachments.length > 0 && (
                                            <div className="flex flex-col gap-2 mb-3 max-w-full">
                                                {msg.attachments.map((att, attIdx) => {
                                                    const isImage = att.mimeType.startsWith('image/');
                                                    const isAudio = att.mimeType.startsWith('audio/');
                                                    const isPdf = att.mimeType === 'application/pdf' || att.fileName.toLowerCase().endsWith('.pdf');
                                                    const isSpreadsheet = att.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                                                                          att.mimeType === 'application/vnd.ms-excel' ||
                                                                          att.mimeType === 'text/csv' ||
                                                                          att.fileName.toLowerCase().endsWith('.xlsx') ||
                                                                          att.fileName.toLowerCase().endsWith('.xls') ||
                                                                          att.fileName.toLowerCase().endsWith('.csv');

                                                    if (isImage) {
                                                        return (
                                                            <div key={attIdx} className="max-w-[200px] md:max-w-[300px] rounded-xl overflow-hidden shadow-lg border border-white/10 group relative">
                                                                <img src={att.data} alt={att.fileName || 'Attachment'} className="w-full h-auto object-cover max-h-[300px]" />
                                                                <a 
                                                                    href={att.data} 
                                                                    download={att.fileName || 'image.png'}
                                                                    className="absolute bottom-2 right-2 bg-black/70 hover:bg-black/95 text-white/90 text-xs px-2.5 py-1 rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                >
                                                                    Download
                                                                </a>
                                                            </div>
                                                        );
                                                    }

                                                    if (isAudio) {
                                                        return (
                                                            <div key={attIdx} className="flex flex-col gap-1.5 p-3 rounded-2xl bg-white/5 border border-white/10 max-w-xs shadow-md">
                                                                <div className="flex items-center gap-2 text-blue-400">
                                                                    <Music size={16} />
                                                                    <span className="text-xs font-semibold truncate text-white/95">{att.fileName || 'Voice Note'}</span>
                                                                </div>
                                                                <audio src={att.data} controls className="w-full h-8 opacity-80 animate-fade-in" />
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <a
                                                            key={attIdx}
                                                            href={att.data}
                                                            download={att.fileName || 'document'}
                                                            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all max-w-sm group text-left cursor-pointer"
                                                        >
                                                            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0 text-white/70">
                                                                {isPdf ? (
                                                                    <FileText size={20} className="text-red-400" />
                                                                ) : isSpreadsheet ? (
                                                                    <FileSpreadsheet size={20} className="text-emerald-400" />
                                                                ) : (
                                                                    <FileText size={20} className="text-purple-400" />
                                                                )}
                                                            </div>
                                                            <div className="flex flex-col min-w-0 flex-1">
                                                                <span className="text-sm text-white/90 font-medium truncate group-hover:text-white transition-colors">{att.fileName}</span>
                                                                <span className="text-xs text-gray-500">
                                                                    {att.fileSize ? `${(att.fileSize / 1024).toFixed(1)} KB` : 'Document'}
                                                                </span>
                                                            </div>
                                                            <div className="text-xs text-blue-400 font-semibold group-hover:underline ml-2">
                                                                Download
                                                            </div>
                                                        </a>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {!msg.attachments && msg.attachment && (
                                            <div className="mb-3 max-w-[200px] md:max-w-[300px] rounded-xl overflow-hidden shadow-lg border border-white/10">
                                                <img src={msg.attachment.data} alt="Attachment" className="w-full h-auto object-cover" />
                                            </div>
                                        )}

                                        {/* Generative Streaming Aura/Laser */}
                                        {isTyping && msg.role === 'assistant' && index === messages.length - 1 && (
                                            <motion.div
                                                animate={{ opacity: [0.1, 0.8, 0.1], top: ["0%", "80%", "0%"] }}
                                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                                                className="absolute left-0 md:left-4 w-[2px] h-[30%] bg-gradient-to-b from-transparent via-blue-400 to-transparent shadow-[0_0_15px_rgba(59,130,246,1)] rounded-full hidden md:block"
                                            />
                                        )}

                                        {msg.role === 'assistant' && (
                                            <div className="absolute -left-4 md:-left-8 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2 z-20">
                                                <button onClick={() => copyToClipboard(msg.content)} className="p-2 text-gray-500 hover:text-white bg-white/5 rounded-xl transition-all hover:bg-white/10 backdrop-blur-md border border-white/5" title="Copy text"><Copy size={16} /></button>
                                                <button onClick={() => handleTTS(msg.content)} className="p-2 text-gray-500 hover:text-white bg-white/5 rounded-xl transition-all hover:bg-white/10 backdrop-blur-md border border-white/5" title="Read aloud"><Play size={16} /></button>
                                            </div>
                                        )}

                                        {msg.role === 'assistant' && (() => {
                                            const parsed = parseMessageContent(msg.content);
                                            return (
                                                <>
                                                    <ThinkingProcess 
                                                        msgId={msg._id} 
                                                        model={msg.provider || selectedModel} 
                                                        isGenerating={isTyping && index === messages.length - 1} 
                                                        contentLength={msg.content.length}
                                                        expandedThoughts={expandedThoughts}
                                                        toggleThought={toggleThought}
                                                        codeBlocks={parsed.codeBlocks}
                                                        setActiveArtifact={setActiveArtifact}
                                                    />
                                                    
                                                    {parsed.text !== '' && (
                                                        <div className={`prose prose-invert max-w-none break-words overflow-x-auto min-w-0 ${isTyping && index === messages.length - 1 ? (selectedModel === 'gemini' ? 'typing-active typing-active-gemini' : selectedModel === 'gemma-local' ? 'typing-active typing-active-claude' : 'typing-active typing-active-chatgpt') : ''} text-[15px] md:text-[16px] leading-[1.7] md:leading-[1.8] text-gray-200 prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-code:text-blue-300`}>
                                                            <ReactMarkdown>
                                                                {parsed.text}
                                                            </ReactMarkdown>
                                                        </div>
                                                    )}
                                                </>
                                            );
                                        })()}

                                        {msg.role === 'user' && (
                                            <div className="prose prose-invert max-w-none break-words overflow-x-auto min-w-0 text-[15px] md:text-[15.5px] text-white font-medium tracking-wide">
                                                {msg.content}
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    )}
                        <div ref={messagesEndRef} className="h-4 shrink-0" />
                    </div>
                </div>
                {/* Fixed Input Area relative to chat column flexbox */}
                {renderInputArea(false)}
            </div>

            {/* Artifact Preview Area */}
            <AnimatePresence>
                {activeArtifact && (
                    <motion.div
                        initial={{ opacity: 0, x: 100, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 100, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="hidden md:flex flex-1 h-full bg-[#0A0A0A] relative flex-col z-0 shadow-[-20px_0_50px_rgba(0,0,0,0.5)] min-w-0"
                    >
                        {/* Header */}
                        <div className="h-14 bg-gradient-to-r from-[#0f0f0f] to-[#111] border-b border-white/10 flex items-center justify-between px-4 shrink-0 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)] gap-2">
                            {/* Left Side: Tabs */}
                            <div className="flex items-center gap-1.5 md:gap-3">
                                <button
                                    onClick={() => setArtifactTab('preview')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border ${
                                        artifactTab === 'preview'
                                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                                            : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <Eye size={14} />
                                    <span className="hidden sm:inline">Preview</span>
                                </button>
                                <button
                                    onClick={() => setArtifactTab('code')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border ${
                                        artifactTab === 'code'
                                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                                            : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <Code size={14} />
                                    <span className="hidden sm:inline">Code</span>
                                </button>
                                <button
                                    onClick={() => setArtifactTab('console')}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all border relative ${
                                        artifactTab === 'console'
                                            ? 'bg-blue-600/20 text-blue-400 border-blue-500/30'
                                            : 'text-gray-400 border-transparent hover:bg-white/5 hover:text-white'
                                    }`}
                                >
                                    <Terminal size={14} />
                                    <span className="hidden sm:inline">Console</span>
                                    {consoleLogs.length > 0 && (
                                        <span className={`absolute -top-1.5 -right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full text-[9px] font-bold ${
                                            consoleLogs.some(log => log.level === 'error')
                                                ? 'bg-red-500 text-white'
                                                : consoleLogs.some(log => log.level === 'warn')
                                                    ? 'bg-yellow-500 text-black'
                                                    : 'bg-blue-500 text-white'
                                        }`}>
                                            {consoleLogs.length}
                                        </span>
                                    )}
                                </button>
                            </div>

                            {/* Center Side: Viewport Selector */}
                            {artifactTab === 'preview' && (
                                <div className="flex items-center bg-black/40 border border-white/10 rounded-xl p-0.5 z-10 shrink-0">
                                    <button
                                        onClick={() => setArtifactViewport('desktop')}
                                        className={`p-1.5 rounded-lg transition-all ${
                                            artifactViewport === 'desktop' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                        }`}
                                        title="Desktop View"
                                    >
                                        <Monitor size={14} />
                                    </button>
                                    <button
                                        onClick={() => setArtifactViewport('tablet')}
                                        className={`p-1.5 rounded-lg transition-all ${
                                            artifactViewport === 'tablet' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                        }`}
                                        title="Tablet View"
                                    >
                                        <Tablet size={14} />
                                    </button>
                                    <button
                                        onClick={() => setArtifactViewport('mobile')}
                                        className={`p-1.5 rounded-lg transition-all ${
                                            artifactViewport === 'mobile' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-400 hover:text-white'
                                        }`}
                                        title="Mobile View"
                                    >
                                        <Smartphone size={14} />
                                    </button>
                                </div>
                            )}

                            {/* Right Side: Actions (Download, Copy, Close) */}
                            <div className="flex items-center gap-1.5 shrink-0 z-10">
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(artifactCode);
                                        alert("Artifact code copied to clipboard!");
                                    }}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                    title="Copy Code"
                                >
                                    <Copy size={15} />
                                </button>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([artifactCode], { type: 'text/html' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `artifact_${activeArtifact ? activeArtifact.id : Date.now()}.html`;
                                        document.body.appendChild(a);
                                        a.click();
                                        document.body.removeChild(a);
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                    title="Download HTML"
                                >
                                    <Download size={15} />
                                </button>
                                <div className="h-6 w-[1px] bg-white/10 mx-1"></div>
                                <button
                                    onClick={() => setActiveArtifact(null)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                                    title="Close Preview"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Panels Content Area */}
                        {artifactTab === 'preview' && (
                            <div className="flex-1 w-full bg-[#050505] p-2 md:p-4 overflow-y-auto flex justify-center items-center relative min-h-0">
                                <div 
                                    className={`h-full transition-all duration-300 relative shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col ${
                                        artifactViewport === 'desktop' 
                                            ? 'w-full rounded-[20px] border border-white/10 overflow-hidden' 
                                            : artifactViewport === 'tablet'
                                                ? 'w-[768px] rounded-[24px] border-4 border-white/20 overflow-hidden'
                                                : 'w-[375px] rounded-[36px] border-8 border-white/20 overflow-hidden'
                                    }`}
                                >
                                    {artifactViewport !== 'desktop' && (
                                        <div className="absolute top-0 left-0 right-0 h-4 bg-white/5 border-b border-white/10 flex items-center justify-center text-[9px] text-white/40 tracking-wider font-semibold pointer-events-none select-none z-30">
                                            {artifactViewport === 'tablet' ? 'TABLET VIEW (768px)' : 'MOBILE VIEW (375px)'}
                                        </div>
                                    )}
                                    <iframe
                                        key={activeArtifact.id + '-' + debouncedArtifactCode.length}
                                        title="Preview"
                                        className={`w-full h-full border-none bg-transparent ${artifactViewport !== 'desktop' ? 'pt-4' : ''}`}
                                        sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                                        srcDoc={`
                                            <!DOCTYPE html>
                                            <html class="dark">
                                                <head>
                                                    <meta charset="UTF-8">
                                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                                    <script>
                                                        (function() {
                                                            const originalConsole = {
                                                                log: console.log,
                                                                warn: console.warn,
                                                                error: console.error
                                                            };

                                                            function sendLog(level, args) {
                                                                const text = args.map(arg => {
                                                                    if (typeof arg === 'object') {
                                                                        try {
                                                                            return JSON.stringify(arg);
                                                                        } catch (e) {
                                                                            return String(arg);
                                                                        }
                                                                    }
                                                                    return String(arg);
                                                                }).join(' ');

                                                                window.parent.postMessage({
                                                                    type: 'CONSOLE_LOG',
                                                                    level: level,
                                                                    text: text
                                                                }, '*');
                                                            }

                                                            console.log = function(...args) {
                                                                sendLog('log', args);
                                                                originalConsole.log.apply(console, args);
                                                            };
                                                            console.warn = function(...args) {
                                                                sendLog('warn', args);
                                                                originalConsole.warn.apply(console, args);
                                                            };
                                                            console.error = function(...args) {
                                                                sendLog('error', args);
                                                                originalConsole.error.apply(console, args);
                                                            };

                                                            window.onerror = function(message, source, lineno, colno, error) {
                                                                window.parent.postMessage({
                                                                    type: 'CONSOLE_LOG',
                                                                    level: 'error',
                                                                    text: message + ' (at line ' + lineno + ':' + colno + ')'
                                                                }, '*');
                                                                return false;
                                                            };
                                                        })();
                                                    </script>
                                                    <script src="https://cdn.tailwindcss.com"></script>
                                                    <script>
                                                        tailwind.config = {
                                                            darkMode: 'class',
                                                            theme: {
                                                                extend: {}
                                                            }
                                                        }
                                                    </script>
                                                    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
                                                    <style>
                                                        /* Base styles to prevent unwanted scrollbars and force dark theme baseline */
                                                        body { margin: 0; min-height: 100vh; background: #050505; color: white; display: flex; flex-direction: column; overflow-x: hidden; }
                                                        ::-webkit-scrollbar { width: 8px; height: 8px; }
                                                        ::-webkit-scrollbar-track { background: transparent; }
                                                        ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
                                                        ::-webkit-scrollbar-thumb:hover { background: #555; }
                                                    </style>
                                                </head>
                                                <body class="antialiased font-sans">
                                                    ${debouncedArtifactCode}
                                                </body>
                                            </html>
                                        `}
                                    />
                                </div>
                            </div>
                        )}

                        {artifactTab === 'code' && (
                            <div className="flex-1 w-full bg-[#050505] p-3 md:p-5 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-3 shrink-0">
                                    <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Source Code Editor</span>
                                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20 font-medium">Auto-Syncs with Preview</span>
                                </div>
                                <LineNumberTextarea value={artifactCode} onChange={setArtifactCode} />
                            </div>
                        )}

                        {artifactTab === 'console' && (
                            <div className="flex-1 w-full bg-[#050505] p-3 md:p-5 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-3 shrink-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Developer Console</span>
                                        <span className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full text-white/60 font-mono">Capture Mode Active</span>
                                    </div>
                                    {consoleLogs.length > 0 && (
                                        <button
                                            onClick={() => setConsoleLogs([])}
                                            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-red-400 transition-colors bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 hover:border-red-500/20"
                                        >
                                            <Trash2 size={12} />
                                            Clear
                                        </button>
                                    )}
                                </div>
                                <div className="flex-1 bg-[#020202] border border-white/10 rounded-2xl p-4 font-mono text-[13px] leading-[1.6] overflow-y-auto shadow-inner text-gray-300">
                                    {consoleLogs.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center opacity-40 select-none py-10">
                                            <Terminal size={24} className="mb-2 text-gray-500 animate-pulse" />
                                            <p className="text-xs">No logs captured yet.</p>
                                            <p className="text-[10px] max-w-xs mt-1">Console statements or Javascript runtime errors in your preview will appear here in real-time.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2.5">
                                            {consoleLogs.map((log, idx) => {
                                                const isError = log.level === 'error';
                                                const isWarn = log.level === 'warn';
                                                
                                                return (
                                                    <div 
                                                        key={idx} 
                                                        className="flex gap-3 items-start border-b border-white/5 pb-2 last:border-b-0 animate-fade-in"
                                                    >
                                                        <span className="text-[10px] text-gray-600 select-none tracking-tight shrink-0 mt-0.5">
                                                            [{log.timestamp}]
                                                        </span>
                                                        <span className={`text-[10px] uppercase font-bold shrink-0 select-none px-1.5 py-0.5 rounded ${
                                                            isError 
                                                                ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                                                                : isWarn 
                                                                    ? 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20' 
                                                                    : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                                        }`}>
                                                            {log.level}
                                                        </span>
                                                        <pre className={`flex-1 whitespace-pre-wrap font-mono break-all text-[12px] ${
                                                            isError ? 'text-red-400 font-medium' : isWarn ? 'text-yellow-300' : 'text-gray-300'
                                                        }`}>
                                                            {log.text}
                                                        </pre>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
            {renderDragOverlay()}
        </div>
    );
}
