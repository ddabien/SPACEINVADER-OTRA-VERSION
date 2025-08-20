using System;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using CefSharp;
using CefSharp.WinForms;

namespace SpaceInvadersSaverWin7
{
    public class SaverForm : Form
    {
        private ChromiumWebBrowser browser;
        private bool preview;
        private IntPtr previewHandle;
        private Timer sizeTimer;
        private Point lastMouse;

        [DllImport("user32.dll")]
        static extern IntPtr SetParent(IntPtr hWndChild, IntPtr hWndNewParent);
        [DllImport("user32.dll")]
        static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
        [DllImport("user32.dll")]
        static extern int GetWindowLong(IntPtr hWnd, int nIndex);
        [DllImport("user32.dll")]
        static extern bool GetClientRect(IntPtr hWnd, out RECT lpRect);

        const int GWL_STYLE = -16;
        const int WS_CHILD = 0x40000000;
        [StructLayout(LayoutKind.Sequential)]
        public struct RECT { public int Left, Top, Right, Bottom; }

        public SaverForm(IntPtr previewHandle) : this(previewHandle, Rectangle.Empty) { }

        public SaverForm(IntPtr previewHandle, Rectangle bounds)
        {
            this.preview = previewHandle != IntPtr.Zero;
            this.previewHandle = previewHandle;
            this.FormBorderStyle = FormBorderStyle.None;
            this.StartPosition = FormStartPosition.Manual;
            this.TopMost = !this.preview;
            this.ShowInTaskbar = false;
            this.BackColor = Color.Black;

            if (!preview)
            {
                this.Bounds = (bounds == Rectangle.Empty) ? Screen.PrimaryScreen.Bounds : bounds;
                Cursor.Hide();
            }
            else
            {
                SetParent(this.Handle, previewHandle);
                int style = GetWindowLong(this.Handle, GWL_STYLE);
                SetWindowLong(this.Handle, GWL_STYLE, style | WS_CHILD);
                if (GetClientRect(previewHandle, out RECT r))
                {
                    this.Size = new Size(r.Right - r.Left, r.Bottom - r.Top);
                }
                sizeTimer = new Timer { Interval = 500 };
                sizeTimer.Tick += (s, e) =>
                {
                    if (GetClientRect(previewHandle, out RECT rr))
                        this.Size = new Size(rr.Right - rr.Left, rr.Bottom - rr.Top);
                };
                sizeTimer.Start();
            }

            this.KeyDown += (s, e) => CloseSaver();
            this.MouseDown += (s, e) => CloseSaver();
            this.MouseMove += SaverForm_MouseMove;

            InitializeCefAndBrowser();
        }

        private void SaverForm_MouseMove(object sender, MouseEventArgs e)
        {
            if (lastMouse.IsEmpty) lastMouse = e.Location;
            int dx = Math.Abs(e.X - lastMouse.X);
            int dy = Math.Abs(e.Y - lastMouse.Y);
            if (!preview && (dx > 5 || dy > 5))
                CloseSaver();
        }

        private void InitializeCefAndBrowser()
        {
            // One-time global init
            if (!Cef.IsInitialized)
            {
                var settings = new CefSettings
                {
                    CachePath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SpaceInvadersSaverWin7", "cache"),
                    LogSeverity = LogSeverity.Disable,
                };
                settings.CefCommandLineArgs.Add("autoplay-policy", "no-user-gesture-required");
                settings.CefCommandLineArgs.Add("enable-media-stream", "1");
                Cef.Initialize(settings, performDependencyCheck: true, browserProcessHandler: null);
            }

            string contentRoot = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "Content", "game");
            string indexPath = Path.Combine(contentRoot, "index.html").Replace('\\', '/');
            if (!File.Exists(indexPath)) throw new FileNotFoundException("No se encontró index.html en " + indexPath);

            var cfg = Config.Load();
            var settingsJs = $"window.__INVADERS_CFG__={{mute:{(cfg.Mute ? "true" : "false")}}};";

            browser = new ChromiumWebBrowser("about:blank");
            browser.MenuHandler = new NoContextMenuHandler();
            browser.Dock = DockStyle.Fill;
            this.Controls.Add(browser);

            browser.IsBrowserInitializedChanged += (s, e) =>
            {
                if (browser.IsBrowserInitialized)
                {
                    browser.GetBrowser().MainFrame.ExecuteJavaScriptAsync(settingsJs);
                    browser.Load($"file:///{indexPath}");
                }
            };

            if (cfg.Mute)
            {
                browser.FrameLoadEnd += (s, e) =>
                {
                    if (e.Frame.IsMain)
                        browser.ExecuteScriptAsync("try{document.querySelectorAll('audio,video').forEach(el=>el.muted=true);}catch(e){}");
                };
            }
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            try { Cursor.Show(); } catch { }
            base.OnFormClosed(e);
        }

        private void CloseSaver()
        {
            try { sizeTimer?.Stop(); } catch { }
            try { browser?.Dispose(); } catch { }
            this.Close();
        }

        private class NoContextMenuHandler : IContextMenuHandler
        {
            public void OnBeforeContextMenu(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IContextMenuParams parameters, IMenuModel model) => model.Clear();
            public bool OnContextMenuCommand(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, ContextMenuParams parameters, CefMenuCommand commandId, CefEventFlags eventFlags) => false;
            public void OnContextMenuDismissed(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame) { }
            public bool RunContextMenu(IWebBrowser chromiumWebBrowser, IBrowser browser, IFrame frame, IContextMenuParams parameters, IMenuModel model, IRunContextMenuCallback callback) => false;
        }
    }
}
