using System;
using System.Linq;
using System.Windows.Forms;
using System.Runtime.InteropServices;

namespace SpaceInvadersSaverWin7
{
    internal static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string arg = (args.Length > 0 ? args[0].ToLower().Trim() : "/s");
            if (arg.StartsWith("-")) arg = "/" + arg.Substring(1);

            switch (arg)
            {
                case "/c":
                case "/c:":
                    Application.Run(new ConfigForm());
                    break;
                case "/p":
                case "/p:":
                    IntPtr parent = IntPtr.Zero;
                    if (args.Length >= 2 && long.TryParse(args[1], out long h))
                        parent = new IntPtr(h);
                    else
                    {
                        var token = args[0].Split(':');
                        if (token.Length == 2 && long.TryParse(token[1], out long h2))
                            parent = new IntPtr(h2);
                    }
                    Application.Run(new SaverForm(parent));
                    break;
                case "/s":
                default:
                    var screens = Screen.AllScreens;
                    if (screens.Length == 1)
                    {
                        Application.Run(new SaverForm(IntPtr.Zero));
                    }
                    else
                    {
                        int open = screens.Length;
                        foreach (var sc in screens)
                        {
                            var f = new SaverForm(IntPtr.Zero, sc.Bounds);
                            f.FormClosed += (s, e) => { if (--open <= 0) Application.Exit(); };
                            f.Show();
                        }
                        Application.Run();
                    }
                    break;
            }
        }
    }
}
