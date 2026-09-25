'use client';
import { useEffect, useRef, useState } from 'react';
import { Button, Label } from '@/shared/ui';
import { defaultLogo, defaultSelo } from '@/shared/lib/branding';
import { BrandingImage } from '@/shared/components/BrandingImage';
import { useDataStore } from '@/store/userStore';
import { showMessage } from '@/store/popupStore';

export function SettingsBranding() {
    const setConfig = useDataStore((state) => state.setConfig);
    const branding = useDataStore((state) => state.config?.branding);

    const [logoBust, setLogoBust] = useState(0);
    const [seloBust, setSeloBust] = useState(0);
    const [busy, setBusy] = useState<'logo' | 'selo' | null>(null);
    const [presets, setPresets] = useState<string[]>([]);
    const [presetBusy, setPresetBusy] = useState<'logo' | 'selo' | null>(null);

    const logoInput = useRef<HTMLInputElement>(null);
    const seloInput = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetch('/api/branding/presets')
            .then((r) => (r.ok ? r.json() : Promise.resolve({ presets: [] })))
            .then((d) => setPresets(d.presets || []))
            .catch(() => setPresets([]));
    }, []);

    const upload = async (type: 'logo' | 'selo', file: File | undefined) => {
        if (!file) {
            showMessage('Selecione uma imagem.', 'error');
            return;
        }
        if (!file.type.startsWith('image/')) {
            showMessage('O arquivo deve ser uma imagem.', 'error');
            return;
        }
        setBusy(type);
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
                reader.readAsDataURL(file);
            });
            const res = await fetch('/api/branding', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, dataUrl }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                showMessage(data.error || 'Falha ao enviar imagem.', 'error');
                return;
            }
            setConfig((prev) => ({
                ...prev,
                branding: { ...prev.branding, [type]: `/api/branding/${type}` },
            }));
            showMessage('Imagem atualizada com sucesso!', 'success');
            if (type === 'logo') setLogoBust(Date.now());
            else setSeloBust(Date.now());
        } catch {
            showMessage('Erro de conexão ao enviar a imagem.', 'error');
        } finally {
            setBusy(null);
        }
    };

    const selectPreset = (type: 'logo' | 'selo', url: string) => {
        setPresetBusy(type);
        setConfig((prev) => ({
            ...prev,
            branding: { ...prev.branding, [type]: url },
        }));
        showMessage('Imagem selecionada. Salvando...', 'success');
        setPresetBusy(null);
        if (type === 'logo') setLogoBust(Date.now());
        else setSeloBust(Date.now());
    };

    const useDefault = (type: 'logo' | 'selo') => {
        setConfig((prev) => ({
            ...prev,
            branding: { ...prev.branding, [type]: undefined },
        }));
        showMessage('Marca padrão restaurada.', 'success');
        if (type === 'logo') setLogoBust(Date.now());
        else setSeloBust(Date.now());
    };

    const renderPicker = (type: 'logo' | 'selo', title: string, description: string) => (
        <div>
            <h3 className="font-semibold mb-1">{title}</h3>
            <p className="text-sm text-gray-500 mb-3">{description}</p>
            <div className="flex flex-wrap items-center gap-4 mb-4">
                <BrandingImage
                    kind={type}
                    fallback={type === 'logo' ? defaultLogo : defaultSelo}
                    alt={title}
                    className="h-20 w-20 object-contain border rounded-lg bg-white"
                    cacheBust={type === 'logo' ? logoBust : seloBust}
                />
                <div>
                    <Label className="block mb-1">Selecionar imagem (PNG/JPG/WEBP, até 2.5 MB)</Label>
                    <input ref={type === 'logo' ? logoInput : seloInput} type="file" accept="image/*" className="block mb-2 text-sm" />
                    <div className="flex gap-2">
                        <Button
                            disabled={busy === type}
                            onClick={() => upload(type, (type === 'logo' ? logoInput : seloInput).current?.files?.[0])}
                        >
                            Enviar arquivo
                        </Button>
                        <Button variant="ghost" onClick={() => useDefault(type)}>
                            Usar padrão
                        </Button>
                    </div>
                </div>
            </div>

            <div className="border rounded-lg p-3">
                <p className="text-sm font-medium mb-2">Ou escolha uma imagem já existente na pasta public:</p>
                {presets.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhuma imagem disponível.</p>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                        {presets.map((url) => {
                            const selected = branding?.[type] === url;
                            return (
                                <button
                                    key={url}
                                    type="button"
                                    disabled={presetBusy === type}
                                    onClick={() => selectPreset(type, url)}
                                    title={url}
                                    className={`relative border rounded-lg p-1 bg-white hover:bg-green-50 ${
                                        selected ? 'ring-2 ring-green-600' : ''
                                    }`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={url} alt={url} className="h-14 w-full object-contain" />
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            {renderPicker(
                'logo',
                'Logo do Zelda PDV',
                'Exibido no login (acima dos campos de credenciais) e na barra de navegação da plataforma.'
            )}
            {renderPicker(
                'selo',
                'Selo de Segurança do Sistema',
                'Exibido no login (abaixo dos campos de credenciais) e na barra lateral.'
            )}
        </div>
    );
}
