# ==============================================================================
# LOST SAGA 3D - GIGA SUIT (CYBORG MECHA) 512x512 HD VFX TEXTURE GENERATOR
# ==============================================================================
# Generates 10 crisp 512x512 RGBA PNG textures tailored for Giga Suit Mecha:
#   1. mecha_hud_reticle.png   - Segmented sci-fi hexagonal HUD targeting lock-on
#   2. buster_beam_core.png    - High-energy Giga Buster plasma cannon beam strip
#   3. hex_emp_grid.png        - Seamless hexagonal EMP / plasma energy lattice
#   4. rail_shock_ring.png     - Segmented mechanical thruster shockwave ring
#   5. plasma_arc_bolt.png     - Jagged high-voltage EMP electric plasma lightning
#   6. jet_thruster_plume.png  - Supersonic mecha jetpack flame w/ Mach diamonds
#   7. missile_smoke_puff.png  - Billowing rocket exhaust smoke plume
#   8. mecha_flare.png         - Anamorphic sci-fi optical plasma lens flare
#   9. cyber_hex_tile.png      - Glowing holographic hexagon cell shard
#  10. ion_spark.png           - Sharp elongated electric ion spark streak
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\cyborg\textures"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class CyborgVfxTexGen
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
        unchecked
        {
            uint h = (uint)(x * 374761393 + y * 668265263);
            h = (h ^ (h >> 13)) * 1274126177u;
            return ((h ^ (h >> 16)) & 0xFFFFFF) / (double)0xFFFFFF;
        }
    }

    private static double ValueNoise(double x, double y)
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
            sum += amp * ValueNoise(x * freq, y * freq);
            freq *= 2.03;
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
                double ny = (y + 0.5) / SIZE * 2.0 - 1.0;
                for (int x = 0; x < SIZE; x++)
                {
                    double nx = (x + 0.5) / SIZE * 2.0 - 1.0;
                    double[] c = eval(nx, ny);
                    int idx = (y * SIZE + x) * 4;
                    buf[idx + 0] = (byte)Math.Round(Clamp01(c[2]) * 255.0); // B
                    buf[idx + 1] = (byte)Math.Round(Clamp01(c[1]) * 255.0); // G
                    buf[idx + 2] = (byte)Math.Round(Clamp01(c[0]) * 255.0); // R
                    buf[idx + 3] = (byte)Math.Round(Clamp01(c[3]) * 255.0); // A
                }
            }
            Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            bmp.UnlockBits(data);
            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void DrawOnBitmap(Bitmap bmp, Action<Graphics> draw)
    {
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.CompositingQuality = CompositingQuality.HighQuality;
            draw(g);
        }
    }

    public static void GenerateAll(string outDir)
    {
        // 1. mecha_hud_reticle.png - Segmented Sci-Fi Hexagonal HUD Lock-On & Calibration Seal
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                using (var penGlow = new Pen(Color.FromArgb(135, 56, 189, 248), 18f) { StartCap = LineCap.Flat, EndCap = LineCap.Flat })
                using (var penThick = new Pen(Color.FromArgb(255, 224, 248, 255), 8f) { StartCap = LineCap.Flat, EndCap = LineCap.Flat })
                using (var penMid = new Pen(Color.FromArgb(240, 125, 211, 252), 5f))
                using (var penFine = new Pen(Color.FromArgb(220, 186, 230, 253), 3f))
                {
                    // Outer segmented HUD arcs (4 quadrants with tactical gaps)
                    for (int q = 0; q < 4; q++)
                    {
                        float start = q * 90f + 12f;
                        g.DrawArc(penGlow, 34, 34, SIZE - 68, SIZE - 68, start, 66f);
                        g.DrawArc(penThick, 34, 34, SIZE - 68, SIZE - 68, start, 66f);
                    }

                    // 24 calibrated degree ticks between outer and inner ring
                    for (int i = 0; i < 24; i++)
                    {
                        double a = (i / 24.0) * Math.PI * 2.0;
                        float r0 = (i % 3 == 0) ? 168f : 182f;
                        float r1 = 200f;
                        g.DrawLine(i % 3 == 0 ? penMid : penFine,
                            cx + (float)(Math.Cos(a) * r0), cy + (float)(Math.Sin(a) * r0),
                            cx + (float)(Math.Cos(a) * r1), cy + (float)(Math.Sin(a) * r1));
                    }

                    // Inner Hexagonal Targeting Cage
                    PointF[] hex = new PointF[6];
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        hex[i] = new PointF(cx + (float)(Math.Cos(a) * 144f), cy + (float)(Math.Sin(a) * 144f));
                    }
                    g.DrawPolygon(penGlow, hex);
                    g.DrawPolygon(penThick, hex);

                    // Precision Crosshair Brackets at N/E/S/W
                    for (int i = 0; i < 4; i++)
                    {
                        double a = i * Math.PI * 0.5;
                        float x0 = cx + (float)(Math.Cos(a) * 56f);
                        float y0 = cy + (float)(Math.Sin(a) * 56f);
                        float x1 = cx + (float)(Math.Cos(a) * 234f);
                        float y1 = cy + (float)(Math.Sin(a) * 234f);
                        g.DrawLine(penMid, x0, y0, x1, y1);
                    }

                    // Inner Targeting Circle + Center Dot
                    g.DrawEllipse(penMid, cx - 72, cy - 72, 144, 144);
                    using (var brCore = new SolidBrush(Color.FromArgb(245, 240, 253, 255)))
                        g.FillEllipse(brCore, cx - 12, cy - 12, 24, 24);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "mecha_hud_reticle.png"), ImageFormat.Png);
        }

        // 2. buster_beam_core.png - Horizontal High-Energy Giga Buster Plasma Beam Strip
        SavePixelFunc(System.IO.Path.Combine(outDir, "buster_beam_core.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double ay = Math.Abs(ny);
            double tipFade = SmoothStep(0.0, 0.07, u) * SmoothStep(1.0, 0.90, u);
            double wave = Math.Sin(u * 26.0) * 0.04 + (Fbm(u * 10.0, ny * 5.0 + 3.0, 4) - 0.5) * 0.16;
            double d = Math.Max(0.0, ay + wave * 0.45);

            double core = SmoothStep(0.32, 0.04, d);
            double mid = SmoothStep(0.68, 0.14, d) * 0.85;
            double halo = SmoothStep(0.96, 0.35, ay) * 0.42;
            double bands = 0.78 + 0.22 * Math.Sin((u * 14.0 - ay * 3.0) * Math.PI);

            double a = Clamp01((core + mid * bands + halo) * tipFade);
            double hot = Clamp01(core * 1.15 + mid * 0.25);
            return new[] { Clamp01(0.28 + hot * 0.72), Clamp01(0.84 + hot * 0.16), 1.0, a };
        });

        // 3. hex_emp_grid.png - Seamless Sci-Fi Hexagonal Energy Lattice (wraps cleanly around domes & beams!)
        SavePixelFunc(System.IO.Path.Combine(outDir, "hex_emp_grid.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double v = (ny + 1.0) * 0.5;

            // Tileable hexagonal cell distance (8 cols x 5 rows)
            double cols = 8.0;
            double rows = 6.0;
            double px = u * cols;
            double py = v * rows;

            double minEdge = 10.0;
            // Compare against nearest hexagonal center on two offset grids
            for (int layer = 0; layer < 2; layer++)
            {
                double ox = layer == 0 ? 0.0 : 0.5;
                double oy = layer == 0 ? 0.0 : 0.5;
                double gx = Math.Floor(px - ox) + ox + 0.5;
                double gy = Math.Floor(py - oy) + oy + 0.5;
                double dx = Math.Abs(px - gx);
                double dy = Math.Abs(py - gy);
                // Hexagonal norm
                double hexD = Math.Max(dx * 1.15, dx * 0.575 + dy * 0.98);
                double border = Math.Abs(hexD - 0.48);
                if (border < minEdge) minEdge = border;
            }

            double wire = SmoothStep(0.085, 0.015, minEdge);
            double scan = 0.75 + 0.25 * Math.Sin(v * Math.PI * 12.0);
            double cellFill = 0.18 * scan;
            double vFade = SmoothStep(0.0, 0.10, v) * SmoothStep(1.0, 0.90, v);
            double a = Clamp01((wire * 0.95 + cellFill) * vFade);
            double hot = Clamp01(wire);
            return new[] { Clamp01(0.32 + hot * 0.68), Clamp01(0.86 + hot * 0.14), 1.0, a };
        });

        // 4. rail_shock_ring.png - Segmented Mechanical Thruster / Railgun Shockwave Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "rail_shock_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double seg = SmoothStep(-0.15, 0.15, Math.Cos(ang * 8.0) + 0.55);
            double outer = SmoothStep(0.11, 0.012, Math.Abs(r - 0.78)) * (0.45 + 0.55 * seg);
            double inner = SmoothStep(0.065, 0.008, Math.Abs(r - 0.60));
            double glow = SmoothStep(0.22, 0.0, Math.Abs(r - 0.70)) * 0.45;
            double a = Clamp01((outer + inner + glow) * SmoothStep(0.99, 0.90, r));
            double hot = Clamp01(outer * 0.7 + inner * 0.9);
            return new[] { Clamp01(0.38 + hot * 0.62), Clamp01(0.88 + hot * 0.12), 1.0, a };
        });

        // 5. plasma_arc_bolt.png - Jagged High-Voltage EMP Electric Lightning Bolt (vertical)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                PointF[] mainBolt = new[]
                {
                    new PointF(256, 20), new PointF(220, 92), new PointF(294, 152),
                    new PointF(206, 226), new PointF(308, 294), new PointF(228, 370),
                    new PointF(274, 434), new PointF(256, 492)
                };
                PointF[] branch1 = new[] { new PointF(294, 152), new PointF(362, 188), new PointF(406, 232) };
                PointF[] branch2 = new[] { new PointF(206, 226), new PointF(132, 266), new PointF(96, 318) };
                PointF[] branch3 = new[] { new PointF(308, 294), new PointF(378, 344), new PointF(412, 396) };

                using (var penHalo = new Pen(Color.FromArgb(120, 56, 189, 248), 32f) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penMid = new Pen(Color.FromArgb(235, 125, 211, 252), 16f) { LineJoin = LineJoin.Bevel, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penCore = new Pen(Color.FromArgb(255, 255, 255, 255), 7f) { LineJoin = LineJoin.Miter, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penBranchGlow = new Pen(Color.FromArgb(130, 56, 189, 248), 16f) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penBranchCore = new Pen(Color.FromArgb(245, 236, 254, 255), 5f) { LineJoin = LineJoin.Bevel, StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    g.DrawLines(penHalo, mainBolt);
                    g.DrawLines(penBranchGlow, branch1);
                    g.DrawLines(penBranchGlow, branch2);
                    g.DrawLines(penBranchGlow, branch3);
                    g.DrawLines(penMid, mainBolt);
                    g.DrawLines(penBranchCore, branch1);
                    g.DrawLines(penBranchCore, branch2);
                    g.DrawLines(penBranchCore, branch3);
                    g.DrawLines(penCore, mainBolt);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "plasma_arc_bolt.png"), ImageFormat.Png);
        }

        // 6. jet_thruster_plume.png - Supersonic Mecha Jetpack Afterburner Flame Cone w/ Mach Diamonds
        // Nozzle at TOP (ny = -0.9), plume exhausts DOWNWARD (+Y)
        SavePixelFunc(System.IO.Path.Combine(outDir, "jet_thruster_plume.png"), (nx, ny) =>
        {
            double v = (ny + 1.0) * 0.5; // 0 = nozzle, 1 = tail tip
            if (v < 0.04 || v > 0.98) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double width = (0.36 * Math.Pow(1.0 - v, 0.65) + 0.05) * (0.90 + 0.14 * Math.Sin(v * 24.0));
            double ax = Math.Abs(nx);
            double turb = (Fbm(nx * 5.0 + 2.1, v * 8.0, 3) - 0.5) * 0.08 * v;
            double d = Math.Max(0.0, ax + turb);

            double outer = SmoothStep(width * 1.45, width * 0.25, d) * SmoothStep(0.04, 0.12, v) * SmoothStep(0.98, 0.55, v);
            double core = SmoothStep(width * 0.62, 0.0, d) * SmoothStep(0.04, 0.10, v) * SmoothStep(0.82, 0.18, v);
            // Mach shock diamonds along centerline!
            double mach = Math.Pow(Math.Max(0.0, Math.Cos((v - 0.12) * Math.PI * 6.0)), 6.0) * SmoothStep(width * 0.55, 0.0, ax) * SmoothStep(0.85, 0.12, v);

            double a = Clamp01(outer + core * 0.75 + mach * 0.85);
            double hot = Clamp01(core * 0.9 + mach);
            // White-hot center -> bright amber-gold -> glowing orange outer envelope (re-tintable cleanly!)
            return new[] { 1.0, Clamp01(0.76 + hot * 0.24), Clamp01(0.50 + hot * 0.50), a };
        });

        // 7. missile_smoke_puff.png - Crisp Billowing Rocket Exhaust Smoke Cloud
        SavePixelFunc(System.IO.Path.Combine(outDir, "missile_smoke_puff.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double n1 = Fbm(nx * 3.1 + 4.5, ny * 3.1 + 2.2, 5);
            double n2 = Fbm(nx * 6.4 - 1.9, ny * 6.4 + 5.7, 4);
            double cloud = SmoothStep(0.92, 0.26, r + (n1 - 0.5) * 0.44);
            double a = Clamp01(cloud * (0.68 + 0.48 * n2));
            double shade = Clamp01(0.62 + 0.38 * n1);
            return new[] { shade, shade, Clamp01(shade * 1.04), a };
        });

        // 8. mecha_flare.png - Anamorphic Sci-Fi Optical Plasma Lens Flare
        SavePixelFunc(System.IO.Path.Combine(outDir, "mecha_flare.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double horizStreak = SmoothStep(0.11, 0.0, Math.Abs(ny)) * SmoothStep(0.98, 0.0, Math.Abs(nx));
            double vertStreak = SmoothStep(0.07, 0.0, Math.Abs(nx)) * SmoothStep(0.68, 0.0, Math.Abs(ny)) * 0.75;
            double core = SmoothStep(0.32, 0.015, r);
            double halo = SmoothStep(0.72, 0.04, r) * 0.42;
            double a = Clamp01(core + horizStreak + vertStreak + halo);
            double hot = Clamp01(core + horizStreak * 0.7);
            return new[] { Clamp01(0.45 + hot * 0.55), Clamp01(0.88 + hot * 0.12), 1.0, a };
        });

        // 9. cyber_hex_tile.png - Glowing Holographic Hexagon Data Cell Shard
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;
                PointF[] outer = new PointF[6];
                PointF[] inner = new PointF[6];
                for (int i = 0; i < 6; i++)
                {
                    double a = (i / 6.0) * Math.PI * 2.0 - Math.PI * 0.5;
                    outer[i] = new PointF(cx + (float)(Math.Cos(a) * 212f), cy + (float)(Math.Sin(a) * 212f));
                    inner[i] = new PointF(cx + (float)(Math.Cos(a) * 140f), cy + (float)(Math.Sin(a) * 140f));
                }
                using (var penGlow = new Pen(Color.FromArgb(145, 56, 189, 248), 26f) { LineJoin = LineJoin.Round })
                using (var penRim = new Pen(Color.FromArgb(255, 240, 253, 255), 14f) { LineJoin = LineJoin.Miter })
                using (var brFill = new SolidBrush(Color.FromArgb(180, 125, 211, 252)))
                using (var brCore = new SolidBrush(Color.FromArgb(230, 224, 248, 255)))
                {
                    g.DrawPolygon(penGlow, outer);
                    g.FillPolygon(brFill, outer);
                    g.DrawPolygon(penRim, outer);
                    g.FillPolygon(brCore, inner);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "cyber_hex_tile.png"), ImageFormat.Png);
        }

        // 10. ion_spark.png - Sharp Elongated Electric Ion Spark Streak
        SavePixelFunc(System.IO.Path.Combine(outDir, "ion_spark.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) / 0.24;
            double ay = Math.Abs(ny) / 0.94;
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.85, 0.05, d);
            double halo = SmoothStep(1.35, 0.15, d) * 0.45;
            double a = Clamp01(core + halo);
            double hot = Clamp01(core);
            return new[] { Clamp01(0.55 + hot * 0.45), Clamp01(0.92 + hot * 0.08), 1.0, a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[CyborgVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Giga Suit (Cyborg Mecha) 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-24} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
