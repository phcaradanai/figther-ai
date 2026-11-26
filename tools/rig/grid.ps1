param([string]$In, [string]$Out, [string]$AxisLabel = 'X', [double]$PxPerM = 400, [double]$CenterZ = 0.95)
Add-Type -AssemblyName System.Drawing
$img = [System.Drawing.Bitmap]::FromFile($In)
$bmp = New-Object System.Drawing.Bitmap $img.Width, $img.Height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, 0, 0, $img.Width, $img.Height); $img.Dispose()
$font = New-Object System.Drawing.Font 'Segoe UI', 8
$minor = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(70, 0, 120, 255)), 1
$major = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(150, 255, 0, 0)), 1
$cx = $bmp.Width / 2; $cy = $bmp.Height / 2
for ($i = -10; $i -le 10; $i++) {
  $v = $i / 10.0
  $x = $cx + $v * $PxPerM
  $pen = if ($i % 5 -eq 0) { $major } else { $minor }
  $g.DrawLine($pen, [single]$x, 0, [single]$x, $bmp.Height)
  $g.DrawString(("{0}{1:0.0}" -f $AxisLabel, $v), $font, [System.Drawing.Brushes]::Blue, [single]($x + 1), 2)
}
for ($i = 0; $i -le 20; $i++) {
  $z = $i / 10.0
  $y = $cy - ($z - $CenterZ) * $PxPerM
  $pen = if ($i % 5 -eq 0) { $major } else { $minor }
  $g.DrawLine($pen, 0, [single]$y, $bmp.Width, [single]$y)
  $g.DrawString(("z{0:0.0}" -f $z), $font, [System.Drawing.Brushes]::Red, 2, [single]($y - 12))
}
$bmp.Save($Out); $g.Dispose(); $bmp.Dispose()
"saved $Out"
