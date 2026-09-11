// Перенесено из src/game.html при реструктуризации 1.0.9 — правки идут прямо сюда.
// Собирается обратно в игру через src/game.html: /* @include data/weapons.js */ (см. assemble.js).

  // Каждое базовое заклинание — ветка 1-5. Достижение 5 уровня СРАЗУ открывает отдельное
  // окно выбора эволюции (эволюции никогда не выпадают случайно в обычном левел-апе).
  // Все числа тут — стартовые цели баланса, меняются правкой этой таблицы, без правки логики.
  // falloff — доля от dmg на N-м прыжке цепи (индекс 0 = первая цель).
  const CHAIN_FALLOFF = [1, 0.75, 0.55, 0.40, 0.30, 0.22, 0.18];
  // §2/§4: у каждого класса свой пол CD. Пол только НЕ ДАЁТ артефактам/предметам
  // опустить откат ниже минимума — но никогда не поднимает собственный CD способности.
  const CD_FLOOR = { fast: 700, medium: 1800, slow: 2800, ultra: 30000 };
  const CD_CLASS = {
    airbullet: 'fast', fire: 'fast', lightning: 'fast', 'Святая пуля': 'fast',
    frost: 'medium', blast: 'medium', earth: 'medium', metal: 'medium', charm: 'medium', barrier: 'medium',
    'Пушка': 'medium', 'Шторм': 'medium', 'Пила': 'medium', 'Имплозия': 'medium', 'Валуны': 'medium',
    'Вулкан': 'medium', 'Метеоритный дождь': 'medium', 'Гейзер': 'medium', 'Стена': 'medium', 'Неуязвимость': 'medium',
    wave: 'slow', 'Цунами': 'slow', 'Ледяное сердце': 'slow', 'Чёрный лёд': 'slow', 'Иний': 'slow',
    'Залп стрел': 'slow', 'Драконьи стрелы': 'slow', 'Солнце': 'slow', 'Гнев небес': 'slow', 'Иерихон': 'slow',
    'Разрез': 'slow', 'Разлом': 'slow', 'Монументы': 'slow', 'Ледяная пустыня': 'slow',
    'Небесный удар': 'slow', 'Обвал': 'slow', 'Отражающий барьер': 'slow',
    'Термоядерный взрыв': 'ultra'
  };
  const NECRO_MAX_ALLIES = 25;

  const WEAPONS = {
    wave: {
      name: 'Волна', color: 0x4fb8e0, element: 'water', type: 'wave',
      levels: [null,
        { dmg: 88, speed: 440, cooldown: 3400, summary: 'Широкая волна воды пролетает через весь экран, пронзая всех на пути' },
        { dmg: 112, speed: 455, cooldown: 3200 },
        { dmg: 138, speed: 470, cooldown: 3000 },
        { dmg: 165, speed: 485, cooldown: 2800 },
        { dmg: 195, speed: 500, cooldown: 2600 }
      ],
      evolutions: [
        { name: 'Цунами', desc: 'Мощный удар по всем вокруг с сильным отбрасыванием', type: 'area', level6: { dmg: 210, radius: 300, cooldown: 4000, knockback: 110 } },
        { name: 'Шторм', desc: '+8% уклонения навсегда, постоянный лёгкий урон и замедление вокруг тебя', type: 'area', onPick: () => { stats.evasion += 0.08; }, level6: { dmg: 12, radius: 150, cooldown: 600, slowMult: 0.85, slowMs: 500 } },
        { name: 'Гейзер', desc: 'Рядом с тобой вспухает земля и бьёт гейзер: тяжёлый удар по площади и сильное замедление', type: 'geyser', level6: { dmg: 200, radius: 190, cooldown: 2800, offset: [110, 260], windup: 420, slowMult: 0.45, slowMs: 2000 } }
      ]
    },
    charm: {
      name: 'Кровь', color: 0xb02040, element: 'blood', type: 'charm',
      levels: [null,
        { count: 1, duration: 5000, dmg: 16, cooldown: 10000, summary: 'Подчиняет случайного врага рядом — он дерётся на твоей стороне' },
        { count: 3, duration: 5500, dmg: 18, cooldown: 9000 },
        { count: 5, duration: 6000, dmg: 20, cooldown: 8000 },
        { count: 7, duration: 7000, dmg: 24, cooldown: 7000 },
        { count: 9, duration: 8000, dmg: 28, cooldown: 6500 }
      ],
      evolutions: [
        { name: 'Некромант', desc: 'Убитые твоими подчинёнными враги восстают и тоже дерутся за тебя', level6: { count: 9, duration: 8000, dmg: 28, cooldown: 6500, necromancer: true } },
        { name: 'Договор', desc: 'Позволяет подчинять и элитных врагов', level6: { count: 9, duration: 8000, dmg: 40, cooldown: 6500, allowElite: true, boostedHp: true } },
        { name: 'Двойники', desc: 'Кровь убитых собирается в призрачных двойников: они держатся рядом и повторяют твои заклинания вполсилы', level6: { count: 9, duration: 8000, dmg: 28, cooldown: 6500, clones: true, cloneCost: 14, cloneMax: 3, cloneLife: 14000, cloneAttackMs: 850, clonePart: 0.25, clonePower: 0.2, cloneOrbit: 84, cloneSpin: 0.7 } }
      ]
    },
    frost: {
      name: 'Лёд', color: 0x9fe8ff, element: 'ice', type: 'multiburst',
      levels: [null,
        { count: 1, dmg: 42, radius: 74, freeze: 500, cooldown: 1100, offset: [40, 150], summary: 'Ледяные взрывы вспыхивают вокруг тебя — бьют и замораживают' },
        { count: 2, dmg: 54, radius: 80, freeze: 600, cooldown: 1050, offset: [40, 160] },
        { count: 3, dmg: 68, radius: 86, freeze: 700, cooldown: 1000, offset: [40, 170] },
        { count: 4, dmg: 84, radius: 92, freeze: 800, cooldown: 920, offset: [40, 180] },
        { count: 5, dmg: 100, radius: 98, freeze: 900, cooldown: 850, offset: [40, 190] }
      ],
      evolutions: [
        { name: 'Ледяное сердце', desc: 'Сфера над головой копит силу и выпускает 10 сосулек, каждая прошивает линию врагов насквозь', type: 'radialvolley', level6: { count: 10, dmg: 52, pierce: 999, life: 1500, cooldown: 2800, scale: 1.9, charge: 600, projTex: 'tex-icicle' } },
        { name: 'Чёрный лёд', desc: 'Постоянная область вокруг тебя, ощутимо замедляет врагов', type: 'slowarea', level6: { radius: 210, slowMult: 0.65, duration: 2000, cooldown: 1500 } },
        { name: 'Иний', desc: 'Иний оседает на крупном враге: зона замедляет, все в ней получают на 20% больше урона и понемногу тают', type: 'markzone', level6: { radius: 150, amp: 1.2, slowMult: 0.75, slowMs: 1200, pctMaxHp: 0.015, tickMs: 900, duration: 5000, cooldown: 4000 } }
      ]
    },
    fire: {
      name: 'Огонь', color: 0xff7a3d, element: 'fire', type: 'trailshot',
      levels: [null,
        { dmg: 42, pierce: 0, cooldown: 1100, trailDmg: 10, trailTicks: 5, trailGap: 26, tickMs: 380, summary: 'Огненная стрела оставляет за собой горящий след' },
        { dmg: 54, pierce: 0, cooldown: 1050, trailDmg: 12, trailTicks: 6, trailGap: 26, tickMs: 360 },
        { dmg: 68, pierce: 1, cooldown: 1000, trailDmg: 15, trailTicks: 6, trailGap: 24, tickMs: 340 },
        { dmg: 85, pierce: 1, cooldown: 920, trailDmg: 18, trailTicks: 7, trailGap: 24, tickMs: 320 },
        { dmg: 102, pierce: 2, cooldown: 850, trailDmg: 22, trailTicks: 8, trailGap: 22, tickMs: 300 }
      ],
      evolutions: [
        { name: 'Залп стрел', desc: '10 огненных стрел разлетаются во все стороны, каждая оставляет след', type: 'radialvolley', level6: { count: 10, dmg: 40, pierce: 1, cooldown: 3800, stagger: 175, trailDmg: 10, trailTicks: 3, trailGap: 26, tickMs: 380 } },
        { name: 'Драконьи стрелы', desc: 'Две огромные стрелы уходят вперёд и назад, прошивая насквозь всех на пути', type: 'dragon', level6: { dmg: 280, speed: 620, cooldown: 3600, tex: 'tex-dragon', halfThickness: 190, halfLength: 30, fromPlayer: true } },
        { name: 'Солнце', desc: 'Солнце висит над тобой и волнами выжигает всё вокруг', type: 'aura', color: 0xffb52e, level6: { dmg: 42, radius: 130, tickMs: 460, duration: 3600, cooldown: 3600 } }
      ]
    },
    lightning: {
      name: 'Молния', color: 0xf5e14a, element: 'lightning', type: 'chain',
      levels: [null,
        { dmg: 42, cooldown: 1500, chainCount: 3, chainRadius: 150, falloff: CHAIN_FALLOFF, summary: 'Молния бьёт ближайшего врага и перескакивает по цепи на соседних' },
        { dmg: 55, cooldown: 1400, chainCount: 4, chainRadius: 160, falloff: CHAIN_FALLOFF },
        { dmg: 70, cooldown: 1280, chainCount: 5, chainRadius: 170, falloff: CHAIN_FALLOFF },
        { dmg: 88, cooldown: 1150, chainCount: 6, chainRadius: 185, falloff: CHAIN_FALLOFF },
        { dmg: 108, cooldown: 1050, chainCount: 7, chainRadius: 200, falloff: CHAIN_FALLOFF }
      ],
      evolutions: [
        { name: 'Разряд смерти', desc: 'Каждый убитый враг лопается разрядом: цепь бьёт по тем, кто стоял рядом', type: 'deathspark', level6: { dmg: 55, chainCount: 3, chainRadius: 145, falloff: [1, 0.6, 0.4], cooldown: 999999 } },
        { name: 'Гнев небес', desc: '8 молний бьют с неба по случайным врагам на экране, каждая расходится дальней цепью', type: 'multichain', level6: { dmg: 340, cooldown: 6500, chainCount: 6, chainRadius: 340, strikes: 8, falloff: [1, 0.8, 0.6, 0.45, 0.35, 0.28] } },
        { name: 'Цепная реакция', desc: 'Каждое другое твоё заклинание дополнительно бьёт цепной молнией', type: 'reactionproc', level6: { dmg: 100, chainCount: 10, chainRadius: 150, falloff: [1, 0.8, 0.65, 0.5, 0.4, 0.3, 0.24, 0.19, 0.15, 0.12] } }
      ]
    },
    blast: {
      name: 'Взрыв', color: 0xffa23d, element: 'fire', type: 'delayedblast',
      levels: [null,
        { dmg: 60, count: 1, cooldown: 1600, radius: 84, speed: 580, summary: 'Летит молча в ближайшего врага и взрывается в цели' },
        { dmg: 75, count: 1, cooldown: 1500, radius: 90, speed: 580 },
        { dmg: 95, count: 2, cooldown: 1400, radius: 98, speed: 600 },
        { dmg: 118, count: 2, cooldown: 1300, radius: 108, speed: 600 },
        { dmg: 140, count: 2, cooldown: 1200, radius: 118, speed: 620 }
      ],
      evolutions: [
        { name: 'Термоядерный взрыв', desc: 'Вспышка стирает с карты всех обычных, усиленных и элитных; боссам сносит треть здоровья', type: 'nukeglobal', level6: { pctHeavy: 0.45, cooldown: 40000 } },
        { name: 'Имплозия', desc: 'Слабый урон, но мощно стягивает врагов в одну точку вдали от тебя', type: 'pull', level6: { dmg: 40, radius: 300, range: 340, pull: 220, speed: 560, cooldown: 3800 } },
        { name: 'Иерихон', desc: '10 ракет уходят по случайным целям вокруг тебя и рвутся при попадании', type: 'volleyburst', level6: { dmg: 155, radius: 125, range: 280, speed: 600, cooldown: 5500, count: 10, projTex: 'tex-rocket' } }
      ]
    },
    earth: {
      name: 'Землетрясение', color: 0xd9b35c, element: 'earth', type: 'area',
      levels: [null,
        { dmg: 52, radius: 138, cooldown: 1400, offset: [80, 200], summary: 'Земля вздрагивает рядом с тобой и бьёт всех в области удара' },
        { dmg: 68, radius: 163, cooldown: 1340, offset: [80, 210] },
        { dmg: 88, radius: 188, cooldown: 1280, offset: [80, 220] },
        { dmg: 112, radius: 213, cooldown: 1220, offset: [80, 230] },
        { dmg: 140, radius: 238, cooldown: 1150, offset: [80, 240] }
      ],
      evolutions: [
        { name: 'Валуны', desc: 'Валуны падают вокруг тебя, оглушая и калеча всё под собой', type: 'multiburst', level6: { count: 5, dmg: 70, radius: 95, freeze: 1300, cooldown: 2200, offset: [50, 190] } },
        { name: 'Разлом', desc: 'Земля лопается длинной трещиной до края экрана, стягивает к ней врагов и рвёт их по доле здоровья', type: 'rift', level6: { pctMaxHp: 0.5, pctHeavy: 0.12, halfWidth: 62, windup: 480, pull: 90, pullBand: 4, cooldown: 12000 } },
        { name: 'Дрожь', desc: 'Каждый твой шаг отдаётся ударной волной — чем быстрее бежишь, тем чаще; чем больше задело, тем больнее', type: 'tremor', level6: { dmg: 18, perEnemy: 7, radius: 260, stepDist: 210, cooldown: 999999 } }
      ]
    },
    metal: {
      name: 'Металлические шипы', color: 0xb9c2d0, element: 'metal', type: 'zone',
      levels: [null,
        { dmg: 32, radius: 85, tickMs: 520, duration: 3000, cooldown: 2600, offset: [70, 180], summary: 'Неподалёку от тебя из земли лезут шипы и рвут всех, кто попал в них' },
        { dmg: 41, radius: 95, tickMs: 510, duration: 3200, cooldown: 2500, offset: [70, 190] },
        { dmg: 53, radius: 108, tickMs: 500, duration: 3400, cooldown: 2400, offset: [70, 200] },
        { dmg: 67, radius: 118, tickMs: 490, duration: 3600, cooldown: 2350, offset: [70, 210] },
        { dmg: 84, radius: 126, tickMs: 480, duration: 3800, cooldown: 2350, offset: [70, 220] }
      ],
      evolutions: [
        { name: 'Монументы', desc: '6 столбов вырастают из земли, пять секунд бьют долей здоровья и держат врагов замедленными', type: 'monuments', level6: { count: 6, pctMaxHp: 0.05, dmg: 20, radius: 95, orbit: 165, duration: 3000, tickMs: 700, slowMult: 0.5, slowMs: 900, cooldown: 9000 } },
        { name: 'Стена', desc: 'Две тяжёлые стены встают перед тобой: враги не проходят сквозь них, пока не разобьют', type: 'wall', level6: { hp: 700, duration: 9000, cooldown: 8000, length: 200, dist: 100, spread: 0.85, block: 26 } },
        { name: 'Пила', desc: 'Две пилы расходятся в стороны и обходят тебя по кругу, вгрызаясь в каждого на пути', type: 'saw', level6: { dmg: 60, pctMaxHp: 0.08, orbit: 150, radius: 42, spin: 3.4, cooldown: 2200 } }
      ]
    },
    lava: {
      name: 'Лава', color: 0xff5a1f, element: 'fire', type: 'zone',
      levels: [null,
        { pctMaxHp: 0.030, dmg: 12, radius: 100, tickMs: 620, duration: 3000, count: 1, cooldown: 3600, offset: [130, 300], summary: 'Лужи лавы разливаются рядом с тобой и выжигают долю здоровья у всех, кто в них стоит' },
        { pctMaxHp: 0.040, dmg: 16, radius: 108, tickMs: 620, duration: 4000, count: 1, cooldown: 3600, offset: [130, 300] },
        { pctMaxHp: 0.050, dmg: 21, radius: 116, tickMs: 620, duration: 5000, count: 1, cooldown: 3600, offset: [130, 310] },
        { pctMaxHp: 0.062, dmg: 26, radius: 124, tickMs: 620, duration: 6000, count: 2, cooldown: 3600, offset: [130, 310] },
        { pctMaxHp: 0.075, dmg: 32, radius: 130, tickMs: 620, duration: 7000, count: 2, cooldown: 3600, offset: [130, 320] }
      ],
      evolutions: [
        { name: 'Вулкан', desc: 'Вместо долгой лужи — короткие извержения, но бьют втрое больнее', type: 'zone', level6: { pctMaxHp: 0.20, dmg: 45, radius: 135, tickMs: 380, duration: 1500, count: 4, cooldown: 4000, offset: [90, 260] } },
        { name: 'Ядро', desc: 'Раскалённое ядро тяжело вращается вокруг тебя и сминает всё, до чего дотянется', type: 'core', onPick: () => spawnLavaCore(), level6: { dmg: 120, pctMaxHp: 0.04, orbit: 165, radius: 54, spin: 2.8, rehit: 600, cooldown: 999999 } },
        { name: 'Метеоритный дождь', desc: 'Небо роняет вокруг тебя десяток метеоров — каждый бьёт по площади', type: 'meteors', level6: { count: 16, dmg: 38, pctMaxHp: 0.03, radius: 76, offset: [60, 340], windup: 480, cooldown: 5000 } }
      ]
    },
    airbullet: {
      name: 'Воздушная пуля', color: 0xbfe9ff, element: 'air', type: 'volley',
      levels: [null,
        { count: 1, dmg: 36, pierce: 0, cooldown: 1000, projTex: 'tex-bullet', summary: 'Быстрая воздушная пуля летит в ближайшего врага' },
        { count: 2, dmg: 46, pierce: 0, cooldown: 960, projTex: 'tex-bullet' },
        { count: 3, dmg: 58, pierce: 1, cooldown: 920, projTex: 'tex-bullet' },
        { count: 4, dmg: 72, pierce: 1, cooldown: 880, projTex: 'tex-bullet' },
        { count: 5, dmg: 90, pierce: 2, cooldown: 850, projTex: 'tex-bullet' }
      ],
      evolutions: [
        { name: 'Пушка', desc: 'Плотный поток воздуха идёт вперёд, расталкивая всех с дороги', type: 'forwardvolley', level6: { count: 1, dmg: 90, pierce: 8, cooldown: 1600, knockback: 150, scale: 1.5, projTex: 'tex-gust', alpha: 0.55 } },
        { name: 'Разрез', desc: 'Вместо пуль — режущие волны вперёд: узкие у тебя и широкие вдали', type: 'slash', level6: { count: 5, dmg: 120, speed: 560, life: 900, w0: 30, w1: 150, gap: 140, cooldown: 2800 } },
        { name: 'Святая пуля', desc: 'Тяжёлые очищающие пули пронзают отряд насквозь и снимают с врагов усиления', level6: { count: 5, dmg: 125, pierce: 8, cooldown: 700, dispel: true, projTex: 'tex-bullet' } }
      ]
    },
    barrier: {
      name: 'Барьер', color: 0x8fd6ff, element: 'none', type: 'barrier',
      levels: [null,
        { absorb: 1, cooldown: 10000, summary: 'Щит поглощает следующий удар по тебе' },
        { absorb: 2, cooldown: 9200 },
        { absorb: 3, cooldown: 8400 },
        { absorb: 4, cooldown: 7500 },
        { absorb: 5, cooldown: 6500 }
      ],
      evolutions: [
        { name: 'Отражающий барьер', desc: 'Каждый поглощённый удар с силой отбрасывает нападающего', level6: { absorb: 5, cooldown: 8000, repel: 200 } },
        { name: 'Неуязвимость', desc: '5 секунд полной неуязвимости, но твой урон на это время ниже', type: 'invuln', level6: { cooldown: 20000, duration: 5000, dmgPenalty: 0.2 } },
        { name: 'Лёгкость', desc: 'Быстрее, злее и с меньшей перезарядкой — но здоровья меньше', type: 'passive', onPick: () => { stats.moveSpeed = Math.round(stats.moveSpeed * 1.2); globalDmgMult += 0.1; globalCooldownMult = Math.max(0.5, globalCooldownMult - 0.1); stats.maxHp = Math.round(stats.maxHp * 0.9); playerHp = Math.min(playerHp, stats.maxHp); }, level6: { cooldown: 999999 } }
      ]
    }
  };
  // ---- Слияния: две эволюции 10 уровня складываются в одну новую способность.
  // Таблица расширяемая: чтобы добавить комбинацию, достаточно дописать сюда запись
  // и заклинание в WEAPONS с hidden:true (оно кастуется, но никогда не предлагается
  // в обычном выборе). Слияние доступно только после третьей арены — там открывается
  // прокачка эволюций до 10.
  const FUSIONS = {
    frostwaste: {
      name: 'Ледяная пустыня', result: 'fz_waste',
      need: [{ id: 'fire', evo: 2 }, { id: 'frost', evo: 0 }],
      desc: 'Солнце промерзает: вокруг тебя навсегда ложится ледяная пустошь. Она жжёт холодом, почти останавливает всех внутри и делает их уязвимее к любому урону.'
    },
    skystrike: {
      name: 'Небесный удар', result: 'sk_strike',
      need: [{ id: 'blast', evo: 2 }, { id: 'lightning', evo: 1 }],
      desc: 'Ракетный залп и небесная артиллерия бьют одним приказом: ракеты уходят по целям, а следом в тех же точках встают молнии.'
    },
    avalanche: {
      name: 'Обвал', result: 'av_fall',
      need: [{ id: 'wave', evo: 0 }, { id: 'earth', evo: 0 }],
      desc: 'Волна поднимает и роняет каменный вал: тяжёлые удары по всей округе, всех задетых глушит.'
    }
  };
  const FUSION_IDS = Object.keys(FUSIONS);

  // Результаты слияний. hidden:true — кастуются, но в выборе прокачки не появляются.
  WEAPONS.fz_waste = {
    name: 'Ледяная пустыня', color: 0x9fe8ff, type: 'aura', hidden: true,
    levels: [null, { dmg: 95, radius: 200, tickMs: 380, duration: 6000, cooldown: 6000, slowMult: 0.45, slowMs: 1200, amp: 1.25, summary: 'Постоянная ледяная пустошь вокруг тебя' }],
    evolutions: []
  };
  WEAPONS.sk_strike = {
    name: 'Небесный удар', color: 0xf5e14a, type: 'skystrike', hidden: true,
    levels: [null, { dmg: 165, radius: 130, range: 300, speed: 620, count: 12, strikes: 6, chainCount: 3, chainRadius: 130, falloff: [1, 0.55, 0.35], cooldown: 4600, projTex: 'tex-rocket', summary: 'Ракетный залп с добиванием молниями' }],
    evolutions: []
  };
  WEAPONS.av_fall = {
    name: 'Обвал', color: 0xd9b35c, type: 'multiburst', hidden: true,
    levels: [null, { count: 7, dmg: 210, radius: 130, freeze: 1600, cooldown: 3200, offset: [60, 260], summary: 'Каменный вал бьёт по всей округе и глушит' }],
    evolutions: []
  };

  const WEAPON_IDS = Object.keys(WEAPONS);
  const ACTIVE_WEAPON_IDS = WEAPON_IDS.filter((id) => !WEAPONS[id].hidden);

  // Классы персонажа (2026-09-11). Огню хватает своих 3 заклинаний (fire/blast/lava —
  // все уже element:'fire'); Лёд/Вода/Воздух добирают до 3 заимствованием у элементов без
  // своего класса (blood/earth/lightning/metal/none) — заклинаний ровно 8 небазовых на
  // 3 класса по 2 слота, поэтому Барьер (нейтральная защита) закономерно достаётся двум.
  // weapons[0] — стартовое заклинание класса (owned на старте забега).
  // ВАЖНО: класс — эксклюзивный пул на весь забег (collectCandidates фильтрует им ACTIVE_WEAPON_IDS).
  // Побочный эффект: слияния «Ледяная пустыня» (fire+frost) и «Небесный удар» (blast+lightning)
  // требуют пары из РАЗНЫХ классов и больше не собираются внутри одного забега — это
  // структурно неизбежно (fire всегда в Пиромантах, остальные элементы — нет). «Обвал»
  // (wave+earth) остаётся живым — оба в классе Вода.
  // skin — палитра процедурного плейсхолдер-спрайта персонажа на класс (см.
  // makeClassPlayerTexture в game.html); заменяется целиком, если пользователь пришлёт
  // свой арт под конвенцию CUSTOM_ASSETS (тогда красится вместо этого общим тинтом color).
  const CLASSES = {
    fire: {
      name: 'Пиромант', color: 0xff7a3d,
      desc: 'Огонь, взрыв, лава — чистый урон и выжженная земля.',
      weapons: ['fire', 'blast', 'lava'],
      skin: { cloak: 0x6e2a1a, hood: 0xe0592a, gem: 0xff7a3d, ring: 0xffcf9e }
    },
    ice: {
      name: 'Лёд', color: 0x9fe8ff,
      desc: 'Лёд, металлические шипы, барьер — контроль и защита.',
      weapons: ['frost', 'metal', 'barrier'],
      skin: { cloak: 0x1f4a63, hood: 0x6fd3f0, gem: 0x9fe8ff, ring: 0xeafeff }
    },
    water: {
      name: 'Вода', color: 0x4fb8e0,
      desc: 'Волна, кровь, землетрясение — течение и порабощение.',
      weapons: ['wave', 'charm', 'earth'],
      skin: { cloak: 0x123a52, hood: 0x2f8fc2, gem: 0x4fb8e0, ring: 0xcdeeff }
    },
    air: {
      name: 'Воздух', color: 0xbfe9ff,
      desc: 'Воздушная пуля, молния, барьер — скорость и шторм.',
      weapons: ['airbullet', 'lightning', 'barrier'],
      skin: { cloak: 0x3c4a4a, hood: 0xbfe9df, gem: 0xbfe9ff, ring: 0xffffff }
    }
  };
  const CLASS_IDS = Object.keys(CLASSES);
