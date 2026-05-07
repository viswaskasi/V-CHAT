import { create } from 'zustand';

interface Chat {
    _id: string;
    title: string;
    updatedAt: string;
}

interface StoreState {
    chats: Chat[];
    currentChatId: string | null;
    setChats: (chats: Chat[]) => void;
    setCurrentChatId: (id: string | null) => void;
}

export const useStore = create<StoreState>((set) => ({
    chats: [],
    currentChatId: null,
    setChats: (chats) => set({ chats }),
    setCurrentChatId: (id) => set({ currentChatId: id }),
}));
