import { Outlet, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, Menu, X, Brain } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface MemoryItem {
    _id: string;
    role: string;
    content: string;
    createdAt: string;
}

export default function MainLayout() {
    const { chats, setChats } = useStore();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Advanced Memory Dashboard state
    const [userId, setUserId] = useState<string>('');
    const [isMemoryModalOpen, setIsMemoryModalOpen] = useState(false);
    const [memories, setMemories] = useState<MemoryItem[]>([]);
    const [newMemoryInput, setNewMemoryInput] = useState('');
    const [isLoadingMemories, setIsLoadingMemories] = useState(false);

    // Initialize or load persistent user ID
    useEffect(() => {
        let id = localStorage.getItem('vchat_user_id');
        if (!id) {
            id = 'user_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
            localStorage.setItem('vchat_user_id', id);
        }
        setUserId(id);
    }, []);

    // Fetch memories when modal opens
    useEffect(() => {
        if (isMemoryModalOpen && userId) {
            fetchMemories();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isMemoryModalOpen, userId]);

    const fetchMemories = async () => {
        try {
            setIsLoadingMemories(true);
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats/memory/${userId}`);
            if (res.ok) {
                const data = await res.json();
                setMemories(data);
            }
        } catch (err) {
            console.error("Failed to load memories:", err);
        } finally {
            setIsLoadingMemories(false);
        }
    };

    const handleAddMemory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMemoryInput.trim() || !userId) return;
        try {
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats/memory/manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, message: newMemoryInput })
            });
            if (res.ok) {
                const newMem = await res.json();
                setMemories(prev => [newMem, ...prev]);
                setNewMemoryInput('');
            }
        } catch (err) {
            console.error("Failed to save memory:", err);
        }
    };

    const handleDeleteMemory = async (memoryId: string) => {
        try {
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats/memory/${memoryId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setMemories(prev => prev.filter(m => m._id !== memoryId));
            }
        } catch (err) {
            console.error("Failed to delete memory:", err);
        }
    };

    useEffect(() => {
        const fetchChats = async () => {
            try {
                const res = await fetch(`http://${window.location.hostname}:5000/api/chats`);
                if (!res.ok) {
                    return;
                }
                const data = await res.json();
                setChats(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchChats();
    }, [setChats]);

    const handleNewChat = async () => {
        try {
            const res = await fetch(`http://${window.location.hostname}:5000/api/chats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ title: 'New Chat' })
            });
            if (res.ok) {
                const data = await res.json();
                setChats([data, ...chats]);
                setIsMobileMenuOpen(false);
                navigate(`/c/${data._id}`);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        try {
            await fetch(`http://${window.location.hostname}:5000/api/chats/${id}`, {
                method: 'DELETE'
            });
            setChats(chats.filter(c => c._id !== id));
            navigate('/');
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex h-[100dvh] overflow-hidden bg-[#050505] w-full text-white font-sans selection:bg-blue-500/30 relative">
            
            {/* Mobile Header Menu Button */}
            <div className="md:hidden absolute top-0 left-0 p-4 z-40 pointer-events-none w-full flex justify-between items-start">
                <button 
                    onClick={() => setIsMobileMenuOpen(true)}
                    className="p-2.5 text-white/70 hover:text-white bg-white/5 rounded-xl pointer-events-auto border border-white/10 backdrop-blur-xl shadow-lg transition-colors"
                >
                    <Menu size={22} />
                </button>
            </div>

            {/* Mobile Sidebar Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="md:hidden fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm transition-opacity"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`fixed md:relative inset-y-0 left-0 z-[70] w-72 md:w-64 bg-[#050505]/95 md:bg-transparent flex-shrink-0 flex flex-col border-r border-white/10 md:border-white/5 transition-transform duration-300 md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                {/* Mobile Close Button */}
                <div className="md:hidden flex justify-between items-center p-5 border-b border-white/5">
                    <span className="font-bold tracking-widest text-white/90 text-sm">HISTORY</span>
                    <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-gray-400 hover:text-white rounded-lg bg-white/5 border border-white/5 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <div className="p-4 md:p-5 flex flex-col gap-2 shrink-0">
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200 py-3 md:py-2.5 px-4 rounded-xl transition-all font-medium text-sm shadow-md"
                    >
                        <Plus size={18} /> New Chat
                    </button>

                    <button
                        onClick={() => {
                            setIsMobileMenuOpen(false);
                            setIsMemoryModalOpen(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-white/95 py-3 md:py-2.5 px-4 rounded-xl transition-all font-medium text-sm shadow-md"
                    >
                        <Brain size={16} className="text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)] animate-pulse" />
                        Memory Dashboard
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 space-y-1 scrollbar-hide h-full pb-4">
                    {chats.map(chat => (
                        <div
                            key={chat._id}
                            onClick={() => {
                                setIsMobileMenuOpen(false);
                                navigate(`/c/${chat._id}`);
                            }}
                            className="flex items-center justify-between group p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
                        >
                            <div className="flex items-center gap-3 truncate">
                                <MessageSquare size={16} className="text-gray-500 group-hover:text-gray-300 transition-colors shrink-0" />
                                <span className="truncate text-sm text-gray-400 group-hover:text-white font-medium transition-colors">{chat.title}</span>
                            </div>
                            <button
                                onClick={(e) => handleDelete(e, chat._id)}
                                className="opacity-100 md:opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all p-2 md:p-1 shrink-0"
                            >
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="flex-1 flex flex-col relative w-full h-full bg-transparent overflow-hidden">
                <Outlet />
            </main>

            {/* Neural Brain Memory Profile Modal */}
            <AnimatePresence>
                {isMemoryModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMemoryModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-md"
                        />

                        {/* Modal Dialog */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 15 }}
                            className="relative w-full max-w-xl bg-[#0d0d0d] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] z-10"
                        >
                            {/* Header */}
                            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#0d0d0d] to-[#121212] shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-purple-500/10 rounded-xl border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)]">
                                        <Brain size={20} className="text-purple-400 animate-pulse" />
                                    </div>
                                    <div className="flex flex-col">
                                        <h2 className="text-base font-bold text-white tracking-wide uppercase">AI Memory Dashboard</h2>
                                        <span className="text-[10px] text-gray-500 font-medium">Personalized contextual profiles</span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsMemoryModalOpen(false)}
                                    className="p-2 text-gray-500 hover:text-white rounded-lg hover:bg-white/5 transition-colors border border-transparent hover:border-white/5"
                                >
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 overflow-y-auto flex-1 flex flex-col gap-6 min-h-0">
                                {/* Instructions */}
                                <p className="text-xs leading-relaxed text-gray-400">
                                    V-CHAT continuously updates its neural memory from your conversations, recalling key facts (name, goals, projects, preferences) to formulate personalized responses. Use this control panel to view, add, or delete memories.
                                </p>

                                {/* Add Custom Memory Form */}
                                <form onSubmit={handleAddMemory} className="flex gap-2 shrink-0">
                                    <input
                                        type="text"
                                        value={newMemoryInput}
                                        onChange={(e) => setNewMemoryInput(e.target.value)}
                                        placeholder="Teach V-CHAT something (e.g. My name is Alex, I build AI)..."
                                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-purple-500/50 transition-colors text-[13px]"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMemoryInput.trim()}
                                        className="bg-white text-black hover:bg-gray-200 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                                    >
                                        <Plus size={14} /> Add
                                    </button>
                                </form>

                                {/* Memories List */}
                                <div className="flex-grow flex flex-col min-h-[200px]">
                                    <h3 className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3 shrink-0">Retained Facts ({memories.length})</h3>
                                    
                                    {isLoadingMemories ? (
                                        <div className="flex-1 flex flex-col items-center justify-center py-10 opacity-60">
                                            <div className="w-8 h-8 rounded-full border-2 border-t-purple-500 border-r-transparent border-b-transparent border-l-transparent animate-spin mb-3"></div>
                                            <span className="text-xs text-gray-500">Querying semantic brain...</span>
                                        </div>
                                    ) : memories.length === 0 ? (
                                        <div className="flex-1 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center p-6 select-none opacity-40">
                                            <Brain size={28} className="mb-2 text-gray-500" />
                                            <p className="text-xs">No memories stored yet.</p>
                                            <p className="text-[10px] max-w-xs mt-1">Speak normally in chat or write facts manually above to start training V-CHAT's brain.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2 max-h-[35vh] overflow-y-auto pr-1">
                                            {memories.map((mem) => {
                                                const date = new Date(mem.createdAt).toLocaleDateString(undefined, { 
                                                    month: 'short', 
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                });
                                                
                                                return (
                                                    <div
                                                        key={mem._id}
                                                        className="flex items-center justify-between gap-4 p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors group"
                                                    >
                                                        <div className="flex-1 flex flex-col gap-1 min-w-0">
                                                            <p className="text-[13px] text-gray-200 break-words leading-relaxed">{mem.content}</p>
                                                            <div className="flex items-center gap-2 text-[9px] text-gray-500">
                                                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold ${
                                                                    mem.role === 'assistant' 
                                                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' 
                                                                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                                                                }`}>
                                                                    {mem.role === 'assistant' ? 'AI REPLY' : 'USER INPUT'}
                                                                </span>
                                                                <span>•</span>
                                                                <span>{date}</span>
                                                            </div>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMemory(mem._id)}
                                                            className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-all shrink-0 opacity-100 group-hover:opacity-100"
                                                            title="Delete Fact"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
