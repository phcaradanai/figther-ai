# ==============================================================================
# LOST SAGA 3D - GIGA SUIT (CYBORG MECHA) EFFEKSEER 1.80.8 .EFKPROJ GENERATOR
# ==============================================================================
# Generates 7 XML-validated Effekseer 1.80.8 .efkproj source projects for Giga Suit:
#   1. cyborg_basic_plasma.efkproj         - Plasma Rifle HUD Muzzle Cast
#   2. cyborg_heavy_laser.efkproj          - Giga Laser Cannon Rail Accelerator
#   3. cyborg_skill_weapon_buster.efkproj  - [Q/SD] Giga Buster Beam (9.5m Cannon)
#   4. cyborg_skill_armor_emp.efkproj      - [E/ASD] EMP Gravity Field Dome (4.8m)
#   5. cyborg_skill_helmet_missiles.efkproj- [R/AD] Giga Homing Missiles Launch Pods
#   6. cyborg_skill_trinket_flight.efkproj - [F/AS] Flight Assault Thruster & Laser
#   7. cyborg_mobility_jetpack.efkproj     - Giga Jetpack Fly / Air Boost
# ==============================================================================
param(
    [string]$OutDir = "$PSScriptRoot\..\public\assets\vfx\cyborg"
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
        [int[]]$ColorStart = @(56, 189, 248, 255),
        [int[]]$ColorEnd = @(14, 165, 233, 0),
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

Write-Host "Generating 7 Giga Suit (Cyborg Mecha) Effekseer 1.80.8 .efkproj files in $OutDir ..."

# 1. Basic Attack: Plasma Rifle HUD Muzzle Flash
Write-EfkProj "cyborg_basic_plasma.efkproj" 22 @(
    (Make-SpriteNode -Name "MuzzleReticle" -Texture "mecha_hud_reticle.png" -Life 20 -Pos @(0, 1.02, 0.92) -RotVel @(0, 0, 9.0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(1.8, 1.8, 1) -ColorStart @(56, 189, 248, 245) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "AnamorphicFlare" -Texture "mecha_flare.png" -Life 14 -Pos @(0, 1.02, 0.98) -ScaleStart @(1.1, 0.7, 1) -ScaleEnd @(2.6, 1.3, 1) -ColorStart @(236, 254, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0),
    (Make-SpriteNode -Name "IonSparks" -Texture "ion_spark.png" -Count 10 -Life 18 -Pos @(0, 1.02, 1.0) -Vel @(0, 0.04, 0.14) -VelMax @(0.08, 0.06, 0.08) -ScaleStart @(0.22, 0.45, 1) -ScaleEnd @(0.05, 0.12, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0)
)

# 2. Heavy Attack: Giga Laser Cannon Rail Accelerator
Write-EfkProj "cyborg_heavy_laser.efkproj" 38 @(
    (Make-SpriteNode -Name "RailReticle" -Texture "mecha_hud_reticle.png" -Life 32 -Pos @(0, 1.02, 1.05) -RotVel @(0, 0, -10.0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(2.6, 2.6, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "RailRing1" -Texture "rail_shock_ring.png" -Life 28 -Delay 0 -Pos @(0, 1.02, 1.15) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(2.9, 2.9, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "RailRing2" -Texture "rail_shock_ring.png" -Life 28 -Delay 3 -Pos @(0, 1.02, 2.35) -ScaleStart @(0.8, 0.8, 1) -ScaleEnd @(2.5, 2.5, 1) -ColorStart @(56, 189, 248, 245) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "RailRing3" -Texture "rail_shock_ring.png" -Life 26 -Delay 6 -Pos @(0, 1.02, 3.55) -ScaleStart @(0.7, 0.7, 1) -ScaleEnd @(2.2, 2.2, 1) -ColorStart @(249, 115, 22, 235) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "CannonFlare" -Texture "mecha_flare.png" -Life 20 -Pos @(0, 1.02, 1.12) -ScaleStart @(2.2, 1.1, 1) -ScaleEnd @(4.6, 1.8, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0),
    (Make-SpriteNode -Name "RailArcs" -Texture "plasma_arc_bolt.png" -Count 4 -Life 22 -Pos @(0, 1.02, 1.8) -PosRand 0.6 -ScaleStart @(0.8, 1.8, 1) -ScaleEnd @(0.4, 2.4, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0)
)

# 3. [Q/SD] Weapon Skill: Giga Buster Beam (9.5m Forward Giant Plasma Cannon!)
Write-EfkProj "cyborg_skill_weapon_buster.efkproj" 74 @(
    (Make-SpriteNode -Name "BusterBeamCoreH" -Texture "buster_beam_core.png" -Life 62 -Pos @(0, 1.05, 5.4) -Rot @(-90, 0, -90) -ScaleStart @(9.6, 2.8, 1) -ScaleEnd @(9.8, 1.2, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "BusterBeamCoreV" -Texture "buster_beam_core.png" -Life 62 -Pos @(0, 1.05, 5.4) -Rot @(0, 90, 0) -ScaleStart @(9.6, 2.8, 1) -ScaleEnd @(9.8, 1.2, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "CannonHUD" -Texture "mecha_hud_reticle.png" -Life 66 -Pos @(0, 1.05, 0.95) -RotVel @(0, 0, 8.0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(3.6, 3.6, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "AcceleratorRing1" -Texture "rail_shock_ring.png" -Life 50 -Delay 0 -Pos @(0, 1.05, 1.8) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(4.4, 4.4, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "AcceleratorRing2" -Texture "rail_shock_ring.png" -Life 50 -Delay 5 -Pos @(0, 1.05, 4.4) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(4.0, 4.0, 1) -ColorStart @(56, 189, 248, 250) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "TerminalDetonation" -Texture "mecha_flare.png" -Life 42 -Delay 4 -Pos @(0, 1.15, 9.5) -ScaleStart @(2.4, 1.8, 1) -ScaleEnd @(6.4, 4.2, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0),
    (Make-SpriteNode -Name "HexDebris" -Texture "cyber_hex_tile.png" -Count 24 -Life 56 -Pos @(0, 1.0, 5.2) -PosRand 1.8 -Vel @(0, 0.08, 0.06) -VelMax @(0.10, 0.08, 0.14) -ScaleStart @(0.42, 0.42, 1) -ScaleEnd @(0.12, 0.12, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(14, 165, 233, 0) -Billboard 0)
)

# 4. [E/ASD] Armor Skill: EMP Gravity Field (9.6m Imploding Gravity Dome & Lightning)
Write-EfkProj "cyborg_skill_armor_emp.efkproj" 82 @(
    (Make-SpriteNode -Name "EMPFloorHUD" -Texture "mecha_hud_reticle.png" -Life 76 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, -6.5) -ScaleStart @(2.8, 2.8, 1) -ScaleEnd @(9.6, 9.6, 1) -ColorStart @(56, 189, 248, 250) -ColorEnd @(45, 212, 191, 0) -Billboard 2),
    (Make-SpriteNode -Name "ImplosionRing" -Texture "rail_shock_ring.png" -Life 48 -Pos @(0, 0.12, 0) -Rot @(-90, 0, 0) -ScaleStart @(9.6, 9.6, 1) -ScaleEnd @(1.4, 1.4, 1) -ColorStart @(45, 212, 191, 255) -ColorEnd @(224, 248, 255, 0) -Billboard 2),
    (Make-SpriteNode -Name "HexDomeGrid" -Texture "hex_emp_grid.png" -Life 72 -Pos @(0, 2.2, 0) -ScaleStart @(3.6, 2.6, 1) -ScaleEnd @(9.2, 4.6, 1) -ColorStart @(56, 189, 248, 220) -ColorEnd @(14, 165, 233, 0) -Billboard 0),
    (Make-SpriteNode -Name "EMPDischargeArcs" -Texture "plasma_arc_bolt.png" -Count 8 -Life 54 -Pos @(0, 1.5, 0) -PosRand 2.2 -ScaleStart @(1.1, 2.8, 1) -ScaleEnd @(0.6, 3.4, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0),
    (Make-SpriteNode -Name "GravityHexCells" -Texture "cyber_hex_tile.png" -Count 24 -Life 62 -Pos @(0, 1.2, 0) -PosRand 3.2 -Vel @(0, 0.04, 0) -VelMax @(0.08, 0.05, 0.08) -ScaleStart @(0.44, 0.44, 1) -ScaleEnd @(0.10, 0.10, 1) -ColorStart @(45, 212, 191, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0)
)

# 5. [R/AD] Helmet Skill: Giga Homing Missiles Shoulder Pod Salvo Launch
Write-EfkProj "cyborg_skill_helmet_missiles.efkproj" 54 @(
    (Make-SpriteNode -Name "PodLockReticleL" -Texture "mecha_hud_reticle.png" -Life 44 -Pos @(-0.85, 1.45, 0.85) -RotVel @(0, 0, 8.0) -ScaleStart @(0.8, 0.8, 1) -ScaleEnd @(1.6, 1.6, 1) -ColorStart @(249, 115, 22, 255) -ColorEnd @(251, 191, 36, 0) -Billboard 2),
    (Make-SpriteNode -Name "PodLockReticleC" -Texture "mecha_hud_reticle.png" -Life 44 -Pos @(0, 1.55, 1.05) -RotVel @(0, 0, -8.0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(1.8, 1.8, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "PodLockReticleR" -Texture "mecha_hud_reticle.png" -Life 44 -Pos @(0.85, 1.45, 0.85) -RotVel @(0, 0, 8.0) -ScaleStart @(0.8, 0.8, 1) -ScaleEnd @(1.6, 1.6, 1) -ColorStart @(249, 115, 22, 255) -ColorEnd @(251, 191, 36, 0) -Billboard 2),
    (Make-SpriteNode -Name "RocketBackblast" -Texture "jet_thruster_plume.png" -Life 26 -Pos @(0, 1.35, -0.55) -Rot @(90, 0, 0) -ScaleStart @(0.9, 1.6, 1) -ScaleEnd @(1.4, 2.6, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "LaunchSmoke" -Texture "missile_smoke_puff.png" -Count 12 -Life 48 -Pos @(0, 1.3, 0.3) -PosRand 0.7 -Vel @(0, 0.04, -0.05) -VelMax @(0.06, 0.04, 0.05) -ScaleStart @(0.8, 0.8, 1) -ScaleEnd @(2.4, 2.4, 1) -ColorStart @(226, 232, 240, 190) -ColorEnd @(100, 116, 139, 0) -AlphaBlend 1 -Billboard 0)
)

# 6. [F/AS] Trinket Skill: Flight Assault Thruster & Diagonal Aerial Laser
Write-EfkProj "cyborg_skill_trinket_flight.efkproj" 68 @(
    (Make-SpriteNode -Name "TakeoffRing" -Texture "rail_shock_ring.png" -Life 44 -Pos @(0, 0.08, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(5.2, 5.2, 1) -ColorStart @(249, 115, 22, 250) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "WingThrusterL" -Texture "jet_thruster_plume.png" -Life 46 -Pos @(-0.55, 1.6, -0.25) -ScaleStart @(0.75, 1.9, 1) -ScaleEnd @(0.4, 2.8, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "WingThrusterR" -Texture "jet_thruster_plume.png" -Life 46 -Pos @(0.55, 1.6, -0.25) -ScaleStart @(0.75, 1.9, 1) -ScaleEnd @(0.4, 2.8, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "DiagonalLaserBeam" -Texture "buster_beam_core.png" -Life 42 -Pos @(0, 1.85, 2.5) -Rot @(0, 90, -32) -ScaleStart @(6.2, 1.8, 1) -ScaleEnd @(6.4, 0.5, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "ImpactTargetHUD" -Texture "mecha_hud_reticle.png" -Life 58 -Pos @(0, 0.08, 5.0) -Rot @(-90, 0, 0) -RotVel @(0, 0, 7.0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(7.2, 7.2, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(14, 165, 233, 0) -Billboard 2),
    (Make-SpriteNode -Name "ImpactFlare" -Texture "mecha_flare.png" -Life 34 -Pos @(0, 0.65, 5.0) -ScaleStart @(2.2, 1.8, 1) -ScaleEnd @(5.4, 3.6, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0)
)

# 7. Mobility: Giga Jetpack Fly / Air Boost
Write-EfkProj "cyborg_mobility_jetpack.efkproj" 30 @(
    (Make-SpriteNode -Name "BoostRing" -Texture "rail_shock_ring.png" -Life 26 -Pos @(0, 0.12, 0) -Rot @(-90, 0, 0) -ScaleStart @(0.8, 0.8, 1) -ScaleEnd @(2.6, 2.6, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "JetPlume" -Texture "jet_thruster_plume.png" -Life 24 -Pos @(0, 0.95, -0.25) -ScaleStart @(0.65, 1.4, 1) -ScaleEnd @(0.3, 2.2, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "BoostSparks" -Texture "ion_spark.png" -Count 10 -Life 24 -Pos @(0, 0.7, 0) -PosRand 0.4 -Vel @(0, -0.06, -0.06) -VelMax @(0.08, 0.06, 0.08) -ScaleStart @(0.24, 0.5, 1) -ScaleEnd @(0.05, 0.12, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 0)
)

# Validate all 7 generated .efkproj files parse as strict XML and every referenced texture exists
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
    Write-Host "ALL 7 Giga Suit (Cyborg Mecha) .efkproj XML files validated with 0 missing textures!"
}
