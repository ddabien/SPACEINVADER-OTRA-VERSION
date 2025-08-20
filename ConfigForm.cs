using System;
using System.IO;
using System.Text;
using System.Text.Json;
using System.Windows.Forms;

namespace SpaceInvadersSaverWin7
{
    public class ConfigData { public bool Mute { get; set; } = false; }

    public static class Config
    {
        private static string Dir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "SpaceInvadersSaverWin7");
        private static string FilePath => Path.Combine(Dir, "config.json");

        public static ConfigData Load()
        {
            try
            {
                if (File.Exists(FilePath))
                {
                    var json = File.ReadAllText(FilePath, Encoding.UTF8);
                    var d = JsonSerializer.Deserialize<ConfigData>(json);
                    return d ?? new ConfigData();
                }
            }
            catch { }
            return new ConfigData();
        }

        public static void Save(ConfigData d)
        {
            try
            {
                Directory.CreateDirectory(Dir);
                var json = JsonSerializer.Serialize(d, new JsonSerializerOptions { WriteIndented = true });
                File.WriteAllText(FilePath, json, Encoding.UTF8);
            }
            catch { }
        }
    }

    public class ConfigForm : Form
    {
        private CheckBox chkMute;
        private Button btnSave;

        public ConfigForm()
        {
            this.Text = "Space Invaders – Configuración";
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.StartPosition = FormStartPosition.CenterScreen;
            this.MaximizeBox = false;
            this.MinimizeBox = false;
            this.ClientSize = new System.Drawing.Size(360, 140);

            chkMute = new CheckBox { Left = 20, Top = 20, Width = 300, Text = "Silenciar audio (mute)" };
            btnSave = new Button { Left = 240, Top = 90, Width = 100, Text = "Guardar" };
            btnSave.Click += (s, e) => { Config.Save(new ConfigData { Mute = chkMute.Checked }); this.Close(); };

            this.Controls.Add(chkMute);
            this.Controls.Add(btnSave);

            var cfg = Config.Load();
            chkMute.Checked = cfg.Mute;
        }
    }
}
