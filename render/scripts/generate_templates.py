#!/usr/bin/env python3
"""
HouseForge Template Generator v3.0
Professional Studio Photography Edition

Implements RenderV1-A preset with:
- Deep blue-black studio backgrounds
- Emission plane softboxes (Key/Fill/Rim/Accent)
- House-specific light signatures
- Volumetric atmosphere
- Filmic color management
- Professional compositor pipeline

Usage:
    blender -b -P generate_templates.py -- --output-dir ./scenes
"""

import bpy
import bmesh
import math
import os
import sys
import argparse
from mathutils import Vector, Matrix

# ============================================================
#                    BASE RENDER PRESET V1-A
# ============================================================

BASE_CONFIG = {
    # World gradient (deep blue-black studio)
    "world": {
        "gradient_colors": [
            (0.0, (0.008, 0.016, 0.039)),   # #02040A - Near black
            (0.55, (0.020, 0.039, 0.094)),  # #050A18 - Deep blue-black
            (1.0, (0.039, 0.071, 0.188)),   # #0A1230 - Dark blue
        ],
        "strength": 0.18,
    },
    # Color management
    "color_management": {
        "view_transform": "Filmic",
        "look": "Medium High Contrast",
        "exposure": 0.6,
        "gamma": 1.0,
    },
    # Cycles settings
    "cycles": {
        "samples": 96,
        "noise_threshold": 0.015,
        "denoise": True,
        "denoiser": "OPENIMAGEDENOISE",
        "max_bounces": 6,
        "diffuse_bounces": 2,
        "glossy_bounces": 3,
        "transmission_bounces": 6,
        "volume_bounces": 2,
        "transparent_max_bounces": 8,
        "clamp_indirect": 3.0,
        "filter_glossy": 0.1,
    },
    # Camera
    "camera": {
        "focal_length": 65,
        "sensor_width": 36,
        "location": (0.0, -1.25, 0.55),
        "rotation": (78, 0, 0),
        "f_stop": 5.6,
    },
    # Studio lighting (emission planes)
    "lighting": {
        "key": {
            "size": (1.2, 0.6),
            "strength": 140,
            "color": (1.0, 1.0, 1.0),
            "location": (-0.9, -0.8, 0.85),
            "rotation": (35, 0, 25),
        },
        "fill": {
            "size": (1.5, 0.8),
            "strength": 55,
            "color": (1.0, 1.0, 1.0),
            "location": (1.0, -0.6, 0.45),
            "rotation": (20, 0, -20),
        },
        "rim": {
            "size": (1.2, 0.2),
            "strength": 95,
            "color": (1.0, 1.0, 1.0),
            "location": (0.9, 1.2, 0.75),
            "rotation": (10, 0, 160),
        },
        "top_accent": {
            "size": (0.6, 0.6),
            "strength": 20,
            "color": (1.0, 1.0, 1.0),
            "location": (0.0, -0.2, 1.4),
            "rotation": (90, 0, 0),
        },
    },
    # Compositor
    "compositor": {
        "glare_threshold": 1.0,
        "glare_size": 6,
        "glare_mix": 0.18,
    },
    # Output
    "output": {
        "resolution": (1024, 1024),
    },
}

# ============================================================
#                    HOUSE CONFIGURATIONS
# ============================================================

HOUSES = {
    "CLEAR": {
        "id": 1,
        "theme": "crystal_refraction",
        # World override
        "world_strength": 0.20,
        # Materials
        "core_type": "glass",
        "core_roughness": (0.025, 0.045),
        "core_ior": 1.52,
        "core_dispersion": 0.02,
        # Compositor
        "glare_mix": 0.12,
        # Light signature
        "light_signature": [
            {
                "name": "PrismaticStrip",
                "type": "EMISSION_PLANE",
                "size": (1.4, 0.12),
                "strength": 35,
                "color": (1.0, 1.0, 1.0),
                "location": (0.0, -1.0, 0.9),
                "rotation": (20, 0, 0),
            },
        ],
        # Atmosphere
        "volume_enabled": False,
        # Palette
        "tint": (1.0, 1.0, 1.0),
        # Legacy colors for geometry
        "primary_color": (1.0, 0.95, 0.85),
        "secondary_color": (0.95, 0.88, 0.75),
        "accent_color": (1.0, 0.85, 0.4),
        "emission_color": (1.0, 0.95, 0.7),
        "emission_strength": 5.0,
    },
    "MONSOON": {
        "id": 2,
        "theme": "neon_rain",
        # Lighting overrides
        "rim_color": (0.745, 0.922, 1.0),  # #BEEBFF
        # Materials
        "core_type": "glass",
        "core_roughness": (0.015, 0.035),
        "core_ior": 1.33,
        # Light signature
        "light_signature": [
            {
                "name": "NeonStrip1",
                "type": "EMISSION_PLANE",
                "size": (1.6, 0.06),
                "strength": 45,
                "color": (0.494, 0.906, 1.0),  # #7EE7FF cyan
                "location": (-0.6, -0.9, 0.8),
                "rotation": (25, 0, 15),
            },
            {
                "name": "NeonStrip2",
                "type": "EMISSION_PLANE",
                "size": (1.6, 0.06),
                "strength": 35,
                "color": (0.639, 0.608, 1.0),  # #A39BFF purple
                "location": (0.5, -0.85, 0.75),
                "rotation": (22, 0, -12),
            },
        ],
        # Atmosphere - humid fog
        "volume_enabled": True,
        "volume_density": 0.035,
        "volume_anisotropy": 0.35,
        "volume_color": (0.910, 0.957, 1.0),  # #E8F4FF
        # Palette
        "tint": (0.816, 0.910, 1.0),  # #D0E8FF
        # Legacy colors
        "primary_color": (0.4, 0.7, 1.0),
        "secondary_color": (0.2, 0.5, 0.9),
        "accent_color": (0.3, 0.85, 1.0),
        "emission_color": (0.4, 0.8, 1.0),
        "emission_strength": 3.0,
    },
    "THUNDER": {
        "id": 3,
        "theme": "electric_storm",
        # Lighting overrides
        "key_strength": 155,
        "fill_strength": 40,
        "rim_strength": 120,
        # Materials
        "core_type": "emissive_glass",
        "core_roughness": (0.02, 0.04),
        "emission_color": (0.545, 0.486, 1.0),  # #8B7CFF
        "emission_strength": (4, 12),
        # Compositor
        "glare_mix": 0.22,
        # Light signature
        "light_signature": [
            {
                "name": "LightningPoint",
                "type": "AREA",
                "size": (0.12, 0.12),
                "strength": 220,
                "color": (0.769, 0.741, 1.0),  # #C4BDFF
                "location": (-0.2, -0.9, 0.95),
                "rotation": (45, 0, 10),
            },
            {
                "name": "IonBloom",
                "type": "POINT",
                "size": 0.08,
                "strength": 80,
                "color": (0.608, 0.561, 1.0),  # #9B8FFF
                "location": (0.0, 0.0, 0.1),
            },
        ],
        # Atmosphere - charged haze
        "volume_enabled": True,
        "volume_density": 0.015,
        "volume_anisotropy": 0.2,
        "volume_color": (0.878, 0.863, 1.0),  # #E0DCFF
        # Palette
        "tint": (0.910, 0.894, 1.0),  # #E8E4FF
        # Legacy colors
        "primary_color": (0.6, 0.5, 1.0),
        "secondary_color": (0.4, 0.3, 0.9),
        "accent_color": (0.8, 0.6, 1.0),
    },
    "FROST": {
        "id": 4,
        "theme": "frozen_crystal",
        # Materials
        "core_type": "frosted_glass",
        "core_roughness": (0.06, 0.12),
        "core_ior": 1.31,
        "subsurface_color": (0.839, 0.949, 1.0),  # #D6F2FF
        "subsurface_strength": 0.08,
        "edge_frost": True,
        # Compositor
        "glare_mix": 0.12,
        # Light signature
        "light_signature": [
            {
                "name": "PolarFill",
                "type": "EMISSION_PLANE",
                "size": (2.0, 1.2),
                "strength": 35,
                "color": (0.839, 0.949, 1.0),  # #D6F2FF cold blue-white
                "location": (0.8, 0.5, 0.6),
                "rotation": (30, 0, -25),
            },
            {
                "name": "FrostScatter",
                "type": "AREA",
                "size": (0.8, 0.8),
                "strength": 20,
                "color": (0.910, 0.980, 1.0),  # #E8FAFF
                "location": (0.0, -0.3, 1.2),
                "rotation": (75, 0, 0),
            },
        ],
        # Atmosphere - icy mist
        "volume_enabled": True,
        "volume_density": 0.018,
        "volume_anisotropy": 0.2,
        "volume_color": (0.878, 0.957, 1.0),  # #E0F4FF
        # Palette
        "tint": (0.878, 0.973, 1.0),  # #E0F8FF
        # Legacy colors
        "primary_color": (0.85, 0.95, 1.0),
        "secondary_color": (0.7, 0.9, 1.0),
        "accent_color": (0.6, 0.95, 1.0),
        "emission_color": (0.7, 0.9, 1.0),
        "emission_strength": 2.5,
    },
    "AURORA": {
        "id": 5,
        "theme": "northern_lights",
        # Materials
        "core_type": "iridescent_glass",
        "core_roughness": (0.02, 0.04),
        "core_ior": 1.48,
        "iridescence_strength": 0.15,
        "iridescence_shift": 0.3,
        # Orbit ring emission
        "orbit_emission_color": (0.725, 0.698, 1.0),  # #B9B2FF
        "orbit_emission_strength": (8, 14),
        # Light signature
        "light_signature": [
            {
                "name": "SpectrumCard",
                "type": "EMISSION_PLANE",
                "size": (1.2, 0.4),
                "strength": 20,
                "color": (0.910, 0.816, 1.0),  # E8D0FF pale purple
                "location": (-0.7, -0.6, 0.9),
                "rotation": (35, 0, 20),
                "gradient": True,
                "gradient_colors": [
                    (0.910, 0.816, 1.0),  # E8D0FF pale purple
                    (0.816, 1.0, 0.910),  # D0FFE8 pale green
                    (0.816, 0.910, 1.0),  # D0E8FF pale blue
                ],
            },
        ],
        # Atmosphere - clean
        "volume_enabled": False,
        # Palette
        "tint": (0.941, 0.910, 1.0),  # #F0E8FF
        # Legacy colors
        "primary_color": (0.3, 1.0, 0.5),
        "secondary_color": (0.9, 0.4, 1.0),
        "accent_color": (0.4, 0.9, 1.0),
        "emission_color": (0.5, 1.0, 0.7),
        "emission_strength": 4.0,
    },
    "SAND": {
        "id": 6,
        "theme": "desert_ancient",
        # Lighting overrides
        "fill_color": (1.0, 0.843, 0.639),  # #FFD7A3 warm golden fill
        "fill_strength": 65,
        # Materials
        "core_type": "emissive_glass",
        "core_roughness": (0.04, 0.08),
        "core_ior": 1.50,
        "emission_color": (1.0, 0.894, 0.769),  # #FFE4C4
        "emission_strength": (2, 5),
        # Metal - brushed gold
        "metal_roughness": (0.18, 0.26),
        "metal_anisotropic": 0.6,
        "metal_color": (0.788, 0.663, 0.380),  # #C9A961
        # Light signature
        "light_signature": [
            {
                "name": "GoldenFill",
                "type": "EMISSION_PLANE",
                "size": (1.4, 0.8),
                "strength": 40,
                "color": (1.0, 0.925, 0.816),  # #FFECD0
                "location": (0.6, -0.5, 0.5),
                "rotation": (25, 0, -15),
            },
            {
                "name": "DustHalo",
                "type": "EMISSION_PLANE",
                "size": (0.8, 0.8),
                "strength": 18,
                "color": (1.0, 0.910, 0.753),  # #FFE8C0
                "location": (0.0, 0.8, 0.3),
                "rotation": (15, 0, 180),
            },
        ],
        # Atmosphere - dusty haze
        "volume_enabled": True,
        "volume_density": 0.03,
        "volume_anisotropy": 0.55,
        "volume_color": (1.0, 0.957, 0.910),  # #FFF4E8
        # Palette
        "tint": (1.0, 0.910, 0.816),  # #FFE8D0
        # Legacy colors
        "primary_color": (1.0, 0.85, 0.5),
        "secondary_color": (0.9, 0.7, 0.4),
        "accent_color": (1.0, 0.6, 0.2),
    },
    "ECLIPSE": {
        "id": 7,
        "theme": "dark_void",
        # World override - darker
        "world_strength": 0.12,
        # Lighting overrides
        "fill_strength": 35,
        "rim_strength": 150,
        "rim_color": (0.969, 0.827, 0.486),  # #F7D37C golden rim
        # Materials
        "core_type": "void",
        "core_base_color": (0.020, 0.020, 0.020),  # #050505
        "core_roughness": (0.08, 0.14),
        "core_metallic": 1.0,
        # Fresnel emission for corona
        "fresnel_emission_color": (1.0, 0.690, 0.251),  # #FFB040
        "fresnel_emission_strength": 8,
        "fresnel_ior": 2.5,
        "fresnel_power": 3.0,
        # Metal
        "metal_color": (0.039, 0.039, 0.039),  # #0A0A0A
        "metal_roughness": (0.08, 0.14),
        # Compositor
        "glare_mix": 0.22,
        # Light signature
        "light_signature": [
            {
                "name": "CoronaDisc",
                "type": "EMISSION_PLANE",
                "size": (0.9, 0.9),
                "strength": 20,
                "color": (1.0, 0.816, 0.502),  # #FFD080
                "location": (0.0, 0.6, 0.0),
                "rotation": (0, 0, 0),
            },
            {
                "name": "RingRim",
                "type": "EMISSION_RING",
                "radius": 0.45,
                "tube_radius": 0.015,
                "strength": 15,
                "color": (1.0, 0.753, 0.376),  # #FFC060
                "location": (0.0, 0.3, 0.0),
                "rotation": (90, 0, 0),
            },
        ],
        # Atmosphere - void
        "volume_enabled": False,
        # Palette
        "tint": (1.0, 0.878, 0.690),  # #FFE0B0
        # Legacy colors
        "primary_color": (0.15, 0.1, 0.2),
        "secondary_color": (0.3, 0.2, 0.4),
        "accent_color": (1.0, 0.4, 0.1),
        "emission_color": (1.0, 0.5, 0.2),
        "emission_strength": 12.0,
    },
}


# ============================================================
#                    UTILITY FUNCTIONS
# ============================================================

def clear_scene():
    """Remove all objects from the scene."""
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()

    for block in bpy.data.meshes:
        if block.users == 0:
            bpy.data.meshes.remove(block)
    for block in bpy.data.materials:
        if block.users == 0:
            bpy.data.materials.remove(block)
    for block in bpy.data.lights:
        if block.users == 0:
            bpy.data.lights.remove(block)
    for block in bpy.data.node_groups:
        if block.users == 0:
            bpy.data.node_groups.remove(block)


def safe_unlink_from_scene(obj):
    """Safely unlink an object from the scene collection."""
    scene_collection = bpy.context.scene.collection
    if obj.name in scene_collection.objects:
        scene_collection.objects.unlink(obj)


def create_collections():
    """Create organized collections."""
    collections = {}
    for name in ['Core', 'Frame', 'Decorations', 'Lights', 'Camera', 'Effects', 'Volume']:
        coll = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(coll)
        collections[name] = coll
    return collections


def hex_to_rgb(hex_str):
    """Convert hex color to RGB tuple."""
    hex_str = hex_str.lstrip('#')
    return tuple(int(hex_str[i:i+2], 16) / 255.0 for i in (0, 2, 4))


# ============================================================
#                    EMISSION PLANE CREATION
# ============================================================

def create_emission_plane(name, size, strength, color, location, rotation, collections):
    """Create an emission plane (softbox light)."""
    bpy.ops.mesh.primitive_plane_add(size=1, location=location)
    plane = bpy.context.active_object
    plane.name = name

    # Scale to size
    plane.scale = (size[0], size[1], 1.0)

    # Apply rotation (degrees to radians)
    plane.rotation_euler = (
        math.radians(rotation[0]),
        math.radians(rotation[1]),
        math.radians(rotation[2])
    )

    # Create emission material
    mat = bpy.data.materials.new(name=f"MAT_{name}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)

    emission = nodes.new('ShaderNodeEmission')
    emission.location = (0, 0)
    emission.inputs['Color'].default_value = (*color, 1.0)
    emission.inputs['Strength'].default_value = strength

    links.new(emission.outputs['Emission'], output.inputs['Surface'])

    # Make plane invisible to camera
    plane.visible_camera = False
    plane.visible_diffuse = True
    plane.visible_glossy = True
    plane.visible_transmission = True
    plane.visible_volume_scatter = True

    plane.data.materials.append(mat)

    # Link to lights collection
    collections['Lights'].objects.link(plane)
    safe_unlink_from_scene(plane)

    return plane


def create_emission_ring(name, radius, tube_radius, strength, color, location, rotation, collections):
    """Create an emission ring (torus light)."""
    bpy.ops.mesh.primitive_torus_add(
        major_radius=radius,
        minor_radius=tube_radius,
        major_segments=64,
        minor_segments=16,
        location=location
    )
    ring = bpy.context.active_object
    ring.name = name

    # Apply rotation
    ring.rotation_euler = (
        math.radians(rotation[0]),
        math.radians(rotation[1]),
        math.radians(rotation[2])
    )

    # Create emission material
    mat = bpy.data.materials.new(name=f"MAT_{name}")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (300, 0)

    emission = nodes.new('ShaderNodeEmission')
    emission.location = (0, 0)
    emission.inputs['Color'].default_value = (*color, 1.0)
    emission.inputs['Strength'].default_value = strength

    links.new(emission.outputs['Emission'], output.inputs['Surface'])

    ring.visible_camera = False
    ring.data.materials.append(mat)

    collections['Lights'].objects.link(ring)
    safe_unlink_from_scene(ring)

    return ring


# ============================================================
#                    MATERIAL CREATION
# ============================================================

def create_metallic_material(name, color, metallic=1.0, roughness=0.2, anisotropic=0.0):
    """Create a high-quality metallic material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (200, 0)
    principled.inputs['Base Color'].default_value = (*color, 1.0)
    principled.inputs['Metallic'].default_value = metallic
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Anisotropic'].default_value = anisotropic

    # Subtle noise for realism
    noise = nodes.new('ShaderNodeTexNoise')
    noise.location = (-200, -200)
    noise.inputs['Scale'].default_value = 50
    noise.inputs['Detail'].default_value = 8

    math_node = nodes.new('ShaderNodeMath')
    math_node.location = (0, -200)
    math_node.operation = 'MULTIPLY'
    math_node.inputs[1].default_value = 0.02

    add_node = nodes.new('ShaderNodeMath')
    add_node.location = (0, -100)
    add_node.operation = 'ADD'
    add_node.inputs[1].default_value = roughness

    links.new(noise.outputs['Fac'], math_node.inputs[0])
    links.new(math_node.outputs[0], add_node.inputs[0])
    links.new(add_node.outputs[0], principled.inputs['Roughness'])
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    return mat


def create_glass_material(name, color, transmission=0.95, roughness=0.02, ior=1.45, dispersion=0.0):
    """Create a high-quality glass/crystal material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (0, 0)
    principled.inputs['Base Color'].default_value = (*color, 1.0)
    principled.inputs['Metallic'].default_value = 0.0
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Transmission Weight'].default_value = transmission
    principled.inputs['IOR'].default_value = ior

    # Dispersion if supported
    if dispersion > 0:
        try:
            principled.inputs['Dispersion'].default_value = dispersion
        except:
            pass

    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    return mat


def create_emissive_glass_material(name, color, emission_color, emission_strength=5.0, roughness=0.02, ior=1.45):
    """Create glass with internal emission."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)

    # Glass base
    glass = nodes.new('ShaderNodeBsdfPrincipled')
    glass.location = (300, 200)
    glass.inputs['Base Color'].default_value = (*color, 1.0)
    glass.inputs['Roughness'].default_value = roughness
    glass.inputs['Transmission Weight'].default_value = 0.9
    glass.inputs['IOR'].default_value = ior

    # Emission
    emission = nodes.new('ShaderNodeEmission')
    emission.location = (300, -100)
    emission.inputs['Color'].default_value = (*emission_color, 1.0)
    emission.inputs['Strength'].default_value = emission_strength

    # Mix via fresnel
    fresnel = nodes.new('ShaderNodeFresnel')
    fresnel.location = (100, 0)
    fresnel.inputs['IOR'].default_value = 1.4

    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (550, 0)

    links.new(fresnel.outputs['Fac'], mix.inputs['Fac'])
    links.new(glass.outputs['BSDF'], mix.inputs[1])
    links.new(emission.outputs['Emission'], mix.inputs[2])
    links.new(mix.outputs['Shader'], output.inputs['Surface'])

    return mat


def create_frosted_glass_material(name, color, roughness=0.08, ior=1.31, subsurface_color=None, subsurface_strength=0.08, edge_frost=False):
    """Create frosted glass with edge frost effect."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (400, 0)
    principled.inputs['Base Color'].default_value = (*color, 1.0)
    principled.inputs['Transmission Weight'].default_value = 0.88
    principled.inputs['IOR'].default_value = ior

    if subsurface_color:
        principled.inputs['Subsurface Weight'].default_value = subsurface_strength
        principled.inputs['Subsurface Radius'].default_value = (*subsurface_color, 1.0)[:3]

    if edge_frost:
        # Fresnel-based roughness boost at edges
        fresnel = nodes.new('ShaderNodeFresnel')
        fresnel.location = (0, -100)
        fresnel.inputs['IOR'].default_value = 1.3

        math_mult = nodes.new('ShaderNodeMath')
        math_mult.location = (150, -100)
        math_mult.operation = 'MULTIPLY'
        math_mult.inputs[1].default_value = 0.15  # edge boost

        math_add = nodes.new('ShaderNodeMath')
        math_add.location = (300, -100)
        math_add.operation = 'ADD'
        math_add.inputs[1].default_value = roughness

        links.new(fresnel.outputs['Fac'], math_mult.inputs[0])
        links.new(math_mult.outputs[0], math_add.inputs[0])
        links.new(math_add.outputs[0], principled.inputs['Roughness'])
    else:
        principled.inputs['Roughness'].default_value = roughness

    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    return mat


def create_void_material(name, base_color, corona_color, corona_strength=8.0, fresnel_ior=2.5, fresnel_power=3.0):
    """Create eclipse/void material with fresnel corona."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (800, 0)

    # Black glossy base
    glossy = nodes.new('ShaderNodeBsdfPrincipled')
    glossy.location = (300, 200)
    glossy.inputs['Base Color'].default_value = (*base_color, 1.0)
    glossy.inputs['Metallic'].default_value = 1.0
    glossy.inputs['Roughness'].default_value = 0.1

    # Corona emission
    emission = nodes.new('ShaderNodeEmission')
    emission.location = (300, -100)
    emission.inputs['Color'].default_value = (*corona_color, 1.0)
    emission.inputs['Strength'].default_value = corona_strength

    # Fresnel for edge glow
    fresnel = nodes.new('ShaderNodeFresnel')
    fresnel.location = (100, 0)
    fresnel.inputs['IOR'].default_value = fresnel_ior

    # Power for sharper edge
    power = nodes.new('ShaderNodeMath')
    power.location = (200, 50)
    power.operation = 'POWER'
    power.inputs[1].default_value = fresnel_power

    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (550, 0)

    links.new(fresnel.outputs['Fac'], power.inputs[0])
    links.new(power.outputs[0], mix.inputs['Fac'])
    links.new(glossy.outputs['BSDF'], mix.inputs[1])
    links.new(emission.outputs['Emission'], mix.inputs[2])
    links.new(mix.outputs['Shader'], output.inputs['Surface'])

    return mat


def create_iridescent_glass_material(name, color, roughness=0.02, ior=1.48, irid_strength=0.15, irid_shift=0.3):
    """Create iridescent glass for aurora effect."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    principled = nodes.new('ShaderNodeBsdfPrincipled')
    principled.location = (200, 0)
    principled.inputs['Base Color'].default_value = (*color, 1.0)
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Transmission Weight'].default_value = 0.9
    principled.inputs['IOR'].default_value = ior

    # Iridescence is view-angle dependent color shift
    # Simulate with layer weight + color ramp
    layer_weight = nodes.new('ShaderNodeLayerWeight')
    layer_weight.location = (-200, 100)
    layer_weight.inputs['Blend'].default_value = 0.5

    color_ramp = nodes.new('ShaderNodeValToRGB')
    color_ramp.location = (0, 100)
    color_ramp.color_ramp.elements[0].color = (0.9, 0.8, 1.0, 1.0)  # Pale purple
    color_ramp.color_ramp.elements[1].color = (0.8, 1.0, 0.9, 1.0)  # Pale green

    mix_rgb = nodes.new('ShaderNodeMix')
    mix_rgb.location = (0, 0)
    mix_rgb.data_type = 'RGBA'
    mix_rgb.inputs['Factor'].default_value = irid_strength

    links.new(layer_weight.outputs['Facing'], color_ramp.inputs['Fac'])
    links.new(color_ramp.outputs['Color'], mix_rgb.inputs['B'])
    mix_rgb.inputs['A'].default_value = (*color, 1.0)
    links.new(mix_rgb.outputs['Result'], principled.inputs['Base Color'])
    links.new(principled.outputs['BSDF'], output.inputs['Surface'])

    return mat


def create_gradient_emission_material(name, color1, color2, strength=5.0):
    """Create gradient emission for aurora ribbons."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (600, 0)

    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-400, 0)

    gradient = nodes.new('ShaderNodeTexGradient')
    gradient.location = (-200, 0)
    gradient.gradient_type = 'SPHERICAL'

    color_ramp = nodes.new('ShaderNodeValToRGB')
    color_ramp.location = (0, 0)
    color_ramp.color_ramp.elements[0].color = (*color1, 1.0)
    color_ramp.color_ramp.elements[1].color = (*color2, 1.0)

    emission = nodes.new('ShaderNodeEmission')
    emission.location = (200, 0)
    emission.inputs['Strength'].default_value = strength

    transparent = nodes.new('ShaderNodeBsdfTransparent')
    transparent.location = (200, -200)

    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (400, 0)
    mix.inputs['Fac'].default_value = 0.85

    links.new(tex_coord.outputs['Object'], gradient.inputs['Vector'])
    links.new(gradient.outputs['Fac'], color_ramp.inputs['Fac'])
    links.new(color_ramp.outputs['Color'], emission.inputs['Color'])
    links.new(transparent.outputs['BSDF'], mix.inputs[1])
    links.new(emission.outputs['Emission'], mix.inputs[2])
    links.new(mix.outputs['Shader'], output.inputs['Surface'])

    return mat


def create_emission_material(name, color, strength=5.0):
    """Create simple emission material."""
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)

    emission = nodes.new('ShaderNodeEmission')
    emission.location = (100, 100)
    emission.inputs['Color'].default_value = (*color, 1.0)
    emission.inputs['Strength'].default_value = strength

    transparent = nodes.new('ShaderNodeBsdfTransparent')
    transparent.location = (100, -100)

    mix = nodes.new('ShaderNodeMixShader')
    mix.location = (250, 0)
    mix.inputs['Fac'].default_value = 0.9

    links.new(transparent.outputs['BSDF'], mix.inputs[1])
    links.new(emission.outputs['Emission'], mix.inputs[2])
    links.new(mix.outputs['Shader'], output.inputs['Surface'])

    return mat


# ============================================================
#                    GEOMETRY CREATION
# ============================================================

def create_faceted_sphere(name, radius=0.4, subdivisions=2):
    """Create a faceted icosphere."""
    bpy.ops.mesh.primitive_ico_sphere_add(radius=radius, subdivisions=subdivisions, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name

    bpy.ops.object.modifier_add(type='DISPLACE')
    obj.modifiers['Displace'].strength = 0.02

    bpy.ops.object.modifier_add(type='SUBSURF')
    obj.modifiers['Subdivision'].levels = 1
    obj.modifiers['Subdivision'].render_levels = 2

    return obj


def create_water_drop_shape(name, radius=0.4):
    """Create a water drop shape."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=48, ring_count=24, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name

    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='DESELECT')
    bm = bmesh.from_edit_mesh(obj.data)

    for v in bm.verts:
        if v.co.z > 0:
            factor = v.co.z / radius
            v.co.z += factor * 0.3
            scale = 1.0 - (factor * 0.5)
            v.co.x *= scale
            v.co.y *= scale

    bmesh.update_edit_mesh(obj.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.object.shade_smooth()

    return obj


def create_plasma_orb(name, radius=0.35):
    """Create a plasma orb."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=64, ring_count=32, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name

    bpy.ops.object.modifier_add(type='DISPLACE')
    displace = obj.modifiers['Displace']
    tex = bpy.data.textures.new(name + "_noise", type='CLOUDS')
    tex.noise_scale = 0.5
    tex.noise_depth = 4
    displace.texture = tex
    displace.strength = 0.08

    bpy.ops.object.shade_smooth()
    return obj


def create_ice_crystal(name, size=0.5):
    """Create an ice crystal shape."""
    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=size*0.4, radius2=0, depth=size, location=(0, 0, size/2))
    top = bpy.context.active_object

    bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=size*0.4, radius2=0, depth=size*0.6, location=(0, 0, -size*0.3))
    bottom = bpy.context.active_object
    bottom.rotation_euler = (math.pi, 0, 0)

    top.select_set(True)
    bpy.context.view_layer.objects.active = top
    bpy.ops.object.join()

    obj = bpy.context.active_object
    obj.name = name
    obj.location = (0, 0, 0)

    bpy.ops.object.modifier_add(type='BEVEL')
    obj.modifiers['Bevel'].width = 0.01
    obj.modifiers['Bevel'].segments = 2

    return obj


def create_pyramid_core(name, size=0.5):
    """Create a pyramid core."""
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=size*0.6, radius2=0, depth=size*0.8, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = (0, 0, math.radians(45))

    bpy.ops.object.modifier_add(type='BEVEL')
    obj.modifiers['Bevel'].width = 0.015
    obj.modifiers['Bevel'].segments = 1

    return obj


def create_black_hole_core(name, radius=0.35):
    """Create a black hole core."""
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=64, ring_count=32, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    return obj


# Frame creation functions
def create_sunburst_frame(name, radius=0.7, ray_count=12):
    """Create a sunburst frame."""
    objects = []

    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.03, major_segments=64, minor_segments=16, location=(0, 0, 0))
    ring = bpy.context.active_object
    ring.name = name + "_ring"
    objects.append(ring)

    for i in range(ray_count):
        angle = (2 * math.pi * i) / ray_count
        bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.05, radius2=0, depth=0.25, location=(0, 0, 0))
        ray = bpy.context.active_object
        ray.name = f"{name}_ray_{i}"
        ray.rotation_euler = (0, math.radians(90), angle)
        ray.location = (math.cos(angle) * (radius + 0.1), math.sin(angle) * (radius + 0.1), 0)
        objects.append(ray)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    frame = bpy.context.active_object
    frame.name = name
    return frame


def create_wave_rings(name, base_radius=0.6, count=3):
    """Create wave rings."""
    objects = []

    for i in range(count):
        radius = base_radius + (i * 0.15)
        thickness = 0.02 - (i * 0.005)

        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius,
            minor_radius=thickness,
            major_segments=64,
            minor_segments=12,
            location=(0, 0, i * 0.05 - 0.05)
        )
        ring = bpy.context.active_object
        ring.name = f"{name}_ring_{i}"

        bpy.ops.object.modifier_add(type='WAVE')
        wave = ring.modifiers['Wave']
        wave.use_normal = True
        wave.height = 0.03
        wave.width = 0.3
        wave.narrowness = 1.5
        wave.speed = 0

        objects.append(ring)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    frame = bpy.context.active_object
    frame.name = name
    return frame


def create_lightning_cage(name, radius=0.65, segments=8):
    """Create a lightning cage frame."""
    objects = []

    for i in range(segments):
        angle = (2 * math.pi * i) / segments
        verts = []
        edges = []

        for j in range(8):
            z = -0.5 + (j * 0.15)
            offset = 0.03 * (1 if j % 2 == 0 else -1)
            x = math.cos(angle) * (radius + offset)
            y = math.sin(angle) * (radius + offset)
            verts.append((x, y, z))
            if j > 0:
                edges.append((j-1, j))

        mesh = bpy.data.meshes.new(f"{name}_bolt_{i}")
        mesh.from_pydata(verts, edges, [])
        bolt = bpy.data.objects.new(f"{name}_bolt_{i}", mesh)
        bpy.context.collection.objects.link(bolt)

        bpy.context.view_layer.objects.active = bolt
        bolt.select_set(True)
        bpy.ops.object.convert(target='CURVE')
        bolt.data.bevel_depth = 0.015
        bolt.data.bevel_resolution = 4
        bpy.ops.object.convert(target='MESH')

        objects.append(bolt)

    for z_pos in [-0.5, 0.5]:
        bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.02, major_segments=48, minor_segments=8, location=(0, 0, z_pos))
        ring = bpy.context.active_object
        objects.append(ring)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    frame = bpy.context.active_object
    frame.name = name
    return frame


def create_snowflake_frame(name, radius=0.65):
    """Create a snowflake frame."""
    objects = []

    for i in range(6):
        angle = (2 * math.pi * i) / 6

        bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=radius*1.5, location=(0, 0, 0))
        arm = bpy.context.active_object
        arm.rotation_euler = (0, math.radians(90), angle)
        arm.location = (math.cos(angle) * radius * 0.4, math.sin(angle) * radius * 0.4, 0)
        objects.append(arm)

        for j in [-1, 1]:
            branch_angle = angle + (j * math.radians(60))
            bpy.ops.mesh.primitive_cylinder_add(radius=0.015, depth=radius*0.5, location=(0, 0, 0))
            branch = bpy.context.active_object
            branch.rotation_euler = (0, math.radians(90), branch_angle)
            dist = radius * 0.5
            branch.location = (math.cos(angle) * dist, math.sin(angle) * dist, 0)
            objects.append(branch)

    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.15, depth=0.04, location=(0, 0, 0))
    center = bpy.context.active_object
    objects.append(center)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    frame = bpy.context.active_object
    frame.name = name
    return frame


def create_flowing_ribbons(name, radius=0.6, ribbon_count=5):
    """Create flowing aurora ribbons."""
    objects = []

    for i in range(ribbon_count):
        bpy.ops.curve.primitive_bezier_circle_add(radius=radius + (i * 0.05), location=(0, 0, i * 0.08 - 0.16))
        ribbon = bpy.context.active_object
        ribbon.name = f"{name}_ribbon_{i}"
        ribbon.data.bevel_depth = 0.015
        ribbon.data.bevel_resolution = 3
        ribbon.rotation_euler = (math.radians(10 * i), math.radians(5 * i), 0)
        objects.append(ribbon)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.convert(target='MESH')

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    frame = bpy.context.active_object
    frame.name = name
    return frame


def create_hieroglyph_ring(name, radius=0.65):
    """Create ancient ring with patterns."""
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.04, major_segments=64, minor_segments=16, location=(0, 0, 0))
    ring = bpy.context.active_object
    ring.name = name

    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.03, radius2=0, depth=0.06, location=(radius, 0, 0))
    triangle = bpy.context.active_object

    bpy.ops.object.modifier_add(type='ARRAY')
    triangle.modifiers['Array'].use_relative_offset = False
    triangle.modifiers['Array'].use_object_offset = True

    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    empty = bpy.context.active_object
    empty.rotation_euler = (0, 0, math.radians(30))

    triangle.modifiers['Array'].offset_object = empty
    triangle.modifiers['Array'].count = 12

    bpy.context.view_layer.objects.active = triangle
    bpy.ops.object.modifier_apply(modifier='Array')

    ring.select_set(True)
    triangle.select_set(True)
    bpy.context.view_layer.objects.active = ring
    bpy.ops.object.join()

    bpy.data.objects.remove(empty)

    return ring


def create_corona_ring(name, radius=0.7):
    """Create a corona ring for eclipse."""
    objects = []

    bpy.ops.mesh.primitive_torus_add(major_radius=radius*0.8, minor_radius=0.02, major_segments=64, minor_segments=12, location=(0, 0, 0))
    inner = bpy.context.active_object
    objects.append(inner)

    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=0.05, major_segments=64, minor_segments=16, location=(0, 0, 0))
    outer = bpy.context.active_object
    outer.name = name + "_glow"
    objects.append(outer)

    for i in range(16):
        angle = (2 * math.pi * i) / 16
        flare_length = 0.15 + (0.1 * (i % 3))

        bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.03, radius2=0, depth=flare_length, location=(0, 0, 0))
        flare = bpy.context.active_object
        flare.rotation_euler = (0, math.radians(90), angle)
        flare.location = (math.cos(angle) * (radius + flare_length/2), math.sin(angle) * (radius + flare_length/2), 0)
        objects.append(flare)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    frame = bpy.context.active_object
    frame.name = name
    return frame


def create_base_platform(name, style="default"):
    """Create base platform."""
    if style == "crystal":
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.55, depth=0.08, location=(0, 0, -0.65))
    elif style == "ancient":
        bpy.ops.mesh.primitive_cylinder_add(vertices=4, radius=0.6, depth=0.1, location=(0, 0, -0.65))
    else:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.55, depth=0.08, location=(0, 0, -0.65))

    base = bpy.context.active_object
    base.name = name

    bpy.ops.object.modifier_add(type='BEVEL')
    base.modifiers['Bevel'].width = 0.015
    base.modifiers['Bevel'].segments = 2

    return base


def create_floating_particles(name, count=30, radius_range=(0.6, 1.0), size=0.015):
    """Create floating particles."""
    import random
    random.seed(42)
    objects = []

    for i in range(count):
        theta = random.uniform(0, 2 * math.pi)
        phi = random.uniform(0, math.pi)
        r = random.uniform(radius_range[0], radius_range[1])

        x = r * math.sin(phi) * math.cos(theta)
        y = r * math.sin(phi) * math.sin(theta)
        z = r * math.cos(phi) - 0.2

        particle_size = size * random.uniform(0.5, 1.5)

        bpy.ops.mesh.primitive_ico_sphere_add(radius=particle_size, subdivisions=1, location=(x, y, z))
        particle = bpy.context.active_object
        particle.name = f"{name}_particle_{i}"
        objects.append(particle)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    particles = bpy.context.active_object
    particles.name = name
    return particles


def create_energy_rings(name, count=3, base_radius=0.45):
    """Create energy orbit rings."""
    objects = []

    for i in range(count):
        radius = base_radius + (i * 0.05)

        bpy.ops.mesh.primitive_torus_add(
            major_radius=radius,
            minor_radius=0.005,
            major_segments=64,
            minor_segments=8,
            location=(0, 0, 0)
        )
        ring = bpy.context.active_object
        ring.name = f"{name}_ring_{i}"
        ring.rotation_euler = (math.radians(30 * i), math.radians(45 + 20 * i), math.radians(15 * i))
        objects.append(ring)

    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()

    rings = bpy.context.active_object
    rings.name = name
    return rings


# ============================================================
#                    STUDIO LIGHTING SETUP
# ============================================================

def setup_studio_lighting(house_config, collections):
    """Setup professional studio lighting with emission planes."""
    base_lighting = BASE_CONFIG["lighting"]

    # KEY light
    key_cfg = base_lighting["key"].copy()
    key_strength = house_config.get("key_strength", key_cfg["strength"])
    create_emission_plane(
        "Light_Key",
        key_cfg["size"],
        key_strength,
        key_cfg["color"],
        key_cfg["location"],
        key_cfg["rotation"],
        collections
    )

    # FILL light
    fill_cfg = base_lighting["fill"].copy()
    fill_strength = house_config.get("fill_strength", fill_cfg["strength"])
    fill_color = house_config.get("fill_color", fill_cfg["color"])
    create_emission_plane(
        "Light_Fill",
        fill_cfg["size"],
        fill_strength,
        fill_color,
        fill_cfg["location"],
        fill_cfg["rotation"],
        collections
    )

    # RIM light
    rim_cfg = base_lighting["rim"].copy()
    rim_strength = house_config.get("rim_strength", rim_cfg["strength"])
    rim_color = house_config.get("rim_color", rim_cfg["color"])
    create_emission_plane(
        "Light_Rim",
        rim_cfg["size"],
        rim_strength,
        rim_color,
        rim_cfg["location"],
        rim_cfg["rotation"],
        collections
    )

    # TOP ACCENT
    accent_cfg = base_lighting["top_accent"]
    create_emission_plane(
        "Light_TopAccent",
        accent_cfg["size"],
        accent_cfg["strength"],
        accent_cfg["color"],
        accent_cfg["location"],
        accent_cfg["rotation"],
        collections
    )

    # House-specific light signature
    if "light_signature" in house_config:
        for light_def in house_config["light_signature"]:
            if light_def["type"] == "EMISSION_PLANE":
                create_emission_plane(
                    light_def["name"],
                    light_def["size"],
                    light_def["strength"],
                    light_def["color"],
                    light_def["location"],
                    light_def["rotation"],
                    collections
                )
            elif light_def["type"] == "EMISSION_RING":
                create_emission_ring(
                    light_def["name"],
                    light_def["radius"],
                    light_def["tube_radius"],
                    light_def["strength"],
                    light_def["color"],
                    light_def["location"],
                    light_def["rotation"],
                    collections
                )
            elif light_def["type"] == "AREA":
                bpy.ops.object.light_add(type='AREA', location=light_def["location"])
                light = bpy.context.active_object
                light.name = light_def["name"]
                if isinstance(light_def["size"], tuple):
                    light.data.size = light_def["size"][0]
                    light.data.size_y = light_def["size"][1]
                else:
                    light.data.size = light_def["size"]
                light.data.energy = light_def["strength"]
                light.data.color = light_def["color"]
                if "rotation" in light_def:
                    light.rotation_euler = tuple(math.radians(r) for r in light_def["rotation"])
                collections['Lights'].objects.link(light)
                safe_unlink_from_scene(light)
            elif light_def["type"] == "POINT":
                bpy.ops.object.light_add(type='POINT', location=light_def["location"])
                light = bpy.context.active_object
                light.name = light_def["name"]
                light.data.energy = light_def["strength"]
                light.data.color = light_def["color"]
                if "size" in light_def:
                    light.data.shadow_soft_size = light_def["size"]
                collections['Lights'].objects.link(light)
                safe_unlink_from_scene(light)


# ============================================================
#                    CAMERA SETUP
# ============================================================

def create_camera(collections):
    """Create camera with professional settings."""
    cam_cfg = BASE_CONFIG["camera"]

    bpy.ops.object.camera_add(location=cam_cfg["location"])
    camera = bpy.context.active_object
    camera.name = "CAM_MAIN"
    camera.rotation_euler = (
        math.radians(cam_cfg["rotation"][0]),
        math.radians(cam_cfg["rotation"][1]),
        math.radians(cam_cfg["rotation"][2])
    )

    camera.data.lens = cam_cfg["focal_length"]
    camera.data.sensor_width = cam_cfg["sensor_width"]
    camera.data.dof.use_dof = True
    camera.data.dof.focus_distance = 1.25  # Focus on core
    camera.data.dof.aperture_fstop = cam_cfg["f_stop"]

    bpy.context.scene.camera = camera

    collections['Camera'].objects.link(camera)
    safe_unlink_from_scene(camera)

    return camera


# ============================================================
#                    WORLD SETUP
# ============================================================

def setup_world(house_config):
    """Setup world with gradient background."""
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world

    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()

    # Texture coordinate
    tex_coord = nodes.new('ShaderNodeTexCoord')
    tex_coord.location = (-800, 0)

    # Mapping for rotation
    mapping = nodes.new('ShaderNodeMapping')
    mapping.location = (-600, 0)
    mapping.inputs['Rotation'].default_value = (math.radians(90), 0, 0)

    # Gradient texture
    gradient = nodes.new('ShaderNodeTexGradient')
    gradient.location = (-400, 0)
    gradient.gradient_type = 'SPHERICAL'

    # Color ramp with 3 stops
    color_ramp = nodes.new('ShaderNodeValToRGB')
    color_ramp.location = (-100, 0)

    world_cfg = BASE_CONFIG["world"]

    # Add middle stop
    color_ramp.color_ramp.elements.new(0.55)

    # Set colors from config
    color_ramp.color_ramp.elements[0].position = world_cfg["gradient_colors"][0][0]
    color_ramp.color_ramp.elements[0].color = (*world_cfg["gradient_colors"][0][1], 1.0)

    color_ramp.color_ramp.elements[1].position = world_cfg["gradient_colors"][1][0]
    color_ramp.color_ramp.elements[1].color = (*world_cfg["gradient_colors"][1][1], 1.0)

    color_ramp.color_ramp.elements[2].position = world_cfg["gradient_colors"][2][0]
    color_ramp.color_ramp.elements[2].color = (*world_cfg["gradient_colors"][2][1], 1.0)

    # Background node
    bg = nodes.new('ShaderNodeBackground')
    bg.location = (200, 0)

    # Get world strength from house config or base
    world_strength = house_config.get("world_strength", world_cfg["strength"])
    bg.inputs['Strength'].default_value = world_strength

    # Output
    output = nodes.new('ShaderNodeOutputWorld')
    output.location = (400, 0)

    # Connect
    links.new(tex_coord.outputs['Generated'], mapping.inputs['Vector'])
    links.new(mapping.outputs['Vector'], gradient.inputs['Vector'])
    links.new(gradient.outputs['Fac'], color_ramp.inputs['Fac'])
    links.new(color_ramp.outputs['Color'], bg.inputs['Color'])
    links.new(bg.outputs['Background'], output.inputs['Surface'])


# ============================================================
#                    VOLUME/ATMOSPHERE SETUP
# ============================================================

def setup_atmosphere(house_config, collections):
    """Setup volumetric atmosphere if enabled."""
    if not house_config.get("volume_enabled", False):
        return

    # Create volume cube encompassing the scene
    bpy.ops.mesh.primitive_cube_add(size=4.0, location=(0, 0, 0))
    volume_cube = bpy.context.active_object
    volume_cube.name = "Atmosphere_Volume"

    # Create volume material
    mat = bpy.data.materials.new(name="MAT_Atmosphere")
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    output = nodes.new('ShaderNodeOutputMaterial')
    output.location = (400, 0)

    volume_scatter = nodes.new('ShaderNodeVolumeScatter')
    volume_scatter.location = (100, 100)
    volume_scatter.inputs['Density'].default_value = house_config.get("volume_density", 0.02)
    volume_scatter.inputs['Anisotropy'].default_value = house_config.get("volume_anisotropy", 0.3)

    vol_color = house_config.get("volume_color", (1.0, 1.0, 1.0))
    volume_scatter.inputs['Color'].default_value = (*vol_color, 1.0)

    links.new(volume_scatter.outputs['Volume'], output.inputs['Volume'])

    volume_cube.data.materials.append(mat)

    collections['Volume'].objects.link(volume_cube)
    safe_unlink_from_scene(volume_cube)


# ============================================================
#                    RENDER SETTINGS
# ============================================================

def setup_render_settings():
    """Configure Cycles render settings."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'

    cycles_cfg = BASE_CONFIG["cycles"]
    cycles = scene.cycles

    cycles.device = 'GPU'
    cycles.samples = cycles_cfg["samples"]
    cycles.use_denoising = cycles_cfg["denoise"]
    cycles.denoiser = cycles_cfg["denoiser"]
    cycles.use_adaptive_sampling = True
    cycles.adaptive_threshold = cycles_cfg["noise_threshold"]

    cycles.max_bounces = cycles_cfg["max_bounces"]
    cycles.diffuse_bounces = cycles_cfg["diffuse_bounces"]
    cycles.glossy_bounces = cycles_cfg["glossy_bounces"]
    cycles.transmission_bounces = cycles_cfg["transmission_bounces"]
    cycles.volume_bounces = cycles_cfg["volume_bounces"]
    cycles.transparent_max_bounces = cycles_cfg["transparent_max_bounces"]

    cycles.sample_clamp_indirect = cycles_cfg["clamp_indirect"]
    cycles.blur_glossy = cycles_cfg["filter_glossy"]
    cycles.caustics_reflective = False
    cycles.caustics_refractive = False

    # Output
    output_cfg = BASE_CONFIG["output"]
    scene.render.resolution_x = output_cfg["resolution"][0]
    scene.render.resolution_y = output_cfg["resolution"][1]
    scene.render.resolution_percentage = 100

    # Color management
    cm_cfg = BASE_CONFIG["color_management"]
    scene.view_settings.view_transform = cm_cfg["view_transform"]
    scene.view_settings.look = cm_cfg["look"]
    scene.view_settings.exposure = cm_cfg["exposure"]
    scene.view_settings.gamma = cm_cfg["gamma"]

    scene.render.film_transparent = False


# ============================================================
#                    COMPOSITOR SETUP
# ============================================================

def setup_compositor(house_config):
    """Setup compositor with glare and color curves."""
    scene = bpy.context.scene
    scene.use_nodes = True

    tree = scene.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()

    # Render layers
    render = nodes.new('CompositorNodeRLayers')
    render.location = (0, 0)

    # Glare/Bloom
    comp_cfg = BASE_CONFIG["compositor"]
    glare_mix = house_config.get("glare_mix", comp_cfg["glare_mix"])

    glare = nodes.new('CompositorNodeGlare')
    glare.location = (250, 0)
    glare.glare_type = 'FOG_GLOW'
    glare.quality = 'HIGH'
    glare.mix = glare_mix
    glare.threshold = comp_cfg["glare_threshold"]
    glare.size = comp_cfg["glare_size"]

    # RGB Curves for subtle S-curve
    curves = nodes.new('CompositorNodeCurveRGB')
    curves.location = (500, 0)
    # Subtle S-curve: lift blacks slightly, compress highlights
    curve = curves.mapping.curves[3]  # Combined RGB
    curve.points[0].location = (0.0, 0.02)  # Lift blacks
    curve.points[1].location = (1.0, 0.98)  # Compress whites
    curves.mapping.update()

    # Color balance for house tint
    tint = house_config.get("tint", (1.0, 1.0, 1.0))
    color_balance = nodes.new('CompositorNodeColorBalance')
    color_balance.location = (750, 0)
    color_balance.correction_method = 'LIFT_GAMMA_GAIN'
    # Very subtle tint via gain
    color_balance.gain = (
        1.0 + (tint[0] - 1.0) * 0.05,
        1.0 + (tint[1] - 1.0) * 0.05,
        1.0 + (tint[2] - 1.0) * 0.05
    )

    # Output
    composite = nodes.new('CompositorNodeComposite')
    composite.location = (1000, 0)

    links.new(render.outputs['Image'], glare.inputs['Image'])
    links.new(glare.outputs['Image'], curves.inputs['Image'])
    links.new(curves.outputs['Image'], color_balance.inputs['Image'])
    links.new(color_balance.outputs['Image'], composite.inputs['Image'])


# ============================================================
#                    HOUSE TEMPLATE GENERATION
# ============================================================

def generate_house_template(house_name, house_config, output_dir):
    """Generate a complete template for a house."""
    print(f"\nGenerating template for House {house_name} (v3.0 Professional)...")

    clear_scene()
    collections = create_collections()

    # Create materials based on house type
    if house_config.get("metal_color"):
        metal_color = house_config["metal_color"]
    else:
        metal_color = tuple(c * 0.8 for c in house_config.get("secondary_color", (0.5, 0.5, 0.5)))

    metal_roughness = house_config.get("metal_roughness", (0.15, 0.25))[0]
    metal_anisotropic = house_config.get("metal_anisotropic", 0.3)

    frame_mat = create_metallic_material(
        f"MAT_Frame_{house_name}",
        metal_color,
        metallic=0.95,
        roughness=metal_roughness,
        anisotropic=metal_anisotropic
    )

    base_mat = create_metallic_material(
        f"MAT_Base_{house_name}",
        tuple(c * 0.3 for c in metal_color),
        metallic=0.9,
        roughness=0.4
    )

    # House-specific core material
    core_type = house_config.get("core_type", "glass")
    roughness = house_config.get("core_roughness", (0.02, 0.04))[0]

    if core_type == "glass":
        core_mat = create_glass_material(
            f"MAT_Core_{house_name}",
            house_config.get("primary_color", (1.0, 1.0, 1.0)),
            transmission=0.95,
            roughness=roughness,
            ior=house_config.get("core_ior", 1.45),
            dispersion=house_config.get("core_dispersion", 0.0)
        )
    elif core_type == "emissive_glass":
        emission_color = house_config.get("emission_color", (1.0, 1.0, 1.0))
        emission_strength = house_config.get("emission_strength", 5.0)
        if isinstance(emission_strength, tuple):
            emission_strength = emission_strength[0]
        core_mat = create_emissive_glass_material(
            f"MAT_Core_{house_name}",
            house_config.get("primary_color", (1.0, 1.0, 1.0)),
            emission_color,
            emission_strength,
            roughness=roughness,
            ior=house_config.get("core_ior", 1.45)
        )
    elif core_type == "frosted_glass":
        core_mat = create_frosted_glass_material(
            f"MAT_Core_{house_name}",
            house_config.get("primary_color", (0.9, 0.95, 1.0)),
            roughness=roughness,
            ior=house_config.get("core_ior", 1.31),
            subsurface_color=house_config.get("subsurface_color"),
            subsurface_strength=house_config.get("subsurface_strength", 0.08),
            edge_frost=house_config.get("edge_frost", False)
        )
    elif core_type == "iridescent_glass":
        core_mat = create_iridescent_glass_material(
            f"MAT_Core_{house_name}",
            house_config.get("primary_color", (0.9, 0.9, 1.0)),
            roughness=roughness,
            ior=house_config.get("core_ior", 1.48),
            irid_strength=house_config.get("iridescence_strength", 0.15),
            irid_shift=house_config.get("iridescence_shift", 0.3)
        )
    elif core_type == "void":
        core_mat = create_void_material(
            f"MAT_Core_{house_name}",
            house_config.get("core_base_color", (0.02, 0.02, 0.02)),
            house_config.get("fresnel_emission_color", (1.0, 0.5, 0.2)),
            house_config.get("fresnel_emission_strength", 8.0),
            house_config.get("fresnel_ior", 2.5),
            house_config.get("fresnel_power", 3.0)
        )
    else:
        # Default glass
        core_mat = create_glass_material(
            f"MAT_Core_{house_name}",
            house_config.get("primary_color", (1.0, 1.0, 1.0)),
            transmission=0.95,
            roughness=roughness,
            ior=1.45
        )

    # Create geometry based on house theme
    if house_name == "CLEAR":
        core = create_faceted_sphere("Core", radius=0.38, subdivisions=2)
        frame = create_sunburst_frame("Frame", radius=0.7, ray_count=16)
    elif house_name == "MONSOON":
        core = create_water_drop_shape("Core", radius=0.35)
        frame = create_wave_rings("Frame", base_radius=0.6, count=4)
    elif house_name == "THUNDER":
        core = create_plasma_orb("Core", radius=0.32)
        frame = create_lightning_cage("Frame", radius=0.6, segments=8)
    elif house_name == "FROST":
        core = create_ice_crystal("Core", size=0.6)
        frame = create_snowflake_frame("Frame", radius=0.65)
    elif house_name == "AURORA":
        core = create_faceted_sphere("Core", radius=0.35, subdivisions=3)
        frame = create_flowing_ribbons("Frame", radius=0.55, ribbon_count=6)
    elif house_name == "SAND":
        core = create_pyramid_core("Core", size=0.55)
        frame = create_hieroglyph_ring("Frame", radius=0.6)
    elif house_name == "ECLIPSE":
        core = create_black_hole_core("Core", radius=0.3)
        frame = create_corona_ring("Frame", radius=0.6)
    else:
        core = create_faceted_sphere("Core", radius=0.35)
        frame = create_sunburst_frame("Frame", radius=0.6)

    # Apply materials
    core.data.materials.append(core_mat)
    frame.data.materials.append(frame_mat)

    # Link to collections
    collections['Core'].objects.link(core)
    safe_unlink_from_scene(core)

    collections['Frame'].objects.link(frame)
    safe_unlink_from_scene(frame)

    # Base platform
    base_style = "crystal" if house_name in ["CLEAR", "FROST"] else "ancient" if house_name == "SAND" else "default"
    base = create_base_platform("Base", style=base_style)
    base.data.materials.append(base_mat)
    collections['Core'].objects.link(base)
    safe_unlink_from_scene(base)

    # Decorative particles
    particle_color = house_config.get("emission_color", house_config.get("accent_color", (1.0, 1.0, 1.0)))
    particle_strength = house_config.get("emission_strength", 3.0)
    if isinstance(particle_strength, tuple):
        particle_strength = particle_strength[0]

    particle_mat = create_emission_material(
        f"MAT_Particles_{house_name}",
        particle_color,
        particle_strength * 0.5
    )

    particles = create_floating_particles("Particles", count=25, radius_range=(0.5, 0.9), size=0.012)
    particles.data.materials.append(particle_mat)
    collections['Decorations'].objects.link(particles)
    safe_unlink_from_scene(particles)

    # Energy rings for certain houses
    if house_name in ["THUNDER", "AURORA", "ECLIPSE"]:
        ring_color = house_config.get("orbit_emission_color", particle_color)
        ring_strength = house_config.get("orbit_emission_strength", particle_strength)
        if isinstance(ring_strength, tuple):
            ring_strength = ring_strength[0]

        ring_mat = create_emission_material(
            f"MAT_Rings_{house_name}",
            ring_color,
            ring_strength * 0.7
        )
        rings = create_energy_rings("EnergyRings", count=3, base_radius=0.4)
        rings.data.materials.append(ring_mat)
        collections['Effects'].objects.link(rings)
        safe_unlink_from_scene(rings)

    # Setup scene
    setup_studio_lighting(house_config, collections)
    create_camera(collections)
    setup_world(house_config)
    setup_atmosphere(house_config, collections)
    setup_render_settings()
    setup_compositor(house_config)

    # Save
    output_path = os.path.join(output_dir, f"house_{house_name.lower()}.blend")
    bpy.ops.wm.save_as_mainfile(filepath=output_path)
    print(f"  Saved: {output_path}")

    return output_path


# ============================================================
#                         MAIN
# ============================================================

def main():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(description="Generate HouseForge Blender templates v3.0")
    parser.add_argument("--output-dir", default="./scenes", help="Output directory for .blend files")
    parser.add_argument("--house", default=None, help="Generate only specific house (e.g., CLEAR)")
    args = parser.parse_args(argv)

    os.makedirs(args.output_dir, exist_ok=True)

    print("=" * 60)
    print("HouseForge Template Generator v3.0 - Professional Edition")
    print("=" * 60)
    print("Features:")
    print("  - Deep blue-black studio background")
    print("  - Emission plane softbox lighting (Key/Fill/Rim/Accent)")
    print("  - House-specific light signatures")
    print("  - Volumetric atmosphere")
    print("  - Filmic color management")
    print("  - Professional compositor pipeline")
    print("=" * 60)

    if args.house:
        if args.house.upper() in HOUSES:
            generate_house_template(args.house.upper(), HOUSES[args.house.upper()], args.output_dir)
        else:
            print(f"Unknown house: {args.house}")
            sys.exit(1)
    else:
        for house_name, house_config in HOUSES.items():
            generate_house_template(house_name, house_config, args.output_dir)

    print("\n" + "=" * 60)
    print("Template generation complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
