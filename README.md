# 🛒 Zelda PDV — Ponto de Venda & Gestão para Alimentação

O **Zelda PDV** é um sistema completo de ponto de venda e gestão comercial desenvolvido para estabelecimentos do segmento de alimentação (bares, restaurantes, lanchonetes e delivery). 

Construído com arquitetura *client-side*, o sistema prioriza alta disponibilidade e performance operando de forma **offline-first** via IndexedDB e suporte a PWA, além de oferecer suporte a múltiplos estabelecimentos (*White Label*) e deploy containerizado.

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
| :--- | :--- |
| **Framework Frontend** | Next.js 16 (App Router) + React 19 |
| **Estilização & UI** | Tailwind CSS + Lucide React (Ícones) |
| **Persistência Local** | IndexedDB (Dexie.js / LocalStorage) |
| **Gerenciamento de Estado** | React Context API / Custom Hooks |
| **Infraestrutura / Container** | Docker + Docker Compose + Nginx |
| **PWA & Offline** | Web App Manifest + Service Workers |

---

## 📁 Estrutura do Projeto

<pre><code>zelda-pdv/
├── src/
│   ├── app/                # Rotas e páginas do Next.js (App Router)
│   │   ├── (auth)/         # Autenticação e seleção de módulo
│   │   ├── pdv/            # Frente de caixa e caixa rápido
│   │   ├── mesas/          # Gestão de mesas e comandas
│   │   ├── estoque/        # Ficha técnica e controle de insumos
│   │   ├── vendas/         # Histórico, sangria e fechamento de caixa
│   │   └── configuracoes/  # White Label, impressoras e parâmetros
│   ├── components/         # Componentes reutilizáveis de UI
│   ├── context/            # Contextos globais (Carrinho, Caixa, Empresa)
│   ├── lib/                # Configurações do IndexedDB e utilitários
│   └── types/              # Definições de tipos TypeScript
├── public/                 # Assets estáticos, manifest PWA e ícones
├── docker-compose.yml      # Orquestração do container do projeto
├── Dockerfile              # Build otimizado em multi-stage para produção
└── nginx.conf              # Proxy e roteamento para produção
</code></pre>

---

## 🚀 Módulos do Sistema

* **Frente de Caixa (PDV):** Emissão rápida de pedidos, busca por código ou categoria, suporte a múltiplos meios de pagamento e desconto.
* **Gestão de Mesas e Comandas:** Acompanhamento de consumo em tempo real, transferência de mesas, divisão de conta e impressão de pedidos na cozinha.
* **Venda em Carteira / Fiado:** Controle de crédito de clientes recorrentes com histórico de pagamentos e limite de crédito.
* **Modo Demo & Testes:** Ambiente isolado pré-carregado com dados fictícios para treinamento de operadores sem afetar o banco principal.
* **Suporte White Label:** Customização completa de marca, logo, cores do tema e dados fiscais do estabelecimento.

---

## 💻 Execução Local

### Pré-requisitos
* Node.js 18+ instalado
* NPM ou PNPM

### Passo a Passo

1. **Clonar o repositório:**
git clone https://github.com/seu-usuario/zelda-pdv.git
cd zelda-pdv


2. **Instalar as dependências:**
npm install


3. **Executar em modo de desenvolvimento:**
npm run dev


4. **Acessar a aplicação:**
Abre o teu navegador e acede a `http://localhost:3000`.

---

## 🐳 Execução via Docker

Para rodar a aplicação em ambiente isolado ou servidor local via Docker:

1. **Subir a aplicação com Docker Compose:**
docker compose up -d --build


2. **Acessar:**
A aplicação estará disponível na porta configurada (padrão: `http://localhost:80`).

---

## 🔒 Persistência de Dados e Backup

Como o Zelda PDV utiliza armazenamento local (IndexedDB) para garantir a operação sem internet:
* Os dados do caixa e catálogo ficam salvos no próprio navegador.
* Recomenda-se realizar o **export dos dados/backup** no painel de configurações antes de limpar o cache do navegador.
