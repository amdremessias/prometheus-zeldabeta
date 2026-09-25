'use client';
import { ClientDataType, ClientDataKeys } from '@/types/ClientDataType';
import { IDBPDatabase, openDB } from 'idb';
import gerarDadosRestauranteFake from '../demo/generateData';

class LocalDatabase {
    private dbInstance: IDBPDatabase | null = null;

    private async getDb(): Promise<IDBPDatabase> {
        if (typeof window === 'undefined') {
            throw new Error('indexedDB só pode ser usado no client-side.');
        }
        if (this.dbInstance) return this.dbInstance;
        this.dbInstance = await openDB('empresa-db', 2, {
            upgrade(db) {
                db.createObjectStore('cardapio');
                db.createObjectStore('mesas');
                db.createObjectStore('config');
                db.createObjectStore('entrega');
                db.createObjectStore('contabilidade');
                db.createObjectStore('cozinha');
                db.createObjectStore('mesaSelecionadaId');
                db.createObjectStore('deliverySelecionado');
                if (!db.objectStoreNames.contains('clientes')) {
                    db.createObjectStore('clientes');
                }
            },
        });
        return this.dbInstance;
    }

    public async salvarData<K extends ClientDataKeys>(store: K, data: ClientDataType[K]): Promise<void> {
        const db = await this.getDb();
        await db.put(store, data, 'dados');
    }

    public async carregarClient(): Promise<ClientDataType> {
        const db = await this.getDb();
        const [cardapio, mesas, config, entrega, contabilidade, cozinha, mesaSelecionadaId, deliverySelecionado, clientes] =
            await Promise.all([
                db.get('cardapio', 'dados'),
                db.get('mesas', 'dados'),
                db.get('config', 'dados'),
                db.get('entrega', 'dados'),
                db.get('contabilidade', 'dados'),
                db.get('cozinha', 'dados'),
                db.get('mesaSelecionadaId', 'dados'),
                db.get('deliverySelecionado', 'dados'),
                db.get('clientes', 'dados'),
            ]);

        await Promise.all(
            (cardapio as ClientDataType['cardapio']).pratos.map(async (item) => {
                return {
                    title: item.title,
                    imageBlob: item.imageBlob,
                    imageURL: URL.createObjectURL(item.imageBlob),
                    category: Array.isArray(item.category) ? item.category.map(Number) : [],
                };
            })
        );

        return {
            cardapio,
            mesas,
            config,
            entrega,
            contabilidade,
            cozinha,
            mesaSelecionadaId,
            deliverySelecionado,
            clientes,
            vendas: [],
            caixa: {
                status: 'fechado',
                initialAmount: 0,
            },
        };
    }

    public async carregarDemo(): Promise<ClientDataType> {
        return await gerarDadosRestauranteFake();
    }
}

// Exporta um singleton para evitar abrir muitas conexões
export const localDatabase = new LocalDatabase();
