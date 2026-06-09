# Search for node ID or wallet addresses in transcript
$filePath = 'C:\Users\user\.gemini\antigravity\brain\716fb180-0cf6-4af3-80ea-ae5ce7a1d9ed\.system_generated\logs\transcript.jsonl'
$lines = Get-Content -Path $filePath

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
        $json = ConvertFrom-Json $line -ErrorAction Stop
        if ($json.content -and $json.content -match "nodeId") {
            Write-Output "=== Step $($json.step_index) ($($json.source)) ==="
            Write-Output $json.content
            Write-Output "--------------------------------------------------------"
        }
    } catch {
        # ignore parse errors
    }
}
