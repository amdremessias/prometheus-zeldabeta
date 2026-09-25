'use client';
import { useNavStore } from '@/store/navStore';
import { Menu } from 'lucide-react';

export function SimpleHeader({ title }: { title: string }) {
    const toggleMobileMenu = useNavStore((state) => state.toggleMobileMenu);

    return (
        <div className="bg-white p-4 flex items-center  gap-4 border-b">
            <div className="lg:hidden flex items-center absolute left-4">
                <button onClick={toggleMobileMenu} className="rounded-full">
                    <Menu size={25} className="w-full h-full" />
                </button>
            </div>
            <h1 className="text-xl font-bold text-center w-full">{title}</h1>
        </div>
    );
}
