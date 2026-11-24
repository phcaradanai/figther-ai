# ============================================================================
# LOST SAGA 3D - IRON KNIGHT EFFEKSEER VFX TEXTURE GENERATOR (512x512 RGBA PNG)
# ============================================================================
# Generates 10 crisp, smooth, tint-ready luminous VFX textures into:
#   public/assets/vfx/knight/textures/
# Run: powershell -ExecutionPolicy Bypass -File tools/generate_knight_vfx_textures.ps1
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\knight\textures")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class KnightVfxTexGen
{
    private const int SIZE = 512;

    private static double Clamp01(double v) { return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v); }
    private static double SmoothStep(double e0, double e1, double x)
    {
        double t = Clamp01((x - e0) / (e1 - e0));
        return t * t * (3.0 - 2.0 * t);
    }

    // Simple deterministic value noise for painterly energy wisps
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
                double ny = ((y + 0.5) / SIZE) * 2.0 - 1.0; // -1..+1
                for (int x = 0; x < SIZE; x++)
                {
                    double nx = ((x + 0.5) / SIZE) * 2.0 - 1.0; // -1..+1
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

    private static void AddGlowOverlay(Bitmap bmp, Action<Graphics> drawAction)
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
        // 1. soft_glow.png - ultra-smooth radiant orb (zero edge clipping)
        SavePixelFunc(System.IO.Path.Combine(outDir, "soft_glow.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double edge = 1.0 - SmoothStep(0.0, 0.98, r);
            double core = Math.Pow(edge, 1.8);
            double hot = Math.Pow(1.0 - SmoothStep(0.0, 0.42, r), 2.5);
            double a = Clamp01(core * 0.85 + hot * 0.55);
            double v = Clamp01(0.82 + hot * 0.18);
            return new double[] { v, v, v, a };
        });

        // 2. holy_spark.png - sleek vertical diamond lance spark (for DirectionalBillboard)
        SavePixelFunc(System.IO.Path.Combine(outDir, "holy_spark.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx) * 3.8;
            double ay = Math.Abs(ny) * 1.05;
            double d = Math.Pow(ax, 1.35) + Math.Pow(ay, 1.55);
            double core = Math.Exp(-d * 4.8);
            double halo = Math.Exp(-(nx * nx * 16.0 + ny * ny * 2.2) * 1.6) * 0.55;
            double edgeFade = 1.0 - SmoothStep(0.82, 0.99, Math.Max(Math.Abs(nx), Math.Abs(ny)));
            double a = Clamp01((core + halo) * edgeFade);
            return new double[] { 1.0, 0.99, 0.95, a };
        });

        // 3. starburst_flare.png - crisp anime 4+4+8 ray impact & parry starburst
        SavePixelFunc(System.IO.Path.Combine(outDir, "starburst_flare.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double edge = 1.0 - SmoothStep(0.70, 0.98, r);

            // Primary 4-point cross spikes
            double ray4 = Math.Pow(Math.Abs(Math.Cos(ang * 2.0)), 22.0) * Math.Exp(-r * 2.5);
            // Secondary 45-deg 4-point spikes
            double rayDiag = Math.Pow(Math.Abs(Math.Sin(ang * 2.0)), 30.0) * Math.Exp(-r * 4.2) * 0.65;
            // Subtle inner ring shimmer
            double ring = Math.Exp(-Math.Pow((r - 0.24) * 14.0, 2.0)) * 0.28;
            // Hot circular core
            double core = Math.Exp(-r * r * 18.0);
            double softHalo = Math.Exp(-r * r * 4.5) * 0.42;

            double intensity = (core + ray4 * 1.15 + rayDiag + ring + softHalo) * edge;
            double a = Clamp01(intensity);
            return new double[] { 1.0, 0.98, 0.94, a };
        });

        // 4. shockwave_ring.png - crisp shockwave front with wispy energetic outer tail
        SavePixelFunc(System.IO.Path.Combine(outDir, "shockwave_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double edge = 1.0 - SmoothStep(0.86, 0.99, r);

            // Noise along polar angle for organic painterly shockwave streaks
            double n1 = Fbm(Math.Cos(ang) * 3.2 + 5.1, Math.Sin(ang) * 3.2 + 2.3, 4);
            double n2 = Fbm(Math.Cos(ang) * 7.5 + r * 3.5, Math.Sin(ang) * 7.5 + r * 3.5, 3);

            // Sharp outer lip at r ~ 0.78, fading softly inward to r ~ 0.44
            double outerDrop = 1.0 - SmoothStep(0.79, 0.87, r);
            double innerRise = SmoothStep(0.42, 0.77, r);
            double band = Math.Pow(innerRise, 2.2) * outerDrop;

            // Razor bright rim highlight
            double rim = Math.Exp(-Math.Pow((r - 0.785) * 26.0, 2.0));
            // Subtle inner secondary echo ring
            double innerRing = Math.Exp(-Math.Pow((r - 0.56) * 28.0, 2.0)) * 0.35 * (0.6 + 0.4 * n1);

            double val = (rim * 1.05 + band * (0.55 + 0.65 * n2) + innerRing) * edge;
            return new double[] { 1.0, 0.98, 0.93, Clamp01(val) };
        });

        // 5. slash_crescent.png - razor-sharp luminous Excalibur / Broadsword crescent wave
        SavePixelFunc(System.IO.Path.Combine(outDir, "slash_crescent.png"), (nx, ny) =>
        {
            // Arc opens to left, blade sweeps boldly on the right (+X)
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx); // 0 is right (+X), +-PI is left

            // Crescent spans from -128 deg to +128 deg, thickest at 0 deg, razor tapered at tips
            double maxAng = 2.22; // ~127 deg
            double normAng = Math.Abs(ang) / maxAng;
            if (normAng >= 1.0) return new double[] { 0, 0, 0, 0 };

            double tipTaper = Math.Pow(Math.Cos(normAng * Math.PI * 0.5), 1.35);
            double tipAlpha = Math.Pow(Math.Cos(normAng * Math.PI * 0.5), 1.55);
            double outerR = 0.88 - 0.05 * normAng * normAng;
            double thickness = 0.38 * tipTaper;
            double innerR = outerR - thickness;

            if (r > outerR + 0.08 || r < innerR - 0.14) return new double[] { 0, 0, 0, 0 };

            double fbm = Fbm(ang * 3.8 + 4.0, r * 7.0 + 1.5, 4);
            double streak = Fbm(ang * 9.0 + 1.2, r * 14.0, 3);

            // Sharp leading blade edge near outerR
            double leadingEdge = Math.Exp(-Math.Pow((r - (outerR - 0.02)) * 28.0, 2.0)) * tipAlpha;

            // Body gradient from leading edge back to wispy trailing edge
            double bodyT = Clamp01((r - innerR) / Math.Max(0.01, outerR - innerR));
            double bodyMask = SmoothStep(0.0, 0.25, bodyT) * (1.0 - SmoothStep(0.92, 1.02, bodyT));
            double bodyVal = Math.Pow(bodyT, 1.35) * bodyMask * (0.55 + 0.65 * fbm) * tipAlpha;

            // Energetic feather trails behind inner edge
            double trailT = Clamp01((r - (innerR - 0.12)) / 0.16);
            double trail = SmoothStep(0.0, 0.8, trailT) * (1.0 - SmoothStep(0.7, 1.0, trailT))
                         * Math.Pow(streak, 1.5) * tipAlpha * 0.65;

            double edgeGuard = 1.0 - SmoothStep(0.90, 0.99, r);
            double a = Clamp01((leadingEdge * 1.15 + bodyVal + trail) * edgeGuard);
            double whiteHot = Clamp01(0.75 + leadingEdge * 0.25);
            return new double[] { 1.0, 0.97 + 0.03 * whiteHot, 0.88 + 0.12 * whiteHot, a };
        });

        // 6. energy_ribbon.png - seamless horizontal energy/wind ribbon & cylinder texture
        SavePixelFunc(System.IO.Path.Combine(outDir, "energy_ribbon.png"), (nx, ny) =>
        {
            // Horizontal U wraps cleanly (period 2.0 in nx); vertical V fades smoothly at top/bottom
            double u = (nx + 1.0) * 0.5; // 0..1
            double theta = u * Math.PI * 2.0;
            // Seamless periodic noise in U
            double n1 = Fbm(Math.Cos(theta) * 2.5 + 3.0, Math.Sin(theta) * 2.5 + ny * 3.5, 4);
            double n2 = Fbm(Math.Cos(theta * 2.0) * 3.0 + 7.0, Math.Sin(theta * 2.0) * 3.0 + ny * 6.0, 3);

            double yDist = Math.Abs(ny);
            double vFade = 1.0 - SmoothStep(0.08, 0.96, yDist);
            double coreBand = Math.Exp(-yDist * yDist * 14.0);
            double filaments = Math.Pow(vFade, 1.4) * (0.35 + 0.85 * n1) * (0.65 + 0.5 * n2);
            // Soft longitudinal streak lines
            double stripe = Math.Exp(-Math.Pow((yDist - 0.34) * 14.0, 2.0)) * (0.4 + 0.6 * n2) * 0.55;

            double val = coreBand * 0.95 + filaments * 0.72 + stripe;
            // Subtle end fade only very close to V edges so cylinder/ribbon never hard-clips
            val *= (1.0 - SmoothStep(0.88, 0.99, yDist));
            return new double[] { 1.0, 0.98, 0.95, Clamp01(val) };
        });

        // 7. heal_cross.png - radiant paladin healing cross mote
        SavePixelFunc(System.IO.Path.Combine(outDir, "heal_cross.png"), (nx, ny) =>
        {
            double ax = Math.Abs(nx);
            double ay = Math.Abs(ny);
            double r = Math.Sqrt(nx * nx + ny * ny);

            // Crisp beveled plus cross
            double barH = (1.0 - SmoothStep(0.10, 0.16, ay)) * (1.0 - SmoothStep(0.46, 0.54, ax));
            double barV = (1.0 - SmoothStep(0.10, 0.16, ax)) * (1.0 - SmoothStep(0.46, 0.54, ay));
            double cross = Math.Max(barH, barV);

            // Inner bright bevel
            double inH = (1.0 - SmoothStep(0.05, 0.09, ay)) * (1.0 - SmoothStep(0.40, 0.46, ax));
            double inV = (1.0 - SmoothStep(0.05, 0.09, ax)) * (1.0 - SmoothStep(0.40, 0.46, ay));
            double core = Math.Max(inH, inV);

            // Soft healing aura halo
            double halo = Math.Exp(-r * r * 5.2) * 0.58 * (1.0 - SmoothStep(0.75, 0.98, r));
            double a = Clamp01(cross * 0.92 + core * 0.35 + halo);
            return new double[] { 1.0, 1.0, 0.96, a };
        });

        // 8. holy_rune_circle.png - ornate Tree-of-Savior / Paladin sanctuary ground magic circle
        GenerateHolyRuneCircle(System.IO.Path.Combine(outDir, "holy_rune_circle.png"));

        // 9. hex_aegis_shield.png - glowing hexagonal paladin barrier & shield bash crest
        GenerateHexAegisShield(System.IO.Path.Combine(outDir, "hex_aegis_shield.png"));

        // 10. lion_crest_roar.png - radiant Lionheart Warcry sunburst emblem & sonic wave
        GenerateLionCrestRoar(System.IO.Path.Combine(outDir, "lion_crest_roar.png"));
    }

    private static void GenerateHolyRuneCircle(string path)
    {
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            // Base soft radial glow via LockBits
            var rect = new Rectangle(0, 0, SIZE, SIZE);
            var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            byte[] buf = new byte[SIZE * SIZE * 4];
            for (int y = 0; y < SIZE; y++)
            {
                double ny = ((y + 0.5) / SIZE) * 2.0 - 1.0;
                for (int x = 0; x < SIZE; x++)
                {
                    double nx = ((x + 0.5) / SIZE) * 2.0 - 1.0;
                    double r = Math.Sqrt(nx * nx + ny * ny);
                    double outerGlow = Math.Exp(-Math.Pow((r - 0.84) * 14.0, 2.0)) * 0.48;
                    double midGlow = Math.Exp(-Math.Pow((r - 0.62) * 14.0, 2.0)) * 0.32;
                    double coreGlow = Math.Exp(-r * r * 6.5) * 0.25;
                    double edge = 1.0 - SmoothStep(0.90, 0.99, r);
                    double a = Clamp01((outerGlow + midGlow + coreGlow) * edge);
                    int idx = (y * SIZE + x) * 4;
                    buf[idx + 0] = 235;
                    buf[idx + 1] = 248;
                    buf[idx + 2] = 255;
                    buf[idx + 3] = (byte)(a * 255.0);
                }
            }
            Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            bmp.UnlockBits(data);

            AddGlowOverlay(bmp, g =>
            {
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;
                // Concentric rings
                using (var pGlow = new Pen(Color.FromArgb(110, 255, 250, 230), 10f))
                using (var pMain = new Pen(Color.FromArgb(245, 255, 255, 255), 3.6f))
                using (var pThin = new Pen(Color.FromArgb(215, 255, 252, 240), 2.0f))
                {
                    float[] radii = { 222f, 206f, 166f, 154f, 94f };
                    foreach (float rad in radii)
                    {
                        g.DrawEllipse(rad == 222f || rad == 166f ? pGlow : pThin, cx - rad, cy - rad, rad * 2, rad * 2);
                        g.DrawEllipse(rad == 222f || rad == 166f ? pMain : pThin, cx - rad, cy - rad, rad * 2, rad * 2);
                    }

                    // 2 rotated squares (8-point Paladin Star / Octagram)
                    for (int s = 0; s < 2; s++)
                    {
                        float offset = s * (float)(Math.PI / 4.0);
                        PointF[] pts = new PointF[4];
                        for (int i = 0; i < 4; i++)
                        {
                            double a = offset + i * Math.PI * 0.5;
                            pts[i] = new PointF(cx + (float)Math.Cos(a) * 165f, cy + (float)Math.Sin(a) * 165f);
                        }
                        g.DrawPolygon(pGlow, pts);
                        g.DrawPolygon(pMain, pts);
                    }

                    // 16 geometric paladin rune glyphs & diamond notches between r=166 and r=206
                    using (var br = new SolidBrush(Color.FromArgb(240, 255, 255, 255)))
                    {
                        for (int i = 0; i < 16; i++)
                        {
                            double a = i * (Math.PI * 2.0 / 16.0);
                            float cos = (float)Math.Cos(a), sin = (float)Math.Sin(a);
                            float tx = -sin, ty = cos;

                            // Radial tick
                            g.DrawLine(pThin, cx + cos * 206f, cy + sin * 206f, cx + cos * 222f, cy + sin * 222f);

                            // Alternating diamond & cross rune in the rune band (r=186)
                            float rx = cx + cos * 186f;
                            float ry = cy + sin * 186f;
                            if (i % 2 == 0)
                            {
                                PointF[] dia = {
                                    new PointF(rx + cos * 11f, ry + sin * 11f),
                                    new PointF(rx + tx * 6f,  ry + ty * 6f),
                                    new PointF(rx - cos * 11f, ry - sin * 11f),
                                    new PointF(rx - tx * 6f,  ry - ty * 6f)
                                };
                                g.FillPolygon(br, dia);
                            }
                            else
                            {
                                // Stylized rune chevron / cross
                                g.DrawLine(pMain, rx - cos * 9f, ry - sin * 9f, rx + cos * 9f, ry + sin * 9f);
                                g.DrawLine(pThin, rx - tx * 7f, ry - ty * 7f, rx + tx * 7f, ry + ty * 7f);
                                g.DrawLine(pThin, rx + cos * 3f - tx * 6f, ry + sin * 3f - ty * 6f, rx + cos * 10f, ry + sin * 10f);
                                g.DrawLine(pThin, rx + cos * 3f + tx * 6f, ry + sin * 3f + ty * 6f, rx + cos * 10f, ry + sin * 10f);
                            }
                        }

                        // Central Knight Radiant Cross Crest
                        PointF[] crossH = {
                            new PointF(cx - 72f, cy), new PointF(cx, cy - 11f),
                            new PointF(cx + 72f, cy), new PointF(cx, cy + 11f)
                        };
                        PointF[] crossV = {
                            new PointF(cx, cy - 72f), new PointF(cx + 11f, cy),
                            new PointF(cx, cy + 72f), new PointF(cx - 11f, cy)
                        };
                        g.FillPolygon(br, crossH);
                        g.FillPolygon(br, crossV);
                    }
                }
            });

            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void GenerateHexAegisShield(string path)
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
                    // Pointy-top regular hexagon distance metric (matches vertices at -PI/2 + i*PI/3, R=212/256=0.828)
                    double ax = Math.Abs(nx);
                    double ay = Math.Abs(ny);
                    double hexD = Math.Max(ay * 0.8660254 + ax * 0.5, ax) / 0.8660254;

                    double inside = 1.0 - SmoothStep(0.81, 0.85, hexD);
                    double rimGlow = Math.Exp(-Math.Pow((hexD - 0.828) * 24.0, 2.0));
                    double innerRim = Math.Exp(-Math.Pow((hexD - 0.672) * 28.0, 2.0)) * 0.55;

                    // Honeycomb internal grid pattern
                    double gx = nx * 5.5;
                    double gy = ny * 5.5;
                    double cellX = Math.Abs(((gx % 1.0) + 1.5) % 1.0 - 0.5);
                    double cellY = Math.Abs(((gy % 1.0) + 1.5) % 1.0 - 0.5);
                    double gridLine = SmoothStep(0.41, 0.49, Math.Max(cellX * 0.866 + cellY * 0.5, cellY));

                    double fill = inside * (0.20 + 0.28 * gridLine + 0.25 * Math.Exp(-hexD * hexD * 3.0));
                    double a = Clamp01(fill + rimGlow * 1.1 + innerRim);

                    int idx = (y * SIZE + x) * 4;
                    buf[idx + 0] = 255;
                    buf[idx + 1] = 250;
                    buf[idx + 2] = 240;
                    buf[idx + 3] = (byte)(a * 255.0);
                }
            }
            Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            bmp.UnlockBits(data);

            AddGlowOverlay(bmp, g =>
            {
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;
                PointF[] outerHex = new PointF[6];
                PointF[] innerHex = new PointF[6];
                for (int i = 0; i < 6; i++)
                {
                    double a = i * Math.PI / 3.0 - Math.PI / 2.0;
                    outerHex[i] = new PointF(cx + (float)Math.Cos(a) * 212f, cy + (float)Math.Sin(a) * 212f);
                    innerHex[i] = new PointF(cx + (float)Math.Cos(a) * 172f, cy + (float)Math.Sin(a) * 172f);
                }

                using (var pGlow = new Pen(Color.FromArgb(120, 240, 250, 255), 14f))
                using (var pSharp = new Pen(Color.FromArgb(250, 255, 255, 255), 4.5f))
                using (var pMid = new Pen(Color.FromArgb(200, 245, 252, 255), 2.5f))
                using (var br = new SolidBrush(Color.FromArgb(245, 255, 255, 255)))
                {
                    g.DrawPolygon(pGlow, outerHex);
                    g.DrawPolygon(pSharp, outerHex);
                    g.DrawPolygon(pMid, innerHex);

                    // Radial struts connecting inner & outer hex vertices
                    for (int i = 0; i < 6; i++)
                    {
                        g.DrawLine(pMid, innerHex[i], outerHex[i]);
                    }

                    // Stylized Paladin Kite Shield Crest in the center
                    PointF[] crest = {
                        new PointF(cx, cy - 86f),
                        new PointF(cx + 66f, cy - 54f),
                        new PointF(cx + 54f, cy + 28f),
                        new PointF(cx, cy + 94f),
                        new PointF(cx - 54f, cy + 28f),
                        new PointF(cx - 66f, cy - 54f)
                    };
                    g.DrawPolygon(pGlow, crest);
                    g.DrawPolygon(pSharp, crest);

                    // Bright Cross inside crest
                    g.FillRectangle(br, cx - 7f, cy - 56f, 14f, 114f);
                    g.FillRectangle(br, cx - 44f, cy - 18f, 88f, 14f);
                }
            });

            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void GenerateLionCrestRoar(string path)
    {
        SavePixelFunc(path, (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double edge = 1.0 - SmoothStep(0.86, 0.99, r);

            // 12 bold Lion-Mane solar flame spikes around the crest!
            double maneWave = Math.Pow(0.5 + 0.5 * Math.Cos(ang * 12.0), 2.4);
            double subMane = Math.Pow(0.5 + 0.5 * Math.Cos(ang * 24.0 + Math.PI), 3.0) * 0.45;
            double spikeOuter = 0.52 + 0.40 * maneWave + 0.14 * subMane;
            double spikeInner = 0.34;

            double n = Fbm(Math.Cos(ang) * 4.5 + r * 3.0, Math.Sin(ang) * 4.5 + r * 3.0, 3);
            double maneBody = SmoothStep(spikeInner - 0.05, spikeInner + 0.06, r)
                            * (1.0 - SmoothStep(spikeOuter - 0.08, spikeOuter + 0.04, r))
                            * (0.65 + 0.45 * n);

            // Concentric roaring sonic rings
            double sonicOuter = Math.Exp(-Math.Pow((r - 0.80) * 24.0, 2.0)) * (0.75 + 0.25 * maneWave);
            double sonicMid = Math.Exp(-Math.Pow((r - 0.44) * 28.0, 2.0));

            // Radiant center sunburst core
            double core = Math.Exp(-r * r * 14.0) * 0.95;

            double val = (maneBody * 0.92 + sonicOuter * 0.95 + sonicMid * 0.85 + core) * edge;
            return new double[] { 1.0, 0.97, 0.90, Clamp01(val) };
        });
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies @("System.Drawing")
[KnightVfxTexGen]::GenerateAll($OutDir)

Write-Host "Generated Knight VFX textures in: $OutDir"
Get-ChildItem $OutDir -Filter "*.png" | Select-Object Name, Length
