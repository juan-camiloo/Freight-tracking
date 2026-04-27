const fs = require('fs');
const path = './dist/index.html';

let html = fs.readFileSync(path, 'utf8');
const metaTag = '<meta name="google-site-verification" content="XeN0bbfqcXGL9dSdzo1f_iSqlsSYrbMLBAvbpSX_8Gk" />';

html = html.replace('</head>', `${metaTag}\n</head>`);
fs.writeFileSync(path, html, 'utf8');
console.log('✅ Meta tag inyectado');