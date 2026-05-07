import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Send, Mic, Copy, Play, Code, FileText, Database, Lightbulb, Layout, X, Paperclip } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
    _id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    attachment?: { data: string, mimeType: string };
}

const VLogo = ({ className = "w-6 h-6" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0 0 8px currentColor)' }}>
        <path d="M3 4L12 21L21 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8.5 4L12 11L15.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
        <path d="M12 21V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
    </svg>
);

export default function ChatView() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { chats, setChats } = useStore();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [attachment, setAttachment] = useState<{data: string, mimeType: string} | null>(null);
    const [isTyping, setIsTyping] = useState(false);
    const [abortController, setAbortController] = useState<AbortController | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [selectedModel, setSelectedModel] = useState('gemini');
    const [activeArtifact, setActiveArtifact] = useState<{code: string, id: string} | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        if (id) {
            fetchMessages().then(() => {
                const initialMsg = location.state?.initialMessage;
                const initialAttachment = location.state?.initialAttachment;
                const passedModel = location.state?.selectedModel;
                
                if (passedModel) {
                    setSelectedModel(passedModel);
                }

                if ((initialMsg || initialAttachment) && messages.length === 0) {
                    navigate(location.pathname, { replace: true, state: {} });
                    // Provide the passed model directly to handleSend to ensure it uses the right one
                    // even before state has updated
                    handleSend(undefined, initialMsg, initialAttachment, passedModel);
                }
            });
        } else {
            setMessages([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onloadend = () => {
            setAttachment({
                data: reader.result as string,
                mimeType: file.type
            });
        };
        reader.readAsDataURL(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (!file) continue;
                
                const reader = new FileReader();
                reader.onloadend = () => {
                    setAttachment({
                        data: reader.result as string,
                        mimeType: file.type
                    });
                };
                reader.readAsDataURL(file);
                e.preventDefault();
                break;
            }
        }
    };

    const handleStop = () => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);
            setIsTyping(false);
        }
    };

    const handleSend = async (e?: React.FormEvent, initialMessageText?: string, initialAttachment?: {data: string, mimeType: string} | null, forceModel?: string) => {
        e?.preventDefault();
        const textToSend = initialMessageText !== undefined ? initialMessageText : input.trim();
        const currentAttachment = initialAttachment !== undefined ? initialAttachment : attachment;
        const modelToUse = forceModel || selectedModel;

        if (!textToSend && !currentAttachment) return;

        if (!id) {
            try {
                const reqTitle = textToSend.length > 20 ? textToSend.substring(0, 20) + '...' : (textToSend || 'New Image Chat');
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
                    navigate(`/c/${newChat._id}`, { state: { initialMessage: textToSend, initialAttachment: currentAttachment, selectedModel } });
                }
            } catch (err) {
                console.error(err);
            }
            return;
        }

        const userMessage: Message = { _id: Date.now().toString(), role: 'user', content: textToSend, attachment: currentAttachment || undefined };
        setMessages(prev => [...prev, userMessage]);
        if (initialMessageText === undefined) {
            setInput('');
            setAttachment(null);
        }
        setIsTyping(true);

        const controller = new AbortController();
        setAbortController(controller);

        try {
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats/stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                signal: controller.signal,
                body: JSON.stringify({ chatId: id, message: textToSend, attachment: currentAttachment, personality: 'assistant', provider: modelToUse })
            });

            if (!res.ok) throw new Error('API Error');

            const reader = res.body?.getReader();
            const decoder = new TextDecoder("utf-8");

            let assistantReplyText = '';
            const replyId = Date.now().toString() + 'reply';

            setMessages(prev => [...prev, { _id: replyId, role: 'assistant', content: '' }]);
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

                {attachment && (
                    <div className="relative w-16 h-16 ml-3 mt-2 rounded-xl overflow-hidden border border-white/20 group shrink-0">
                        <img src={attachment.data} className="w-full h-full object-cover" alt="Attachment preview" />
                        <button type="button" onClick={() => setAttachment(null)} className="absolute top-1 right-1 bg-black/60 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                            <X size={12} className="text-white" />
                        </button>
                    </div>
                )}
                <div className="flex items-end gap-2 md:gap-3 w-full pr-2 md:pr-3">
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2.5 md:p-3.5 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                    >
                        <Paperclip size={20} />
                    </button>
                    <button
                        type="button"
                        onClick={toggleListen}
                        className={`p-2.5 md:p-3.5 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-500 scale-105' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        <Mic size={20} />
                    </button>

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

                <select 
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="bg-black/40 text-white/90 border border-white/10 hover:border-white/20 rounded-xl px-2 py-1.5 text-[11px] md:text-xs outline-none focus:border-blue-500 transition-colors backdrop-blur-md cursor-pointer self-center mr-1"
                >
                    <option value="gemini">✨ Gemini</option>
                    <option value="ollama">🦙 Ollama</option>
                    <option value="nvidia">🟢 NVIDIA GLM</option>
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
                        disabled={(!input.trim() && !attachment)}
                        className="p-2.5 md:p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed group flex-shrink-0 w-[38px] h-[38px] md:w-[42px] md:h-[42px] flex items-center justify-center"
                    >
                        <Send size={18} className="translate-x-0.5 -translate-y-0.5" />
                    </button>
                )}
                </div>
            </form>
        </div>
    );

    if (!id) {
        return (
            <div className="flex-1 flex flex-col bg-[#050505] text-white relative overflow-hidden h-full">
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
            </div>
        );
    }

    return (
        <div className="flex-1 flex h-full w-full bg-[#050505] text-white relative overflow-hidden">
            {/* Chat Area */}
            <div className={`flex flex-col h-full transition-all duration-500 z-10 ${activeArtifact ? 'w-full md:w-[45%] lg:w-[40%] xl:w-[35%] border-r border-white/10 bg-[#050505]/95 backdrop-blur-xl shrink-0' : 'w-full'}`}>
                <div className="flex-1 overflow-y-auto px-2 md:px-0 scrollbar-hide pt-4 md:pt-8 min-h-0 w-full flex flex-col">
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

                                        {msg.attachment && (
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

                                        <div className={`prose prose-invert max-w-none break-words overflow-x-auto min-w-0 ${isTyping && msg.role === 'assistant' && index === messages.length - 1 ? 'typing-active' : ''} ${msg.role === 'user' ? 'text-[15px] md:text-[15.5px] text-white font-medium tracking-wide' : 'text-[15px] md:text-[16px] leading-[1.7] md:leading-[1.8] text-gray-200 prose-headings:text-white prose-headings:font-semibold prose-strong:text-white prose-a:text-blue-400 prose-code:text-blue-300'}`}>
                                            {msg.content === '' && isTyping ? (
                                                <div className="flex items-center gap-4 py-4 opacity-90 pl-2">
                                                    <div className="relative w-7 h-7 flex items-center justify-center">
                                                        <VLogo className="w-3.5 h-3.5 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,1)] z-10 animate-pulse" />
                                                        <motion.div
                                                            animate={{ rotate: 360 }}
                                                            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
                                                            className="absolute inset-0 rounded-full border-[2px] border-transparent border-t-blue-500 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-1.5 bg-white/5 px-4 py-2 rounded-full border border-white/10 shadow-[0_0_15px_rgba(59,130,246,0.15)]">
                                                        <span className="text-sm text-blue-400 font-medium tracking-wider uppercase text-[11px]">Thinking</span>
                                                        <div className="flex gap-1 ml-1 items-center">
                                                            <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.span>
                                                            <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.span>
                                                            <motion.span animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }} className="w-1.5 h-1.5 bg-blue-400 rounded-full"></motion.span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                msg.role === 'user' ? msg.content :
                                                    <ReactMarkdown
                                                        components={{
                                                            code(props) {
                                                                const { children, className, node, ref, ...rest } = props
                                                                const match = /language-(\w+)/.exec(className || '')
                                                                const isHtml = match && match[1] === 'html';
                                                                return match ? (
                                                                    <div 
                                                                        className="relative group/code my-6 overflow-hidden max-w-full"
                                                                    >
                                                                        {isHtml && (
                                                                            <button
                                                                                onClick={() => setActiveArtifact({ code: String(children), id: Date.now().toString() })}
                                                                                className="absolute top-3 right-3 z-20 opacity-0 group-hover/code:opacity-100 transition-opacity bg-blue-600/90 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-lg font-medium backdrop-blur-md border border-blue-400/30"
                                                                            >
                                                                                <Layout size={14} />
                                                                                Preview UI
                                                                            </button>
                                                                        )}
                                                                        <div className="overflow-x-auto w-full max-w-full">
                                                                            <SyntaxHighlighter
                                                                                {...rest}
                                                                                PreTag="div"
                                                                                children={String(children).replace(/\n$/, '')}
                                                                                language={match[1]}
                                                                                style={vscDarkPlus}
                                                                                className="rounded-[16px] m-0 border border-white/10 shadow-2xl text-[13px] md:text-[14px] min-w-max"
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <code {...rest} className={className + " bg-white/10 text-gray-200 rounded-md px-1.5 py-0.5 text-[14.5px]"}>
                                                                        {children}
                                                                    </code>
                                                                )
                                                            }
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                            )}
                                        </div>
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
                        className="hidden md:flex flex-1 h-full bg-[#0A0A0A] relative flex-col z-0 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
                    >
                        {/* Header */}
                        <div className="h-14 bg-gradient-to-r from-[#0f0f0f] to-[#111] border-b border-white/10 flex items-center justify-between px-5 shrink-0 z-10 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-blue-500/20 rounded-lg border border-blue-500/30">
                                    <Layout size={14} className="text-blue-400" />
                                </div>
                                <span className="text-sm font-semibold tracking-wide text-gray-200">Generative UI Preview</span>
                            </div>
                            <button
                                onClick={() => setActiveArtifact(null)}
                                className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/10"
                            >
                                <X size={16} />
                            </button>
                        </div>
                        {/* Iframe Box */}
                        <div className="flex-1 w-full bg-[#050505] p-2 md:p-4">
                            <div className="w-full h-full rounded-[20px] overflow-hidden border border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)] bg-[#050505] relative">
                                <iframe
                                    key={activeArtifact.id}
                                    title="Preview"
                                    className="absolute inset-0 w-full h-full border-none bg-transparent"
                                    sandbox="allow-scripts allow-modals allow-forms allow-popups allow-same-origin"
                                    srcDoc={`
                                        <!DOCTYPE html>
                                        <html class="dark">
                                            <head>
                                                <meta charset="UTF-8">
                                                <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                                            <body class="antialiased">
                                                ${activeArtifact.code}
                                            </body>
                                        </html>
                                    `}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
