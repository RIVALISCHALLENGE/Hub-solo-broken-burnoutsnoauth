const fs = require('fs');
const s = fs.readFileSync('src/views/Profile.jsx', 'utf8');
const stack = [];
const openings = {"'":"'","\"":"\"","`":"`","/":"/","{":"}",'(':")","[":"]"};
for(let i=0;i<s.length;i++){
  const c = s[i];
  if(c==='"' || c==="'" || c==='`'){
    // toggle string state
    if(stack.length && stack[stack.length-1]===c){ stack.pop(); }
    else if(stack.length && (stack[stack.length-1]==='\\' )){ /*escaped*/ }
    else { stack.push(c); }
    continue;
  }
  if(stack.length && (stack[stack.length-1]==='"' || stack[stack.length-1]==="'" || stack[stack.length-1]==='`')){
    // inside string, skip
    if(c==='\\') { i++; }
    continue;
  }
  if(c==='('||c==='['||c==='{') stack.push(c);
  else if(c===')'||c===']'||c==='}'){
    const last=stack.pop();
    const map={"(":")","[":"]","{":"}"};
    if(map[last]!==c){
      console.log('Mismatch at',i, 'expected', map[last], 'got', c, 'last', last);
      break;
    }
  }
}
console.log('Top of stack (unclosed):', stack.slice(-10));
console.log('File length:', s.length);
