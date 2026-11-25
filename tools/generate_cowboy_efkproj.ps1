# ============================================================================
# LOST SAGA 3D - DESPERADO COWBOY EFFEKSEER (.efkproj) VFX SUITE GENERATOR
# ============================================================================
# Generates 7 multi-layered 3D Effekseer project files compatible with
# Effekseer 1.80.8 (GUI & CUI compiler) and EffekseerForWebGL 1.80.8:
#   1. cowboy_basic_shot.efkproj            (Dual Revolver Quickdraw)
#   2. cowboy_heavy_deadeye.efkproj         (Heavy: Deadeye Magnum)
#   3. cowboy_skill_weapon_highnoon.efkproj ([Q/SD] High Noon Barrage)
#   4. cowboy_skill_armor_tnt.efkproj       ([E/ASD] TNT Dynamite Toss)
#   5. cowboy_skill_helmet_rollshot.efkproj ([R/AD] Tactical Roll & Stun Shot)
#   6. cowboy_skill_trinket_lasso.efkproj   ([F/AS] Bounty Hunter Lasso)
#   7. cowboy_mobility_tumble.efkproj       (Double Jump / Tumble Dash)
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\cowboy")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function XmlRange([string]$tag, [double]$center, [double]$spread = 0) {
    $min = [Math]::Round($center - $spread, 4)
    $max = [Math]::Round($center + $spread, 4)
    $c   = [Math]::Round($center, 4)
    return "<$tag><Center>$c</Center><Max>$max</Max><Min>$min</Min></$tag>"
}

function XmlVec3Range([string]$tag, [double]$x, [double]$y, [double]$z, [double]$sx = 0, [double]$sy = 0, [double]$sz = 0) {
    return "<$tag>$(XmlRange 'X' $x $sx)$(XmlRange 'Y' $y $sy)$(XmlRange 'Z' $z $sz)</$tag>"
}

function XmlVec2Range([string]$tag, [double]$x, [double]$y, [double]$sx = 0, [double]$sy = 0) {
    return "<$tag>$(XmlRange 'X' $x $sx)$(XmlRange 'Y' $y $sy)</$tag>"
}

function XmlColorFixed([string]$tag, $r, $g, $b, $a = 255) {
    return "<$tag><R>$r</R><G>$g</G><B>$b</B><A>$a</A></$tag>"
}

function XmlColorEasing([string]$tag, $sr, $sg, $sb, $sa, $er, $eg, $eb, $ea) {
    $s = "<Start>$(XmlRange 'R' $sr 0)$(XmlRange 'G' $sg 0)$(XmlRange 'B' $sb 0)$(XmlRange 'A' $sa 0)</Start>"
    $e = "<End>$(XmlRange 'R' $er 0)$(XmlRange 'G' $eg 0)$(XmlRange 'B' $eb 0)$(XmlRange 'A' $ea 0)</End>"
    return "<$tag>$s$e</$tag>"
}

function XmlCommon(
    [int]$maxGen = 1,
    [int]$life = 30,
    [int]$lifeSpread = 0,
    [double]$genTime = 1,
    [double]$genOffset = 0,
    [int]$locBind = 2,
    [int]$rotBind = 2,
    [int]$scaleBind = 2
) {
    return @"
      <CommonValues>
        <MaxGeneration>
          <Value>$maxGen</Value>
          <Infinite>False</Infinite>
        </MaxGeneration>
        <LocationEffectType>$locBind</LocationEffectType>
        <RotationEffectType>$rotBind</RotationEffectType>
        <ScaleEffectType>$scaleBind</ScaleEffectType>
        $(XmlRange 'Life' $life $lifeSpread)
        $(XmlRange 'GenerationTime' $genTime 0)
        $(XmlRange 'GenerationTimeOffset' $genOffset 0)
      </CommonValues>
"@
}

function XmlLocFixed([double]$x, [double]$y, [double]$z) {
    return @"
      <LocationValues>
        <Type>0</Type>
        <Fixed>
          <Location><X>$x</X><Y>$y</Y><Z>$z</Z></Location>
        </Fixed>
      </LocationValues>
"@
}

function XmlLocPVA([double]$lx, [double]$ly, [double]$lz, [double]$lsx, [double]$lsy, [double]$lsz, [double]$vx, [double]$vy, [double]$vz, [double]$vsx, [double]$vsy, [double]$vsz, [double]$ax = 0, [double]$ay = 0, [double]$az = 0) {
    return @"
      <LocationValues>
        <Type>1</Type>
        <PVA>
          $(XmlVec3Range 'Location' $lx $ly $lz $lsx $lsy $lsz)
          $(XmlVec3Range 'Velocity' $vx $vy $vz $vsx $vsy $vsz)
          $(XmlVec3Range 'Acceleration' $ax $ay $az 0 0 0)
        </PVA>
      </LocationValues>
"@
}

function XmlRotFixed([double]$x, [double]$y, [double]$z) {
    return @"
      <RotationValues>
        <Type>0</Type>
        <Fixed>
          <Rotation><X>$x</X><Y>$y</Y><Z>$z</Z></Rotation>
        </Fixed>
      </RotationValues>
"@
}

function XmlRotPVA([double]$rx, [double]$ry, [double]$rz, [double]$rsx, [double]$rsy, [double]$rsz, [double]$vx, [double]$vy, [double]$vz, [double]$vsx = 0, [double]$vsy = 0, [double]$vsz = 0) {
    return @"
      <RotationValues>
        <Type>1</Type>
        <PVA>
          $(XmlVec3Range 'Rotation' $rx $ry $rz $rsx $rsy $rsz)
          $(XmlVec3Range 'Velocity' $vx $vy $vz $vsx $vsy $vsz)
          $(XmlVec3Range 'Acceleration' 0 0 0 0 0 0)
        </PVA>
      </RotationValues>
"@
}

function XmlScaleFixed([double]$x, [double]$y, [double]$z) {
    return @"
      <ScalingValues>
        <Type>0</Type>
        <Fixed>
          <Scale><X>$x</X><Y>$y</Y><Z>$z</Z></Scale>
        </Fixed>
      </ScalingValues>
"@
}

function XmlScaleSingleEasing([double]$s, [double]$e, [double]$sSpread = 0, [double]$eSpread = 0, [int]$startSpd = 20, [int]$endSpd = -20) {
    return @"
      <ScalingValues>
        <Type>4</Type>
        <SingleEasing>
          $(XmlRange 'Start' $s $sSpread)
          $(XmlRange 'End' $e $eSpread)
          <StartSpeed>$startSpd</StartSpeed>
          <EndSpeed>$endSpd</EndSpeed>
        </SingleEasing>
      </ScalingValues>
"@
}

function XmlGenPoint() {
    return @"
      <GenerationLocationValues>
        <EffectsRotation>False</EffectsRotation>
        <Type>0</Type>
      </GenerationLocationValues>
"@
}

function XmlGenCircle([double]$radius, [double]$radiusSpread = 0, [int]$division = 12, [int]$type = 0, [bool]$effectsRot = $true) {
    $er = if ($effectsRot) { "True" } else { "False" }
    return @"
      <GenerationLocationValues>
        <EffectsRotation>$er</EffectsRotation>
        <Type>3</Type>
        <Circle>
          <Division>$division</Division>
          $(XmlRange 'Radius' $radius $radiusSpread)
          $(XmlRange 'AngleStart' 0 0)
          $(XmlRange 'AngleEnd' 360 0)
          <Type>$type</Type>
        </Circle>
      </GenerationLocationValues>
"@
}

function XmlRendererCommon($texPath, [int]$alphaBlend = 2, [int]$fadeIn = 2, [int]$fadeOut = 10, [bool]$zTest = $true) {
    $zt = if ($zTest) { "True" } else { "False" }
    $fiBlock = if ($fadeIn -gt 0) { "<FadeInType>1</FadeInType><FadeIn><Frame>$fadeIn</Frame></FadeIn>" } else { "<FadeInType>0</FadeInType>" }
    $foBlock = if ($fadeOut -gt 0) { "<FadeOutType>1</FadeOutType><FadeOut><Frame>$fadeOut</Frame></FadeOut>" } else { "<FadeOutType>0</FadeOutType>" }
    return @"
      <RendererCommonValues>
        <ColorTexture>$texPath</ColorTexture>
        <AlphaBlend>$alphaBlend</AlphaBlend>
        <ZWrite>False</ZWrite>
        <ZTest>$zt</ZTest>
        $fiBlock
        $foBlock
      </RendererCommonValues>
"@
}

function XmlDrawSprite(
    [int]$billboard,
    $sr, $sg, $sb, $sa,
    $er, $eg, $eb, $ea,
    [double]$halfW = 0.5,
    [double]$halfH = 0.5
) {
    $posXml = ""
    if ($halfW -ne 0.5 -or $halfH -ne 0.5) {
        $nw = -$halfW; $nh = -$halfH
        $posXml = "<Position>1</Position><Position_Fixed><LL><X>$nw</X><Y>$nh</Y></LL><LR><X>$halfW</X><Y>$nh</Y></LR><UL><X>$nw</X><Y>$halfH</Y></UL><UR><X>$halfW</X><Y>$halfH</Y></UR></Position_Fixed>"
    }
    return @"
      <DrawingValues>
        <Type>2</Type>
        <Sprite>
          <Billboard>$billboard</Billboard>
          <ColorAll>2</ColorAll>
          $(XmlColorEasing 'ColorAll_Easing' $sr $sg $sb $sa $er $eg $eb $ea)
          $posXml
        </Sprite>
      </DrawingValues>
"@
}

function XmlNode($name, $common, $loc, $rot, $scale, $genLoc, $rendCommon, $draw, $children = "") {
    return @"
    <Node>
      $common
      $loc
      $rot
      $scale
      $genLoc
      $rendCommon
      $draw
      <IsRendered>True</IsRendered>
      <Name>$name</Name>
      <Children>$children</Children>
    </Node>
"@
}

function WriteEfkProj($fileName, [int]$endFrame, [string[]]$nodes) {
    $childrenXml = ($nodes -join "`n")
    $xml = @"
<?xml version="1.0" encoding="utf-8"?>
<EffekseerProject>
  <Root>
    <Name>Root</Name>
    <Children>
$childrenXml
    </Children>
  </Root>
  <ToolVersion>1.43</ToolVersion>
  <Version>3</Version>
  <StartFrame>0</StartFrame>
  <EndFrame>$endFrame</EndFrame>
  <IsLoop>False</IsLoop>
</EffekseerProject>
"@
    $outPath = Join-Path $OutDir $fileName
    [System.IO.File]::WriteAllText($outPath, $xml, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host ("  [OK] {0,-44} ({1} frames, {2} nodes)" -f $fileName, $endFrame, $nodes.Count)
}

Write-Host "Generating 7 Desperado Cowboy Effekseer 1.80.8 .efkproj files in $OutDir ..."

# ============================================================================
# 1. BASIC SHOT: DUAL REVOLVER QUICKDRAW (cowboy_basic_shot.efkproj)
# ============================================================================
$nShotStar = XmlNode "MuzzleStarFlash" `
    (XmlCommon 1 12 0 1 0) `
    (XmlLocFixed 0 1.05 0.95) `
    (XmlRotPVA 0 0 0 0 0 45 0 0 12) `
    (XmlScaleSingleEasing 0.65 1.85 0 0 26 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/muzzle_star.png" 2 1 6) `
    (XmlDrawSprite 0 255 250 215 255 245 158 11 0)

$nShotTracer = XmlNode "QuickdrawTracer" `
    (XmlCommon 1 14 0 1 0) `
    (XmlLocPVA 0 1.05 1.4 0 0 0 0 0 0.45 0 0 0) `
    (XmlRotFixed 90 -90 0) `
    (XmlScaleSingleEasing 1.2 2.4 0 0 20 -15) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/bullet_tracer.png" 2 1 7) `
    (XmlDrawSprite 2 254 240 138 255 217 119 6 0 1.2 0.32)

$nShotSmoke = XmlNode "GunpowderPuff" `
    (XmlCommon 4 20 4 0.3 1) `
    (XmlLocPVA 0 1.05 1.0 0.15 0.15 0.15 0 0.04 0.08 0.03 0.03 0.04 0 0.001 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 3) `
    (XmlScaleSingleEasing 0.55 1.35 0.1 0.2 18 -14) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/gun_smoke.png" 1 1 10) `
    (XmlDrawSprite 0 180 155 125 180 90 70 55 0)

$nShotSparks = XmlNode "BrassRicochetSparks" `
    (XmlCommon 10 16 4 0.2 0) `
    (XmlLocPVA 0 1.05 1.0 0.12 0.12 0.12 0 0.04 0.24 0.07 0.06 0.08 0 -0.005 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.24 0.60 0.24) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/brass_spark.png" 2 1 6) `
    (XmlDrawSprite 3 254 240 138 255 217 119 6 0 0.22 0.60)

WriteEfkProj "cowboy_basic_shot.efkproj" 22 @($nShotStar, $nShotTracer, $nShotSmoke, $nShotSparks)

# ============================================================================
# 2. HEAVY ATTACK: DEADEYE MAGNUM (cowboy_heavy_deadeye.efkproj)
# ============================================================================
$nDeadReticle = XmlNode "DeadeyeTargetReticle" `
    (XmlCommon 1 34 0 1 0) `
    (XmlLocFixed 0 1.05 1.55) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 6.5) `
    (XmlScaleSingleEasing 2.6 1.5 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/deadeye_reticle.png" 2 1 12) `
    (XmlDrawSprite 2 254 240 138 255 217 119 6 0)

$nDeadBeam = XmlNode "DeadeyeMagnumStreak" `
    (XmlCommon 1 24 0 1 2) `
    (XmlLocFixed 0 1.05 5.4) `
    (XmlRotFixed 90 -90 0) `
    (XmlScaleSingleEasing 1.0 1.35 0 0 22 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/bullet_tracer.png" 2 1 12) `
    (XmlDrawSprite 2 255 250 220 255 245 158 11 0 4.6 0.85)

$nDeadRings = @()
for ($i = 0; $i -lt 3; $i++) {
    $rz = 1.6 + $i * 2.2
    $nDeadRings += XmlNode "SonicBoomRing_$i" `
        (XmlCommon 1 26 0 1 ($i * 2)) `
        (XmlLocFixed 0 1.05 $rz) `
        (XmlRotFixed 0 0 0) `
        (XmlScaleSingleEasing 0.65 (2.8 - $i * 0.35) 0 0 26 -20) `
        (XmlGenPoint) `
        (XmlRendererCommon "textures/sonic_ring.png" 2 1 12) `
        (XmlDrawSprite 2 254 240 138 255 217 119 6 0)
}

$nDeadFlash = XmlNode "DeadeyeMuzzleStar" `
    (XmlCommon 1 20 0 1 0) `
    (XmlLocFixed 0 1.05 1.1) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 10) `
    (XmlScaleSingleEasing 1.2 3.2 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/muzzle_star.png" 2 1 10) `
    (XmlDrawSprite 0 255 252 225 255 245 158 11 0)

$nDeadSparks = XmlNode "DeadeyeBrassSparks" `
    (XmlCommon 24 28 6 0.2 0) `
    (XmlLocPVA 0 1.05 1.2 0.25 0.25 0.3 0 0.05 0.35 0.12 0.09 0.12 0 -0.006 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.30 0.78 0.30) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/brass_spark.png" 2 1 10) `
    (XmlDrawSprite 3 254 240 138 255 239 68 68 0 0.24 0.70)

WriteEfkProj "cowboy_heavy_deadeye.efkproj" 38 (@($nDeadReticle, $nDeadBeam, $nDeadFlash, $nDeadSparks) + $nDeadRings)

# ============================================================================
# 3. [Q/SD] WEAPON SKILL: HIGH NOON BARRAGE (cowboy_skill_weapon_highnoon.efkproj)
# ============================================================================
$nNoonCrest = XmlNode "HighNoonSheriffSundial" `
    (XmlCommon 1 62 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 5.5) `
    (XmlScaleSingleEasing 1.8 8.4 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sheriff_crest.png" 2 2 18) `
    (XmlDrawSprite 2 254 240 138 255 217 119 6 0)

$nNoonRing = XmlNode "HighNoonSonicRing" `
    (XmlCommon 1 46 0 1 0) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 8.8 0 0 26 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sonic_ring.png" 2 1 16) `
    (XmlDrawSprite 2 254 240 138 255 245 158 11 0)

$nNoonVolley = XmlNode "Barrage360Tracers" `
    (XmlCommon 12 22 4 2.5 2) `
    (XmlLocPVA 0 1.05 0 0.3 0.1 0.3 0 0 0.42 0.05 0.03 0.05) `
    (XmlRotFixed 90 -90 0) `
    (XmlScaleSingleEasing 1.4 2.8 0 0 20 -16) `
    (XmlGenCircle 0.8 0 12 1 $true) `
    (XmlRendererCommon "textures/bullet_tracer.png" 2 1 10) `
    (XmlDrawSprite 2 255 248 195 255 245 158 11 0 1.4 0.36)

$nNoonBlast = XmlNode "HighNoonGoldenSlam" `
    (XmlCommon 1 28 0 1 36) `
    (XmlLocFixed 0 0.18 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.4 8.2 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/tnt_blast.png" 2 1 14) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nNoonSmoke = XmlNode "HighNoonDustWhirl" `
    (XmlCommon 14 48 10 0.5 2) `
    (XmlLocPVA 0 0.55 0 1.2 0.3 1.2 0 0.07 0 0.14 0.04 0.14 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 4) `
    (XmlScaleSingleEasing 1.2 2.8 0.2 0.4 18 -14) `
    (XmlGenCircle 1.8 0.5 14 0 $false) `
    (XmlRendererCommon "textures/gun_smoke.png" 1 2 18) `
    (XmlDrawSprite 0 110 75 48 205 55 34 22 0)

$nNoonSparks = XmlNode "HighNoonBrassStorm" `
    (XmlCommon 36 44 10 0.6 0) `
    (XmlLocPVA 0 1.0 0 0.6 0.3 0.6 0 0.15 0 0.24 0.09 0.24 0 -0.008 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.32 0.80 0.32) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/brass_spark.png" 2 1 14) `
    (XmlDrawSprite 3 254 240 138 255 217 119 6 0 0.24 0.68)

WriteEfkProj "cowboy_skill_weapon_highnoon.efkproj" 68 @($nNoonCrest, $nNoonRing, $nNoonVolley, $nNoonBlast, $nNoonSmoke, $nNoonSparks)

# ============================================================================
# 4. [E/ASD] ARMOR SKILL: TNT DYNAMITE TOSS (cowboy_skill_armor_tnt.efkproj)
# ============================================================================
$nTntStick = XmlNode "FlyingTNTBundle" `
    (XmlCommon 1 14 0 1 0) `
    (XmlLocPVA 0 1.0 -4.5 0 0 0 0 0.26 0.32 0 0 0 0 -0.038 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 18) `
    (XmlScaleFixed 1.4 1.4 1.4) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/tnt_bundle.png" 1 1 2) `
    (XmlDrawSprite 0 255 255 255 255 255 240 200 255)

$nTntZone = XmlNode "TNTDangerReticle" `
    (XmlCommon 1 56 0 1 0) `
    (XmlLocFixed 0 0.05 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 4.5) `
    (XmlScaleSingleEasing 1.8 7.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/deadeye_reticle.png" 2 1 18) `
    (XmlDrawSprite 2 254 240 138 245 239 68 68 0)

$nTntBlast = XmlNode "TNTExplosionBurst" `
    (XmlCommon 1 42 0 1 14) `
    (XmlLocFixed 0 1.1 0) `
    (XmlRotPVA 0 0 0 0 0 30 0 0 4) `
    (XmlScaleSingleEasing 1.8 7.4 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/tnt_blast.png" 2 1 18) `
    (XmlDrawSprite 0 255 245 180 255 239 68 68 0)

$nTntRing = XmlNode "TNTShockwaveRing" `
    (XmlCommon 1 36 0 1 14) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 8.4 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sonic_ring.png" 2 1 14) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nTntSmoke = XmlNode "TNTCharcoalSmokePlume" `
    (XmlCommon 16 52 12 0.3 14) `
    (XmlLocPVA 0 0.85 0 1.4 0.5 1.4 0 0.16 0 0.14 0.08 0.14 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 3) `
    (XmlScaleSingleEasing 1.5 3.6 0.3 0.5 18 -14) `
    (XmlGenCircle 1.6 0.5 16 0 $false) `
    (XmlRendererCommon "textures/gun_smoke.png" 1 2 22) `
    (XmlDrawSprite 0 48 30 22 230 22 14 10 0)

$nTntSparks = XmlNode "TNTBlazeEmbers" `
    (XmlCommon 32 46 10 0.2 14) `
    (XmlLocPVA 0 0.8 0 1.0 0.4 1.0 0 0.28 0 0.22 0.12 0.22 0 -0.010 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.38 0.90 0.38) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/brass_spark.png" 2 1 14) `
    (XmlDrawSprite 3 254 240 138 255 239 68 68 0 0.26 0.74)

WriteEfkProj "cowboy_skill_armor_tnt.efkproj" 70 @($nTntStick, $nTntZone, $nTntBlast, $nTntRing, $nTntSmoke, $nTntSparks)

# ============================================================================
# 5. [R/AD] HELMET SKILL: TACTICAL ROLL & STUN SHOT (cowboy_skill_helmet_rollshot.efkproj)
# ============================================================================
$nRollRing = XmlNode "TacticalDodgeRing" `
    (XmlCommon 1 30 0 1 0) `
    (XmlLocFixed 0 0.12 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 0.9 4.2 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sonic_ring.png" 2 1 12) `
    (XmlDrawSprite 2 254 240 138 255 245 158 11 0)

$nRollFlash = XmlNode "StunFlashbangStar" `
    (XmlCommon 1 28 0 1 4) `
    (XmlLocFixed 0 1.05 1.8) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 14) `
    (XmlScaleSingleEasing 1.2 4.6 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/muzzle_star.png" 2 1 12) `
    (XmlDrawSprite 0 255 255 235 255 250 204 21 0)

$nRollBeam = XmlNode "FlashStunTracer" `
    (XmlCommon 1 24 0 1 4) `
    (XmlLocFixed 0 1.05 4.8) `
    (XmlRotFixed 90 -90 0) `
    (XmlScaleSingleEasing 1.0 1.4 0 0 22 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/bullet_tracer.png" 2 1 10) `
    (XmlDrawSprite 2 255 255 235 255 250 204 21 0 3.8 0.72)

$nRollDust = XmlNode "TumbleDustCloud" `
    (XmlCommon 10 30 8 0.4 0) `
    (XmlLocPVA 0 0.45 0 0.6 0.2 0.6 0 0.06 -0.10 0.06 0.04 0.06 0 -0.001 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 4) `
    (XmlScaleSingleEasing 0.85 2.0 0.2 0.3 18 -14) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/gun_smoke.png" 1 1 14) `
    (XmlDrawSprite 0 165 130 92 200 95 72 48 0)

WriteEfkProj "cowboy_skill_helmet_rollshot.efkproj" 38 @($nRollRing, $nRollFlash, $nRollBeam, $nRollDust)

# ============================================================================
# 6. [F/AS] TRINKET SKILL: BOUNTY HUNTER LASSO (cowboy_skill_trinket_lasso.efkproj)
# ============================================================================
$nLassoBeam = XmlNode "LassoRopeLine" `
    (XmlCommon 1 38 0 1 0) `
    (XmlLocFixed 0 1.05 4.1) `
    (XmlRotFixed 90 -90 0) `
    (XmlScaleSingleEasing 1.0 1.05 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/bullet_tracer.png" 2 1 14) `
    (XmlDrawSprite 2 254 215 100 255 217 119 6 0 4.1 0.42)

$nLassoSnare = XmlNode "LassoSnareLoop" `
    (XmlCommon 1 40 0 1 2) `
    (XmlLocPVA 0 0.95 7.8 0 0 0 0 0 -0.18 0 0 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 12) `
    (XmlScaleSingleEasing 3.2 1.1 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/lasso_loop.png" 2 1 14) `
    (XmlDrawSprite 2 254 240 138 255 217 119 6 0)

$nLassoOverhead = XmlNode "LassoWhirlOverhead" `
    (XmlCommon 1 28 0 1 0) `
    (XmlLocFixed 0 1.65 0.4) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 18) `
    (XmlScaleSingleEasing 1.2 2.4 0 0 22 -16) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/lasso_loop.png" 2 1 10) `
    (XmlDrawSprite 2 254 215 100 245 180 83 9 0)

$nLassoSparks = XmlNode "LassoSnapSparks" `
    (XmlCommon 20 32 8 0.3 2) `
    (XmlLocPVA 0 1.0 7.6 0.6 0.4 0.6 0 0.12 -0.22 0.12 0.08 0.12 0 -0.005 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.28 0.68 0.28) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/brass_spark.png" 2 1 10) `
    (XmlDrawSprite 3 254 240 138 255 217 119 6 0 0.22 0.64)

WriteEfkProj "cowboy_skill_trinket_lasso.efkproj" 46 @($nLassoBeam, $nLassoSnare, $nLassoOverhead, $nLassoSparks)

# ============================================================================
# 7. MOBILITY: DOUBLE JUMP / TUMBLE DASH (cowboy_mobility_tumble.efkproj)
# ============================================================================
$nMobStar = XmlNode "SpurSheriffRing" `
    (XmlCommon 1 24 0 1 0) `
    (XmlLocFixed 0 0.08 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 8) `
    (XmlScaleSingleEasing 0.7 2.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sheriff_crest.png" 2 1 10) `
    (XmlDrawSprite 2 254 240 138 245 217 119 6 0)

$nMobDust = XmlNode "TumbleCanyonDust" `
    (XmlCommon 8 26 6 0.3 0) `
    (XmlLocPVA 0 0.35 0 0.5 0.15 0.5 0 0.05 0 0.08 0.04 0.08 0 -0.001 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 4) `
    (XmlScaleSingleEasing 0.75 1.85 0.15 0.25 18 -14) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/gun_smoke.png" 1 1 12) `
    (XmlDrawSprite 0 155 118 78 205 88 62 38 0)

$nMobSparks = XmlNode "SpurGoldSparks" `
    (XmlCommon 12 22 6 0.2 0) `
    (XmlLocPVA 0 0.4 0 0.4 0.2 0.4 0 0.10 0 0.10 0.06 0.10 0 -0.005 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.24 0.58 0.24) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/brass_spark.png" 2 1 8) `
    (XmlDrawSprite 3 254 240 138 255 217 119 6 0 0.20 0.56)

WriteEfkProj "cowboy_mobility_tumble.efkproj" 28 @($nMobStar, $nMobDust, $nMobSparks)

# XML + Texture reference validation
Write-Host ""
Write-Host "Validating XML & texture references..."
$errors = 0
Get-ChildItem -Path $OutDir -Filter "*.efkproj" | ForEach-Object {
    [xml]$doc = Get-Content $_.FullName -Raw
    $texNodes = $doc.SelectNodes("//ColorTexture")
    foreach ($t in $texNodes) {
        $rel = $t.InnerText.Trim()
        if ($rel -ne "") {
            $full = Join-Path $OutDir $rel
            if (-not (Test-Path $full)) {
                Write-Error "Missing texture $rel referenced by $($_.Name)"
                $errors++
            }
        }
    }
}
if ($errors -eq 0) {
    Write-Host "ALL 7 Desperado Cowboy .efkproj XML files validated with 0 missing textures!"
}
