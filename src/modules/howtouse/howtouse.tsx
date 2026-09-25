import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/ui';
import { Armchair, ChartBar, Cog, Microwave, Truck, Utensils } from 'lucide-react';
import { brand } from '@/shared/lib/branding';

export default function HowToUse() {
    return (
        <div className="bg-white py-7 m-1 flex-1 flex flex-col items-center">
            <div className="container px-6 lg:px-12">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold mb-2">Como Usar o {brand.name}</h2>
                    <p className="text-gray-700 max-w-3xl mx-auto">
                        Aprenda a configurar e operar o sistema no dia a dia do seu restaurante.
                    </p>
                </div>

                <Tabs defaultValue="fluxo" className="w-full max-w-5xl mx-auto">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="fluxo">Fluxo de Trabalho</TabsTrigger>
                        <TabsTrigger value="modulos">Visão Geral dos Módulos</TabsTrigger>
                    </TabsList>

                    <TabsContent value="fluxo" className="pt-6">
                        <div className="w-full space-y-8">
                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-center">
                                    1. Primeiros Passos (Configuração)
                                </h3>
                                <ol className="list-decimal list-inside space-y-2 text-gray-700 bg-gray-50 p-4 rounded-lg">
                                    <li>
                                        <strong>Preencha as informações do seu restaurante:</strong> Vá para
                                        <span className="font-semibold text-green-700"> Configurações {'>'} Geral</span>
                                        . Adicione o nome, endereço, telefone e a taxa de serviço do seu
                                        estabelecimento.
                                    </li>
                                    <li>
                                        <strong>Adicione seus produtos:</strong> Navegue até
                                        <span className="font-semibold text-green-700">
                                            {' '}
                                            Configurações {'>'} Cardápio
                                        </span>
                                        . Primeiro, crie as categorias (ex: Bebidas, Lanches, Sobremesas) e depois
                                        cadastre cada um dos seus pratos, associando-os às categorias correspondentes.
                                    </li>
                                    <li>
                                        <strong>Cadastre os funcionários:</strong> Em
                                        <span className="font-semibold text-green-700">
                                            {' '}
                                            Configurações {'>'} Funcionários
                                        </span>
                                        , adicione os membros da sua equipe e suas funções.
                                    </li>
                                </ol>
                            </div>

                            <div>
                                <h3 className="text-xl font-semibold mb-3 text-center">
                                    2. Fluxo do Dia a Dia (Atendimento)
                                </h3>
                                <div className="space-y-4">
                                    <div className="p-4 border rounded-lg">
                                        <h4 className="font-bold mb-2">Pedido no Local (Serviço de Mesa):</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                                            <li>
                                                <strong>Selecione a Mesa:</strong> Na tela
                                                <span className="font-semibold text-green-700"> Serviços de Mesa</span>,
                                                clique em &quot;Ocupar mesa&quot; na mesa desejada e preencha os dados
                                                do cliente.
                                            </li>
                                            <li>
                                                <strong>Adicione Itens:</strong> Vá para a aba
                                                <span className="font-semibold text-green-700"> Cardápio</span>,
                                                certifique-se de que a mesa correta está selecionada e adicione os
                                                produtos ao pedido.
                                            </li>
                                            <li>
                                                <strong>Envie para a Cozinha:</strong> No
                                                <span className="font-semibold text-green-700"> Carrinho</span> da mesa,
                                                confirme os itens e clique em &quot;Enviar pedido para cozinha&quot;.
                                            </li>
                                            <li>
                                                <strong>Acompanhe o Preparo:</strong> A equipe da
                                                <span className="font-semibold text-green-700"> Cozinha</span> verá o
                                                pedido, o preparará e marcará como &quot;Pronto&quot;. O garçom então
                                                realiza a entrega na mesa.
                                            </li>
                                            <li>
                                                <strong>Finalize o Pedido:</strong> Quando o cliente desejar fechar a
                                                conta, volte ao{' '}
                                                <span className="font-semibold text-green-700">Carrinho</span>,
                                                selecione o método de pagamento e clique em &quot;Fechar conta e liberar
                                                mesa&quot;.
                                            </li>
                                        </ol>
                                    </div>
                                    <div className="p-4 border rounded-lg">
                                        <h4 className="font-bold mb-2">Pedido Externo (Delivery ou Retirada):</h4>
                                        <ol className="list-decimal list-inside space-y-2 text-gray-700">
                                            <li>
                                                <strong>Crie o Pedido:</strong> Vá para
                                                <span className="font-semibold text-green-700">
                                                    {' '}
                                                    Criar Delivery/Retirada
                                                </span>
                                                . Clique para ir ao cardápio, adicione os itens e depois preencha os
                                                dados do cliente, forma de pagamento e se é para entrega ou retirada.
                                            </li>
                                            <li>
                                                <strong>Envie para a Cozinha:</strong> Após preencher os dados, o pedido
                                                é enviado para o painel da
                                                <span className="font-semibold text-green-700"> Cozinha</span>.
                                            </li>
                                            <li>
                                                <strong>Acompanhe a Entrega:</strong> Após a cozinha finalizar, o pedido
                                                aparece na tela de{' '}
                                                <span className="font-semibold text-green-700">Entregas</span> como
                                                &quot;Pendente&quot;.
                                            </li>
                                            <li>
                                                <strong>Despache e Finalize:</strong> Se for para entrega, atribua um
                                                entregador para iniciar o transporte. Se for retirada, o cliente busca
                                                no local. Após a conclusão, confirme a entrega para finalizar o pedido.
                                            </li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="modulos" className="pt-6">
                        <ul className="space-y-6 w-full max-w-4xl mx-auto">
                            <li>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Utensils className="text-green-700" /> Cardápio
                                </h3>
                                <p className="text-gray-700">
                                    É aqui que todos os seus produtos disponíveis ficam para serem adicionados aos
                                    pedidos dos clientes. Você pode visualizar os itens do cardápio em um grid, filtrar
                                    por categoria e buscar por produtos específicos. Ao selecionar um item, é possível
                                    adicioná-lo ou removê-lo do carrinho da mesa ou do pedido de delivery selecionado.
                                </p>
                            </li>
                            <li>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Armchair className="text-green-700" /> Serviços de Mesa
                                </h3>
                                <p className="text-gray-700">
                                    Visualize todas as mesas do seu estabelecimento e seus status (livre, ocupada ou
                                    reservada). Você pode ocupar uma mesa, adicionar informações do cliente e do garçom,
                                    editar esses dados a qualquer momento e, claro, ver o carrinho de pedidos daquela
                                    mesa.
                                </p>
                            </li>
                            <li>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Microwave className="text-green-700" /> Cozinha
                                </h3>
                                <p className="text-gray-700">
                                    Um painel para a equipe da cozinha visualizar todos os pedidos pendentes, sejam eles
                                    de mesas, delivery ou para retirada. Cada pedido mostra os itens, o nome do cliente
                                    e a origem (mesa ou delivery). O cozinheiro pode marcar o pedido como
                                    &quot;pronto&quot;, que o sistema automaticamente o encaminha para o próximo passo.
                                </p>
                            </li>
                            <li>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Truck className="text-green-700" /> Entregas
                                </h3>
                                <p className="text-gray-700">
                                    Este módulo permite criar e gerenciar pedidos para delivery ou retirada. Os pedidos
                                    prontos pela cozinha aparecem aqui como &quot;pendentes&quot;, aguardando um
                                    entregador, e você pode acompanhar os que estão &quot;em andamento&quot; até a
                                    finalização da entrega.
                                </p>
                            </li>
                            <li>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <ChartBar className="text-green-700" /> Contabilidade
                                </h3>
                                <p className="text-gray-700">
                                    Acompanhe a saúde financeira do seu negócio. Este módulo oferece um resumo com
                                    Vendas Totais, número de Pedidos, Valor Médio por Pedido e Despesas. Além disso,
                                    você pode visualizar uma lista de todas as transações recentes.
                                </p>
                            </li>
                            <li>
                                <h3 className="text-lg font-semibold mb-1 flex items-center gap-2">
                                    <Cog className="text-green-700" /> Configurações
                                </h3>
                                <p className="text-gray-700">
                                    Personalize o sistema para a realidade do seu restaurante. Aqui você pode gerenciar
                                    informações gerais, cadastrar funcionários e editar o cardápio (produtos e
                                    categorias).
                                </p>
                            </li>
                        </ul>
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}
