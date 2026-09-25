import {
    Button,
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    Input,
    Label,
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from '@/shared/ui';
import { PlusCircle, Edit, Trash } from 'lucide-react';
import { useDataStore } from '@/store/userStore';
import { removeCategoria, removeProduto, updateCategoria, updateProduto, recalcCategoriaCounts, addAdicional, updateAdicional, removeAdicional } from './settingsActions';
import { useState } from 'react';
import { encontrarMenorIdDisponivel } from '@/shared/lib/utils';
import { showMessage } from '@/store/popupStore';
import { availableIcons } from '@/shared/lib/availableIcons';

/* Tipos de imagem aceitos e tamanho máximo (2 MB). */
const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2 MB

function isValidImageFile(file: File): boolean {
    return ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number]) && file.size <= MAX_IMAGE_SIZE;
}

function handleImageFileChange(
    e: React.ChangeEvent<HTMLInputElement>,
    setState: (file: File | undefined) => void
) {
    const file = e.target.files?.[0];
    if (!file) { setState(undefined); return; }
    if (!isValidImageFile(file)) {
        showMessage('Imagem inválida: use PNG, JPEG, WebP ou GIF, máx. 2 MB.', 'error');
        setState(undefined);
        return;
    }
    setState(file);
}

/* Converte texto de input em número inteiro não-negativo (vazio = sem controle de estoque). */
function numeroOuUndefined(v: string): number | undefined {
    if (v.trim() === '') return undefined;
    const n = Math.floor(Number(v));
    return Number.isFinite(n) && n >= 0 ? n : undefined;
}

export function MenuSettings() {
    const pratos = useDataStore((state) => state.cardapio.pratos);
    const categorias = useDataStore((state) => state.cardapio.categorias);
    const adicionais = useDataStore((state) => state.cardapio.adicionais);
    const setCardapio = useDataStore((state) => state.setCardapio);

    const [dialogAdicional, setDialogAdicional] = useState(false);
    const [editAdicionalId, setEditAdicionalId] = useState<number | null>(null);
    const [tempAdicional, setTempAdicional] = useState<{ descricao: string; valor: string }>({ descricao: '', valor: '' });
    const [editAdicional, setEditAdicional] = useState<{ descricao: string; valor: string }>({ descricao: '', valor: '' });

    function StartEditAdicional(item: { id: number; descricao: string; valor: number }) {
        setEditAdicionalId(item.id);
        setEditAdicional({ descricao: item.descricao, valor: String(item.valor) });
    }

    function SaveEditAdicional() {
        if (editAdicionalId == null) return;
        const v = Number(editAdicional.valor);
        if (!editAdicional.descricao.trim() || !Number.isFinite(v) || v < 0) {
            showMessage('Informe a descrição e um valor válido.', 'error');
            return;
        }
        updateAdicional(editAdicionalId, { descricao: editAdicional.descricao, valor: v });
        setEditAdicionalId(null);
    }

    function addAdicionalNow() {
        const valor = Number(tempAdicional.valor);
        if (!tempAdicional.descricao.trim() || !Number.isFinite(valor) || valor < 0) {
            showMessage('Informe a descrição e um valor válido.', 'error');
            return;
        }
        addAdicional(tempAdicional.descricao, valor);
        setTempAdicional({ descricao: '', valor: '' });
        setDialogAdicional(false);
    }

    const [dialogPrato, setDialogPrato] = useState(false);
    const [dialogCategoria, setDialogCategoria] = useState(false);

    const [tempPrato, setTempPrato] = useState<
        Omit<CardapioFoodType, 'imageBlob' | 'imageURL' | 'id'> & { imageFile?: File }
    >({
        imageFile: undefined,
        title: '',
        price: 0,
        discount: undefined,
        category: [],
        adicionaisDisponiveis: [],
        status: 'Ativo',
        estoqueAtual: undefined,
        estoqueMinimo: undefined,
        ncm: undefined,
        cest: undefined,
        unidadeComercial: undefined,
        origem: undefined,
        csosn: undefined,
        cst: undefined,
        cfop: 5102,
        codigoBarras: undefined,
        codigoInterno: undefined,
    });
    const [tempCategorias, setTempCategorias] = useState<Omit<CategoriesType, 'id' | 'qtdItems'>>({
        icon: '',
        label: '',
    });

    const [editPratoId, setEditPratoId] = useState<number | null>(null);
    const [editPrato, setEditPrato] = useState<{
        title: string;
        price: number;
        discount?: number;
        category: number[];
        adicionaisDisponiveis: number[];
        status: string;
        imageFile?: File;
        estoqueAtual?: number;
        estoqueMinimo?: number;
        ncm?: string;
        cest?: string;
        unidadeComercial?: 'UN' | 'KG' | 'CX' | 'LT';
        origem?: string;
        csosn?: string;
        cst?: string;
        cfop?: number;
        codigoBarras?: string;
        codigoInterno?: string;
    }>({ title: '', price: 0, discount: undefined, category: [], adicionaisDisponiveis: [], status: 'Ativo' });

    const [editCategoriaId, setEditCategoriaId] = useState<number | null>(null);
    const [editCategoria, setEditCategoria] = useState<{ icon: string; label: string }>({ icon: '', label: '' });

    function StartEditPrato(item: CardapioFoodType) {
        setEditPratoId(item.id);
        setEditPrato({
            title: item.title,
            price: item.price,
            discount: item.discount,
            category: item.category,
            adicionaisDisponiveis: item.adicionaisDisponiveis || [],
            status: item.status,
            imageFile: undefined,
            estoqueAtual: item.estoqueAtual,
            estoqueMinimo: item.estoqueMinimo,
            ncm: item.ncm,
            cest: item.cest,
            unidadeComercial: item.unidadeComercial,
            origem: item.origem,
            csosn: item.csosn,
            cst: item.cst,
            cfop: item.cfop,
            codigoBarras: item.codigoBarras,
            codigoInterno: item.codigoInterno,
        });
    }

    function SaveEditPrato() {
        if (editPratoId == null) return;
        if (!editPrato.title.trim() || editPrato.price <= 0) {
            showMessage('Informe o nome e o preço do produto.', 'error');
            return;
        }
        const data: Partial<Omit<CardapioFoodType, 'id'>> = {
            title: editPrato.title.trim(),
            price: editPrato.price,
            discount: editPrato.discount || undefined,
            category: editPrato.category,
            adicionaisDisponiveis: editPrato.adicionaisDisponiveis,
            status: editPrato.status,
            estoqueAtual: editPrato.estoqueAtual,
            estoqueMinimo: editPrato.estoqueMinimo,
            ncm: editPrato.ncm || undefined,
            cest: editPrato.cest || undefined,
            unidadeComercial: editPrato.unidadeComercial || undefined,
            origem: editPrato.origem || undefined,
            csosn: editPrato.csosn || undefined,
            cst: editPrato.cst || undefined,
            cfop: editPrato.cfop || undefined,
            codigoBarras: editPrato.codigoBarras?.trim() || undefined,
            codigoInterno: editPrato.codigoInterno?.trim() || undefined,
        };
        if (editPrato.imageFile) {
            data.imageBlob = new Blob([editPrato.imageFile], { type: editPrato.imageFile.type });
            data.imageURL = URL.createObjectURL(data.imageBlob as Blob);
        }
        updateProduto(editPratoId, data);
        setEditPratoId(null);
    }

    function StartEditCategoria(cat: CategoriesType) {
        setEditCategoriaId(cat.id);
        setEditCategoria({ icon: cat.icon, label: cat.label });
    }

    function SaveEditCategoria() {
        if (editCategoriaId == null) return;
        if (!editCategoria.label.trim()) {
            showMessage('Informe o nome da categoria.', 'error');
            return;
        }
        updateCategoria(editCategoriaId, { icon: editCategoria.icon, label: editCategoria.label.trim() });
        setEditCategoriaId(null);
    }

    function addPrato() {
        if (!tempPrato.imageFile) return;
        const imageBlob = new Blob([tempPrato.imageFile], { type: tempPrato.imageFile.type });
        setCardapio((prev) => recalcCategoriaCounts({
            ...prev,
            pratos: [
                ...prev.pratos,
                {
                    id: encontrarMenorIdDisponivel(prev.pratos),
                    imageBlob: imageBlob,
                    imageURL: URL.createObjectURL(imageBlob),
                    title: tempPrato.title,
                    price: tempPrato.price,
                    discount: tempPrato.discount,
                    category: tempPrato.category,
                    adicionaisDisponiveis: tempPrato.adicionaisDisponiveis,
                    status: tempPrato.status,
                    estoqueAtual: tempPrato.estoqueAtual,
                    estoqueMinimo: tempPrato.estoqueMinimo,
                    ncm: tempPrato.ncm,
                    cest: tempPrato.cest,
                    unidadeComercial: tempPrato.unidadeComercial,
                    origem: tempPrato.origem,
                    csosn: tempPrato.csosn,
                    cst: tempPrato.cst,
                    cfop: tempPrato.cfop,
                    codigoBarras: tempPrato.codigoBarras,
                    codigoInterno: tempPrato.codigoInterno,
                },
            ],
        }));
        setDialogCategoria(false);
        showMessage('Produto adicionado com sucesso');
        setTempPrato({
            imageFile: undefined,
            title: '',
            price: 0,
            discount: undefined,
            category: [],
            adicionaisDisponiveis: [],
            status: 'Ativo',
            estoqueAtual: undefined,
            estoqueMinimo: undefined,
            ncm: undefined,
            cest: undefined,
            unidadeComercial: undefined,
            origem: undefined,
            csosn: undefined,
            cst: undefined,
            cfop: 5102,
            codigoBarras: undefined,
            codigoInterno: undefined,
        });
    }

    function addCategorias() {
        if (!tempCategorias.label.trim()) {
            showMessage('Informe o nome da categoria.', 'error');
            return;
        }
        setCardapio((prev) => recalcCategoriaCounts({
            ...prev,
            categorias: [
                ...prev.categorias,
                { id: encontrarMenorIdDisponivel(prev.categorias), qtdItems: 0, ...tempCategorias },
            ],
        }));
        setDialogCategoria(false);
        showMessage('Categoria adicionada com sucesso');
        setTempCategorias({
            icon: '',
            label: '',
        });
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Gerenciamento de Cardápio</h2>
            </div>

            <Tabs defaultValue="items">
                <div className="flex justify-between">
                    <TabsList>
                        <TabsTrigger value="items">Itens</TabsTrigger>
                        <TabsTrigger value="categories">Categorias</TabsTrigger>
                        <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
                    </TabsList>
                </div>

                <TabsContent value="items">
                    <div className="flex justify-end mb-4">
                        <Button
                            className="bg-green-600 hover:bg-green-700 cursor-pointer"
                            onClick={() => {
                                if (categorias.length != 0) {
                                    setDialogPrato(true);
                                } else {
                                    showMessage(
                                        'Você precisa adicionar uma categoria primeiro para adicionar um produto',
                                        'error'
                                    );
                                }
                            }}
                        >
                            <PlusCircle className="h-4 w-4" />
                            Novo produto
                        </Button>
                    </div>
                    <div className="border rounded-md overflow-scroll">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="text-left p-3">Imagem</th>
                                    <th className="text-left p-3">Nome</th>
                                    <th className="text-left p-3">Categoria</th>
                                    <th className="text-left p-3">Preço</th>
                                    <th className="text-left p-3">Status</th>
                                    <th className="text-left p-3">Estoque</th>
                                    <th className="text-right p-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pratos.map((item) => (
                                    <tr key={item.id} className="border-t">
                                        <td className="p-3">
                                            <img
                                                src={item.imageURL}
                                                alt={item.title}
                                                width={500}
                                                height={500}
                                                className="w-40 h-30"
                                            />
                                        </td>

                                        <td className="p-3">{item.title}</td>
                                        <td className="p-3">
                                            {item.category
                                                .map((id) => categorias.find((c) => c.id === id)?.label)
                                                .filter(Boolean)
                                                .join(', ') || '—'}
                                        </td>
                                        <td className="p-3">R${item.price.toFixed(2)}</td>
                                        <td className="p-3">
                                            <span
                                                className={`px-2 py-1 rounded-full ${
                                                    item.status === 'Ativo'
                                                        ? 'bg-green-100 text-green-600'
                                                        : 'bg-red-100 text-red-600'
                                                }`}
                                            >
                                                {item.status}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {typeof item.estoqueAtual === 'number' ? (
                                                <span
                                                    className={`px-2 py-1 rounded-full whitespace-nowrap ${
                                                        typeof item.estoqueMinimo === 'number' &&
                                                        item.estoqueAtual <= item.estoqueMinimo
                                                            ? 'bg-red-100 text-red-600'
                                                            : 'bg-green-100 text-green-600'
                                                    }`}
                                                >
                                                    {item.estoqueAtual}
                                                    {typeof item.estoqueMinimo === 'number'
                                                        ? ` / mín ${item.estoqueMinimo}`
                                                        : ' un.'}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-sm">Sem controle</span>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <div className="inline-flex flex-row items-center justify-end w-full gap-3">
                                                <Edit
                                                    size={25}
                                                    className="cursor-pointer"
                                                    onClick={() => StartEditPrato(item)}
                                                />
                                                <Trash
                                                    size={25}
                                                    className="text-red-500 cursor-pointer"
                                                    onClick={() => removeProduto(item.id)}
                                                />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                <TabsContent value="categories">
                    <div className="flex justify-end mb-4">
                        <Button
                            className="bg-green-600 hover:bg-green-700 cursor-pointer"
                            onClick={() => setDialogCategoria(true)}
                        >
                            <PlusCircle className="h-4 w-4" />
                            Nova Categoria
                        </Button>
                    </div>

                    <div className="border rounded-md">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="text-left p-3">Icone</th>
                                    <th className="text-left p-3">Nome</th>
                                    <th className="text-left p-3">Itens</th>
                                    <th className="text-right p-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {categorias.map((category) => (
                                    <tr key={category.id} className="border-t">
                                        <td className="p-3">
                                            <img src={category.icon} alt={category.label} className="h-6 w-6" />
                                        </td>
                                        <td className="p-3">{category.label}</td>
                                        <td className="p-3">{category.qtdItems} Itens</td>
                                        <td className="p-3 inline-flex flex-row items-end justify-end w-full gap-3">
                                            <Edit
                                                size={25}
                                                className="cursor-pointer"
                                                onClick={() => StartEditCategoria(category)}
                                            />
                                            <Trash
                                                size={25}
                                                className="text-red-500 cursor-pointer"
                                                onClick={() => removeCategoria(category.id)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>

                <TabsContent value="adicionais">
                    <div className="flex justify-end mb-4">
                        <Button
                            className="bg-green-600 hover:bg-green-700 cursor-pointer"
                            onClick={() => {
                                setTempAdicional({ descricao: '', valor: '' });
                                setDialogAdicional(true);
                            }}
                        >
                            <PlusCircle className="h-4 w-4" />
                            Novo adicional
                        </Button>
                    </div>
                    <div className="border rounded-md">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="text-left p-3">Descrição</th>
                                    <th className="text-left p-3">Valor</th>
                                    <th className="text-right p-3">Ações</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(adicionais || []).length === 0 ? (
                                    <tr>
                                        <td colSpan={3} className="p-3 text-gray-400">
                                            Nenhum adicional cadastrado.
                                        </td>
                                    </tr>
                                ) : (
                                    (adicionais || []).map((item) => (
                                        <tr key={item.id} className="border-t">
                                            <td className="p-3">{item.descricao}</td>
                                            <td className="p-3">R${Number(item.valor).toFixed(2)}</td>
                                            <td className="p-3 inline-flex flex-row items-end justify-end w-full gap-3">
                                                <Edit
                                                    size={25}
                                                    className="cursor-pointer"
                                                    onClick={() => StartEditAdicional(item)}
                                                />
                                                <Trash
                                                    size={25}
                                                    className="text-red-500 cursor-pointer"
                                                    onClick={() => removeAdicional(item.id)}
                                                />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={dialogAdicional} onOpenChange={setDialogAdicional}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar adicional</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="space-y-2">
                            <Label>Descrição (ex.: Ovo, Bacon, Batata Palha)</Label>
                            <Input
                                value={tempAdicional.descricao}
                                onChange={(e) => setTempAdicional((prev) => ({ ...prev, descricao: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={tempAdicional.valor}
                                onChange={(e) => setTempAdicional((prev) => ({ ...prev, valor: e.target.value }))}
                            />
                        </div>
                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={addAdicionalNow}
                        >
                            Adicionar agora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={editAdicionalId != null} onOpenChange={(open) => !open && setEditAdicionalId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar adicional</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="space-y-2">
                            <Label>Descrição</Label>
                            <Input
                                value={editAdicional.descricao}
                                onChange={(e) => setEditAdicional((prev) => ({ ...prev, descricao: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Valor (R$)</Label>
                            <Input
                                type="number"
                                min={0}
                                step="0.01"
                                value={editAdicional.valor}
                                onChange={(e) => setEditAdicional((prev) => ({ ...prev, valor: e.target.value }))}
                            />
                        </div>
                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold"
                            onClick={SaveEditAdicional}
                        >
                            Salvar alterações
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogCategoria} onOpenChange={setDialogCategoria}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicione uma categoria</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome da categoria</Label>
                                    <Input
                                        onChange={(e) =>
                                            setTempCategorias((prev) => ({ ...prev, label: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Icone</Label>
                                    <Select
                                        onValueChange={(val) => setTempCategorias((prev) => ({ ...prev, icon: val }))}
                                    >
                                        <SelectTrigger id="currency" className="w-full">
                                            <SelectValue placeholder="Selecione um icone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableIcons.map((icon) => (
                                                <SelectItem key={icon} value={icon}>
                                                    <img src={icon} alt="" />
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={addCategorias}
                        >
                            Adicionar agora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={dialogPrato} onOpenChange={setDialogPrato}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Adicione um produto novo</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome do produto</Label>
                                    <Input
                                        onChange={(e) => setTempPrato((prev) => ({ ...prev, title: e.target.value }))}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Código de barras (opcional)</Label>
                                    <Input
                                        placeholder="Ex.: 7891234567890"
                                        value={tempPrato.codigoBarras ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((prev) => ({ ...prev, codigoBarras: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Código interno (opcional)</Label>
                                    <Input
                                        placeholder="Ex.: 00123"
                                        value={tempPrato.codigoInterno ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((prev) => ({ ...prev, codigoInterno: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Imagem do produto</Label>
                                    <Input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={(e) => handleImageFileChange(e, (f) => setTempPrato((p) => ({ ...p, imageFile: f })))}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Preço do produto</Label>
                                    <Input
                                        type="number"
                                        onChange={(e) =>
                                            setTempPrato((prev) => ({ ...prev, price: Number(e.target.value) }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Desconto(Opcional)</Label>
                                    <Input
                                        type="number"
                                        onChange={(e) =>
                                            setTempPrato((prev) => ({ ...prev, discount: Number(e.target.value) }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Estoque atual</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="ex.: 30 (vazio = sem controle)"
                                        value={tempPrato.estoqueAtual ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((prev) => ({
                                                ...prev,
                                                estoqueAtual: numeroOuUndefined(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Estoque mínimo</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="ex.: 10 (avisa para repor)"
                                        value={tempPrato.estoqueMinimo ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((prev) => ({
                                                ...prev,
                                                estoqueMinimo: numeroOuUndefined(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="col-span-full">
                                    <h4 className="text-sm font-semibold text-gray-700">Dados Fiscais (NFC-e / NF-e)</h4>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>NCM (obrigatório p/ emissão)</Label>
                                    <Input
                                        placeholder="0000.00.00"
                                        inputMode="numeric"
                                        maxLength={9}
                                        value={tempPrato.ncm ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((p) => ({ ...p, ncm: e.target.value.replace(/[^\d.]/g, '') }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>CEST (opcional)</Label>
                                    <Input
                                        placeholder="0000000"
                                        inputMode="numeric"
                                        maxLength={7}
                                        value={tempPrato.cest ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((p) => ({ ...p, cest: e.target.value.replace(/\D/g, '') }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Unidade Comercial</Label>
                                    <Select
                                        value={tempPrato.unidadeComercial ?? ''}
                                        onValueChange={(v) =>
                                            setTempPrato((p) => ({
                                                ...p,
                                                unidadeComercial: (v as 'UN' | 'KG' | 'CX' | 'LT') || undefined,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UN">UN</SelectItem>
                                            <SelectItem value="KG">KG</SelectItem>
                                            <SelectItem value="CX">CX</SelectItem>
                                            <SelectItem value="LT">LT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Origem</Label>
                                    <Select
                                        value={tempPrato.origem ?? ''}
                                        onValueChange={(v) => setTempPrato((p) => ({ ...p, origem: v || undefined }))}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">0 - Nacional</SelectItem>
                                            <SelectItem value="1">1 - Importada</SelectItem>
                                            <SelectItem value="2">2 - Estrangeira adq. no mercado interno</SelectItem>
                                            <SelectItem value="3">3 - Nacional, conteúdo importação &gt; 40%</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>CSOSN / CST</Label>
                                    <Select
                                        value={tempPrato.csosn ?? ''}
                                        onValueChange={(v) => setTempPrato((p) => ({ ...p, csosn: v || undefined }))}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="102">102 - Tributada (sem permissão crédito)</SelectItem>
                                            <SelectItem value="300">300 - Imune</SelectItem>
                                            <SelectItem value="500">500 - ICMS cobrado por ST</SelectItem>
                                            <SelectItem value="900">900 - Outros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>CFOP</Label>
                                    <Input
                                        placeholder="5102"
                                        inputMode="numeric"
                                        maxLength={4}
                                        value={tempPrato.cfop ?? ''}
                                        onChange={(e) =>
                                            setTempPrato((p) => ({
                                                ...p,
                                                cfop: Number(e.target.value.replace(/\D/g, '')) || undefined,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Selecione categorias</Label>
                                    <CategoriaCheckList
                                        value={tempPrato.category}
                                        onChange={(v) => setTempPrato((prev) => ({ ...prev, category: v }))}
                                        options={categorias}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Adicionais disponíveis (opcional)</Label>
                                    <AdicionaisCheckList
                                        value={tempPrato.adicionaisDisponiveis}
                                        onChange={(v) => setTempPrato((prev) => ({ ...prev, adicionaisDisponiveis: v }))}
                                        options={adicionais}
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-green-600 hover:bg-green-700 text-white h-12 font-bold"
                            onClick={addPrato}
                        >
                            Adicionar agora
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={editCategoriaId != null} onOpenChange={(open) => !open && setEditCategoriaId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar categoria</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome da categoria</Label>
                                    <Input
                                        value={editCategoria.label}
                                        onChange={(e) =>
                                            setEditCategoria((prev) => ({ ...prev, label: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Icone</Label>
                                    <Select
                                        value={editCategoria.icon}
                                        onValueChange={(val) =>
                                            setEditCategoria((prev) => ({ ...prev, icon: val }))
                                        }
                                    >
                                        <SelectTrigger id="currency" className="w-full">
                                            <SelectValue placeholder="Selecione um icone" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {availableIcons.map((icon) => (
                                                <SelectItem key={icon} value={icon}>
                                                    <img src={icon} alt="" />
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold"
                            onClick={SaveEditCategoria}
                        >
                            Salvar alterações
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={editPratoId != null} onOpenChange={(open) => !open && setEditPratoId(null)}>
                <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Editar produto</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4 pt-5">
                        <div className="flex justify-start items-start flex-col">
                            <div className="gap-4 grid w-full">
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Nome do produto</Label>
                                    <Input
                                        value={editPrato.title}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({ ...prev, title: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Código de barras (opcional)</Label>
                                    <Input
                                        placeholder="Ex.: 7891234567890"
                                        value={editPrato.codigoBarras ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({ ...prev, codigoBarras: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Código interno (opcional)</Label>
                                    <Input
                                        placeholder="Ex.: 00123"
                                        value={editPrato.codigoInterno ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({ ...prev, codigoInterno: e.target.value }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Imagem (opcional - substitui a atual)</Label>
                                    <Input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/gif"
                                        onChange={(e) => handleImageFileChange(e, (f) => setEditPrato((p) => ({ ...p, imageFile: f })))}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Preço do produto</Label>
                                    <Input
                                        type="number"
                                        value={editPrato.price}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({ ...prev, price: Number(e.target.value) }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Desconto (Opcional)</Label>
                                    <Input
                                        type="number"
                                        value={editPrato.discount ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({ ...prev, discount: Number(e.target.value) }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Estoque atual</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="vazio = sem controle"
                                        value={editPrato.estoqueAtual ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({
                                                ...prev,
                                                estoqueAtual: numeroOuUndefined(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Estoque mínimo</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        placeholder="avisa para repor"
                                        value={editPrato.estoqueMinimo ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((prev) => ({
                                                ...prev,
                                                estoqueMinimo: numeroOuUndefined(e.target.value),
                                            }))
                                        }
                                    />
                                </div>
                                <div className="col-span-full">
                                    <h4 className="text-sm font-semibold text-gray-700">Dados Fiscais (NFC-e / NF-e)</h4>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>NCM (obrigatório p/ emissão)</Label>
                                    <Input
                                        placeholder="0000.00.00"
                                        inputMode="numeric"
                                        maxLength={9}
                                        value={editPrato.ncm ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((p) => ({ ...p, ncm: e.target.value.replace(/[^\d.]/g, '') }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>CEST (opcional)</Label>
                                    <Input
                                        placeholder="0000000"
                                        inputMode="numeric"
                                        maxLength={7}
                                        value={editPrato.cest ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((p) => ({ ...p, cest: e.target.value.replace(/\D/g, '') }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Unidade Comercial</Label>
                                    <Select
                                        value={editPrato.unidadeComercial ?? ''}
                                        onValueChange={(v) =>
                                            setEditPrato((p) => ({
                                                ...p,
                                                unidadeComercial: (v as 'UN' | 'KG' | 'CX' | 'LT') || undefined,
                                            }))
                                        }
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="UN">UN</SelectItem>
                                            <SelectItem value="KG">KG</SelectItem>
                                            <SelectItem value="CX">CX</SelectItem>
                                            <SelectItem value="LT">LT</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Origem</Label>
                                    <Select
                                        value={editPrato.origem ?? ''}
                                        onValueChange={(v) => setEditPrato((p) => ({ ...p, origem: v || undefined }))}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="0">0 - Nacional</SelectItem>
                                            <SelectItem value="1">1 - Importada</SelectItem>
                                            <SelectItem value="2">2 - Estrangeira adq. no mercado interno</SelectItem>
                                            <SelectItem value="3">3 - Nacional, conteúdo importação &gt; 40%</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>CSOSN / CST</Label>
                                    <Select
                                        value={editPrato.csosn ?? ''}
                                        onValueChange={(v) => setEditPrato((p) => ({ ...p, csosn: v || undefined }))}
                                    >
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="102">102 - Tributada (sem permissão crédito)</SelectItem>
                                            <SelectItem value="300">300 - Imune</SelectItem>
                                            <SelectItem value="500">500 - ICMS cobrado por ST</SelectItem>
                                            <SelectItem value="900">900 - Outros</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>CFOP</Label>
                                    <Input
                                        placeholder="5102"
                                        inputMode="numeric"
                                        maxLength={4}
                                        value={editPrato.cfop ?? ''}
                                        onChange={(e) =>
                                            setEditPrato((p) => ({
                                                ...p,
                                                cfop: Number(e.target.value.replace(/\D/g, '')) || undefined,
                                            }))
                                        }
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Selecione categorias</Label>
                                    <CategoriaCheckList
                                        value={editPrato.category}
                                        onChange={(v) => setEditPrato((prev) => ({ ...prev, category: v }))}
                                        options={categorias}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Adicionais disponíveis (opcional)</Label>
                                    <AdicionaisCheckList
                                        value={editPrato.adicionaisDisponiveis}
                                        onChange={(v) => setEditPrato((prev) => ({ ...prev, adicionaisDisponiveis: v }))}
                                        options={adicionais}
                                    />
                                </div>
                                <div className="space-y-2 col-span-full md:col-span-1">
                                    <Label>Status</Label>
                                    <Select
                                        value={editPrato.status}
                                        onValueChange={(val) =>
                                            setEditPrato((prev) => ({ ...prev, status: val }))
                                        }
                                    >
                                        <SelectTrigger id="currency" className="w-full">
                                            <SelectValue placeholder="Selecione o status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Ativo">Ativo</SelectItem>
                                            <SelectItem value="Inativo">Inativo</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <Button
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 font-bold"
                            onClick={SaveEditPrato}
                        >
                            Salvar alterações
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

/* Lista de checkboxes para selecionar múltiplas categorias por ID (number[]). */
function CategoriaCheckList({
    value,
    onChange,
    options,
}: {
    value: number[];
    onChange: (v: number[]) => void;
    options: CategoriesType[];
}) {
    const toggle = (id: number) => {
        onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    };
    if (options.length === 0) {
        return <p className="text-sm text-gray-500">Nenhuma categoria cadastrada.</p>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {options.map((cat) => (
                <label
                    key={cat.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                        value.includes(cat.id) ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white'
                    }`}
                >
                    <input
                        type="checkbox"
                        checked={value.includes(cat.id)}
                        onChange={() => toggle(cat.id)}
                        className="accent-green-600"
                    />
                    {cat.icon ? <img src={cat.icon} alt="" className="h-4 w-4" /> : null}
                    <span className="text-sm">{cat.label}</span>
                </label>
            ))}
        </div>
    );
}

/* Lista de checkboxes para selecionar adicionais (extras) por ID (number[]). */
function AdicionaisCheckList({
    value,
    onChange,
    options,
}: {
    value: number[];
    onChange: (v: number[]) => void;
    options: { id: number; descricao: string; valor: number }[];
}) {
    const opts = options ?? [];
    const toggle = (id: number) => {
        onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
    };
    if (opts.length === 0) {
        return <p className="text-sm text-gray-500">Nenhum adicional cadastrado.</p>;
    }
    return (
        <div className="flex flex-wrap gap-2">
            {opts.map((add) => (
                <label
                    key={add.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer ${
                        value.includes(add.id) ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white'
                    }`}
                >
                    <input
                        type="checkbox"
                        checked={value.includes(add.id)}
                        onChange={() => toggle(add.id)}
                        className="accent-green-600"
                    />
                    <span className="text-sm">{add.descricao}</span>
                    <span className="text-xs text-gray-500">+ R${Number(add.valor).toFixed(2)}</span>
                </label>
            ))}
        </div>
    );
}
