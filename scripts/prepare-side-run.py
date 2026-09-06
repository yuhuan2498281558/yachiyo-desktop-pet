"""Finish the official-side-reference run sheet; local alpha/alignment only."""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageOps


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source', required=True, type=Path)
    p.add_argument('--output', required=True, type=Path)
    p.add_argument('--style', choices=['wide-v4', 'gentle-v5'], default='wide-v4')
    args = p.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    source = Image.open(args.source).convert('RGB')
    assert source.size == (1254, 1254), source.size
    # Source eye anchors. Same scale and face position across all four poses.
    gentle = args.style == 'gentle-v5'
    anchors = [(428, 142), (949, 143), (429, 733), (949, 734)] if gentle else [(454, 137), (1053, 146), (460, 727), (1031, 738)]
    scale = 1.3 if gentle else 1.42
    eye_anchor = (450, 185) if gentle else (520, 200)
    frames = []
    for i, (eye_x, eye_y) in enumerate(anchors):
        ox, oy = (i % 2) * 627, (i // 2) * 627
        im = source.crop((ox, oy, ox + 627, oy + 627))
        rgb = np.asarray(im, dtype=np.int16)
        r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
        candidate = (r > 219) & (g > 213) & (b > 202) & (r - b > 4) & (r >= g) & (g >= b) & (r - g < 20) & (g - b < 24)
        flood = Image.fromarray(candidate.astype(np.uint8) * 255).copy()
        # Exterior plus both official overlapping hair-ring apertures.
        seeds = [(0, 0), (eye_x - ox - 57, eye_y - oy - 54), (eye_x - ox - 33, eye_y - oy - 54)]
        # Enclosed negative spaces between the flying silver and pink strands.
        seeds += [(eye_x - ox - dx, eye_y - oy + dy) for dx, dy in
                  [(210, 55), (180, 40), (155, 25), (200, 105), (165, 125), (230, 85)]]
        for seed in seeds:
            if flood.getpixel(seed) == 255:
                ImageDraw.floodfill(flood, seed, 128)
        # Narrow enclosed cream pockets move between the hair strands per pose.
        # This ROI is behind the head, outside face/skin/plush/shoes.
        for y in range(max(0, eye_y - oy - 20), eye_y - oy + 190, 4):
            for x in range(75, eye_x - ox - 75, 4):
                if flood.getpixel((x, y)) == 255:
                    ImageDraw.floodfill(flood, (x, y), 64)
                    labels = np.asarray(flood).copy()
                    region = labels == 64
                    # Retain tiny warm antialias/highlight islands in the hair.
                    labels[region] = 128 if int(region.sum()) >= 150 else 32
                    flood = Image.fromarray(labels).copy()
        silhouette = Image.fromarray((np.asarray(flood) != 128).astype(np.uint8) * 255).copy()
        ImageDraw.floodfill(silhouette, (eye_x - ox - 45, eye_y - oy + 107), 128)
        matte = Image.fromarray((np.asarray(silhouette) == 128).astype(np.uint8) * 255)
        matte = matte.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(.4))
        alpha = np.asarray(matte).copy()
        alpha[alpha < 12] = 0
        alpha[alpha > 243] = 255
        rgba = np.dstack((np.asarray(im), alpha))
        rgba[alpha == 0, :3] = 0
        side = round(627 * scale)
        sized = Image.fromarray(rgba).resize((side, side), Image.Resampling.LANCZOS)
        offset = (round(eye_anchor[0] - (eye_x - ox) * scale), round(eye_anchor[1] - (eye_y - oy) * scale))
        frame = Image.new('RGBA', (768, 832))
        frame.alpha_composite(sized, offset)
        frames.append(frame)
    # Keep each complete drawing. A shared eye anchor already registers the head;
    # pasting a rectangular head strip would cut across moving hair/shoulders.
    atlas = Image.new('RGBA', (3072, 832))
    preview = Image.new('RGBA', (1536, 832), '#242936')
    animation = []
    bounds = []
    for i, frame in enumerate(frames):
        bbox = frame.getbbox()
        assert bbox and bbox[0] > 0 and bbox[1] > 0 and bbox[2] < 768 and bbox[3] < 832, bbox
        bounds.append(bbox)
        atlas.paste(frame, (768 * i, 0))
        frame.save(args.output / f'side-right-{i}.png')
        left = ImageOps.mirror(frame)
        left.save(args.output / f'side-left-{i}.png')
        for row, pose in enumerate((frame, left)):
            preview.alpha_composite(pose.resize((384, 416), Image.Resampling.LANCZOS), (384 * i, row * 416))
        animated = Image.new('RGBA', (768, 416), '#242936')
        animated.alpha_composite(left.resize((384, 416), Image.Resampling.LANCZOS), (0, 0))
        animated.alpha_composite(frame.resize((384, 416), Image.Resampling.LANCZOS), (384, 0))
        animation.append(animated.convert('RGB'))
    stem = 'yachiyo-hd-run-gentle-v5' if gentle else 'yachiyo-hd-run-side-v4'
    dest = args.output / f'{stem}.webp'
    atlas.save(dest, lossless=True, method=6)
    preview.convert('RGB').save(args.output / 'side-run-contact-sheet.png')
    animation[0].save(args.output / 'side-run-preview.webp', save_all=True, append_images=animation[1:], duration=280, loop=0, lossless=True)
    report = {'asset': dest.name, 'atlasSize': [3072, 832], 'frameSize': [768, 832], 'frameMs': 280,
              'sourceSha256': hashlib.sha256(args.source.read_bytes()).hexdigest(),
              'atlasSha256': hashlib.sha256(dest.read_bytes()).hexdigest(),
              'reference': 'Official setting book PDF page 21 (printed page 19), side body and side head',
              'orientation': 'Full right profile; left rendered by mirroring the side-profile frame',
              'scale': scale, 'eyeAnchor': list(eye_anchor), 'headAlignment': 'shared eye anchor; no rectangular compositing', 'bounds': bounds,
              'gait': 'short low steps with restrained hair and coat' if gentle else 'wide running stride'}
    (args.output / f'{stem}.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
