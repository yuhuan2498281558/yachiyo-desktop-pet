"""Local finishing of generated run art and approved-master eye patches (Pillow/numpy).

No network or new drawing API. Keeps the approved idle atlas unchanged.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def cutout(im, seeds):
    rgb = np.asarray(im.convert('RGB'), dtype=np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    candidate = (r > 221) & (g > 215) & (b > 204) & (r - b > 4) & (r >= g) & (g >= b) & (r - g < 18) & (g - b < 22)
    flood = Image.fromarray(candidate.astype(np.uint8) * 255).copy()
    for seed in seeds:
        if flood.getpixel(seed) == 255:
            ImageDraw.floodfill(flood, seed, 128)
    silhouette = Image.fromarray((np.asarray(flood) != 128).astype(np.uint8) * 255).copy()
    ImageDraw.floodfill(silhouette, (im.width // 2, 320), 128)
    matte = Image.fromarray((np.asarray(silhouette) == 128).astype(np.uint8) * 255)
    matte = matte.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.4))
    alpha = np.asarray(matte).copy()
    alpha[alpha < 12] = 0
    alpha[alpha > 243] = 255
    rgba = np.dstack((np.asarray(im.convert('RGB')), alpha))
    rgba[alpha == 0, :3] = 0
    return Image.fromarray(rgba)


def run_frames(source, output):
    sheet = Image.open(source).convert('RGB')
    assert sheet.size == (1774, 887), sheet.size
    # Art-directed cell boundaries and head centers, verified against source.
    cells = [(0, 438, 267), (438, 848, 686), (848, 1254, 1094), (1254, 1673, 1500)]
    frames = []
    for index, (left, right, center) in enumerate(cells):
        im = sheet.crop((left, 0, right, 887))
        c = center - left
        seeds = [(0, 0), (c - 49, 103), (c + 58, 106), (c - 45, 204), (c + 36, 205)]
        rgba = cutout(im, seeds)
        # One shared scale and face anchor: never resize each pose by its own bbox.
        scale = 1.08
        fitted = rgba.resize((round(im.width * scale), round(im.height * scale)), Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (768, 832))
        frame.alpha_composite(fitted, (round(384 - c * scale), -56))
        frames.append(frame)
    # Lock the generated face/hair rings above the shoulders across the cycle.
    # Lower sleeves, coat and both legs retain the drawn animation.
    top = frames[0].crop((0, 0, 768, 187))
    for frame in frames[1:]:
        frame.paste(top, (0, 0))
    atlas = Image.new('RGBA', (3072, 832))
    for i, frame in enumerate(frames):
        assert frame.getbbox() and frame.getbbox()[1] > 0 and frame.getbbox()[3] < 832
        frame.save(output / f'run-{i}.png')
        atlas.paste(frame, (i * 768, 0))
    atlas.save(output / 'yachiyo-hd-run-v3.webp', lossless=True, method=6)
    preview = Image.new('RGB', (1536, 416), '#242936')
    for i, frame in enumerate(frames):
        small = frame.resize((384, 416), Image.Resampling.LANCZOS)
        preview.paste(small, (384 * i, 0), small)
    preview.save(output / 'run-contact-sheet.png')
    animated = []
    for frame in frames:
        bg = Image.new('RGBA', (384, 416), '#242936')
        bg.alpha_composite(frame.resize(bg.size, Image.Resampling.LANCZOS))
        animated.append(bg.convert('RGB'))
    animated[0].save(output / 'run-preview.webp', save_all=True, append_images=animated[1:], duration=280, loop=0, lossless=True)


def gaze_frames(source, output):
    master = Image.open(source).convert('RGBA').crop((0, 0, 768, 832))
    box = (342, 110, 430, 150)
    patch = master.crop(box).resize((352, 160), Image.Resampling.LANCZOS)
    sclera = patch.copy()
    aperture = Image.new('L', patch.size)
    d = ImageDraw.Draw(aperture)
    # Eyelids remain in the master; only the inside of each eye is movable.
    for polygon in [[(12, 15), (17, 12), (25, 12), (30, 15), (30, 21), (25, 23), (18, 23), (14, 20)],
                    [(56, 14), (61, 11), (68, 11), (73, 14), (73, 20), (68, 23), (60, 22), (56, 19)]]:
        d.polygon([(x * 4, y * 4) for x, y in polygon], fill=255)
    aperture = aperture.filter(ImageFilter.GaussianBlur(.65))
    iris_mask = Image.new('L', patch.size)
    d = ImageDraw.Draw(iris_mask)
    for box_ in [(17, 10, 31, 24), (57, 9, 71, 24)]:
        d.ellipse(tuple(round(v * 4) for v in box_), fill=255)
    iris_mask = iris_mask.filter(ImageFilter.GaussianBlur(.7))
    whites = Image.new('RGBA', patch.size, (247, 243, 247, 255))
    sclera = Image.composite(whites, sclera, iris_mask)
    irises = patch.copy()
    irises.putalpha(iris_mask)
    atlas = Image.new('RGBA', (88 * 17, 40 * 17))
    previews = Image.new('RGB', (880, 600), '#242936')
    final_mask = aperture.resize((88, 40), Image.Resampling.LANCZOS)
    for y in range(17):
        for x in range(17):
            shifted = sclera.copy()
            shifted.alpha_composite(irises, (round((x - 8) * 1.5), y - 8))
            result = Image.composite(shifted, patch, aperture).resize((88, 40), Image.Resampling.LANCZOS)
            result = Image.composite(result, master.crop(box), final_mask)
            result.putalpha(master.crop(box).getchannel('A'))
            if x == 8 and y == 8:
                result = master.crop(box)
            atlas.paste(result, (x * 88, y * 40))
    atlas.save(output / 'yachiyo-hd-gaze-v3.webp', lossless=True, method=6)
    for i, (x, y) in enumerate([(0, 8), (8, 8), (16, 8), (8, 0), (8, 16)]):
        eye = atlas.crop((x * 88, y * 40, (x + 1) * 88, (y + 1) * 40)).resize((440, 200))
        previews.paste(eye.convert('RGB'), ((i % 2) * 440, (i // 2) * 200))
    previews.save(output / 'gaze-detail.png')


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--run', required=True, type=Path)
    p.add_argument('--idle', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    args = p.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    run_frames(args.run, args.output)
    gaze_frames(args.idle, args.output)
    report = {'sourceRunSha256': digest(args.run), 'sourceIdleSha256': digest(args.idle),
              'run': {'asset': 'yachiyo-hd-run-v3.webp', 'size': [3072, 832], 'frames': 4, 'frameMs': 280},
              'gaze': {'asset': 'yachiyo-hd-gaze-v3.webp', 'size': [1496, 680], 'grid': 17, 'patch': [342, 110, 88, 40]},
              'scope': 'Horizontal drag-driven directional run; stop on release or no movement. Never auto-walk. Gaze moves eye interiors only.'}
    for key in ('run', 'gaze'):
        report[key]['sha256'] = digest(args.output / report[key]['asset'])
    (args.output / 'yachiyo-hd-motion-v3.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
