// Перенесено из src/game.html при реструктуризации 1.0.9 — правки идут прямо сюда.
// Собирается обратно в игру через src/game.html: /* @include data/enemies.js */ (см. assemble.js).

  const ENEMY_SPEED = 88;
  const ENEMY_BASE_HP = 200;
  const ENEMY_CONTACT_DAMAGE = 10;
  const ENEMY_CONTACT_COOLDOWN = 700;
  // Кулдаун контактного урона общий на всех врагов, иначе толпа убивала бы мгновенно.
  // Но и обратная крайность неверна: 80 врагов вплотную не должны бить как один. Урон
  // одного удара растёт от того, сколько тел реально навалилось.
  const CONTACT_STACK_STEP = 0.07;
  const CONTACT_STACK_MAX = 2.5;
  const ENEMY_SPAWN_RADIUS = 620;
  const ENEMY_LEASH_RADIUS = 1300;

  // Пять категорий врагов. Всё задано множителями от базового врага, чтобы правился
  // один ENEMY_BASE_HP, а не двадцать чисел. heavy — не отбрасывается и не стягивается.
  const ENEMY_TIERS = {
    normal:   { tex: 'tex-enemy',    radius: 10, hp: 1,  dmg: 1,   speed: 1,    orb: 'small' },
    enhanced: { tex: 'tex-enhanced', radius: 13, hp: 3,  dmg: 1.3, speed: 1,    orb: 'medium' },
    elite:    { tex: 'tex-elite',    radius: 16, hp: 5,  dmg: 1.6, speed: 0.95, orb: 'large' },
    miniboss: { tex: 'tex-miniboss', radius: 22, hp: 10, dmg: 2,   speed: 0.8,  xpPct: 0.25, xpMin: 45, heavy: true },
    boss:     { tex: 'tex-boss',     radius: 28, hp: 4,  dmg: 2.5, speed: 0.72, xpPct: 0.5,  xpMin: 90,  heavy: true, slamMs: 3600, slamRadius: 150, slamDmg: 18 },
    // Древний страж выходит на третьей арене: крупнее, живучее и бьёт по площади чаще
    // и дальше — этот бой должен ощущаться рубежом, а не третьим одинаковым боссом.
    elder:    { tex: 'tex-elder',    radius: 40, hp: 9,  dmg: 3.2, speed: 0.62, xpPct: 1.0, xpMin: 260, heavy: true, slamMs: 2600, slamRadius: 230, slamDmg: 28 }
  };
  // Шанс уронить кристалл жизни. Редкий у рядовых, гарантированный у мини-босса —
  // чтобы после ошибки можно было отыграться, но не стоять в толпе бесконечно.
  const HP_ORB_CHANCE = { normal: 0.030, enhanced: 0.10, elite: 0.20, miniboss: 1, boss: 0.5 };
  const HP_ORB_HEAL_PCT = 0.12;
  // Шанс с убийства сам по себе превращается в бесконечное лечение, когда билд убивает
  // десятками в секунду: 3% от 50 убийств — это полтора кристалла в секунду. Поэтому
  // сверх шанса стоит глобальный интервал — лечение остаётся спасением после ошибки,
  // а не заменой умению уворачиваться.
  const HP_ORB_MIN_INTERVAL_MS = 9000;
  let lastHpOrbAt = -99999;

  // Размер кристалла сразу показывает, с кого он упал.
  // Опыт за убийство растёт вместе с силой врагов: иначе к третьей минуте убийство
  // стоит втрое дороже, а даёт столько же, и прокачка встаёт намертво.
  const XP_SCALE_CAP = 3.5;
  function xpScale(){ return Math.max(1, Math.min(XP_SCALE_CAP, enemyHpMult())); }

  const XP_ORBS = {
    small:  { value: 8,  scale: 1,    tint: 0xd9b35c },
    medium: { value: 24, scale: 1.35, tint: 0x9fe8ff },
    large:  { value: 45, scale: 1.7,  tint: 0xd67ee0 }
  };

  // Отдельного расписания у элиты и мини-боссов больше нет: они появляются только
  // в событиях (Разлом) и на арене босса. Усиленные подмешиваются в обычную волну
  // долей ENHANCED_SHARE_CURVE.


  // Сложность задаётся КРИВЫМИ по времени забега, а не линейной формулой: линейная
  // не позволяла одновременно смягчить старт и оставить тяжёлый поздний забег — любая
  // правка тянула за собой всю шкалу. Точки — [мс забега, множитель], между ними линейно.
  // Первые две минуты сознательно мягкие: игрок должен успевать убивать, собирать опыт
  // и возвращаться за брошенными кристаллами, а не бежать без остановки.
  const ENEMY_HP_CURVE    = [[0, 0.42], [60000, 0.58], [120000, 0.82], [180000, 1.10], [300000, 1.55], [360000, 1.95], [600000, 4.0], [900000, 7.4], [1200000, 12.0], [1500000, 18.0], [1800000, 26.0]];
  const ENEMY_DMG_CURVE   = [[0, 0.60], [60000, 0.72], [120000, 0.88], [180000, 1.00], [300000, 1.22], [360000, 1.42], [600000, 2.35], [900000, 3.3], [1200000, 4.4], [1500000, 5.6], [1800000, 7.0]];
  const ENEMY_SPEED_CURVE = [[0, 0.78], [60000, 0.84], [120000, 0.90], [240000, 0.98], [420000, 1.05], [720000, 1.22], [1080000, 1.42], [1500000, 1.62]];
  const ENEMY_CAP_CURVE   = [[0, 40], [60000, 85], [120000, 145], [180000, 210], [300000, 320], [480000, 430], [720000, 520], [1200000, 600], [1800000, 680]];
  const SPAWN_MS_CURVE    = [[0, 1200], [60000, 780], [120000, 520], [180000, 390], [300000, 250], [480000, 150], [720000, 100], [1200000, 62], [1800000, 45]];
  // Доля усиленных в обычной волне. Рядовые обязаны оставаться основой толпы даже
  // в поздней игре, поэтому доля растёт медленно и упирается в потолок.
  const ENHANCED_SHARE_CURVE = [[0, 0], [30000, 0.03], [90000, 0.06], [180000, 0.10], [300000, 0.16], [600000, 0.26], [900000, 0.32], [1500000, 0.38]];

  const MAX_ENEMIES_HARD = 700;                  // потолок ради производительности
  const ENEMY_LEVEL_SCALING = 0.02;              // +2% HP за уровень игрока
  // Ступень после каждой зачищенной арены. Шаг НАРАСТАЮЩИЙ (waveLevel^WAVE_STEP_POW):
  // первые арены почти не давят, а к 20-й минуте накопленный множитель уже основной
  // источник сложности. Плоский шаг делал 4-ю минуту стеной, а 20-ю всё равно лёгкой.
  const WAVE_STEP_POW = 1.5;
  const WAVE_HP_STEP = 0.16;
  const WAVE_DMG_STEP = 0.10;
  const WAVE_SPEED_STEP = 0.03;
  const WAVE_DENSITY_STEP = 0.11;
  const ENEMY_SPEED_MAX_MULT = 1.75;             // потолок: враг не должен догонять игрока

  function sampleCurve(points, t){
    if (t <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++){
      if (t <= points[i][0]){
        const [t0, v0] = points[i - 1], [t1, v1] = points[i];
        return Phaser.Math.Linear(v0, v1, (t - t0) / (t1 - t0));
      }
    }
    return points[points.length - 1][1];
  }

  function waveMult(step){ return 1 + step * Math.pow(waveLevel, WAVE_STEP_POW); }
  function enemyHpMult(){
    return sampleCurve(ENEMY_HP_CURVE, runMs) * (1 + level * ENEMY_LEVEL_SCALING) * waveMult(WAVE_HP_STEP);
  }
  function enemyDmgMult(){
    return sampleCurve(ENEMY_DMG_CURVE, runMs) * waveMult(WAVE_DMG_STEP);
  }
  function enemySpeedMult(){
    return Math.min(ENEMY_SPEED_MAX_MULT, sampleCurve(ENEMY_SPEED_CURVE, runMs) * waveMult(WAVE_SPEED_STEP));
  }
  function enemyCap(){
    return Math.round(Math.min(MAX_ENEMIES_HARD, sampleCurve(ENEMY_CAP_CURVE, runMs) * waveMult(WAVE_DENSITY_STEP)));
  }
  function spawnIntervalMs(){
    return sampleCurve(SPAWN_MS_CURVE, runMs) / waveMult(WAVE_DENSITY_STEP);
  }
