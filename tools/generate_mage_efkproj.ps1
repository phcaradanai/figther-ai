# ============================================================================
# LOST SAGA 3D - FIRE ARCHMAGE EFFEKSEER (.efkproj) VFX SUITE GENERATOR
# ============================================================================
# Generates 7 multi-layered 3D Effekseer project files compatible with
# Effekseer 1.80.8 (GUI & CUI compiler) and EffekseerForWebGL 1.80.8:
#   1. mage_basic_fireball.efkproj           (3-Hit Arcane Fireball Cast)
#   2. mage_heavy_pillar.efkproj             (Heavy: Dragon Pillar)
#   3. mage_skill_weapon_meteor.efkproj      ([Q/SD] Meteor Apocalypse)
#   4. mage_skill_armor_supernova.efkproj    ([E/ASD] Supernova Ring)
#   5. mage_skill_helmet_solar.efkproj       ([R/AD] Solar Orbit Spheres)
#   6. mage_skill_trinket_blink.efkproj      ([F/AS] Flame Blink Warp)
#   7. mage_mobility_hover.efkproj           (Flame Hover Fly / Air Dash)
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\mage")
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

function XmlDrawRing(
    [int]$billboard = 2,
    [int]$vertexCount = 32,
    [double]$viewingAngle = 360,
    [double]$outerSX = 0.5, [double]$outerSY = 0, [double]$outerEX = 3.5, [double]$outerEY = 0,
    [double]$innerSX = 0.15, [double]$innerSY = 0, [double]$innerEX = 2.4, [double]$innerEY = 0,
    [double]$centerRatio = 0.5,
    $or = 239, $og = 68, $ob = 68, $oa = 0,
    $csr = 254, $csg = 240, $csb = 138, $csa = 255,
    $cer = 234, $ceg = 88, $ceb = 12, $cea = 0,
    $ir = 249, $ig = 115, $ib = 22, $ia = 0,
    [int]$startSpd = 22, [int]$endSpd = -22
) {
    return @"
      <DrawingValues>
        <Type>4</Type>
        <Ring>
          <Billboard>$billboard</Billboard>
          <VertexCount>$vertexCount</VertexCount>
          <ViewingAngle>1</ViewingAngle>
          <ViewingAngle_Fixed>$viewingAngle</ViewingAngle_Fixed>
          <Outer>3</Outer>
          <Outer_Easing>
            $(XmlVec2Range 'Start' $outerSX $outerSY 0 0)
            $(XmlVec2Range 'End' $outerEX $outerEY 0 0)
            <StartSpeed>$startSpd</StartSpeed>
            <EndSpeed>$endSpd</EndSpeed>
          </Outer_Easing>
          <Inner>3</Inner>
          <Inner_Easing>
            $(XmlVec2Range 'Start' $innerSX $innerSY 0 0)
            $(XmlVec2Range 'End' $innerEX $innerEY 0 0)
            <StartSpeed>$startSpd</StartSpeed>
            <EndSpeed>$endSpd</EndSpeed>
          </Inner_Easing>
          <CenterRatio>1</CenterRatio>
          <CenterRatio_Fixed>$centerRatio</CenterRatio_Fixed>
          <OuterColor>0</OuterColor>
          $(XmlColorFixed 'OuterColor_Fixed' $or $og $ob $oa)
          <CenterColor>2</CenterColor>
          $(XmlColorEasing 'CenterColor_Easing' $csr $csg $csb $csa $cer $ceg $ceb $cea)
          <InnerColor>0</InnerColor>
          $(XmlColorFixed 'InnerColor_Fixed' $ir $ig $ib $ia)
        </Ring>
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

Write-Host "Generating 7 Fire Archmage Effekseer 1.80.8 .efkproj files in $OutDir ..."

# ============================================================================
# 1. MAGE BASIC FIREBALL CAST (mage_basic_fireball.efkproj)
# ============================================================================
$nBasicSigil = XmlNode "ArcaneCastSigil" `
    (XmlCommon 1 20 0 1 0) `
    (XmlLocFixed 0 1.05 0.95) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 10) `
    (XmlScaleSingleEasing 0.45 1.85 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 1 9) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nBasicCore = XmlNode "SolarIgnitionCore" `
    (XmlCommon 1 16 0 1 0) `
    (XmlLocFixed 0 1.05 1.05) `
    (XmlRotPVA 0 0 0 0 0 45 0 0 14) `
    (XmlScaleSingleEasing 0.5 1.9 0 0 25 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/solar_orb.png" 2 1 8) `
    (XmlDrawSprite 0 255 250 220 255 249 115 22 0)

$nBasicFlames = XmlNode "MuzzleFlameLicks" `
    (XmlCommon 6 16 4 0.3 0) `
    (XmlLocPVA 0 1.05 0.95 0.25 0.25 0.15 0 0.03 0.18 0.05 0.05 0.06 0 0.002 0) `
    (XmlRotPVA 0 0 0 0 0 35 0 0 3) `
    (XmlScaleSingleEasing 0.45 1.15 0.1 0.2 15 -15) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/flame_lick.png" 2 1 8) `
    (XmlDrawSprite 0 254 240 138 245 220 38 38 0)

$nBasicEmbers = XmlNode "FireballEmbers" `
    (XmlCommon 14 20 6 0.2 0) `
    (XmlLocPVA 0 1.05 1.0 0.2 0.2 0.2 0 0.04 0.22 0.08 0.07 0.08 0 -0.004 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.28 0.65 0.28) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_ember.png" 2 1 8) `
    (XmlDrawSprite 3 254 240 138 255 239 68 68 0 0.25 0.65)

WriteEfkProj "mage_basic_fireball.efkproj" 26 @($nBasicSigil, $nBasicCore, $nBasicFlames, $nBasicEmbers)

# ============================================================================
# 2. HEAVY ATTACK: DRAGON PILLAR (mage_heavy_pillar.efkproj)
# ============================================================================
$nHeavyCrater = XmlNode "DragonMagmaCrater" `
    (XmlCommon 1 48 0 1 0) `
    (XmlLocFixed 0 0.05 2.4) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 4.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/magma_crater.png" 1 2 18) `
    (XmlDrawSprite 2 255 120 40 245 120 20 10 0)

$nHeavyRune = XmlNode "DragonRuneSeal" `
    (XmlCommon 1 46 0 1 0) `
    (XmlLocFixed 0 0.08 2.4) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 5.5) `
    (XmlScaleSingleEasing 1.0 4.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 2 16) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nHeavyVortex = XmlNode "DragonFirePillarColumn" `
    (XmlCommon 1 44 0 1 2) `
    (XmlLocFixed 0 2.3 2.4) `
    (XmlRotPVA -90 0 0 0 0 0 0 14 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/flame_vortex.png" 2 2 16) `
    (XmlDrawRing 2 28 360 1.25 4.4 1.95 5.2 0.85 -2.2 1.35 -2.2 0.5 220 38 38 0 254 215 100 255 239 68 68 0 255 140 40 0)

$nHeavyRing = XmlNode "DragonEruptionWave" `
    (XmlCommon 1 32 0 1 2) `
    (XmlLocFixed 0 0.14 2.4) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 0.8 5.2 0 0 26 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_shockwave.png" 2 1 14) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nHeavyFlames = XmlNode "DragonFlameTongues" `
    (XmlCommon 16 32 8 0.5 2) `
    (XmlLocPVA 0 0.4 2.4 0.7 0.3 0.7 0 0.24 0 0.06 0.08 0.06 0 0.002 0) `
    (XmlRotPVA 0 0 0 0 0 25 0 0 3) `
    (XmlScaleSingleEasing 0.9 2.2 0.2 0.4 18 -14) `
    (XmlGenCircle 0.9 0.3 12 0 $false) `
    (XmlRendererCommon "textures/flame_lick.png" 2 2 12) `
    (XmlDrawSprite 0 254 240 138 240 220 38 38 0)

$nHeavyEmbers = XmlNode "DragonVolcanicEmbers" `
    (XmlCommon 24 38 10 0.3 2) `
    (XmlLocPVA 0 0.6 2.4 0.8 0.5 0.8 0 0.26 0 0.12 0.10 0.12 0 -0.006 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.34 0.82 0.34) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_ember.png" 2 1 12) `
    (XmlDrawSprite 3 254 240 138 255 239 68 68 0 0.25 0.7)

WriteEfkProj "mage_heavy_pillar.efkproj" 52 @($nHeavyCrater, $nHeavyRune, $nHeavyVortex, $nHeavyRing, $nHeavyFlames, $nHeavyEmbers)

# ============================================================================
# 3. [Q/SD] WEAPON SKILL: METEOR APOCALYPSE (mage_skill_weapon_meteor.efkproj)
# ============================================================================
$nMetTarget = XmlNode "ApocalypseTargetSeal" `
    (XmlCommon 1 84 0 1 0) `
    (XmlLocFixed 0 0.05 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 4.5) `
    (XmlScaleSingleEasing 2.2 8.8 0 0 22 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 2 24) `
    (XmlDrawSprite 2 254 215 100 255 220 38 38 0)

$nMetRock = XmlNode "FallingMoltenMeteor" `
    (XmlCommon 1 18 0 1 0) `
    (XmlLocPVA -4.2 13.5 -3.0 0 0 0 0.233 -0.745 0.167 0 0 0 0 0 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 11) `
    (XmlScaleSingleEasing 2.4 3.4 0 0 10 -10) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/meteor_core.png" 1 1 2) `
    (XmlDrawSprite 0 255 180 90 255 255 240 180 255)

$nMetCrater = XmlNode "ImpactMagmaCrater" `
    (XmlCommon 1 70 0 1 18) `
    (XmlLocFixed 0 0.07 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.8 8.4 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/magma_crater.png" 1 2 24) `
    (XmlDrawSprite 2 255 130 40 250 110 20 10 0)

$nMetWave = XmlNode "CataclysmShockwave" `
    (XmlCommon 1 40 0 1 18) `
    (XmlLocFixed 0 0.16 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 9.4 0 0 28 -22) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_shockwave.png" 2 1 16) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nMetPillar = XmlNode "ImpactFirePillar" `
    (XmlCommon 1 48 0 1 18) `
    (XmlLocFixed 0 2.6 0) `
    (XmlRotPVA -90 0 0 0 0 0 0 10 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/flame_vortex.png" 2 2 18) `
    (XmlDrawRing 2 32 360 1.6 4.8 3.6 6.2 1.0 -2.4 2.4 -2.4 0.5 220 38 38 0 254 240 138 255 239 68 68 0 249 115 22 0)

$nMetSmoke = XmlNode "VolcanicAshPlume" `
    (XmlCommon 18 54 12 0.4 18) `
    (XmlLocPVA 0 0.9 0 1.6 0.6 1.6 0 0.14 0 0.12 0.08 0.12 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 2.5) `
    (XmlScaleSingleEasing 1.6 3.8 0.3 0.6 18 -14) `
    (XmlGenCircle 1.8 0.6 16 0 $false) `
    (XmlRendererCommon "textures/volcanic_smoke.png" 1 3 22) `
    (XmlDrawSprite 0 42 18 16 230 24 10 10 0)

$nMetEmbers = XmlNode "ApocalypseLavaEmbers" `
    (XmlCommon 36 50 12 0.3 18) `
    (XmlLocPVA 0 0.8 0 1.4 0.5 1.4 0 0.28 0 0.20 0.12 0.20 0 -0.009 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.40 0.95 0.40) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_ember.png" 2 1 16) `
    (XmlDrawSprite 3 254 240 138 255 239 68 68 0 0.28 0.78)

WriteEfkProj "mage_skill_weapon_meteor.efkproj" 90 @($nMetTarget, $nMetRock, $nMetCrater, $nMetWave, $nMetPillar, $nMetSmoke, $nMetEmbers)

# ============================================================================
# 4. [E/ASD] ARMOR SKILL: SUPERNOVA RING (mage_skill_armor_supernova.efkproj)
# ============================================================================
$nNovaRune = XmlNode "SupernovaRuneSeal" `
    (XmlCommon 1 56 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 -6.0) `
    (XmlScaleSingleEasing 1.4 8.6 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 2 18) `
    (XmlDrawSprite 2 254 240 138 255 249 115 22 0)

$nNovaWave1 = XmlNode "SupernovaFireWall" `
    (XmlCommon 1 42 0 1 0) `
    (XmlLocFixed 0 0.85 0) `
    (XmlRotPVA -90 0 0 0 0 0 0 8 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/flame_vortex.png" 2 2 16) `
    (XmlDrawRing 2 32 360 0.8 1.6 4.6 2.8 0.5 -0.8 3.9 -0.8 0.5 239 68 68 0 254 240 138 255 249 115 22 0 220 38 38 0)

$nNovaShock = XmlNode "SupernovaShockwave" `
    (XmlCommon 1 38 0 1 0) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.0 9.0 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_shockwave.png" 2 1 14) `
    (XmlDrawSprite 2 255 245 180 255 239 68 68 0)

$nNovaFlash = XmlNode "SupernovaCoreFlare" `
    (XmlCommon 1 24 0 1 0) `
    (XmlLocFixed 0 1.05 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 9) `
    (XmlScaleSingleEasing 1.4 5.2 0 0 26 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/solar_orb.png" 2 1 12) `
    (XmlDrawSprite 0 255 255 220 255 249 115 22 0)

$nNovaSmoke = XmlNode "SupernovaScorchSmoke" `
    (XmlCommon 14 42 8 0.3 2) `
    (XmlLocPVA 0 0.6 0 0.8 0.3 0.8 0 0.08 0 0.16 0.05 0.16 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 3) `
    (XmlScaleSingleEasing 1.2 2.8 0.2 0.4 18 -14) `
    (XmlGenCircle 1.5 0.4 14 0 $false) `
    (XmlRendererCommon "textures/volcanic_smoke.png" 1 2 18) `
    (XmlDrawSprite 0 48 16 14 215 22 8 8 0)

$nNovaEmbers = XmlNode "SupernovaEmberRing" `
    (XmlCommon 30 40 8 0.2 0) `
    (XmlLocPVA 0 0.9 0 0.5 0.3 0.5 0 0.14 0 0.22 0.09 0.22 0 -0.007 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.35 0.85 0.35) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_ember.png" 2 1 14) `
    (XmlDrawSprite 3 254 240 138 255 249 115 22 0 0.25 0.72)

WriteEfkProj "mage_skill_armor_supernova.efkproj" 60 @($nNovaRune, $nNovaWave1, $nNovaShock, $nNovaFlash, $nNovaSmoke, $nNovaEmbers)

# ============================================================================
# 5. [R/AD] HELMET SKILL: SOLAR ORBIT SPHERES (mage_skill_helmet_solar.efkproj)
# ============================================================================
$nSolarRune = XmlNode "SolarAuraFloorSeal" `
    (XmlCommon 1 90 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 3.2) `
    (XmlScaleSingleEasing 1.6 5.4 0 0 22 -16) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 3 22) `
    (XmlDrawSprite 2 254 240 138 245 249 115 22 0)

$nSolarOrbs = @()
for ($i = 0; $i -lt 4; $i++) {
    $angDeg = $i * 90.0
    $rad = $angDeg * [Math]::PI / 180.0
    $ox = [Math]::Round([Math]::Cos($rad) * 1.65, 3)
    $oz = [Math]::Round([Math]::Sin($rad) * 1.65, 3)
    $orbChild = XmlNode "SolarOrb_$i" `
        (XmlCommon 1 88 0 1 0 2 2 2) `
        (XmlLocFixed $ox 1.15 $oz) `
        (XmlRotPVA 0 0 0 0 0 0 0 0 6) `
        (XmlScaleSingleEasing 0.45 1.35 0 0 18 -14) `
        (XmlGenPoint) `
        (XmlRendererCommon "textures/solar_orb.png" 2 3 18) `
        (XmlDrawSprite 0 255 248 200 255 249 115 22 0)
    $nSolarOrbs += $orbChild
}

$nSolarOrbitPivot = XmlNode "SolarOrbitRingPivot" `
    (XmlCommon 1 90 0 1 0) `
    (XmlLocFixed 0 0 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 6.5 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "" 2 0 0) `
    "<DrawingValues><Type>0</Type></DrawingValues>" `
    ($nSolarOrbs -join "`n")

$nSolarEmbers = XmlNode "SolarCoronaEmbers" `
    (XmlCommon 28 50 10 2.0 0) `
    (XmlLocPVA 0 1.0 0 1.5 0.5 1.5 0 0.08 0 0.05 0.04 0.05 0 0.001 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.28 0.65 0.28) `
    (XmlGenCircle 1.65 0.2 16 0 $false) `
    (XmlRendererCommon "textures/fire_ember.png" 2 2 14) `
    (XmlDrawSprite 3 254 240 138 255 249 115 22 0 0.22 0.60)

WriteEfkProj "mage_skill_helmet_solar.efkproj" 94 @($nSolarRune, $nSolarOrbitPivot, $nSolarEmbers)

# ============================================================================
# 6. [F/AS] TRINKET SKILL: FLAME BLINK WARP (mage_skill_trinket_blink.efkproj)
# ============================================================================
$nBlinkSeal = XmlNode "BlinkWarpRune" `
    (XmlCommon 1 42 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 7.5) `
    (XmlScaleSingleEasing 1.0 5.4 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 1 14) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nBlinkShock = XmlNode "BlinkFireBlast" `
    (XmlCommon 1 34 0 1 0) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 0.8 5.8 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_shockwave.png" 2 1 12) `
    (XmlDrawSprite 2 254 240 138 255 239 68 68 0)

$nBlinkWings = XmlNode "BlinkPhoenixWings" `
    (XmlCommon 1 36 0 1 0) `
    (XmlLocPVA 0 1.25 0 0 0 0 0 0.04 0 0 0 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleSingleEasing 1.1 3.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/phoenix_wings.png" 2 1 14) `
    (XmlDrawSprite 0 255 245 190 255 239 68 68 0)

$nBlinkSmoke = XmlNode "BlinkSmokePoof" `
    (XmlCommon 10 34 8 0.3 0) `
    (XmlLocPVA 0 0.8 0 0.6 0.4 0.6 0 0.08 0 0.10 0.06 0.10 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 3) `
    (XmlScaleSingleEasing 1.0 2.3 0.2 0.3 18 -14) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/volcanic_smoke.png" 1 2 14) `
    (XmlDrawSprite 0 46 16 14 215 20 8 8 0)

$nBlinkEmbers = XmlNode "BlinkFlameEmbers" `
    (XmlCommon 22 34 8 0.2 0) `
    (XmlLocPVA 0 0.9 0 0.5 0.4 0.5 0 0.16 0 0.16 0.10 0.16 0 -0.006 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.32 0.78 0.32) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_ember.png" 2 1 12) `
    (XmlDrawSprite 3 254 240 138 255 239 68 68 0 0.25 0.68)

WriteEfkProj "mage_skill_trinket_blink.efkproj" 46 @($nBlinkSeal, $nBlinkShock, $nBlinkWings, $nBlinkSmoke, $nBlinkEmbers)

# ============================================================================
# 7. MOBILITY: FLAME HOVER / AIR DASH (mage_mobility_hover.efkproj)
# ============================================================================
$nMobRing = XmlNode "FlameHoverRing" `
    (XmlCommon 1 26 0 1 0) `
    (XmlLocFixed 0 0.08 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 8) `
    (XmlScaleSingleEasing 0.7 2.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/pyro_rune_circle.png" 2 1 10) `
    (XmlDrawSprite 2 254 240 138 250 249 115 22 0)

$nMobWings = XmlNode "FlameHoverWings" `
    (XmlCommon 1 26 0 1 0) `
    (XmlLocFixed 0 1.05 -0.25) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleSingleEasing 0.85 2.4 0 0 22 -16) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/phoenix_wings.png" 2 1 10) `
    (XmlDrawSprite 0 255 240 175 240 239 68 68 0)

$nMobEmbers = XmlNode "FlameHoverEmbers" `
    (XmlCommon 14 24 6 0.3 0) `
    (XmlLocPVA 0 0.45 0 0.45 0.2 0.45 0 -0.08 0 0.08 0.05 0.08 0 0.002 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleFixed 0.26 0.62 0.26) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/fire_ember.png" 2 1 8) `
    (XmlDrawSprite 3 254 240 138 255 249 115 22 0 0.22 0.58)

WriteEfkProj "mage_mobility_hover.efkproj" 30 @($nMobRing, $nMobWings, $nMobEmbers)

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
    Write-Host "ALL 7 Fire Archmage .efkproj XML files validated with 0 missing textures!"
}
