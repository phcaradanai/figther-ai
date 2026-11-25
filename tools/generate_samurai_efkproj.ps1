# ============================================================================
# LOST SAGA 3D - SAMURAI EVO (BLOSSOM BLADER) EFFEKSEER (.efkproj) GENERATOR
# ============================================================================
# Generates 7 multi-layered 3D Effekseer project files compatible with
# Effekseer 1.80.8 (GUI & CUI compiler) and EffekseerForWebGL 1.80.8:
#   1. samurai_basic_slash.efkproj          (4-Hit Blossom Slash)
#   2. samurai_heavy_iaido.efkproj          (Heavy: Iaido Flash Cut)
#   3. samurai_skill_weapon_senbon.efkproj  ([Q/SD] Senbonzakura & Control Blade)
#   4. samurai_skill_armor_counter.efkproj  ([E/ASD] Mind's Eye Flowering Counter)
#   5. samurai_skill_helmet_asura.efkproj   ([R/AD] Asura Blood Aura & Blades)
#   6. samurai_skill_trinket_tsubame.efkproj([F/AS] Tsubame Gaeshi Rising Slash)
#   7. samurai_mobility_flashstep.efkproj   (Falling Blossom Flash Step)
# ============================================================================
param(
    [string]$OutDir = (Join-Path (Split-Path -Parent $PSScriptRoot) "public\assets\vfx\samurai")
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

function XmlRotEasing([double]$sx, [double]$sy, [double]$sz, [double]$ex, [double]$ey, [double]$ez, [int]$startSpd = 24, [int]$endSpd = -20) {
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
    [double]$outerSX = 0.8, [double]$outerSY = 0, [double]$outerEX = 3.8, [double]$outerEY = 0,
    [double]$innerSX = 0.3, [double]$innerSY = 0, [double]$innerEX = 2.6, [double]$innerEY = 0,
    [double]$centerRatio = 0.5,
    $or = 244, $og = 114, $ob = 182, $oa = 0,
    $csr = 255, $csg = 240, $csb = 248, $csa = 255,
    $cer = 225, $ceg = 29, $ceb = 72, $cea = 0,
    $ir = 252, $ig = 211, $ib = 77, $ia = 0,
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

Write-Host "Generating 7 Samurai EVO (Blossom Blader) Effekseer 1.80.8 .efkproj files in $OutDir ..."

# ============================================================================
# 1. BASIC ATTACK: BLOSSOM SLASH (samurai_basic_slash.efkproj)
# ============================================================================
$nBasicArc1 = XmlNode "BlossomKatanaArc" `
    (XmlCommon 1 18 0 1 0) `
    (XmlLocFixed 0 1.05 0.55) `
    (XmlRotEasing 80 12 -150 80 12 -25) `
    (XmlScaleSingleEasing 2.6 3.7 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/katana_crescent.png" 2 1 8) `
    (XmlDrawSprite 2 255 240 248 255 244 114 182 0)

$nBasicCore = XmlNode "BlossomGlintFlare" `
    (XmlCommon 1 16 0 1 0) `
    (XmlLocFixed 0 1.05 1.45) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 10) `
    (XmlScaleSingleEasing 0.8 2.2 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_flare.png" 2 1 8) `
    (XmlDrawSprite 0 255 245 250 255 244 114 182 0)

$nBasicPetals = XmlNode "FlutteringSakuraPetals" `
    (XmlCommon 14 26 8 0.25 0) `
    (XmlLocPVA 0 1.05 1.1 0.5 0.3 0.5 0 0.06 0.14 0.08 0.06 0.08 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 8 0 0 6) `
    (XmlScaleSingleEasing 0.35 0.50 0.1 0.1 12 -12) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_petal.png" 1 1 10) `
    (XmlDrawSprite 0 255 220 238 245 244 114 182 0)

WriteEfkProj "samurai_basic_slash.efkproj" 28 @($nBasicArc1, $nBasicCore, $nBasicPetals)

# ============================================================================
# 2. HEAVY ATTACK: IAIDO FLASH CUT (samurai_heavy_iaido.efkproj)
# ============================================================================
$nIaidoLine = XmlNode "IaidoFlashBeam" `
    (XmlCommon 1 28 0 1 0) `
    (XmlLocFixed 0 1.02 2.4) `
    (XmlRotFixed 90 -90 0) `
    (XmlScaleSingleEasing 1.0 1.25 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/iaido_flash_beam.png" 2 1 14) `
    (XmlDrawSprite 2 255 248 252 255 244 114 182 0 2.9 0.92)

$nIaidoFlower = XmlNode "IaidoBlossomBloom" `
    (XmlCommon 1 36 0 1 3) `
    (XmlLocFixed 0 1.05 4.8) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 6) `
    (XmlScaleSingleEasing 1.0 3.6 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_flower.png" 2 1 14) `
    (XmlDrawSprite 0 255 240 248 255 225 29 72 0)

$nIaidoRing = XmlNode "IaidoWindShearRing" `
    (XmlCommon 1 28 0 1 0) `
    (XmlLocFixed 0 1.02 1.6) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleSingleEasing 0.8 3.2 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_ring.png" 2 1 12) `
    (XmlDrawSprite 2 255 240 248 255 244 114 182 0)

$nIaidoFlare = XmlNode "IaidoKatanaFlare" `
    (XmlCommon 1 24 0 1 2) `
    (XmlLocFixed 0 1.05 4.8) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 8) `
    (XmlScaleSingleEasing 1.2 4.2 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_flare.png" 2 1 10) `
    (XmlDrawSprite 0 255 255 255 255 244 114 182 0)

$nIaidoPetals = XmlNode "IaidoSakuraTrail" `
    (XmlCommon 26 38 10 0.25 0) `
    (XmlLocPVA 0 1.0 2.4 0.8 0.5 2.4 0 0.06 0.08 0.09 0.06 0.09 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 10 0 0 6) `
    (XmlScaleSingleEasing 0.42 0.62 0.12 0.15 14 -12) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_petal.png" 1 1 14) `
    (XmlDrawSprite 0 255 220 238 250 225 29 72 0)

WriteEfkProj "samurai_heavy_iaido.efkproj" 42 @($nIaidoLine, $nIaidoFlower, $nIaidoRing, $nIaidoFlare, $nIaidoPetals)

# ============================================================================
# 3. [Q/SD] WEAPON SKILL: SENBONZAKURA STORM + CONTROL BLADE (samurai_skill_weapon_senbon.efkproj)
# ============================================================================
$nSenbonCrest = XmlNode "SenbonSakuraFloorCrest" `
    (XmlCommon 1 70 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 4.5) `
    (XmlScaleSingleEasing 1.8 7.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_crest.png" 2 2 20) `
    (XmlDrawSprite 2 255 230 245 255 244 114 182 0)

$nSenbonCyclone = XmlNode "SenbonPetalCyclone" `
    (XmlCommon 1 64 0 1 0) `
    (XmlLocFixed 0 2.0 0) `
    (XmlRotPVA -90 0 0 0 0 0 0 12 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/petal_vortex.png" 2 2 18) `
    (XmlDrawRing 2 32 360 1.4 3.6 3.8 5.2 0.9 -2.0 2.8 -2.0 0.5 225 29 72 0 255 240 248 255 244 114 182 0 252 211 77 0)

$nSenbonBlades = XmlNode "ControlBladeHitenRing" `
    (XmlCommon 8 42 4 1.2 0) `
    (XmlLocPVA 0 1.4 0 0 0.3 0 0 0.04 0 0.04 0.03 0.04) `
    (XmlRotPVA 0 0 0 15 0 20 0 8 0) `
    (XmlScaleSingleEasing 1.6 2.8 0 0 22 -16) `
    (XmlGenCircle 2.2 0.2 8 1 $true) `
    (XmlRendererCommon "textures/spectral_katana.png" 2 2 14) `
    (XmlDrawSprite 0 255 245 250 255 244 114 182 0)

$nSenbonSlash = XmlNode "SenbonMultiSlashes" `
    (XmlCommon 8 24 4 3.0 2) `
    (XmlLocFixed 0 1.2 0) `
    (XmlRotPVA 70 0 0 35 180 180 0 0 16) `
    (XmlScaleSingleEasing 2.8 5.4 0.3 0.5 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/katana_crescent.png" 2 1 10) `
    (XmlDrawSprite 2 255 240 248 255 225 29 72 0)

$nSenbonFlower = XmlNode "SenbonCenterBloom" `
    (XmlCommon 1 46 0 1 8) `
    (XmlLocFixed 0 1.35 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 5) `
    (XmlScaleSingleEasing 1.4 4.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_flower.png" 2 2 16) `
    (XmlDrawSprite 0 255 240 248 255 244 114 182 0)

$nSenbonPetals = XmlNode "SenbonSakuraBlizzard" `
    (XmlCommon 38 56 12 0.6 0) `
    (XmlLocPVA 0 0.8 0 2.0 0.6 2.0 0 0.14 0 0.16 0.08 0.16 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 10 0 0 6) `
    (XmlScaleSingleEasing 0.45 0.72 0.12 0.15 14 -12) `
    (XmlGenCircle 2.2 0.8 16 0 $false) `
    (XmlRendererCommon "textures/sakura_petal.png" 1 2 18) `
    (XmlDrawSprite 0 255 210 235 250 225 29 72 0)

WriteEfkProj "samurai_skill_weapon_senbon.efkproj" 74 @($nSenbonCrest, $nSenbonCyclone, $nSenbonBlades, $nSenbonSlash, $nSenbonFlower, $nSenbonPetals)

# ============================================================================
# 4. [E/ASD] ARMOR SKILL: MIND'S EYE FLOWERING COUNTER (samurai_skill_armor_counter.efkproj)
# ============================================================================
$nCntCrest = XmlNode "MindsEyeBlossomSeal" `
    (XmlCommon 1 54 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 -5.5) `
    (XmlScaleSingleEasing 1.6 8.8 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_crest.png" 2 1 18) `
    (XmlDrawSprite 2 255 235 245 255 225 29 72 0)

$nCntRing = XmlNode "Counter9mShockwave" `
    (XmlCommon 1 40 0 1 0) `
    (XmlLocFixed 0 0.14 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.2 9.0 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_ring.png" 2 1 14) `
    (XmlDrawSprite 2 255 248 250 255 225 29 72 0)

$nCntSlash = XmlNode "Counter360KatanaSweep" `
    (XmlCommon 1 30 0 1 0) `
    (XmlLocFixed 0 1.05 0) `
    (XmlRotEasing 90 0 0 90 0 360) `
    (XmlScaleSingleEasing 2.4 7.8 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/katana_crescent.png" 2 1 12) `
    (XmlDrawSprite 2 255 245 250 255 244 114 182 0)

$nCntFlare = XmlNode "MindsEyeFlashCross" `
    (XmlCommon 1 28 0 1 0) `
    (XmlLocFixed 0 1.15 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 7) `
    (XmlScaleSingleEasing 1.6 5.8 0 0 28 -20) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_flare.png" 2 1 12) `
    (XmlDrawSprite 0 255 255 255 255 252 211 77 0)

$nCntPetals = XmlNode "CounterSakuraBurst" `
    (XmlCommon 28 42 10 0.2 0) `
    (XmlLocPVA 0 0.9 0 0.6 0.3 0.6 0 0.12 0 0.22 0.08 0.22 0 -0.003 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 10 0 0 6) `
    (XmlScaleSingleEasing 0.45 0.68 0.12 0.15 16 -12) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_petal.png" 1 1 16) `
    (XmlDrawSprite 0 255 220 238 250 225 29 72 0)

WriteEfkProj "samurai_skill_armor_counter.efkproj" 58 @($nCntCrest, $nCntRing, $nCntSlash, $nCntFlare, $nCntPetals)

# ============================================================================
# 5. [R/AD] HELMET SKILL: ASURA BLOOD AURA + PHANTOM BLADES (samurai_skill_helmet_asura.efkproj)
# ============================================================================
$nAsuraSeal = XmlNode "AsuraBlossomHalo" `
    (XmlCommon 1 90 0 1 0) `
    (XmlLocFixed 0 0.06 0) `
    (XmlRotPVA 90 0 0 0 0 0 0 0 4.0) `
    (XmlScaleSingleEasing 1.4 4.2 0 0 22 -16) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_crest.png" 2 2 22) `
    (XmlDrawSprite 2 255 180 205 245 220 38 38 0)

$nAsuraSheath = XmlNode "AsuraVerticalAuraSheath" `
    (XmlCommon 1 88 0 1 0) `
    (XmlLocFixed 0 1.45 0) `
    (XmlRotPVA -90 0 0 0 0 0 0 10 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/petal_vortex.png" 2 3 20) `
    (XmlDrawRing 2 28 360 0.85 2.4 1.35 3.2 0.55 -1.4 0.95 -1.4 0.5 220 38 38 0 244 114 182 235 220 38 38 0 252 211 77 0)

$nAsuraBlades = @()
for ($i = 0; $i -lt 4; $i++) {
    $ang = $i * 90.0 * [Math]::PI / 180.0
    $bx = [Math]::Round([Math]::Cos($ang) * 1.35, 3)
    $bz = [Math]::Round([Math]::Sin($ang) * 1.35, 3)
    $nAsuraBlades += XmlNode "AsuraSpectralKatana_$i" `
        (XmlCommon 1 88 0 1 0 2 2 2) `
        (XmlLocFixed $bx 1.35 $bz) `
        (XmlRotFixed 0 0 0) `
        (XmlScaleSingleEasing 0.7 1.65 0 0 18 -14) `
        (XmlGenPoint) `
        (XmlRendererCommon "textures/spectral_katana.png" 2 3 18) `
        (XmlDrawSprite 0 255 240 245 255 220 38 38 0)
}

$nAsuraPivot = XmlNode "AsuraBladesOrbitPivot" `
    (XmlCommon 1 90 0 1 0) `
    (XmlLocFixed 0 0 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 5.5 0) `
    (XmlScaleFixed 1 1 1) `
    (XmlGenPoint) `
    (XmlRendererCommon "" 2 0 0) `
    "<DrawingValues><Type>0</Type></DrawingValues>" `
    ($nAsuraBlades -join "`n")

$nAsuraPillar = XmlNode "AsuraAwakenFlare" `
    (XmlCommon 1 32 0 1 0) `
    (XmlLocFixed 0 1.35 0) `
    (XmlRotFixed 0 0 0) `
    (XmlScaleSingleEasing 1.4 4.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_flare.png" 2 1 14) `
    (XmlDrawSprite 0 255 245 250 255 220 38 38 0)

WriteEfkProj "samurai_skill_helmet_asura.efkproj" 94 @($nAsuraSeal, $nAsuraSheath, $nAsuraPivot, $nAsuraPillar)

# ============================================================================
# 6. [F/AS] TRINKET SKILL: TSUBAME GAESHI RISING SLASH (samurai_skill_trinket_tsubame.efkproj)
# ============================================================================
$nTsuArc1 = XmlNode "TsubameRisingSlashA" `
    (XmlCommon 1 30 0 1 0) `
    (XmlLocPVA 0 1.2 1.2 0 0 0 0 0.14 0.08 0 0 0) `
    (XmlRotEasing 15 -90 -110 15 -90 45) `
    (XmlScaleSingleEasing 2.6 4.8 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/katana_crescent.png" 2 1 12) `
    (XmlDrawSprite 2 255 240 248 255 244 114 182 0)

$nTsuArc2 = XmlNode "TsubameRisingSlashB" `
    (XmlCommon 1 30 0 1 3) `
    (XmlLocPVA 0 1.5 1.4 0 0 0 0 0.16 0.08 0 0 0) `
    (XmlRotEasing -15 -90 -120 -15 -90 55) `
    (XmlScaleSingleEasing 2.8 5.2 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/katana_crescent.png" 2 1 12) `
    (XmlDrawSprite 2 255 245 250 255 225 29 72 0)

$nTsuRing = XmlNode "TsubameLaunchRing" `
    (XmlCommon 1 32 0 1 0) `
    (XmlLocFixed 0 0.10 0.9) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 1.0 5.4 0 0 26 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_ring.png" 2 1 14) `
    (XmlDrawSprite 2 255 240 248 255 251 113 133 0)

$nTsuPetals = XmlNode "TsubameRisingPetals" `
    (XmlCommon 24 40 8 0.3 0) `
    (XmlLocPVA 0 0.7 1.0 0.9 0.4 0.9 0 0.24 0.08 0.10 0.08 0.10 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 12 0 0 6) `
    (XmlScaleSingleEasing 0.42 0.65 0.10 0.12 14 -12) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_petal.png" 1 1 14) `
    (XmlDrawSprite 0 255 225 240 250 244 114 182 0)

WriteEfkProj "samurai_skill_trinket_tsubame.efkproj" 46 @($nTsuArc1, $nTsuArc2, $nTsuRing, $nTsuPetals)

# ============================================================================
# 7. MOBILITY: FALLING BLOSSOM FLASH STEP (samurai_mobility_flashstep.efkproj)
# ============================================================================
$nMobFlower = XmlNode "FallingBlossomMark" `
    (XmlCommon 1 26 0 1 0) `
    (XmlLocFixed 0 0.95 0) `
    (XmlRotPVA 0 0 0 0 0 0 0 0 8) `
    (XmlScaleSingleEasing 0.8 2.6 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_flower.png" 2 1 10) `
    (XmlDrawSprite 0 255 240 248 250 244 114 182 0)

$nMobRing = XmlNode "FlashStepWindRing" `
    (XmlCommon 1 24 0 1 0) `
    (XmlLocFixed 0 0.10 0) `
    (XmlRotFixed 90 0 0) `
    (XmlScaleSingleEasing 0.7 2.8 0 0 24 -18) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/blossom_ring.png" 2 1 10) `
    (XmlDrawSprite 2 255 240 248 250 244 114 182 0)

$nMobPetals = XmlNode "FlashStepSakuraWake" `
    (XmlCommon 14 28 6 0.25 0) `
    (XmlLocPVA 0 0.85 0 0.5 0.4 0.5 0 0.06 0 0.09 0.05 0.09 0 -0.002 0) `
    (XmlRotPVA 0 0 0 0 0 180 0 0 10 0 0 6) `
    (XmlScaleSingleEasing 0.36 0.54 0.1 0.1 12 -10) `
    (XmlGenPoint) `
    (XmlRendererCommon "textures/sakura_petal.png" 1 1 12) `
    (XmlDrawSprite 0 255 220 238 245 244 114 182 0)

WriteEfkProj "samurai_mobility_flashstep.efkproj" 32 @($nMobFlower, $nMobRing, $nMobPetals)

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
    Write-Host "ALL 7 Samurai EVO (Blossom Blader) .efkproj XML files validated with 0 missing textures!"
}
