'use client';
import { Card, Button } from '@/shared/ui';
import { Minus, Plus } from 'lucide-react';

type Props = {
    itemCurrent: CardapioFoodType;
    qtd: number;
    handleDecrease: () => void;
    onAddToOptions?: (food: CardapioFoodType) => void;
};

export function FoodCard({ itemCurrent, qtd, handleDecrease, onAddToOptions }: Props) {
    return (
        <Card className="overflow-hidden pt-0 gap-4">
            <div className="relative">
                <img
                    src={itemCurrent.imageURL || '/placeholder.svg'}
                    alt={itemCurrent.title}
                    width={500}
                    height={500}
                    className="w-full h-65 object-cover"
                />
                {itemCurrent.discount && (
                    <div className="absolute top-2 left-2 bg-yellow-400 text-black px-2 py-1 rounded-md text-xs font-medium">
                        {itemCurrent.discount}% de desconto
                    </div>
                )}
            </div>
            <div className="p-3 pb-0 h-full flex flex-col">
                <h3 className="text-sm font-medium mb-1">{itemCurrent.title}</h3>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-green-600 font-bold">R${itemCurrent.price.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between mt-2">
                    <Button variant="outline" size="icon" className="rounded-full" onClick={handleDecrease}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <span className="font-medium">{qtd}</span>
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full"
                        onClick={() => onAddToOptions?.(itemCurrent)}
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
}
