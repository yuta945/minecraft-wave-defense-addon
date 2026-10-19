# ==============================================================================
# Minecraft Bedrock In-Game Automatic Screenshot Tool
# ==============================================================================
param (
    [string]$OutputFile = "docs\screenshots\mc_ingame_latest.png"
)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

$memberDef = @'
[DllImport("user32.dll")]
public static extern bool SetForegroundWindow(IntPtr hWnd);

[DllImport("user32.dll")]
public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);

[DllImport("user32.dll")]
public static extern bool IsIconic(IntPtr hWnd);

[DllImport("user32.dll")]
public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
}
'@

try {
    Add-Type -MemberDefinition $memberDef -Name "Win32Util" -Namespace "McCapture" -ErrorAction SilentlyContinue
} catch {}

$targetDir = Split-Path $OutputFile -Parent
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
}

# Minecraft プロセスの検索
$mcProcess = Get-Process -Name "Minecraft.Windows" -ErrorAction SilentlyContinue
if (-not $mcProcess) {
    $mcProcess = Get-Process | Where-Object { $_.MainWindowTitle -match "Minecraft" } | Select-Object -First 1
}

if ($mcProcess -and $mcProcess.MainWindowHandle -ne [IntPtr]::Zero) {
    $hWnd = $mcProcess.MainWindowHandle
    Write-Host "[Capture] Found Minecraft window (PID: $($mcProcess.Id)). Bringing to foreground..." -ForegroundColor Cyan

    try {
        if ([McCapture.Win32Util]::IsIconic($hWnd)) {
            [McCapture.Win32Util]::ShowWindowAsync($hWnd, 9) | Out-Null
            Start-Sleep -Milliseconds 500
        }

        [McCapture.Win32Util]::SetForegroundWindow($hWnd) | Out-Null
        Start-Sleep -Milliseconds 600

        $rect = New-Object McCapture.Win32Util+RECT
        [McCapture.Win32Util]::GetWindowRect($hWnd, [ref]$rect) | Out-Null

        $width = $rect.Right - $rect.Left
        $height = $rect.Bottom - $rect.Top

        if ($width -gt 50 -and $height -gt 50) {
            $bitmap = New-Object System.Drawing.Bitmap($width, $height)
            $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
            $graphics.CopyFromScreen($rect.Left, $rect.Top, 0, 0, (New-Object System.Drawing.Size($width, $height)))
            $bitmap.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
            $graphics.Dispose()
            $bitmap.Dispose()

            Write-Host "[Capture] Successfully captured Minecraft window to: $OutputFile" -ForegroundColor Green
            exit 0
        }
    } catch {
        Write-Host "[Capture] Window capture failed, falling back to desktop..." -ForegroundColor Yellow
    }
}

# フォールバック: 全画面キャプチャ
Write-Host "[Capture] Minecraft window not found or obscured. Falling back to primary screen capture..." -ForegroundColor Yellow
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
$bitmap.Save($OutputFile, [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()

Write-Host "[Capture] Saved desktop capture to: $OutputFile" -ForegroundColor Yellow
exit 0
