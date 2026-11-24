# ============================================================================
# LOST SAGA 3D - IRON KNIGHT EFFEKSEER (.efkproj) VFX SUITE GENERATOR
# ============================================================================
# Generates 7 multi-layered 3D Effekseer project files compatible with
# Effekseer 1.80.8 (GUI & CUI compiler) and EffekseerForWebGL 1.80.8:
#   1. knight_basic_slash.efkproj           (3-hit Broadsword Combo Slash)
#   2. knight_heavy_shield_bash.efkproj     (Heavy Attack: Shield Bash / Guard Break)
#   3. knight_skill_weapon_excalibur.efkproj (Q/SD Weapon Skill: Excalibur Wave)
#   4. knight_skill_armor_aegis.efkproj     (E/ASD Armor Skill: Aegis Fortress)
#   5. knight_skill_helmet_lionheart.efkproj (R/AD Helmet Skill: Lionheart Warcry)
#   6. knight_skill_trinket_chariot.efkproj (F/AS Trinket Skill: Chariot Rush)
#   7. knight_hit_guard_parry.efkproj       (Shield Block / Perfect Parry Impact)
#
# Coordinate convention (Effekseer standard right-handed 3D):
#   +X = Right, +Y = Up (Ground = 0, Knight Chest = ~1.1), +Z = Forward facing
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\knight")
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# ----------------------------------------------------------------------------
# XML HELPER BUILDERS (Verified EffekseerCore v1.43..1.80 Schema)
# ----------------------------------------------------------------------------
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

function XmlColorFixed($tag, $r, $g, $b, $a = 255) {
    return "<$tag><R>$r</R><G>$g</G><B>$b</B><A>$a</A></$tag>"
}

function XmlColorEasing($tag, $sr, $sg, $sb, $sa, $er, $eg, $eb, $ea) {
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

function XmlLocFixed($x, $y, $z) {
    return @"
      <LocationValues>
        <Type>0</Type>
        <Fixed>
          <Location><X>$x</X><Y>$y</Y><Z>$z</Z></Location>
        </Fixed>
      </LocationValues>
"@
}

function XmlLocPVA($lx, $ly, $lz, $lsx, $lsy, $lsz, $vx, $vy, $vz, $vsx, $vsy, $vsz, $ax = 0, $ay = 0, $az = 0) {
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

function XmlLocEasing($sx, $sy, $sz, $ex, $ey, $ez, $startSpd = 20, $endSpd = -20) {
    return @"
      <LocationValues>
        <Type>2</Type>
        <Easing>
          $(XmlVec3Range 'Start' $sx $sy $sz 0 0 0)
          $(XmlVec3Range 'End' $ex $ey $ez 0 0 0)
          <StartSpeed>$startSpd</StartSpeed>
          <EndSpeed>$endSpd</EndSpeed>
        </Easing>
      </LocationValues>
"@
}

function XmlRotFixed($x, $y, $z) {
    return @"
      <RotationValues>
        <Type>0</Type>
        <Fixed>
          <Rotation><X>$x</X><Y>$y</Y><Z>$z</Z></Rotation>
        </Fixed>
      </RotationValues>
"@
}

function XmlRotPVA($rx, $ry, $rz, $rsx, $rsy, $rsz, $vx, $vy, $vz, $vsx = 0, $vsy = 0, $vsz = 0) {
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

function XmlRotEasing($sx, $sy, $sz, $ex, $ey, $ez, $startSpd = 20, $endSpd = -20) {
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

function XmlScaleFixed($x, $y, $z) {
    return @"
      <ScalingValues>
        <Type>0</Type>
        <Fixed>
          <Scale><X>$x</X><Y>$y</Y><Z>$z</Z></Scale>
        </Fixed>
      </ScalingValues>
"@
}

function XmlScaleEasing3($sx, $sy, $sz, $ex, $ey, $ez, $startSpd = 20, $endSpd = -20) {
    return @"
      <ScalingValues>
        <Type>2</Type>
        <Easing>
          $(XmlVec3Range 'Start' $sx $sy $sz 0 0 0)
          $(XmlVec3Range 'End' $ex $ey $ez 0 0 0)
          <StartSpeed>$startSpd</StartSpeed>
          <EndSpeed>$endSpd</EndSpeed>
        </Easing>
      </ScalingValues>
"@
}

function XmlScaleSingleEasing($s, $e, $sSpread = 0, $eSpread = 0, $startSpd = 20, $endSpd = -20) {
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

function XmlGenSphere($radius, $radiusSpread = 0, $effectsRot = $true) {
    $er = if ($effectsRot) { "True" } else { "False" }
    return @"
      <GenerationLocationValues>
        <EffectsRotation>$er</EffectsRotation>
        <Type>1</Type>
        <Sphere>
          $(XmlRange 'Radius' $radius $radiusSpread)
          $(XmlRange 'RotationX' 0 180)
          $(XmlRange 'RotationY' 0 180)
        </Sphere>
      </GenerationLocationValues>
"@
}

function XmlGenCircle($radius, $radiusSpread = 0, $division = 16, $type = 0, $effectsRot = $true) {
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

function XmlRendererCommon($texPath, [int]$alphaBlend = 2, [int]$fadeIn = 3, [int]$fadeOut = 10, [bool]$zTest = $true) {
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

function XmlDrawNone() {
    return @"
      <DrawingValues>
        <Type>0</Type>
      </DrawingValues>
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
    $or = 255, $og = 200, $ob = 50, $oa = 0,
    $csr = 255, $csg = 235, $csb = 140, $csa = 255,
    $cer = 255, $ceg = 170, $ceb = 30, $cea = 0,
    $ir = 255, $ig = 240, $ib = 180, $ia = 0,
    [int]$startSpd = 20, [int]$endSpd = -20
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

function XmlDrawRibbon($sr, $sg, $sb, $sa, $er, $eg, $eb, $ea, [double]$halfWidth = 0.25) {
    $l = -$halfWidth; $r = $halfWidth
    return @"
      <DrawingValues>
        <Type>3</Type>
        <Ribbon>
          <ColorAll>2</ColorAll>
          $(XmlColorEasing 'ColorAll_Easing' $sr $sg $sb $sa $er $eg $eb $ea)
          <Position>1</Position>
          <Position_Fixed><L>$l</L><R>$r</R></Position_Fixed>
        </Ribbon>
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

function SaveEfkProj($fileName, [int]$endFrame, $nodesXml, [bool]$isLoop = $true) {
    $loopStr = if ($isLoop) { "True" } else { "False" }
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
  <IsLoop>$loopStr</IsLoop>
</EffekseerProject>
"@
    # Validate XML structure strictly before saving
    $doc = New-Object System.Xml.XmlDocument
    $doc.LoadXml($xmlText)

    $fullPath = Join-Path $OutDir $fileName
    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($fullPath, $xmlText, $utf8NoBom)
    Write-Host "  [OK] $fileName ($endFrame frames)"
}

Write-Host "Generating Iron Knight Effekseer (.efkproj) VFX Suite..."

# ============================================================================
# 1. knight_basic_slash.efkproj - 3-Hit Broadsword Combo Slash
# ============================================================================
$n1_PrimaryArc = MakeNode "PrimaryGoldenArc" (@(
    (XmlCommon -maxGen 1 -life 16 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.15 0.55),
    (XmlRotEasing 82 14 15 82 14 168 28 -25),
    (XmlScaleSingleEasing 2.2 3.1 0 0 25 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/slash_crescent.png" 2 1 8),
    (XmlDrawSprite 2 255 245 180 255 255 180 40 0)
) -join "`n")

$n1_SapphireUnderArc = MakeNode "SapphireTrailArc" (@(
    (XmlCommon -maxGen 1 -life 20 -genTime 1 -genOffset 1),
    (XmlLocFixed 0 1.12 0.50),
    (XmlRotEasing 84 14 5 84 14 158 22 -24),
    (XmlScaleSingleEasing 2.5 3.4 0 0 22 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/slash_crescent.png" 2 2 11),
    (XmlDrawSprite 2 96 190 255 230 37 99 235 0)
) -join "`n")

$n1_3DSlashRing = MakeNode "BladeSweepRing3D" (@(
    (XmlCommon -maxGen 1 -life 18 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.15 0.45),
    (XmlRotEasing -80 -12 -65 -80 -12 115 25 -22),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/energy_ribbon.png" 2 1 10),
    (XmlDrawRing -billboard 2 -vertexCount 24 -viewingAngle 165 `
        -outerSX 1.25 -outerSY 0 -outerEX 2.05 -outerEY 0.12 `
        -innerSX 0.65 -innerSY 0 -innerEX 1.65 -innerEY 0 `
        -centerRatio 0.72 `
        -or 255 -og 210 -ob 60 -oa 0 `
        -csr 255 -csg 252 -csb 220 -csa 255 `
        -cer 255 -ceg 175 -ceb 35 -cea 0 `
        -ir 56 -ig 189 -ib 248 -ia 0)
) -join "`n")

$n1_TipFlash = MakeNode "ImpactTipFlare" (@(
    (XmlCommon -maxGen 1 -life 12 -genTime 1 -genOffset 3),
    (XmlLocFixed 0.25 1.18 1.75),
    (XmlRotPVA 0 0 0 0 0 45 0 0 14),
    (XmlScaleSingleEasing 0.4 1.65 0 0 25 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/starburst_flare.png" 2 1 8),
    (XmlDrawSprite 0 255 255 230 255 251 191 36 0)
) -join "`n")

$n1_Sparks = MakeNode "GoldenSlashSparks" (@(
    (XmlCommon -maxGen 18 -life 22 -lifeSpread 6 -genTime 0.35 -genOffset 2),
    (XmlLocPVA 0 1.15 1.35 0.6 0.25 0.45 0 0.04 0.10 0.14 0.08 0.10 0 -0.006 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.38 0.06 0.10 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 1 10),
    (XmlDrawSprite 4 255 245 170 255 245 158 11 0 0.28 0.75)
) -join "`n")

SaveEfkProj "knight_basic_slash.efkproj" 30 ($n1_PrimaryArc, $n1_SapphireUnderArc, $n1_3DSlashRing, $n1_TipFlash, $n1_Sparks -join "`n")

# ============================================================================
# 2. knight_heavy_shield_bash.efkproj - Heavy Attack: Shield Bash (Guard Break!)
# ============================================================================
$n2_HexShieldCrest = MakeNode "AegisBashCrest" (@(
    (XmlCommon -maxGen 1 -life 28 -genTime 1 -genOffset 0),
    (XmlLocEasing 0 1.10 0.55 0 1.10 2.15 26 -24),
    (XmlRotEasing 0 0 -15 0 0 10 20 -20),
    (XmlScaleSingleEasing 0.65 2.45 0 0 28 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/hex_aegis_shield.png" 2 2 14),
    (XmlDrawSprite 2 180 235 255 255 56 189 248 0)
) -join "`n")

$n2_GoldenGuardBreakCrest = MakeNode "GuardBreakGoldEcho" (@(
    (XmlCommon -maxGen 1 -life 24 -genTime 1 -genOffset 2),
    (XmlLocEasing 0 1.10 0.85 0 1.10 2.55 28 -25),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.85 3.10 0 0 26 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/hex_aegis_shield.png" 2 1 14),
    (XmlDrawSprite 2 255 235 120 240 245 158 11 0)
) -join "`n")

$n2_ForwardSonicRing = MakeNode "ShieldImpactShockwave" (@(
    (XmlCommon -maxGen 2 -life 24 -genTime 4 -genOffset 1),
    (XmlLocEasing 0 1.10 1.05 0 1.10 2.35 22 -20),
    (XmlRotFixed 0 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 12),
    (XmlDrawRing -billboard 2 -vertexCount 32 -viewingAngle 360 `
        -outerSX 0.45 -outerSY 0 -outerEX 2.65 -outerEY 0.35 `
        -innerSX 0.15 -innerSY 0 -innerEX 1.95 -innerEY -0.15 `
        -centerRatio 0.55 `
        -or 251 -og 191 -ob 36 -oa 0 `
        -csr 255 -csg 250 -csb 210 -csa 255 `
        -cer 56 -ceg 189 -ceb 248 -cea 0 `
        -ir 37 -ig 99 -ib 235 -ia 0)
) -join "`n")

$n2_GroundSlamRing = MakeNode "GroundBracingWave" (@(
    (XmlCommon -maxGen 1 -life 26 -genTime 1 -genOffset 1),
    (XmlLocFixed 0 0.06 1.25),
    (XmlRotFixed 90 0 0),
    (XmlScaleSingleEasing 0.6 3.6 0 0 26 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 14),
    (XmlDrawSprite 2 255 224 100 220 234 140 20 0)
) -join "`n")

$n2_FlashCore = MakeNode "GuardBreakStarburst" (@(
    (XmlCommon -maxGen 1 -life 16 -genTime 1 -genOffset 2),
    (XmlLocFixed 0 1.10 1.60),
    (XmlRotPVA 0 0 0 0 0 180 0 0 10),
    (XmlScaleSingleEasing 0.6 2.85 0 0 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/starburst_flare.png" 2 1 10),
    (XmlDrawSprite 0 255 255 240 255 251 191 36 0)
) -join "`n")

$n2_DebrisSparks = MakeNode "GuardBreakSparks" (@(
    (XmlCommon -maxGen 28 -life 28 -lifeSpread 8 -genTime 0.2 -genOffset 2),
    (XmlLocPVA 0 1.10 1.50 0.35 0.35 0.20 0 0.05 0.16 0.18 0.14 0.12 0 -0.008 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.50 0.06 0.14 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 1 12),
    (XmlDrawSprite 4 255 248 180 255 56 189 248 0 0.25 0.85)
) -join "`n")

SaveEfkProj "knight_heavy_shield_bash.efkproj" 42 ($n2_HexShieldCrest, $n2_GoldenGuardBreakCrest, $n2_ForwardSonicRing, $n2_GroundSlamRing, $n2_FlashCore, $n2_DebrisSparks -join "`n")

# ============================================================================
# 3. knight_skill_weapon_excalibur.efkproj - [Q/SD] Excalibur Wave
# ============================================================================
$n3_GroundRune = MakeNode "CastSanctuaryRune" (@(
    (XmlCommon -maxGen 1 -life 45 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.05 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 2.4),
    (XmlScaleSingleEasing 0.5 3.6 0 0 24 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_rune_circle.png" 2 3 18),
    (XmlDrawSprite 2 255 235 130 245 245 158 11 0)
) -join "`n")

$n3_CoreWave = MakeNode "ExcaliburBladeCore" (@(
    (XmlCommon -maxGen 1 -life 48 -genTime 1 -genOffset 4),
    (XmlLocPVA 0 1.45 0.90 0 0 0 0 0.006 0.28 0 0 0 0 0 0.004),
    (XmlRotFixed 0 -90 0),
    (XmlScaleEasing3 1.4 1.6 1.4 3.4 4.2 2.4 20 -18),
    (XmlGenPoint),
    (XmlRendererCommon "textures/slash_crescent.png" 2 2 14),
    (XmlDrawSprite 2 255 255 235 255 255 215 65 0)
) -join "`n")

$n3_AuraWaveLeft = MakeNode "ExcaliburGoldenHaloL" (@(
    (XmlCommon -maxGen 1 -life 50 -genTime 1 -genOffset 5),
    (XmlLocPVA -0.18 1.45 0.78 0 0 0 0 0.006 0.28 0 0 0 0 0 0.004),
    (XmlRotFixed 0 -82 0),
    (XmlScaleEasing3 1.6 1.8 1.6 3.8 4.6 2.6 18 -18),
    (XmlGenPoint),
    (XmlRendererCommon "textures/slash_crescent.png" 2 3 16),
    (XmlDrawSprite 2 255 210 60 220 245 130 15 0)
) -join "`n")

$n3_AuraWaveRight = MakeNode "ExcaliburGoldenHaloR" (@(
    (XmlCommon -maxGen 1 -life 50 -genTime 1 -genOffset 5),
    (XmlLocPVA 0.18 1.45 0.78 0 0 0 0 0.006 0.28 0 0 0 0 0 0.004),
    (XmlRotFixed 0 -98 0),
    (XmlScaleEasing3 1.6 1.8 1.6 3.8 4.6 2.6 18 -18),
    (XmlGenPoint),
    (XmlRendererCommon "textures/slash_crescent.png" 2 3 16),
    (XmlDrawSprite 2 255 210 60 220 245 130 15 0)
) -join "`n")

# Invisible carrier moves forward with the Excalibur wave & sheds golden holy sparks + ground wake!
$n3_WakeSparks = MakeNode "ExcaliburTrailSparks" (@(
    (XmlCommon -maxGen 42 -life 24 -lifeSpread 6 -genTime 0.9 -genOffset 0 -locBind 1 -rotBind 1 -scaleBind 1),
    (XmlLocPVA 0 0 0 0.45 1.10 0.35 0 0.09 -0.05 0.08 0.06 0.04 0 -0.003 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.45 0.06 0.15 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 2 10),
    (XmlDrawSprite 4 255 250 190 255 251 191 36 0 0.25 0.85)
) -join "`n")

$n3_GroundWake = MakeNode "ExcaliburGroundWake" (@(
    (XmlCommon -maxGen 14 -life 20 -lifeSpread 4 -genTime 2.5 -genOffset 0 -locBind 1 -rotBind 1 -scaleBind 1),
    (XmlLocFixed 0 -1.35 0),
    (XmlRotPVA 90 0 0 0 0 180 0 0 2),
    (XmlScaleSingleEasing 0.5 2.4 0.15 0.3 22 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 11),
    (XmlDrawSprite 2 255 225 110 210 245 158 11 0)
) -join "`n")

$n3_WaveCarrier = MakeNode "ExcaliburCarrier" (@(
    (XmlCommon -maxGen 1 -life 44 -genTime 1 -genOffset 4),
    (XmlLocPVA 0 1.40 0.85 0 0 0 0 0 0.28 0 0 0 0 0 0.004),
    (XmlRotFixed 0 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlDrawNone)
) -join "`n") ($n3_WakeSparks, $n3_GroundWake -join "`n")

$n3_CastFlash = MakeNode "ExcaliburCastFlash" (@(
    (XmlCommon -maxGen 1 -life 18 -genTime 1 -genOffset 3),
    (XmlLocFixed 0 1.40 0.90),
    (XmlRotPVA 0 0 0 0 0 30 0 0 12),
    (XmlScaleSingleEasing 0.8 3.6 0 0 26 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/starburst_flare.png" 2 1 12),
    (XmlDrawSprite 0 255 255 235 255 251 191 36 0)
) -join "`n")

SaveEfkProj "knight_skill_weapon_excalibur.efkproj" 65 ($n3_GroundRune, $n3_CoreWave, $n3_AuraWaveLeft, $n3_AuraWaveRight, $n3_WaveCarrier, $n3_CastFlash -join "`n")

# ============================================================================
# 4. knight_skill_armor_aegis.efkproj - [E/ASD] Aegis Fortress (Knockback + Super Armor)
# ============================================================================
$n4_GroundRune = MakeNode "AegisSanctuaryFloor" (@(
    (XmlCommon -maxGen 1 -life 82 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.05 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 1.8),
    (XmlScaleSingleEasing 0.8 5.4 0 0 24 -22),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_rune_circle.png" 2 4 22),
    (XmlDrawSprite 2 125 215 255 245 37 99 235 0)
) -join "`n")

$n4_KnockbackRing = MakeNode "AegisKnockbackWave" (@(
    (XmlCommon -maxGen 1 -life 32 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.45 0),
    (XmlRotFixed -90 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 16),
    (XmlDrawRing -billboard 2 -vertexCount 36 -viewingAngle 360 `
        -outerSX 0.6 -outerSY 0 -outerEX 4.2 -outerEY 0.35 `
        -innerSX 0.2 -innerSY 0 -innerEX 3.3 -innerEY 0 `
        -centerRatio 0.55 `
        -or 56 -og 189 -ob 248 -oa 0 `
        -csr 224 -csg 245 -csb 255 -csa 255 `
        -cer 37 -ceg 99 -ceb 235 -cea 0 `
        -ir 251 -ig 191 -ib 36 -ia 0)
) -join "`n")

$n4_FortressCylinder = MakeNode "AegisBarrierCylinder3D" (@(
    (XmlCommon -maxGen 1 -life 76 -genTime 1 -genOffset 2),
    (XmlLocFixed 0 0.05 0),
    (XmlRotPVA -90 0 0 0 0 0 0 0 -2.5),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/energy_ribbon.png" 2 5 24),
    (XmlDrawRing -billboard 2 -vertexCount 32 -viewingAngle 360 `
        -outerSX 0.8 -outerSY 0.0 -outerEX 2.35 -outerEY 0.0 `
        -innerSX 0.7 -innerSY 0.8 -innerEX 2.15 -innerEY 2.55 `
        -centerRatio 0.45 `
        -or 96 -og 165 -ob 250 -oa 0 `
        -csr 165 -csg 230 -csb 255 -csa 220 `
        -cer 56 -ceg 189 -ceb 248 -cea 0 `
        -ir 255 -ig 235 -ib 130 -ia 0 `
        -startSpd 24 -endSpd -24)
) -join "`n")

$n4_ShieldPanels = MakeNode "AegisHexShieldWall" (@(
    (XmlCommon -maxGen 6 -life 64 -genTime 0.1 -genOffset 2),
    (XmlLocFixed 0 1.25 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.35 1.35 0 0 24 -22),
    (XmlGenCircle 1.85 0 6 1 $true),
    (XmlRendererCommon "textures/hex_aegis_shield.png" 2 4 22),
    (XmlDrawSprite 2 160 230 255 225 59 130 246 0)
) -join "`n")

# Orbiting Golden Super-Armor Ribbon!
$n4_OrbitRibbon = MakeNode "SuperArmorRibbonTrail" (@(
    (XmlCommon -maxGen 32 -life 24 -genTime 1.5 -genOffset 0 -locBind 1 -rotBind 1 -scaleBind 1),
    (XmlLocFixed 1.45 0 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/energy_ribbon.png" 2 3 10),
    (XmlDrawRibbon 255 240 150 240 56 189 248 0 0.22)
) -join "`n")

$n4_OrbitParent = MakeNode "SuperArmorRibbonSpinner" (@(
    (XmlCommon -maxGen 1 -life 72 -genTime 1 -genOffset 4),
    (XmlLocEasing 0 0.35 0 0 2.05 0 10 -10),
    (XmlRotPVA 0 0 0 0 0 0 0 14 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlDrawNone)
) -join "`n") $n4_OrbitRibbon

$n4_UpwardSparks = MakeNode "PaladinAegisSparks" (@(
    (XmlCommon -maxGen 36 -life 38 -lifeSpread 10 -genTime 1.4 -genOffset 2),
    (XmlLocPVA 0 0.25 0 0 0 0 0 0.08 0 0.03 0.04 0.03 0 0.001 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.42 0.05 0.12 0.02 10 -15),
    (XmlGenCircle 1.75 0.45 18 0 $false),
    (XmlRendererCommon "textures/holy_spark.png" 2 3 14),
    (XmlDrawSprite 4 255 245 170 255 96 165 250 0 0.22 0.72)
) -join "`n")

SaveEfkProj "knight_skill_armor_aegis.efkproj" 90 ($n4_GroundRune, $n4_KnockbackRing, $n4_FortressCylinder, $n4_ShieldPanels, $n4_OrbitParent, $n4_UpwardSparks -join "`n")

# ============================================================================
# 5. knight_skill_helmet_lionheart.efkproj - [R/AD] Lionheart Warcry (Stun + 20 HP Heal)
# ============================================================================
$n5_LionCrestFloor = MakeNode "LionheartWarcryCrest" (@(
    (XmlCommon -maxGen 1 -life 52 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.08 0),
    (XmlRotPVA 90 0 0 0 0 0 0 0 1.6),
    (XmlScaleSingleEasing 0.8 7.6 0 0 26 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/lion_crest_roar.png" 2 2 22),
    (XmlDrawSprite 2 255 230 95 255 245 130 15 0)
) -join "`n")

$n5_RoarWaves = MakeNode "SonicRoarShockwaves" (@(
    (XmlCommon -maxGen 3 -life 34 -genTime 6 -genOffset 0),
    (XmlLocFixed 0 1.05 0),
    (XmlRotFixed -90 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 16),
    (XmlDrawRing -billboard 2 -vertexCount 36 -viewingAngle 360 `
        -outerSX 0.45 -outerSY 0 -outerEX 4.65 -outerEY 0.25 `
        -innerSX 0.15 -innerSY 0 -innerEX 3.70 -innerEY -0.10 `
        -centerRatio 0.55 `
        -or 245 -og 158 -ob 11 -oa 0 `
        -csr 255 -csg 245 -csb 160 -csa 255 `
        -cer 234 -ceg 88 -ceb 12 -cea 0 `
        -ir 255 -ig 220 -ib 90 -ia 0)
) -join "`n")

$n5_SunPillar = MakeNode "LionheartHolyPillar3D" (@(
    (XmlCommon -maxGen 1 -life 48 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 0.05 0),
    (XmlRotPVA -90 0 0 0 0 0 0 0 3.2),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/energy_ribbon.png" 2 3 20),
    (XmlDrawRing -billboard 2 -vertexCount 28 -viewingAngle 360 `
        -outerSX 0.45 -outerSY 0.0 -outerEX 1.45 -outerEY 0.0 `
        -innerSX 0.35 -innerSY 2.0 -innerEX 1.25 -innerEY 5.4 `
        -centerRatio 0.5 `
        -or 251 -og 191 -ob 36 -oa 0 `
        -csr 255 -csg 248 -csb 195 -csa 225 `
        -cer 245 -ceg 158 -ceb 11 -cea 0 `
        -ir 255 -ig 255 -ib 240 -ia 0)
) -join "`n")

$n5_HealCrosses = MakeNode "LionheartHealCrosses" (@(
    (XmlCommon -maxGen 22 -life 44 -lifeSpread 10 -genTime 1.8 -genOffset 4),
    (XmlLocPVA 0 0.25 0 0 0 0 0 0.075 0 0.02 0.025 0.02 0 0.0005 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.22 0.52 0.06 0.12 18 -18),
    (XmlGenCircle 1.25 0.35 12 0 $false),
    (XmlRendererCommon "textures/heal_cross.png" 2 5 16),
    (XmlDrawSprite 0 134 239 172 255 253 224 71 0)
) -join "`n")

$n5_RoarFlash = MakeNode "WarcryBurstFlare" (@(
    (XmlCommon -maxGen 1 -life 22 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.25 0),
    (XmlRotPVA 0 0 0 0 0 45 0 0 8),
    (XmlScaleSingleEasing 0.8 4.4 0 0 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/starburst_flare.png" 2 1 14),
    (XmlDrawSprite 0 255 252 215 255 245 158 11 0)
) -join "`n")

$n5_StunEmbers = MakeNode "WarcryGoldenSparks" (@(
    (XmlCommon -maxGen 32 -life 32 -lifeSpread 8 -genTime 0.3 -genOffset 1),
    (XmlLocPVA 0 1.15 0 0.2 0.2 0.2 0 0.05 0 0.22 0.09 0.22 0 -0.004 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.45 0.06 0.12 0.02 12 -16),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 1 12),
    (XmlDrawSprite 4 255 245 170 255 245 158 11 0 0.25 0.85)
) -join "`n")

SaveEfkProj "knight_skill_helmet_lionheart.efkproj" 75 ($n5_LionCrestFloor, $n5_RoarWaves, $n5_SunPillar, $n5_HealCrosses, $n5_RoarFlash, $n5_StunEmbers -join "`n")

# ============================================================================
# 6. knight_skill_trinket_chariot.efkproj - [F/AS] Chariot Rush (High-Speed Shield Ram)
# ============================================================================
$n6_RamConeOuter = MakeNode "ChariotWindConeOuter3D" (@(
    (XmlCommon -maxGen 1 -life 48 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.05 1.35),
    (XmlRotPVA 0 0 0 0 0 0 0 0 12),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/energy_ribbon.png" 2 3 16),
    (XmlDrawRing -billboard 2 -vertexCount 28 -viewingAngle 360 `
        -outerSX 0.7 -outerSY -1.1 -outerEX 1.95 -outerEY -2.4 `
        -innerSX 0.08 -innerSY 0.35 -innerEX 0.12 -innerEY 0.85 `
        -centerRatio 0.55 `
        -or 37 -og 99 -ob 235 -oa 0 `
        -csr 125 -csg 220 -csb 255 -csa 245 `
        -cer 56 -ceg 189 -ceb 248 -cea 0 `
        -ir 255 -ig 255 -ib 255 -ia 0 `
        -startSpd 24 -endSpd -20)
) -join "`n")

$n6_RamConeGold = MakeNode "ChariotGoldCoreCone3D" (@(
    (XmlCommon -maxGen 1 -life 44 -genTime 1 -genOffset 1),
    (XmlLocFixed 0 1.05 1.45),
    (XmlRotPVA 0 0 0 0 0 0 0 0 -16),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/energy_ribbon.png" 2 2 14),
    (XmlDrawRing -billboard 2 -vertexCount 24 -viewingAngle 360 `
        -outerSX 0.45 -outerSY -0.8 -outerEX 1.35 -outerEY -1.7 `
        -innerSX 0.05 -innerSY 0.25 -innerEX 0.08 -innerEY 0.75 `
        -centerRatio 0.50 `
        -or 245 -og 158 -ob 11 -oa 0 `
        -csr 255 -csg 245 -csb 175 -csa 255 `
        -cer 251 -ceg 191 -ceb 36 -cea 0 `
        -ir 255 -ig 255 -ib 255 -ia 0 `
        -startSpd 26 -endSpd -20)
) -join "`n")

$n6_FrontShieldCrest = MakeNode "ChariotRamShieldFront" (@(
    (XmlCommon -maxGen 1 -life 46 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.05 1.65),
    (XmlRotPVA 0 0 0 0 0 0 0 0 4),
    (XmlScaleSingleEasing 0.9 2.05 0 0 26 -20),
    (XmlGenPoint),
    (XmlRendererCommon "textures/hex_aegis_shield.png" 2 2 14),
    (XmlDrawSprite 2 180 238 255 255 56 189 248 0)
) -join "`n")

$n6_SpeedRings = MakeNode "ChariotMachRings" (@(
    (XmlCommon -maxGen 6 -life 18 -genTime 6 -genOffset 1),
    (XmlLocPVA 0 1.05 1.25 0 0 0 0 0 -0.24 0 0 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleFixed 1 1 1),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 10),
    (XmlDrawRing -billboard 2 -vertexCount 28 -viewingAngle 360 `
        -outerSX 0.75 -outerSY 0 -outerEX 2.25 -outerEY 0 `
        -innerSX 0.45 -innerSY 0 -innerEX 1.85 -innerEY 0 `
        -centerRatio 0.5 `
        -or 56 -og 189 -ob 248 -oa 0 `
        -csr 224 -csg 248 -csb 255 -csa 240 `
        -cer 37 -ceg 99 -ceb 235 -cea 0 `
        -ir 255 -ig 235 -ib 130 -ia 0)
) -join "`n")

$n6_SpeedStreaks = MakeNode "ChariotSpeedLines" (@(
    (XmlCommon -maxGen 45 -life 16 -lifeSpread 4 -genTime 0.9 -genOffset 0),
    (XmlLocPVA 0 1.05 1.15 0.95 0.75 0.35 0 0 -0.34 0.03 0.02 0.06),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.55 0.12 0.15 0.04 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 1 8),
    (XmlDrawSprite 4 210 245 255 255 56 189 248 0 0.16 1.25)
) -join "`n")

$n6_BootSparks = MakeNode "ChariotBootFrictionSparks" (@(
    (XmlCommon -maxGen 32 -life 20 -lifeSpread 5 -genTime 1.2 -genOffset 0),
    (XmlLocPVA 0 0.12 0.10 0.55 0.05 0.25 0 0.06 -0.22 0.08 0.04 0.06 0 -0.005 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.36 0.05 0.10 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 1 8),
    (XmlDrawSprite 4 255 238 140 255 245 158 11 0 0.22 0.75)
) -join "`n")

SaveEfkProj "knight_skill_trinket_chariot.efkproj" 60 ($n6_RamConeOuter, $n6_RamConeGold, $n6_FrontShieldCrest, $n6_SpeedRings, $n6_SpeedStreaks, $n6_BootSparks -join "`n")

# ============================================================================
# 7. knight_hit_guard_parry.efkproj - Shield Block / Perfect Parry Impact
# ============================================================================
$n7_ParryHex = MakeNode "ParryShieldBarrier" (@(
    (XmlCommon -maxGen 1 -life 20 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.10 0.85),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.55 1.85 0 0 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/hex_aegis_shield.png" 2 1 11),
    (XmlDrawSprite 2 180 242 255 255 56 189 248 0)
) -join "`n")

$n7_ParryRing = MakeNode "ParryRippleRing" (@(
    (XmlCommon -maxGen 1 -life 18 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.10 0.90),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.45 2.45 0 0 28 -24),
    (XmlGenPoint),
    (XmlRendererCommon "textures/shockwave_ring.png" 2 1 10),
    (XmlDrawSprite 2 224 248 255 255 56 189 248 0)
) -join "`n")

$n7_ParryFlare = MakeNode "ParryStarburstFlash" (@(
    (XmlCommon -maxGen 1 -life 14 -genTime 1 -genOffset 0),
    (XmlLocFixed 0 1.10 0.95),
    (XmlRotPVA 0 0 0 0 0 45 0 0 16),
    (XmlScaleSingleEasing 0.65 2.35 0 0 30 -25),
    (XmlGenPoint),
    (XmlRendererCommon "textures/starburst_flare.png" 2 1 9),
    (XmlDrawSprite 0 255 255 255 255 125 211 252 0)
) -join "`n")

$n7_RicochetSparks = MakeNode "ParryRicochetSparks" (@(
    (XmlCommon -maxGen 22 -life 22 -lifeSpread 6 -genTime 0.15 -genOffset 0),
    (XmlLocPVA 0 1.10 0.95 0.15 0.15 0.08 0 0.04 0.08 0.18 0.16 0.10 0 -0.007 0),
    (XmlRotFixed 0 0 0),
    (XmlScaleSingleEasing 0.42 0.05 0.12 0.02 10 -15),
    (XmlGenPoint),
    (XmlRendererCommon "textures/holy_spark.png" 2 1 10),
    (XmlDrawSprite 4 255 252 210 255 56 189 248 0 0.22 0.78)
) -join "`n")

SaveEfkProj "knight_hit_guard_parry.efkproj" 30 ($n7_ParryHex, $n7_ParryRing, $n7_ParryFlare, $n7_RicochetSparks -join "`n")

Write-Host "Done! All 7 Knight .efkproj files generated and XML-validated in: $OutDir"
