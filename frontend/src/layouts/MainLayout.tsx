import { Outlet, useNavigate } from 'react-router-dom';
import { Plus, MessageSquare, Trash2, Menu, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useEffect, useState } from 'react';

export default function MainLayout() {
    const { chats, setChats } = useStore();
    const navigate = useNavigate();
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

                <div className="p-4 md:p-5">
                    <button
                        onClick={handleNewChat}
                        className="w-full flex items-center justify-center gap-2 bg-white text-black hover:bg-gray-200 py-3 md:py-2.5 px-4 rounded-xl transition-all font-medium text-sm shadow-md"
                    >
                        <Plus size={18} /> New Chat
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
        </div>
    );
}
