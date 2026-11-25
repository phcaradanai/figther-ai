# ==============================================================================
# LOST SAGA 3D - MUAY THAI STRIKER (GOLDEN TIGER & LIGHTNING) 512x512 TEXTURES
# ==============================================================================
# Generates 10 high-contrast Thai martial arts 512x512 RGBA PNG textures:
#   1. thai_lotus_mandala.png      - Sacred Thai Lai-Thai Kranok lotus ring seal
#   2. tiger_fist_impact.png       - Kinetic golden-crimson fist punch shock burst
#   3. muay_kick_arc.png           - Whip-fast Muay Thai roundhouse/elbow arc
#   4. tiger_uppercut_spiral.png   - Seamless rising Golden Tiger Uppercut spiral
#   5. rapid_fist_barrage.png      - Multi-impact Asura 100-Fists kinetic cluster
#   6. gold_lightning_arc.png      - Jagged blazing golden-white speed lightning
#   7. golden_shock_ring.png       - Crisp kinetic martial sonic shockwave ring
#   8. stomp_fissure_ring.png      - Radiating golden-amber seismic stomp cracks
#   9. tiger_flare.png             - Razor 8-ray golden-white martial impact flare
#  10. chi_spark.png               - Sharp elongated golden-crimson chi streak
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\striker\textures"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class StrikerVfxTexGen
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

    private static double SeamlessFbm(double u, double v, double periodU, int octaves)
    {
        double sum = 0.0, amp = 0.5, freq = 1.0;
        for (int i = 0; i < octaves; i++)
        {
            double pu = periodU * freq;
            double x = u * pu;
            double y = v * freq;
            int ix0 = ((int)Math.Floor(x)) % (int)pu; if (ix0 < 0) ix0 += (int)pu;
            int ix1 = (ix0 + 1) % (int)pu;
            int iy = (int)Math.Floor(y);
            double fx = x - Math.Floor(x);
            double fy = y - iy;
            double ux = fx * fx * (3.0 - 2.0 * fx);
            double uy = fy * fy * (3.0 - 2.0 * fy);
            double a = Hash2(ix0, iy);
            double b = Hash2(ix1, iy);
            double c = Hash2(ix0, iy + 1);
            double d = Hash2(ix1, iy + 1);
            sum += amp * (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy);
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
        // 1. thai_lotus_mandala.png - Sacred Thai Lai-Thai Kranok Lotus Martial Ring Seal
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                using (var penGlow = new Pen(Color.FromArgb(145, 250, 204, 21), 18f) { LineJoin = LineJoin.Round })
                using (var penGold = new Pen(Color.FromArgb(255, 254, 249, 195), 7.5f) { LineJoin = LineJoin.Miter })
                using (var penMid = new Pen(Color.FromArgb(245, 253, 224, 71), 5f))
                {
                    g.DrawEllipse(penGlow, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penGold, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penMid, 68, 68, SIZE - 136, SIZE - 136);

                    // 8 Ornate Thai Lotus / Kranok Flame Petals pointing outward!
                    for (int i = 0; i < 8; i++)
                    {
                        double a = (i / 8.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        var st = g.Save();
                        g.TranslateTransform(cx, cy);
                        g.RotateTransform((float)(a * 180.0 / Math.PI));
                        PointF[] petal = new[]
                        {
                            new PointF(72, 0),
                            new PointF(132, -34),
                            new PointF(224, 0),
                            new PointF(132, 34)
                        };
                        g.DrawPolygon(penGlow, petal);
                        g.DrawPolygon(penGold, petal);
                        // Inner Thai diamond finial inside each lotus leaf
                        PointF[] inner = new[]
                        {
                            new PointF(100, 0),
                            new PointF(136, -15),
                            new PointF(184, 0),
                            new PointF(136, 15)
                        };
                        g.DrawPolygon(penMid, inner);
                        g.Restore(st);
                    }

                    // Sacred Yant Twin Interlocking Squares (8-point Thai Star!)
                    for (int k = 0; k < 2; k++)
                    {
                        PointF[] sq = new PointF[4];
                        for (int i = 0; i < 4; i++)
                        {
                            double a = (i / 4.0) * Math.PI * 2.0 + k * Math.PI * 0.25;
                            sq[i] = new PointF(cx + (float)(Math.Cos(a) * 106f), cy + (float)(Math.Sin(a) * 106f));
                        }
                        g.DrawPolygon(penMid, sq);
                    }
                    g.DrawEllipse(penGold, cx - 36, cy - 36, 72, 72);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "thai_lotus_mandala.png"), ImageFormat.Png);
        }

        // 2. tiger_fist_impact.png - Blazing Kinetic Martial Fist Shock-Burst (Bold Knuckle-Blast + Rays!)
        SavePixelFunc(System.IO.Path.Combine(outDir, "tiger_fist_impact.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);

            // Dynamic explosive martial punch shock-rays
            double rays = Math.Pow(Math.Abs(Math.Cos(ang * 5.0 + 0.1)), 8.0) * 0.45
                        + Math.Pow(Math.Abs(Math.Sin(ang * 8.0 - 0.3)), 12.0) * 0.35;
            double shockRing = SmoothStep(0.11, 0.012, Math.Abs(r - (0.66 + 0.08 * Math.Cos(ang * 6.0))));
            double innerCore = SmoothStep(0.38, 0.02, r);
            double burst = SmoothStep(0.48 + rays, 0.12, r) * 0.85;

            double a = Clamp01((burst + shockRing * 0.92 + innerCore) * SmoothStep(0.99, 0.88, r));
            double hot = Clamp01(innerCore + shockRing * 0.5);
            return new[] { 1.0, Clamp01(0.84 + hot * 0.16), Clamp01(0.32 + hot * 0.68), a };
        });

        // 3. muay_kick_arc.png - Whip-Fast Fiery Golden-Crimson Roundhouse Kick / Elbow Gust Arc
        SavePixelFunc(System.IO.Path.Combine(outDir, "muay_kick_arc.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double normA = ang / Math.PI;
            double span = SmoothStep(0.78, 0.42, Math.Abs(normA)) * SmoothStep(-0.78, -0.42, normA);

            double width = 0.04 + 0.19 * SmoothStep(0.74, -0.25, Math.Abs(normA - 0.15));
            double radTarget = 0.72;
            double streak = (Fbm(ang * 6.0 + 3.0, r * 14.0, 3) - 0.5) * 0.05;
            double d = Math.Abs(r - radTarget + streak);

            double body = SmoothStep(width, 0.01, d) * span;
            double outerRim = SmoothStep(0.042, 0.0, Math.Abs(r - (radTarget + width * 0.52))) * span;
            double innerGust = SmoothStep(0.07, 0.0, Math.Abs(r - (radTarget - width * 0.65))) * span * 0.55;

            double a = Clamp01(body * 0.90 + outerRim + innerGust);
            double hot = Clamp01(outerRim + body * 0.48);
            return new[] { 1.0, Clamp01(0.80 + hot * 0.20), Clamp01(0.28 + hot * 0.72), a };
        });

        // 4. tiger_uppercut_spiral.png - Seamless Rising Golden Tiger Uppercut Dragon-Spiral Vortex!
        SavePixelFunc(System.IO.Path.Combine(outDir, "tiger_uppercut_spiral.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double v = (ny + 1.0) * 0.5;
            double vFade = SmoothStep(0.0, 0.14, v) * SmoothStep(1.0, 0.80, v);

            double helix1 = Math.Sin((u * 2.0 + v * 2.2) * Math.PI * 2.0);
            double helix2 = Math.Sin((u * 4.0 + v * 3.6 + 0.25) * Math.PI * 2.0);
            double fbm = SeamlessFbm(u + v * 0.5, v * 5.0, 3.0, 4);

            double ribbons = Math.Pow(Clamp01(helix1 * 0.5 + 0.5), 1.8) * 0.85 + Math.Pow(Clamp01(helix2 * 0.5 + 0.5), 2.5) * 0.45;
            double a = Clamp01((ribbons * 0.82 + fbm * 0.45 - 0.14) * 1.42) * vFade;
            double hot = SmoothStep(0.45, 0.90, a);
            return new[] { 1.0, Clamp01(0.82 + hot * 0.18), Clamp01(0.26 + hot * 0.74), a };
        });

        // 5. rapid_fist_barrage.png - Multi-Impact Asura 100-Fists Overlapping Shock Cluster
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float[][] puffs = new[]
                {
                    new[] { 256f, 256f, 155f },
                    new[] { 168f, 184f, 108f },
                    new[] { 348f, 204f, 114f },
                    new[] { 196f, 342f, 102f },
                    new[] { 336f, 336f, 96f }
                };
                using (var penGlow = new Pen(Color.FromArgb(145, 250, 204, 21), 18f))
                using (var penRim = new Pen(Color.FromArgb(255, 254, 249, 195), 7f))
                {
                    foreach (var p in puffs)
                    {
                        float x = p[0], y = p[1], r = p[2];
                        using (var gp = new GraphicsPath())
                        {
                            gp.AddEllipse(x - r, y - r, r * 2, r * 2);
                            using (var pgb = new PathGradientBrush(gp))
                            {
                                pgb.CenterColor = Color.FromArgb(230, 255, 255, 230);
                                pgb.SurroundColors = new[] { Color.FromArgb(0, 245, 158, 11) };
                                g.FillEllipse(pgb, x - r, y - r, r * 2, r * 2);
                            }
                        }
                        g.DrawEllipse(penGlow, x - r * 0.78f, y - r * 0.78f, r * 1.56f, r * 1.56f);
                        g.DrawEllipse(penRim, x - r * 0.78f, y - r * 0.78f, r * 1.56f, r * 1.56f);
                    }
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "rapid_fist_barrage.png"), ImageFormat.Png);
        }

        // 6. gold_lightning_arc.png - Blazing Golden-White Speed-of-Light Footwork Lightning
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                PointF[] mainBolt = new[]
                {
                    new PointF(256, 18), new PointF(204, 96), new PointF(308, 162),
                    new PointF(192, 236), new PointF(316, 304), new PointF(214, 380),
                    new PointF(278, 442), new PointF(256, 494)
                };
                PointF[] b1 = new[] { new PointF(308, 162), new PointF(378, 200), new PointF(424, 248) };
                PointF[] b2 = new[] { new PointF(192, 236), new PointF(116, 282), new PointF(84, 336) };
                using (var penHalo = new Pen(Color.FromArgb(140, 250, 204, 21), 34f) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penMid = new Pen(Color.FromArgb(245, 254, 240, 138), 16f) { LineJoin = LineJoin.Bevel, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penCore = new Pen(Color.FromArgb(255, 255, 255, 255), 7f) { LineJoin = LineJoin.Miter, StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    g.DrawLines(penHalo, mainBolt);
                    g.DrawLines(penHalo, b1);
                    g.DrawLines(penHalo, b2);
                    g.DrawLines(penMid, mainBolt);
                    g.DrawLines(penMid, b1);
                    g.DrawLines(penMid, b2);
                    g.DrawLines(penCore, mainBolt);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "gold_lightning_arc.png"), ImageFormat.Png);
        }

        // 7. golden_shock_ring.png - Crisp Kinetic Martial Sonic Boom Shockwave Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "golden_shock_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double teeth = 0.04 * Math.Abs(Math.Sin(ang * 12.0));
            double outer = SmoothStep(0.14, 0.012, Math.Abs(r - (0.76 + teeth)));
            double inner = SmoothStep(0.065, 0.008, Math.Abs(r - 0.58)) * 0.78;
            double a = Clamp01((outer + inner) * SmoothStep(0.99, 0.90, r));
            double hot = Clamp01(outer * 0.8 + inner * 0.9);
            return new[] { 1.0, Clamp01(0.84 + hot * 0.16), Clamp01(0.30 + hot * 0.70), a };
        });

        // 8. stomp_fissure_ring.png - Radiating Golden-Amber Seismic Ground Stomp Fractures
        SavePixelFunc(System.IO.Path.Combine(outDir, "stomp_fissure_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);
            double bestCrack = 0.0;
            for (int i = 0; i < 8; i++)
            {
                double baseA = (i / 8.0) * Math.PI * 2.0;
                double da = Math.Atan2(Math.Sin(ang - baseA), Math.Cos(ang - baseA));
                double jag = (Fbm(r * 7.5 + i * 2.9, i * 4.1, 3) - 0.5) * 0.20;
                double arcDist = Math.Abs(da + jag) * Math.Max(0.09, r);
                double c = SmoothStep(0.064, 0.008, arcDist) * SmoothStep(0.95, 0.42, r);
                if (c > bestCrack) bestCrack = c;
            }
            double ring = SmoothStep(0.12, 0.015, Math.Abs(r - 0.68)) * 0.82;
            double a = Clamp01((bestCrack + ring) * SmoothStep(0.99, 0.88, r));
            double hot = Clamp01(bestCrack + ring * 0.6);
            return new[] { 1.0, Clamp01(0.80 + hot * 0.20), Clamp01(0.28 + hot * 0.72), a };
        });

        // 9. tiger_flare.png - Razor 8-Ray Golden-White Martial Impact Starburst Flash
        SavePixelFunc(System.IO.Path.Combine(outDir, "tiger_flare.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double ray4 = Math.Pow(Math.Abs(Math.Cos(ang * 2.0)), 18.0) * SmoothStep(0.98, 0.02, r);
            double rayDiag = Math.Pow(Math.Abs(Math.Sin(ang * 2.0)), 22.0) * SmoothStep(0.80, 0.04, r) * 0.75;
            double core = SmoothStep(0.36, 0.015, r);
            double halo = SmoothStep(0.74, 0.05, r) * 0.42;
            double a = Clamp01(core + ray4 + rayDiag + halo);
            double hot = Clamp01(core + ray4 * 0.7);
            return new[] { 1.0, Clamp01(0.86 + hot * 0.14), Clamp01(0.38 + hot * 0.62), a };
        });

        // 10. chi_spark.png - Sharp Elongated Golden-Crimson Chi Energy Streak
        SavePixelFunc(System.IO.Path.Combine(outDir, "chi_spark.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) / 0.24;
            double ay = Math.Abs(ny) / 0.94;
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.84, 0.04, d);
            double halo = SmoothStep(1.38, 0.15, d) * 0.45;
            double a = Clamp01(core + halo);
            return new[] { 1.0, Clamp01(0.84 + core * 0.16), Clamp01(0.32 + core * 0.68), a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[StrikerVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Muay Thai Striker 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-26} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
