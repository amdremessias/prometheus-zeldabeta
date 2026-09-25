import { useDataStore } from '@/store/userStore';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import { RecordTransaction } from '../accounting/accountingActions';

export type ClienteInput = {
    nome: string;
    telefone: string;
    email: string;
    endereco: string;
    observacao?: string;
    carteiraHabilitada: boolean;
};

export function SalvarCliente(input: ClienteInput & { id?: number }) {
    const { clientes, setClientes } = useDataStore.getState();

    if (input.id !== undefined) {
        setClientes((prev) =>
            prev.map((c) =>
                c.id === input.id
                    ? {
                          ...c,
                          nome: input.nome,
                          telefone: input.telefone,
                          email: input.email,
                          endereco: input.endereco,
                          observacao: input.observacao,
                          carteiraHabilitada: input.carteiraHabilitada,
                      }
                    : c
            )
        );
        return;
    }

    const id = encontrarMenorIdDisponivel(clientes);
    const novoCliente: ClienteType = {
        id,
        nome: input.nome,
        telefone: input.telefone,
        email: input.email,
        endereco: input.endereco,
        observacao: input.observacao,
        carteiraHabilitada: input.carteiraHabilitada,
        saldo: 0,
        createdAt: new Date().toISOString(),
        movimentacoes: [],
    };

    setClientes((prev) => [...prev, novoCliente]);
}

export function RemoverCliente(id: number) {
    const { setClientes } = useDataStore.getState();
    setClientes((prev) => prev.filter((c) => c.id !== id));
}

export function ToggleCarteiraCliente(id: number) {
    const { clientes, setClientes } = useDataStore.getState();
    const cliente = clientes.find((c) => c.id === id);
    if (!cliente) return;

    // Não permite desabilitar carteira com saldo em aberto
    if (cliente.carteiraHabilitada && cliente.saldo > 0) return;

    setClientes((prev) =>
        prev.map((c) => (c.id === id ? { ...c, carteiraHabilitada: !c.carteiraHabilitada } : c))
    );
}

/* Registra um débito na carteira (compra fiado) sem gerar transação de caixa.
   A transação de venda já é registrada no PDV. */
export function LancarFiado(clienteId: number, valor: number, description: string) {
    if (valor <= 0) return;
    const { setClientes } = useDataStore.getState();

    setClientes((prev) =>
        prev.map((c) => {
            if (c.id !== clienteId) return c;
            return {
                ...c,
                saldo: c.saldo + valor,
                movimentacoes: [
                    {
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        description,
                        amount: valor,
                        tipo: 'debito' as const,
                    },
                    ...c.movimentacoes,
                ],
            };
        })
    );
}

/* Registra um pagamento (crédito) na carteira e gera a entrada no caixa. */
export function RegistrarPagamentoCliente(
    clienteId: number,
    valor: number,
    method: 'dinheiro' | 'cartao' | 'pix' = 'dinheiro'
) {
    if (valor <= 0) return;
    const { clientes, setClientes } = useDataStore.getState();
    const cliente = clientes.find((c) => c.id === clienteId);
    if (!cliente) return;

    const pagar = Math.min(valor, cliente.saldo);

    setClientes((prev) =>
        prev.map((c) => {
            if (c.id !== clienteId) return c;
            return {
                ...c,
                saldo: Math.max(0, c.saldo - pagar),
                movimentacoes: [
                    {
                        id: crypto.randomUUID(),
                        createdAt: new Date().toISOString(),
                        description: 'Pagamento de carteira',
                        amount: -pagar,
                        tipo: 'credito' as const,
                        method,
                    },
                    ...c.movimentacoes,
                ],
            };
        })
    );

    if (pagar > 0) {
        RecordTransaction({
            description: `Pagamento de carteira - ${cliente.nome}`,
            amount: pagar,
            type: 'entrada',
            date: new Date(),
        });
    }
}