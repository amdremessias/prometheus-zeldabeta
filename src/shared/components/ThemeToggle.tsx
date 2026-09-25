'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/shared/ui/button';

const KEY = 'zpdv-theme';
type Theme = 'light' | 'dark';

function getStoredTheme(): Theme {
    if (typeof window === 'undefined') return 'light';
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeToggle({ className }: { className?: string }) {
    const [theme, setTheme] = useState<Theme>('light');

    useEffect(() => {
        const id = window.setTimeout(() => setTheme(getStoredTheme()), 0);
        return () => window.clearTimeout(id);
    }, []);

    const toggle = () => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark';
        setTheme(next);
        document.documentElement.classList.toggle('dark', next === 'dark');
        try {
            localStorage.setItem(KEY, next);
        } catch {
            /* ignore */
        }
    };

    return (
        <Button
            variant="ghost"
            className={className}
            onClick={toggle}
            aria-label="Alternar modo claro/escuro"
        >
            {theme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            {theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        </Button>
    );
}