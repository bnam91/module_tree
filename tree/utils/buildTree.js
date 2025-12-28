const fs = require('fs');
const path = require('path');

function buildTree(currentPath, relPath = '', ignoreSet = new Set()) {
  const name = path.basename(currentPath);
  const stat = fs.lstatSync(currentPath);

  if (stat.isSymbolicLink()) {
    return {
      name,
      type: 'symlink',
      relPath,
      target: fs.readlinkSync(currentPath),
    };
  }

  if (!stat.isDirectory()) {
    return { name, type: 'file', relPath };
  }

  const entries = fs
    .readdirSync(currentPath, { withFileTypes: true })
    .filter((entry) => !ignoreSet.has(entry.name))
    .sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  const children = entries.map((entry) =>
    buildTree(
      path.join(currentPath, entry.name),
      relPath ? `${relPath}/${entry.name}` : entry.name,
      ignoreSet
    )
  );

  return { name, type: 'dir', relPath, children };
}

module.exports = { buildTree };

