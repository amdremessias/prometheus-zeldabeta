'use client';
import { useDataStore } from '@/store/userStore';
import TableCard from './TableCard';

export function TableGrid() {
    const Mesas = useDataStore((state) => state.mesas);

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 w-full">
            {Mesas.length == 0 && (
                <h2 className="font-bold text-2xl text-center p-10 w-full col-span-full">
                    Não foi cadastrado nenhuma mesa, vá em configurações para cadastrar
                </h2>
            )}
            {Mesas.filter((table) => table.id != -1).map((table) => (
                <TableCard key={table.id} {...table} />
            ))}
        </div>
    );
}
