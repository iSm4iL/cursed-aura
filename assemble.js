// Собирает src/game.html в один текст, разворачивая метки
// /* @include путь/от/src */ содержимым указанного файла. Игра физически лежит
// в нескольких файлах (src/game.html + src/data/*.js), но и check.js, и build.js
// смотрят на неё как на единый ассемблированный исходник — ровно то, чем она
// была одним файлом до реструктуризации 1.0.9.
const fs = require('fs');
const path = require('path');

const INCLUDE_RE = /^\s*\/\*\s*@include\s+(\S+)\s*\*\/\s*$/;

function assembleSource(entryPath){
  const srcDir = path.dirname(entryPath);
  const lines = fs.readFileSync(entryPath, 'utf8').split('\n');
  const out = lines.map((line) => {
    const m = line.match(INCLUDE_RE);
    if (!m) return line;
    const incPath = path.join(srcDir, m[1]);
    return fs.readFileSync(incPath, 'utf8').replace(/\n$/, '');
  });
  return out.join('\n');
}

module.exports = { assembleSource };
