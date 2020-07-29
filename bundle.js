// 原文 https://juejin.im/post/5f1a2e226fb9a07eb1525d17?utm_source=gold_browser_extension#heading-8
const fs = require('fs');
const path = require('path');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const babel = require('@babel/core');
const getModuleInfo = (file) => {
  // 读取文件
  const body = fs.readFileSync(file, 'utf-8');
  // console.log(body);
  // 根据文件内容解析成AST
  const ast = parser.parse(body, {
    sourceType:'module',
  });
  // console.log(ast);
  // console.log(ast.program.body);
  const deps = {};
  traverse(ast, {
    ImportDeclaration({node}) {
      const dirname = path.dirname(file);
      const absPath = `./${path.join(dirname, node.source.value)}`;
      deps[node.source.value] = absPath;
    }
  });
  // console.log(deps);
  const { code } = babel.transformFromAst(ast, null, {
    presets: ['@babel/preset-env'],
  });
  // console.log(code);
  return {
    file,
    deps,
    code,
  }
}
// getModuleInfo('./src/index.js');

const parseModules = (file) => {
  const entry = getModuleInfo(file);
  const temp = [entry];
  const depsGraph = {};
  for (let i = 0; i < temp.length; i++) {
    const deps = temp[i].deps;
    if (deps) {
      for (const key in deps) {
        if (deps.hasOwnProperty(key)) {
          temp.push(getModuleInfo(deps[key]));
        }
      }
    }
  }
  // console.log(temp);
  temp.forEach(moduleInfo => {
    depsGraph[moduleInfo.file] = {
      deps: moduleInfo.deps,
      code: moduleInfo.code,
    };
  })
  // console.log(depsGraph);
  return depsGraph;
}

// parseModules('./src/index.js');

const bundle = (file) => {
  const depsGraph = JSON.stringify(parseModules(file));
  return `(function (graph) {
    function require(file) {
      function absRequire(relPath) {
        return require(graph[file].deps[relPath])
      }
      var exports = {};
      (function (require, exports, code) {
        eval(code)
      })(absRequire, exports, graph[file].code)
      return exports
    }
    require('${file}')
  })(${depsGraph})`
}

const content = bundle('./src/index.js');
// console.log(content);

// generate file
if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist');
}
fs.writeFileSync('./dist/bundle.js', content);