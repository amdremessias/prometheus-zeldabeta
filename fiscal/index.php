<?php
/**
 * Módulo Fiscal — esqueleto (sem transmissão real à SEFAZ nesta fase).
 *
 * Exposições:
 *   GET  /health   → status de saúde do container fiscal
 *   POST /emitir   → STUB: valida o payload mínimo e devolve uma resposta
 *                    simulada (autorizada FAKE / erro), SEM chamada SOAP.
 *
 * A integração real (NFePHP) entra em fase posterior, quando houver certificado
 * digital e a transmissão for habilitada. Nesta entrega o ZeldaPDV grava a nota
 * como 'pendente' localmente e NÃO depende deste container para o PDV funcionar.
 */

declare(strict_types=1);

const AMBIENTE = getenv('FISCAL_AMBIENTE') !== false ? getenv('FISCAL_AMBIENTE') : '2';

function corsHeaders(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Content-Type: application/json; charset=utf-8');
}

function jsonOut(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readBody(): array
{
    $raw = file_get_contents('php://input');
    $json = json_decode($raw ?: '', true);
    return is_array($json) ? $json : [];
}

corsHeaders();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if ($method === 'OPTIONS') {
    jsonOut(204, []);
}

$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

switch (true) {
    case $path === '/health' && $method === 'GET':
        jsonOut(200, [
            'ok' => true,
            'servico' => 'fiscal-zeldapdv',
            'fase' => 'UI+DataLayer (sem transmissao real)',
            'ambiente' => AMBIENTE,
            'timestamp' => date('c'),
        ]);
        break;

    case $path === '/emitir' && $method === 'POST':
        $body = readBody();
        $venda = $body['venda'] ?? null;
        if (!is_array($venda) || empty($venda['items'])) {
            jsonOut(422, [
                'autorizada' => false,
                'erro' => 'Payload de venda invalido ou sem itens.',
            ]);
        }

        // STUB: não há conexão com a SEFAZ. Devolve uma "autorização" simulada.
        $numero = (int)($venda['numero'] ?? random_int(1, 99999));
        $chave = (string)($venda['chave'] ?? '');
        jsonOut(200, [
            'autorizada' => true,
            'simulada' => true,
            'ambiente' => AMBIENTE,
            'modelo' => $venda['modelo'] ?? '65',
            'numero' => $numero,
            'chaveAcesso' => $chave,
            'protocolo' => 'STUB-' . date('YmdHis'),
            'mensagem' => 'Emissao simulada (sem transmissao real a SEFAZ nesta fase).',
        ]);
        break;

    default:
        jsonOut(404, [
            'ok' => false,
            'erro' => 'Rota nao encontrada. Use GET /health ou POST /emitir.',
        ]);
}
