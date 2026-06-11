const fs = require('fs');
const code = fs.readFileSync('/Users/breno.andrade/Documents/Breno/repo/3dzaap-app/orders_kanban.html', 'utf8');
// extract all scripts
const scripts = [];
let match;
const regex = /<script>([\s\S]*?)<\/script>/g;
while ((match = regex.exec(code)) !== null) {
  scripts.push(match[1]);
}
for (let i=0; i<scripts.length; i++) {
  try {
    eval("function wrapper() {" + scripts[i] + "}");
  } catch (e) {
    console.error("Syntax Error in script", i, e);
  }
}
console.log("Done checking kanban scripts");
