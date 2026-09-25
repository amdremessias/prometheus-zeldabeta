export type UserRole = 'admin' | 'gerente' | 'caixa' | 'garcom' | 'cozinha' | 'entregador';
export type Permission =
  | 'pdv' | 'cardapio' | 'mesas' | 'mesas_fechar' | 'cozinha' | 'delivery_criar'
  | 'entregas' | 'clientes' | 'caixa_abrir_fechar' | 'financeiro' | 'relatorios'
  | 'estoque' | 'config' | 'config_usuarios' | 'integracoes' | 'como_usar'
  | 'fiscal';


export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gerente', label: 'Gerente' },
  { value: 'caixa', label: 'Caixa' },
  { value: 'garcom', label: 'Garçom' },
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'entregador', label: 'Entregador' },
];
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: ['pdv','cardapio','mesas','mesas_fechar','cozinha','delivery_criar','entregas','clientes','caixa_abrir_fechar','financeiro','relatorios','estoque','config','config_usuarios','integracoes','como_usar','fiscal'],
  gerente: ['pdv','cardapio','mesas','mesas_fechar','cozinha','delivery_criar','entregas','clientes','caixa_abrir_fechar','financeiro','relatorios','estoque','config','integracoes','como_usar','fiscal'],
  caixa: ['pdv','cardapio','mesas','clientes','caixa_abrir_fechar','relatorios','delivery_criar','entregas','como_usar'],
  garcom: ['cardapio','mesas','cozinha','como_usar'],
  cozinha: ['cozinha','como_usar'],
  entregador: ['entregas','como_usar'],
};

const TAB_PERMISSION: Record<string, Permission | undefined> = {
  PDV: 'pdv', Clientes: 'clientes', Cardápio: 'cardapio', 'Serviços de Mesa': 'mesas',
  Cozinha: 'cozinha', Entregas: 'entregas', Relatórios: 'relatorios', Contabilidade: 'financeiro',
  Caixa: 'caixa_abrir_fechar', Configurações: 'config', Integrações: 'integracoes',
  Fiscal: 'fiscal',
  'Criar Delivery/Retirada': 'delivery_criar', 'Delivery': 'entregas', Carrinho: 'cardapio', 'Como usar?': 'como_usar',
};

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role as UserRole] || []).includes(permission);
}

export function canAccessTab(role: string | undefined | null, tab: string): boolean {
  const permission = TAB_PERMISSION[tab];
  return permission ? can(role, permission) : true;
}

export function canManageUsers(role: string | undefined | null): boolean { return can(role, 'config_usuarios'); }
export function canFecharMesa(role: string | undefined | null): boolean { return can(role, 'mesas_fechar'); }

