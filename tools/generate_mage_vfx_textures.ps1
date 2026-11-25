# ============================================================================
# LOST SAGA 3D - FIRE ARCHMAGE EFFEKSEER VFX TEXTURE GENERATOR (512x512 RGBA PNG)
# ============================================================================
# Generates 10 crisp, high-contrast pyromancy VFX textures into:
#   public/assets/vfx/mage/textures/
# Run: powershell -ExecutionPolicy Bypass -File tools/generate_mage_vfx_textures.ps1
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\mage\textures")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class MageVfxTexGen
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

    // Periodic seamless horizontal FBM for 3D cylindrical tornado wrapping
    private static double SeamlessFbm(double u, double y, double period, int octaves)
    {
        double sum = 0.0, amp = 0.5, freq = 1.0;
        for (int i = 0; i < octaves; i++)
        {
            double ang = u * Math.PI * 2.0 * freq;
            double nx = Math.Cos(ang) * (period * 0.5) + 17.3;
            double nz = Math.Sin(ang) * (period * 0.5) + 31.7;
            double n1 = Noise2D(nx, y * freq);
            double n2 = Noise2D(nz, y * freq + 11.4);
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

    public static void GenerateAll(string outDir)
    {
        // 1. pyro_rune_circle.png - Grand Arcane Pyromancy Magic Circle (Sunburst + Hexagram + Runes)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;

                // Soft glowing flame aura disc
                using (var gp = new GraphicsPath())
                {
                    gp.AddEllipse(24, 24, SIZE - 48, SIZE - 48);
                    using (var pgb = new PathGradientBrush(gp))
                    {
                        pgb.CenterColor = Color.FromArgb(85, 255, 220, 170);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 255, 100, 40) };
                        g.FillEllipse(pgb, 24, 24, SIZE - 48, SIZE - 48);
                    }
                }

                // Concentric arcane rings
                using (var penOuter = new Pen(Color.FromArgb(255, 255, 240, 210), 8f))
                using (var penMid = new Pen(Color.FromArgb(245, 255, 220, 165), 5f))
                using (var penThin = new Pen(Color.FromArgb(230, 255, 235, 195), 3f))
                using (var penGlow = new Pen(Color.FromArgb(120, 255, 160, 80), 15f))
                {
                    g.DrawEllipse(penGlow, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penOuter, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penMid, 58, 58, SIZE - 116, SIZE - 116);
                    g.DrawEllipse(penMid, 114, 114, SIZE - 228, SIZE - 228);
                    g.DrawEllipse(penThin, 196, 196, SIZE - 392, SIZE - 392);

                    // 12 Flame-Sunburst Spikes around the outer ring
                    for (int i = 0; i < 12; i++)
                    {
                        double a = (i / 12.0) * Math.PI * 2.0;
                        double aL = a - 0.085, aR = a + 0.085;
                        PointF[] spike = new[]
                        {
                            new PointF(cx + (float)(Math.Cos(aL) * 218), cy + (float)(Math.Sin(aL) * 218)),
                            new PointF(cx + (float)(Math.Cos(a) * 246),  cy + (float)(Math.Sin(a) * 246)),
                            new PointF(cx + (float)(Math.Cos(aR) * 218), cy + (float)(Math.Sin(aR) * 218))
                        };
                        using (var br = new SolidBrush(Color.FromArgb(245, 255, 230, 180)))
                            g.FillPolygon(br, spike);
                    }

                    // 24 Arcane Fire Rune Glyphs between outer and inner rim
                    for (int i = 0; i < 24; i++)
                    {
                        double a = (i / 24.0) * Math.PI * 2.0 + Math.PI / 24.0;
                        float r1 = 198f, r2 = 216f;
                        float x1 = cx + (float)(Math.Cos(a) * r1), y1 = cy + (float)(Math.Sin(a) * r1);
                        float x2 = cx + (float)(Math.Cos(a) * r2), y2 = cy + (float)(Math.Sin(a) * r2);
                        g.DrawLine(penThin, x1, y1, x2, y2);
                        if (i % 2 == 0)
                        {
                            double a2 = a + 0.09;
                            float x3 = cx + (float)(Math.Cos(a2) * 207f), y3 = cy + (float)(Math.Sin(a2) * 207f);
                            g.DrawLine(penThin, x1, y1, x3, y3);
                            g.DrawLine(penThin, x2, y2, x3, y3);
                        }
                    }

                    // Interlocking Twin Arcane Triangles (Alchemical Fire Hexagram)
                    for (int t = 0; t < 2; t++)
                    {
                        PointF[] tri = new PointF[3];
                        double baseA = t * (Math.PI / 3.0) - Math.PI * 0.5;
                        for (int k = 0; k < 3; k++)
                        {
                            double a = baseA + k * (Math.PI * 2.0 / 3.0);
                            tri[k] = new PointF(cx + (float)(Math.Cos(a) * 194f), cy + (float)(Math.Sin(a) * 194f));
                        }
                        g.DrawPolygon(penGlow, tri);
                        g.DrawPolygon(penOuter, tri);
                    }

                    // Inner 8-Point Solar Core Star
                    PointF[] star = new PointF[16];
                    for (int k = 0; k < 16; k++)
                    {
                        double a = (k / 16.0) * Math.PI * 2.0;
                        float rad = (k % 2 == 0) ? 74f : 32f;
                        star[k] = new PointF(cx + (float)(Math.Cos(a) * rad), cy + (float)(Math.Sin(a) * rad));
                    }
                    using (var br = new SolidBrush(Color.FromArgb(245, 255, 245, 225)))
                        g.FillPolygon(br, star);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "pyro_rune_circle.png"), ImageFormat.Png);
        }

        // 2. flame_lick.png - Dynamic Painterly Flame Tongue / Fire Plume (pointing upward -Y)
        SavePixelFunc(System.IO.Path.Combine(outDir, "flame_lick.png"), (nx, ny) =>
        {
            // y goes from +1 (bottom base) to -1 (flickering flame tip)
            double v = (1.0 - ny) * 0.5; // 0 at bottom, 1 at top
            double sway = Math.Sin(v * 5.2 + 0.6) * 0.14 * v + (Fbm(nx * 3.0 + 5.1, ny * 3.2 - 2.3, 4) - 0.5) * 0.28 * (0.3 + v);
            double xShifted = nx - sway;

            // Teardrop width narrows gracefully toward top tip
            double halfWidth = 0.52 * Math.Pow(Clamp01(1.0 - v), 0.72) * Math.Pow(Clamp01(v * 4.5), 0.55);
            double dist = Math.Abs(xShifted) / Math.Max(0.02, halfWidth);
            double turb = Fbm(nx * 5.0 + 1.7, ny * 5.5 + 8.3, 4);

            double body = SmoothStep(1.22, 0.35, dist + (turb - 0.5) * 0.45);
            double bottomMask = SmoothStep(0.0, 0.14, v);
            double topMask = SmoothStep(1.0, 0.72, v);
            double core = SmoothStep(0.75, 0.0, dist) * SmoothStep(0.82, 0.12, v);

            double alpha = Clamp01(body * bottomMask * topMask * 1.15);
            double heat = Clamp01(core * 0.85 + turb * 0.35);
            double r = 1.0;
            double g = Clamp01(0.55 + heat * 0.45);
            double b = Clamp01(0.20 + heat * heat * 0.80);
            return new[] { r, g, b, alpha };
        });

        // 3. flame_vortex.png - Seamless Helical Fire-Dragon Tornado Texture (tiles horizontally for 3D cylinder!)
        SavePixelFunc(System.IO.Path.Combine(outDir, "flame_vortex.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5; // 0..1 periodic
            double v = (ny + 1.0) * 0.5; // 0..1 vertical
            double edgeFade = SmoothStep(0.0, 0.16, v) * SmoothStep(1.0, 0.82, v);

            // Diagonal helical fire ribbons wrapping 3 times around cylinder
            double helix1 = Math.Sin((u * 3.0 + v * 2.1) * Math.PI * 2.0);
            double helix2 = Math.Sin((u * 5.0 + v * 3.4 + 0.4) * Math.PI * 2.0);
            double fbm = SeamlessFbm(u + v * 0.45, v * 5.0, 3.2, 4);

            double bands = Math.Pow(Clamp01(helix1 * 0.5 + 0.5), 1.6) * 0.75 + Math.Pow(Clamp01(helix2 * 0.5 + 0.5), 2.4) * 0.45;
            double intensity = Clamp01((bands * 0.78 + fbm * 0.55 - 0.15) * 1.35) * edgeFade;
            double core = SmoothStep(0.45, 0.95, intensity);

            double r = 1.0;
            double g = Clamp01(0.52 + core * 0.48);
            double b = Clamp01(0.22 + core * core * 0.78);
            return new[] { r, g, b, intensity };
        });

        // 4. fire_shockwave.png - Blazing Jagged Radial Fire Shockwave Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "fire_shockwave.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);

            double spikes = 0.055 * Math.Sin(ang * 14.0) + 0.035 * Math.Cos(ang * 23.0 + 1.2);
            double turb = (Fbm(Math.Cos(ang) * 2.8 + 4.0, Math.Sin(ang) * 2.8 + 7.0, 4) - 0.5) * 0.14;
            double ringCenter = 0.72 + spikes + turb;
            double d = Math.Abs(r - ringCenter);

            double mainRing = SmoothStep(0.21, 0.02, d);
            double innerRim = SmoothStep(0.08, 0.0, Math.Abs(r - 0.58));
            double outerCut = SmoothStep(0.99, 0.86, r);
            double innerCut = SmoothStep(0.32, 0.48, r);

            double a = Clamp01((mainRing + innerRim * 0.65) * outerCut * innerCut);
            double hot = SmoothStep(0.11, 0.0, d);
            return new[] { 1.0, Clamp01(0.62 + hot * 0.38), Clamp01(0.25 + hot * hot * 0.75), a };
        });

        // 5. magma_crater.png - Fractured Volcanic Obsidian Ground Cracks with Glowing Magma Veins
        SavePixelFunc(System.IO.Path.Combine(outDir, "magma_crater.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);

            // 9 jagged radial tectonic lava fissures
            double bestCrack = 0.0;
            for (int i = 0; i < 9; i++)
            {
                double baseA = (i / 9.0) * Math.PI * 2.0 + 0.25;
                double da = Math.Atan2(Math.Sin(ang - baseA), Math.Cos(ang - baseA));
                double jag = (Fbm(r * 7.5 + i * 3.1, i * 5.7, 3) - 0.5) * 0.26;
                double arcDist = Math.Abs(da + jag) * Math.Max(0.12, r);
                double width = 0.036 * (1.0 - r * 0.55);
                double c = SmoothStep(width * 2.4, width * 0.3, arcDist) * SmoothStep(0.96, 0.58, r);
                if (c > bestCrack) bestCrack = c;
            }

            // Concentric crater fracture ring
            double ringNoise = (Fbm(nx * 4.5 + 9.2, ny * 4.5 + 3.4, 3) - 0.5) * 0.11;
            double ringCrack = SmoothStep(0.055, 0.008, Math.Abs(r - (0.50 + ringNoise)));
            double corePool = SmoothStep(0.36, 0.05, r + ringNoise * 0.7);
            double scorch = SmoothStep(0.95, 0.32, r) * 0.72;

            double magma = Clamp01(Math.Max(Math.Max(bestCrack, ringCrack), corePool));
            double alpha = Clamp01(Math.Max(magma, scorch * (0.65 + 0.35 * Fbm(nx * 5.0, ny * 5.0, 3))));

            // Bright white-gold magma veins over dark high-contrast scorched crater body
            double col = Clamp01(0.28 + magma * 0.72);
            return new[] { col, Clamp01(0.18 + magma * 0.82), Clamp01(0.10 + magma * magma * 0.90), alpha };
        });

        // 6. meteor_core.png - Craggy Incandescent Volcanic Meteor Asteroid Sphere
        SavePixelFunc(System.IO.Path.Combine(outDir, "meteor_core.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double crag = (Fbm(Math.Cos(ang) * 2.5 + 2.1, Math.Sin(ang) * 2.5 + 6.4, 4) - 0.5) * 0.14;
            double rad = r + crag;

            double rockBody = SmoothStep(0.76, 0.62, rad);
            double halo = SmoothStep(0.98, 0.50, rad) * 0.75;

            // Incandescent magma fissures crisscrossing the meteor surface
            double veinNoise = Fbm(nx * 4.6 + 3.2, ny * 4.6 + 8.1, 4);
            double cracks = SmoothStep(0.12, 0.0, Math.Abs(veinNoise - 0.50));
            double hotRim = SmoothStep(0.42, 0.74, rad) * rockBody;
            double coreGlow = SmoothStep(0.48, 0.0, r) * 0.55;

            double heat = Clamp01(cracks * 0.95 + hotRim * 0.85 + coreGlow + halo * 0.6);
            double alpha = Clamp01(Math.Max(rockBody, halo));
            double cr = Clamp01(0.45 + heat * 0.55);
            double cg = Clamp01(0.22 + heat * heat * 0.78);
            double cb = Clamp01(0.08 + Math.Pow(heat, 3.0) * 0.92);
            return new[] { cr, cg, cb, alpha };
        });

        // 7. solar_orb.png - Blazing Miniature Sun Sphere with Solar Corona Flares
        SavePixelFunc(System.IO.Path.Combine(outDir, "solar_orb.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double corona = Math.Sin(ang * 8.0 + r * 6.0) * 0.05 + (Fbm(nx * 4.0 + 2.0, ny * 4.0 + 5.0, 4) - 0.5) * 0.14;

            double core = SmoothStep(0.48, 0.10, r);
            double innerRing = SmoothStep(0.11, 0.0, Math.Abs(r - (0.50 + corona * 0.6)));
            double aura = SmoothStep(0.96, 0.25, r + corona);
            double rays = Math.Pow(Clamp01(Math.Cos(ang * 6.0) * 0.5 + 0.5), 3.0) * SmoothStep(0.95, 0.42, r) * 0.45;

            double alpha = Clamp01(core + innerRing * 0.85 + aura * 0.65 + rays);
            double hot = Clamp01(core + innerRing * 0.7);
            return new[] { 1.0, Clamp01(0.65 + hot * 0.35), Clamp01(0.28 + hot * hot * 0.72), alpha };
        });

        // 8. phoenix_wings.png - Stylized Arcane Fire-Phoenix Crest & Wings (for Blink & Hover!)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = SIZE * 0.5f, cy = SIZE * 0.54f;

                // Symmetrical twin stylized phoenix wings (3 sweeping flame pinions each side)
                for (int side = -1; side <= 1; side += 2)
                {
                    using (var gp = new GraphicsPath())
                    {
                        // Upper sweeping main wing pinion
                        gp.AddPolygon(new[]
                        {
                            new PointF(cx + side * 12, cy + 28),
                            new PointF(cx + side * 72, cy - 35),
                            new PointF(cx + side * 165, cy - 118),
                            new PointF(cx + side * 232, cy - 165),
                            new PointF(cx + side * 195, cy - 72),
                            new PointF(cx + side * 238, cy - 82),
                            new PointF(cx + side * 168, cy - 8),
                            new PointF(cx + side * 210, cy + 12),
                            new PointF(cx + side * 122, cy + 48),
                            new PointF(cx + side * 145, cy + 88),
                            new PointF(cx + side * 56,  cy + 78),
                            new PointF(cx + side * 16,  cy + 112)
                        });

                        using (var pGlow = new Pen(Color.FromArgb(145, 255, 175, 90), 18f) { LineJoin = LineJoin.Round })
                        using (var br = new LinearGradientBrush(
                            new PointF(cx, cy),
                            new PointF(cx + side * 235, cy - 150),
                            Color.FromArgb(255, 255, 250, 230),
                            Color.FromArgb(230, 255, 190, 110)))
                        {
                            g.DrawPath(pGlow, gp);
                            g.FillPath(br, gp);
                        }
                    }
                }

                // Center Phoenix Crown Crest & Tail Spire
                PointF[] body = new[]
                {
                    new PointF(cx, cy - 120),
                    new PointF(cx + 26, cy - 20),
                    new PointF(cx + 18, cy + 75),
                    new PointF(cx, cy + 165),
                    new PointF(cx - 18, cy + 75),
                    new PointF(cx - 26, cy - 20)
                };
                using (var brCore = new SolidBrush(Color.FromArgb(255, 255, 255, 240)))
                    g.FillPolygon(brCore, body);
            });
            bmp.Save(System.IO.Path.Combine(outDir, "phoenix_wings.png"), ImageFormat.Png);
        }

        // 9. volcanic_smoke.png - Billowing Dense Volcanic Ash / Dark Smoke Cloud
        SavePixelFunc(System.IO.Path.Combine(outDir, "volcanic_smoke.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double n1 = Fbm(nx * 2.6 + 6.4, ny * 2.6 + 2.9, 5);
            double n2 = Fbm(nx * 5.2 - 3.1, ny * 5.2 + 8.7, 4);
            double cloud = SmoothStep(0.92, 0.24, r + (n1 - 0.5) * 0.42);
            double alpha = Clamp01(cloud * (0.68 + 0.52 * n2));
            double shade = Clamp01(0.62 + 0.38 * n1 - ny * 0.12);
            return new[] { shade, shade * 0.96, shade * 0.92, alpha };
        });

        // 10. fire_ember.png - Sharp Incandescent Diamond-Teardrop Fire Spark Streak
        SavePixelFunc(System.IO.Path.Combine(outDir, "fire_ember.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) * 2.8;
            double ay = Math.Abs(ny);
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.45, 0.0, d);
            double glow = SmoothStep(0.95, 0.05, d) * 0.65;
            double a = Clamp01(core + glow);
            return new[] { 1.0, Clamp01(0.75 + core * 0.25), Clamp01(0.35 + core * 0.65), a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[MageVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Fire Archmage 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-24} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
