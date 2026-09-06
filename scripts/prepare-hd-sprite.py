"""Local-only sprite finishing; Pillow/numpy, no network or model calls.

Source order: open, half-closed, closed. Generated originals stay untouched.
User explicitly approved alpha extraction and local eye/frame composition.
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('sources', nargs=3, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--inspect', action='store_true')
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    sources = [Image.open(path).convert('RGB') for path in args.sources]
    assert all(im.size == (1024, 1536) for im in sources), 'Expected registered 1024x1536 sources'
    face_sheet = Image.new('RGB', (960, 260))
    for i, source in enumerate(sources):
        face_sheet.paste(source.crop((352, 350, 672, 610)), (i * 320, 0))
    face_sheet.save(args.output / 'source-eyes.png')
    if args.inspect:
        return

    # Eye-only regions: below eyebrows, inside skin, above nose/mouth.
    # Never replace regenerated hair/body pixels, even if sources look aligned.
    mask = Image.new('L', sources[0].size)
    draw = ImageDraw.Draw(mask)
    draw.polygon([(389, 445), (477, 444), (487, 461), (490, 520),
                  (407, 530), (390, 515)], fill=255)
    draw.polygon([(535, 444), (625, 444), (633, 515), (614, 530),
                  (532, 521), (531, 464)], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    frames = [sources[0]] + [Image.composite(im, sources[0], mask) for im in sources[1:]]

    master = np.asarray(sources[0], dtype=np.float32) / 255
    # Green screen exceeds both red and blue. Teal costume is protected because
    # its blue component is high. Unmix green from antialiased boundary pixels.
    dominance = master[:, :, 1] - np.maximum(master[:, :, 0], master[:, :, 2])
    # Generated screen varies roughly (7,246,8)..(26,238,21), not exact #00ff00.
    alpha = 1 - np.clip((dominance - 0.12) / 0.66, 0, 1)
    alpha[alpha < 0.04] = 0
    alpha[alpha > 0.96] = 1
    alpha_u8 = np.rint(alpha * 255).astype(np.uint8)
    edge = np.asarray(Image.fromarray((alpha < 0.98).astype(np.uint8) * 255)
                      .filter(ImageFilter.MaxFilter(5))) > 0
    bbox = Image.fromarray(alpha_u8).getbbox()
    fitted = (round((bbox[2] - bbox[0]) * 780 / (bbox[3] - bbox[1])), 780)
    offset = ((768 - fitted[0]) // 2, 28)
    outputs = []
    for name, source in zip(('open', 'half', 'closed'), frames):
        rgb = np.asarray(source, dtype=np.float32) / 255
        rgb[:, :, 1] -= 1 - alpha
        rgb = np.clip(rgb / np.maximum(alpha[:, :, None], 1 / 255), 0, 1)
        # Pale hair may reflect a little screen green even in opaque edge
        # pixels. Despill only near the matte boundary, not teal interior art.
        rgb[:, :, 1] = np.where(edge, np.minimum(rgb[:, :, 1],
                                               np.maximum(rgb[:, :, 0], rgb[:, :, 2])), rgb[:, :, 1])
        rgb[alpha == 0] = 0
        rgba = np.dstack((np.rint(rgb * 255).astype(np.uint8), alpha_u8))
        im = Image.fromarray(rgba).crop(bbox).resize(fitted, Image.Resampling.LANCZOS)
        frame = Image.new('RGBA', (768, 832))
        frame.paste(im, offset)
        frame.save(args.output / f'yachiyo-hd-idle-{name}-v1.png')
        outputs.append(frame)
    atlas = Image.new('RGBA', (2304, 832))
    for i, frame in enumerate(outputs):
        atlas.paste(frame, (i * 768, 0))
    atlas.save(args.output / 'yachiyo-hd-idle-v1.webp', lossless=True, method=6)

    preview = Image.new('RGB', (1152, 416))
    for i, (frame, background) in enumerate(zip(outputs, ('#f5f3ef', '#222633', '#b9c8da'))):
        tile = Image.new('RGBA', (384, 416), background)
        tile.alpha_composite(frame.resize(tile.size, Image.Resampling.LANCZOS))
        preview.paste(tile.convert('RGB'), (i * 384, 0))
    preview.save(args.output / 'idle-preview-v1.png')
    eyes = Image.new('RGB', (960, 260), '#f5f3ef')
    for i, frame in enumerate(frames):
        eyes.paste(frame.crop((352, 350, 672, 610)), (i * 320, 0))
    eyes.save(args.output / 'composed-eyes.png')
    arrays = [np.asarray(frame) for frame in outputs]
    assert all(np.array_equal(arrays[0][:, :, 3], a[:, :, 3]) for a in arrays[1:])
    change = np.any(arrays[0] != arrays[2], axis=2)
    change_bbox = Image.fromarray(change.astype(np.uint8) * 255).getbbox()
    assert change_bbox and change_bbox[3] - change_bbox[1] < 65, change_bbox
    assert all(a[0, :, 3].max() == 0 and a[-1, :, 3].max() == 0 for a in arrays)
    report = {'frameSize': [768, 832], 'atlasSize': list(atlas.size),
              'sourceCrop': bbox, 'fittedSize': fitted, 'offset': offset,
              'changedEyeBounds': change_bbox, 'identicalAlpha': True,
              'transparentPixelsPerFrame': int((arrays[0][:, :, 3] == 0).sum()),
              'nonEyePixelsIdentical': True, 'sources': [p.name for p in args.sources]}
    (args.output / 'alpha-frame-qa.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
