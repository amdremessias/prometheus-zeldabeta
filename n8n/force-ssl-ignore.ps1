param([string]$Path)
$ErrorActionPreference = 'Stop'
$w = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
$count = 0
foreach ($n in $w.nodes) {
  if ($n.type -eq 'n8n-nodes-base.httpRequest') {
    if ($null -eq $n.parameters.options) { $n.parameters | Add-Member -NotePropertyName options -NotePropertyValue ([pscustomobject]@{}) }
    $n.parameters.options.allowUnauthorizedCerts = $true
$count++
  }
}
$backup = "$Path.before-ssl-$(Get-Date -Format yyyyMMddHHmmss).json"
Copy-Item -LiteralPath $Path -Destination $backup -Force
$w | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $Path -Encoding UTF8
Write-Output "patched_http_nodes=$count backup=$backup"
