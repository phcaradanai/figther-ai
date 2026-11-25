# ==============================================================================
# LOST SAGA 3D - CYBORG (TOS RANK 9 MUSKETEER x CYBER-PLASMA) .EFKPROJ GENERATOR
# ==============================================================================
# Generates 7 XML-validated Effekseer 1.80.8 .efkproj projects for Cyborg:
#   1. cyborg_basic_plasma.efkproj         - Grooving Muzzle Starburst & Energy Ribbon
#   2. cyborg_heavy_laser.efkproj          - Penetration Shot Conical Plasma Cannon
#   3. cyborg_skill_weapon_buster.efkproj  - [Q/SD] Buster Beam (9.5m + Snipe Shatter)
#   4. cyborg_skill_armor_emp.efkproj      - [E/ASD] EMP Gravity Dome & Dual-Tone Wave
#   5. cyborg_skill_helmet_missiles.efkproj- [R/AD] Covering Fire Missile Salvo Cones
#   6. cyborg_skill_trinket_flight.efkproj - [F/AS] Flight Assault Laser & Snipe Spire
#   7. cyborg_mobility_jetpack.efkproj     - Recoil Wing Jetpack & Prime Ribbon Boost
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
        [int[]]$ColorStart = @(129, 140, 248, 255),
        [int[]]$ColorEnd = @(56, 189, 248, 0),
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

Write-Host "Generating 7 Cyborg (Musketeer x Cyber-Plasma) Effekseer 1.80.8 .efkproj files in $OutDir ..."

# 1. Basic Attack: Grooving Muzzle Electric Starburst & Sweeping Plasma Ribbon
Write-EfkProj "cyborg_basic_plasma.efkproj" 24 @(
    (Make-SpriteNode -Name "GroovingStarburst" -Texture "grooving_starburst.png" -Life 18 -Pos @(0, 1.02, 0.98) -RotVel @(0, 0, 10.0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(2.3, 2.3, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 0),
    (Make-SpriteNode -Name "CasterFloorWave" -Texture "cerulean_wave_ring.png" -Life 22 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -ScaleStart @(0.9, 0.9, 1) -ScaleEnd @(2.2, 2.2, 1) -ColorStart @(56, 189, 248, 220) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "BirdfallRibbon" -Texture "birdfall_ribbon.png" -Life 20 -Pos @(0, 1.02, 1.05) -Rot @(-82, 0, -90) -RotVel @(0, 0, 14.0) -ScaleStart @(1.1, 1.1, 1) -ScaleEnd @(2.4, 2.4, 1) -ColorStart @(103, 232, 249, 240) -ColorEnd @(129, 140, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "OverdriveSparks" -Texture "overdrive_spark.png" -Count 10 -Life 18 -Pos @(0, 1.02, 1.05) -Vel @(0, 0.04, 0.14) -VelMax @(0.08, 0.06, 0.08) -ScaleStart @(0.22, 0.48, 1) -ScaleEnd @(0.05, 0.12, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(249, 115, 22, 0) -Billboard 0)
)

# 2. Heavy Attack: Penetration Shot Roaring Conical Plasma Blast
Write-EfkProj "cyborg_heavy_laser.efkproj" 42 @(
    (Make-SpriteNode -Name "PenetrationConeH" -Texture "penetration_cone.png" -Life 30 -Pos @(0, 1.04, 2.9) -Rot @(-90, 0, -90) -ScaleStart @(1.8, 1.2, 1) -ScaleEnd @(4.6, 2.9, 1) -ColorStart @(255, 237, 213, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "PenetrationConeV" -Texture "penetration_cone.png" -Life 30 -Pos @(0, 1.04, 2.9) -Rot @(0, 90, 0) -ScaleStart @(1.8, 1.2, 1) -ScaleEnd @(4.6, 2.5, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "GroovingMuzzleNova" -Texture "grooving_starburst.png" -Life 24 -Pos @(0, 1.04, 1.15) -RotVel @(0, 0, -9.0) -ScaleStart @(1.4, 1.4, 1) -ScaleEnd @(3.6, 3.6, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 0),
    (Make-SpriteNode -Name "CasterCeruleanRing" -Texture "cerulean_wave_ring.png" -Life 36 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(4.4, 4.4, 1) -ColorStart @(56, 189, 248, 250) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "PrimeRecoilRibbon" -Texture "birdfall_ribbon.png" -Life 32 -Pos @(0, 1.0, 0) -Rot @(-85, 0, 0) -RotVel @(0, 0, 14.0) -ScaleStart @(1.5, 1.5, 1) -ScaleEnd @(3.4, 3.4, 1) -ColorStart @(129, 140, 248, 245) -ColorEnd @(56, 189, 248, 0) -Billboard 2)
)

# 3. [Q/SD] Weapon Skill: Buster Beam (9.5m Plasma Cannon + Cone Blast + Snipe Shatter)
Write-EfkProj "cyborg_skill_weapon_buster.efkproj" 76 @(
    (Make-SpriteNode -Name "BusterBeamH" -Texture "buster_beam_core.png" -Life 62 -Pos @(0, 1.08, 5.6) -Rot @(-90, 0, -90) -ScaleStart @(9.6, 2.9, 1) -ScaleEnd @(9.8, 1.1, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "BusterBeamV" -Texture "buster_beam_core.png" -Life 62 -Pos @(0, 1.08, 5.6) -Rot @(0, 90, 0) -ScaleStart @(9.6, 2.9, 1) -ScaleEnd @(9.8, 1.1, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(99, 102, 241, 0) -Billboard 2),
    (Make-SpriteNode -Name "WarmMuzzleCone" -Texture "penetration_cone.png" -Life 46 -Pos @(0, 1.08, 2.6) -Rot @(-90, 0, -90) -ScaleStart @(3.6, 2.6, 1) -ScaleEnd @(4.6, 1.4, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "CasterCeruleanWave" -Texture "cerulean_wave_ring.png" -Life 64 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(5.4, 5.4, 1) -ColorStart @(56, 189, 248, 255) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "TerminalSnipeShatter" -Texture "snipe_shatter_pillar.png" -Life 54 -Delay 4 -Pos @(0, 2.2, 9.5) -ScaleStart @(1.4, 1.2, 1) -ScaleEnd @(3.4, 5.2, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "TerminalGroovingNova" -Texture "grooving_starburst.png" -Life 46 -Delay 4 -Pos @(0, 1.4, 9.5) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(6.4, 6.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 0)
)

# 4. [E/ASD] Armor Skill: EMP Gravity Field (Dual-Tone Cerulean-Orange Wave + Hex Dome + Ribbons)
Write-EfkProj "cyborg_skill_armor_emp.efkproj" 82 @(
    (Make-SpriteNode -Name "DualToneEMPWave" -Texture "cerulean_wave_ring.png" -Life 74 -Pos @(0, 0.06, 0) -Rot @(-90, 0, 0) -RotVel @(0, 0, -5.0) -ScaleStart @(2.4, 2.4, 1) -ScaleEnd @(9.8, 9.8, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "HexDomeGrid" -Texture "hex_emp_grid.png" -Life 72 -Pos @(0, 2.2, 0) -ScaleStart @(3.6, 2.6, 1) -ScaleEnd @(9.2, 4.6, 1) -ColorStart @(129, 140, 248, 225) -ColorEnd @(56, 189, 248, 0) -Billboard 0),
    (Make-SpriteNode -Name "PrimeSwirlRibbons" -Texture "birdfall_ribbon.png" -Count 3 -Life 62 -Pos @(0, 1.1, 0) -Rot @(-84, 0, 0) -RotVel @(0, 0, 16.0) -ScaleStart @(8.4, 8.4, 1) -ScaleEnd @(1.6, 1.6, 1) -ColorStart @(103, 232, 249, 245) -ColorEnd @(139, 92, 246, 0) -Billboard 2),
    (Make-SpriteNode -Name "EMPDischargeArcs" -Texture "plasma_arc_bolt.png" -Count 8 -Life 54 -Pos @(0, 1.5, 0) -PosRand 2.2 -ScaleStart @(1.1, 2.8, 1) -ScaleEnd @(0.6, 3.4, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 0),
    (Make-SpriteNode -Name "CenterGroovingBurst" -Texture "grooving_starburst.png" -Life 42 -Pos @(0, 1.15, 0) -ScaleStart @(1.8, 1.8, 1) -ScaleEnd @(5.2, 5.2, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 0)
)

# 5. [R/AD] Helmet Skill: Covering Fire Missile Salvo (3 Fiery Energy Cones + Sweeping Arc!)
Write-EfkProj "cyborg_skill_helmet_missiles.efkproj" 56 @(
    (Make-SpriteNode -Name "CoveringConeL" -Texture "penetration_cone.png" -Life 34 -Pos @(-0.8, 1.4, 1.3) -Rot @(-90, 20, -90) -ScaleStart @(1.2, 0.9, 1) -ScaleEnd @(2.8, 1.8, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "CoveringConeC" -Texture "penetration_cone.png" -Life 34 -Delay 2 -Pos @(0, 1.5, 1.5) -Rot @(-90, 0, -90) -ScaleStart @(1.3, 1.0, 1) -ScaleEnd @(3.1, 2.0, 1) -ColorStart @(255, 247, 204, 255) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "CoveringConeR" -Texture "penetration_cone.png" -Life 34 -Delay 4 -Pos @(0.8, 1.4, 1.3) -Rot @(-90, -20, -90) -ScaleStart @(1.2, 0.9, 1) -ScaleEnd @(2.8, 1.8, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(234, 88, 12, 0) -Billboard 2),
    (Make-SpriteNode -Name "BirdfallSweepArc" -Texture "birdfall_ribbon.png" -Life 40 -Pos @(0, 1.35, 0.9) -Rot @(-84, 0, -90) -RotVel @(0, 0, 10.0) -ScaleStart @(1.6, 1.6, 1) -ScaleEnd @(4.6, 4.6, 1) -ColorStart @(56, 189, 248, 250) -ColorEnd @(249, 115, 22, 0) -Billboard 2),
    (Make-SpriteNode -Name "SalvoStarburst" -Texture "grooving_starburst.png" -Life 28 -Pos @(0, 1.45, 1.0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(3.4, 3.4, 1) -ColorStart @(255, 247, 204, 255) -ColorEnd @(249, 115, 22, 0) -Billboard 0)
)

# 6. [F/AS] Trinket Skill: Flight Assault Thruster + Diagonal Laser + Snipe Shatter Column
Write-EfkProj "cyborg_skill_trinket_flight.efkproj" 70 @(
    (Make-SpriteNode -Name "TakeoffCeruleanWave" -Texture "cerulean_wave_ring.png" -Life 46 -Pos @(0, 0.08, 0) -Rot @(-90, 0, 0) -ScaleStart @(1.2, 1.2, 1) -ScaleEnd @(5.4, 5.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "WingThrusterL" -Texture "jet_thruster_plume.png" -Life 46 -Pos @(-0.55, 1.8, -0.25) -ScaleStart @(0.8, 2.0, 1) -ScaleEnd @(0.4, 3.0, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "WingThrusterR" -Texture "jet_thruster_plume.png" -Life 46 -Pos @(0.55, 1.8, -0.25) -ScaleStart @(0.8, 2.0, 1) -ScaleEnd @(0.4, 3.0, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "DiagonalLaserBeam" -Texture "buster_beam_core.png" -Life 42 -Pos @(0, 1.85, 2.5) -Rot @(0, 90, -32) -ScaleStart @(6.2, 1.9, 1) -ScaleEnd @(6.4, 0.5, 1) -ColorStart @(224, 248, 255, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "SnipeImpactShatter" -Texture "snipe_shatter_pillar.png" -Life 54 -Pos @(0, 2.3, 5.0) -ScaleStart @(1.5, 1.4, 1) -ScaleEnd @(3.8, 5.4, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 2),
    (Make-SpriteNode -Name "ImpactGroovingNova" -Texture "grooving_starburst.png" -Life 38 -Pos @(0, 0.7, 5.0) -ScaleStart @(2.2, 2.2, 1) -ScaleEnd @(5.8, 5.8, 1) -ColorStart @(255, 255, 255, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 0)
)

# 7. Mobility: Recoil Jetpack & Prime-and-Load Ribbon Boost
Write-EfkProj "cyborg_mobility_jetpack.efkproj" 30 @(
    (Make-SpriteNode -Name "PrimeBoostRibbon" -Texture "birdfall_ribbon.png" -Life 26 -Pos @(0, 0.45, 0) -Rot @(-84, 0, 0) -RotVel @(0, 0, 15.0) -ScaleStart @(1.1, 1.1, 1) -ScaleEnd @(2.8, 2.8, 1) -ColorStart @(103, 232, 249, 255) -ColorEnd @(139, 92, 246, 0) -Billboard 2),
    (Make-SpriteNode -Name "JetPlume" -Texture "jet_thruster_plume.png" -Life 24 -Pos @(0, 0.95, -0.25) -ScaleStart @(0.65, 1.4, 1) -ScaleEnd @(0.3, 2.2, 1) -ColorStart @(251, 146, 60, 255) -ColorEnd @(56, 189, 248, 0) -Billboard 2),
    (Make-SpriteNode -Name "BoostSparks" -Texture "overdrive_spark.png" -Count 10 -Life 24 -Pos @(0, 0.7, 0) -PosRand 0.4 -Vel @(0, -0.06, -0.06) -VelMax @(0.08, 0.06, 0.08) -ScaleStart @(0.24, 0.5, 1) -ScaleEnd @(0.05, 0.12, 1) -ColorStart @(251, 191, 36, 255) -ColorEnd @(129, 140, 248, 0) -Billboard 0)
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
    Write-Host "ALL 7 Cyborg (Musketeer x Cyber-Plasma) .efkproj XML files validated with 0 missing textures!"
}
