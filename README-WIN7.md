# Space Invaders Screensaver (Win7/10/11, x86)

Este repo compila un salvapantallas **x86** compatible con **Windows 7 SP1**, **Windows 10** y **Windows 11** usando **.NET Framework 4.8 + CefSharp 109**.

## Cómo compilar con GitHub Actions
1. Pestaña **Actions** → habilitar workflows (si lo pide).
2. Ejecutar **Run workflow** en *Build x86 Win7/10/11 Screensaver*.
3. Al finalizar, descargar el **artifact** `SpaceInvadersSaverWin7-x86.zip`. Dentro está:
   - `SpaceInvadersSaverWin7.scr`
   - Carpeta `Content\game\` (assets)

## Requisitos en la PC destino (para ejecutar el .scr)
- **.NET Framework 4.8** (Win7 SP1 lo necesita).
- **Microsoft Visual C++ 2015–2019 Redistributable (x86)** (requerido por CefSharp).

## Estructura
- `Content/game/` → tu juego (HTML/JS + sprites).
- `Program.cs`, `SaverForm.cs`, `ConfigForm.cs` → lógica del saver y config (Mute).
- Workflow en `.github/workflows/build-x86.yml`.

## Ejecutar
- Copiar `SpaceInvadersSaverWin7.scr` a `C:\Windows\System32\` (x64) o `C:\Windows\SysWOW64\` (x86).
- Parámetros:
  - `/s` → screensaver
  - `/p <HWND>` → preview
  - `/c` → configuración
