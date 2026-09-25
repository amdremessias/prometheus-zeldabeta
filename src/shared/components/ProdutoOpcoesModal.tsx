import { useEffect, useState } from 'react';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, Label } from '@/shared/ui';
import { useDataStore } from '@/store/userStore';

export interface ProdutoOpcoesResult {
    quantity: number;
    notes: string;
    adicionais: AdicionalItemType[];
}

/* Modal de opções ao adicionar um produto ao carrinho (mesa / delivery / digital):
   quantidade, observação e adicionais (extras) marcáveis. O valor dos adicionais
   é somado ao preço unitário do item. */
export function ProdutoOpcoesModal({
    open,
    onOpenChange,
    food,
    onConfirm,
    adicionais: adicionaisProp,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    food: { id: number; title: string; imageURL?: string; adicionaisDisponiveis?: number[] } | null;
    onConfirm: (r: ProdutoOpcoesResult) => void;
    /* Catálogo de adicionais. Quando omitido, usa o da loja (mesa/delivery/pdv).
       O cardápio digital passa o catálogo do menu público, pois ali a loja não é carregada. */
    adicionais?: AdicionalType[];
}) {
    const storeAdicionais = useDataStore((state) => state.cardapio.adicionais);
    const adicionais = adicionaisProp ?? storeAdicionais;
    const [quantity, setQuantity] = useState(1);
    const [notes, setNotes] = useState('');
    const [selected, setSelected] = useState<number[]>([]);

    useEffect(() => {
        if (open) {
            setQuantity(1);
            setNotes('');
            setSelected([]);
        }
    }, [open]);

    if (!food) return null;

    const disponiveis = adicionais.filter((a) => (food.adicionaisDisponiveis || []).includes(a.id));

    const toggle = (id: number) => {
        setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
    };

    const confirm = () => {
        const escolhidos: AdicionalItemType[] = disponiveis
            .filter((a) => selected.includes(a.id))
            .map((a) => ({ id: a.id, descricao: a.descricao, valor: a.valor }));
        onConfirm({
            quantity: quantity > 0 ? quantity : 1,
            notes: notes.trim().slice(0, 500),
            adicionais: escolhidos,
        });
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{food.title}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col gap-4 pt-3">
                    {food.imageURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={food.imageURL} alt={food.title} className="w-full h-40 object-cover rounded" />
                    ) : null}
                    <div className="flex items-center justify-between">
                        <Label>Quantidade</Label>
                        <div className="flex items-center gap-3">
                            <Button variant="outline" type="button" onClick={() => setQuantity((q) => Math.max(1, q - 1))}>
                                −
                            </Button>
                            <span className="w-8 text-center">{quantity}</span>
                            <Button variant="outline" type="button" onClick={() => setQuantity((q) => q + 1)}>
                                +
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>Observação (opcional)</Label>
                        <textarea
                            className="w-full border rounded-md p-2 text-sm"
                            rows={2}
                            value={notes}
                            maxLength={500}
                            placeholder="Ex.: sem cebola"
                            onChange={(e) => setNotes(e.target.value)}
                        />
                    </div>
                    {disponiveis.length > 0 ? (
                        <div className="space-y-2">
                            <Label>Adicionais (opcional)</Label>
                            <div className="flex flex-wrap gap-2">
                                {disponiveis.map((a) => (
                                    <label
                                        key={a.id}
                                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                                            selected.includes(a.id)
                                                ? 'bg-green-50 border-green-300 text-green-700'
                                                : 'bg-white'
                                        }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={selected.includes(a.id)}
                                            onChange={() => toggle(a.id)}
                                            className="accent-green-600"
                                        />
                                        <span className="text-sm">{a.descricao}</span>
                                        <span className="text-xs text-gray-500">+ R${Number(a.valor).toFixed(2)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}
                    <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                        onClick={confirm}
                    >
                        Adicionar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
