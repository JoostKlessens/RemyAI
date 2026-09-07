# Verifieert dat het anon-key-gat dicht is.
#
# VOOR de fix: de anon key bereikte de handler en de pijplijn draaide.
# NA de fix: de poort weigert een beller zonder `sub` voordat er iets kost.
#
# Verwacht: HTTP 200 met body kind=import_throttled, scope=caller.
# Een 200 is hier GOED - een throttle is een verwachte uitkomst, geen
# malformed request, en index.ts reserveert non-2xx voor dat laatste.

$url = $env:EXPO_PUBLIC_SUPABASE_URL
$key = $env:EXPO_PUBLIC_SUPABASE_ANON_KEY

if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($key)) {
  foreach ($candidate in @('.env.local', '.env')) {
    $path = Join-Path 'C:\Users\Joost\dev\remy' $candidate
    if (-not (Test-Path $path)) { continue }
    foreach ($line in Get-Content $path) {
      if ($line -match '^\s*EXPO_PUBLIC_SUPABASE_URL\s*=\s*(.+?)\s*$' -and [string]::IsNullOrWhiteSpace($url)) {
        $url = $Matches[1].Trim('"').Trim("'")
      }
      if ($line -match '^\s*EXPO_PUBLIC_SUPABASE_ANON_KEY\s*=\s*(.+?)\s*$' -and [string]::IsNullOrWhiteSpace($key)) {
        $key = $Matches[1].Trim('"').Trim("'")
      }
    }
  }
}

if ([string]::IsNullOrWhiteSpace($url) -or [string]::IsNullOrWhiteSpace($key)) {
  Write-Output 'GEEN CREDENTIALS gevonden'
  exit 1
}

$body = '{"text":"Pasta met venkel. 200g pasta, 1 venkelknol, olijfolie. Kook de pasta. Snijd de venkel."}'

try {
  $r = Invoke-WebRequest -Method POST -Uri "$url/functions/v1/parse-recipe" `
    -Headers @{ Authorization = "Bearer $key"; 'Content-Type' = 'application/json' } `
    -Body $body -UseBasicParsing
  $code = $r.StatusCode
  $text = $r.Content
} catch {
  if ($null -ne $_.Exception.Response) {
    $code = $_.Exception.Response.StatusCode.value__
    try {
      $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
      $text = $reader.ReadToEnd()
    } catch { $text = '<body onleesbaar>' }
  } else {
    Write-Output "NETWERKFOUT: $($_.Exception.Message)"
    exit 1
  }
}

Write-Output "HTTP $code"
Write-Output "BODY: $text"
Write-Output ''

if ($code -eq 200 -and $text -match 'import_throttled') {
  Write-Output 'GESLAAGD - de poort weigert een beller zonder sub. Het gat is dicht.'
} elseif ($code -eq 200 -and $text -match '"kind"\s*:\s*"parsed"') {
  Write-Output 'MISLUKT - de anon key kreeg een VOLLEDIGE extractie. De poort staat open.'
} elseif ($code -eq 500) {
  Write-Output 'De functie start niet. Meestal: IMPORT_FINGERPRINT_SALT ontbreekt, of import_attempts bestaat nog niet.'
} else {
  Write-Output 'Onverwacht - plak dit hierboven terug.'
}
