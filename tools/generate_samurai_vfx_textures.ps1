# ============================================================================
# LOST SAGA 3D - SAMURAI (BLOSSOM BLADER) VFX TEXTURE GENERATOR (512x512)
# ============================================================================
# Generates 10 crisp, Tree of Savior Blossom Blader-inspired sakura & katana
# 512x512 RGBA PNG textures into: public/assets/vfx/samurai/textures/
# Run: powershell -ExecutionPolicy Bypass -File tools/generate_samurai_vfx_textures.ps1
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\samurai\textures")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class SamuraiVfxTexGen
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
            double nx = Math.Cos(ang) * (period * 0.5) + 19.1;
            double nz = Math.Sin(ang) * (period * 0.5) + 41.7;
            double n1 = Noise2D(nx, y * freq);
            double n2 = Noise2D(nz, y * freq + 7.3);
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

    // Helper: draw one notched Japanese cherry blossom petal pointing from (cx,cy) at angle rad
    private static GraphicsPath CreateSakuraPetalPath(float cx, float cy, float len, float halfW, double angleRad)
    {
        var gp = new GraphicsPath();
        Func<float, float, PointF> pt = (lx, ly) =>
        {
            float c = (float)Math.Cos(angleRad);
            float s = (float)Math.Sin(angleRad);
            return new PointF(cx + lx * c - ly * s, cy + lx * s + ly * c);
        };

        PointF pBase = pt(0f, 0f);
        PointF pC1R = pt(len * 0.30f, halfW * 1.10f);
        PointF pC2R = pt(len * 0.78f, halfW * 0.92f);
        PointF pTipR = pt(len * 0.98f, halfW * 0.28f);
        PointF pNotch = pt(len * 0.80f, 0f);
        PointF pTipL = pt(len * 0.98f, -halfW * 0.28f);
        PointF pC2L = pt(len * 0.78f, -halfW * 0.92f);
        PointF pC1L = pt(len * 0.30f, -halfW * 1.10f);

        gp.AddBezier(pBase, pC1R, pC2R, pTipR);
        gp.AddLine(pTipR, pNotch);
        gp.AddLine(pNotch, pTipL);
        gp.AddBezier(pTipL, pC2L, pC1L, pBase);
        gp.CloseFigure();
        return gp;
    }

    public static void GenerateAll(string outDir)
    {
        // 1. katana_crescent.png - Graceful Blazing Blossom Blader Katana Crescent Wave (leading edge +X)
        SavePixelFunc(System.IO.Path.Combine(outDir, "katana_crescent.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx); // 0 at +X
            double absA = Math.Abs(ang);
            if (absA > 2.45) return new[] { 0.0, 0.0, 0.0, 0.0 };

            // Sleek tapered crescent arc peaking in thickness at +X, razor-thin at trailing tips
            double arcEnvelope = Math.Pow(Clamp01(1.0 - absA / 2.38), 0.72);
            double outerR = 0.88;
            double thickness = 0.30 * arcEnvelope;
            double innerR = outerR - thickness;
            double midR = outerR - thickness * 0.26;

            double n = (Fbm(nx * 5.2 + 2.1, ny * 5.2 + 6.7, 3) - 0.5) * 0.08 * arcEnvelope;
            double outerMask = SmoothStep(outerR + 0.035, outerR - 0.02, r);
            double innerMask = SmoothStep(innerR - 0.06 + n, innerR + 0.10 + n, r);
            double bladeSpine = SmoothStep(0.065, 0.0, Math.Abs(r - midR)) * arcEnvelope;
            double trailing = SmoothStep(innerR - 0.14, outerR - 0.05, r) * SmoothStep(outerR + 0.02, midR, r) * 0.55;

            double a = Clamp01((outerMask * innerMask * 0.95 + bladeSpine * 0.8 + trailing * 0.35) * SmoothStep(2.38, 1.85, absA));
            double hot = Clamp01(bladeSpine * 1.15 + SmoothStep(0.14, 0.0, Math.Abs(r - outerR + 0.05)) * 0.55);
            return new[] { 1.0, Clamp01(0.76 + hot * 0.24), Clamp01(0.86 + hot * 0.14), a };
        });

        // 2. sakura_petal.png - Crisp Single Notched Japanese Cherry Blossom Petal
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                using (var gp = CreateSakuraPetalPath(256f, 445f, 385f, 165f, -Math.PI * 0.5))
                {
                    using (var pGlow = new Pen(Color.FromArgb(140, 255, 195, 225), 22f) { LineJoin = LineJoin.Round })
                    using (var br = new LinearGradientBrush(
                        new PointF(256, 445),
                        new PointF(256, 60),
                        Color.FromArgb(255, 255, 165, 208),
                        Color.FromArgb(255, 255, 245, 250)))
                    {
                        g.DrawPath(pGlow, gp);
                        g.FillPath(br, gp);
                    }
                    // Delicate center petal vein
                    using (var penVein = new Pen(Color.FromArgb(150, 255, 255, 255), 6f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                    {
                        g.DrawLine(penVein, 256f, 415f, 256f, 175f);
                    }
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "sakura_petal.png"), ImageFormat.Png);
        }

        // 3. sakura_flower.png - Full 5-Petal Blooming Cherry Blossom with Golden Stamens
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                // Soft glowing aura behind blossom
                using (var gpBg = new GraphicsPath())
                {
                    gpBg.AddEllipse(28, 28, SIZE - 56, SIZE - 56);
                    using (var pgb = new PathGradientBrush(gpBg))
                    {
                        pgb.CenterColor = Color.FromArgb(110, 255, 210, 235);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 244, 114, 182) };
                        g.FillEllipse(pgb, 28, 28, SIZE - 56, SIZE - 56);
                    }
                }

                // 5 Notched Sakura Petals radiating from center
                for (int i = 0; i < 5; i++)
                {
                    double a = (i / 5.0) * Math.PI * 2.0 - Math.PI * 0.5;
                    using (var gp = CreateSakuraPetalPath(cx, cy, 226f, 88f, a))
                    using (var pGlow = new Pen(Color.FromArgb(145, 255, 175, 215), 14f) { LineJoin = LineJoin.Round })
                    using (var br = new LinearGradientBrush(
                        new PointF(cx, cy),
                        new PointF(cx + (float)(Math.Cos(a) * 226), cy + (float)(Math.Sin(a) * 226)),
                        Color.FromArgb(255, 255, 185, 220),
                        Color.FromArgb(255, 255, 246, 250)))
                    {
                        g.DrawPath(pGlow, gp);
                        g.FillPath(br, gp);
                    }
                }

                // 10 Delicate Golden-Rose Stamens at the blossom heart
                using (var penSt = new Pen(Color.FromArgb(245, 255, 230, 155), 4.5f))
                using (var brTip = new SolidBrush(Color.FromArgb(255, 255, 245, 190)))
                {
                    for (int i = 0; i < 10; i++)
                    {
                        double a = (i / 10.0) * Math.PI * 2.0;
                        float r = (i % 2 == 0) ? 72f : 56f;
                        float sx = cx + (float)(Math.Cos(a) * r);
                        float sy = cy + (float)(Math.Sin(a) * r);
                        g.DrawLine(penSt, cx, cy, sx, sy);
                        g.FillEllipse(brTip, sx - 7, sy - 7, 14, 14);
                    }
                }
                using (var brHeart = new SolidBrush(Color.FromArgb(255, 255, 250, 230)))
                    g.FillEllipse(brHeart, cx - 20, cy - 20, 40, 40);
            });
            bmp.Save(System.IO.Path.Combine(outDir, "sakura_flower.png"), ImageFormat.Png);
        }

        // 4. sakura_crest.png - Blossom Blader Circular Floor Mandala (Sakura Crest + Sword Rings)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                using (var gp = new GraphicsPath())
                {
                    gp.AddEllipse(22, 22, SIZE - 44, SIZE - 44);
                    using (var pgb = new PathGradientBrush(gp))
                    {
                        pgb.CenterColor = Color.FromArgb(75, 255, 215, 238);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 244, 114, 182) };
                        g.FillEllipse(pgb, 22, 22, SIZE - 44, SIZE - 44);
                    }
                }

                using (var penGlow = new Pen(Color.FromArgb(125, 255, 150, 205), 16f))
                using (var penOuter = new Pen(Color.FromArgb(255, 255, 240, 248), 8f))
                using (var penMid = new Pen(Color.FromArgb(245, 255, 210, 232), 5f))
                using (var penGold = new Pen(Color.FromArgb(245, 255, 235, 170), 4f))
                {
                    g.DrawEllipse(penGlow, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penOuter, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penMid, 62, 62, SIZE - 124, SIZE - 124);
                    g.DrawEllipse(penGold, 134, 134, SIZE - 268, SIZE - 268);

                    // 10 Outer Diamond Blade Points
                    for (int i = 0; i < 10; i++)
                    {
                        double a = (i / 10.0) * Math.PI * 2.0;
                        float r1 = 212f, r2 = 244f;
                        PointF[] tip = new[]
                        {
                            new PointF(cx + (float)(Math.Cos(a - 0.05) * r1), cy + (float)(Math.Sin(a - 0.05) * r1)),
                            new PointF(cx + (float)(Math.Cos(a) * r2),        cy + (float)(Math.Sin(a) * r2)),
                            new PointF(cx + (float)(Math.Cos(a + 0.05) * r1), cy + (float)(Math.Sin(a + 0.05) * r1)),
                            new PointF(cx + (float)(Math.Cos(a) * 194f),      cy + (float)(Math.Sin(a) * 194f))
                        };
                        using (var br = new SolidBrush(Color.FromArgb(245, 255, 236, 245)))
                            g.FillPolygon(br, tip);
                    }

                    // 5-Petal Graceful Sakura Emblem inside the ring
                    for (int i = 0; i < 5; i++)
                    {
                        double a = (i / 5.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        using (var gpP = CreateSakuraPetalPath(cx, cy, 178f, 62f, a))
                        {
                            g.DrawPath(penGlow, gpP);
                            g.DrawPath(penOuter, gpP);
                        }
                    }

                    // Inner 5-Point Star + Center Seal
                    PointF[] star = new PointF[10];
                    for (int k = 0; k < 10; k++)
                    {
                        double a = (k / 10.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        float r = (k % 2 == 0) ? 74f : 30f;
                        star[k] = new PointF(cx + (float)(Math.Cos(a) * r), cy + (float)(Math.Sin(a) * r));
                    }
                    using (var brS = new SolidBrush(Color.FromArgb(220, 255, 245, 250)))
                        g.FillPolygon(brS, star);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "sakura_crest.png"), ImageFormat.Png);
        }

        // 5. spectral_katana.png - Ethereal Blossom Blader Floating Katana (Control Blade: Hiten Blade!)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f;

                // Soft vertical aura sheath behind blade
                using (var gpGlow = new GraphicsPath())
                {
                    gpGlow.AddEllipse(178, 22, 156, 468);
                    using (var pgb = new PathGradientBrush(gpGlow))
                    {
                        pgb.CenterColor = Color.FromArgb(140, 255, 190, 225);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 244, 114, 182) };
                        g.FillEllipse(pgb, 178, 22, 156, 468);
                    }
                }

                // Gracefully curved Japanese Katana blade (pointing straight UP -Y)
                PointF[] blade = new[]
                {
                    new PointF(cx - 8, 360),
                    new PointF(cx - 12, 230),
                    new PointF(cx - 4, 100),
                    new PointF(cx + 16, 28),   // Razor kissaki tip!
                    new PointF(cx + 22, 88),
                    new PointF(cx + 14, 230),
                    new PointF(cx + 10, 360)
                };
                using (var pBladeGlow = new Pen(Color.FromArgb(180, 255, 165, 210), 18f) { LineJoin = LineJoin.Round })
                using (var brBlade = new LinearGradientBrush(
                    new PointF(cx, 360), new PointF(cx, 28),
                    Color.FromArgb(255, 255, 210, 235),
                    Color.FromArgb(255, 255, 255, 255)))
                {
                    g.DrawPolygon(pBladeGlow, blade);
                    g.FillPolygon(brBlade, blade);
                }

                // Ornate Tsuba (Handguard) & Tsuka (Hilt)
                using (var brTsuba = new SolidBrush(Color.FromArgb(255, 255, 230, 155)))
                using (var brHilt = new SolidBrush(Color.FromArgb(255, 255, 170, 205)))
                {
                    g.FillEllipse(brTsuba, cx - 44, 350, 88, 22);
                    g.FillRectangle(brHilt, cx - 10, 370, 20, 108);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "spectral_katana.png"), ImageFormat.Png);
        }

        // 6. petal_vortex.png - Seamless Helical Sakura Wind Cyclone & Vertical Aura Sheath
        SavePixelFunc(System.IO.Path.Combine(outDir, "petal_vortex.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double v = (ny + 1.0) * 0.5;
            double edgeFade = SmoothStep(0.0, 0.16, v) * SmoothStep(1.0, 0.82, v);

            double helix1 = Math.Sin((u * 3.0 + v * 2.2) * Math.PI * 2.0);
            double helix2 = Math.Sin((u * 6.0 - v * 3.0 + 0.5) * Math.PI * 2.0);
            double fbm = SeamlessFbm(u + v * 0.4, v * 5.0, 3.0, 4);

            double ribbons = Math.Pow(Clamp01(helix1 * 0.5 + 0.5), 1.8) * 0.78 + Math.Pow(Clamp01(helix2 * 0.5 + 0.5), 2.5) * 0.42;
            double a = Clamp01((ribbons * 0.8 + fbm * 0.48 - 0.14) * 1.35) * edgeFade;
            double hot = SmoothStep(0.45, 0.95, a);
            return new[] { 1.0, Clamp01(0.70 + hot * 0.30), Clamp01(0.84 + hot * 0.16), a };
        });

        // 7. blossom_ring.png - Crisp Expanding Blade-Wind & Petal Shockwave Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "blossom_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double wave = 0.035 * Math.Sin(ang * 10.0) + 0.02 * Math.Cos(ang * 15.0);
            double d = Math.Abs(r - (0.76 + wave));
            double outer = SmoothStep(0.16, 0.015, d);
            double inner = SmoothStep(0.075, 0.0, Math.Abs(r - 0.58)) * 0.7;
            double a = Clamp01((outer + inner) * SmoothStep(0.99, 0.88, r));
            double hot = SmoothStep(0.08, 0.0, d);
            return new[] { 1.0, Clamp01(0.75 + hot * 0.25), Clamp01(0.86 + hot * 0.14), a };
        });

        // 8. iaido_flash_beam.png - Razor-Sharp Piercing Blossom Iaido Flash Line (along X)
        SavePixelFunc(System.IO.Path.Combine(outDir, "iaido_flash_beam.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx);
            double ay = Math.Abs(ny);
            double width = 0.22 * Math.Pow(Clamp01(1.0 - ax), 0.55);
            double yDist = ay / Math.Max(0.008, width);
            double body = SmoothStep(1.25, 0.12, yDist) * SmoothStep(0.99, 0.72, ax);
            double spine = SmoothStep(0.38, 0.0, yDist) * SmoothStep(0.98, 0.65, ax);
            double glow = SmoothStep(0.55, 0.0, ay) * SmoothStep(0.96, 0.20, ax) * 0.32;
            double a = Clamp01(body + spine * 0.8 + glow);
            double hot = Clamp01(spine + body * 0.4);
            return new[] { 1.0, Clamp01(0.76 + hot * 0.24), Clamp01(0.86 + hot * 0.14), a };
        });

        // 9. blossom_flare.png - Radiant 4-Point Katana Glint Cross Starburst (Blossom Blader Peak Flash!)
        SavePixelFunc(System.IO.Path.Combine(outDir, "blossom_flare.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double cross = Math.Pow(Math.Abs(Math.Cos(ang * 2.0)), 14.0) * SmoothStep(0.98, 0.04, r);
            double diag = Math.Pow(Math.Abs(Math.Cos((ang - Math.PI * 0.25) * 2.0)), 18.0) * SmoothStep(0.72, 0.05, r) * 0.65;
            double core = SmoothStep(0.36, 0.02, r);
            double halo = SmoothStep(0.72, 0.05, r) * 0.42;
            double a = Clamp01(core + cross + diag + halo);
            double hot = Clamp01(core + cross * 0.8);
            return new[] { 1.0, Clamp01(0.78 + hot * 0.22), Clamp01(0.88 + hot * 0.12), a };
        });

        // 10. sakura_spark.png - Fine Elongated Rose-Gold Katana Spark Mote
        SavePixelFunc(System.IO.Path.Combine(outDir, "sakura_spark.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) * 3.0;
            double ay = Math.Abs(ny);
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.42, 0.0, d);
            double glow = SmoothStep(0.94, 0.04, d) * 0.62;
            double a = Clamp01(core + glow);
            return new[] { 1.0, Clamp01(0.80 + core * 0.20), Clamp01(0.88 + core * 0.12), a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[SamuraiVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Samurai EVO (Blossom Blader) 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-24} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
