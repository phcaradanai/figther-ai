# ============================================================================
# LOST SAGA 3D - NECRO GRIM REAPER (REAPER) 512x512 VFX TEXTURE GENERATOR
# ============================================================================
# Generates 10 crisp 512x512 RGBA PNGs in public/assets/vfx/reaper/textures/
# using compiled C# System.Drawing + procedural pixel shaders (~1 sec total!):
#   1. reaper_necro_circle.png   - Gothic occult summoning circle & scythe runes
#   2. scythe_reap_arc.png       - Barbed grim scythe crescent blade sweep
#   3. abyssal_chain_beam.png    - Forged spiky underworld soul chain column
#   4. phantom_skull_emblem.png  - Cursed blazing phantom reaper skull
#   5. grave_portal_seal.png     - Cracked abyssal hell-gate rift & chain ring
#   6. soul_vortex_column.png    - Seamless horizontal-wrap wraith soul tornado
#   7. wraith_mist_cloud.png     - Billowing spectral ectoplasm mist cloud
#   8. wraith_soul_ring.png      - Barbed spectral shockwave halo ring
#   9. soul_harvest_flare.png    - 8-point dark-soul scythe starburst flare
#  10. soul_ember.png            - Drifting ghostly soul flame wisp particle
# ============================================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\public\assets\vfx\reaper\textures'))
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$csharp = @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class ReaperVfxTexGen {
  const int SIZE = 512;
  const double HALF = 256.0;

  static byte ClampByte(double v) {
    if (v <= 0.0) return 0;
    if (v >= 255.0) return 255;
    return (byte)Math.Round(v);
  }

  static double Clamp01(double v) {
    if (v <= 0.0) return 0.0;
    if (v >= 1.0) return 1.0;
    return v;
  }

  static double Smoothstep(double e0, double e1, double x) {
    double t = Clamp01((x - e0) / (e1 - e0));
    return t * t * (3.0 - 2.0 * t);
  }

  static Bitmap NewCanvas(out Graphics g) {
    var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb);
    g = Graphics.FromImage(bmp);
    g.SmoothingMode = SmoothingMode.AntiAlias;
    g.InterpolationMode = InterpolationMode.HighQualityBicubic;
    g.PixelOffsetMode = PixelOffsetMode.HighQuality;
    g.Clear(Color.FromArgb(0, 0, 0, 0));
    return bmp;
  }

  static void SaveShader(string path, Action<double, double, int, int, byte[], int> fn) {
    var bmp = new Bitmap(SIZE, SIZE, PixelFormat.Format32bppArgb);
    var rect = new Rectangle(0, 0, SIZE, SIZE);
    var data = bmp.LockBits(rect, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    byte[] bytes = new byte[SIZE * SIZE * 4];
    for (int y = 0; y < SIZE; y++) {
      double ny = (y - HALF + 0.5) / HALF;
      int rowOff = y * SIZE * 4;
      for (int x = 0; x < SIZE; x++) {
        double nx = (x - HALF + 0.5) / HALF;
        fn(nx, ny, x, y, bytes, rowOff + x * 4);
      }
    }
    Marshal.Copy(bytes, 0, data.Scan0, bytes.Length);
    bmp.UnlockBits(data);
    bmp.Save(path, ImageFormat.Png);
    bmp.Dispose();
  }

  static void SetPx(byte[] buf, int idx, double r, double g, double b, double a) {
    buf[idx + 0] = ClampByte(b);
    buf[idx + 1] = ClampByte(g);
    buf[idx + 2] = ClampByte(r);
    buf[idx + 3] = ClampByte(a);
  }

  public static void GenerateAll(string outDir) {
    // 1. reaper_necro_circle.png
    {
      Graphics g;
      using (var bmp = NewCanvas(out g)) {
        for (int i = 10; i >= 1; i--) {
          float rad = 236f - i * 5f;
          int al = 10 + (11 - i) * 4;
          using (var p = new Pen(Color.FromArgb(al, 232, 180, 255), 12f + i * 1.4f))
            g.DrawEllipse(p, (float)HALF - rad, (float)HALF - rad, rad * 2f, rad * 2f);
        }
        float[] rR = { 234f, 216f, 178f, 166f, 102f, 54f };
        float[] rW = { 6.5f, 2.8f, 5.0f, 2.2f, 4.2f, 3.0f };
        Color[] rC = {
          Color.FromArgb(245, 255, 240, 255), Color.FromArgb(215, 232, 175, 255),
          Color.FromArgb(245, 255, 245, 255), Color.FromArgb(190, 224, 165, 255),
          Color.FromArgb(240, 255, 242, 255), Color.FromArgb(225, 245, 210, 255)
        };
        for (int k = 0; k < rR.Length; k++) {
          using (var p = new Pen(rC[k], rW[k]))
            g.DrawEllipse(p, (float)HALF - rR[k], (float)HALF - rR[k], rR[k] * 2f, rR[k] * 2f);
        }
        using (var penRune = new Pen(Color.FromArgb(235, 252, 232, 255), 3.0f)) {
          penRune.StartCap = LineCap.Round;
          penRune.EndCap = LineCap.Round;
          for (int i = 0; i < 24; i++) {
            double a = i * Math.PI * 2.0 / 24.0;
            double ca = Math.Cos(a), sa = Math.Sin(a), ta = -sa, tb = ca;
            float x0 = (float)(HALF + ca * 183), y0 = (float)(HALF + sa * 183);
            float x1 = (float)(HALF + ca * 211), y1 = (float)(HALF + sa * 211);
            g.DrawLine(penRune, x0, y0, x1, y1);
            float xm = (float)(HALF + ca * 197), ym = (float)(HALF + sa * 197);
            if (i % 2 == 0) {
              g.DrawLine(penRune, (float)(xm - ta * 8), (float)(ym - tb * 8), (float)(xm + ta * 8), (float)(ym + tb * 8));
              g.DrawLine(penRune, x1, y1, (float)(xm + ta * 9), (float)(ym + tb * 9));
            } else {
              g.DrawLine(penRune, x0, y0, (float)(xm - ta * 8), (float)(ym - tb * 8));
              g.DrawLine(penRune, x1, y1, (float)(xm + ta * 8), (float)(ym + tb * 8));
            }
          }
        }
        using (var penGlow = new Pen(Color.FromArgb(115, 224, 155, 255), 11f))
        using (var penCore = new Pen(Color.FromArgb(250, 255, 245, 255), 4.2f)) {
          double[] offs = { 0.0, Math.PI / 3.0 };
          foreach (double off in offs) {
            PointF[] pts = new PointF[3];
            for (int k = 0; k < 3; k++) {
              double ang = off + k * (Math.PI * 2.0 / 3.0) - Math.PI * 0.5;
              pts[k] = new PointF((float)(HALF + Math.Cos(ang) * 174), (float)(HALF + Math.Sin(ang) * 174));
            }
            g.DrawPolygon(penGlow, pts);
            g.DrawPolygon(penCore, pts);
          }
        }
        using (var brSpike = new SolidBrush(Color.FromArgb(245, 255, 240, 255))) {
          for (int k = 0; k < 6; k++) {
            double ang = k * Math.PI / 3.0 - Math.PI * 0.5;
            double ca = Math.Cos(ang), sa = Math.Sin(ang), ta = -sa, tb = ca;
            PointF[] poly = {
              new PointF((float)(HALF + ca * 212), (float)(HALF + sa * 212)),
              new PointF((float)(HALF + ca * 248 + ta * 6), (float)(HALF + sa * 248 + tb * 6)),
              new PointF((float)(HALF + ca * 238 + ta * 26), (float)(HALF + sa * 238 + tb * 26)),
              new PointF((float)(HALF + ca * 228 + ta * 10), (float)(HALF + sa * 228 + tb * 10))
            };
            g.FillPolygon(brSpike, poly);
          }
          PointF[] cPts = new PointF[8];
          for (int k = 0; k < 8; k++) {
            double ang = k * Math.PI / 4.0;
            double rr = (k % 2 == 0) ? 42.0 : 18.0;
            cPts[k] = new PointF((float)(HALF + Math.Cos(ang) * rr), (float)(HALF + Math.Sin(ang) * rr));
          }
          g.FillPolygon(brSpike, cPts);
        }
        g.Dispose();
        bmp.Save(Path.Combine(outDir, "reaper_necro_circle.png"), ImageFormat.Png);
      }
      Console.WriteLine("  Generated: reaper_necro_circle.png");
    }

    // 2. scythe_reap_arc.png - Wicked Barbed Grim Scythe Crescent Sweep
    SaveShader(Path.Combine(outDir, "scythe_reap_arc.png"), (nx, ny, px, py, buf, idx) => {
      double r = Math.Sqrt(nx * nx + ny * ny);
      if (r < 0.12 || r > 0.99) return;
      double ang = Math.Atan2(ny, nx);
      double normAng = (ang + 0.15) / 2.25;
      if (normAng < -1.0 || normAng > 1.0) return;

      double arcEnv = Smoothstep(-1.0, -0.25, normAng);
      double tipTaper = 1.0 - Smoothstep(0.55, 1.0, normAng);
      double env = arcEnv * tipTaper;

      double outerR = 0.93 - 0.12 * normAng * normAng;
      double bladeWidth = 0.34 * Math.Pow(Math.Max(0.0, Math.Sin(((normAng + 1.0) * 0.5) * Math.PI)), 0.72);
      double barb = 0.08 * Math.Exp(-Math.Pow((normAng - 0.42) / 0.14, 2.0));
      double innerR = outerR - bladeWidth - barb;
      if (r > outerR + 0.04 || r < innerR - 0.18) return;

      double u = (r - innerR) / Math.Max(0.04, outerR - innerR);
      double outerEdge = Math.Exp(-Math.Pow((r - (outerR - 0.02)) / 0.032, 2.0));
      double streak = 0.65 + 0.35 * Math.Sin(ang * 19.0 + r * 16.0) * Math.Cos(r * 28.0 - ang * 7.0);
      double body = Smoothstep(-0.15, 0.35, u) * (1.0 - Smoothstep(0.94, 1.04, u)) * streak;
      double wisp = 0.0;
      if (u < 0.35 && u > -0.45) {
        double w = (0.5 + 0.5 * Math.Sin(ang * 29.0 + r * 22.0)) * (0.5 + 0.5 * Math.Sin(ang * 13.0 - r * 14.0));
        wisp = w * Smoothstep(-0.45, 0.15, u) * 0.55;
      }
      double alpha = Clamp01((outerEdge * 1.1 + body * 0.85 + wisp * 0.75) * env * 1.15);
      double core = Clamp01(outerEdge * env);
      SetPx(buf, idx, 235 + 20 * core, 185 + 70 * core, 248 + 7 * core, alpha * 255.0);
    });
    Console.WriteLine("  Generated: scythe_reap_arc.png");

    // 3. abyssal_chain_beam.png - Forged Spiky Underworld Soul Chain
    {
      Graphics g;
      using (var bmp = NewCanvas(out g)) {
        for (int w = 10; w >= 1; w--) {
          using (var p = new Pen(Color.FromArgb(10 + (11 - w) * 7, 232, 185, 255), w * 11f))
            g.DrawLine(p, 256, 36, 256, 488);
        }
        using (var penOuter = new Pen(Color.FromArgb(245, 240, 210, 255), 14f))
        using (var penInner = new Pen(Color.FromArgb(255, 255, 250, 255), 5.5f))
        using (var brTip = new SolidBrush(Color.FromArgb(255, 255, 248, 255))) {
          PointF[] hookPoly = {
            new PointF(256, 12), new PointF(304, 72), new PointF(278, 62),
            new PointF(286, 98), new PointF(226, 98), new PointF(234, 62), new PointF(208, 72)
          };
          g.FillPolygon(brTip, hookPoly);

          for (int i = 0; i < 7; i++) {
            float cy = 104 + i * 56;
            if (i % 2 == 0) {
              var rect = new RectangleF(224, cy - 24, 64, 58);
              g.DrawEllipse(penOuter, rect);
              g.DrawEllipse(penInner, rect);
              g.FillPolygon(brTip, new[] { new PointF(220, cy + 5), new PointF(196, cy - 8), new PointF(214, cy + 16) });
              g.FillPolygon(brTip, new[] { new PointF(292, cy + 5), new PointF(316, cy - 8), new PointF(298, cy + 16) });
            } else {
              g.DrawLine(penOuter, 256, cy - 28, 256, cy + 28);
              g.DrawLine(penInner, 256, cy - 28, 256, cy + 28);
            }
          }
        }
        using (var penWisp = new Pen(Color.FromArgb(145, 244, 210, 255), 5.0f)) {
          for (int s = 0; s < 2; s++) {
            PointF[] pts = new PointF[26];
            double phase = s * Math.PI;
            for (int k = 0; k < 26; k++) {
              double t = k / 25.0;
              double yy = 45.0 + t * 435.0;
              double xx = 256.0 + Math.Sin(t * Math.PI * 4.5 + phase) * (54.0 * Math.Sin(t * Math.PI));
              pts[k] = new PointF((float)xx, (float)yy);
            }
            g.DrawCurve(penWisp, pts);
          }
        }
        g.Dispose();
        bmp.Save(Path.Combine(outDir, "abyssal_chain_beam.png"), ImageFormat.Png);
      }
      Console.WriteLine("  Generated: abyssal_chain_beam.png");
    }

    // 4. phantom_skull_emblem.png - Fierce Blazing Phantom Reaper Skull
    {
      Graphics g;
      using (var bmp = NewCanvas(out g)) {
        for (int k = 0; k < 14; k++) {
          double ang = -2.65 + k * (2.15 / 13.0) * 2.0;
          double len = 195.0 + 48.0 * Math.Sin(k * 2.3);
          double ca = Math.Cos(ang), sa = Math.Sin(ang), ta = -sa, tb = ca;
          int al = (int)(95 + 65 * (0.5 + 0.5 * Math.Cos(ang + Math.PI * 0.5)));
          using (var br = new SolidBrush(Color.FromArgb(al, 232, 185, 255))) {
            g.FillPolygon(br, new[] {
              new PointF((float)(256 + ta * 26), (float)(260 + tb * 26)),
              new PointF((float)(256 + ca * len), (float)(256 + sa * len)),
              new PointF((float)(256 - ta * 26), (float)(260 - tb * 26))
            });
          }
        }
        for (int i = 8; i >= 1; i--) {
          float rad = 118 + i * 14;
          using (var br = new SolidBrush(Color.FromArgb(12 + (9 - i) * 5, 235, 195, 255)))
            g.FillEllipse(br, 256 - rad, 250 - rad, rad * 2, rad * 2);
        }
        using (var brBone = new SolidBrush(Color.FromArgb(250, 255, 248, 255)))
        using (var penBone = new Pen(Color.FromArgb(240, 224, 170, 255), 8f)) {
          g.FillEllipse(brBone, 146, 114, 220, 198);
          g.DrawEllipse(penBone, 146, 114, 220, 198);
          g.FillPolygon(brBone, new[] {
            new PointF(150, 224), new PointF(132, 272), new PointF(176, 314),
            new PointF(186, 378), new PointF(214, 396), new PointF(298, 396),
            new PointF(326, 378), new PointF(336, 314), new PointF(380, 272), new PointF(362, 224)
          });
        }
        g.CompositingMode = CompositingMode.SourceCopy;
        using (var brCut = new SolidBrush(Color.FromArgb(40, 60, 20, 90)))
        using (var penCut = new Pen(Color.FromArgb(45, 50, 15, 80), 8f)) {
          g.FillPolygon(brCut, new[] { new PointF(174, 212), new PointF(238, 232), new PointF(228, 276), new PointF(172, 260) });
          g.FillPolygon(brCut, new[] { new PointF(338, 212), new PointF(274, 232), new PointF(284, 276), new PointF(340, 260) });
          g.FillPolygon(brCut, new[] { new PointF(256, 268), new PointF(274, 316), new PointF(256, 308), new PointF(238, 316) });
          int[] txs = { 208, 232, 256, 280, 304 };
          foreach (int tx in txs) g.DrawLine(penCut, tx, 342, tx, 398);
          g.DrawLine(penCut, 186, 368, 326, 368);
        }
        g.CompositingMode = CompositingMode.SourceOver;
        using (var brEye = new SolidBrush(Color.FromArgb(255, 255, 255, 255)))
        using (var penCrack = new Pen(Color.FromArgb(180, 140, 80, 180), 4f)) {
          g.FillEllipse(brEye, 198, 236, 22, 22);
          g.FillEllipse(brEye, 292, 236, 22, 22);
          g.DrawLine(penCrack, 256, 126, 256, 186);
          g.DrawLine(penCrack, 236, 154, 276, 154);
        }
        g.Dispose();
        bmp.Save(Path.Combine(outDir, "phantom_skull_emblem.png"), ImageFormat.Png);
      }
      Console.WriteLine("  Generated: phantom_skull_emblem.png");
    }

    // 5. grave_portal_seal.png
    SaveShader(Path.Combine(outDir, "grave_portal_seal.png"), (nx, ny, px, py, buf, idx) => {
      double r = Math.Sqrt(nx * nx + ny * ny);
      if (r > 0.99) return;
      double ang = Math.Atan2(ny, nx);
      double swirl = ang + 2.4 * r;
      double arms = Math.Pow(0.5 + 0.5 * Math.Sin(swirl * 6.0), 3.0) * (1.0 - Smoothstep(0.65, 0.96, r));
      double jitter = 0.08 * Math.Sin(r * 28.0 + ang * 5.0);
      double rayDist = Math.Abs(Math.Sin((ang + jitter) * 6.0));
      double cracks = Math.Exp(-Math.Pow(rayDist / 0.065, 2.0)) * Smoothstep(0.14, 0.30, r) * (1.0 - Smoothstep(0.72, 0.98, r));
      double ringMain = Math.Exp(-Math.Pow((r - 0.83) / 0.036, 2.0));
      double ringInner = Math.Exp(-Math.Pow((r - 0.52) / 0.025, 2.0)) * (0.6 + 0.4 * Math.Sin(ang * 18.0));
      double teeth = Math.Exp(-Math.Pow((r - (0.87 + 0.07 * Math.Max(0.0, Math.Sin(ang * 16.0)))) / 0.028, 2.0));
      double coreGlow = Math.Exp(-Math.Pow(r / 0.32, 2.0)) * (0.72 + 0.28 * Math.Sin(ang * 6.0 + r * 18.0));

      double val = Clamp01(ringMain * 1.15 + ringInner * 0.8 + teeth * 0.95 + cracks * 1.05 + arms * 0.65 + coreGlow * 0.85);
      double edgeFade = 1.0 - Smoothstep(0.90, 0.99, r);
      double alpha = Clamp01(val * edgeFade * 1.12);
      double hot = Clamp01(ringMain * 0.85 + cracks * 0.9 + coreGlow * 0.5);
      SetPx(buf, idx, 232 + 23 * hot, 184 + 71 * hot, 248 + 7 * hot, alpha * 255.0);
    });
    Console.WriteLine("  Generated: grave_portal_seal.png");

    // 6. soul_vortex_column.png
    SaveShader(Path.Combine(outDir, "soul_vortex_column.png"), (nx, ny, px, py, buf, idx) => {
      double u = px / (double)SIZE;
      double v = py / (double)SIZE;
      double tau = Math.PI * 2.0;
      double vEnv = Smoothstep(0.0, 0.20, v) * (1.0 - Smoothstep(0.78, 1.0, v));
      double s1 = Math.Pow(0.5 + 0.5 * Math.Sin(tau * (3.0 * u + 2.4 * v) + 0.5 * Math.Sin(tau * (2.0 * u - 1.5 * v))), 2.6);
      double s2 = Math.Pow(0.5 + 0.5 * Math.Sin(tau * (5.0 * u + 3.6 * v + 0.35)), 3.5);
      double wisps = Math.Pow(0.5 + 0.5 * Math.Cos(tau * (8.0 * u + 4.8 * v)), 4.0) * 0.65;
      double val = Clamp01((s1 * 0.92 + s2 * 0.75 + wisps) * vEnv);
      double hot = Clamp01(s2 * vEnv);
      SetPx(buf, idx, 232 + 23 * hot, 188 + 67 * hot, 248 + 7 * hot, val * 255.0);
    });
    Console.WriteLine("  Generated: soul_vortex_column.png");

    // 7. wraith_mist_cloud.png
    SaveShader(Path.Combine(outDir, "wraith_mist_cloud.png"), (nx, ny, px, py, buf, idx) => {
      double r = Math.Sqrt(nx * nx + ny * ny);
      if (r > 0.99) return;
      double ang = Math.Atan2(ny, nx);
      double angMix = Smoothstep(0.04, 0.36, r);
      double w1 = 0.5 + 0.5 * Math.Sin(nx * 5.2 + ny * 4.1 + 1.3 * angMix * Math.Sin(ang * 3.0 + r * 4.5));
      double w2 = 0.5 + 0.5 * Math.Cos(nx * 9.5 - ny * 8.3 + 1.1 * angMix * Math.Cos(r * 7.0 - ang * 5.0));
      double w3 = 0.5 + 0.5 * Math.Sin(ang * 5.0 + r * 9.0) * angMix;
      double cloud = w1 * 0.52 + w2 * 0.32 + w3 * 0.16;
      double radial = 1.0 - Smoothstep(0.25, 0.96, r);
      double swirlEdge = 0.78 + 0.22 * angMix * Math.Sin(ang * 5.0 + r * 6.0);
      double val = Clamp01(cloud * radial * swirlEdge * 1.42);
      SetPx(buf, idx, 230 + 25 * val, 192 + 63 * val, 248 + 7 * val, val * 245.0);
    });
    Console.WriteLine("  Generated: wraith_mist_cloud.png");

    // 8. wraith_soul_ring.png
    SaveShader(Path.Combine(outDir, "wraith_soul_ring.png"), (nx, ny, px, py, buf, idx) => {
      double r = Math.Sqrt(nx * nx + ny * ny);
      if (r < 0.30 || r > 0.99) return;
      double ang = Math.Atan2(ny, nx);
      double barbMod = 0.045 * Math.Sin(ang * 12.0) + 0.022 * Math.Cos(ang * 24.0);
      double coreRing = Math.Exp(-Math.Pow((r - (0.76 + barbMod * 0.4)) / 0.042, 2.0));
      double outerFlames = Math.Exp(-Math.Pow((r - (0.83 + barbMod)) / 0.085, 2.0)) * (0.55 + 0.45 * Math.Sin(ang * 18.0 + r * 15.0));
      double innerHalo = Math.Exp(-Math.Pow((r - 0.64) / 0.055, 2.0)) * 0.52;
      double edge = 1.0 - Smoothstep(0.90, 0.99, r);
      double val = Clamp01((coreRing * 1.25 + outerFlames * 0.80 + innerHalo) * edge);
      double hot = Clamp01(coreRing * edge);
      SetPx(buf, idx, 234 + 21 * hot, 192 + 63 * hot, 250 + 5 * hot, val * 255.0);
    });
    Console.WriteLine("  Generated: wraith_soul_ring.png");

    // 9. soul_harvest_flare.png
    SaveShader(Path.Combine(outDir, "soul_harvest_flare.png"), (nx, ny, px, py, buf, idx) => {
      double r = Math.Sqrt(nx * nx + ny * ny);
      if (r > 0.99) return;
      double ang = Math.Atan2(ny, nx);
      double curve = ang + 0.35 * r;
      double ray4 = Math.Pow(Math.Abs(Math.Cos(curve * 2.0)), 14.0) * (1.0 - Smoothstep(0.15, 0.97, r));
      double ray8 = Math.Pow(Math.Abs(Math.Sin(curve * 4.0)), 18.0) * (1.0 - Smoothstep(0.10, 0.78, r)) * 0.75;
      double core = Math.Exp(-Math.Pow(r / 0.22, 2.0));
      double halo = Math.Exp(-Math.Pow(r / 0.46, 2.0)) * 0.42;
      double val = Clamp01(core * 1.3 + ray4 * 1.15 + ray8 + halo);
      double hot = Clamp01(core + ray4 * 0.7);
      SetPx(buf, idx, 236 + 19 * hot, 194 + 61 * hot, 250 + 5 * hot, val * 255.0);
    });
    Console.WriteLine("  Generated: soul_harvest_flare.png");

    // 10. soul_ember.png
    SaveShader(Path.Combine(outDir, "soul_ember.png"), (nx, ny, px, py, buf, idx) => {
      double headDist = Math.Sqrt((nx * 2.15) * (nx * 2.15) + ((ny + 0.24) * 1.65) * ((ny + 0.24) * 1.65));
      double head = Math.Exp(-headDist * headDist * 2.6);
      double tail = 0.0;
      if (ny > -0.45 && ny < 0.96) {
        double t = Clamp01((ny + 0.26) / 1.22);
        double topBlend = Smoothstep(-0.42, 0.04, ny);
        double w = 0.36 * (1.0 - t * 0.84);
        double waveX = nx - 0.10 * Math.Sin(t * 7.5) * t;
        tail = Math.Exp(-Math.Pow(waveX / Math.Max(0.04, w), 2.0)) * (1.0 - t) * topBlend * 0.95;
      }
      double val = Clamp01(head * 1.25 + tail);
      double hot = Clamp01(head);
      SetPx(buf, idx, 236 + 19 * hot, 200 + 55 * hot, 250 + 5 * hot, val * 255.0);
    });
    Console.WriteLine("  Generated: soul_ember.png");
  }
}
'@

Write-Host "Compiling & generating 10 Necro Grim Reaper 512x512 VFX textures..."
Add-Type -TypeDefinition $csharp -ReferencedAssemblies 'System.Drawing'
[ReaperVfxTexGen]::GenerateAll($outDir)
Write-Host "Done! All 10 Necro Grim Reaper 512x512 PNG textures saved to $outDir"
