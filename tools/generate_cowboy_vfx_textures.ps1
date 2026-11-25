# ============================================================================
# LOST SAGA 3D - DESPERADO COWBOY EFFEKSEER VFX TEXTURE GENERATOR (512x512 PNG)
# ============================================================================
# Generates 10 crisp, high-contrast Wild West Gunslinger VFX textures into:
#   public/assets/vfx/cowboy/textures/
# Run: powershell -ExecutionPolicy Bypass -File tools/generate_cowboy_vfx_textures.ps1
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\cowboy\textures")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class CowboyVfxTexGen
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
        // 1. sheriff_crest.png - High Noon Sundial & 6-Chamber Revolver Sheriff Star Circle
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;

                using (var gp = new GraphicsPath())
                {
                    gp.AddEllipse(24, 24, SIZE - 48, SIZE - 48);
                    using (var pgb = new PathGradientBrush(gp))
                    {
                        pgb.CenterColor = Color.FromArgb(75, 255, 230, 155);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 255, 175, 45) };
                        g.FillEllipse(pgb, 24, 24, SIZE - 48, SIZE - 48);
                    }
                }

                using (var penGlow = new Pen(Color.FromArgb(120, 255, 190, 75), 16f))
                using (var penOuter = new Pen(Color.FromArgb(255, 255, 244, 200), 9f))
                using (var penMid = new Pen(Color.FromArgb(245, 255, 224, 145), 5.5f))
                using (var penThin = new Pen(Color.FromArgb(230, 255, 236, 180), 3.5f))
                {
                    g.DrawEllipse(penGlow, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penOuter, 34, 34, SIZE - 68, SIZE - 68);
                    g.DrawEllipse(penMid, 62, 62, SIZE - 124, SIZE - 124);
                    g.DrawEllipse(penMid, 126, 126, SIZE - 252, SIZE - 252);

                    // 12 High Noon Clock / Sundial Ticks around outer dial
                    for (int i = 0; i < 12; i++)
                    {
                        double a = (i / 12.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        float r1 = (i % 3 == 0) ? 182f : 196f;
                        float r2 = 222f;
                        g.DrawLine(i % 3 == 0 ? penOuter : penMid,
                            cx + (float)(Math.Cos(a) * r1), cy + (float)(Math.Sin(a) * r1),
                            cx + (float)(Math.Cos(a) * r2), cy + (float)(Math.Sin(a) * r2));
                    }

                    // 6 Revolver Cylinder Chambers!
                    for (int i = 0; i < 6; i++)
                    {
                        double a = (i / 6.0) * Math.PI * 2.0;
                        float bx = cx + (float)(Math.Cos(a) * 158f);
                        float by = cy + (float)(Math.Sin(a) * 158f);
                        g.DrawEllipse(penGlow, bx - 22, by - 22, 44, 44);
                        g.DrawEllipse(penOuter, bx - 22, by - 22, 44, 44);
                        using (var brDot = new SolidBrush(Color.FromArgb(240, 255, 245, 200)))
                            g.FillEllipse(brDot, bx - 7, by - 7, 14, 14);
                    }

                    // Center 6-Point Sheriff Star with Studded Tips
                    PointF[] star = new PointF[12];
                    for (int k = 0; k < 12; k++)
                    {
                        double a = (k / 12.0) * Math.PI * 2.0 - Math.PI * 0.5;
                        float rad = (k % 2 == 0) ? 114f : 52f;
                        star[k] = new PointF(cx + (float)(Math.Cos(a) * rad), cy + (float)(Math.Sin(a) * rad));
                    }
                    g.DrawPolygon(penGlow, star);
                    g.DrawPolygon(penOuter, star);
                    using (var brStar = new SolidBrush(Color.FromArgb(145, 255, 242, 195)))
                        g.FillPolygon(brStar, star);
                    for (int k = 0; k < 12; k += 2)
                    {
                        using (var brTip = new SolidBrush(Color.FromArgb(255, 255, 250, 230)))
                            g.FillEllipse(brTip, star[k].X - 9, star[k].Y - 9, 18, 18);
                    }

                    g.DrawEllipse(penThin, cx - 28, cy - 28, 56, 56);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "sheriff_crest.png"), ImageFormat.Png);
        }

        // 2. deadeye_reticle.png - Western Gunslinger Deadeye Crosshair Target Lock
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;

                using (var penGlow = new Pen(Color.FromArgb(130, 255, 190, 65), 16f))
                using (var penMain = new Pen(Color.FromArgb(255, 255, 246, 208), 8f))
                using (var penMid = new Pen(Color.FromArgb(245, 255, 224, 140), 5f))
                {
                    // Outer segmented targeting arcs (4 quadrants)
                    for (int i = 0; i < 4; i++)
                    {
                        float start = i * 90f + 16f;
                        g.DrawArc(penGlow, 44, 44, SIZE - 88, SIZE - 88, start, 58f);
                        g.DrawArc(penMain, 44, 44, SIZE - 88, SIZE - 88, start, 58f);
                    }

                    // Inner crosshair ring
                    g.DrawEllipse(penMid, 128, 128, SIZE - 256, SIZE - 256);

                    // 4 Precision Crosshair Bars (leaving bright bullseye open)
                    g.DrawLine(penGlow, cx, 22, cx, 188);
                    g.DrawLine(penGlow, cx, 324, cx, SIZE - 22);
                    g.DrawLine(penGlow, 22, cy, 188, cy);
                    g.DrawLine(penGlow, 324, cy, SIZE - 22, cy);

                    g.DrawLine(penMain, cx, 22, cx, 188);
                    g.DrawLine(penMain, cx, 324, cx, SIZE - 22);
                    g.DrawLine(penMain, 22, cy, 188, cy);
                    g.DrawLine(penMain, 324, cy, SIZE - 22, cy);

                    // Center diamond bullseye
                    PointF[] diamond = new[]
                    {
                        new PointF(cx, cy - 26),
                        new PointF(cx + 26, cy),
                        new PointF(cx, cy + 26),
                        new PointF(cx - 26, cy)
                    };
                    g.DrawPolygon(penMain, diamond);
                    using (var br = new SolidBrush(Color.FromArgb(255, 255, 255, 235)))
                        g.FillEllipse(br, cx - 10, cy - 10, 20, 20);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "deadeye_reticle.png"), ImageFormat.Png);
        }

        // 3. muzzle_star.png - Sharp 8-Ray Western Revolver Muzzle Flash Starburst
        SavePixelFunc(System.IO.Path.Combine(outDir, "muzzle_star.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);

            double ray4 = Math.Pow(Math.Abs(Math.Cos(ang * 2.0)), 9.0) * SmoothStep(0.98, 0.08, r);
            double rayDiag = Math.Pow(Math.Abs(Math.Cos((ang - Math.PI * 0.25) * 2.0)), 14.0) * SmoothStep(0.76, 0.05, r) * 0.78;
            double core = SmoothStep(0.38, 0.02, r);
            double halo = SmoothStep(0.70, 0.05, r) * 0.42;

            double a = Clamp01(core + ray4 + rayDiag + halo);
            double hot = Clamp01(core + ray4 * 0.75);
            return new[] { 1.0, Clamp01(0.76 + hot * 0.24), Clamp01(0.36 + hot * hot * 0.64), a };
        });

        // 4. bullet_tracer.png - Supersonic Golden Bullet Streak (pointing +X right)
        SavePixelFunc(System.IO.Path.Combine(outDir, "bullet_tracer.png"), (nx, ny) =>
        {
            // Head near nx = +0.75, tapering tail back to nx = -0.95
            double headX = (nx - 0.65) / 0.30;
            double tailT = Clamp01((nx + 0.96) / 1.62); // 0 at tail, 1 at head
            double width = 0.04 + 0.20 * Math.Pow(tailT, 0.65);
            if (nx > 0.65) width *= SmoothStep(1.0, 0.0, headX);

            double yDist = Math.Abs(ny) / Math.Max(0.008, width);
            double body = SmoothStep(1.25, 0.15, yDist) * SmoothStep(0.0, 0.12, tailT) * SmoothStep(0.98, 0.72, nx);
            double core = SmoothStep(0.55, 0.0, yDist) * SmoothStep(0.20, 0.95, tailT) * SmoothStep(0.95, 0.65, nx);

            // Supersonic mach chevron fins behind head
            double chevDist = Math.Abs(Math.Abs(ny) - Math.Max(0.0, (0.68 - nx) * 0.55));
            double chevron = SmoothStep(0.075, 0.0, chevDist) * SmoothStep(0.10, 0.55, nx) * SmoothStep(0.78, 0.58, nx) * 0.65;

            double a = Clamp01(body + core * 0.7 + chevron);
            double hot = Clamp01(core + chevron * 0.5);
            return new[] { 1.0, Clamp01(0.72 + hot * 0.28), Clamp01(0.28 + hot * hot * 0.72), a };
        });

        // 5. sonic_ring.png - Crisp Supersonic Shockwave / Ricochet Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "sonic_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double streak = 0.025 * Math.Sin(ang * 18.0) + (Fbm(Math.Cos(ang) * 3.0 + 2.0, Math.Sin(ang) * 3.0 + 4.0, 3) - 0.5) * 0.06;
            double d = Math.Abs(r - (0.76 + streak));
            double main = SmoothStep(0.14, 0.015, d);
            double inner = SmoothStep(0.07, 0.0, Math.Abs(r - 0.58)) * 0.65;
            double a = Clamp01((main + inner) * SmoothStep(0.99, 0.88, r));
            double hot = SmoothStep(0.07, 0.0, d);
            return new[] { 1.0, Clamp01(0.76 + hot * 0.24), Clamp01(0.38 + hot * hot * 0.62), a };
        });

        // 6. tnt_bundle.png - Stylized Wild West Red TNT Dynamite Bundle with Sizzling Fuse
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = SIZE * 0.5f, cy = SIZE * 0.54f;

                // Soft warm glow behind dynamite bundle so it pops mid-air
                using (var gp = new GraphicsPath())
                {
                    gp.AddEllipse(56, 56, SIZE - 112, SIZE - 112);
                    using (var pgb = new PathGradientBrush(gp))
                    {
                        pgb.CenterColor = Color.FromArgb(115, 255, 160, 60);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 255, 60, 20) };
                        g.FillEllipse(pgb, 56, 56, SIZE - 112, SIZE - 112);
                    }
                }

                // 3 Red Dynamite Sticks
                float[] xs = new[] { cx - 56f, cx, cx + 56f };
                foreach (float sx in xs)
                {
                    using (var brStick = new LinearGradientBrush(
                        new RectangleF(sx - 28, cy - 115, 56, 230),
                        Color.FromArgb(255, 248, 70, 50),
                        Color.FromArgb(255, 165, 20, 18),
                        LinearGradientMode.Horizontal))
                    using (var penOut = new Pen(Color.FromArgb(255, 60, 14, 12), 6f))
                    {
                        g.FillRectangle(brStick, sx - 26, cy - 108, 52, 216);
                        g.DrawRectangle(penOut, sx - 26, cy - 108, 52, 216);
                    }
                }

                // 2 Black Leather Binding Straps + Cream "TNT" Label Band
                using (var brStrap = new SolidBrush(Color.FromArgb(255, 36, 24, 22)))
                using (var brLabel = new SolidBrush(Color.FromArgb(255, 254, 243, 199)))
                using (var penBorder = new Pen(Color.FromArgb(255, 68, 28, 16), 5f))
                {
                    g.FillRectangle(brStrap, cx - 90, cy - 72, 180, 26);
                    g.FillRectangle(brStrap, cx - 90, cy + 48, 180, 26);
                    g.FillRectangle(brLabel, cx - 86, cy - 34, 172, 68);
                    g.DrawRectangle(penBorder, cx - 86, cy - 34, 172, 68);
                }

                // Bold "TNT" text
                using (var fnt = new Font("Impact", 42f, FontStyle.Bold, GraphicsUnit.Pixel))
                using (var brTxt = new SolidBrush(Color.FromArgb(255, 185, 28, 28)))
                using (var sf = new StringFormat { Alignment = StringAlignment.Center, LineAlignment = StringAlignment.Center })
                {
                    g.DrawString("TNT", fnt, brTxt, new RectangleF(cx - 86, cy - 34, 172, 72), sf);
                }

                // Curved Sizzling Fuse + Bright Spark Star at tip
                using (var penFuse = new Pen(Color.FromArgb(255, 245, 215, 145), 9f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                {
                    g.DrawBezier(penFuse,
                        new PointF(cx, cy - 110),
                        new PointF(cx + 15, cy - 165),
                        new PointF(cx + 85, cy - 160),
                        new PointF(cx + 76, cy - 204));
                }
                PointF tip = new PointF(cx + 76, cy - 204);
                using (var brSp = new SolidBrush(Color.FromArgb(255, 255, 252, 200)))
                    g.FillEllipse(brSp, tip.X - 24, tip.Y - 24, 48, 48);
                using (var penSp = new Pen(Color.FromArgb(255, 255, 230, 95), 7f))
                {
                    g.DrawLine(penSp, tip.X - 44, tip.Y, tip.X + 44, tip.Y);
                    g.DrawLine(penSp, tip.X, tip.Y - 44, tip.X, tip.Y + 44);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "tnt_blast_bundle_tmp.png"), ImageFormat.Png);
        }
        // Rename cleanly to tnt_bundle.png
        string tmpBundle = System.IO.Path.Combine(outDir, "tnt_blast_bundle_tmp.png");
        string dstBundle = System.IO.Path.Combine(outDir, "tnt_bundle.png");
        if (System.IO.File.Exists(dstBundle)) System.IO.File.Delete(dstBundle);
        System.IO.File.Move(tmpBundle, dstBundle);

        // 7. tnt_blast.png - Jagged Comic/Anime TNT Dynamite Blast Burst & Scorch Star
        SavePixelFunc(System.IO.Path.Combine(outDir, "tnt_blast.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double spikes = 0.18 * Math.Sin(ang * 11.0 + 0.5) + 0.11 * Math.Cos(ang * 17.0 - 0.8);
            double turb = (Fbm(nx * 4.5 + 3.0, ny * 4.5 + 7.0, 4) - 0.5) * 0.25;
            double edge = 0.74 + spikes + turb;

            double burst = SmoothStep(edge + 0.10, edge - 0.24, r);
            double core = SmoothStep(0.42, 0.04, r + turb * 0.4);
            double a = Clamp01(burst * 0.95 + core * 0.6);
            double hot = Clamp01(core + SmoothStep(edge - 0.18, 0.0, r) * 0.55);
            return new[] { 1.0, Clamp01(0.55 + hot * 0.45), Clamp01(0.18 + hot * hot * 0.82), a };
        });

        // 8. lasso_loop.png - Braided Western Cowboy Rope Lasso Snare Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "lasso_loop.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);

            // Braided rope twist pattern along ring circumference
            double ropeRad = 0.74 + 0.015 * Math.Sin(ang * 3.0);
            double d = Math.Abs(r - ropeRad);
            double ropeBody = SmoothStep(0.11, 0.03, d);
            double braid = 0.55 + 0.45 * Math.Sin(ang * 34.0 + d * 28.0);
            double glow = SmoothStep(0.24, 0.04, d) * 0.45;

            // Honda slip-knot bump at ang = 0
            double kx = nx - 0.74, ky = ny;
            double knot = SmoothStep(0.16, 0.05, Math.Sqrt(kx * kx + ky * ky));

            double a = Clamp01(Math.Max(ropeBody, knot) + glow);
            double shade = Clamp01(braid * 0.75 + 0.35);
            return new[] { 1.0, Clamp01(0.75 * shade + 0.20), Clamp01(0.32 * shade + 0.10), a };
        });

        // 9. gun_smoke.png - Billowing Desert Dust & Gunpowder Smoke Cloud
        SavePixelFunc(System.IO.Path.Combine(outDir, "gun_smoke.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double n1 = Fbm(nx * 2.8 + 4.1, ny * 2.8 + 7.2, 5);
            double n2 = Fbm(nx * 5.6 - 2.3, ny * 5.6 + 1.9, 4);
            double cloud = SmoothStep(0.92, 0.24, r + (n1 - 0.5) * 0.40);
            double a = Clamp01(cloud * (0.68 + 0.50 * n2));
            double shade = Clamp01(0.66 + 0.34 * n1 - ny * 0.10);
            return new[] { shade, shade * 0.94, shade * 0.85, a };
        });

        // 10. brass_spark.png - Elongated Golden Shell-Casing & Ricochet Spark Streak
        SavePixelFunc(System.IO.Path.Combine(outDir, "brass_spark.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) * 3.0;
            double ay = Math.Abs(ny);
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.42, 0.0, d);
            double glow = SmoothStep(0.94, 0.04, d) * 0.62;
            double a = Clamp01(core + glow);
            return new[] { 1.0, Clamp01(0.82 + core * 0.18), Clamp01(0.38 + core * core * 0.62), a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[CowboyVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Desperado Cowboy 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-24} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
