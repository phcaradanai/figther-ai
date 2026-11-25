# ============================================================================
# LOST SAGA 3D - NECRO GRIM REAPER (REAPER) EFFEKSEER 1.80.8 .EFKPROJ GENERATOR
# ============================================================================
# Generates 7 Effekseer 1.80.8 XML project files in public/assets/vfx/reaper/:
#   1. reaper_basic_combo.efkproj          - 3-hit Death Scythe Reap Combo
#   2. reaper_heavy_hook.efkproj           - Soul Hook Pull (4.8m chain + hook)
#   3. reaper_skill_weapon_harvest.efkproj - [Q/SD] Grim Soul Harvest (360 reap)
#   4. reaper_skill_armor_wraith.efkproj   - [E/ASD] Wraith Mist Form
#   5. reaper_skill_helmet_skulls.efkproj  - [R/AD] Phantom Skull Swarm
#   6. reaper_skill_trinket_chains.efkproj - [F/AS] Abyssal Grave Chains
#   7. reaper_mobility_wraith.efkproj      - Wraith Float Fly / Shadow Air Dash
# ============================================================================
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$outDir = Join-Path $PSScriptRoot '..\public\assets\vfx\reaper'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

function Make-SpriteNode {
  param(
    [string]$Name,
    [string]$Texture,
    [int]$Life = 36,
    [int]$GenTime = 0,
    [int]$GenCount = 1,
    [double]$ScaleStart = 2.0,
    [double]$ScaleEnd = 4.5,
    [int]$R = 168, [int]$G = 85, [int]$B = 247, [int]$A = 255,
    [int]$Blend = 2, # 1=Opacity, 2=Additive
    [int]$Billboard = 0, # 0=Billboard, 2=Fixed
    [double]$PosX = 0, [double]$PosY = 0, [double]$PosZ = 0,
    [double]$RotX = 0, [double]$RotY = 0, [double]$RotZ = 0,
    [double]$RotVelZ = 0,
    [double]$VelX = 0, [double]$VelY = 0, [double]$VelZ = 0
  )
  return @"
        <Node>
          <CommonValues>
            <MaxGeneration>
              <Value>$GenCount</Value>
            </MaxGeneration>
            <Life>
              <Center>$Life</Center>
              <Max>$Life</Max>
              <Min>$Life</Min>
            </Life>
            <GenerationTimeOffset>
              <Center>$GenTime</Center>
              <Max>$GenTime</Max>
              <Min>$GenTime</Min>
            </GenerationTimeOffset>
          </CommonValues>
          <LocationValues>
            <Type>1</Type>
            <PVA>
              <Location>
                <X><Center>$PosX</Center><Max>$PosX</Max><Min>$PosX</Min></X>
                <Y><Center>$PosY</Center><Max>$PosY</Max><Min>$PosY</Min></Y>
                <Z><Center>$PosZ</Center><Max>$PosZ</Max><Min>$PosZ</Min></Z>
              </Location>
              <Velocity>
                <X><Center>$VelX</Center><Max>$VelX</Max><Min>$VelX</Min></X>
                <Y><Center>$VelY</Center><Max>$VelY</Max><Min>$VelY</Min></Y>
                <Z><Center>$VelZ</Center><Max>$VelZ</Max><Min>$VelZ</Min></Z>
              </Velocity>
            </PVA>
          </LocationValues>
          <RotationValues>
            <Type>1</Type>
            <PVA>
              <Rotation>
                <X><Center>$RotX</Center><Max>$RotX</Max><Min>$RotX</Min></X>
                <Y><Center>$RotY</Center><Max>$RotY</Max><Min>$RotY</Min></Y>
                <Z><Center>$RotZ</Center><Max>$RotZ</Max><Min>$RotZ</Min></Z>
              </Rotation>
              <Velocity>
                <Z><Center>$RotVelZ</Center><Max>$RotVelZ</Max><Min>$RotVelZ</Min></Z>
              </Velocity>
            </PVA>
          </RotationValues>
          <ScalingValues>
            <Type>2</Type>
            <Easing>
              <Start>
                <X><Center>$ScaleStart</Center><Max>$ScaleStart</Max><Min>$ScaleStart</Min></X>
                <Y><Center>$ScaleStart</Center><Max>$ScaleStart</Max><Min>$ScaleStart</Min></Y>
                <Z><Center>$ScaleStart</Center><Max>$ScaleStart</Max><Min>$ScaleStart</Min></Z>
              </Start>
              <End>
                <X><Center>$ScaleEnd</Center><Max>$ScaleEnd</Max><Min>$ScaleEnd</Min></X>
                <Y><Center>$ScaleEnd</Center><Max>$ScaleEnd</Max><Min>$ScaleEnd</Min></Y>
                <Z><Center>$ScaleEnd</Center><Max>$ScaleEnd</Max><Min>$ScaleEnd</Min></Z>
              </End>
            </Easing>
          </ScalingValues>
          <RendererCommonValues>
            <ColorTexture>textures/$Texture</ColorTexture>
            <AlphaBlend>$Blend</AlphaBlend>
            <FadeInType>1</FadeInType>
            <FadeIn><Frame>4</Frame></FadeIn>
            <FadeOutType>1</FadeOutType>
            <FadeOut><Frame>$([Math]::Max(8, [int]($Life * 0.45)))</Frame></FadeOut>
          </RendererCommonValues>
          <DrawingValues>
            <Type>2</Type>
            <Sprite>
              <Billboard>$Billboard</Billboard>
              <ColorAll>1</ColorAll>
              <ColorAll_Fixed>
                <R>$R</R><G>$G</G><B>$B</B><A>$A</A>
              </ColorAll_Fixed>
            </Sprite>
          </DrawingValues>
          <Name>$Name</Name>
        </Node>
"@
}

function Write-EfkProj([string]$FileName, [int]$EndFrame, [string[]]$Nodes) {
  $xml = @"
<?xml version="1.0" encoding="utf-8"?>
<EffekseerProject>
  <Root>
    <Name>Root</Name>
    <Children>
$($Nodes -join "`n")
    </Children>
  </Root>
  <ToolVersion>1.80</ToolVersion>
  <Version>3</Version>
  <StartFrame>0</StartFrame>
  <EndFrame>$EndFrame</EndFrame>
  <IsLoop>False</IsLoop>
</EffekseerProject>
"@
  $path = Join-Path $outDir $FileName
  [System.IO.File]::WriteAllText($path, $xml, [System.Text.UTF8Encoding]::new($false))
  Write-Host "  Generated: $FileName"
}

Write-Host "Generating 7 Necro Grim Reaper Effekseer 1.80.8 .efkproj files..."

# 1. reaper_basic_combo.efkproj
Write-EfkProj 'reaper_basic_combo.efkproj' 34 @(
  (Make-SpriteNode -Name 'ScytheShadowArc' -Texture 'scythe_reap_arc.png' -Life 22 -ScaleStart 2.8 -ScaleEnd 4.2 -R 18 -G 6 -B 36 -A 235 -Blend 1 -Billboard 2 -PosY 1.0 -PosZ 1.0 -RotX 90 -RotVelZ -11),
  (Make-SpriteNode -Name 'ScytheSoulArc' -Texture 'scythe_reap_arc.png' -Life 22 -ScaleStart 2.7 -ScaleEnd 4.1 -R 217 -G 70 -B 239 -A 255 -Blend 2 -Billboard 2 -PosY 1.04 -PosZ 1.0 -RotX 90 -RotVelZ -11),
  (Make-SpriteNode -Name 'SoulSlashFlare' -Texture 'soul_harvest_flare.png' -Life 18 -ScaleStart 1.1 -ScaleEnd 2.6 -R 240 -G 171 -B 252 -A 255 -Blend 2 -PosY 1.05 -PosZ 1.65),
  (Make-SpriteNode -Name 'SoulSparks' -Texture 'soul_ember.png' -Life 24 -GenCount 10 -ScaleStart 0.45 -ScaleEnd 0.1 -R 45 -G 212 -B 191 -A 240 -Blend 2 -PosY 1.0 -PosZ 1.5 -VelY 0.12 -VelZ 0.18)
)

# 2. reaper_heavy_hook.efkproj
Write-EfkProj 'reaper_heavy_hook.efkproj' 54 @(
  (Make-SpriteNode -Name 'NecroGroundSeal' -Texture 'reaper_necro_circle.png' -Life 46 -ScaleStart 2.2 -ScaleEnd 4.6 -R 147 -G 51 -B 234 -A 240 -Blend 2 -Billboard 2 -PosY 0.05 -RotX 90 -RotVelZ 3),
  (Make-SpriteNode -Name 'SoulChainShadow' -Texture 'abyssal_chain_beam.png' -Life 34 -ScaleStart 1.2 -ScaleEnd 4.8 -R 14 -G 5 -B 28 -A 230 -Blend 1 -Billboard 2 -PosY 1.05 -PosZ 2.4 -RotX 90),
  (Make-SpriteNode -Name 'SoulChainBeam' -Texture 'abyssal_chain_beam.png' -Life 34 -ScaleStart 1.1 -ScaleEnd 4.8 -R 232 -G 121 -B 249 -A 255 -Blend 2 -Billboard 2 -PosY 1.08 -PosZ 2.4 -RotX 90),
  (Make-SpriteNode -Name 'ReapHookPull' -Texture 'scythe_reap_arc.png' -Life 30 -GenTime 6 -ScaleStart 3.6 -ScaleEnd 2.8 -R 244 -G 63 -B 94 -A 255 -Blend 2 -Billboard 2 -PosY 1.05 -PosZ 4.2 -VelZ -0.14 -RotX 90 -RotVelZ 14),
  (Make-SpriteNode -Name 'PullImplodeRing' -Texture 'wraith_soul_ring.png' -Life 34 -GenTime 8 -ScaleStart 4.5 -ScaleEnd 1.0 -R 45 -G 212 -B 191 -A 255 -Blend 2 -Billboard 2 -PosY 0.12 -PosZ 3.6 -VelZ -0.10 -RotX 90)
)

# 3. reaper_skill_weapon_harvest.efkproj ([Q/SD] Grim Soul Harvest)
Write-EfkProj 'reaper_skill_weapon_harvest.efkproj' 72 @(
  (Make-SpriteNode -Name 'HarvestShadowCircle' -Texture 'reaper_necro_circle.png' -Life 64 -ScaleStart 3.0 -ScaleEnd 8.8 -R 12 -G 4 -B 26 -A 230 -Blend 1 -Billboard 2 -PosY 0.04 -RotX 90 -RotVelZ -2),
  (Make-SpriteNode -Name 'HarvestNecroCircle' -Texture 'reaper_necro_circle.png' -Life 64 -ScaleStart 3.0 -ScaleEnd 8.6 -R 168 -G 85 -B 247 -A 255 -Blend 2 -Billboard 2 -PosY 0.08 -RotX 90 -RotVelZ 2.5),
  (Make-SpriteNode -Name 'ColossalScytheOuter' -Texture 'scythe_reap_arc.png' -Life 42 -ScaleStart 4.8 -ScaleEnd 8.6 -R 232 -G 121 -B 249 -A 255 -Blend 2 -Billboard 2 -PosY 1.15 -RotX 90 -RotVelZ -16),
  (Make-SpriteNode -Name 'ColossalScytheBlood' -Texture 'scythe_reap_arc.png' -Life 38 -GenTime 4 -ScaleStart 4.2 -ScaleEnd 7.8 -R 244 -G 63 -B 94 -A 245 -Blend 2 -Billboard 2 -PosY 1.35 -RotX 82 -RotVelZ 15),
  (Make-SpriteNode -Name 'SoulVortexPillar' -Texture 'soul_vortex_column.png' -Life 54 -ScaleStart 3.0 -ScaleEnd 5.4 -R 192 -G 132 -B 252 -A 230 -Blend 2 -PosY 2.2 -VelY 0.04),
  (Make-SpriteNode -Name 'HarvestStarburst' -Texture 'soul_harvest_flare.png' -Life 36 -GenTime 6 -ScaleStart 2.0 -ScaleEnd 6.2 -R 240 -G 171 -B 252 -A 255 -Blend 2 -PosY 1.2)
)

# 4. reaper_skill_armor_wraith.efkproj ([E/ASD] Wraith Mist Form)
Write-EfkProj 'reaper_skill_armor_wraith.efkproj' 78 @(
  (Make-SpriteNode -Name 'WraithDarkMist' -Texture 'wraith_mist_cloud.png' -Life 72 -ScaleStart 3.2 -ScaleEnd 7.4 -R 14 -G 5 -B 28 -A 225 -Blend 1 -Billboard 2 -PosY 0.14 -RotX 90 -RotVelZ 3),
  (Make-SpriteNode -Name 'WraithGlowMist' -Texture 'wraith_mist_cloud.png' -Life 72 -ScaleStart 3.0 -ScaleEnd 7.2 -R 147 -G 51 -B 234 -A 245 -Blend 2 -Billboard 2 -PosY 0.22 -RotX 90 -RotVelZ -4),
  (Make-SpriteNode -Name 'WraithShroudVortex' -Texture 'soul_vortex_column.png' -Life 70 -ScaleStart 2.4 -ScaleEnd 3.8 -R 45 -G 212 -B 191 -A 225 -Blend 2 -PosY 1.8),
  (Make-SpriteNode -Name 'WraithSkullCrest' -Texture 'phantom_skull_emblem.png' -Life 54 -ScaleStart 1.5 -ScaleEnd 3.0 -R 232 -G 121 -B 249 -A 245 -Blend 2 -PosY 2.4 -VelY 0.03),
  (Make-SpriteNode -Name 'WraithPulseRing' -Texture 'wraith_soul_ring.png' -Life 48 -ScaleStart 1.5 -ScaleEnd 7.2 -R 192 -G 132 -B 252 -A 255 -Blend 2 -Billboard 2 -PosY 0.18 -RotX 90)
)

# 5. reaper_skill_helmet_skulls.efkproj ([R/AD] Phantom Skull Swarm)
Write-EfkProj 'reaper_skill_helmet_skulls.efkproj' 56 @(
  (Make-SpriteNode -Name 'SummonSeal' -Texture 'reaper_necro_circle.png' -Life 48 -ScaleStart 2.4 -ScaleEnd 5.4 -R 168 -G 85 -B 247 -A 245 -Blend 2 -Billboard 2 -PosY 0.06 -RotX 90 -RotVelZ 5),
  (Make-SpriteNode -Name 'SkullCenter' -Texture 'phantom_skull_emblem.png' -Life 38 -ScaleStart 1.4 -ScaleEnd 2.8 -R 240 -G 171 -B 252 -A 255 -Blend 2 -PosY 1.3 -PosZ 1.2 -VelZ 0.22),
  (Make-SpriteNode -Name 'SkullLeft' -Texture 'phantom_skull_emblem.png' -Life 38 -GenTime 3 -ScaleStart 1.3 -ScaleEnd 2.6 -R 232 -G 121 -B 249 -A 250 -Blend 2 -PosX -0.8 -PosY 1.25 -PosZ 1.0 -VelX -0.09 -VelZ 0.20),
  (Make-SpriteNode -Name 'SkullRight' -Texture 'phantom_skull_emblem.png' -Life 38 -GenTime 3 -ScaleStart 1.3 -ScaleEnd 2.6 -R 45 -G 212 -B 191 -A 250 -Blend 2 -PosX 0.8 -PosY 1.25 -PosZ 1.0 -VelX 0.09 -VelZ 0.20),
  (Make-SpriteNode -Name 'PortalRing' -Texture 'wraith_soul_ring.png' -Life 34 -ScaleStart 1.2 -ScaleEnd 3.6 -R 217 -G 70 -B 239 -A 255 -Blend 2 -PosY 1.3 -PosZ 1.1)
)

# 6. reaper_skill_trinket_chains.efkproj ([F/AS] Abyssal Grave Chains)
Write-EfkProj 'reaper_skill_trinket_chains.efkproj' 84 @(
  (Make-SpriteNode -Name 'HellGateVoid' -Texture 'grave_portal_seal.png' -Life 78 -ScaleStart 2.8 -ScaleEnd 8.6 -R 12 -G 3 -B 24 -A 240 -Blend 1 -Billboard 2 -PosY 0.04 -RotX 90 -RotVelZ -2),
  (Make-SpriteNode -Name 'HellGateGlow' -Texture 'grave_portal_seal.png' -Life 78 -ScaleStart 2.8 -ScaleEnd 8.4 -R 217 -G 70 -B 239 -A 255 -Blend 2 -Billboard 2 -PosY 0.08 -RotX 90 -RotVelZ 2),
  (Make-SpriteNode -Name 'GraveChainNorth' -Texture 'abyssal_chain_beam.png' -Life 68 -GenTime 4 -ScaleStart 1.4 -ScaleEnd 5.4 -R 232 -G 121 -B 249 -A 255 -Blend 2 -PosY 2.4 -PosZ 2.6 -RotX -22),
  (Make-SpriteNode -Name 'GraveChainSouth' -Texture 'abyssal_chain_beam.png' -Life 68 -GenTime 6 -ScaleStart 1.4 -ScaleEnd 5.4 -R 168 -G 85 -B 247 -A 255 -Blend 2 -PosY 2.4 -PosZ -2.6 -RotX 22),
  (Make-SpriteNode -Name 'GraveChainEast' -Texture 'abyssal_chain_beam.png' -Life 68 -GenTime 8 -ScaleStart 1.4 -ScaleEnd 5.4 -R 45 -G 212 -B 191 -A 255 -Blend 2 -PosX 2.6 -PosY 2.4 -RotZ 22),
  (Make-SpriteNode -Name 'GraveChainWest' -Texture 'abyssal_chain_beam.png' -Life 68 -GenTime 10 -ScaleStart 1.4 -ScaleEnd 5.4 -R 244 -G 63 -B 94 -A 255 -Blend 2 -PosX -2.6 -PosY 2.4 -RotZ -22),
  (Make-SpriteNode -Name 'AbyssHowlSkull' -Texture 'phantom_skull_emblem.png' -Life 58 -GenTime 8 -ScaleStart 1.6 -ScaleEnd 3.8 -R 240 -G 171 -B 252 -A 250 -Blend 2 -PosY 1.5 -VelY 0.06)
)

# 7. reaper_mobility_wraith.efkproj
Write-EfkProj 'reaper_mobility_wraith.efkproj' 34 @(
  (Make-SpriteNode -Name 'ShadowDashMist' -Texture 'wraith_mist_cloud.png' -Life 28 -ScaleStart 1.6 -ScaleEnd 3.6 -R 16 -G 5 -B 32 -A 220 -Blend 1 -Billboard 2 -PosY 0.35 -RotX 90),
  (Make-SpriteNode -Name 'SoulDashRing' -Texture 'wraith_soul_ring.png' -Life 26 -ScaleStart 1.1 -ScaleEnd 3.4 -R 192 -G 132 -B 252 -A 250 -Blend 2 -Billboard 2 -PosY 0.25 -RotX 90),
  (Make-SpriteNode -Name 'WraithEmbers' -Texture 'soul_ember.png' -Life 28 -GenCount 8 -ScaleStart 0.45 -ScaleEnd 0.1 -R 45 -G 212 -B 191 -A 240 -Blend 2 -PosY 0.6 -VelY 0.08)
)

Write-Host "Done! All 7 Necro Grim Reaper .efkproj files saved to $outDir"
