// Aperçu sur ton ordinateur, à la date de ton choix.
//
//   npm run apercu                          -> le calendrier aujourd'hui
//   npm run apercu -- --date 2026-12-12     -> le calendrier tel qu'il sera le 12 décembre à midi
//   npm run apercu -- --date 2026-12-12T00:05
//
// Les données sont recalculées à chaque rechargement de la page :
// une case modifiée dans contenu/cases.json apparaît tout de suite.

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { racine, preparerDonnees, lireArguments, resumer } from './construire.mjs';
import { lireDate } from './temps.mjs';

const args = lireArguments(process.argv.slice(2));
const port = args.port || 8080;
const dossierApp = path.join(racine, 'app');

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

const serveur = http.createServer(async (req, res) => {
  try {
    const chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (chemin === '/donnees.json') {
      const maintenant = args.date ? lireDate(args.date) : new Date();
      const r = await preparerDonnees({ maintenant, apercu: true });
      resumer(r);
      res.writeHead(200, { 'content-type': types['.json'], 'cache-control': 'no-store' });
      res.end(JSON.stringify(r.donnees));
      return;
    }
    const fichier = path.normalize(path.join(dossierApp, chemin === '/' ? 'index.html' : chemin));
    if (!fichier.startsWith(dossierApp)) throw Object.assign(new Error('interdit'), { code: 'ENOENT' });
    const corps = await readFile(fichier);
    res.writeHead(200, { 'content-type': types[path.extname(fichier)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(corps);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(e.code === 'ENOENT' ? 'Page absente' : `Erreur : ${e.message}`);
    if (e.code !== 'ENOENT') console.error(e);
  }
});

serveur.listen(port, '127.0.0.1', () => {
  const quand = args.date ? `au ${lireDate(args.date).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (date simulée)` : 'à la date d\'aujourd\'hui';
  console.log(`Aperçu ${quand} : http://localhost:${port}`);
});
