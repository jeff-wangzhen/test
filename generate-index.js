const fs = require('fs');
const path = require('path');

// 配置参数
const ROOT_DIR = './src'; // 从当前目录开始遍历
const EXCLUDE_DIRS = ['.git', '.github', 'node_modules','.husky']; // 排除的目录
const OUTPUT_FILE = 'index.html'; // 输出文件名

// 生成 HTML 内容
function generateHTML(fileTree) {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>项目文件目录</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; padding: 20px; }
    ul { list-style-type: none; padding-left: 20px; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <h1>📁 项目文件目录</h1>
  ${fileTree}
</body>
</html>
  `;
}

// 递归遍历目录并生成文件树
function buildFileTree(dir, currentDepth = 0) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let html = '<ul>';

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(ROOT_DIR, fullPath);

    // 跳过排除的目录和输出文件自身
    if (EXCLUDE_DIRS.includes(entry.name) || relativePath === OUTPUT_FILE) {
      continue;
    }

    if (entry.isDirectory()) {
      html += `
        <li>📂 ${entry.name}
          ${buildFileTree(fullPath, currentDepth + 1)}
        </li>
      `;
    } else {
      html += `
        <li>📄 <a href="${relativePath}">${entry.name}</a></li>
      `;
    }
  }

  html += '</ul>';
  return html;
}

// 主函数
function main() {
  try {
    const fileTree = buildFileTree(ROOT_DIR);
    const htmlContent = generateHTML(fileTree);
    fs.writeFileSync(OUTPUT_FILE, htmlContent);
    console.log(`✅ 已生成目录文件: ${OUTPUT_FILE}`);
  } catch (err) {
    console.error('❌ 生成失败:', err.message);
  }
}

// 执行脚本
main();
