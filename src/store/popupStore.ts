import { create } from 'zustand';

type Message = {
    id: string;
    content: string;
    duration?: number;
    status: 'success' | 'error';
};

type PopupState = {
    messages: Message[];
    showMessage: (content: string, status?: Message['status'], duration?: number) => void;
};

export const usePopupStore = create<PopupState>((set) => ({
    messages: [],

    showMessage: (content, status = 'success', duration = 5000) => {
        const id = crypto.randomUUID();
        const newMsg = { id, content, duration, status };

        set((state) => ({
            messages: [...state.messages, newMsg],
        }));

        setTimeout(() => {
            set((state) => ({
                messages: state.messages.filter((m) => m.id !== id),
            }));
        }, duration);
    },
}));

export const showMessage = (content: string, status?: Message['status'], duration?: number) =>
    usePopupStore.getState().showMessage(content, status, duration);
