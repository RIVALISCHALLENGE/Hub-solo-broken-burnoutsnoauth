const fs = require('fs');
const s = fs.readFileSync('src/views/Profile.jsx', 'utf8');
let stack = [];
let inString = null; // ' or " or `
let escaped = false;
for (let i=0;i<s.length;i++){
  const c = s[i];
  if (inString){
    if (escaped){ escaped=false; continue; }
    if (c === '\\') { escaped = true; continue; }
    if (c === inString){ inString = null; continue; }
    if (inString === '`' && c === '$' && s[i+1] === '{'){
      stack.push('`expr'); i++; // skip '{'
    }
    continue;
  }
  if (c === '"' || c === "'" || c === '`'){
    inString = c; continue;
  }
  if (c === '(' || c === '{' || c === '[') stack.push(c);
  if (c === ')' || c === '}' || c === ']'){
    const last = stack.pop();
    const map = { '(':')','{':'}','[':']','`expr':'}' };
    if (!last){ console.log('Unmatched closer', c, 'at', i); }
    else if (map[last] !== c){ console.log('Mismatched', last, 'vs', c, 'at', i); }
  }
}
console.log('inString:', inString);
console.log('stack tail:', stack.slice(-10));
// show context around first suspicious area
if (inString){
  const idx = s.indexOf(inString);
  console.log('first open string at', idx, s.slice(Math.max(0,idx-40), idx+40));
}

// print lines around reported build line 923
const lines = s.split(/\n/);
for (const L of [780,790,800,810,820,840,860,880,900,920,930]){
  console.log('----- line', L, '-----');
  console.log(lines[L-1]);
}
