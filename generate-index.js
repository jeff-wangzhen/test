const fs = require('fs');
const path = require('path');

// 生成目录结构（默认展开）
function generateDirectoryEntry(dirPath, basePath = '') {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  let html = '<ul class="tree">';

  entries
    .filter(entry => !entry.name.startsWith('.'))
    .sort((a, b) => a.isDirectory() === b.isDirectory() ? 0 : a.isDirectory() ? -1 : 1)
    .forEach(entry => {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.join(basePath, entry.name);

      if (entry.isDirectory()) {
        // 文件夹结构（默认展开）
        html += `
          <li class="folder">
            <div class="folder-header" onclick="toggleFolder(this)">
              <span class="arrow">▼</span>
              ${entry.name}
            </div>
            <div class="folder-content">
              ${generateDirectoryEntry(fullPath, relativePath)}
            </div>
          </li>`;
      } else {
        html += `<li class="file"><a href="/src/${relativePath}">${entry.name}</a></li>`;
      }
    });

  html += '</ul>';
  return html;
}

// 交互逻辑（保持展开状态同步）
const interactiveJS = `
<script>
  function toggleFolder(element) {
    const content = element.nextElementSibling;
    const arrow = element.querySelector('.arrow');
    content.style.display = content.style.display === 'none' ? 'block' : 'none';
    arrow.textContent = content.style.display === 'none' ? '▶' : '▼';
  }
</script>
`;

// 生成完整 HTML（CSS 微调）
const outputHTML = `
<!DOCTYPE html>
<html>
<head>
  <title>Directory Listing</title>
  <style>
    .tree { list-style: none; padding-left: 1em; }
    .folder-header { cursor: pointer; padding: 4px; }
    .folder-header:hover { background: #f0f0f0; }
    .arrow { display: inline-block; width: 1em; }
    .folder-content { margin-left: 1.2em; } /* 增加层级缩进 */
    .file { padding: 2px 0; }
    a { color: #0366d6; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  ${generateDirectoryEntry(process.argv[2] || './src')}
  ${interactiveJS}
</body>
</html>
`;

fs.writeFileSync('index.html', outputHTML);
console.log('Generated index.html with expanded folders');
