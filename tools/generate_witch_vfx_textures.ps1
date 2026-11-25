# ============================================================================
# LOST SAGA 3D - FROST ICE WITCH (CRYOMANCER) VFX TEXTURE GENERATOR (512x512)
# ============================================================================
# Generates 10 crisp, Tree of Savior Cryomancer-inspired crystalline ice &
# frost 512x512 RGBA PNG textures into: public/assets/vfx/witch/textures/
# Run: powershell -ExecutionPolicy Bypass -File tools/generate_witch_vfx_textures.ps1
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\witch\textures")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class WitchVfxTexGen
{
    private const int SIZE = 512;

    private static double Clamp01(double v) { return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v); }
    private static double SmoothStep(double e0, double e1, double x)
    {
        double t = Clamp01((x - e0) / (e1 - e0));
        return t * t * (3.0 - 2.0 * t);
    }

    private static double Hash2(int x, int y)
    {
        int n = x * 374761393 + y * 668265263;
        n = (n ^ (n >> 13)) * 1274126177;
        return ((n ^ (n >> 16)) & 0x7fffffff) / 2147483647.0;
    }

    private static double Noise2D(double x, double y)
    {
        int ix = (int)Math.Floor(x);
        int iy = (int)Math.Floor(y);
        double fx = x - ix;
        double fy = y - iy;
        double ux = fx * fx * (3.0 - 2.0 * fx);
        double uy = fy * fy * (3.0 - 2.0 * fy);
        double a = Hash2(ix, iy);
        double b = Hash2(ix + 1, iy);
        double c = Hash2(ix, iy + 1);
        double d = Hash2(ix + 1, iy + 1);
        return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
    }

    private static double Fbm(double x, double y, int octaves)
    {
        double sum = 0.0, amp = 0.5, freq = 1.0;
        for (int i = 0; i < octaves; i++)
        {
            sum += amp * Noise2D(x * freq, y * freq);
            freq *= 2.03;
            amp *= 0.5;
        }
        return sum;
    }

    private static double SeamlessFbm(double u, double y, double period, int octaves)
    {
        double sum = 0.0, amp = 0.5, freq = 1.0;
        for (int i = 0; i < octaves; i++)
        {
            double ang = u * Math.PI * 2.0 * freq;
            double nx = Math.Cos(ang) * (period * 0.5) + 13.7;
            double nz = Math.Sin(ang) * (period * 0.5) + 29.3;
            double n1 = Noise2D(nx, y * freq);
            double n2 = Noise2D(nz, y * freq + 9.1);
            sum += amp * (0.5 * (n1 + n2));
            freq *= 2.0;
            amp *= 0.5;
        }
        return sum;
    }

    private static void SavePixelFunc(string path, Func<double, double, double[]> eval)
    {
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            var rect = new Rectangle(0, 0, SIZE, SIZE);
            var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            byte[] buf = new byte[SIZE * SIZE * 4];

            for (int y = 0; y < SIZE; y++)
            {
                double ny = ((y + 0.5) / SIZE) * 2.0 - 1.0;
                for (int x = 0; x < SIZE; x++)
                {
                    double nx = ((x + 0.5) / SIZE) * 2.0 - 1.0;
                    double[] rgba = eval(nx, ny);
                    int idx = (y * SIZE + x) * 4;
                    buf[idx + 0] = (byte)(Clamp01(rgba[2]) * 255.0 + 0.5); // B
                    buf[idx + 1] = (byte)(Clamp01(rgba[1]) * 255.0 + 0.5); // G
                    buf[idx + 2] = (byte)(Clamp01(rgba[0]) * 255.0 + 0.5); // R
                    buf[idx + 3] = (byte)(Clamp01(rgba[3]) * 255.0 + 0.5); // A
                }
            }

            Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            bmp.UnlockBits(data);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawOnBitmap(Bitmap bmp, Action<Graphics> drawAction)
    {
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.HighQuality;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            drawAction(g);
        }
    }

    private static void DrawSnowflakeBranch(Graphics g, Pen penMain, Pen penGlow, float cx, float cy, double angle, float len)
    {
        float cos = (float)Math.Cos(angle), sin = (float)Math.Sin(angle);
        PointF tip = new PointF(cx + cos * len, cy + sin * len);
        if (penGlow != null) g.DrawLine(penGlow, cx, cy, tip.X, tip.Y);
        g.DrawLine(penMain, cx, cy, tip.X, tip.Y);

        float[] fracs = new[] { 0.42f, 0.68f, 0.86f };
        float[] blens = new[] { len * 0.30f, len * 0.24f, len * 0.14f };
        for (int i = 0; i < fracs.Length; i++)
        {
            float bx = cx + cos * (len * fracs[i]);
            float by = cy + sin * (len * fracs[i]);
            foreach (double off in new[] { -0.68, 0.68 })
            {
                float ex = bx + (float)(Math.Cos(angle + off) * blens[i]);
                float ey = by + (float)(Math.Sin(angle + off) * blens[i]);
                if (penGlow != null) g.DrawLine(penGlow, bx, by, ex, ey);
                g.DrawLine(penMain, bx, by, ex, ey);
            }
        }
    }

    public static void GenerateAll(string outDir)
    {
        // 1. frost_snowflake_seal.png - Cryomancer 6-Point Glacial Snowflake Magic Circle
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                using (var gp = new GraphicsPath())
                {
                    gp.AddEllipse(20, 20, SIZE - 40, SIZE - 40);
                    using (var pgb = new PathGradientBrush(gp))
                    {
                        pgb.CenterColor = Color.FromArgb(85, 224, 248, 255);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 34, 211, 238) };
                        g.FillEllipse(pgb, 20, 20, SIZE - 40, SIZE - 40);
                    }
                }

                using (var penGlow = new Pen(Color.FromArgb(130, 103, 232, 249), 15f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penOuter = new Pen(Color.FromArgb(255, 236, 254, 255), 8f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penMid = new Pen(Color.FromArgb(245, 165, 243, 252), 5f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    g.DrawEllipse(penGlow, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penOuter, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penMid, 64, 64, SIZE - 128, SIZE - 128);

                    // Hexagon Crystal Lattice inside ring
                    PointF[] hex = new PointF[6];
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        hex[i] = new PointF(cx + (float)(Math.Cos(a) * 190f), cy + (float)(Math.Sin(a) * 190f));
                    }
                    g.DrawPolygon(penGlow, hex);
                    g.DrawPolygon(penOuter, hex);

                    // 6 Ornate Snowflake Crystal Spires
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        DrawSnowflakeBranch(g, penOuter, penGlow, cx, cy, a, 224f);
                    }

                    // Inner Hex Star & Diamond Core
                    PointF[] innerHex = new PointF[6];
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0;
                        innerHex[i] = new PointF(cx + (float)(Math.Cos(a) * 78f), cy + (float)(Math.Sin(a) * 78f));
                    }
                    g.DrawPolygon(penMid, innerHex);
                    using (var brCore = new SolidBrush(Color.FromArgb(245, 236, 254, 255)))
                        g.FillEllipse(brCore, cx - 22, cy - 22, 44, 44);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "frost_snowflake_seal.png"), ImageFormat.Png);
        }

        // 2. ice_spike.png - Chiseled Faceted Cryomancer Ice Pike / Ice Wall Crystal Pillar (pointing UP -Y)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f;

                // Soft bright cyan base luminescence (classic ToS Ice Wall / Ice Pike base glow!)
                using (var gpBase = new GraphicsPath())
                {
                    gpBase.AddEllipse(80, 355, 352, 130);
                    using (var pgb = new PathGradientBrush(gpBase))
                    {
                        pgb.CenterColor = Color.FromArgb(180, 224, 252, 255);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 34, 211, 238) };
                        g.FillEllipse(pgb, 80, 355, 352, 130);
                    }
                }

                // Side secondary jagged crystal spikes flanking the main pillar
                PointF[] sideL = new[] { new PointF(cx - 118, 452), new PointF(cx - 148, 240), new PointF(cx - 98, 175), new PointF(cx - 48, 300), new PointF(cx - 56, 452) };
                PointF[] sideR = new[] { new PointF(cx + 56, 452), new PointF(cx + 48, 280), new PointF(cx + 108, 148), new PointF(cx + 150, 232), new PointF(cx + 120, 452) };
                using (var brSide = new LinearGradientBrush(new PointF(cx, 150), new PointF(cx, 455), Color.FromArgb(245, 210, 248, 255), Color.FromArgb(230, 125, 211, 252)))
                using (var penEdge = new Pen(Color.FromArgb(255, 245, 254, 255), 5f) { LineJoin = LineJoin.Bevel })
                {
                    g.FillPolygon(brSide, sideL);
                    g.DrawPolygon(penEdge, sideL);
                    g.FillPolygon(brSide, sideR);
                    g.DrawPolygon(penEdge, sideR);
                }

                // Main Tall Chiseled Faceted Crystal Spire (Left bright facet + Right cool shaded facet!)
                PointF[] mainL = new[] { new PointF(cx, 28), new PointF(cx - 72, 178), new PointF(cx - 92, 456), new PointF(cx, 462) };
                PointF[] mainR = new[] { new PointF(cx, 28), new PointF(cx + 76, 165), new PointF(cx + 94, 456), new PointF(cx, 462) };
                using (var brL = new LinearGradientBrush(new PointF(cx - 90, 28), new PointF(cx, 460), Color.FromArgb(255, 255, 255, 255), Color.FromArgb(245, 165, 243, 252)))
                using (var brR = new LinearGradientBrush(new PointF(cx, 28), new PointF(cx + 94, 460), Color.FromArgb(250, 186, 238, 255), Color.FromArgb(235, 96, 195, 245)))
                using (var penRidge = new Pen(Color.FromArgb(255, 255, 255, 255), 7f) { LineJoin = LineJoin.Miter })
                using (var penGlow = new Pen(Color.FromArgb(140, 103, 232, 249), 18f) { LineJoin = LineJoin.Round })
                {
                    PointF[] outline = new[] { new PointF(cx, 28), new PointF(cx + 76, 165), new PointF(cx + 94, 456), new PointF(cx, 462), new PointF(cx - 92, 456), new PointF(cx - 72, 178) };
                    g.DrawPolygon(penGlow, outline);
                    g.FillPolygon(brL, mainL);
                    g.FillPolygon(brR, mainR);
                    g.DrawPolygon(penRidge, outline);
                    g.DrawLine(penRidge, cx, 28, cx, 462);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "ice_spike.png"), ImageFormat.Png);
        }

        // 3. subzero_shield.png - Cryomancer Chamfered Translucent Ice Barrier Plate (Subzero Shield!)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                PointF[] slab = new[]
                {
                    new PointF(cx, 32),
                    new PointF(cx + 126, 98),
                    new PointF(cx + 144, 404),
                    new PointF(cx, 478),
                    new PointF(cx - 144, 404),
                    new PointF(cx - 126, 98)
                };

                using (var penGlow = new Pen(Color.FromArgb(145, 103, 232, 249), 20f) { LineJoin = LineJoin.Round })
                using (var penRim = new Pen(Color.FromArgb(255, 242, 254, 255), 9f) { LineJoin = LineJoin.Bevel })
                using (var penVein = new Pen(Color.FromArgb(215, 224, 250, 255), 4.5f))
                using (var br = new LinearGradientBrush(new PointF(cx - 144, 32), new PointF(cx + 144, 478),
                    Color.FromArgb(225, 236, 254, 255), Color.FromArgb(190, 125, 211, 252)))
                {
                    g.DrawPolygon(penGlow, slab);
                    g.FillPolygon(br, slab);
                    g.DrawPolygon(penRim, slab);

                    // Faceted internal bevel lines & crystal veins
                    g.DrawLine(penVein, cx, 32, cx, 478);
                    g.DrawLine(penVein, cx - 126, 98, cx, 185);
                    g.DrawLine(penVein, cx + 126, 98, cx, 185);
                    g.DrawLine(penVein, cx - 144, 404, cx, 330);
                    g.DrawLine(penVein, cx + 144, 404, cx, 330);

                    // Center etched miniature snowflake crest on the shield plate!
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        DrawSnowflakeBranch(g, penVein, null, cx, cy, a, 76f);
                    }
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "subzero_shield.png"), ImageFormat.Png);
        }

        // 4. glacial_floor.png - Jagged Frozen Glacier Ice Crust & Tectonic Frost Cracks
        SavePixelFunc(System.IO.Path.Combine(outDir, "glacial_floor.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);

            double bestCrack = 0.0;
            for (int i = 0; i < 6; i++)
            {
                double baseA = (i / 6.0) * Math.PI * 2.0 + 0.15;
                double da = Math.Atan2(Math.Sin(ang - baseA), Math.Cos(ang - baseA));
                double jag = (Fbm(r * 7.0 + i * 2.7, i * 4.3, 3) - 0.5) * 0.22;
                double arcDist = Math.Abs(da + jag) * Math.Max(0.10, r);
                double c = SmoothStep(0.068, 0.008, arcDist) * SmoothStep(0.95, 0.52, r);
                if (c > bestCrack) bestCrack = c;
            }

            double iceNoise = Fbm(nx * 5.2 + 3.1, ny * 5.2 + 7.4, 4);
            double edgeJagged = 0.84 + 0.10 * Math.Sin(ang * 6.0) + (iceNoise - 0.5) * 0.18;
            double frostPlate = SmoothStep(edgeJagged + 0.06, edgeJagged - 0.14, r) * (0.58 + 0.42 * iceNoise);
            double a = Clamp01(Math.Max(bestCrack, frostPlate));
            double hot = Clamp01(bestCrack * 0.85 + (1.0 - r) * 0.22);
            return new[] { Clamp01(0.46 + hot * 0.54), Clamp01(0.86 + hot * 0.14), 1.0, a };
        });

        // 5. blizzard_vortex.png - Seamless Helical Blizzard Snow-Wind Funnel Texture
        SavePixelFunc(System.IO.Path.Combine(outDir, "blizzard_vortex.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double v = (ny + 1.0) * 0.5;
            double edgeFade = SmoothStep(0.0, 0.16, v) * SmoothStep(1.0, 0.82, v);

            double shear1 = Math.Sin((u * 3.0 + v * 1.8) * Math.PI * 2.0);
            double shear2 = Math.Sin((u * 6.0 + v * 3.2 + 0.35) * Math.PI * 2.0);
            double fbm = SeamlessFbm(u * 1.0 + v * 0.65, v * 6.5, 3.0, 4);

            double streaks = Math.Pow(Clamp01(shear1 * 0.5 + 0.5), 1.55) * 0.72 + Math.Pow(Clamp01(shear2 * 0.5 + 0.5), 2.2) * 0.42;
            double a = Clamp01((streaks * 0.78 + fbm * 0.50 - 0.16) * 1.38) * edgeFade;
            double hot = SmoothStep(0.42, 0.90, a);
            return new[] { Clamp01(0.58 + hot * 0.42), Clamp01(0.90 + hot * 0.10), 1.0, a };
        });

        // 6. frost_ring.png - Jagged Crystalline Ice Blast Shatter Shockwave Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "frost_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double teeth = 0.065 * Math.Abs(Math.Sin(ang * 9.0)) + 0.025 * Math.Cos(ang * 18.0);
            double d = Math.Abs(r - (0.72 + teeth));
            double main = SmoothStep(0.16, 0.015, d);
            double inner = SmoothStep(0.07, 0.0, Math.Abs(r - 0.56)) * 0.7;
            double a = Clamp01((main + inner) * SmoothStep(0.99, 0.87, r));
            double hot = SmoothStep(0.08, 0.0, d);
            return new[] { Clamp01(0.70 + hot * 0.30), Clamp01(0.94 + hot * 0.06), 1.0, a };
        });

        // 7. snowflake_mote.png - Crisp Ornate 6-Arm Crystalline Snowflake Particle
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;
                using (var penGlow = new Pen(Color.FromArgb(145, 103, 232, 249), 26f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penMain = new Pen(Color.FromArgb(255, 245, 254, 255), 14f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        DrawSnowflakeBranch(g, penMain, penGlow, cx, cy, a, 215f);
                    }
                    using (var br = new SolidBrush(Color.FromArgb(255, 255, 255, 255)))
                        g.FillEllipse(br, cx - 28, cy - 28, 56, 56);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "snowflake_mote.png"), ImageFormat.Png);
        }

        // 8. ice_shard.png - Sharp Faceted Diamond Ice Fragment (Cryomancer Shatter Debris!)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                PointF[] leftHalf = new[] { new PointF(256, 26), new PointF(146, 210), new PointF(256, 486) };
                PointF[] rightHalf = new[] { new PointF(256, 26), new PointF(366, 210), new PointF(256, 486) };
                PointF[] full = new[] { new PointF(256, 26), new PointF(366, 210), new PointF(256, 486), new PointF(146, 210) };
                using (var penGlow = new Pen(Color.FromArgb(140, 103, 232, 249), 20f) { LineJoin = LineJoin.Round })
                using (var penEdge = new Pen(Color.FromArgb(255, 255, 255, 255), 8f) { LineJoin = LineJoin.Miter })
                using (var brL = new SolidBrush(Color.FromArgb(255, 240, 253, 255)))
                using (var brR = new SolidBrush(Color.FromArgb(245, 165, 243, 252)))
                {
                    g.DrawPolygon(penGlow, full);
                    g.FillPolygon(brL, leftHalf);
                    g.FillPolygon(brR, rightHalf);
                    g.DrawPolygon(penEdge, full);
                    g.DrawLine(penEdge, 256, 26, 256, 486);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "ice_shard.png"), ImageFormat.Png);
        }

        // 9. frost_mist.png - Soft Subzero Lingering Freezing Fog Cloud
        SavePixelFunc(System.IO.Path.Combine(outDir, "frost_mist.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double n1 = Fbm(nx * 2.6 + 5.2, ny * 2.6 + 1.8, 5);
            double n2 = Fbm(nx * 5.0 - 2.7, ny * 5.0 + 6.3, 4);
            double cloud = SmoothStep(0.92, 0.24, r + (n1 - 0.5) * 0.42);
            double a = Clamp01(cloud * (0.65 + 0.50 * n2));
            double shade = Clamp01(0.74 + 0.26 * n1);
            return new[] { shade * 0.88, shade * 0.97, shade, a };
        });

        // 10. crystal_flare.png - Blinding 6-Ray Diamond-Cyan Crystalline Impact Starburst
        SavePixelFunc(System.IO.Path.Combine(outDir, "crystal_flare.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double ray6 = Math.Pow(Math.Abs(Math.Cos(ang * 3.0)), 14.0) * SmoothStep(0.98, 0.04, r);
            double core = SmoothStep(0.38, 0.02, r);
            double halo = SmoothStep(0.75, 0.05, r) * 0.45;
            double a = Clamp01(core + ray6 + halo);
            double hot = Clamp01(core + ray6 * 0.75);
            return new[] { Clamp01(0.72 + hot * 0.28), Clamp01(0.95 + hot * 0.05), 1.0, a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[WitchVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Frost Ice Witch (Cryomancer) 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-24} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
