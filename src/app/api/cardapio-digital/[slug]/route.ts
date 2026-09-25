import { NextRequest, NextResponse } from 'next/server';
import { createPedidoWeb, upsertClienteWhatsapp } from '@/lib/server/db';
import { loadMenu } from '@/lib/server/cardapioDigital';
import { checkRateLimit, clientIp } from '@/lib/server/rateLimit';
import { isNonEmptyString, MAX_ADDRESS, MAX_ITEMS, MAX_PHONE, MAX_NAME, MAX_NOTES } from '@/lib/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const result = await loadMenu(slug);
    if (!result.ok) {
        return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 });
    }
    return NextResponse.json(result.menu);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;

    // Rate limit: 10 req/min por IP (via limiter compartilhado).
    const rl = checkRateLimit(`cardapio:${clientIp(req)}`, { max: 10, windowMs: 60_000 });
    if (!rl.allowed) {
        return NextResponse.json(
            { error: 'Muitas tentativas. Aguarde um instante.' },
            { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec ?? 60) } }
        );
    }

    const result = await loadMenu(slug);
    if (!result.ok) {
        return NextResponse.json({ error: 'Cardápio não encontrado' }, { status: 404 });
    }
    const menu = result.menu!;

    let body: {
        cliente?: string;
        telefone?: string;
        endereco?: string;
        pagamento?: string;
        taxaEntregaId?: number;
        modoEntrega?: string;
        itens?: { id: number; quantity: number; notes?: string; adicionais?: { id: number }[] }[];
        aceitePrivacidade?: boolean;
        cadastroCliente?: string;
    };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Corpo da requisição não é um JSON válido' }, { status: 400 });
    }

    const cliente = String(body.cliente ?? '').trim();
    const telefone = String(body.telefone ?? '').trim();
    const endereco = String(body.endereco ?? '').trim();

    if (!isNonEmptyString(cliente, MAX_NAME)) {
        return NextResponse.json({ error: 'Nome do cliente inválido.' }, { status: 400 });
    }
    if (!isNonEmptyString(telefone, MAX_PHONE)) {
        return NextResponse.json({ error: 'Telefone inválido.' }, { status: 400 });
    }
    if (endereco.length > MAX_ADDRESS) {
        return NextResponse.json({ error: 'Endereço muito longo.' }, { status: 400 });
    }

    /* Consentimento: obrigatório aceitar a política de privacidade e informar a
       opção de cadastro (sim / não / já é cliente). */
    if (body.aceitePrivacidade !== true) {
        return NextResponse.json(
            { error: 'É necessário aceitar as políticas de privacidade para continuar.' },
            { status: 400 }
        );
    }
    const cadastroCliente = ['sim', 'nao', 'existente'].includes(String(body.cadastroCliente))
        ? String(body.cadastroCliente)
        : '';
    if (!cadastroCliente) {
        return NextResponse.json(
            { error: 'Selecione uma opção sobre o cadastro dos seus dados.' },
            { status: 400 }
        );
    }

    const itens = Array.isArray(body.itens) ? body.itens : [];
    if (itens.length === 0 || itens.length > MAX_ITEMS) {
        return NextResponse.json({ error: 'Carrinho vazio ou com muitos itens.' }, { status: 400 });
    }

    /* Recalcula o total no servidor a partir dos preços do cardápio. */
    const porId = new Map(menu.pratos.map((p) => [p.id, p]));
    const catalogoAdicionais = new Map(menu.adicionais.map((a) => [a.id, a]));
    const detalhes: {
        id: number;
        title: string;
        price: number;
        quantity: number;
        notes?: string;
        adicionais: { id: number; descricao: string; valor: number }[];
    }[] = [];
    let subtotal = 0;
    for (const item of itens) {
        const prato = porId.get(Number(item.id));
        const qty = Math.floor(Number(item.quantity));
        if (!prato || !Number.isFinite(qty) || qty <= 0 || qty > 50) continue;

        // Adicionais (extras): apenas os habilitados para o produto e presentes no catálogo.
        const disponiveis = new Set(prato.adicionaisDisponiveis ?? []);
        const adicionaisSelecionados = Array.isArray(item.adicionais) ? item.adicionais : [];
        const adicionais = adicionaisSelecionados
            .map((a) => Number(a.id))
            .filter((id) => Number.isFinite(id) && disponiveis.has(id) && catalogoAdicionais.has(id))
            .map((id) => {
                const cat = catalogoAdicionais.get(id)!;
                return { id, descricao: String(cat.descricao ?? ''), valor: Number(cat.valor) || 0 };
            });
        const adicionaisValor = adicionais.reduce((s, a) => s + a.valor, 0);

        const price = (Number(prato.price) || 0) + adicionaisValor;
        const obs = String(item.notes ?? '')
            .trim()
            .slice(0, MAX_NOTES);
        detalhes.push({ id: prato.id, title: prato.title, price, quantity: qty, notes: obs, adicionais });
        subtotal += price * qty;
    }
    if (detalhes.length === 0) {
        return NextResponse.json({ error: 'Itens inválidos no carrinho.' }, { status: 400 });
    }

    const taxaId = Number(body.taxaEntregaId);
    const taxa = menu.taxasEntrega.find((t) => t.id === taxaId);
    const taxaValor = taxa ? Number(taxa.valor) || 0 : 0;
    const taxaNome = taxa ? taxa.nome : '';
    const total = subtotal + taxaValor;

    const modoEntrega =
        body.modoEntrega === 'entrega' || body.modoEntrega === 'retirada'
            ? body.modoEntrega
            : taxa
              ? 'entrega'
              : 'retirada';
    if (modoEntrega === 'entrega' && !endereco.trim()) {
        return NextResponse.json(
            { error: 'Informe o endereço de entrega para pedidos com taxa de entrega.' },
            { status: 400 }
        );
    }

    const pagamento = ['dinheiro', 'cartao', 'pix'].includes(String(body.pagamento))
        ? String(body.pagamento)
        : 'dinheiro';

    await createPedidoWeb({
        slug,
        cliente,
        telefone,
        endereco,
        pagamento,
        modoEntrega,
        origem: 'cardapio_digital',
        taxaEntregaNome: taxaNome,
        taxaEntregaValor: taxaValor,
        itens: detalhes,
        subtotal,
        total,
    });

    /* Se o cliente optou por cadastrar, registra-o na área de Clientes como
       "Novo Cliente - Cardápio Digital". Demais opções não armazenam o cliente. */
    if (cadastroCliente === 'sim') {
        try {
            await upsertClienteWhatsapp({
                nome: cliente,
                telefone,
                endereco,
                observacao: 'Novo Cliente - Cardápio Digital',
            });
        } catch {
            // Falha no cadastro não deve impedir o pedido.
        }
    }

    return NextResponse.json({ ok: true, total, cadastroCliente }, { status: 201 });
}
