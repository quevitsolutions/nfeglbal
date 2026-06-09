# Search for all task starts or runs in transcript
$filePath = 'C:\Users\user\.gemini\antigravity\brain\716fb180-0cf6-4af3-80ea-ae5ce7a1d9ed\.system_generated\logs\transcript.jsonl'
$lines = Get-Content -Path $filePath

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    try {
        $json = ConvertFrom-Json $line -ErrorAction Stop
        if ($json.tool_calls -and ($json.tool_calls.name -contains 'run_command' -or $json.tool_calls.name -contains 'manage_task')) {
            Write-Output "=== Step $($json.step_index) ($($json.source)) ==="
            Write-Output ($json.tool_calls | ConvertTo-Json -Depth 3)
            Write-Output "--------------------------------------------------------"
        }
    } catch {
        # ignore parse errors
    }
}
