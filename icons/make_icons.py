from PIL import Image, ImageDraw
import os

def rr(d, box, r, fill):
    d.rounded_rectangle(box, radius=r, fill=fill)

def make(size, maskable=False):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(S * (0.12 if maskable else 0.0))
    box = (pad, pad, S - pad, S - pad)
    # background gradient (vertical) inside rounded square
    rr(d, box, int((S - 2 * pad) * 0.24), (18, 20, 28, 255))
    grad = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    gd = ImageDraw.Draw(grad)
    h = box[3] - box[1]
    for y in range(box[1], box[3]):
        t = (y - box[1]) / max(1, h)
        r = int(28 + t * (12 - 28))
        g = int(32 + t * (18 - 32))
        b = int(44 + t * (28 - 44))
        gd.line([(box[0], y), (box[2], y)], fill=(r, g, b, 255))
    mask = Image.new("L", (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=int((S - 2 * pad) * 0.24), fill=255)
    img.paste(grad, (0, 0), mask)

    d = ImageDraw.Draw(img)
    w = box[2] - box[0]
    # wallet body
    wx0 = box[0] + w * 0.20
    wx1 = box[2] - w * 0.20
    wy0 = box[1] + w * 0.30
    wy1 = box[1] + w * 0.70
    # green card peeking out of the top
    cardw = w * 0.44
    cardh = w * 0.16
    ccx0 = wx0 + w * 0.10
    ccy0 = wy0 - cardh * 0.55
    rr(d, (ccx0, ccy0, ccx0 + cardw, ccy0 + cardh), int(w * 0.035), (52, 211, 153, 255))
    # redraw wallet body over the card
    rr(d, (wx0, wy0, wx1, wy1), int(w * 0.09), (245, 185, 66, 255))
    # flap
    rr(d, (wx0, wy0, wx1 - w * 0.10, wy0 + w * 0.14), int(w * 0.06), (255, 214, 128, 255))
    # clasp
    cx = wx1 - w * 0.13
    cy = (wy0 + wy1) / 2
    rad = w * 0.075
    d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=(18, 20, 28, 255))
    d.ellipse((cx - rad * 0.45, cy - rad * 0.45, cx + rad * 0.45, cy + rad * 0.45), fill=(245, 185, 66, 255))

    return img.resize((size, size), Image.LANCZOS)

out = os.path.dirname(os.path.abspath(__file__))
for s in (192, 512):
    make(s).save(os.path.join(out, f"icon-{s}.png"))
    make(s, maskable=True).save(os.path.join(out, f"icon-{s}-maskable.png"))
make(180).save(os.path.join(out, "apple-touch-icon.png"))
make(32).save(os.path.join(out, "favicon-32.png"))
print("icons ok")
