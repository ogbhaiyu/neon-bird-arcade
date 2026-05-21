import os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# 1. Generate the SVG string for modern vector supporting browsers
svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <!-- Background Gradient -->
    <radialGradient id="bg-grad" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="#140b2e" />
      <stop offset="100%" stop-color="#05030d" />
    </radialGradient>
    
    <!-- Neon Cyan Glow Filter -->
    <filter id="cyan-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="12" result="blur1" />
      <feGaussianBlur stdDeviation="24" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2" />
        <feMergeNode in="blur1" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    
    <!-- Neon Magenta Glow Filter -->
    <filter id="magenta-glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="8" result="blur1" />
      <feGaussianBlur stdDeviation="16" result="blur2" />
      <feMerge>
        <feMergeNode in="blur2" />
        <feMergeNode in="blur1" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>

    <!-- Metallic/Cyber Gradient for the ship fill -->
    <linearGradient id="ship-fill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#d4f8ff" />
    </linearGradient>
  </defs>

  <!-- Dark cybernetic background card -->
  <rect width="512" height="512" rx="128" fill="url(#bg-grad)" />
  <rect width="500" height="500" x="6" y="6" rx="122" fill="none" stroke="#00f0ff" stroke-opacity="0.15" stroke-width="4" />

  <!-- The spaceship (Neon Bird) -->
  <g transform="translate(-10, 0)"> <!-- Slight left offset to center the visual weight -->
    <!-- Jet Core (Engine Flame) -->
    <circle cx="160" cy="256" r="48" fill="#ff0055" filter="url(#magenta-glow)" />
    <circle cx="160" cy="256" r="20" fill="#ffffff" />

    <!-- Spaceship Body -->
    <path d="M 464 256 L 48 112 L 128 256 L 48 400 Z" 
          fill="url(#ship-fill)" 
          stroke="#00f0ff" 
          stroke-width="18" 
          stroke-linejoin="miter"
          stroke-miterlimit="4"
          filter="url(#cyan-glow)" />
          
    <!-- Inner design details for extra premium look -->
    <path d="M 400 256 L 110 148 L 165 256 L 110 364 Z" 
          fill="none" 
          stroke="#00f0ff" 
          stroke-width="4" 
          stroke-opacity="0.5" />
  </g>
</svg>"""

# Ensure target directories exist
os.makedirs("public", exist_ok=True)
os.makedirs("src/app", exist_ok=True)

with open("public/favicon.svg", "w", encoding="utf-8") as f:
    f.write(svg_content)

# 2. Draw high-res image using Pillow (1024x1024)
width, height = 1024, 1024

# Create radial gradient array
y_grid, x_grid = np.ogrid[:height, :width]
cx, cy = width / 2, height / 2
r = np.sqrt((x_grid - cx)**2 + (y_grid - cy)**2)
r_norm = np.clip(r / 724.0, 0, 1)

# Center color is #140b2e (20, 11, 46)
# Edge color is #05030d (5, 3, 13)
red = 20 + (5 - 20) * r_norm
green = 11 + (3 - 11) * r_norm
blue = 46 + (13 - 46) * r_norm

rgb = np.stack([red, green, blue], axis=-1).astype(np.uint8)
bg = Image.fromarray(rgb, 'RGB')

# Create rounded mask for transparency
mask = Image.new('L', (width, height), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([32, 32, 992, 992], radius=220, fill=255)

# Initialize transparent base
base = Image.new('RGBA', (width, height), (0, 0, 0, 0))
base.paste(bg, (0, 0), mask=mask)

# Draw cyan border inside base
draw = ImageDraw.Draw(base)
draw.rounded_rectangle([44, 44, 980, 980], radius=208, fill=None, outline=(0, 240, 255, 38), width=8)

# Coordinates offset left by 20 to center the shape
# Original ship coords scaled by 32:
# Nose: 928, Top wing: 96, Engine: 256, Bottom wing: 96
# Midpoint of x is (96 + 928)/2 = 512, which is centered. But visually, triangular ships look back-heavy,
# so we apply an offset of -20 to balance it.
offset_x = -20
vertices = [
    (928 + offset_x, 512),
    (96 + offset_x, 224),
    (256 + offset_x, 512),
    (96 + offset_x, 800)
]

# Jet center
jc_x = 320 + offset_x
jc_y = 512

# Draw Jet Core Glow (Magenta)
jet_layer = Image.new('RGBA', (width, height), (0, 0, 0, 0))
jet_draw = ImageDraw.Draw(jet_layer)
# Circle with radius 96
jet_draw.ellipse([jc_x - 96, jc_y - 96, jc_x + 96, jc_y + 96], fill=(255, 0, 85, 255))
# Heavy blur
jet_glow = jet_layer.filter(ImageFilter.GaussianBlur(32))
base.alpha_composite(jet_glow)

# Draw Cyan outer glows (Layer 1 - wide blur)
cg_layer1 = Image.new('RGBA', (width, height), (0, 0, 0, 0))
cg_draw1 = ImageDraw.Draw(cg_layer1)
cg_draw1.polygon(vertices, fill=None, outline=(0, 240, 255, 255), width=36)
cg_glow1 = cg_layer1.filter(ImageFilter.GaussianBlur(24))
base.alpha_composite(cg_glow1)

# Draw Cyan outer glows (Layer 2 - tighter blur)
cg_layer2 = Image.new('RGBA', (width, height), (0, 0, 0, 0))
cg_draw2 = ImageDraw.Draw(cg_layer2)
cg_draw2.polygon(vertices, fill=None, outline=(0, 240, 255, 255), width=18)
cg_glow2 = cg_layer2.filter(ImageFilter.GaussianBlur(12))
base.alpha_composite(cg_glow2)

# Draw spaceship body solid and border
ship_body = Image.new('RGBA', (width, height), (0, 0, 0, 0))
sb_draw = ImageDraw.Draw(ship_body)
sb_draw.polygon(vertices, fill=(255, 255, 255, 255), outline=(0, 240, 255, 255), width=18)

# Inner design panel detailing
inner_vertices = [
    (380 + offset_x, 512),
    (90 + offset_x, 296),
    (145 + offset_x, 512),
    (90 + offset_x, 728)
]
sb_draw.polygon(inner_vertices, fill=None, outline=(0, 240, 255, 128), width=8)
base.alpha_composite(ship_body)

# Hot core of jet (White inner circle)
hot_core = Image.new('RGBA', (width, height), (0, 0, 0, 0))
hc_draw = ImageDraw.Draw(hot_core)
hc_draw.ellipse([jc_x - 32, jc_y - 32, jc_x + 32, jc_y + 32], fill=(255, 255, 255, 255))
base.alpha_composite(hot_core)

# Save standard images
base.resize((96, 96), Image.Resampling.LANCZOS).save("public/favicon-96x96.png")
base.resize((180, 180), Image.Resampling.LANCZOS).save("public/apple-touch-icon.png")
base.resize((192, 192), Image.Resampling.LANCZOS).save("public/web-app-manifest-192x192.png")
base.resize((512, 512), Image.Resampling.LANCZOS).save("public/web-app-manifest-512x512.png")

# Save favicon.ico (multi-resolution)
ico_sizes = [(16, 16), (32, 32), (48, 48)]
ico_imgs = [base.resize(sz, Image.Resampling.LANCZOS) for sz in ico_sizes]
ico_imgs[0].save("src/app/favicon.ico", format="ICO", append_images=ico_imgs[1:])
ico_imgs[0].save("public/favicon.ico", format="ICO", append_images=ico_imgs[1:])

print("All favicons generated successfully!")
