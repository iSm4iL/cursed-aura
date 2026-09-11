# -*- coding: utf-8 -*-
"""Готовит игровые ассеты персонажей из оригинального арта.

Вход:  refs/mage_<класс>.png — картинка в полном разрешении, фон прозрачный.
Выход: assets/character_<класс>.png — боевой спрайт (мелкий, контрастный, с
                                      обводкой в цвет стихии),
       assets/portrait_<класс>.png  — крупный портрет для меню.

Зачем два файла: в бою персонаж рисуется высотой ~36 px среди десятков врагов,
и детальный портрет там читается как тёмное пятно — обводка отделяет тёмную
мантию от тёмного фона. Крупно же обводка выглядит грязно, поэтому в меню идёт
чистый арт.

Запуск:  python tools/make_sprites.py        (из корня репозитория)
Нужен Pillow:  pip install pillow
"""
import os
import sys

from PIL import Image, ImageEnhance, ImageFilter

# Цвет обводки = CLASSES[<класс>].color из src/data/weapons.js. При смене цвета
# класса поменять и здесь, иначе спрайт перестанет совпадать с интерфейсом.
ACCENT = {
    'fire':  (255, 122, 61),
    'water': (79, 184, 224),
    'earth': (201, 161, 90),
    'air':   (191, 233, 255),
}

SPRITE_H = 64      # высота исходника боевого спрайта (на экране ~36)
PORTRAIT_H = 160   # высота портрета для меню
PAD = 3            # поле под обводку, иначе её срежет по краю кадра


def build(cid, accent, refs_dir, out_dir):
    src_path = os.path.join(refs_dir, 'mage_%s.png' % cid)
    if not os.path.exists(src_path):
        print('пропуск %s: нет %s' % (cid, src_path))
        return False

    src = Image.open(src_path).convert('RGBA')
    src = src.crop(src.getbbox())          # срезать прозрачные поля
    w, h = src.size

    # --- портрет: арт как есть, приведённый к общей высоте. Все классы кладём в
    # квадрат одного размера, иначе в карусели они будут разного масштаба.
    port = src.resize((max(1, round(w * PORTRAIT_H / h)), PORTRAIT_H), Image.LANCZOS)
    canvas = Image.new('RGBA', (PORTRAIT_H, PORTRAIT_H), (0, 0, 0, 0))
    canvas.paste(port, ((PORTRAIT_H - port.size[0]) // 2, 0))
    canvas.save(os.path.join(out_dir, 'portrait_%s.png' % cid), optimize=True)

    # --- боевой спрайт: мельче, контрастнее, с обводкой в цвет стихии.
    body = src.resize((max(1, round(w * SPRITE_H / h)), SPRITE_H), Image.LANCZOS)
    body = ImageEnhance.Color(body).enhance(1.35)
    body = ImageEnhance.Contrast(body).enhance(1.20)
    body = ImageEnhance.Brightness(body).enhance(1.15)

    box = (body.size[0] + PAD * 2, SPRITE_H + PAD * 2)
    sprite = Image.new('RGBA', box, (0, 0, 0, 0))
    sprite.paste(body, (PAD, PAD), body)

    mask = sprite.getchannel('A').filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1.2))
    glow = Image.new('RGBA', box, accent + (0,))
    glow.putalpha(mask.point(lambda a: int(a * 0.85)))
    out = Image.alpha_composite(glow, sprite)

    # Квадрат: движок вписывает текстуру по большей стороне (texFit), с квадратом
    # у всех классов получается одинаковый экранный размер.
    side = max(box)
    final = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    final.paste(out, ((side - box[0]) // 2, (side - box[1]) // 2))
    final.save(os.path.join(out_dir, 'character_%s.png' % cid), optimize=True)

    print('%-6s %dx%d -> спрайт %dx%d + портрет %dx%d' % (cid, w, h, side, side, PORTRAIT_H, PORTRAIT_H))
    return True


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    refs_dir = os.path.join(root, 'refs')
    out_dir = os.path.join(root, 'assets')
    os.makedirs(out_dir, exist_ok=True)

    done = sum(build(cid, accent, refs_dir, out_dir) for cid, accent in ACCENT.items())
    if not done:
        print('нечего собирать: положи оригиналы в refs/mage_<класс>.png')
        return 1
    print('готово: %d из %d' % (done, len(ACCENT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
