#!/usr/bin/env python3
"""
HouseForge Token Renderer
Renders a single token from a render recipe JSON.

Usage:
    blender -b <template.blend> -P render_token.py -- <recipe.json> <output_path>

The recipe JSON should contain all trait information needed to configure
materials, lights, geometry, and render settings.
"""

import bpy
import json
import math
import os
import sys
import random
import hashlib


def load_recipe(recipe_path):
    """Load and validate the render recipe."""
    with open(recipe_path, 'r') as f:
        recipe = json.load(f)

    required_fields = ['tokenId', 'houseKey', 'seed', 'traits', 'output', 'renderSettings']
    for field in required_fields:
        if field not in recipe:
            raise ValueError(f"Missing required field: {field}")

    return recipe


def seed_random(seed_hex):
    """Initialize random from hex seed for deterministic results."""
    # Convert hex seed to integer
    seed_int = int(seed_hex, 16) if seed_hex.startswith('0x') else int(seed_hex, 16)
    random.seed(seed_int % (2**32))
    return seed_int


def get_material_params(frame_type):
    """Get material parameters for frame type."""
    frame_materials = {
        "BrushedSteel": {"color": (0.6, 0.6, 0.62), "metallic": 1.0, "roughness": 0.35},
        "PolishedBrass": {"color": (0.85, 0.65, 0.3), "metallic": 1.0, "roughness": 0.15},
        "AntiqueBronze": {"color": (0.45, 0.35, 0.25), "metallic": 1.0, "roughness": 0.5},
        "WhiteGold": {"color": (0.9, 0.88, 0.8), "metallic": 1.0, "roughness": 0.1},
        "BlackTitanium": {"color": (0.08, 0.08, 0.1), "metallic": 1.0, "roughness": 0.25},
        "CopperVerde": {"color": (0.7, 0.45, 0.35), "metallic": 1.0, "roughness": 0.4},
        "RoseGold": {"color": (0.9, 0.6, 0.55), "metallic": 1.0, "roughness": 0.2},
        "PlatinumMatte": {"color": (0.75, 0.75, 0.78), "metallic": 1.0, "roughness": 0.6},
        "MirrorChrome": {"color": (0.95, 0.95, 0.97), "metallic": 1.0, "roughness": 0.02},
        "GunmetalBlue": {"color": (0.25, 0.28, 0.35), "metallic": 1.0, "roughness": 0.3},
    }
    return frame_materials.get(frame_type, frame_materials["BrushedSteel"])


def get_core_material_params(core_material):
    """Get material parameters for core type."""
    core_materials = {
        "ClearCrystal": {"color": (0.98, 0.99, 1.0), "transmission": 0.95, "roughness": 0.02},
        "CloudGlass": {"color": (0.95, 0.96, 0.98), "transmission": 0.7, "roughness": 0.15},
        "LiquidMercury": {"color": (0.85, 0.85, 0.88), "transmission": 0.0, "roughness": 0.05, "metallic": 0.95},
        "MoltenAmber": {"color": (1.0, 0.7, 0.3), "transmission": 0.85, "roughness": 0.1, "emission": 0.1},
        "VoidObsidian": {"color": (0.02, 0.02, 0.03), "transmission": 0.4, "roughness": 0.08},
        "FrozenPlasma": {"color": (0.6, 0.8, 1.0), "transmission": 0.3, "roughness": 0.1, "emission": 2.0},
        "StormEssence": {"color": (0.5, 0.6, 0.8), "transmission": 0.5, "roughness": 0.2, "emission": 0.5},
        "DesertQuartz": {"color": (1.0, 0.95, 0.85), "transmission": 0.8, "roughness": 0.2},
        "AuroraSilk": {"color": (0.8, 0.85, 0.9), "transmission": 0.6, "roughness": 0.3},
        "EclipseCore": {"color": (0.1, 0.08, 0.12), "transmission": 0.2, "roughness": 0.05, "emission": 0.3},
    }
    return core_materials.get(core_material, core_materials["ClearCrystal"])


def apply_surface_aging(material, aging_type):
    """Apply surface aging effects to material."""
    aging_params = {
        "Pristine": {"roughness_add": 0.0},
        "SlightWear": {"roughness_add": 0.05},
        "LightPatina": {"roughness_add": 0.1},
        "WeatheredGrace": {"roughness_add": 0.15},
        "AncientRelic": {"roughness_add": 0.25},
    }

    params = aging_params.get(aging_type, aging_params["Pristine"])

    if material.use_nodes:
        for node in material.node_tree.nodes:
            if node.type == 'BSDF_PRINCIPLED':
                current_roughness = node.inputs['Roughness'].default_value
                node.inputs['Roughness'].default_value = min(1.0, current_roughness + params["roughness_add"])


def configure_frame_material(traits):
    """Configure frame material based on traits."""
    frame = bpy.data.objects.get("Frame")
    if not frame:
        return

    frame_type = traits.get("FrameType", "BrushedSteel")
    params = get_material_params(frame_type)

    # Get or create material
    mat_name = f"MAT_Frame_{frame_type}"
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True

    # Configure material
    nodes = mat.node_tree.nodes
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            node.inputs['Base Color'].default_value = (*params["color"], 1.0)
            node.inputs['Metallic'].default_value = params["metallic"]
            node.inputs['Roughness'].default_value = params["roughness"]

    # Apply surface aging
    aging = traits.get("SurfaceAging", "Pristine")
    apply_surface_aging(mat, aging)

    # Assign material
    if len(frame.data.materials) > 0:
        frame.data.materials[0] = mat
    else:
        frame.data.materials.append(mat)


def configure_core_material(traits):
    """Configure core material based on traits."""
    core = bpy.data.objects.get("Core")
    if not core:
        return

    core_type = traits.get("CoreMaterial", "ClearCrystal")
    params = get_core_material_params(core_type)

    mat_name = f"MAT_Core_{core_type}"
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        mat = bpy.data.materials.new(name=mat_name)
        mat.use_nodes = True

    nodes = mat.node_tree.nodes
    for node in nodes:
        if node.type == 'BSDF_PRINCIPLED':
            node.inputs['Base Color'].default_value = (*params["color"], 1.0)
            node.inputs['Roughness'].default_value = params["roughness"]
            node.inputs['Transmission Weight'].default_value = params.get("transmission", 0.0)
            node.inputs['Metallic'].default_value = params.get("metallic", 0.0)

            # Emission
            if params.get("emission", 0) > 0:
                node.inputs['Emission Strength'].default_value = params["emission"]
                node.inputs['Emission Color'].default_value = (*params["color"], 1.0)

    if len(core.data.materials) > 0:
        core.data.materials[0] = mat
    else:
        core.data.materials.append(mat)


def configure_geometry(traits):
    """Switch visible geometry based on DioramaGeometry trait."""
    geometry_type = traits.get("DioramaGeometry", "Sphere")

    # Hide all geometry variants
    geometry_objects = ["Geo_Capsule", "Geo_Obelisk", "Geo_Cube", "Geo_Sphere", "Geo_Prism", "Geo_BarometerAssembly"]
    for obj_name in geometry_objects:
        obj = bpy.data.objects.get(obj_name)
        if obj:
            obj.hide_viewport = True
            obj.hide_render = True

    # Show selected geometry
    target_name = f"Geo_{geometry_type}"
    target = bpy.data.objects.get(target_name)
    if target:
        target.hide_viewport = False
        target.hide_render = False


def get_light_signature_params(signature):
    """Get light configuration for a signature."""
    signatures = {
        "Sunbeam": {"energy_mult": 1.2, "accent_color": (1.0, 0.95, 0.85)},
        "PrismaticRay": {"energy_mult": 1.0, "accent_color": (1.0, 0.9, 0.95)},
        "NeonRain": {"energy_mult": 0.8, "accent_color": (0.4, 0.9, 1.0)},
        "WetGlow": {"energy_mult": 0.7, "accent_color": (0.85, 0.92, 1.0)},
        "LightningFork": {"energy_mult": 1.5, "accent_color": (0.7, 0.85, 1.0)},
        "IonBloom": {"energy_mult": 0.9, "accent_color": (0.6, 0.5, 1.0)},
        "PolarGlow": {"energy_mult": 0.85, "accent_color": (0.6, 0.9, 0.8)},
        "FrostScatter": {"energy_mult": 1.1, "accent_color": (0.8, 0.95, 1.0)},
        "AuroraRibbon": {"energy_mult": 0.75, "accent_color": (0.3, 1.0, 0.6)},
        "SpectrumVeil": {"energy_mult": 0.7, "accent_color": (0.8, 0.7, 1.0)},
        "GoldenHaze": {"energy_mult": 1.3, "accent_color": (1.0, 0.85, 0.6)},
        "DustHalo": {"energy_mult": 0.9, "accent_color": (1.0, 0.9, 0.75)},
        "EclipseHalo": {"energy_mult": 0.4, "accent_color": (1.0, 0.7, 0.4)},
        "RingRim": {"energy_mult": 0.3, "accent_color": (1.0, 0.8, 0.5)},
    }
    return signatures.get(signature, signatures["Sunbeam"])


def adjust_emission_plane_strength(obj, multiplier):
    """Adjust emission strength for an emission plane object."""
    if not obj or not obj.data or not obj.data.materials:
        return

    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'EMISSION':
                current = node.inputs['Strength'].default_value
                node.inputs['Strength'].default_value = current * multiplier


def adjust_emission_plane_color(obj, color):
    """Adjust emission color for an emission plane object."""
    if not obj or not obj.data or not obj.data.materials:
        return

    for mat in obj.data.materials:
        if not mat or not mat.use_nodes:
            continue
        for node in mat.node_tree.nodes:
            if node.type == 'EMISSION':
                node.inputs['Color'].default_value = (*color, 1.0)


def configure_lights(traits, house_key):
    """Configure lighting based on traits."""
    light_signature = traits.get("LightSignature")

    # Default signatures per house
    house_defaults = {
        "CLEAR": "Sunbeam",
        "MONSOON": "NeonRain",
        "THUNDER": "LightningFork",
        "FROST": "PolarGlow",
        "AURORA": "AuroraRibbon",
        "SAND": "GoldenHaze",
        "ECLIPSE": "EclipseHalo",
    }

    if not light_signature:
        light_signature = house_defaults.get(house_key, "Sunbeam")

    params = get_light_signature_params(light_signature)

    # Adjust key light - could be emission plane or traditional light
    key_light = bpy.data.objects.get("Light_Key")
    if key_light:
        if key_light.type == 'LIGHT':
            key_light.data.energy *= params["energy_mult"]
        elif key_light.type == 'MESH':
            adjust_emission_plane_strength(key_light, params["energy_mult"])

    # Adjust accent/fill lights with color
    for light_name in ["Light_Accent", "Light_Fill"]:
        light = bpy.data.objects.get(light_name)
        if light:
            if light.type == 'LIGHT':
                light.data.color = params["accent_color"]
            elif light.type == 'MESH':
                # Only tint slightly, don't fully change color
                pass  # Keep template colors for emission planes


def configure_atmosphere(traits):
    """Configure atmospheric effects based on traits."""
    atmosphere = traits.get("Atmosphere", "Clear")

    # Volumetric settings for Cycles
    world = bpy.context.scene.world
    if not world:
        return

    # Note: Full volumetric implementation would require volume scatter nodes
    # This is a simplified version that adjusts world settings

    atmosphere_settings = {
        "Clear": {"volume_density": 0.0},
        "MistVeil": {"volume_density": 0.1},
        "RainCurtain": {"volume_density": 0.08},
        "DustStorm": {"volume_density": 0.15},
        "SnowDrift": {"volume_density": 0.05},
        "ThunderCloud": {"volume_density": 0.12},
        "AuroraWisp": {"volume_density": 0.03},
        "EclipseShadow": {"volume_density": 0.08},
    }

    settings = atmosphere_settings.get(atmosphere, atmosphere_settings["Clear"])
    # Volume implementation would go here for full effect


def configure_render_settings(render_settings):
    """Apply render settings from recipe."""
    scene = bpy.context.scene

    # Engine
    engine = render_settings.get("engine", "CYCLES")
    scene.render.engine = engine

    if engine == "CYCLES":
        cycles = scene.cycles

        # Enable GPU rendering with OptiX
        cycles.device = 'GPU'
        try:
            prefs = bpy.context.preferences.addons['cycles'].preferences
            prefs.compute_device_type = 'OPTIX'
            prefs.get_devices()
            for device in prefs.devices:
                device.use = device.type in ('OPTIX', 'CUDA', 'OPENCL')
        except Exception as e:
            print(f"Warning: Could not configure GPU: {e}")

        # Samples
        cycles.samples = render_settings.get("samples", 96)

        # Denoising
        if render_settings.get("denoise", True):
            cycles.use_denoising = True
            cycles.denoiser = 'OPENIMAGEDENOISE'

        # Adaptive sampling
        if render_settings.get("adaptiveSampling", True):
            cycles.use_adaptive_sampling = True
            cycles.adaptive_threshold = 0.015

        # Bounces
        max_bounces = render_settings.get("maxBounces", 6)
        cycles.max_bounces = max_bounces
        cycles.diffuse_bounces = min(2, max_bounces)
        cycles.glossy_bounces = min(3, max_bounces)
        cycles.transmission_bounces = min(6, max_bounces)
        cycles.volume_bounces = min(2, max_bounces)


def configure_output(output_settings, output_path):
    """Configure output settings."""
    scene = bpy.context.scene

    # Resolution
    scene.render.resolution_x = output_settings.get("width", 1024)
    scene.render.resolution_y = output_settings.get("height", 1024)
    scene.render.resolution_percentage = 100

    # Format
    format_type = output_settings.get("format", "WEBP")
    scene.render.image_settings.file_format = format_type

    if format_type == "WEBP":
        scene.render.image_settings.quality = output_settings.get("quality", 90)
    elif format_type == "PNG":
        scene.render.image_settings.compression = 15

    # Transparent background
    scene.render.film_transparent = output_settings.get("transparentBackground", False)

    # Output path
    scene.render.filepath = output_path


def configure_lens_bloom(traits):
    """Configure lens bloom/glare effect."""
    bloom_type = traits.get("LensBloom", "Subtle")

    bloom_settings = {
        "None": {"enabled": False},
        "Subtle": {"threshold": 0.9, "size": 3, "mix": 0},
        "Moderate": {"threshold": 0.8, "size": 5, "mix": 0},
        "Intense": {"threshold": 0.7, "size": 8, "mix": 0},
        "Cinematic": {"threshold": 0.75, "size": 6, "mix": 0},
    }

    settings = bloom_settings.get(bloom_type, bloom_settings["Subtle"])

    if not settings.get("enabled", True):
        return

    # Find glare node in compositor
    scene = bpy.context.scene
    if not scene.use_nodes:
        return

    for node in scene.node_tree.nodes:
        if node.type == 'GLARE':
            node.threshold = settings.get("threshold", 0.8)
            node.size = settings.get("size", 7)
            node.mix = settings.get("mix", 0)


def apply_palette_temperature(traits):
    """Apply color temperature adjustments."""
    temp = traits.get("PaletteTemperature", "Neutral")

    temp_settings = {
        "Warm": {"exposure": 0.1, "gamma": (1.02, 1.0, 0.98)},
        "Cool": {"exposure": 0.0, "gamma": (0.98, 1.0, 1.02)},
        "Neutral": {"exposure": 0.0, "gamma": (1.0, 1.0, 1.0)},
        "HighContrast": {"exposure": 0.05, "gamma": (1.0, 1.0, 1.0)},
        "Desaturated": {"exposure": 0.0, "gamma": (1.0, 1.0, 1.0)},
    }

    settings = temp_settings.get(temp, temp_settings["Neutral"])

    scene = bpy.context.scene
    scene.view_settings.exposure = settings["exposure"]


def render_token(recipe, output_path):
    """Main rendering function."""
    print(f"Rendering token {recipe['tokenId']}...")

    # Initialize random seed
    seed_random(recipe['seed'])

    traits = recipe['traits']
    house_key = recipe['houseKey']

    # Configure scene
    configure_geometry(traits)
    configure_frame_material(traits)
    configure_core_material(traits)
    configure_lights(traits, house_key)
    configure_atmosphere(traits)
    configure_lens_bloom(traits)
    apply_palette_temperature(traits)

    # Configure render
    configure_render_settings(recipe['renderSettings'])
    configure_output(recipe['output'], output_path)

    # Render
    print(f"  Starting render...")
    bpy.ops.render.render(write_still=True)

    print(f"  Saved to: {output_path}")
    return True


def main():
    # Parse arguments after --
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        print("Usage: blender -b <template.blend> -P render_token.py -- <recipe.json> <output_path>")
        sys.exit(1)

    if len(argv) < 2:
        print("Usage: blender -b <template.blend> -P render_token.py -- <recipe.json> <output_path>")
        sys.exit(1)

    recipe_path = argv[0]
    output_path = argv[1]

    # Load recipe
    recipe = load_recipe(recipe_path)

    # Render
    success = render_token(recipe, output_path)

    if not success:
        sys.exit(1)

    print("Render complete!")


if __name__ == "__main__":
    main()
