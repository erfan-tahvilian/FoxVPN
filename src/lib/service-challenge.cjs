// SPDX-License-Identifier: GPL-3.0-or-later
// Parse JSON arguments only. Never execute code received from the service.
function readJSON(source, start) {
  while (/\s/.test(source[start] || '') && start < source.length) start++;
  const begin = start, stack = [];
  let quoted = false, escaped = false;
  for (; start < source.length; start++) {
    const c = source[start];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') {
        quoted = false;
        if (!stack.length) return {value:JSON.parse(source.slice(begin,start+1)), end:start+1};
      }
    } else if (c === '"') quoted = true;
    else if (c === '[' || c === '{') stack.push(c);
    else if (c === ']' || c === '}') {
      if (stack.pop() !== (c === ']' ? '[' : '{')) throw Error('Invalid JSON nesting');
      if (!stack.length) return {value:JSON.parse(source.slice(begin,start+1)), end:start+1};
    } else if (!stack.length && !/\s/.test(c)) throw Error('Expected a JSON value');
  }
  throw Error('Incomplete JSON value');
}
function parseChallengeInit(script, prefix) {
  if (script.length > 2*1024*1024) throw Error('Service verification response is too large.');
  const calls = [...script.matchAll(/\binit\s*\(\s*(?=\[)/g)];
  for (const call of calls.reverse()) {
    try {
      let next = call.index + call[0].length;
      const values = [];
      for (let i=0; i<3; i++) {
        const item = readJSON(script,next); values.push(item.value); next=item.end;
        if (i<2) {
          const comma = /^\s*,\s*/.exec(script.slice(next));
          if (!comma) throw Error('Missing argument');
          next += comma[0].length;
        }
      }
      const [challenges,token,path] = values;
      if (!Array.isArray(challenges) || !challenges.length || challenges.some(c=>!c || typeof c.ty!=='string') || typeof token!=='string' || !token || path!==prefix || !/^\s*[,)]/.test(script.slice(next))) continue;
      return {challenges,token};
    } catch { /* Ignore unrelated or malformed calls without executing them. */ }
  }
  throw Error('The service challenge format changed. Try again later.');
}
module.exports = {parseChallengeInit};
