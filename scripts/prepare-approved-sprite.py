"""Finish the approved v003 master locally without redrawing its identity.

Pillow/numpy only, no network. Input order: approved/open, half, closed.
Cream-screen flood fill uses explicit hole seeds and cannot flood enclosed skin.
"""
import argparse
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', nargs=3, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    master = Image.open(args.sources[0]).convert('RGB')
    assert master.size == (930, 1691), 'Use the approved v003 master, not a regenerated body'
    sources = [master] + [Image.open(p).convert('RGB').resize(master.size, Image.Resampling.LANCZOS)
                          for p in args.sources[1:]]
    mask = Image.new('L', master.size)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(408, 343), (444, 342), (451, 350), (452, 374), (410, 378), (403, 365)], fill=255)
    draw.polygon([(482, 342), (520, 342), (528, 365), (521, 378), (479, 374), (479, 351)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1))
    frames = [master] + [Image.composite(im, master, mask) for im in sources[1:]]
    eyes = Image.new('RGB', (780, 200))
    for i, im in enumerate(frames):
        eyes.paste(im.crop((395, 321, 538, 411)).resize((260, 164), Image.Resampling.LANCZOS), (260 * i, 0))
    eyes.save(args.output / 'composed-eyes-v3.png')

    rgb = np.asarray(master, dtype=np.int16)
    r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
    candidate = (r > 218) & (g > 210) & (b > 199) & (r - b > 4) & (g >= b) & (r - g < 20) & (g - b < 22)
    flood = Image.fromarray(candidate.astype(np.uint8) * 255).copy()
    # Exterior, two hair-loop holes, and the spaces between long hair/torso.
    seeds = [(0, 0), (368, 232), (567, 230), (402, 437), (527, 438),
             (347, 457), (589, 462), (300, 580), (630, 580), (150, 1080), (787, 1080)]
    for seed in seeds:
        if flood.getpixel(seed) == 255:
            ImageDraw.floodfill(flood, seed, 128)
    silhouette = Image.fromarray((np.asarray(flood) != 128).astype(np.uint8) * 255).copy()
    ImageDraw.floodfill(silhouette, (465, 700), 128)
    alpha = (np.asarray(silhouette) == 128).astype(np.uint8) * 255
    matte = Image.fromarray(alpha)
    # Trim the cream-contaminated outer pixel, then add a subpixel matte edge.
    # This avoids pale cutout speckles on dark desktops at fractional DPI.
    matte = matte.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.45))
    alpha = np.asarray(matte).copy()
    alpha[alpha < 12] = 0
    alpha[alpha > 243] = 255
    bbox = Image.fromarray(alpha).getbbox()
    assert bbox[0] > 0 and bbox[1] > 0 and bbox[2] < 930 and bbox[3] < 1691, bbox
    fitted = (round((bbox[2] - bbox[0]) * 780 / (bbox[3] - bbox[1])), 780)
    offset = ((768 - fitted[0]) // 2, 28)
    outputs = []
    for name, im in zip(('open', 'half', 'closed'), frames):
        rgba = np.dstack((np.asarray(im), alpha))
        rgba[alpha == 0, :3] = 0
        character = Image.fromarray(rgba).crop(bbox).resize(fitted, Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (768, 832))
        frame.paste(character, offset)
        frame.save(args.output / f'yachiyo-hd-idle-{name}-v3.png')
        outputs.append(frame)
    atlas = Image.new('RGBA', (2304, 832))
    for i, frame in enumerate(outputs):
        atlas.paste(frame, (768 * i, 0))
    atlas_path = args.output / 'yachiyo-hd-idle-v3.webp'
    atlas.save(atlas_path, lossless=True, method=6)
    preview = Image.new('RGB', (1152, 416))
    for i, color in enumerate(('#f5f3ef', '#222633', '#b9c8da')):
        tile = Image.new('RGBA', (384, 416), color)
        tile.alpha_composite(outputs[i].resize(tile.size, Image.Resampling.LANCZOS))
        preview.paste(tile.convert('RGB'), (384 * i, 0))
    preview.save(args.output / 'idle-preview-v3.png')
    arrays = [np.asarray(im) for im in outputs]
    changes = []
    for a in arrays[1:]:
        assert np.array_equal(arrays[0][:, :, 3], a[:, :, 3])
        change = np.any(arrays[0] != a, axis=2)
        bounds = Image.fromarray(change.astype(np.uint8) * 255).getbbox()
        assert bounds and bounds[3] - bounds[1] < 32, bounds
        changes.append(bounds)
    assert all(a[0, :, 3].max() == 0 and a[-1, :, 3].max() == 0 for a in arrays)
    assert alpha[232, 368] == 0 and alpha[230, 567] == 0
    report = {'asset': atlas_path.name, 'frameSize': [768, 832], 'atlasSize': list(atlas.size),
              'masterSha256': hashlib.sha256(args.sources[0].read_bytes()).hexdigest(),
              'atlasSha256': hashlib.sha256(atlas_path.read_bytes()).hexdigest(),
              'sourceCrop': bbox, 'fittedSize': fitted, 'offset': offset,
              'changedEyeBounds': changes, 'identicalAlpha': True, 'nonEyePixelsIdentical': True,
              'transparentPixelsPerFrame': int((arrays[0][:, :, 3] == 0).sum()),
              'opaquePixelsPerFrame': int((arrays[0][:, :, 3] == 255).sum())}
    (args.output / 'alpha-frame-qa-v3.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
