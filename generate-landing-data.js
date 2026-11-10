const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'site-pages');
const outDir = path.join(__dirname, 'src', 'lib');

function extractParts(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Extract all <style> blocks in <head>
  const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  let styles = '';
  if (headMatch) {
    const styleMatches = headMatch[1].match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
    styles = styleMatches.join('\n');
  }

  // Extract body content
  const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch ? bodyMatch[1] : '';
  
  // Remove script tags from body so react doesn't warn and scripts are handled cleanly
  body = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  return { styles, body };
}

const indexParts = extractParts(path.join(srcDir, 'index.html'));
const getStartedParts = extractParts(path.join(srcDir, 'get-started.html'));

fs.writeFileSync(
  path.join(outDir, 'landingPagesData.ts'),
  `// Auto-generated landing page templates from site-pages
export const INDEX_HEAD_STYLES = ${JSON.stringify(indexParts.styles)};
export const INDEX_BODY_HTML = ${JSON.stringify(indexParts.body)};

export const GET_STARTED_HEAD_STYLES = ${JSON.stringify(getStartedParts.styles)};
export const GET_STARTED_BODY_HTML = ${JSON.stringify(getStartedParts.body)};
`,
  'utf8'
);

console.log('Successfully generated src/lib/landingPagesData.ts');

