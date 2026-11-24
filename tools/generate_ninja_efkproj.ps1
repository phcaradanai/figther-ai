# ============================================================================
# LOST SAGA 3D - SHADOW NINJA EFFEKSEER (.efkproj) VFX SUITE GENERATOR
# ============================================================================
# Generates 7 multi-layered 3D Effekseer project files compatible with
# Effekseer 1.80.8 (GUI & CUI compiler) and EffekseerForWebGL 1.80.8:
#   1. ninja_basic_slash.efkproj              (4-Hit Dual Kunai Cross-Slash)
#   2. ninja_heavy_backstab.efkproj           (Heavy: Shadow Backstab X-Fang)
#   3. ninja_skill_weapon_izuna.efkproj       ([Q/SD] Izuna Blade Storm)
#   4. ninja_skill_armor_smokebomb.efkproj    ([E/ASD] Smoke Bomb Stealth)
#   5. ninja_skill_helmet_shuriken.efkproj    ([R/AD] Fuuma Shuriken Fan)
#   6. ninja_skill_trinket_substitution.efkproj ([F/AS] Explosive Substitution)
#   7. ninja_mobility_shadowstep.efkproj      (Shadow Teleport / Air Dash / Triple Jump)
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\ninja")
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

function XmlRotEasing([double]$sx, [double]$sy, [double]$sz, [double]$ex, [double]$ey, [double]$ez, [int]$startSpd = 20, [int]$endSpd = -20) {
    return @"
      <RotationValues>
        <Type>2</Type>
        <Easing>
          $(XmlVec3Range 'Start' $sx $sy $sz 0 0 0)
          $(XmlVec3Range 'End' $ex $ey $ez 0 0 0)
          <StartSpeed>$startSpd</StartSpeed>
          <EndSpeed>$endSpd</EndSpeed>
        </Easing>
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
    [double]$outerSX = 0.4, [double]$outerSY = 0, [double]$outerEX = 3.0, [double]$outerEY = 0,
    [double]$innerSX = 0.1, [double]$innerSY = 0, [double]$innerEX = 2.0, [double]$innerEY = 0,
    [double]$centerRatio = 0.5,
    $or = 168, $og = 85, $ob = 247, $oa = 0,
    $csr = 233, $csg = 213, $csb = 255, $csa = 255,
    $cer = 124, $ceg = 58, $ceb = 237, $cea = 0,
    $ir = 56, $ig = 189, $ib = 248, $ia = 0,
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

function MakeNode($name, $body, $childrenXml = "") {
    $ch = if ($childrenXml) { "<Children>`n$childrenXml`n      </Children>" } else { "<Children />" }
    return @"
    <Node>
      <Name>$name</Name>
$body
      <IsRendered>True</IsRendered>
      $ch
    </Node>
"@
}

function SaveEfkProj($fileName, [int]$endFrame, $nodesXml) {
    $xmlText = @"
<?xml version="1.0" encoding="utf-8"?>
<EffekseerProject>
  <Root>
    <Name>Root</Name>
    <Children>
$nodesXml
    </Children>
  </Root>
  <ToolVersion>1.43</ToolVersion>
  <Version>3</Version>
  <StartFrame>0</StartFrame>
  <EndFrame>$endFrame</EndFrame>
  <IsLoop>True</IsLoop>
</EffekseerProject>
"@
    $doc = New-Object System.Xml.XmlDocument
    $doc.LoadXml($xmlText)
    $fullPath = Join-Path $OutDir $fileName
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($fullPath, $xmlText, $utf8NoBom)
    Write-Host "  [OK] $fileName ($endFrame frames)"
}

Write-Host "Generating Shadow Ninja Effekseer (.efkproj) VFX Suite..."

# ============================================================================
# 1. ninja_basic_slash.efkproj - Dual Kunai Ultra-Fast Cross Slash
# ============================================================================
$n1_InkShadow = MakeNode "ShadowInkBacking" (@(
    (XmlCommon -maxGen 1 -life 14 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.02 0.45),
    (XmlRotEasing 80 18 10 80 18 175 28 -25),
    (XmlScaleSingleEasing 2.0 3.0 0 0 26 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_slash.png" 1 1 7),
    (XmlDrawSprite 2 45 18 88 220 20 8 42 0)
) -join "`n")

$n1_PrimaryViolet = MakeNode "PhantomVioletArc" (@(
    (XmlCommon -maxGen 1 -life 14 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.05 0.48),
    (XmlRotEasing 80 18 15 80 18 175 28 -25),
    (XmlScaleSingleEasing 1.9 2.9 0 0 28 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_slash.png" 2 1 7),
    (XmlDrawSprite 2 225 180 255 255 147 51 234 0)
) -join "`n")

$n1_CyanOffhand = MakeNode "OffhandCyanArc" (@(
    (XmlCommon -maxGen 1 -life 15 -genTime 1 -genOffset 2),
    (XmlLocFixed 0 1.00 0.52),
    (XmlRotEasing 86 -18 170 86 -18 15 28 -25),
    (XmlScaleSingleEasing 1.7 2.6 0 0 26 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_slash.png" 2 1 8),
    (XmlDrawSprite 2 125 225 255 245 56 189 248 0)
) -join "`n")

$n1_Sparks = MakeNode "KunaiShadowSparks" (@(
    (XmlCommon -maxGen 16 -life 18 -lifeSpread 5 -genTime 0.25 -genOffset 1),
    (XmlLocPVA 0 1.05 1.15 0.5 0.25 0.35 0 0.04 0.12 0.14 0.09 0.10 0 -0.005 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.36 0.05 0.08 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_spark.png" 2 1 8),
    (XmlDrawSprite 4 233 213 255 255 168 85 247 0 0.22 0.85)
) -join "`n")

SaveEfkProj "ninja_basic_slash.efkproj" 26 ($n1_InkShadow, $n1_PrimaryViolet, $n1_CyanOffhand, $n1_Sparks -join "`n")

# ============================================================================
# 2. ninja_heavy_backstab.efkproj - Heavy Attack: Shadow Backstab (X-Cross Fang!)
# ============================================================================
$n2_CrossFangInk = MakeNode "BackstabInkCross" (@(
    (XmlCommon -maxGen 1 -life 24 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.12 0.85),
    (XmlRotPVA 0 0 0 0 0 15 0 0 1.5),
    (XmlScaleSingleEasing 0.8 3.2 0 0 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/cross_fang.png" 1 1 12),
    (XmlDrawSprite 0 42 12 72 230 18 5 35 0)
) -join "`n")

$n2_CrossFangNeon = MakeNode "BackstabCrimsonCross" (@(
    (XmlCommon -maxGen 1 -life 22 -genTime 1 -genOffset 1),
    (XmlLocFixed 0 1.12 0.90),
    (XmlRotPVA 0 0 0 0 0 12 0 0 2),
    (XmlScaleSingleEasing 0.7 2.9 0 0 30 -25),
    (XmlGenPoint),
    (XmlRendererCommon "textures/cross_fang.png" 2 1 11),
    (XmlDrawSprite 0 255 190 235 255 244 63 94 0)
) -join "`n")

$n2_ShadowMist = MakeNode "BackstabMistBurst" (@(
    (XmlCommon -maxGen 10 -life 28 -lifeSpread 6 -genTime 0.3 -genOffset 0),
    (XmlLocPVA 0 0.9 0.4 0.5 0.5 0.4 0 0.04 0 0.10 0.05 0.10),
    (XmlRotPVA 0 0 0 0 0 180 0 0 3 0 0 2),
    (XmlScaleSingleEasing 0.7 2.0 0.2 0.4 20 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_smoke.png" 1 2 14),
    (XmlDrawSprite 0 58 24 98 195 25 10 48 0)
) -join "`n")

$n2_FloorSeal = MakeNode "BackstabSealRing" (@(
    (XmlCommon -maxGen 1 -life 28 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.06 0.45),
    (XmlRotPVA 90 0 0 0 0 0 0 0 3.5),
    (XmlScaleSingleEasing 0.6 3.2 0 0 26 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shinobi_seal.png" 2 1 14),
    (XmlDrawSprite 2 216 140 255 240 124 58 237 0)
) -join "`n")

$n2_LethalFlare = MakeNode "BackstabHitFlare" (@(
    (XmlCommon -maxGen 1 -life 15 -genTime 1 -genOffset 1),
    (XmlLocFixed 0 1.12 0.95),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.8 3.1 0 0 30 -25),
    (XmlGenPoint),
    (XmlRendererCommon "textures/crimson_flare.png" 2 1 9),
    (XmlDrawSprite 0 255 235 250 255 244 63 94 0)
) -join "`n")

$n2_Sparks = MakeNode "BackstabShards" (@(
    (XmlCommon -maxGen 26 -life 24 -lifeSpread 6 -genTime 0.15 -genOffset 1),
    (XmlLocPVA 0 1.10 0.90 0.3 0.3 0.3 0 0.06 0.10 0.20 0.14 0.18 0 -0.007 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.48 0.05 0.12 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_spark.png" 2 1 10),
    (XmlDrawSprite 4 255 180 225 255 168 85 247 0 0.20 0.95)
) -join "`n")

SaveEfkProj "ninja_heavy_backstab.efkproj" 38 ($n2_CrossFangInk, $n2_CrossFangNeon, $n2_ShadowMist, $n2_FloorSeal, $n2_LethalFlare, $n2_Sparks -join "`n")

# ============================================================================
# 3. ninja_skill_weapon_izuna.efkproj - [Q/SD] Izuna Blade Storm (6-Hit Omnislash + Tornado)
# ============================================================================
$n3_GroundSeal = MakeNode "IzunaShinobiSeal" (@(
    (XmlCommon -maxGen 1 -life 58 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.06 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 4.0),
    (XmlScaleSingleEasing 1.0 6.2 0 0 26 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shinobi_seal.png" 2 2 20),
    (XmlDrawSprite 2 192 132 252 250 109 40 217 0)
) -join "`n")

$n3_OmnislashArcs = MakeNode "IzunaSixHitSlashes" (@(
    (XmlCommon -maxGen 8 -life 20 -lifeSpread 4 -genTime 3.5 -genOffset 1),
    (XmlLocPVA 0 1.35 0 0.85 0.75 0.85 0 0.05 0 0.04 0.04 0.04),
    (XmlRotPVA 0 0 0 85 180 180 0 0 14 0 0 6),
    (XmlScaleSingleEasing 2.2 4.0 0.4 0.6 26 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_slash.png" 2 1 10),
    (XmlDrawSprite 2 233 213 255 255 168 85 247 0)
) -join "`n")

$n3_CrossCage = MakeNode "IzunaCrossCageFlashes" (@(
    (XmlCommon -maxGen 6 -life 18 -lifeSpread 3 -genTime 4.5 -genOffset 2),
    (XmlLocPVA 0 1.45 0 1.1 0.8 1.1 0 0.04 0 0.03 0.02 0.03),
    (XmlRotPVA 0 0 0 0 0 180 0 0 4),
    (XmlScaleSingleEasing 1.2 3.2 0.3 0.5 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/cross_fang.png" 2 1 9),
    (XmlDrawSprite 0 245 170 255 255 244 63 94 0)
) -join "`n")

$n3_ShadowTornado = MakeNode "IzunaLaunchTornado3D" (@(
    (XmlCommon -maxGen 1 -life 52 -genTime 1 -genOffset 3),
    (XmlLocFixed 0 0.05 0),
    (XmlRotPVA -90 0 0 0 0 0 0 0 14),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_vortex.png" 2 3 18),
    (XmlDrawRing -billboard 2 -vertexCount 32 -viewingAngle 360 `
        -outerSX 0.8 -outerSY 0.0 -outerEX 2.4 -outerEY 0.0 `
        -innerSX 1.2 -innerSY 1.6 -innerEX 3.3 -innerEY 4.6 `
        -centerRatio 0.5 `
        -or 124 -og 58 -ob 237 -oa 0 `
        -csr 216 -csg 180 -csb 254 -csa 235 `
        -cer 147 -ceg 51 -ceb 234 -cea 0 `
        -ir 56 -ig 189 -ib 248 -ia 0)
) -join "`n")

$n3_UpwardSparks = MakeNode "IzunaStormSparks" (@(
    (XmlCommon -maxGen 40 -life 32 -lifeSpread 8 -genTime 0.8 -genOffset 1),
    (XmlLocPVA 0 0.4 0 0 0 0 0 0.14 0 0.08 0.06 0.08 0 0.001 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.46 0.06 0.12 0.02 10 -15),
    (XmlGenCircle 2.2 0.8 16 0 $false),
    (XmlRendererCommon "textures/kunai_spark.png" 2 2 12),
    (XmlDrawSprite 4 233 213 255 255 56 189 248 0 0.20 0.90)
) -join "`n")

SaveEfkProj "ninja_skill_weapon_izuna.efkproj" 64 ($n3_GroundSeal, $n3_OmnislashArcs, $n3_CrossCage, $n3_ShadowTornado, $n3_UpwardSparks -join "`n")

# ============================================================================
# 4. ninja_skill_armor_smokebomb.efkproj - [E/ASD] Smoke Bomb Stealth
# ============================================================================
$n4_DarkSmokeDome = MakeNode "SmokeBombDarkClouds" (@(
    (XmlCommon -maxGen 18 -life 62 -lifeSpread 12 -genTime 0.45 -genOffset 1),
    (XmlLocPVA 0 0.45 0 0.65 0.25 0.65 0 0.035 0 0.08 0.03 0.08 0 -0.0005 0),
    (XmlRotPVA 0 0 0 0 0 180 0 0 2.2 0 0 1.8),
    (XmlScaleSingleEasing 1.0 3.6 0.35 0.7 24 -22),
    (XmlGenCircle 1.4 0.8 18 0 $false),
    (XmlRendererCommon "textures/shadow_smoke.png" 1 3 24),
    (XmlDrawSprite 0 68 38 112 225 32 16 60 0)
) -join "`n")

$n4_MysticMist = MakeNode "SmokeBombVioletRim" (@(
    (XmlCommon -maxGen 10 -life 52 -lifeSpread 10 -genTime 0.6 -genOffset 2),
    (XmlLocPVA 0 0.75 0 0.8 0.35 0.8 0 0.04 0 0.06 0.03 0.06),
    (XmlRotPVA 0 0 0 0 0 180 0 0 -2.5 0 0 1.5),
    (XmlScaleSingleEasing 1.2 3.8 0.3 0.6 22 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_smoke.png" 2 3 22),
    (XmlDrawSprite 0 168 85 247 175 109 40 217 0)
) -join "`n")

$n4_StunRing = MakeNode "SmokeBombStunWave" (@(
    (XmlCommon -maxGen 2 -life 30 -genTime 5 -genOffset 0),
    (XmlLocFixed 0 0.12 0),
    (XmlRotFixed -90 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_ring.png" 2 1 14),
    (XmlDrawRing -billboard 2 -vertexCount 36 -viewingAngle 360 `
        -outerSX 0.6 -outerSY 0 -outerEX 4.2 -outerEY 0.25 `
        -innerSX 0.2 -innerSY 0 -innerEX 3.3 -innerEY 0 `
        -centerRatio 0.55 `
        -or 124 -og 58 -ob 237 -oa 0 `
        -csr 233 -csg 213 -csb 255 -csa 255 `
        -cer 139 -ceg 92 -ceb 246 -cea 0 `
        -ir 76 -ig 29 -ib 149 -ia 0)
) -join "`n")

$n4_StealthSeal = MakeNode "StealthKujiSeal" (@(
    (XmlCommon -maxGen 1 -life 64 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.06 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 -2.8),
    (XmlScaleSingleEasing 1.0 5.6 0 0 24 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shinobi_seal.png" 2 3 22),
    (XmlDrawSprite 2 196 140 255 240 124 58 237 0)
) -join "`n")

$n4_Flash = MakeNode "SmokeBombDetonateFlash" (@(
    (XmlCommon -maxGen 1 -life 16 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.85 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.8 4.2 0 0 30 -25),
    (XmlGenPoint),
    (XmlRendererCommon "textures/crimson_flare.png" 2 1 10),
    (XmlDrawSprite 0 245 230 255 255 168 85 247 0)
) -join "`n")

SaveEfkProj "ninja_skill_armor_smokebomb.efkproj" 75 ($n4_DarkSmokeDome, $n4_MysticMist, $n4_StunRing, $n4_StealthSeal, $n4_Flash -join "`n")

# ============================================================================
# 5. ninja_skill_helmet_shuriken.efkproj - [R/AD] Fuuma Shuriken Fan (5 Giant Shurikens!)
# ============================================================================
$n5_ShurikenNodes = @()
$fanAngles = @(-25.2, -12.6, 0.0, 12.6, 25.2)
for ($i = 0; $i -lt 5; $i++) {
    $deg = $fanAngles[$i]
    $rad = $deg * [Math]::PI / 180.0
    $vx = [Math]::Round([Math]::Sin($rad) * 0.30, 4)
    $vz = [Math]::Round([Math]::Cos($rad) * 0.30, 4)
    $n5_ShurikenNodes += MakeNode "FuumaShuriken_$($i+1)" (@(
        (XmlCommon -maxGen 1 -life 38 -genTime 1 -genOffset 2),
        (XmlLocPVA 0 1.05 0.65 0 0 0 $vx 0 $vz 0 0 0),
        (XmlRotPVA 90 0 0 0 0 0 0 0 28),
        (XmlScaleSingleEasing 1.15 1.85 0 0 24 -18),
        (XmlGenPoint),
        (XmlRendererCommon "textures/shuriken_glint.png" 2 1 10),
        (XmlDrawSprite 2 240 215 255 255 168 85 247 0)
    ) -join "`n")
}

$n5_FanWave = MakeNode "ShurikenFanLaunchArc" (@(
    (XmlCommon -maxGen 1 -life 22 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.05 0.45),
    (XmlRotFixed -90 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_vortex.png" 2 1 12),
    (XmlDrawRing -billboard 2 -vertexCount 28 -viewingAngle 95 `
        -outerSX 0.8 -outerSY 0 -outerEX 3.6 -outerEY 0 `
        -innerSX 0.3 -innerSY 0 -innerEX 2.6 -innerEY 0 `
        -centerRatio 0.6 `
        -or 192 -og 132 -ob 252 -oa 0 `
        -csr 245 -csg 235 -csb 255 -csa 255 `
        -cer 147 -ceg 51 -ceb 234 -cea 0 `
        -ir 56 -ig 189 -ib 248 -ia 0)
) -join "`n")

$n5_LaunchSparks = MakeNode "ShurikenFanSparks" (@(
    (XmlCommon -maxGen 26 -life 22 -lifeSpread 6 -genTime 0.2 -genOffset 1),
    (XmlLocPVA 0 1.05 0.90 0.4 0.2 0.2 0 0.03 0.22 0.16 0.06 0.08 0 -0.003 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.42 0.05 0.10 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_spark.png" 2 1 10),
    (XmlDrawSprite 4 233 213 255 255 56 189 248 0 0.20 0.90)
) -join "`n")

SaveEfkProj "ninja_skill_helmet_shuriken.efkproj" 48 (($n5_ShurikenNodes + @($n5_FanWave, $n5_LaunchSparks)) -join "`n")

# ============================================================================
# 6. ninja_skill_trinket_substitution.efkproj - [F/AS] Explosive Substitution (Kawarimi Bomb)
# ============================================================================
$n6_SwapPoof = MakeNode "KawarimiSwapPoof" (@(
    (XmlCommon -maxGen 10 -life 24 -lifeSpread 5 -genTime 0.25 -genOffset 0),
    (XmlLocPVA 0 0.85 0 0.35 0.35 0.35 0 0.04 0 0.08 0.05 0.08),
    (XmlRotPVA 0 0 0 0 0 180 0 0 3),
    (XmlScaleSingleEasing 0.8 2.2 0.2 0.4 24 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_smoke.png" 1 1 12),
    (XmlDrawSprite 0 225 215 240 220 120 95 160 0)
) -join "`n")

$n6_DangerSeal = MakeNode "BombDangerSealFloor" (@(
    (XmlCommon -maxGen 1 -life 34 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.06 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 6.5),
    (XmlScaleSingleEasing 1.2 5.2 0 0 24 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shinobi_seal.png" 2 2 8),
    (XmlDrawSprite 2 251 113 133 245 244 63 94 0)
) -join "`n")

$n6_PaperTalismans = MakeNode "ExplosivePaperTalismans" (@(
    (XmlCommon -maxGen 6 -life 28 -genTime 0.1 -genOffset 1),
    (XmlLocFixed 0 1.05 0),
    (XmlRotPVA 0 0 0 0 0 0 0 6 0),
    (XmlScaleSingleEasing 0.45 1.15 0 0 24 -18),
    (XmlGenCircle 1.25 0 6 1 $true),
    (XmlRendererCommon "textures/paper_talisman.png" 2 2 6),
    (XmlDrawSprite 2 255 200 180 250 244 63 94 0)
) -join "`n")

# Phase 2 Detonation at frame 27 (~0.45s matching server.js triggerAt: now + 450!)
$n6_DetonateRing = MakeNode "TagDetonationWave" (@(
    (XmlCommon -maxGen 2 -life 28 -genTime 4 -genOffset 27),
    (XmlLocFixed 0 0.25 0),
    (XmlRotFixed -90 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_ring.png" 2 1 14),
    (XmlDrawRing -billboard 2 -vertexCount 36 -viewingAngle 360 `
        -outerSX 0.6 -outerSY 0 -outerEX 4.4 -outerEY 0.35 `
        -innerSX 0.2 -innerSY 0 -innerEX 3.4 -innerEY 0 `
        -centerRatio 0.5 `
        -or 244 -og 63 -ob 94 -oa 0 `
        -csr 255 -csg 235 -csb 175 -csa 255 `
        -cer 225 -ceg 29 -ceb 72 -cea 0 `
        -ir 251 -ig 146 -ib 60 -ia 0)
) -join "`n")

$n6_DetonateFlare = MakeNode "TagDetonationFlare" (@(
    (XmlCommon -maxGen 1 -life 20 -genTime 1 -genOffset 27),
    (XmlLocFixed 0 1.05 0),
    (XmlRotPVA 0 0 0 0 0 45 0 0 10),
    (XmlScaleSingleEasing 1.0 5.0 0 0 30 -25),
    (XmlGenPoint),
    (XmlRendererCommon "textures/crimson_flare.png" 2 1 12),
    (XmlDrawSprite 0 255 245 215 255 244 63 94 0)
) -join "`n")

$n6_DetonateEmbers = MakeNode "TagDetonationEmbers" (@(
    (XmlCommon -maxGen 32 -life 30 -lifeSpread 8 -genTime 0.15 -genOffset 27),
    (XmlLocPVA 0 0.85 0 0.3 0.3 0.3 0 0.12 0 0.24 0.14 0.24 0 -0.009 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.52 0.06 0.14 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_spark.png" 2 1 12),
    (XmlDrawSprite 4 255 210 140 255 244 63 94 0 0.22 0.90)
) -join "`n")

SaveEfkProj "ninja_skill_trinket_substitution.efkproj" 65 ($n6_SwapPoof, $n6_DangerSeal, $n6_PaperTalismans, $n6_DetonateRing, $n6_DetonateFlare, $n6_DetonateEmbers -join "`n")

# ============================================================================
# 7. ninja_mobility_shadowstep.efkproj - Shadow Teleport / Air Dash / Triple Jump
# ============================================================================
$n7_StepSeal = MakeNode "ShadowStepSeal" (@(
    (XmlCommon -maxGen 1 -life 24 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.12 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 5),
    (XmlScaleSingleEasing 0.5 2.6 0 0 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shinobi_seal.png" 2 1 12),
    (XmlDrawSprite 2 192 132 252 245 109 40 217 0)
) -join "`n")

$n7_StepMist = MakeNode "ShadowStepMist" (@(
    (XmlCommon -maxGen 8 -life 22 -lifeSpread 5 -genTime 0.3 -genOffset 0),
    (XmlLocPVA 0 0.75 0 0.35 0.35 0.35 0 0.05 0 0.08 0.05 0.08),
    (XmlRotPVA 0 0 0 0 0 180 0 0 3),
    (XmlScaleSingleEasing 0.6 1.8 0.15 0.3 22 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shadow_smoke.png" 1 1 12),
    (XmlDrawSprite 0 60 24 102 210 24 8 45 0)
) -join "`n")

$n7_StepSparks = MakeNode "ShadowStepSparks" (@(
    (XmlCommon -maxGen 16 -life 20 -lifeSpread 5 -genTime 0.2 -genOffset 0),
    (XmlLocPVA 0 0.85 0 0.25 0.3 0.25 0 0.06 0 0.14 0.10 0.14 0 -0.005 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.38 0.05 0.08 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/kunai_spark.png" 2 1 10),
    (XmlDrawSprite 4 216 180 254 255 124 58 237 0 0.20 0.85)
) -join "`n")

SaveEfkProj "ninja_mobility_shadowstep.efkproj" 30 ($n7_StepSeal, $n7_StepMist, $n7_StepSparks -join "`n")

Write-Host "Done! All 7 Shadow Ninja .efkproj files generated and XML-validated in: $OutDir"
