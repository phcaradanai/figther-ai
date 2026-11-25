# ==============================================================================
# LOST SAGA 3D - VIKING BERSERKER (NORSE RAGNAROK) EFFEKSEER .EFKPROJ GENERATOR
# ==============================================================================
# Generates 7 XML-validated Effekseer 1.80.8 .efkproj projects for Viking:
#   1. viking_basic_axe.efkproj              - Twin Battleaxe Cleave & Slam Finisher
#   2. viking_heavy_whirlwind.efkproj        - 360 Whirlwind Twin-Axe Cyclone
#   3. viking_skill_weapon_ragnarok.efkproj  - [Q/SD] Ragnarok Earthshatter (9.2m!)
#   4. viking_skill_armor_valhalla.efkproj   - [E/ASD] Valhalla Berserk 6s Rage Aura
#   5. viking_skill_helmet_colossus.efkproj  - [R/AD] Colossus Hurl Throw Shockwave
#   6. viking_skill_trinket_tomahawk.efkproj - [F/AS] Boomerang Tomahawk Launch Spin
#   7. viking_mobility_rush.efkproj          - Berserk Bull Rush / Giant Jump Stomp
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\viking"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Make-SpriteNode {
    param(
        [string]$Name,
        [string]$Texture,
        [int]$Count = 1,
        [int]$Life = 36,
        [int]$Delay = 0,
        [double]$SpawnRate = 1.0,
        [double[]]$Pos = @(0, 0, 0),
        [double[]]$Vel = @(0, 0, 0),
        [double[]]$VelMax = @(0, 0, 0),
        [double[]]$Rot = @(0, 0, 0),
        [double[]]$RotVel = @(0, 0, 0),
        [double[]]$ScaleStart = @(1, 1, 1),
        [double[]]$ScaleEnd = @(2, 2, 2),
        [int[]]$ColorStart = @(249, 115, 22, 255),
        [int[]]$ColorEnd = @(220, 38, 38, 0),
        [int]$AlphaBlend = 2,
        [int]$Billboard = 2,
        [double]$GravityY = 0.0,
        [double]$PosRand = 0.0
    )

    $usePva = ($Vel[0] -ne 0 -or $Vel[1] -ne 0 -or $Vel[2] -ne 0 -or $VelMax[0] -ne 0 -or $VelMax[1] -ne 0 -or $VelMax[2] -ne 0 -or $GravityY -ne 0 -or $PosRand -gt 0)
    $locBlock = if ($usePva) {
@"
        <LocationValues>
          <Type>1</Type>
          <PVA>
            <Location>
              <X><Center>$($Pos[0])</Center><Max>$($Pos[0] + $PosRand)</Max><Min>$($Pos[0] - $PosRand)</Min></X>
              <Y><Center>$($Pos[1])</Center><Max>$($Pos[1] + $PosRand * 0.5)</Max><Min>$($Pos[1] - $PosRand * 0.5)</Min></Y>
              <Z><Center>$($Pos[2])</Center><Max>$($Pos[2] + $PosRand)</Max><Min>$($Pos[2] - $PosRand)</Min></Z>
            </Location>
            <Velocity>
              <X><Center>$($Vel[0])</Center><Max>$($Vel[0] + $VelMax[0])</Max><Min>$($Vel[0] - $VelMax[0])</Min></X>
              <Y><Center>$($Vel[1])</Center><Max>$($Vel[1] + $VelMax[1])</Max><Min>$($Vel[1] - $VelMax[1])</Min></Y>
              <Z><Center>$($Vel[2])</Center><Max>$($Vel[2] + $VelMax[2])</Max><Min>$($Vel[2] - $VelMax[2])</Min></Z>
            </Velocity>
            <Acceleration>
              <X><Center>0</Center><Max>0</Max><Min>0</Min></X>
              <Y><Center>$GravityY</Center><Max>$GravityY</Max><Min>$GravityY</Min></Y>
              <Z><Center>0</Center><Max>0</Max><Min>0</Min></Z>
            </Acceleration>
          </PVA>
        </LocationValues>
"@
    } else {
@"
        <LocationValues>
          <Type>0</Type>
          <Fixed>
            <Location><X>$($Pos[0])</X><Y>$($Pos[1])</Y><Z>$($Pos[2])</Z></Location>
          </Fixed>
        </LocationValues>
"@
    }

    $rotBlock = if ($RotVel[0] -ne 0 -or $RotVel[1] -ne 0 -or $RotVel[2] -ne 0) {
@"
        <RotationValues>
          <Type>1</Type>
          <PVA>
            <Rotation>
              <X><Center>$($Rot[0])</Center><Max>$($Rot[0])</Max><Min>$($Rot[0])</Min></X>
              <Y><Center>$($Rot[1])</Center><Max>$($Rot[1])</Max><Min>$($Rot[1])</Min></Y>
              <Z><Center>$($Rot[2])</Center><Max>$($Rot[2])</Max><Min>$($Rot[2])</Min></Z>
            </Rotation>
            <Velocity>
              <X><Center>$($RotVel[0])</Center><Max>$($RotVel[0])</Max><Min>$($RotVel[0])</Min></X>
              <Y><Center>$($RotVel[1])</Center><Max>$($RotVel[1])</Max><Min>$($RotVel[1])</Min></Y>
              <Z><Center>$($RotVel[2])</Center><Max>$($RotVel[2])</Max><Min>$($RotVel[2])</Min></Z>
            </Velocity>
          </PVA>
        </RotationValues>
"@
    } else {
@"
        <RotationValues>
          <Type>0</Type>
          <Fixed>
            <Rotation><X>$($Rot[0])</X><Y>$($Rot[1])</Y><Z>$($Rot[2])</Z></Rotation>
          </Fixed>
        </RotationValues>
"@
    }

    return @"
      <Node>
        <CommonValues>
          <MaxGeneration><Value>$Count</Value></MaxGeneration>
          <Life><Center>$Life</Center><Max>$Life</Max><Min>$Life</Min></Life>
          <GenerationTime><Center>$SpawnRate</Center><Max>$SpawnRate</Max><Min>$SpawnRate</Min></GenerationTime>
          <GenerationTimeOffset><Center>$Delay</Center><Max>$Delay</Max><Min>$Delay</Min></GenerationTimeOffset>
        </CommonValues>
$locBlock
$rotBlock
        <ScalingValues>
          <Type>2</Type>
          <Easing>
            <Start>
              <X><Center>$($ScaleStart[0])</Center><Max>$($ScaleStart[0])</Max><Min>$($ScaleStart[0])</Min></X>
              <Y><Center>$($ScaleStart[1])</Center><Max>$($ScaleStart[1])</Max><Min>$($ScaleStart[1])</Min></Y>
              <Z><Center>$($ScaleStart[2])</Center><Max>$($ScaleStart[2])</Max><Min>$($ScaleStart[2])</Min></Z>
            </Start>
            <End>
              <X><Center>$($ScaleEnd[0])</Center><Max>$($ScaleEnd[0])</Max><Min>$($ScaleEnd[0])</Min></X>
              <Y><Center>$($ScaleEnd[1])</Center><Max>$($ScaleEnd[1])</Max><Min>$($ScaleEnd[1])</Min></Y>
              <Z><Center>$($ScaleEnd[2])</Center><Max>$($ScaleEnd[2])</Max><Min>$($ScaleEnd[2])</Min></Z>
            </End>
          </Easing>
        </ScalingValues>
        <RendererCommonValues>
          <ColorTexture>textures/$Texture</ColorTexture>
          <AlphaBlend>$AlphaBlend</AlphaBlend>
          <ZWrite>False</ZWrite>
          <ZTest>True</ZTest>
          <FadeOutType>1</FadeOutType>
          <FadeOut><Frame>$([Math]::Max(4, [int]($Life * 0.28)))</Frame></FadeOut>
        </RendererCommonValues>
        <DrawingValues>
          <Type>2</Type>
          <Sprite>
            <Billboard>$Billboard</Billboard>
            <ColorAll>2</ColorAll>
            <ColorAll_Easing>
              <Start>
                <R><Center>$($ColorStart[0])</Center><Max>$($ColorStart[0])</Max><Min>$($ColorStart[0])</Min></R>
                <G><Center>$($ColorStart[1])</Center><Max>$($ColorStart[1])</Max><Min>$($ColorStart[1])</Min></G>
                <B><Center>$($ColorStart[2])</Center><Max>$($ColorStart[2])</Max><Min>$($ColorStart[2])</Min></B>
                <A><Center>$($ColorStart[3])</Center><Max>$($ColorStart[3])</Max><Min>$($ColorStart[3])</Min></A>
              </Start>
              <End>
                <R><Center>$($ColorEnd[0])</Center><Max>$($ColorEnd[0])</Max><Min>$($ColorEnd[0])</Min></R>
                <G><Center>$($ColorEnd[1])</Center><Max>$($ColorEnd[1])</Max><Min>$($ColorEnd[1])</Min></G>
                <B><Center>$($ColorEnd[2])</Center><Max>$($ColorEnd[2])</Max><Min>$($ColorEnd[2])</Min></B>
                <A><Center>$($ColorEnd[3])</Center><Max>$($ColorEnd[3])</Max><Min>$($ColorEnd[3])</Min></A>
              </End>
            </ColorAll_Easing>
          </Sprite>
        </DrawingValues>
        <Name>$Name</Name>
        <Children />
      </Node>
"@
}

function Write-EfkProj {
    param(
        [string]$FileName,
        [int]$EndFrame,
        [string[]]$Nodes
    )
    $childrenXml = ($Nodes -join "`n")
    $xml = @"
<?xml version="1.0" encoding="utf-8"?>
<EffekseerProject>
  <Root>
    <Name>Root</Name>
    <Children>
$childrenXml
    </Children>
  </Root>
  <ToolVersion>1.80</ToolVersion>
  <Version>3</Version>
  <StartFrame>0</StartFrame>
  <EndFrame>$EndFrame</EndFrame>
  <IsLoop>False</IsLoop>
</EffekseerProject>
"@
    $fullPath = Join-Path $OutDir $FileName
    [System.IO.File]::WriteAllText($fullPath, $xml, (New-Object System.Text.UTF8Encoding $false))
    Write-Host ("  [OK] {0,-42} ({1,2} frames, {2} nodes)" -f $FileName, $EndFrame, $Nodes.Count)
}

Write-Host "Generating 7 Viking Berserker (Norse Ragnarok) Effekseer 1.80.8 .efkproj files in $OutDir ..."

# 1. Basic Attack: Twin Battleaxe Cleave & Heavy Slam
Write-EfkProj "viking_basic_axe.efkproj" 26 @(
    (Make-SpriteNode -Name "AxeCleaveWave" -Texture "axe_cleave_arc.png" -Life 22 -Pos @(0, 1.05, 0.72) -Rot @(-76, 18, -90) -RotVel @(0, 0, 16.0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(3.6, 3.6, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "ForgeSparks" -Texture "berserk_ember.png" -Count 10 -Life 22 -Pos @(0, 1.0, 1.3) -Vel @(0, 0.06, 0.10) -VelMax @(0.10, 0.08, 0.10) -GravityY -0.015 -ScaleStart @(0.32, 0.55, 1) -ScaleEnd @(0.06, 0.12, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "RockChips" -Texture "rock_chunk.png" -Count 6 -Life 24 -Pos @(0, 0.35, 1.4) -Vel @(0, 0.12, 0.08) -VelMax @(0.09, 0.07, 0.09) -GravityY -0.025 -ScaleStart @(0.32, 0.32, 1) -ScaleEnd @(0.18, 0.18, 1) -ColorStart @(168, 144, 124, 240) -ColorEnd @(72, 54, 44, 0) -AlphaBlend 1 -Billboard 0)
)

# 2. Heavy Attack: 360 Whirlwind Twin-Axe Cyclone
Write-EfkProj "viking_heavy_whirlwind.efkproj" 48 @(
    (Make-SpriteNode -Name "WhirlwindLower" -Texture "whirlwind_axe_ring.png" -Life 42 -Pos @(0, 0.72, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 22.0) -ScaleStart @(2.4, 2.4, 1) -ScaleEnd @(5.8, 5.8, 1) -ColorStart @(249, 115, 22, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "WhirlwindUpper" -Texture "whirlwind_axe_ring.png" -Life 40 -Delay 3 -Pos @(0, 1.32, 0) -Rot @(-90, 0, 90) -RotVel @(0, 0, -24.0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(5.4, 5.4, 1) -ColorStart @(254, 240, 138, 250) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "NorseWhirlSeal" -Texture "norse_rune_circle.png" -Life 44 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 8.0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(5.8, 5.8, 1) -ColorStart @(251, 146, 60, 240) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "SeismicRing" -Texture "seismic_shock_ring.png" -Life 34 -Pos @(0, 0.10, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(6.2, 6.2, 1) -ColorStart @(255, 237, 213, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "WhirlEmbers" -Texture "berserk_ember.png" -Count 22 -Life 38 -Pos @(0, 0.9, 0) -PosRand 1.8 -Vel @(0, 0.06, 0) -VelMax @(0.12, 0.06, 0.12) -ScaleStart @(0.35, 0.62, 1) -ScaleEnd @(0.08, 0.16, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 0)
)

# 3. [Q/SD] Weapon Skill: Ragnarok Earthshatter (9.2m Tectonic Crater + Erupting Rock Slabs!)
Write-EfkProj "viking_skill_weapon_ragnarok.efkproj" 86 @(
    (Make-SpriteNode -Name "TectonicCrater" -Texture "tectonic_crater.png" -Life 80 -Pos @(0, 0.05, 0) -Rot @(-90, 0, 0) -ScaleStart @(3.2, 3.2, 1) -ScaleEnd @(9.4, 9.4, 1) -ColorStart @(251, 146, 60, 245) -ColorEnd @(154, 52, 18, 0) -AlphaBlend 1 -Billboard 2),
    (Make-SpriteNode -Name "RagnarokNorseSeal" -Texture "norse_rune_circle.png" -Life 76 -Pos @(0, 0.08, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 3.0) -ScaleStart @(2.8, 2.8, 1) -ScaleEnd @(9.0, 9.0, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "SeismicBlastWave" -Texture "seismic_shock_ring.png" -Life 46 -Pos @(0, 0.12, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(9.8, 9.8, 1) -ColorStart @(255, 247, 237, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "RockPillarCenter" -Texture "earth_pillar_rock.png" -Life 68 -Pos @(0, 1.9, 0) -ScaleStart @(1.6, 0.8, 1) -ScaleEnd @(3.4, 4.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(180, 140, 110, 0) -AlphaBlend 1 -Billboard 2),
    (Make-SpriteNode -Name "ColossusGroundBurst" -Texture "colossus_claw_impact.png" -Life 34 -Pos @(0, 1.2, 0) -ScaleStart @(2.0, 2.0, 1) -ScaleEnd @(6.5, 6.5, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "CatapultBoulders" -Texture "rock_chunk.png" -Count 28 -Life 62 -Pos @(0, 0.5, 0) -PosRand 2.2 -Vel @(0, 0.24, 0) -VelMax @(0.14, 0.12, 0.14) -GravityY -0.022 -ScaleStart @(0.62, 0.62, 1) -ScaleEnd @(0.42, 0.42, 1) -ColorStart @(210, 185, 160, 255) -ColorEnd @(80, 60, 48, 0) -AlphaBlend 1 -Billboard 0)
)

# 4. [E/ASD] Armor Skill: Valhalla Berserk (6s Norse Rage Aura & War-Flame Sheath)
Write-EfkProj "viking_skill_armor_valhalla.efkproj" 90 @(
    (Make-SpriteNode -Name "ValhallaRuneHalo" -Texture "norse_rune_circle.png" -Life 88 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 5.5) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(4.4, 4.4, 1) -ColorStart @(249, 115, 22, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "WarFlameSheath" -Texture "valhalla_rage_vortex.png" -Life 86 -Pos @(0, 1.4, 0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(2.8, 3.4, 1) -ColorStart @(239, 68, 68, 220) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "BerserkRoarRing" -Texture "seismic_shock_ring.png" -Life 38 -Pos @(0, 0.12, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(7.6, 7.6, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "RageEmbers" -Texture "berserk_ember.png" -Count 24 -Life 72 -Pos @(0, 0.4, 0) -PosRand 1.3 -Vel @(0, 0.10, 0) -VelMax @(0.04, 0.06, 0.04) -ScaleStart @(0.38, 0.65, 1) -ScaleEnd @(0.10, 0.18, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 0)
)

# 5. [R/AD] Helmet Skill: Colossus Hurl Throw (Titan Grab & Ring-Out Launch Blast)
Write-EfkProj "viking_skill_helmet_colossus.efkproj" 48 @(
    (Make-SpriteNode -Name "TitanGrabImpact" -Texture "colossus_claw_impact.png" -Life 32 -Pos @(0, 1.15, 1.7) -RotVel @(0, 0, 7.0) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(4.2, 4.2, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "HurlShock1" -Texture "seismic_shock_ring.png" -Life 34 -Pos @(0, 1.1, 1.4) -ScaleStart @(1.0, 1.0, 1) -ScaleEnd @(3.6, 3.6, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "HurlShock2" -Texture "seismic_shock_ring.png" -Life 34 -Delay 4 -Pos @(0, 1.1, 3.0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(3.2, 3.2, 1) -ColorStart @(254, 240, 138, 245) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "StompCrater" -Texture "tectonic_crater.png" -Life 44 -Pos @(0, 0.05, 0.4) -Rot @(-90, 0, 0) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(3.8, 3.8, 1) -ColorStart @(251, 146, 60, 230) -ColorEnd @(120, 53, 15, 0) -AlphaBlend 1 -Billboard 2)
)

# 6. [F/AS] Trinket Skill: Boomerang Tomahawk Launch Spin Burst
Write-EfkProj "viking_skill_trinket_tomahawk.efkproj" 38 @(
    (Make-SpriteNode -Name "TomahawkSpinBurst" -Texture "whirlwind_axe_ring.png" -Life 30 -Pos @(0, 1.08, 0.9) -Rot @(-84, 0, 0) -RotVel @(0, 0, 24.0) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(3.4, 3.4, 1) -ColorStart @(253, 186, 116, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "ThrowRuneBase" -Texture "norse_rune_circle.png" -Life 34 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 6.0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(2.8, 2.8, 1) -ColorStart @(251, 146, 60, 235) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "ThrowEmbers" -Texture "berserk_ember.png" -Count 12 -Life 28 -Pos @(0, 1.05, 1.0) -Vel @(0, 0.04, 0.16) -VelMax @(0.08, 0.05, 0.08) -ScaleStart @(0.30, 0.55, 1) -ScaleEnd @(0.06, 0.12, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0)
)

# 7. Mobility: Berserk Bull Rush / Giant Jump Seismic Stomp
Write-EfkProj "viking_mobility_rush.efkproj" 30 @(
    (Make-SpriteNode -Name "StompShock" -Texture "seismic_shock_ring.png" -Life 26 -Pos @(0, 0.08, 0) -Rot @(-90, 0, 0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(2.8, 2.8, 1) -ColorStart @(251, 146, 60, 245) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "StompRocks" -Texture "rock_chunk.png" -Count 8 -Life 26 -Pos @(0, 0.25, 0) -PosRand 0.4 -Vel @(0, 0.14, 0) -VelMax @(0.09, 0.06, 0.09) -GravityY -0.022 -ScaleStart @(0.34, 0.34, 1) -ScaleEnd @(0.18, 0.18, 1) -ColorStart @(196, 168, 142, 245) -ColorEnd @(72, 54, 44, 0) -AlphaBlend 1 -Billboard 0)
)

Write-Host "`nValidating XML & texture references..."
$missing = 0
Get-ChildItem -Path $OutDir -Filter "*.efkproj" | Sort-Object Name | ForEach-Object {
    [xml]$doc = Get-Content -Path $_.FullName -Raw
    $nodes = $doc.SelectNodes("//ColorTexture")
    foreach ($n in $nodes) {
        $rel = $n.InnerText
        if ($rel) {
            $texPath = Join-Path $OutDir $rel
            if (-not (Test-Path $texPath)) {
                Write-Error "Missing texture $rel referenced by $($_.Name)"
                $missing++
            }
        }
    }
}
if ($missing -eq 0) {
    Write-Host "ALL 7 Viking Berserker (Norse Ragnarok) .efkproj XML files validated with 0 missing textures!"
}
