const ts = require('../web/node_modules/typescript')
const fs = require('fs')
const source = fs.readFileSync('web/dist/assets/index-ylFhaK6g.js', 'utf8')
const ast = ts.createSourceFile('bundle.js', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
function visit(node) {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isArrayLiteralExpression(node.initializer)) {
    const text = node.initializer.getText(ast)
    if (text.includes('signature:') || text.includes('question:') && text.includes('answer:') || text.includes('functions:') || text.includes('to:"/docs')) {
      console.log(node.name.getText(ast), text.length, text.slice(0,400))
      fs.writeFileSync(`tmp/docs-${node.name.getText(ast)}.txt`, text)
    }
  }
  ts.forEachChild(node, visit)
}
visit(ast)
