# ============================================================================
# LOST SAGA 3D - SHADOW NINJA EFFEKSEER VFX TEXTURE GENERATOR (512x512 RGBA PNG)
# ============================================================================
# Generates 10 crisp, high-contrast shinobi VFX textures into:
#   public/assets/vfx/ninja/textures/
# Run: powershell -ExecutionPolicy Bypass -File tools/generate_ninja_vfx_textures.ps1
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\ninja\textures")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$csCode = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class NinjaVfxTexGen
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
            freq *= 2.04;
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
        // 1. kunai_slash.png - Razor-thin, ultra-fast double-edged shinobi kunai crescent
        SavePixelFunc(System.IO.Path.Combine(outDir, "kunai_slash.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double maxAng = 2.38; // wide whip-fast 272-deg arc
            double normAng = Math.Abs(ang) / maxAng;
            if (normAng >= 1.0) return new double[] { 0, 0, 0, 0 };

            double tipTaper = Math.Pow(Math.Cos(normAng * Math.PI * 0.5), 1.45);
            double outerR = 0.89 - 0.04 * normAng * normAng;
            double innerR = outerR - 0.25 * tipTaper;

            double fbm = Fbm(ang * 5.2 + 2.0, r * 11.0 + 3.0, 4);
            double razor = Math.Exp(-Math.Pow((r - (outerR - 0.014)) * 36.0, 2.0)) * tipTaper;
            double secondBlade = Math.Exp(-Math.Pow((r - (outerR - 0.095 * tipTaper)) * 34.0, 2.0)) * tipTaper * 0.72;

            double bodyT = Clamp01((r - innerR) / Math.Max(0.01, outerR - innerR));
            double body = SmoothStep(0.0, 0.3, bodyT) * (1.0 - SmoothStep(0.92, 1.02, bodyT))
                        * Math.Pow(bodyT, 1.4) * (0.45 + 0.75 * fbm) * tipTaper;

            // Ink-wisp trailing shreds behind the blade
            double wispT = Clamp01((r - (innerR - 0.14)) / 0.16);
            double wisp = SmoothStep(0.0, 0.7, wispT) * (1.0 - SmoothStep(0.75, 1.0, wispT))
                        * Math.Pow(fbm, 1.6) * tipTaper * 0.75;

            double edgeGuard = 1.0 - SmoothStep(0.90, 0.99, r);
            double a = Clamp01((razor * 1.25 + secondBlade + body + wisp) * edgeGuard);
            return new double[] { 0.98, 0.95, 1.0, a };
        });

        // 2. cross_fang.png - Lethal X-Cross Assassination Slash (Backstab & Izuna Storm!)
        SavePixelFunc(System.IO.Path.Combine(outDir, "cross_fang.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double edge = 1.0 - SmoothStep(0.84, 0.99, r);

            // Slash A along +42 deg, Slash B along -42 deg (slightly curved crescent blades)
            double c1 = Math.Cos(0.74), s1 = Math.Sin(0.74);
            double u1 = nx * c1 + ny * s1;
            double v1 = -nx * s1 + ny * c1 - 0.14 * u1 * u1;

            double c2 = Math.Cos(-0.74), s2 = Math.Sin(-0.74);
            double u2 = nx * c2 + ny * s2;
            double v2 = -nx * s2 + ny * c2 + 0.14 * u2 * u2;

            double taper1 = Math.Pow(1.0 - SmoothStep(0.0, 0.92, Math.Abs(u1)), 0.85);
            double taper2 = Math.Pow(1.0 - SmoothStep(0.0, 0.92, Math.Abs(u2)), 0.85);

            double n1 = Fbm(u1 * 5.0 + 3.0, v1 * 9.0 + 1.0, 3);
            double n2 = Fbm(u2 * 5.0 + 8.0, v2 * 9.0 + 4.0, 3);

            double slash1 = (Math.Exp(-Math.Pow(v1 / Math.Max(0.015, 0.085 * taper1), 2.0))
                          + Math.Exp(-Math.Pow(v1 / Math.Max(0.025, 0.18 * taper1), 2.0)) * 0.45 * (0.5 + 0.7 * n1)) * taper1;
            double slash2 = (Math.Exp(-Math.Pow(v2 / Math.Max(0.015, 0.085 * taper2), 2.0))
                          + Math.Exp(-Math.Pow(v2 / Math.Max(0.025, 0.18 * taper2), 2.0)) * 0.45 * (0.5 + 0.7 * n2)) * taper2;

            // Impact flash core at center X intersection
            double core = Math.Exp(-r * r * 18.0) * 1.1;
            double a = Clamp01((Math.Max(slash1, slash2) * 1.15 + Math.Min(slash1, slash2) * 0.5 + core) * edge);
            return new double[] { 1.0, 0.96, 1.0, a };
        });

        // 3. shadow_smoke.png - Lush painterly sumi-e billowing ninja smoke cloud puff
        SavePixelFunc(System.IO.Path.Combine(outDir, "shadow_smoke.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);

            // Multi-lobe billowing cloud contour
            double nLow = Fbm(nx * 2.4 + 4.2, ny * 2.4 + 1.8, 4);
            double nDetail = Fbm(nx * 5.5 + 9.1, ny * 5.5 + 3.4, 4);
            double swirl = Fbm(Math.Cos(ang) * 1.8 + nx * 2.2 + 5.0, Math.Sin(ang) * 1.8 + ny * 2.2 + 2.0, 3);

            double warpR = r - (nLow - 0.5) * 0.38 - (swirl - 0.5) * 0.18;
            double body = 1.0 - SmoothStep(0.32, 0.86, warpR);
            double edge = 1.0 - SmoothStep(0.82, 0.98, r);

            // Soft volumetric shading inside the cloud puff (brighter billow highlights, deeper creases)
            double shade = 0.62 + 0.38 * Clamp01(nDetail * 1.25 + (1.0 - r) * 0.25);
            double a = Clamp01(Math.Pow(body, 1.15) * (0.72 + 0.45 * nDetail) * edge);
            return new double[] { shade, shade * 0.96, shade * 1.04, a };
        });

        // 4. shadow_vortex.png - Seamless horizontal swirling ninja shadow-wind ink ribbon
        SavePixelFunc(System.IO.Path.Combine(outDir, "shadow_vortex.png"), (nx, ny) =>
        {
            double u = (nx + 1.0) * 0.5;
            double theta = u * Math.PI * 2.0;
            // Diagonal slash-like wind filaments wrapping seamlessly around U
            double n1 = Fbm(Math.Cos(theta) * 3.2 + ny * 2.0 + 4.0, Math.Sin(theta) * 3.2 + ny * 5.0 + 1.0, 4);
            double n2 = Fbm(Math.Cos(theta * 2.0) * 4.0 + 7.5, Math.Sin(theta * 2.0) * 4.0 + ny * 8.0, 3);

            double yDist = Math.Abs(ny);
            double vFade = 1.0 - SmoothStep(0.05, 0.96, yDist);
            double sharpBand = Math.Exp(-Math.Pow((yDist - 0.12) * 11.0, 2.0)) * (0.55 + 0.65 * n1);
            double outerStreak = Math.Exp(-Math.Pow((yDist - 0.44) * 14.0, 2.0)) * (0.35 + 0.85 * n2) * 0.72;
            double core = Math.Exp(-yDist * yDist * 22.0) * 0.9;

            double val = (core + sharpBand + outerStreak) * Math.Pow(vFade, 0.85) * (1.0 - SmoothStep(0.88, 0.99, yDist));
            return new double[] { 0.98, 0.94, 1.0, Clamp01(val) };
        });

        // 5. shadow_ring.png - Sharp jagged shinobi sonic/smoke shockwave ring
        SavePixelFunc(System.IO.Path.Combine(outDir, "shadow_ring.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double edge = 1.0 - SmoothStep(0.86, 0.99, r);

            double n = Fbm(Math.Cos(ang) * 5.0 + 3.0, Math.Sin(ang) * 5.0 + r * 4.5, 4);
            double jagged = 0.035 * Math.Sin(ang * 16.0) * (0.5 + 0.5 * n);

            double rim = Math.Exp(-Math.Pow((r - (0.78 + jagged)) * 28.0, 2.0));
            double innerBand = SmoothStep(0.46, 0.77, r) * (1.0 - SmoothStep(0.79, 0.87, r)) * (0.45 + 0.75 * n);
            double secondary = Math.Exp(-Math.Pow((r - 0.58) * 32.0, 2.0)) * 0.45;

            double a = Clamp01((rim * 1.1 + innerBand + secondary) * edge);
            return new double[] { 0.98, 0.95, 1.0, a };
        });

        // 6. crimson_flare.png - Sharp 6-spike assassin hit & explosion starburst flare
        SavePixelFunc(System.IO.Path.Combine(outDir, "crimson_flare.png"), (nx, ny) =>
        {
            double r = Math.Sqrt(nx * nx + ny * ny);
            double ang = Math.Atan2(ny, nx);
            double edge = 1.0 - SmoothStep(0.74, 0.98, r);

            double rayH = Math.Pow(Math.Abs(Math.Cos(ang)), 38.0) * Math.Exp(-r * 1.8) * 1.25; // wide anime horizontal slash flash!
            double rayV = Math.Pow(Math.Abs(Math.Sin(ang)), 28.0) * Math.Exp(-r * 3.0) * 0.85;
            double rayDiag = Math.Pow(Math.Abs(Math.Sin(ang * 2.0)), 24.0) * Math.Exp(-r * 3.6) * 0.75;
            double core = Math.Exp(-r * r * 20.0);
            double halo = Math.Exp(-r * r * 5.0) * 0.42;

            double a = Clamp01((core + rayH + rayV + rayDiag + halo) * edge);
            return new double[] { 1.0, 0.96, 0.98, a };
        });

        // 7. kunai_spark.png - Razor kunai-needle shadow spark
        SavePixelFunc(System.IO.Path.Combine(outDir, "kunai_spark.png"), (nx, ny) =>
        {
            // Sharp diamond kunai head + long tapered needle tail
            double ax = Math.Abs(nx) * 4.4;
            double ay = ny < 0 ? Math.Abs(ny) * 1.45 : Math.Abs(ny) * 0.95;
            double d = Math.Pow(ax, 1.25) + Math.Pow(ay, 1.45);
            double core = Math.Exp(-d * 5.2);
            double halo = Math.Exp(-(nx * nx * 20.0 + ny * ny * 2.5) * 1.5) * 0.5;
            double edgeFade = 1.0 - SmoothStep(0.84, 0.99, Math.Max(Math.Abs(nx), Math.Abs(ny)));
            return new double[] { 1.0, 0.96, 1.0, Clamp01((core + halo) * edgeFade) };
        });

        // 8. shinobi_seal.png - Japanese Kuji-In / Mitsudomoe Shinobi Shadow Magic Circle
        GenerateShinobiSeal(System.IO.Path.Combine(outDir, "shinobi_seal.png"));

        // 9. shuriken_glint.png - Giant 4-blade Fuuma Shuriken with spinning speed ring
        GenerateShurikenGlint(System.IO.Path.Combine(outDir, "shuriken_glint.png"));

        // 10. paper_talisman.png - Japanese Shinobi Explosive Paper Tag (Kibaku Fuda)
        GeneratePaperTalisman(System.IO.Path.Combine(outDir, "paper_talisman.png"));
    }

    private static void GenerateShinobiSeal(string path)
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
                    double r = Math.Sqrt(nx * nx + ny * ny);
                    double outerGlow = Math.Exp(-Math.Pow((r - 0.85) * 15.0, 2.0)) * 0.55;
                    double midGlow = Math.Exp(-Math.Pow((r - 0.58) * 14.0, 2.0)) * 0.35;
                    double coreGlow = Math.Exp(-r * r * 6.0) * 0.3;
                    double edge = 1.0 - SmoothStep(0.90, 0.99, r);
                    double a = Clamp01((outerGlow + midGlow + coreGlow) * edge);
                    int idx = (y * SIZE + x) * 4;
                    buf[idx + 0] = 255;
                    buf[idx + 1] = 240;
                    buf[idx + 2] = 250;
                    buf[idx + 3] = (byte)(a * 255.0);
                }
            }
            Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            bmp.UnlockBits(data);

            DrawOnBitmap(bmp, g =>
            {
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;
                using (var pGlow = new Pen(Color.FromArgb(120, 250, 235, 255), 11f))
                using (var pMain = new Pen(Color.FromArgb(250, 255, 255, 255), 4.2f))
                using (var pThin = new Pen(Color.FromArgb(220, 245, 235, 255), 2.2f))
                using (var br = new SolidBrush(Color.FromArgb(245, 255, 255, 255)))
                {
                    float[] radii = { 222f, 206f, 152f, 138f, 62f };
                    foreach (float rad in radii)
                    {
                        g.DrawEllipse(rad == 222f || rad == 152f ? pGlow : pThin, cx - rad, cy - rad, rad * 2, rad * 2);
                        g.DrawEllipse(rad == 222f || rad == 152f ? pMain : pThin, cx - rad, cy - rad, rad * 2, rad * 2);
                    }

                    // 2 interlocking equilateral triangles (6-point Shinobi Seal Hexagram)
                    for (int t = 0; t < 2; t++)
                    {
                        double offset = t * Math.PI / 3.0 - Math.PI / 2.0;
                        PointF[] tri = new PointF[3];
                        for (int i = 0; i < 3; i++)
                        {
                            double a = offset + i * (Math.PI * 2.0 / 3.0);
                            tri[i] = new PointF(cx + (float)Math.Cos(a) * 150f, cy + (float)Math.Sin(a) * 150f);
                        }
                        g.DrawPolygon(pGlow, tri);
                        g.DrawPolygon(pMain, tri);
                    }

                    // 9 Kuji-In seal kunai-darts & kanji-inspired seal ticks around the outer band (r=178)
                    for (int i = 0; i < 12; i++)
                    {
                        double a = i * (Math.PI * 2.0 / 12.0);
                        float cos = (float)Math.Cos(a), sin = (float)Math.Sin(a);
                        float tx = -sin, ty = cos;
                        float rx = cx + cos * 179f, ry = cy + sin * 179f;

                        // Outer spoke notch
                        g.DrawLine(pMain, cx + cos * 206f, cy + sin * 206f, cx + cos * 222f, cy + sin * 222f);

                        if (i % 2 == 0)
                        {
                            // Sharp kunai dart pointing outward
                            PointF[] kunai = {
                                new PointF(rx + cos * 18f, ry + sin * 18f),
                                new PointF(rx + tx * 7f, ry + ty * 7f),
                                new PointF(rx - cos * 10f, ry - sin * 10f),
                                new PointF(rx - tx * 7f, ry - ty * 7f)
                            };
                            g.FillPolygon(br, kunai);
                        }
                        else
                        {
                            // Kuji brush-stroke seal bars (3 parallel seal strokes)
                            g.DrawLine(pMain, rx - tx * 11f, ry - ty * 11f, rx + tx * 11f, ry + ty * 11f);
                            g.DrawLine(pThin, rx - cos * 8f - tx * 8f, ry - sin * 8f - ty * 8f, rx - cos * 8f + tx * 8f, ry - sin * 8f + ty * 8f);
                            g.DrawLine(pThin, rx + cos * 8f - tx * 8f, ry + sin * 8f - ty * 8f, rx + cos * 8f + tx * 8f, ry + sin * 8f + ty * 8f);
                            g.DrawLine(pThin, rx - cos * 12f, ry - sin * 12f, rx + cos * 12f, ry + sin * 12f);
                        }
                    }

                    // 3 Swirling Mitsudomoe Tomoe Crests in the center!
                    for (int k = 0; k < 3; k++)
                    {
                        double a = k * (Math.PI * 2.0 / 3.0) - Math.PI / 2.0;
                        float tx = cx + (float)Math.Cos(a) * 34f;
                        float ty = cy + (float)Math.Sin(a) * 34f;
                        g.FillEllipse(br, tx - 14f, ty - 14f, 28f, 28f);
                        // Curved tail arc sweeping clockwise
                        double a2 = a + 0.85;
                        float tailX = cx + (float)Math.Cos(a2) * 44f;
                        float tailY = cy + (float)Math.Sin(a2) * 44f;
                        using (var pTail = new Pen(Color.FromArgb(240, 255, 255, 255), 8f) { StartCap = LineCap.Round, EndCap = LineCap.Triangle })
                        {
                            g.DrawLine(pTail, tx, ty, tailX, tailY);
                        }
                    }
                }
            });

            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void GenerateShurikenGlint(string path)
    {
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            // Radial spinning speed blur backdrop
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
                    double ang = Math.Atan2(ny, nx);
                    double spinRing = Math.Exp(-Math.Pow((r - 0.78) * 14.0, 2.0)) * (0.45 + 0.35 * Math.Sin(ang * 4.0));
                    double innerRing = Math.Exp(-Math.Pow((r - 0.52) * 16.0, 2.0)) * 0.28;
                    double edge = 1.0 - SmoothStep(0.86, 0.99, r);
                    double a = Clamp01((spinRing + innerRing) * edge);
                    int idx = (y * SIZE + x) * 4;
                    buf[idx + 0] = 255; buf[idx + 1] = 242; buf[idx + 2] = 255;
                    buf[idx + 3] = (byte)(a * 255.0);
                }
            }
            Marshal.Copy(buf, 0, data.Scan0, buf.Length);
            bmp.UnlockBits(data);

            DrawOnBitmap(bmp, g =>
            {
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;
                using (var br = new SolidBrush(Color.FromArgb(250, 255, 255, 255)))
                using (var pGlow = new Pen(Color.FromArgb(140, 240, 220, 255), 14f))
                using (var pEdge = new Pen(Color.FromArgb(255, 255, 255, 255), 4f))
                {
                    // 4 sweeping curved Fuuma Shuriken blades!
                    for (int i = 0; i < 4; i++)
                    {
                        double a = i * Math.PI * 0.5;
                        float c = (float)Math.Cos(a), s = (float)Math.Sin(a);
                        float tx = -s, ty = c;
                        PointF[] blade = {
                            new PointF(cx + c * 32f - tx * 16f, cy + s * 32f - ty * 16f),
                            new PointF(cx + c * 118f + tx * 44f, cy + s * 118f + ty * 44f),
                            new PointF(cx + c * 224f + tx * 16f, cy + s * 224f + ty * 16f),
                            new PointF(cx + c * 135f - tx * 14f, cy + s * 135f - ty * 14f),
                            new PointF(cx + c * 42f - tx * 28f, cy + s * 42f - ty * 28f)
                        };
                        g.DrawPolygon(pGlow, blade);
                        g.FillPolygon(br, blade);
                    }
                    // Center hub ring with hollow core
                    g.DrawEllipse(pGlow, cx - 44f, cy - 44f, 88f, 88f);
                    g.DrawEllipse(pEdge, cx - 34f, cy - 34f, 68f, 68f);
                }
            });

            bmp.Save(path, ImageFormat.Png);
        }
    }

    private static void GeneratePaperTalisman(string path)
    {
        using (var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb))
        {
            DrawOnBitmap(bmp, g =>
            {
                float cx = SIZE * 0.5f, cy = SIZE * 0.5f;
                float w = 216f, h = 420f;
                float x0 = cx - w * 0.5f, y0 = cy - h * 0.5f;

                // Soft outer crimson-gold aura glow around talisman rectangle
                for (int k = 6; k >= 1; k--)
                {
                    using (var pAura = new Pen(Color.FromArgb(24, 255, 240, 245), k * 7f))
                    {
                        g.DrawRectangle(pAura, x0 - k * 2, y0 - k * 2, w + k * 4, h + k * 4);
                    }
                }

                // Talisman parchment body (semi-opaque luminous tintable surface)
                using (var brPaper = new SolidBrush(Color.FromArgb(215, 255, 248, 240)))
                using (var pFrame = new Pen(Color.FromArgb(255, 255, 255, 255), 8f))
                using (var pInner = new Pen(Color.FromArgb(240, 255, 255, 255), 3.5f))
                using (var pBrush = new Pen(Color.FromArgb(255, 255, 255, 255), 11f) { StartCap = LineCap.Round, EndCap = LineCap.Round })
                using (var brInk = new SolidBrush(Color.FromArgb(255, 255, 255, 255)))
                {
                    g.FillRectangle(brPaper, x0, y0, w, h);
                    g.DrawRectangle(pFrame, x0 + 6, y0 + 6, w - 12, h - 12);
                    g.DrawRectangle(pInner, x0 + 22, y0 + 22, w - 44, h - 44);

                    // Stylized bold geometric explosive talisman seal ("爆" inspired)
                    // Upper radial explosion crest
                    g.DrawLine(pBrush, cx - 54, y0 + 82, cx + 54, y0 + 82);
                    g.DrawLine(pBrush, cx, y0 + 54, cx, y0 + 178);
                    g.DrawRectangle(pBrush, cx - 44, y0 + 106, 88, 52);
                    g.DrawLine(pInner, cx - 44, y0 + 132, cx + 44, y0 + 132);

                    // Mid seal starburst + diamond
                    g.DrawLine(pBrush, cx - 64, cy + 12, cx + 64, cy + 12);
                    g.DrawLine(pBrush, cx - 48, cy - 12, cx + 48, cy + 48);
                    g.DrawLine(pBrush, cx + 48, cy - 12, cx - 48, cy + 48);

                    // Lower explosive seal zig-zag & ring
                    g.DrawEllipse(pBrush, cx - 40, y0 + 278, 80, 80);
                    g.FillEllipse(brInk, cx - 14, y0 + 304, 28, 28);
                    g.DrawLine(pInner, cx - 62, y0 + 318, cx + 62, y0 + 318);
                }
            });

            bmp.Save(path, ImageFormat.Png);
        }
    }
}
'@

Add-Type -TypeDefinition $csCode -ReferencedAssemblies @("System.Drawing")
[NinjaVfxTexGen]::GenerateAll($OutDir)

Write-Host "Generated Shadow Ninja VFX textures in: $OutDir"
Get-ChildItem $OutDir -Filter "*.png" | Select-Object Name, Length
