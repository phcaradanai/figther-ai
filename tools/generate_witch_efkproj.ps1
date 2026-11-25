# ============================================================================
# LOST SAGA 3D - FROST ICE WITCH (CRYOMANCER) EFFEKSEER (.efkproj) GENERATOR
# ============================================================================
# Generates 7 multi-layered 3D Effekseer project files compatible with
# Effekseer 1.80.8 (GUI & CUI compiler) and EffekseerForWebGL 1.80.8:
#   1. witch_basic_icebolt.efkproj         (Cryomancer Ice Bolt Cast)
#   2. witch_heavy_breath.efkproj          (Heavy: Absolute Zero / Ice Pike Cone)
#   3. witch_skill_weapon_blizzard.efkproj ([Q/SD] Eternal Blizzard & Frost Pillar)
#   4. witch_skill_armor_icetomb.efkproj   ([E/ASD] Crystal Ice Tomb / Subzero Shield)
#   5. witch_skill_helmet_spikes.efkproj   ([R/AD] Glacial Spike Eruption / Ice Pike)
#   6. witch_skill_trinket_skate.efkproj   ([F/AS] Frost Skate Trail)
#   7. witch_mobility_glide.efkproj        (Frost Glide Fly / Skate Dash)
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\witch")
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
    [double]$outerSX = 1.0, [double]$outerSY = 0, [double]$outerEX = 4.2, [double]$outerEY = 0,
    [double]$innerSX = 0.4, [double]$innerSY = 0, [double]$innerEX = 3.0, [double]$innerEY = 0,
    [double]$centerRatio = 0.5,
    $or = 34, $og = 211, $ob = 238, $oa = 0,
    $csr = 236, $csg = 254, $csb = 255, $csa = 255,
    $cer = 6, $ceg = 182, $ceb = 212, $cea = 0,
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

Write-Host "Generating 7 Frost Ice Witch (Cryomancer) Effekseer 1.80.8 .efkproj files in $OutDir ..."

# ============================================================================
# 1. BASIC ATTACK: CRYOMANCER ICE BOLT CAST (witch_basic_icebolt.efkproj)
# ============================================================================
$nBoltSigil = XmlNode "IceBoltSnowflakeSigil" `
    (XmlCommon 1 20 0 1 0) `
    (XmlLocFixed 0 1.05 0.95) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 8) `
    (XmlScaleSingleEasing 0.45 1.85 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_snowflake_seal.png" 2 1 9) `
    (XmlDrawSprite 2 236 254 255 255 34 211 238 0)

$nBoltFlare = XmlNode "IceBoltCrystalFlare" `
    (XmlCommon 1 16 0 1 0) `
    (XmlLocFixed 0 1.05 1.05) `
    (XmlRotPVA 0 0 0 0 0 30 0 0 12) `
    (XmlScaleSingleEasing 0.55 2.0 0 0 26 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/crystal_flare.png" 2 1 8) `
    (XmlDrawSprite 0 255 255 255 255 56 189 248 0)

$nBoltShards = XmlNode "IceBoltAngularShards" `
    (XmlCommon 12 20 6 0.2 0) `
    (XmlLocPVA 0 1.05 1.05 0.2 0.2 0.2 0 0.04 0.24 0.08 0.06 0.08 0 -0.005 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 8) `
    (XmlScaleFixed 0.28 0.48 0.28) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/ice_shard.png" 1 1 8) `
    (XmlDrawSprite 0 165 243 252 245 30 64 125 0)

WriteEfkProj "witch_basic_icebolt.efkproj" 24 @($nBoltSigil, $nBoltFlare, $nBoltShards)

# ============================================================================
# 2. HEAVY ATTACK: ABSOLUTE ZERO / ICE PIKE CONE (witch_heavy_breath.efkproj)
# ============================================================================
$nBreathFloor = XmlNode "AbsoluteZeroGlacialFloor" `
    (XmlCommon 1 46 0 1 0) `
    (XmlLocFixed 0 0.05 2.3) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 4.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/glacial_floor.png" 1 2 16) `
    (XmlDrawSprite 2 165 243 252 240 20 60 110 0)

$nBreathSpikes = @()
for ($i = 0; $i -lt 5; $i++) {
    $sx = ($i - 2) * 0.65
    $sz = 1.6 + [Math]::Abs($i - 2) * 0.4 + 0.8
    $nBreathSpikes += XmlNode "ConeIcePike_$i" `
        (XmlCommon 1 38 0 1 ($i * 2)) `
        (XmlLocFixed $sx 1.2 $sz) `
        (XmlRotFixed 14 0 (($i - 2) * -10)) `
        (XmlScaleSingleEasing 0.8 2.4 0 0 26 -18) `
        (XmlGenPoint) `
        (XmlRendererCommon "textures/ice_spike.png" 1 1 14) `
        (XmlDrawSprite 0 236 254 255 250 103 232 249 0)
}

$nBreathMist = XmlNode "SubzeroFrostMist" `
    (XmlCommon 14 38 8 0.3 0) `
    (XmlLocPVA 0 0.85 1.8 0.6 0.3 0.8 0 0.04 0.16 0.08 0.04 0.08 0 -0.001 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 2.5) `
    (XmlScaleSingleEasing 1.2 2.8 0.2 0.4 18 -14) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_mist.png" 1 2 16) `
    (XmlDrawSprite 0 186 238 255 210 30 64 115 0)

$nBreathFlakes = XmlNode "AbsoluteZeroSnowflakes" `
    (XmlCommon 20 40 8 0.2 0) `
    (XmlLocPVA 0 1.0 1.6 0.8 0.4 0.8 0 0.06 0.22 0.10 0.06 0.10 0 -0.003 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 6) `
    (XmlScaleSingleEasing 0.35 0.58 0.08 0.10 14 -12) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/snowflake_mote.png" 2 1 14) `
    (XmlDrawSprite 0 255 255 255 250 56 189 248 0)

WriteEfkProj "witch_heavy_breath.efkproj" 50 (@($nBreathFloor, $nBreathMist, $nBreathFlakes) + $nBreathSpikes)

# ============================================================================
# 3. [Q/SD] WEAPON SKILL: ETERNAL BLIZZARD & FROST PILLAR (witch_skill_weapon_blizzard.efkproj)
# ============================================================================
$nBlizSeal = XmlNode "BlizzardSnowflakeMandala" `
    (XmlCommon 1 82 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 3.2) `
    (XmlScaleSingleEasing 2.0 9.0 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_snowflake_seal.png" 2 2 22) `
    (XmlDrawSprite 2 236 254 255 255 34 211 238 0)

$nBlizFloor = XmlNode "BlizzardGlacialCrust" `
    (XmlCommon 1 82 0 1 0) `
    (XmlLocFixed 0 0.04 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.8 8.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/glacial_floor.png" 1 2 24) `
    (XmlDrawSprite 2 186 238 255 235 20 55 105 0)

$nBlizPillar = XmlNode "CryoFrostPillarSpire" `
    (XmlCommon 1 76 0 1 2) `
    (XmlLocFixed 0 2.3 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleSingleEasing 1.8 4.6 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/ice_spike.png" 1 2 22) `
    (XmlDrawSprite 0 240 253 255 255 56 189 248 0)

$nBlizVortex = XmlNode "BlizzardSnowCyclone" `
    (XmlCommon 1 78 0 1 0) `
    (XmlLocFixed 0 2.2 0) `
    (XmlRotPVA -90 0 0 0 0 0 0 10 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blizzard_vortex.png" 2 2 22) `
    (XmlDrawRing 2 32 360 1.6 3.8 4.4 5.4 1.0 -2.2 3.2 -2.2 0.5 34 211 238 0 236 254 255 255 56 189 248 0 165 243 252 0)

$nBlizRing = XmlNode "BlizzardFrostShockwave" `
    (XmlCommon 1 42 0 1 2) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 9.4 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_ring.png" 2 1 16) `
    (XmlDrawSprite 2 236 254 255 255 34 211 238 0)

$nBlizSnow = XmlNode "BlizzardFallingSnowflakes" `
    (XmlCommon 38 68 14 0.8 0) `
    (XmlLocPVA 0 3.8 0 3.2 0.8 3.2 0 -0.10 0 0.08 0.04 0.08 0 -0.001 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 6 0 0 4) `
    (XmlScaleSingleEasing 0.42 0.68 0.10 0.12 12 -10) `
    (XmlGenCircle 3.2 1.0 18 0 $false) `
    (XmlRendererCommon "textures/snowflake_mote.png" 2 2 18) `
    (XmlDrawSprite 0 255 255 255 250 103 232 249 0)

WriteEfkProj "witch_skill_weapon_blizzard.efkproj" 86 @($nBlizSeal, $nBlizFloor, $nBlizPillar, $nBlizVortex, $nBlizRing, $nBlizSnow)

# ============================================================================
# 4. [E/ASD] ARMOR SKILL: CRYSTAL ICE TOMB / SUBZERO SHIELD (witch_skill_armor_icetomb.efkproj)
# ============================================================================
$nTombSeal = XmlNode "SubzeroShieldFloorSeal" `
    (XmlCommon 1 86 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 -4.0) `
    (XmlScaleSingleEasing 1.4 8.0 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_snowflake_seal.png" 2 2 22) `
    (XmlDrawSprite 2 236 254 255 255 56 189 248 0)

$nTombRing = XmlNode "IceBlast8mShockwave" `
    (XmlCommon 1 42 0 1 0) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.0 8.2 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_ring.png" 2 1 16) `
    (XmlDrawSprite 2 255 255 255 255 34 211 238 0)

$nTombPanels = @()
for ($i = 0; $i -lt 6; $i++) {
    $angDeg = $i * 60.0
    $rad = $angDeg * [Math]::PI / 180.0
    $px = [Math]::Round([Math]::Sin($rad) * 1.45, 3)
    $pz = [Math]::Round([Math]::Cos($rad) * 1.45, 3)
    $nTombPanels += XmlNode "SubzeroShieldPlate_$i" `
        (XmlCommon 1 86 0 1 0 2 2 2) `
        (XmlLocFixed $px 1.25 $pz) `
        (XmlRotFixed 0 $angDeg 0) `
        (XmlScaleSingleEasing 0.8 1.65 0 0 20 -16) `
        (XmlGenPoint) `
        (XmlRendererCommon "textures/subzero_shield.png" 1 2 18) `
        (XmlDrawSprite 2 236 254 255 245 103 232 249 0 0.55 0.95)
}

$nTombPivot = XmlNode "SubzeroShieldRingPivot" `
    (XmlCommon 1 88 0 1 0) `
    (XmlLocFixed 0 0 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 3.2 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "" 2 0 0) `
    "<DrawingValues><Type>0</Type></DrawingValues>" `
    ($nTombPanels -join "`n")

$nTombShards = XmlNode "IceBlastShatterShards" `
    (XmlCommon 26 42 10 0.2 0) `
    (XmlLocPVA 0 1.0 0 0.7 0.4 0.7 0 0.14 0 0.22 0.08 0.22 0 -0.007 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 12) `
    (XmlScaleFixed 0.34 0.56 0.34) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/ice_shard.png" 1 1 14) `
    (XmlDrawSprite 0 224 248 255 250 30 64 125 0)

WriteEfkProj "witch_skill_armor_icetomb.efkproj" 90 @($nTombSeal, $nTombRing, $nTombPivot, $nTombShards)

# ============================================================================
# 5. [R/AD] HELMET SKILL: GLACIAL SPIKE ERUPTION / ICE PIKE (witch_skill_helmet_spikes.efkproj)
# ============================================================================
$nPikeSpikes = @()
for ($i = 0; $i -lt 6; $i++) {
    $pz = 1.2 + $i * 1.2
    $sc = 1.6 + $i * 0.22
    $nPikeSpikes += XmlNode "IcePikePillar_$i" `
        (XmlCommon 1 48 0 1 ($i * 3)) `
        (XmlLocFixed 0 ($sc * 0.55) $pz) `
        (XmlRotFixed 8 0 0) `
        (XmlScaleSingleEasing 0.8 ($sc * 1.15) 0 0 28 -18) `
        (XmlGenPoint) `
        (XmlRendererCommon "textures/ice_spike.png" 1 1 18) `
        (XmlDrawSprite 0 245 254 255 255 56 189 248 0)
}

$nPikeMist = XmlNode "IcePikeTrailMist" `
    (XmlCommon 18 46 10 0.6 0) `
    (XmlLocPVA 0 0.55 4.2 0.8 0.3 3.4 0 0.05 0 0.07 0.04 0.07 0 -0.001 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 3) `
    (XmlScaleSingleEasing 1.2 2.6 0.2 0.4 18 -14) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_mist.png" 1 2 18) `
    (XmlDrawSprite 0 186 238 255 215 24 58 105 0)

$nPikeShards = XmlNode "IcePikeShatterDebris" `
    (XmlCommon 28 42 10 0.5 0) `
    (XmlLocPVA 0 0.9 4.2 0.8 0.4 3.4 0 0.22 0 0.14 0.09 0.14 0 -0.009 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 14) `
    (XmlScaleFixed 0.34 0.58 0.34) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/ice_shard.png" 1 1 14) `
    (XmlDrawSprite 0 224 248 255 250 24 58 115 0)

WriteEfkProj "witch_skill_helmet_spikes.efkproj" 68 (@($nPikeMist, $nPikeShards) + $nPikeSpikes)

# ============================================================================
# 6. [F/AS] TRINKET SKILL: FROST SKATE TRAIL (witch_skill_trinket_skate.efkproj)
# ============================================================================
$nSkatePath = XmlNode "FrostSkateIceRunway" `
    (XmlCommon 4 46 0 2.5 0) `
    (XmlLocPVA 0 0.06 2.8 0.2 0 2.4 0 0 0 0 0 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 3.2 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/glacial_floor.png" 1 1 18) `
    (XmlDrawSprite 2 200 246 255 240 24 58 108 0)

$nSkateRing = XmlNode "FrostSkateBoostRing" `
    (XmlCommon 1 30 0 1 0) `
    (XmlLocFixed 0 1.0 0.8) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleSingleEasing 0.8 3.2 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_ring.png" 2 1 12) `
    (XmlDrawSprite 2 236 254 255 255 56 189 248 0)

$nSkateFlakes = XmlNode "FrostSkateWakeFlakes" `
    (XmlCommon 22 36 8 0.4 0) `
    (XmlLocPVA 0 0.65 2.4 0.8 0.4 2.4 0 0.08 0.10 0.08 0.06 0.08 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 8) `
    (XmlScaleSingleEasing 0.36 0.60 0.1 0.1 14 -12) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/snowflake_mote.png" 2 1 14) `
    (XmlDrawSprite 0 255 255 255 250 103 232 249 0)

WriteEfkProj "witch_skill_trinket_skate.efkproj" 52 @($nSkatePath, $nSkateRing, $nSkateFlakes)

# ============================================================================
# 7. MOBILITY: FROST GLIDE / SKATE DASH (witch_mobility_glide.efkproj)
# ============================================================================
$nMobSeal = XmlNode "FrostGlideSnowflake" `
    (XmlCommon 1 26 0 1 0) `
    (XmlLocFixed 0 0.08 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 7) `
    (XmlScaleSingleEasing 0.7 2.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_snowflake_seal.png" 2 1 10) `
    (XmlDrawSprite 2 236 254 255 250 56 189 248 0)

$nMobRing = XmlNode "FrostGlideWindRing" `
    (XmlCommon 1 24 0 1 0) `
    (XmlLocFixed 0 0.12 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 0.7 2.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/frost_ring.png" 2 1 10) `
    (XmlDrawSprite 2 236 254 255 245 34 211 238 0)

$nMobFlakes = XmlNode "FrostGlideSnowflakes" `
    (XmlCommon 14 28 6 0.25 0) `
    (XmlLocPVA 0 0.65 0 0.5 0.3 0.5 0 0.06 0 0.09 0.05 0.09 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 8) `
    (XmlScaleSingleEasing 0.34 0.52 0.08 0.10 12 -10) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/snowflake_mote.png" 2 1 10) `
    (XmlDrawSprite 0 255 255 255 245 103 232 249 0)

WriteEfkProj "witch_mobility_glide.efkproj" 32 @($nMobSeal, $nMobRing, $nMobFlakes)

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
    Write-Host "ALL 7 Frost Ice Witch (Cryomancer) .efkproj XML files validated with 0 missing textures!"
}
