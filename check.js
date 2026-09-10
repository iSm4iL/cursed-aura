// Мини-проверка правил, которые ломаются молча. Запуск: node check.js
// (Ставится в пару к index.html, ничего не устанавливает.)
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/index.html', 'utf8');
const grab = (re, name) => {
  const m = src.match(re);
  if (!m) throw new Error('не нашёл в index.html: ' + name);
  return m;
};
const num = (re, name) => Number(grab(re, name)[1]);
const eq = (a, b, msg) => { if (a !== b) throw new Error(msg + ' → ' + JSON.stringify(a) + ' вместо ' + JSON.stringify(b)); };

// ---- 1. Хитбокс каждой категории врагов совпадает с нарисованным кружком.
// Тело ставится из ENEMY_TIERS[tier].radius, а рисуется makeCircleTexture — если числа
// разойдутся, враги начнут бить «издалека», и заметить это на глаз почти нельзя.
const tiers = {};
const tierRe = /(\w+):\s*\{ tex: '([\w-]+)',\s*radius: (\d+)/g;
let m;
while ((m = tierRe.exec(src))) tiers[m[1]] = { tex: m[2], radius: Number(m[3]) };
// Пять базовых категорий обязаны быть; сверх них допускаются особые (Древний страж).
['normal', 'enhanced', 'elite', 'miniboss', 'boss'].forEach((t) => {
  if (!tiers[t]) throw new Error('пропала категория врагов: ' + t);
});
Object.keys(tiers).forEach((name) => {
  const t = tiers[name];
  const texR = num(new RegExp("makeCircleTexture\\('" + t.tex + "', (\\d+)"), t.tex);
  eq(t.radius, texR, 'хитбокс ' + name + ' не совпал с текстурой ' + t.tex);
});

// ---- 2. Враг обязан дотягиваться до игрока.
// Он останавливается за ENEMY_STOP_DIST от центра игрока; если это больше суммы
// радиусов, тела не пересекаются и контактный урон не срабатывает вообще.
const playerR = num(/makeCircleTexture\('tex-player', (\d+)/, 'tex-player');
const stop = num(/const ENEMY_STOP_DIST = (\d+)/, 'ENEMY_STOP_DIST');
if (stop >= playerR + tiers.normal.radius) throw new Error('ENEMY_STOP_DIST ' + stop + ' >= радиусы ' + (playerR + tiers.normal.radius) + ': враги не смогут задеть игрока');

// ---- 3. Награда за мини-босса и босса не может быть меньше рядового кристалла.
// Доля от «опыта до уровня» на первых уровнях выходит смешной (25% от 24 = 6),
// поэтому у них есть пол xpMin — проверяем, что он не ниже крупного кристалла.
const largeOrb = num(/large:\s*\{ value: (\d+)/, 'XP_ORBS.large');
['miniboss', 'boss'].forEach((t) => {
  const min = num(new RegExp(t + ":[^\\n]*xpMin: (\\d+)"), t + '.xpMin');
  if (min < largeOrb) throw new Error(t + ': пол опыта ' + min + ' меньше крупного кристалла ' + largeOrb);
});

// ---- 4. Арена босса собрана по спеке: 2-5 боссов, подкрепление есть, раз в 3 минуты.
eq(num(/const BOSS_INTERVAL_MS = (\d+)/, 'BOSS_INTERVAL_MS'), 180000, 'босс должен приходить раз в 3 минуты');
const bMin = num(/const ARENA_BOSS_MIN = (\d+)/, 'ARENA_BOSS_MIN');
const bMax = num(/const ARENA_BOSS_MAX = (\d+)/, 'ARENA_BOSS_MAX');
if (!(bMin === 2 && bMax === 5)) throw new Error('в центре арены должно рождаться 2-5 боссов, а не ' + bMin + '-' + bMax);
if (num(/const ARENA_ENHANCED = (\d+)/, 'ARENA_ENHANCED') < 1) throw new Error('подкрепление усиленными пустое');
if (num(/const ARENA_NORMAL = (\d+)/, 'ARENA_NORMAL') < 1) throw new Error('подкрепление рядовыми пустое');
// Врагов внутри барьера удалять нельзя — игрок заперт вместе с ними (§33 спеки).
if (!/else e\.inArena = true;/.test(src)) throw new Error('потеряна пометка inArena для врагов внутри арены');

// ---- 5. Часы забега на арене стоят, механические — идут (§32).
if (!/if \(!bossActive\) runMs \+= delta;/.test(src)) throw new Error('таймер забега не останавливается на арене');
if (!/elapsedMs \+= delta;/.test(src)) throw new Error('механические часы должны идти всегда');

// ---- 6. Снаряд взрывается на первом же встречном, а не в конечной точке.
const R = num(/const BLAST_CONTACT_RADIUS = (\d+)/, 'BLAST_CONTACT_RADIUS');
function simulate(enemyAt){
  const dest = 200;
  let boom = null;
  for (let t = 0; t <= 1.0001; t += 1 / 60){
    const x = dest * Math.min(1, t);
    if (boom === null && enemyAt !== null && Math.abs(x - enemyAt) <= R) boom = Math.round(x);
  }
  return boom === null ? dest : boom;
}
if (Math.abs(simulate(100) - 100) > R) throw new Error('взрыв не там, где враг: ' + simulate(100));
eq(simulate(null), 200, 'без врага снаряд должен долететь до конца');

// ---- 7. Пауза не копит перезарядки: время в меню не засчитывается в откат.
const pausedAt = 5000, away = 30000;
let lastFired = 4000;
const waitedBefore = pausedAt - lastFired;
lastFired += away;
eq(pausedAt + away - lastFired, waitedBefore, 'пауза засчиталась в перезарядку');

// ---- 8. Эффекты «над игроком» обязаны ехать вместе с ним (§37).
['attachToPlayer', 'updateAttached'].forEach((fn) => {
  if (!src.includes('function ' + fn)) throw new Error('пропал механизм привязки: ' + fn);
});
// Сфера копится привязанной к игроку, но выпущенные сосульки обязаны стать
// самостоятельными — иначе они поедут за персонажем (§10 патча).
if (!/detachFromPlayer\(orb\)/.test(src)) throw new Error('сфера Ледяного сердца не отвязывается после выстрела');


// ---- 9. У каждого типа заклинания есть обработчик.
// Таблица WEAPONS задаёт поведение строкой type, а диспетчер в update() разбирает её
// цепочкой if. Забыть новую ветку — значит получить заклинание, которое молча не стреляет:
// ни ошибки, ни симптома, кроме «почему-то не работает».
const declared = new Set();
let tm;
const typeRe = /type: '(\w+)'/g;
while ((tm = typeRe.exec(src))) declared.add(tm[1]);
const handled = new Set();
const handRe = /type === '(\w+)'/g;
while ((tm = handRe.exec(src))) handled.add(tm[1]);
const orphans = [...declared].filter((t) => !handled.has(t));
if (orphans.length) throw new Error('типы заклинаний без обработчика: ' + orphans.join(', '));

// ---- 10. Наводка не должна цепляться за подчинённых Кровью.
if (!/e\.active && !e\.charmedUntil\) arr\.push\(e\)/.test(src)) throw new Error('getNearestEnemies снова наводится на собственных союзников');


// ---- 11. Кривые сложности идут в правильную сторону.
// Кривая — просто список точек, и опечатка в одной цифре делает поздний забег легче
// раннего, не ломая ничего видимого. Здесь же ловим слишком жёсткий старт.
function readCurve(name){
  const i = src.indexOf('const ' + name);
  if (i < 0) throw new Error('не нашёл кривую ' + name);
  const line = src.slice(i, src.indexOf(';', i));
  return JSON.parse(line.slice(line.indexOf('[[')));
}
[['ENEMY_HP_CURVE', 1], ['ENEMY_DMG_CURVE', 1], ['ENEMY_SPEED_CURVE', 1], ['ENEMY_CAP_CURVE', 1], ['SPAWN_MS_CURVE', -1]].forEach(([name, dir]) => {
  const pts = readCurve(name);
  for (let i = 1; i < pts.length; i++){
    if (pts[i][0] <= pts[i-1][0]) throw new Error(name + ': время идёт назад в точке ' + i);
    if (dir > 0 && pts[i][1] < pts[i-1][1]) throw new Error(name + ': сложность падает со временем в точке ' + i);
    if (dir < 0 && pts[i][1] > pts[i-1][1]) throw new Error(name + ': интервал спавна растёт со временем в точке ' + i);
  }
});
// Старт обязан быть мягче «единицы»: жалоба была именно на стену в первые минуты.
if (readCurve('ENEMY_HP_CURVE')[0][1] >= 1) throw new Error('ранний множитель HP >= 1: старт снова жёсткий');
if (readCurve('ENEMY_DMG_CURVE')[0][1] >= 1) throw new Error('ранний множитель урона >= 1: старт снова жёсткий');

// ---- 12. Толпа не должна схлопываться в одну точку.
if (!/physics\.add\.collider\(enemies, enemies\)/.test(src)) throw new Error('пропала коллизия врагов между собой');
// ---- 13. Фора после окна выбора.
if (!/elapsedMs < graceUntil\) return;/.test(src)) throw new Error('пропала неуязвимость после окна выбора');


// ---- 14. Обратная проверка: каждая ветка диспетчера зовёт существующую функцию.
// Проверка 9 ловит «тип есть, обработчика нет»; эта ловит зеркальный случай —
// обработчик остался, а функцию переименовали или удалили при переделке заклинания.
const called = [...src.matchAll(/type === '\w+'\) (\w+)\(/g)].map((m) => m[1]);
// Именно с границей имени: src.includes('function fireX') совпало бы и с fireXRenamed.
const missing = [...new Set(called)].filter((fn) => !new RegExp('function ' + fn + '\\s*\\(').test(src));
if (missing.length) throw new Error('диспетчер зовёт несуществующие функции: ' + missing.join(', '));

// ---- 15. Телеметрия забега на месте: версия, отправка на смерти, добор на закрытии вкладки.
if (!/const GAME_VERSION = '/.test(src)) throw new Error('пропала константа GAME_VERSION');
if (!/function doGameOver\(\)\{\s*running = false;\s*sendRun\('death'\);/.test(src)) throw new Error('doGameOver больше не шлёт забег в телеметрию');
if (!/addEventListener\('pagehide',[\s\S]{0,60}?sendRun\('exit'\)/.test(src)) throw new Error('пропал добор телеметрии на pagehide');

// ---- 16. Система артефактов: у каждой записи LOOT есть apply, caps на месте, пулы не пустые.
const lootBlock = src.slice(src.indexOf('const LOOT = {'), src.indexOf('const LOOT_IDS = Object.keys'));
const lootEntries = [...lootBlock.matchAll(/\n    (\w+):\s*\{[^\n]*\brarity:/g)].map((m) => m[1]);
if (lootEntries.length < 30) throw new Error('в LOOT меньше 30 артефактов: ' + lootEntries.length);
const noApply = [...lootBlock.matchAll(/\n    (\w+):\s*\{([^\n]*)\}/g)].filter((m) => !/\bapply:\s*\(\)/.test(m[2])).map((m) => m[1]);
if (noApply.length) throw new Error('артефакты без apply(): ' + noApply.join(', '));
if (!/const ART_CAP = \{ dmg: [\d.]+, speed: [\d.]+, cd: [\d.]+, hp: [\d.]+ \}/.test(src)) throw new Error('пропал ART_CAP');
if (!/const RIFT_POOL = /.test(src) || !/const BOSS_POOL = /.test(src)) throw new Error('пропали пулы дропа RIFT_POOL/BOSS_POOL');
if (!/\* artDmgFactor\(enemy\)/.test(src)) throw new Error('artDmgFactor не вплетён в damageEnemy');
if (!/updateNukeChip\(time\);\n\s*updateArtRuntime\(\)/.test(src)) throw new Error('updateArtRuntime не зовётся в update()');
if (!/playerHp <= 0 && !reviveLastResort\(\)\) doGameOver\(\)/.test(src)) throw new Error('reviveLastResort не в пути смерти игрока');
const rr = {};
[...lootBlock.matchAll(/rarity: R\.(\w)/g)].forEach((m) => rr[m[1]] = (rr[m[1]] || 0) + 1);

console.log('check ok:',
  'категории', Object.keys(tiers).join('/'),
  '| стоп-дистанция', stop, '<', playerR + tiers.normal.radius,
  '| арена', bMin + '-' + bMax, 'боссов раз в', num(/const BOSS_INTERVAL_MS = (\d+)/, 'i') / 60000, 'мин',
  '| артефактов', lootEntries.length, '(c' + (rr.c||0) + '/u' + (rr.u||0) + '/r' + (rr.r||0) + '/e' + (rr.e||0) + '/l' + (rr.l||0) + ')');
