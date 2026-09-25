'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Mail } from 'lucide-react';
import { Button, Input, Label } from '@/shared/ui';

export default function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                credentials: 'include',
                cache: 'no-store',
                body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setError(data.error || 'Falha ao entrar. Verifique suas credenciais.');
                return;
            }
            router.push('/app');
            router.refresh();
        } catch {
            setError('Falha de conexão com o servidor.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-lg p-6 space-y-4">
            {error && (
                <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg p-3">{error}</div>
            )}
            <div className="space-y-2">
                <Label htmlFor="login-email">E-mail</Label>
                <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                        id="login-email"
                        type="email"
                        required
                        autoComplete="email"
                        placeholder="adm@zeldapdv.lab"
                        className="pl-10 h-12"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <div className="relative">
                    <Lock size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <Input
                        id="login-password"
                        type="password"
                        required
                        autoComplete="current-password"
                        placeholder="••••••••"
                        className="pl-10 h-12"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                </div>
            </div>
            <Button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold text-lg"
            >
                {loading ? 'Entrando...' : 'Entrar'}
            </Button>
            <p className="text-xs text-center text-gray-400">
                Usuário padrão: <strong>adm@zeldapdv.lab</strong> — senha: <strong>admin123</strong> (troque após o 1º acesso)
            </p>
        </form>
    );
}