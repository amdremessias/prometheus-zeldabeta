import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Button } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';
import { Plus, Trash, Bike } from 'lucide-react';
import { useState } from 'react';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';

export function GeneralSettings() {
    const generalData = useDataStore((state) => state.config.geralData);
    const setConfig = useDataStore((state) => state.setConfig);

    const [novaTaxa, setNovaTaxa] = useState({ nome: '', valor: '' });

    const handleChange = (key: keyof typeof generalData, value: string | number) => {
        setConfig((prev) => ({
            ...prev,
            geralData: {
                ...prev.geralData,
                [key]: value,
            },
        }));
    };

    const handleTaxasEntrega = (taxas: TaxaEntregaType[]) => {
        setConfig((prev) => ({
            ...prev,
            geralData: {
                ...prev.geralData,
                taxasEntrega: taxas,
            },
        }));
    };

    const addTaxa = () => {
        const valor = parseFloat(novaTaxa.valor.replace(/\./g, '').replace(',', '.'));
        if (!novaTaxa.nome.trim() || !Number.isFinite(valor) || valor <= 0) return;
        const taxa: TaxaEntregaType = {
            id: encontrarMenorIdDisponivel(generalData.taxasEntrega),
            nome: novaTaxa.nome.trim(),
            valor,
        };
        handleTaxasEntrega([...generalData.taxasEntrega, taxa]);
        setNovaTaxa({ nome: '', valor: '' });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-bold">
                Configurações Gerais{' '}
                <span className="font-normal text-sm text-gray-600 ml-3">Alterações são salvas automaticamente</span>
            </h2>

            <div className="space-y-6">
                <div className="space-y-2">
                    <Label htmlFor="restaurant-name">Nome do Restaurante</Label>
                    <Input
                        id="restaurant-name"
                        defaultValue={generalData.restaurantName}
                        onChange={(e) => handleChange('restaurantName', e.target.value)}
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input
                        id="address"
                        defaultValue={generalData.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                    />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                            id="phone"
                            defaultValue={generalData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                            id="email"
                            type="email"
                            defaultValue={generalData.email}
                            onChange={(e) => handleChange('email', e.target.value)}
                        />
                    </div>
                </div>

                <div className="space-y-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="tax-rate">Taxa de Serviço (%)</Label>
                        <Input
                            id="tax-rate"
                            type="number"
                            defaultValue={generalData.taxRate}
                            onChange={(e) => handleChange('taxRate', e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="currency">Moeda</Label>
                        <Select
                            defaultValue={generalData.currency}
                            onValueChange={(val) => handleChange('currency', val)}
                        >
                            <SelectTrigger id="currency" className="w-full">
                                <SelectValue placeholder="Selecione a moeda" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="BRL">Real Brasileiro (R$)</SelectItem>
                                <SelectItem value="USD">Dólar Americano ($)</SelectItem>
                                <SelectItem value="EUR">Euro (€)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Taxas de entrega */}
                <div className="space-y-3 border rounded-lg p-4">
                    <h3 className="font-bold flex items-center gap-2">
                        <Bike className="h-4 w-4 text-green-600" />
                        Taxas de entrega (Cardápio Digital)
                    </h3>

                    <div className="space-y-2">
                        {generalData.taxasEntrega.length === 0 && (
                            <p className="text-sm text-gray-500">
                                Nenhuma taxa cadastrada. O cliente poderá escolher &quot;Retirada no local&quot;.
                            </p>
                        )}
                        {generalData.taxasEntrega.map((taxa) => (
                            <div
                                key={taxa.id}
                                className="flex items-center justify-between gap-3 border rounded-md px-3 py-2"
                            >
                                <div>
                                    <p className="text-sm font-medium">{taxa.nome}</p>
                                    <p className="text-xs text-gray-500">R$ {taxa.valor.toFixed(2)}</p>
                                </div>
                                <button
                                    className="text-red-500"
                                    onClick={() =>
                                        handleTaxasEntrega(generalData.taxasEntrega.filter((t) => t.id !== taxa.id))
                                    }
                                >
                                    <Trash className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                        <div className="space-y-1">
                            <Label htmlFor="nova-taxa-nome">Nome (ex.: Bairro Centro)</Label>
                            <Input
                                id="nova-taxa-nome"
                                value={novaTaxa.nome}
                                onChange={(e) => setNovaTaxa((prev) => ({ ...prev, nome: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1 w-28">
                            <Label htmlFor="nova-taxa-valor">Valor (R$)</Label>
                            <Input
                                id="nova-taxa-valor"
                                value={novaTaxa.valor}
                                onChange={(e) => setNovaTaxa((prev) => ({ ...prev, valor: e.target.value }))}
                                placeholder="0,00"
                            />
                        </div>
                        <Button className="bg-green-600 hover:bg-green-700 w-full sm:w-auto" onClick={addTaxa}>
                            <Plus className="h-4 w-4" />
                            Adicionar
                        </Button>
                    </div>
                </div>

                <div className="space-y-2"></div>
            </div>
        </div>
    );
}
