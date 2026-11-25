# ==============================================================================
# LOST SAGA 3D - CYBORG (TOS RANK 9 MUSKETEER x CYBER-PLASMA) 512x512 TEXTURES
# ==============================================================================
# Redesigned to be 100% distinct from Dual-Gun Cowboy, adapted from Tree of
# Savior Rank 9 Musketeer (_ssPpuHq_lg) fused with sci-fi Cyborg energy VFX:
#   1. grooving_starburst.png   - Grooving Muzzle white-core electric violet-cyan spiky burst
#   2. penetration_cone.png     - Penetration Shot wide roaring conical plasma blast
#   3. birdfall_ribbon.png      - Birdfall / Prime & Load curved swirling energy ribbon arc
#   4. buster_beam_core.png     - Colossal horizontal Buster Beam plasma energy stream
#   5. hex_emp_grid.png         - Seamless sci-fi hexagonal EMP energy dome/tube lattice
#   6. cerulean_wave_ring.png   - Dual-tone cerulean-blue ground shockwave w/ warm amber rim
#   7. snipe_shatter_pillar.png - Snipe impact tall jagged vertical energy-shatter spike
#   8. jet_thruster_plume.png   - Supersonic wing jetpack afterburner w/ Mach diamonds
#   9. plasma_arc_bolt.png      - High-voltage electric violet-cyan lightning arc
#  10. overdrive_spark.png      - Blazing elongated amber-gold / electric-cyan streak spark
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\cyborg\textures"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Clean any superseded old texture files from v1 so the folder stays spotless
Get-ChildItem -Path $OutDir -Filter "*.png" -ErrorAction SilentlyContinue | Remove-Item -Force

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class CyborgMusketeerTexGen
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
        // 1. grooving_starburst.png - ToS Rank 9 Musketeer "Grooving Muzzle" White-Core Electric Violet/Cyan Spiky Burst!
        SavePixelFunc(System.IO.Path.Combine(outDir, "grooving_starburst.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);

            // Asymmetric razor plasma spikes (iconic Grooving Muzzle spiky corona!)
            double s1 = Math.Pow(Math.Abs(Math.Cos(ang * 4.0 + 0.2)), 10.0);
            double s2 = Math.Pow(Math.Abs(Math.Sin(ang * 6.0 - 0.5)), 14.0) * 0.82;
            double s3 = Math.Pow(Math.Abs(Math.Cos(ang * 11.0 + 1.1)), 18.0) * 0.58;
            double noise = Fbm(nx * 5.0 + 3.2, ny * 5.0 + 1.7, 3);
            double spikeLen = 0.42 + 0.54 * Clamp01(s1 + s2 + s3) + (noise - 0.5) * 0.14;

            double corona = SmoothStep(spikeLen, spikeLen * 0.18, r);
            double core = SmoothStep(0.36, 0.02, r);
            double innerRing = SmoothStep(0.10, 0.0, Math.Abs(r - 0.42)) * (0.45 + 0.55 * s1);
            double a = Clamp01((corona * 0.92 + core + innerRing * 0.65) * SmoothStep(0.99, 0.88, r));

            // Blinding pure white center -> electric ice-cyan mid -> electric violet-blue spike tips!
            double hot = Clamp01(core * 1.2 + innerRing * 0.5);
            double rCol = Clamp01(0.64 + hot * 0.36);
            double gCol = Clamp01(0.76 + hot * 0.24);
            double bCol = 1.0;
            return new[] { rCol, gCol, bCol, a };
        });

        // 2. penetration_cone.png - ToS Musketeer "Penetration Shot" Wide Conical Plasma Blast!
        // Apex at LEFT (u = 0.04), wide roaring energy cone fanning to RIGHT (u = 0.96)
        SavePixelFunc(System.IO.Path.Combine(outDir, "penetration_cone.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            if (u < 0.03 || u > 0.98) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ay = Math.Abs(ny);
            double halfW = 0.07 + Math.Pow(u, 0.78) * 0.86;
            double turb = (Fbm(u * 9.0, ny * 7.0 + 2.4, 4) - 0.5) * 0.16 * u;
            double d = Math.Max(0.0, ay + turb);

            // Shockwave Mach chevron bands marching down the cone!
            double chevron = 0.70 + 0.30 * Math.Pow(Math.Max(0.0, Math.Cos((u * 8.5 - ay * 2.2) * Math.PI)), 2.0);
            double uFade = SmoothStep(0.03, 0.12, u) * SmoothStep(0.98, 0.68, u);
            double body = SmoothStep(halfW, halfW * 0.18, d) * uFade * chevron;
            double rim = SmoothStep(0.09, 0.01, Math.Abs(ay - halfW * 0.84)) * uFade * 0.85;
            double core = SmoothStep(halfW * 0.45, 0.0, d) * SmoothStep(0.03, 0.10, u) * SmoothStep(0.85, 0.15, u);

            double a = Clamp01(body * 0.85 + rim + core);
            double hot = Clamp01(core * 1.15 + rim * 0.4);
            // White-yellow hot core -> vivid amber-orange body (re-tintable cleanly for cyan too!)
            return new[] { 1.0, Clamp01(0.72 + hot * 0.28), Clamp01(0.38 + hot * 0.62), a };
        });

        // 3. birdfall_ribbon.png - ToS Musketeer "Birdfall" & "Prime and Load" Curved Swirling Energy Ribbon Arc!
        SavePixelFunc(System.IO.Path.Combine(outDir, "birdfall_ribbon.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx); // -PI..PI, arc sweeps ~230 degrees centered at +X
            double normA = ang / Math.PI;    // -1..1
            double arcSpan = SmoothStep(0.76, 0.48, Math.Abs(normA)) * SmoothStep(-0.76, -0.48, normA);

            // Tapered razor ribbon thickness: widest at leading edge, tapering cleanly to tail
            double taper = 0.05 + 0.17 * SmoothStep(0.72, -0.35, Math.Abs(normA - 0.18));
            double radTarget = 0.72 - 0.05 * Math.Abs(normA);
            double dist = Math.Abs(r - radTarget);
            double noise = (Fbm(ang * 3.5 + 4.1, r * 12.0, 3) - 0.5) * 0.04;

            double blade = SmoothStep(taper, 0.008, Math.Max(0.0, dist + noise)) * arcSpan;
            double leadingRim = SmoothStep(0.038, 0.0, Math.Abs(r - (radTarget + taper * 0.42))) * arcSpan;
            double innerTrail = SmoothStep(0.07, 0.0, Math.Abs(r - (radTarget - taper * 0.65))) * arcSpan * 0.55;

            double a = Clamp01(blade * 0.88 + leadingRim + innerTrail);
            double hot = Clamp01(leadingRim + blade * 0.45);
            return new[] { Clamp01(0.45 + hot * 0.55), Clamp01(0.84 + hot * 0.16), 1.0, a };
        });

        // 4. buster_beam_core.png - Colossal Horizontal Plasma Buster Wave Stream
        SavePixelFunc(System.IO.Path.Combine(outDir, "buster_beam_core.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double ay = Math.Abs(ny);
            double tipFade = SmoothStep(0.0, 0.06, u) * SmoothStep(1.0, 0.88, u);
            double surge = Math.Sin(u * 28.0) * 0.045 + (Fbm(u * 11.0, ny * 6.0 + 3.0, 4) - 0.5) * 0.18;
            double d = Math.Max(0.0, ay + surge * 0.45);

            double core = SmoothStep(0.32, 0.03, d);
            double mid = SmoothStep(0.68, 0.14, d) * 0.88;
            double chevrons = 0.74 + 0.26 * Math.Sin((u * 16.0 - ay * 3.5) * Math.PI);
            double halo = SmoothStep(0.96, 0.36, ay) * 0.40;

            double a = Clamp01((core + mid * chevrons + halo) * tipFade);
            double hot = Clamp01(core * 1.15 + mid * 0.25);
            return new[] { Clamp01(0.42 + hot * 0.58), Clamp01(0.84 + hot * 0.16), 1.0, a };
        });

        // 5. hex_emp_grid.png - Seamless Sci-Fi Hexagonal Energy Lattice
        SavePixelFunc(System.IO.Path.Combine(outDir, "hex_emp_grid.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double v = (ny + 1.0) * 0.5;
            double px = u * 8.0;
            double py = v * 6.0;
            double minEdge = 10.0;
            for (int layer = 0; layer < 2; layer++)
            {
                double ox = layer == 0 ? 0.0 : 0.5;
                double oy = layer == 0 ? 0.0 : 0.5;
                double gx = Math.Floor(px - ox) + ox + 0.5;
                double gy = Math.Floor(py - oy) + oy + 0.5;
                double dx = Math.Abs(px - gx);
                double dy = Math.Abs(py - gy);
                double hexD = Math.Max(dx * 1.15, dx * 0.575 + dy * 0.98);
                double border = Math.Abs(hexD - 0.48);
                if (border < minEdge) minEdge = border;
            }
            double wire = SmoothStep(0.085, 0.015, minEdge);
            double scan = 0.75 + 0.25 * Math.Sin(v * Math.PI * 12.0);
            double vFade = SmoothStep(0.0, 0.10, v) * SmoothStep(1.0, 0.90, v);
            double a = Clamp01((wire * 0.96 + 0.16 * scan) * vFade);
            return new[] { Clamp01(0.42 + wire * 0.58), Clamp01(0.84 + wire * 0.16), 1.0, a };
        });

        // 6. cerulean_wave_ring.png - ToS Musketeer (2:35) Dual-Tone Cerulean-Blue Wave w/ Warm Amber-Orange Outer Rim!
        SavePixelFunc(System.IO.Path.Combine(outDir, "cerulean_wave_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);
            double ripple = 0.025 * Math.Sin(ang * 12.0) + (Fbm(nx * 5.0 + 1.1, ny * 5.0 + 4.3, 3) - 0.5) * 0.05;

            double outerWarm = SmoothStep(0.11, 0.012, Math.Abs(r - (0.84 + ripple)));
            double innerCool = SmoothStep(0.15, 0.015, Math.Abs(r - (0.64 - ripple * 0.6)));
            double coreRim = SmoothStep(0.045, 0.0, Math.Abs(r - 0.72));
            double softFill = SmoothStep(0.86, 0.45, r) * SmoothStep(0.28, 0.56, r) * 0.28;

            double a = Clamp01((outerWarm * 0.92 + innerCool * 0.95 + coreRim + softFill) * SmoothStep(0.99, 0.92, r));
            // Blend warm amber-orange outer rim (#fb923c) with electric cerulean-white inner wave (#38bdf8 / #ffffff)!
            double warmMix = Clamp01(outerWarm / (outerWarm + innerCool + coreRim + 0.001));
            double rCol = Clamp01((0.36 + coreRim * 0.64) * (1.0 - warmMix) + 1.0 * warmMix);
            double gCol = Clamp01((0.84 + coreRim * 0.16) * (1.0 - warmMix) + (0.60 + coreRim * 0.35) * warmMix);
            double bCol = Clamp01(1.0 * (1.0 - warmMix) + 0.24 * warmMix);
            return new[] { rCol, gCol, bCol, a };
        });

        // 7. snipe_shatter_pillar.png - ToS Musketeer (2:05) Tall Jagged Vertical Energy-Shatter Column!
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f;

                // Bright electric-violet & cyan base burst glow
                using (var gpBase = new GraphicsPath())
                {
                    gpBase.AddEllipse(64, 340, 384, 150);
                    using (var pgb = new PathGradientBrush(gpBase))
                    {
                        pgb.CenterColor = Color.FromArgb(220, 224, 248, 255);
                        pgb.SurroundColors = new[] { Color.FromArgb(0, 129, 140, 248) };
                        g.FillEllipse(pgb, 64, 340, 384, 150);
                    }
                }

                // Flanking jagged energy-shatter shards shooting upward
                PointF[] shardL = new[] { new PointF(cx - 115, 460), new PointF(cx - 165, 195), new PointF(cx - 88, 285), new PointF(cx - 42, 460) };
                PointF[] shardR = new[] { new PointF(cx + 42, 460), new PointF(cx + 96, 265), new PointF(cx + 168, 170), new PointF(cx + 115, 460) };
                using (var brFlank = new LinearGradientBrush(new PointF(cx, 165), new PointF(cx, 465), Color.FromArgb(245, 224, 242, 254), Color.FromArgb(220, 129, 140, 248)))
                using (var penGlow = new Pen(Color.FromArgb(145, 99, 102, 241), 16f) { LineJoin = LineJoin.Round })
                using (var penEdge = new Pen(Color.FromArgb(255, 255, 255, 255), 5f) { LineJoin = LineJoin.Bevel })
                {
                    g.DrawPolygon(penGlow, shardL);
                    g.FillPolygon(brFlank, shardL);
                    g.DrawPolygon(penEdge, shardL);
                    g.DrawPolygon(penGlow, shardR);
                    g.FillPolygon(brFlank, shardR);
                    g.DrawPolygon(penEdge, shardR);
                }

                // Main Tall Blinding Central Plasma Shatter Spire
                PointF[] spire = new[]
                {
                    new PointF(cx, 18),
                    new PointF(cx + 68, 185),
                    new PointF(cx + 44, 235),
                    new PointF(cx + 88, 464),
                    new PointF(cx - 88, 464),
                    new PointF(cx - 46, 248),
                    new PointF(cx - 66, 195)
                };
                using (var brMain = new LinearGradientBrush(new PointF(cx, 18), new PointF(cx, 465), Color.FromArgb(255, 255, 255, 255), Color.FromArgb(245, 56, 189, 248)))
                using (var penOuter = new Pen(Color.FromArgb(160, 139, 92, 246), 24f) { LineJoin = LineJoin.Round })
                using (var penCore = new Pen(Color.FromArgb(255, 255, 255, 255), 8f) { LineJoin = LineJoin.Miter })
                {
                    g.DrawPolygon(penOuter, spire);
                    g.FillPolygon(brMain, spire);
                    g.DrawPolygon(penCore, spire);
                    g.DrawLine(penCore, cx, 24, cx, 462);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "snipe_shatter_pillar.png"), ImageFormat.Png);
        }

        // 8. jet_thruster_plume.png - Supersonic Mecha Jetpack Afterburner Flame Cone w/ Mach Diamonds
        SavePixelFunc(System.IO.Path.Combine(outDir, "jet_thruster_plume.png"), (nx, ny) =>
        {
            double v = (ny + 1.0) * 0.5;
            if (v < 0.04 || v > 0.98) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double width = (0.36 * Math.Pow(1.0 - v, 0.65) + 0.05) * (0.90 + 0.14 * Math.Sin(v * 24.0));
            double ax = Math.Abs(nx);
            double turb = (Fbm(nx * 5.0 + 2.1, v * 8.0, 3) - 0.5) * 0.08 * v;
            double d = Math.Max(0.0, ax + turb);

            double outer = SmoothStep(width * 1.45, width * 0.25, d) * SmoothStep(0.04, 0.12, v) * SmoothStep(0.98, 0.55, v);
            double core = SmoothStep(width * 0.62, 0.0, d) * SmoothStep(0.04, 0.10, v) * SmoothStep(0.82, 0.18, v);
            double mach = Math.Pow(Math.Max(0.0, Math.Cos((v - 0.12) * Math.PI * 6.0)), 6.0) * SmoothStep(width * 0.55, 0.0, ax) * SmoothStep(0.85, 0.12, v);

            double a = Clamp01(outer + core * 0.75 + mach * 0.85);
            double hot = Clamp01(core * 0.9 + mach);
            return new[] { 1.0, Clamp01(0.76 + hot * 0.24), Clamp01(0.48 + hot * 0.52), a };
        });

        // 9. plasma_arc_bolt.png - Jagged High-Voltage Electric Violet-Cyan Lightning Bolt
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                PointF[] mainBolt = new[]
                {
                    new PointF(256, 20), new PointF(214, 92), new PointF(302, 154),
                    new PointF(198, 226), new PointF(314, 294), new PointF(222, 370),
                    new PointF(276, 434), new PointF(256, 492)
                };
                PointF[] branch1 = new[] { new PointF(302, 154), new PointF(368, 190), new PointF(414, 236) };
                PointF[] branch2 = new[] { new PointF(198, 226), new PointF(126, 268), new PointF(90, 322) };
                PointF[] branch3 = new[] { new PointF(314, 294), new PointF(382, 344), new PointF(416, 398) };

                using (var penHalo = new Pen(Color.FromArgb(130, 139, 92, 246), 34f) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penMid = new Pen(Color.FromArgb(235, 103, 232, 249), 16f) { LineJoin = LineJoin.Bevel, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penCore = new Pen(Color.FromArgb(255, 255, 255, 255), 7f) { LineJoin = LineJoin.Miter, StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var penBranchGlow = new Pen(Color.FromArgb(135, 139, 92, 246), 16f) { LineJoin = LineJoin.Round, StartCap = LineCap.Round, EndCap = LineCap.Round })
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

        // 10. overdrive_spark.png - Razor Elongated Plasma Energy Streak Spark
        SavePixelFunc(System.IO.Path.Combine(outDir, "overdrive_spark.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) / 0.22;
            double ay = Math.Abs(ny) / 0.94;
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.84, 0.04, d);
            double halo = SmoothStep(1.38, 0.14, d) * 0.45;
            double a = Clamp01(core + halo);
            double hot = Clamp01(core);
            return new[] { Clamp01(0.75 + hot * 0.25), Clamp01(0.92 + hot * 0.08), 1.0, a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[CyborgMusketeerTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Cyborg (Musketeer x Cyber-Plasma) 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-26} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
