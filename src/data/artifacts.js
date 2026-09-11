// Перенесено из src/game.html при реструктуризации 1.0.9 — правки идут прямо сюда.
// Собирается обратно в игру через src/game.html: /* @include data/artifacts.js */ (см. assemble.js).

  // ── АРТЕФАКТЫ (1.0.5) ────────────────────────────────────────────────
  // Единый пул, 5 редкостей. Разлом роняет common/uncommon, арена босса — rare+/legendary.
  // Числа стартовые, правятся по телеметрии. Названия/эффекты оригинальные (не Magic Survival).
  const ART_CAP = { dmg: 0.60, speed: 0.50, cd: 0.40, hp: 0.60 };
  let artDmgSpent = 0, artSpeedSpent = 0, artCdSpent = 0, artHpSpent = 0;
  let artElem = { fire: 0, ice: 0, lightning: 0, earth: 0, air: 0, water: 0, blood: 0, metal: 0 };
  let artHooks = {};
  let artKillCount = 0, artKillDmg = 0, artHarvest = [], artHarvestBonus = 0;
  let artNearCount = 0, artNearClose = 0, artHpPct = 1, artMoving = false;
  let lastSecondBreathAt = -99999, lastRetaliateAt = -99999, lastStopframeAt = -99999, artLastResortUsed = false;

  function bumpDmg(x, over){ const a = over ? x : Math.min(x, ART_CAP.dmg - artDmgSpent); if (!over && a > 0) artDmgSpent += a; globalDmgMult += a; }
  function bumpSpeed(x){ const a = Math.min(x, ART_CAP.speed - artSpeedSpent); if (a > 0) artSpeedSpent += a; stats.moveSpeed += Math.round(PLAYER_SPEED * a); }
  function bumpCd(x){ const a = Math.min(x, ART_CAP.cd - artCdSpent); if (a > 0) artCdSpent += a; globalCooldownMult = Math.max(0.5, globalCooldownMult - a); }
  function bumpHp(x){ let a = x; if (x > 0){ a = Math.min(x, ART_CAP.hp - artHpSpent); artHpSpent += a; } stats.maxHp = Math.max(25, stats.maxHp + Math.round(100 * a)); playerHp = x > 0 ? stats.maxHp : Math.min(playerHp, stats.maxHp); }
  function weaponElement(src){ const w = WEAPONS[src]; return w && w.element; }

  const R = { c: 'common', u: 'uncommon', r: 'rare', e: 'epic', l: 'legendary' };
  const LOOT = {
    // COMMON — простые статы с потолком
    warbrace:  { name: 'Наручи войны',   rarity: R.c, color: 0xe2495c, desc: '+8% урона всех атак', apply: () => bumpDmg(0.08) },
    swiftboot: { name: 'Быстрые сапоги',  rarity: R.c, color: 0x4fb8e0, desc: '+8% скорости передвижения', apply: () => bumpSpeed(0.08) },
    stoneheart:{ name: 'Каменное сердце', rarity: R.c, color: 0xffb9c2, desc: '+12% макс. HP', apply: () => bumpHp(0.12) },
    focuslens: { name: 'Линза фокуса',    rarity: R.c, color: 0xd94f4f, desc: '+5% шанс крита', apply: () => { stats.critChance += 0.05; } },
    keenedge:  { name: 'Острая грань',    rarity: R.c, color: 0xd67ee0, desc: '+25% множитель крита', apply: () => { stats.critMult += 0.25; } },
    callcharm: { name: 'Талисман зова',   rarity: R.c, color: 0x55d6c2, desc: '+22 радиус подбора опыта', apply: () => { stats.pickupRadius += 22; } },
    huntmark:  { name: 'Метка охоты',     rarity: R.c, color: 0xc9a15a, desc: '+6% опыта с обычных кристаллов', apply: () => { xpValueMult += 0.06; } },
    emberstone:{ name: 'Уголёк',          rarity: R.c, color: 0xff7a3d, desc: 'Огненные заклинания +14% урона', apply: () => { artElem.fire += 0.14; } },
    frostpane: { name: 'Гранёный иней',   rarity: R.c, color: 0x9fe8ff, desc: 'Ледяные заклинания +14% урона', apply: () => { artElem.ice += 0.14; } },
    stormcore: { name: 'Грозовое ядро',   rarity: R.c, color: 0xf5e14a, desc: 'Молния +14% урона', apply: () => { artElem.lightning += 0.14; } },
    tremorstn: { name: 'Камень дрожи',    rarity: R.c, color: 0xd9b35c, desc: 'Земляные заклинания +14% урона', apply: () => { artElem.earth += 0.14; } },
    galefeath: { name: 'Перо шквала',     rarity: R.c, color: 0xbfe9ff, desc: 'Воздушные заклинания +14% урона', apply: () => { artElem.air += 0.14; } },
    quickwind: { name: 'Скорый ветер',    rarity: R.c, color: 0x9fe8ff, desc: '-5% перезарядки всех заклинаний', apply: () => bumpCd(0.05) },
    longburn:  { name: 'Долгий жар',      rarity: R.c, color: 0xff5a1f, desc: '+10% длительности областей и контроля', apply: () => { globalDurationMult += 0.10; } },
    wardcloak: { name: 'Плащ-оберег',     rarity: R.c, color: 0x2f6e64, desc: '+8% шанс уклониться', apply: () => { stats.evasion += 0.08; } },

    // UNCOMMON — статы с условием / разменом
    runrhythm: { name: 'Ритм бегуна',     rarity: R.u, color: 0xbfe9ff, desc: 'Пока движешься — -7% перезарядки', apply: () => { artHooks.runnersrhythm = true; } },
    finisher:  { name: 'Добивающий',      rarity: R.u, color: 0xe0384f, desc: '+22% урона по врагам ниже 30% HP', apply: () => { artHooks.finisher = true; } },
    lonewolf:  { name: 'Одинокий волк',   rarity: R.u, color: 0x55d6c2, desc: 'Врагов рядом меньше 4 → +15% урона', apply: () => { artHooks.lonewolf = true; } },
    crowdpush: { name: 'Давление толпы',  rarity: R.u, color: 0xe2495c, desc: 'За каждого врага рядом сверх 5: +1.6% урона, до +18%', apply: () => { artHooks.crowdpressure = true; } },
    glasscann: { name: 'Стеклянная пушка',rarity: R.u, color: 0xff7a3d, desc: '+14% урона, -10% макс. HP', apply: () => { bumpDmg(0.14); bumpHp(-0.10); } },
    tempo:     { name: 'Темп',            rarity: R.u, color: 0xf5e14a, desc: '-8% перезарядки, но +10% урона врагов по тебе', apply: () => { bumpCd(0.08); artHooks.tempo = true; } },
    soloward:  { name: 'Оберег одиночки', rarity: R.u, color: 0x8fd6ff, desc: 'Нет врагов вплотную → -20% получаемого урона', apply: () => { artHooks.soloward = true; } },
    coldbite:  { name: 'Холодный укус',   rarity: R.u, color: 0x9fe8ff, desc: '+15% твоего урона по замедленным врагам', apply: () => { artHooks.coldbite = true; } },
    bloodint:  { name: 'Кровавый долг',   rarity: R.u, color: 0xb02040, desc: 'За каждые 120 убийств +1% урона, до +12% (сброс на смерти)', apply: () => { artHooks.bloodinterest = true; } },
    harvest:   { name: 'Жатва',           rarity: R.u, color: 0xd9b35c, desc: 'За каждого убитого рядом за 2с: +2% урона, до +20%', apply: () => { artHooks.harvest = true; } },
    secondbr:  { name: 'Второе дыхание',  rarity: R.u, color: 0xffb9c2, desc: 'HP ниже 25% → щит. КД 40с', apply: () => { artHooks.secondbreath = true; } },
    retaliate: { name: 'Ответный удар',   rarity: R.u, color: 0x8fd6ff, desc: 'Получил урон → ближних отбрасывает. КД 5с', apply: () => { artHooks.retaliate = true; } },
    heavyhand: { name: 'Тяжёлая рука',    rarity: R.u, color: 0xffa23d, desc: 'Медленные и ульта-заклинания +15% урона', apply: () => { artHooks.heavyhand = true; } },
    duelist:   { name: 'Дуэлянт',         rarity: R.u, color: 0x8a4fd9, desc: '+25% урона по мини-боссам и боссам, -8% по обычным', apply: () => { artHooks.duelist = true; } },

    // RARE — формируют билд / заметный размен
    warlust:   { name: 'Жажда боя',       rarity: R.r, color: 0xe2495c, desc: '+18% урона, но -20% макс. HP', apply: () => { bumpDmg(0.18, true); bumpHp(-0.20); } },
    executio:  { name: 'Палач',           rarity: R.r, color: 0xe0384f, desc: '+35% урона по врагам ниже 40% HP', apply: () => { artHooks.executioner = true; } },
    frostbite: { name: 'Обморожение',     rarity: R.r, color: 0x9fe8ff, desc: '+25% твоего урона по замедленным (сильнее Холодного укуса)', apply: () => { artHooks.frostbite = true; } },
    berserker: { name: 'Берсерк',         rarity: R.r, color: 0xff5a1f, desc: 'Чем ниже HP, тем выше урон: до +30% при 25% HP', apply: () => { artHooks.berserker = true; } },

    // LEGENDARY — редкие переломные (только с арены босса)
    lastresor: { name: 'Последний рубеж', rarity: R.l, color: 0xffd700, desc: 'Смертельный урон оставит 1 HP + 1.5с неуязвимости. Один раз за забег', apply: () => { artHooks.lastresort = true; } },
    stopframe: { name: 'Стоп-кадр',       rarity: R.l, color: 0x8a4fd9, desc: 'HP ниже 15% → время врагов замирает на 2.5с. Раз в 60с', apply: () => { artHooks.stopframe = true; } },
    bloodpact: { name: 'Кровавый пакт',   rarity: R.l, color: 0xff4d6d, desc: '+40% урона, но -25% макс. HP', apply: () => { bumpDmg(0.40, true); bumpHp(-0.25); } }
  };
  const LOOT_IDS = Object.keys(LOOT);
  const RARITY_RU = { common: 'обычный', uncommon: 'необычный', rare: 'редкий', epic: 'эпический', legendary: 'легендарный' };
  const RIFT_POOL = LOOT_IDS.filter((id) => LOOT[id].rarity === 'common' || LOOT[id].rarity === 'uncommon');
  const BOSS_POOL = LOOT_IDS.filter((id) => LOOT[id].rarity === 'rare' || LOOT[id].rarity === 'epic' || LOOT[id].rarity === 'legendary');
  const COMMON_LOOT_IDS = RIFT_POOL;
  const ARTIFACT_LOOT_IDS = BOSS_POOL;

  // Множитель урона от артефактов, зависящий от цели / контекста (стихия по dmgSrc).
  function artDmgFactor(enemy){
    let f = 1;
    const el = weaponElement(dmgSrc);
    if (el && artElem[el]) f *= 1 + artElem[el];
    if (artHooks.lonewolf && artNearCount < 4) f *= 1.15;
    if (artHooks.crowdpressure) f *= 1 + Math.min(0.18, Math.max(0, artNearCount - 5) * 0.016);
    if (artHooks.harvest) f *= 1 + artHarvestBonus;
    if (artKillDmg) f *= 1 + artKillDmg;
    if (artHooks.berserker) f *= 1 + 0.30 * Math.max(0, Math.min(1, (1 - artHpPct) / 0.75));
    if (enemy){
      const hpFrac = enemy.hp / (enemy.maxHp || enemy.hp || 1);
      if (artHooks.finisher && hpFrac < 0.30) f *= 1.22;
      if (artHooks.executioner && hpFrac < 0.40) f *= 1.35;
      if (enemy.slowUntil && elapsedMs < enemy.slowUntil){
        if (artHooks.frostbite) f *= 1.25; else if (artHooks.coldbite) f *= 1.15;
      }
      if (artHooks.duelist) f *= enemy.heavy ? 1.25 : 0.92;
      if (artHooks.heavyhand){ const c = CD_CLASS[dmgSrc]; if (c === 'slow' || c === 'ultra') f *= 1.15; }
    }
    return f;
  }
  function dmgTakenMult(){
    let m = 1;
    if (artHooks.tempo) m *= 1.10;
    if (artHooks.soloward && artNearClose === 0) m *= 0.80;
    return m;
  }
  function updateArtRuntime(){
    artHpPct = playerHp / (stats.maxHp || 1);
    artMoving = !!(player.body && Math.abs(player.body.velocity.x) + Math.abs(player.body.velocity.y) > 12);
    if (artHooks.lonewolf || artHooks.crowdpressure || artHooks.soloward){
      let n = 0, nc = 0;
      enemies.children.each((e) => {
        if (!e.active || e.charmedUntil) return;
        const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
        if (d <= 140) n++;
        if (d <= 100) nc++;
      });
      artNearCount = n; artNearClose = nc;
    }
    if (artHooks.harvest){
      while (artHarvest.length && elapsedMs - artHarvest[0] > 2000) artHarvest.shift();
      artHarvestBonus = Math.min(0.20, artHarvest.length * 0.02);
    }
    if (artHooks.stopframe && artHpPct < 0.15 && elapsedMs - lastStopframeAt > 60000){
      activeBuffs.timestop = elapsedMs + 2500;
      lastStopframeAt = elapsedMs;
      showToast('Стоп-кадр');
    }
  }
  function onPlayerHurt(){
    if (artHooks.retaliate && elapsedMs - lastRetaliateAt > 5000){
      lastRetaliateAt = elapsedMs;
      enemies.children.each((e) => {
        if (!e.active || e.heavy) return;
        const d = Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y);
        if (d > 110) return;
        const a = Phaser.Math.Angle.Between(player.x, player.y, e.x, e.y);
        e.x += Math.cos(a) * 120; e.y += Math.sin(a) * 120;
        if (e.body) e.body.updateFromGameObject();
      });
      spawnPulseRing(player.x, player.y, 110, 0x8fd6ff);
    }
    if (artHooks.secondbreath && playerHp > 0 && playerHp / stats.maxHp < 0.25 && elapsedMs - lastSecondBreathAt > 40000){
      lastSecondBreathAt = elapsedMs;
      shieldCharges += 1;
      spawnPulseRing(player.x, player.y, 60, 0x8fd6ff);
    }
  }
  function reviveLastResort(){
    if (!artHooks.lastresort || artLastResortUsed) return false;
    artLastResortUsed = true;
    playerHp = 1;
    graceUntil = elapsedMs + 1500;
    scene.cameras.main.flash(300, 255, 240, 180);
    showToast('Последний рубеж');
    return true;
  }

  const BLESSINGS = {
    might:  { name: 'Малое благословение силы', desc: '+6% урона всех атак', color: 0xe2495c, apply: () => { globalDmgMult += 0.06; } },
    haste:  { name: 'Малое благословение спешки', desc: '−3% перезарядка способностей', color: 0x9fe8ff, apply: () => { globalCooldownMult = Math.max(0.5, globalCooldownMult - 0.03); } },
    life:   { name: 'Малое благословение жизни', desc: '+8 макс. HP и лечение', color: 0xffb9c2, apply: () => { stats.maxHp += 8; playerHp = Math.min(stats.maxHp, playerHp + 8); } },
    reach:  { name: 'Малое благословение зова', desc: '+10 радиус подбора опыта', color: 0x55d6c2, apply: () => { stats.pickupRadius += 10; } },
    swift:  { name: 'Малое благословение ветра', desc: '+4 скорость передвижения', color: 0xbfe9ff, apply: () => { stats.moveSpeed += 4; } }
  };
  const BLESSING_IDS = Object.keys(BLESSINGS);
