# ==============================================================================
# LOST SAGA 3D - VIKING BERSERKER (NORSE RAGNAROK) 512x512 HD VFX TEXTURES
# ==============================================================================
# Generates 10 brutal, heavy-weight Norse Berserker 512x512 RGBA PNG textures:
#   1. norse_rune_circle.png    - Carved Viking Vegvisir / Elder Futhark rune seal
#   2. axe_cleave_arc.png       - Heavy brutal double-axe forged-ember cleave arc
#   3. whirlwind_axe_ring.png   - Full 360 twin-axe whirlwind berserker vortex disc
#   4. tectonic_crater.png      - Fractured volcanic basalt earthshatter crater
#   5. earth_pillar_rock.png    - Jagged erupting basalt rock slab w/ molten veins
#   6. valhalla_rage_vortex.png - Seamless rising crimson-amber berserker war-flame
#   7. seismic_shock_ring.png   - Heavy fractured stone & molten-ember shock ring
#   8. colossus_claw_impact.png - Brutal titan slam / hurl sonic shock burst
#   9. rock_chunk.png           - Angular faceted dark basalt boulder chunk debris
#  10. berserk_ember.png        - Jagged glowing forge-copper & blood-rage spark
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\viking\textures"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class VikingVfxTexGen
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
        // 1. norse_rune_circle.png - Heavy Carved Viking Vegvisir / Elder Futhark Compass Seal
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f, cy = 256f;

                using (var penGlow = new Pen(Color.FromArgb(145, 249, 115, 22), 20f) { StartCap = LineCap.Flat, EndCap = LineCap.Flat })
                using (var penMain = new Pen(Color.FromArgb(255, 255, 237, 213), 9f) { StartCap = LineCap.Flat, EndCap = LineCap.Flat })
                using (var penRune = new Pen(Color.FromArgb(245, 253, 186, 116), 6.5f) { StartCap = LineCap.Square, EndCap = LineCap.Square })
                {
                    // Double heavy forged bronze rings
                    g.DrawEllipse(penGlow, 28, 28, SIZE - 56, SIZE - 56);
                    g.DrawEllipse(penMain, 28, 28, SIZE - 56, SIZE - 56);
                    g.DrawEllipse(penMain, 80, 80, SIZE - 160, SIZE - 160);

                    // 16 Angular Elder Futhark-style rune glyphs between the two rings
                    for (int i = 0; i < 16; i++)
                    {
                        double a = (i / 16.0) * Math.PI * 2.0;
                        float rMid = 202f;
                        float rx = cx + (float)(Math.Cos(a) * rMid);
                        float ry = cy + (float)(Math.Sin(a) * rMid);
                        var state = g.Save();
                        g.TranslateTransform(rx, ry);
                        g.RotateTransform((float)(a * 180.0 / Math.PI + 90.0));
                        // Draw angular Norse rune stave + side strokes
                        g.DrawLine(penRune, 0, -16, 0, 16);
                        if (i % 3 == 0) { g.DrawLine(penRune, 0, -14, 11, -3); g.DrawLine(penRune, 0, 0, 11, 11); }
                        else if (i % 3 == 1) { g.DrawLine(penRune, -10, -12, 10, 12); g.DrawLine(penRune, 10, -12, -10, 12); }
                        else { g.DrawLine(penRune, 0, -14, -10, -2); g.DrawLine(penRune, 0, -14, 10, -2); g.DrawLine(penRune, 0, 4, 10, 14); }
                        g.Restore(state);
                    }

                    // 8 Iconic Vegvisir Viking Compass Staves radiating from center!
                    for (int i = 0; i < 8; i++)
                    {
                        double a = (i / 8.0) * Math.PI * 2.0;
                        float ca = (float)Math.Cos(a), sa = (float)Math.Sin(a);
                        float px = -sa, py = ca;
                        float len = (i % 2 == 0) ? 166f : 148f;
                        g.DrawLine(penGlow, cx, cy, cx + ca * len, cy + sa * len);
                        g.DrawLine(penMain, cx, cy, cx + ca * len, cy + sa * len);
                        // Trident / barbed Vegvisir prongs near outer tip
                        float t1 = len * 0.68f, t2 = len * 0.88f, w1 = 22f, w2 = 30f;
                        g.DrawLine(penRune, cx + ca * t1 - px * w1, cy + sa * t1 - py * w1, cx + ca * t1 + px * w1, cy + sa * t1 + py * w1);
                        g.DrawLine(penMain, cx + ca * t2 - px * w2, cy + sa * t2 - py * w2, cx + ca * len, cy + sa * len);
                        g.DrawLine(penMain, cx + ca * t2 + px * w2, cy + sa * t2 + py * w2, cx + ca * len, cy + sa * len);
                    }

                    // Inner bold octagon core
                    PointF[] oct = new PointF[8];
                    for (int i = 0; i < 8; i++)
                    {
                        double a = (i / 8.0) * Math.PI * 2.0 + Math.PI / 8.0;
                        oct[i] = new PointF(cx + (float)(Math.Cos(a) * 58f), cy + (float)(Math.Sin(a) * 58f));
                    }
                    g.DrawPolygon(penMain, oct);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "norse_rune_circle.png"), ImageFormat.Png);
        }

        // 2. axe_cleave_arc.png - Brutal Heavy Jagged Battleaxe Cleave Arc
        SavePixelFunc(System.IO.Path.Combine(outDir, "axe_cleave_arc.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double normA = ang / Math.PI;
            double span = SmoothStep(0.74, 0.36, Math.Abs(normA));

            // Thick brutal forged axe swath (heavier & more jagged than sword crescents!)
            double noise = (Fbm(ang * 4.5 + 2.3, r * 10.0, 4) - 0.5) * 0.10;
            double width = 0.24 * SmoothStep(0.72, 0.05, Math.Abs(normA - 0.10)) + 0.04;
            double radTarget = 0.68;
            double d = Math.Abs(r - radTarget + noise * 0.65);

            double body = SmoothStep(width, 0.02, d) * span;
            double jaggedEdge = SmoothStep(0.055, 0.0, Math.Abs(r - (radTarget + width * 0.68 + noise))) * span;
            double innerGlow = SmoothStep(width * 0.48, 0.0, d) * span;

            double a = Clamp01(body * 0.90 + jaggedEdge + innerGlow * 0.6);
            double hot = Clamp01(jaggedEdge + innerGlow * 0.7);
            return new[] { 1.0, Clamp01(0.56 + hot * 0.44), Clamp01(0.22 + hot * 0.72), a };
        });

        // 3. whirlwind_axe_ring.png - Full 360 Twin-Axe Berserker Whirlwind Cyclone Disc!
        SavePixelFunc(System.IO.Path.Combine(outDir, "whirlwind_axe_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99 || r < 0.16) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);

            // Twin opposing heavy battleaxe spin streaks (2-fold rotational symmetry!)
            double spiral = ang * 2.0 + r * 5.2;
            double twinBlades = Math.Pow(Math.Max(0.0, Math.Cos(spiral)), 1.6);
            double outerSwath = SmoothStep(0.24, 0.02, Math.Abs(r - 0.74)) * (0.45 + 0.55 * twinBlades);
            double steelRim = SmoothStep(0.06, 0.0, Math.Abs(r - 0.88)) * (0.35 + 0.65 * twinBlades);
            double innerSwirl = SmoothStep(0.18, 0.02, Math.Abs(r - 0.48)) * (0.35 + 0.65 * Math.Pow(Math.Max(0.0, Math.Sin(spiral)), 2.0));
            double rough = 0.78 + 0.22 * Fbm(nx * 7.0 + 3.0, ny * 7.0 + 1.5, 3);

            double a = Clamp01((outerSwath + steelRim + innerSwirl * 0.75) * rough * SmoothStep(0.99, 0.92, r));
            double hot = Clamp01(steelRim * 1.1 + outerSwath * 0.45);
            return new[] { 1.0, Clamp01(0.62 + hot * 0.38), Clamp01(0.28 + hot * 0.72), a };
        });

        // 4. tectonic_crater.png - Fractured Volcanic Basalt Earthshatter Crater w/ Molten Cracks
        SavePixelFunc(System.IO.Path.Combine(outDir, "tectonic_crater.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);

            double bestCrack = 0.0;
            for (int i = 0; i < 8; i++)
            {
                double baseA = (i / 8.0) * Math.PI * 2.0 + 0.2;
                double da = Math.Atan2(Math.Sin(ang - baseA), Math.Cos(ang - baseA));
                double jag = (Fbm(r * 8.0 + i * 3.1, i * 5.2, 3) - 0.5) * 0.24;
                double arcDist = Math.Abs(da + jag) * Math.Max(0.08, r);
                double c = SmoothStep(0.068, 0.008, arcDist) * SmoothStep(0.95, 0.45, r);
                if (c > bestCrack) bestCrack = c;
            }
            double rockNoise = Fbm(nx * 6.0 + 2.2, ny * 6.0 + 8.1, 4);
            double rimJagged = 0.84 + 0.09 * Math.Sin(ang * 8.0) + (rockNoise - 0.5) * 0.16;
            double stoneDisc = SmoothStep(rimJagged + 0.06, rimJagged - 0.12, r) * (0.62 + 0.38 * rockNoise);
            double craterRing = SmoothStep(0.11, 0.015, Math.Abs(r - 0.54 + (rockNoise - 0.5) * 0.10)) * 0.75;

            double a = Clamp01(Math.Max(stoneDisc, Math.Max(bestCrack, craterRing)));
            double hot = Clamp01(bestCrack * 1.15 + craterRing * 0.45);
            // Warm glowing amber-white tectonic cracks over rocky shade (tints dark stone cleanly in NormalBlending!)
            return new[] { Clamp01(0.55 + hot * 0.45), Clamp01(0.38 + hot * 0.58), Clamp01(0.24 + hot * 0.56), a };
        });

        // 5. earth_pillar_rock.png - Jagged Erupting Volcanic Basalt Slab w/ Molten Norse Cracks (pointing UP -Y)
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                float cx = 256f;

                // Flanking jagged rock shards
                PointF[] rockL = new[] { new PointF(cx - 135, 462), new PointF(cx - 165, 275), new PointF(cx - 95, 200), new PointF(cx - 48, 325), new PointF(cx - 58, 462) };
                PointF[] rockR = new[] { new PointF(cx + 55, 462), new PointF(cx + 46, 300), new PointF(cx + 112, 185), new PointF(cx + 168, 280), new PointF(cx + 132, 462) };
                using (var brFlank = new LinearGradientBrush(new PointF(cx, 180), new PointF(cx, 465), Color.FromArgb(250, 148, 120, 98), Color.FromArgb(245, 72, 54, 44)))
                using (var penEdge = new Pen(Color.FromArgb(255, 251, 146, 60), 5f) { LineJoin = LineJoin.Bevel })
                {
                    g.FillPolygon(brFlank, rockL);
                    g.DrawPolygon(penEdge, rockL);
                    g.FillPolygon(brFlank, rockR);
                    g.DrawPolygon(penEdge, rockR);
                }

                // Main Heavy Chiseled Basalt Slab (Left sunlit granite facet + Right shadowed dark basalt facet!)
                PointF[] mainL = new[] { new PointF(cx - 12, 34), new PointF(cx - 88, 175), new PointF(cx - 108, 464), new PointF(cx, 468) };
                PointF[] mainR = new[] { new PointF(cx - 12, 34), new PointF(cx + 82, 155), new PointF(cx + 106, 464), new PointF(cx, 468) };
                PointF[] outline = new[] { new PointF(cx - 12, 34), new PointF(cx + 82, 155), new PointF(cx + 106, 464), new PointF(cx, 468), new PointF(cx - 108, 464), new PointF(cx - 88, 175) };

                using (var brL = new LinearGradientBrush(new PointF(cx - 108, 34), new PointF(cx, 468), Color.FromArgb(255, 196, 168, 142), Color.FromArgb(255, 112, 86, 68)))
                using (var brR = new LinearGradientBrush(new PointF(cx, 34), new PointF(cx + 106, 468), Color.FromArgb(255, 122, 94, 76), Color.FromArgb(255, 58, 42, 34)))
                using (var penMoltenGlow = new Pen(Color.FromArgb(165, 249, 115, 22), 18f) { LineJoin = LineJoin.Round })
                using (var penMoltenCore = new Pen(Color.FromArgb(255, 254, 240, 138), 6f) { LineJoin = LineJoin.Bevel })
                {
                    g.DrawPolygon(penMoltenGlow, outline);
                    g.FillPolygon(brL, mainL);
                    g.FillPolygon(brR, mainR);
                    // Glowing molten lava fissure running vertically through the rock slab!
                    PointF[] vein = new[] { new PointF(cx - 10, 48), new PointF(cx + 18, 175), new PointF(cx - 20, 298), new PointF(cx + 12, 456) };
                    g.DrawLines(penMoltenGlow, vein);
                    g.DrawLines(penMoltenCore, vein);
                    g.DrawPolygon(penMoltenCore, outline);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "earth_pillar_rock.png"), ImageFormat.Png);
        }

        // 6. valhalla_rage_vortex.png - Seamless Rising Crimson-Amber Berserker War-Flame Aura
        SavePixelFunc(System.IO.Path.Combine(outDir, "valhalla_rage_vortex.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double v = (ny + 1.0) * 0.5;
            double vFade = SmoothStep(0.0, 0.14, v) * SmoothStep(1.0, 0.72, v);

            double flame = SeamlessFbm(u + v * 0.18, v * 5.2, 4.0, 4);
            double tongues = Math.Pow(Clamp01(Math.Sin((u * 5.0 + v * 1.4) * Math.PI * 2.0) * 0.5 + 0.5), 1.6);
            double a = Clamp01((flame * 0.85 + tongues * 0.55 - 0.22) * 1.55) * vFade;
            double hot = SmoothStep(0.45, 0.92, a);
            return new[] { 1.0, Clamp01(0.42 + hot * 0.56), Clamp01(0.14 + hot * 0.65), a };
        });

        // 7. seismic_shock_ring.png - Heavy Fractured Stone & Molten-Ember Seismic Shockwave Ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "seismic_shock_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double teeth = 0.055 * Math.Abs(Math.Sin(ang * 8.0)) + (Fbm(nx * 6.0 + 3.0, ny * 6.0 + 1.0, 3) - 0.5) * 0.08;
            double d = Math.Abs(r - (0.74 + teeth));
            double main = SmoothStep(0.16, 0.015, d);
            double inner = SmoothStep(0.075, 0.008, Math.Abs(r - 0.56)) * 0.72;
            double a = Clamp01((main + inner) * SmoothStep(0.99, 0.88, r));
            double hot = SmoothStep(0.08, 0.0, d);
            return new[] { 1.0, Clamp01(0.58 + hot * 0.42), Clamp01(0.24 + hot * 0.68), a };
        });

        // 8. colossus_claw_impact.png - Brutal Titan Impact / Hurl Sonic Shock Burst
        SavePixelFunc(System.IO.Path.Combine(outDir, "colossus_claw_impact.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            if (r > 0.99) return new[] { 0.0, 0.0, 0.0, 0.0 };
            double ang = Math.Atan2(ny, nx);
            double spikes = Math.Pow(Math.Abs(Math.Cos(ang * 6.0)), 6.0) * 0.48 + Math.Pow(Math.Abs(Math.Sin(ang * 9.0 + 0.4)), 10.0) * 0.35;
            double len = 0.46 + spikes;
            double blast = SmoothStep(len, 0.14, r);
            double ring = SmoothStep(0.11, 0.01, Math.Abs(r - 0.54)) * 0.88;
            double core = SmoothStep(0.34, 0.02, r);
            double a = Clamp01((blast * 0.85 + ring + core) * SmoothStep(0.99, 0.88, r));
            double hot = Clamp01(core + ring * 0.55);
            return new[] { 1.0, Clamp01(0.62 + hot * 0.38), Clamp01(0.26 + hot * 0.74), a };
        });

        // 9. rock_chunk.png - Angular Faceted Volcanic Basalt Boulder Debris Chunk
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                g.Clear(Color.Transparent);
                PointF[] poly = new[]
                {
                    new PointF(248, 52), new PointF(406, 128), new PointF(452, 296),
                    new PointF(346, 446), new PointF(146, 424), new PointF(68, 258), new PointF(132, 112)
                };
                PointF[] topFacet = new[] { new PointF(248, 52), new PointF(406, 128), new PointF(264, 240), new PointF(132, 112) };
                PointF[] rightFacet = new[] { new PointF(406, 128), new PointF(452, 296), new PointF(346, 446), new PointF(264, 240) };
                using (var brBase = new SolidBrush(Color.FromArgb(255, 92, 74, 62)))
                using (var brTop = new SolidBrush(Color.FromArgb(255, 168, 144, 124)))
                using (var brRight = new SolidBrush(Color.FromArgb(255, 58, 44, 36)))
                using (var penEdge = new Pen(Color.FromArgb(230, 249, 115, 22), 9f) { LineJoin = LineJoin.Bevel })
                {
                    g.FillPolygon(brBase, poly);
                    g.FillPolygon(brTop, topFacet);
                    g.FillPolygon(brRight, rightFacet);
                    g.DrawPolygon(penEdge, poly);
                }
            });
            bmp.Save(System.IO.Path.Combine(outDir, "rock_chunk.png"), ImageFormat.Png);
        }

        // 10. berserk_ember.png - Jagged Glowing Forge-Copper & Blood-Rage Spark
        SavePixelFunc(System.IO.Path.Combine(outDir, "berserk_ember.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) / 0.28;
            double ay = Math.Abs(ny) / 0.92;
            double d = Math.Sqrt(ax * ax + ay * ay);
            double core = SmoothStep(0.84, 0.05, d);
            double halo = SmoothStep(1.38, 0.16, d) * 0.45;
            double a = Clamp01(core + halo);
            return new[] { 1.0, Clamp01(0.56 + core * 0.44), Clamp01(0.18 + core * 0.72), a };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies System.Drawing
[VikingVfxTexGen]::GenerateAll($OutDir)

$files = Get-ChildItem -Path $OutDir -Filter "*.png" | Sort-Object Name
Write-Host "Generated $($files.Count) Viking Berserker (Norse Ragnarok) 512x512 VFX textures in $OutDir"
foreach ($f in $files) {
    Write-Host ("  - {0,-26} {1,8:N0} bytes" -f $f.Name, $f.Length)
}
