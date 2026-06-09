$file = "E:\NFEGLOBAL HUB\src\pages\ReferralScreen.jsx"
$all  = Get-Content $file -Encoding UTF8
$keep = $all[0..195] + $all[383..($all.Length - 1)]
Set-Content -Path $file -Value $keep -Encoding UTF8
Write-Host "Done. Total lines: $($keep.Length)"
