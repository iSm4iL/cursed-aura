// Собирает публикуемый index.html из src/game.html: инлайн-скрипт игры
// минифицируется и обфусцируется terser'ом (имена перемешаны, комментарии
// убраны). Это не настоящая защита кода — открывшему DevTools всё ещё видно
// JS, просто нечитаемый на глаз и без всех наших "почему" в комментариях.
// Правь ТОЛЬКО src/game.html — index.html теперь генерируемый файл.
// Запуск: npm run build  (или node build.js)
const fs = require('fs');
const path = require('path');
const { minify } = require('terser');
const { assembleSource } = require('./assemble.js');

const SRC = path.join(__dirname, 'src', 'game.html');
const OUT = path.join(__dirname, 'index.html');
const START = '<script>\n(function(){';
const END = '})();\n</script>';

async function build(){
  const src = assembleSource(SRC);
  const i = src.indexOf(START);
  const j = src.indexOf(END, i);
  if (i < 0 || j < 0) throw new Error('не нашёл границы инлайн-скрипта (' + START + ' ... ' + END + ') в ' + SRC);

  const codeStart = i + '<script>\n'.length;
  const codeEnd = j + '})();'.length;
  const code = src.slice(codeStart, codeEnd);

  const result = await minify(code, {
    compress: { passes: 2 },
    mangle: true,
    format: { comments: false }
  });
  if (result.error) throw result.error;

  const out = src.slice(0, codeStart) + result.code + src.slice(codeEnd);
  fs.writeFileSync(OUT, out, 'utf8');

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log('built index.html: ' + kb(Buffer.byteLength(out)) + ' (исходник ' + kb(Buffer.byteLength(src)) + ')');
}

build().catch((e) => { console.error('build failed:', e); process.exit(1); });
