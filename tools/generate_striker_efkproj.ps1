# ==============================================================================
# LOST SAGA 3D - MUAY THAI STRIKER EFFEKSEER 1.80.8 .EFKPROJ GENERATOR
# ==============================================================================
# Generates 7 XML-validated Effekseer 1.80.8 .efkproj projects for Striker:
#   1. striker_basic_combo.efkproj          - 4-Hit Muay Thai Punch/Kick Combo
#   2. striker_heavy_uppercut.efkproj       - Tiger Uppercut Rising Dragon Spiral
#   3. striker_skill_weapon_fists.efkproj   - [Q/SD] Asura Hundred Fists Barrage
#   4. striker_skill_armor_sway.efkproj     - [E/ASD] Sway & Liver Blow Counter
#   5. striker_skill_helmet_footwork.efkproj- [R/AD] Lightning Footwork Dash (-3s)
#   6. striker_skill_trinket_stomp.efkproj  - [F/AS] Seismic Ground Stomp Updraft
#   7. striker_mobility_sway.efkproj        - Air Sway Footwork / Double Jump
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\striker"
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
        [int[]]$ColorStart = @(250, 204, 21, 255),
        [int[]]$ColorEnd = @(234, 88, 12, 0),
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

Write-Host "Generating 7 Muay Thai Striker Effekseer 1.80.8 .efkproj files in $OutDir ..."

# 1. Basic Attack: 4-Hit Muay Thai Punch & Kick Combo
Write-EfkProj "striker_basic_combo.efkproj" 22 @(
    (Make-SpriteNode -Name "FistPunchBurst" -Texture "tiger_fist_impact.png" -Life 16 -Pos @(0, 1.05, 1.35) -RotVel @(0, 0, 8.0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(2.2, 2.2, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "KickGustArc" -Texture "muay_kick_arc.png" -Life 18 -Pos @(0, 1.05, 0.65) -Rot @(-80, 12, -90) -RotVel @(0, 0, 18.0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(3.0, 3.0, 1) -ColorStart @(250, 204, 21, 245) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "ChiSparks" -Texture "chi_spark.png" -Count 10 -Life 18 -Pos @(0, 1.05, 1.35) -Vel @(0, 0.04, 0.14) -VelMax @(0.08, 0.06, 0.08) -ScaleStart @(0.26, 0.52, 1) -ScaleEnd @(0.05, 0.12, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0)
)

# 2. Heavy Attack: Tiger Uppercut (Rising Golden Dragon-Tiger Vortex!)
Write-EfkProj "striker_heavy_uppercut.efkproj" 50 @(
    (Make-SpriteNode -Name "ThaiLotusLaunch" -Texture "thai_lotus_mandala.png" -Life 44 -Pos @(0, 0.06, 0.6) -Rot @(-90, 0, 0) -RotVel @(0, 0, 7.0) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(4.6, 4.6, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "UppercutSpiral" -Texture "tiger_uppercut_spiral.png" -Life 42 -Pos @(0, 2.2, 0.9) -ScaleStart @(1.8, 1.6, 1) -ScaleEnd @(3.2, 4.8, 1) -ColorStart @(250, 204, 21, 250) -ColorEnd @(220, 38, 38, 0) -Billboard 0),
    (Make-SpriteNode -Name "RisingRing1" -Texture "golden_shock_ring.png" -Life 34 -Pos @(0, 0.8, 0.9) -Rot @(-90, 0, 0) -Vel @(0, 0.10, 0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(3.6, 3.6, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "ZenithFistBurst" -Texture "tiger_fist_impact.png" -Life 30 -Delay 6 -Pos @(0, 3.4, 1.1) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(4.2, 4.2, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(245, 158, 11, 0) -Billboard 0),
    (Make-SpriteNode -Name "UppercutLightning" -Texture "gold_lightning_arc.png" -Count 3 -Life 30 -Pos @(0, 2.0, 1.0) -PosRand 0.8 -ScaleStart @(0.9, 2.4, 1) -ScaleEnd @(0.5, 3.6, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(250, 204, 21, 0) -Billboard 0)
)

# 3. [Q/SD] Weapon Skill: Asura Hundred Fists (Rapid-Fire Flurry + Dragon Finisher!)
Write-EfkProj "striker_skill_weapon_fists.efkproj" 74 @(
    (Make-SpriteNode -Name "ThaiArenaLotus" -Texture "thai_lotus_mandala.png" -Life 68 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 5.5) -ScaleStart @(2.0, 2.0, 1) -ScaleEnd @(6.8, 6.8, 1) -ColorStart @(250, 204, 21, 250) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "HundredFistCluster" -Texture "rapid_fist_barrage.png" -Count 12 -Life 24 -SpawnRate 3.0 -Pos @(0, 1.15, 0) -PosRand 1.3 -ScaleStart @(1.1, 1.1, 1) -ScaleEnd @(2.6, 2.6, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "FinisherDragonRing" -Texture "golden_shock_ring.png" -Life 34 -Delay 28 -Pos @(0, 0.10, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(7.4, 7.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(245, 158, 11, 0) -Billboard 2),
    (Make-SpriteNode -Name "FinisherTigerFlare" -Texture "tiger_flare.png" -Life 26 -Delay 28 -Pos @(0, 1.25, 0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(6.4, 6.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0),
    (Make-SpriteNode -Name "BarrageChiSparks" -Texture "chi_spark.png" -Count 26 -Life 46 -Pos @(0, 1.1, 0) -PosRand 1.5 -Vel @(0, 0.08, 0.08) -VelMax @(0.14, 0.10, 0.14) -ScaleStart @(0.35, 0.65, 1) -ScaleEnd @(0.08, 0.16, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 0)
)

# 4. [E/ASD] Armor Skill: Sway & Liver Blow (700ms Evade + Piercing Counter Gut-Punch!)
Write-EfkProj "striker_skill_armor_sway.efkproj" 56 @(
    (Make-SpriteNode -Name "SwayLotusRing" -Texture "thai_lotus_mandala.png" -Life 48 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, -7.0) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(4.6, 4.6, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "LiverBlowImpact" -Texture "tiger_fist_impact.png" -Life 34 -Pos @(0, 1.05, 1.65) -RotVel @(0, 0, 8.0) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(4.8, 4.8, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(220, 38, 38, 0) -Billboard 0),
    (Make-SpriteNode -Name "PiercingShock1" -Texture "golden_shock_ring.png" -Life 32 -Pos @(0, 1.05, 1.55) -ScaleStart @(1.1, 1.1, 1) -ScaleEnd @(4.2, 4.2, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "StunLightning" -Texture "gold_lightning_arc.png" -Count 4 -Life 36 -Pos @(0, 1.1, 1.75) -PosRand 0.9 -ScaleStart @(1.0, 2.4, 1) -ScaleEnd @(0.5, 3.2, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(250, 204, 21, 0) -Billboard 0)
)

# 5. [R/AD] Helmet Skill: Lightning Footwork (Golden Thunderbolt Dash + Cooldown Reset!)
Write-EfkProj "striker_skill_helmet_footwork.efkproj" 52 @(
    (Make-SpriteNode -Name "FootworkLotusReset" -Texture "thai_lotus_mandala.png" -Life 46 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 9.0) -ScaleStart @(1.5, 1.5, 1) -ScaleEnd @(4.8, 4.8, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(250, 204, 21, 0) -Billboard 2),
    (Make-SpriteNode -Name "DashBolts" -Texture "gold_lightning_arc.png" -Count 5 -Life 36 -SpawnRate 2.0 -Pos @(0, 1.4, 2.0) -PosRand 1.6 -ScaleStart @(1.1, 2.8, 1) -ScaleEnd @(0.5, 3.8, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(250, 204, 21, 0) -Billboard 0),
    (Make-SpriteNode -Name "SpeedGateRing" -Texture "golden_shock_ring.png" -Life 32 -Pos @(0, 1.05, 1.8) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(3.6, 3.6, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(245, 158, 11, 0) -Billboard 2),
    (Make-SpriteNode -Name "SpeedFlare" -Texture "tiger_flare.png" -Life 24 -Pos @(0, 1.1, 0.5) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(4.2, 4.2, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(250, 204, 21, 0) -Billboard 0)
)

# 6. [F/AS] Trinket Skill: Seismic Ground Stomp (8.4m Golden Fracture + Skyward Updraft!)
Write-EfkProj "striker_skill_trinket_stomp.efkproj" 64 @(
    (Make-SpriteNode -Name "StompFissures" -Texture "stomp_fissure_ring.png" -Life 58 -Pos @(0, 0.05, 0) -Rot @(-90, 0, 0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(8.6, 8.6, 1) -ColorStart @(254, 240, 138, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "StompThaiLotus" -Texture "thai_lotus_mandala.png" -Life 56 -Pos @(0, 0.08, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 4.0) -ScaleStart @(2.0, 2.0, 1) -ScaleEnd @(8.2, 8.2, 1) -ColorStart @(250, 204, 21, 250) -ColorEnd @(220, 38, 38, 0) -Billboard 2),
    (Make-SpriteNode -Name "UpdraftRing" -Texture "golden_shock_ring.png" -Life 40 -Pos @(0, 0.2, 0) -Rot @(-90, 0, 0) -Vel @(0, 0.11, 0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(8.4, 8.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(245, 158, 11, 0) -Billboard 2),
    (Make-SpriteNode -Name "UpdraftSparks" -Texture "chi_spark.png" -Count 24 -Life 44 -Pos @(0, 0.3, 0) -PosRand 2.8 -Vel @(0, 0.22, 0) -VelMax @(0.08, 0.10, 0.08) -ScaleStart @(0.36, 0.72, 1) -ScaleEnd @(0.08, 0.18, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 0)
)

# 7. Mobility: Air Sway Footwork / Double Jump
Write-EfkProj "striker_mobility_sway.efkproj" 28 @(
    (Make-SpriteNode -Name "SwayLotusStep" -Texture "thai_lotus_mandala.png" -Life 24 -Pos @(0, 0.08, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 8.0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(2.4, 2.4, 1) -ColorStart @(254, 240, 138, 250) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "SwayRing" -Texture "golden_shock_ring.png" -Life 24 -Pos @(0, 0.12, 0) -Rot @(-90, 0, 0) -ScaleStart @(0.8, 0.8, 1) -ScaleEnd @(2.6, 2.6, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(250, 204, 21, 0) -Billboard 2),
    (Make-SpriteNode -Name "SwaySparks" -Texture "chi_spark.png" -Count 10 -Life 22 -Pos @(0, 0.6, 0) -PosRand 0.4 -Vel @(0, 0.04, 0) -VelMax @(0.08, 0.06, 0.08) -ScaleStart @(0.26, 0.52, 1) -ScaleEnd @(0.05, 0.12, 1) -ColorStart @(254, 249, 195, 255) -ColorEnd @(245, 158, 11, 0) -Billboard 0)
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
    Write-Host "ALL 7 Muay Thai Striker .efkproj XML files validated with 0 missing textures!"
}
