// Le coffre à cadeaux. Les 24 textes partent sur GitHub (dépôt public) uniquement chiffrés.
// La clé n'est jamais sauvegardée : elle vit dans le fichier .cle (écarté par .gitignore)
// et dans le secret GitHub CLE_CALENDRIER, que seul le robot lit.
//
//   npm run chiffrer   -> met à jour contenu/cases.chiffre.json à partir de contenu/cases.json

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FICHIER_CLAIR = 'contenu/cases.json';
export const FICHIER_CHIFFRE = 'contenu/cases.chiffre.json';
export const FICHIER_CLE = '.cle';

/** La clé vient du secret GitHub (robot) ou du fichier .cle (ton ordinateur). */
export function lireCle(racine) {
  let brute = process.env.CLE_CALENDRIER?.trim();
  if (!brute && existsSync(path.join(racine, FICHIER_CLE))) brute = readFileSync(path.join(racine, FICHIER_CLE), 'utf8').trim();
  if (!brute) return null;
  const cle = Buffer.from(brute, 'base64');
  if (cle.length !== 32) throw new Error('La clé du calendrier est invalide (32 octets en base64 attendus).');
  return cle;
}

export function chiffrer(texte, cle) {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', cle, iv);
  const donnees = Buffer.concat([c.update(texte, 'utf8'), c.final()]);
  return {
    note: 'Textes des 24 cases, chiffrés (AES-256-GCM). Illisibles sans la clé, que seul le robot possède.',
    algorithme: 'aes-256-gcm',
    iv: iv.toString('base64'),
    etiquette: c.getAuthTag().toString('base64'),
    donnees: donnees.toString('base64'),
  };
}

export function dechiffrer(enveloppe, cle) {
  const d = createDecipheriv('aes-256-gcm', cle, Buffer.from(enveloppe.iv, 'base64'));
  d.setAuthTag(Buffer.from(enveloppe.etiquette, 'base64'));
  return Buffer.concat([d.update(Buffer.from(enveloppe.donnees, 'base64')), d.final()]).toString('utf8');
}

const lanceDirectement = process.argv[1] && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase();
if (lanceDirectement) {
  const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const clair = path.join(racine, FICHIER_CLAIR);
  const chiffre = path.join(racine, FICHIER_CHIFFRE);
  if (!existsSync(clair)) {
    console.error(`Rien à chiffrer : ${FICHIER_CLAIR} est absent.`);
    process.exit(1);
  }

  let cle = lireCle(racine);
  if (!cle) {
    // Garde-fou : on ne crée la clé que si Git est sûr de l'ignorer.
    try {
      execSync(`git check-ignore -q ${FICHIER_CLE}`, { cwd: racine, stdio: 'ignore' });
    } catch {
      console.error(`${FICHIER_CLE} n'est pas écarté par .gitignore : je refuse de créer la clé.`);
      process.exit(1);
    }
    cle = randomBytes(32);
    writeFileSync(path.join(racine, FICHIER_CLE), cle.toString('base64') + '\n');
    console.log(`Nouvelle clé créée dans ${FICHIER_CLE} (jamais sauvegardée). Elle doit aussi aller dans le secret GitHub CLE_CALENDRIER.`);
  }

  const texte = readFileSync(clair, 'utf8');
  JSON.parse(texte); // refuse un fichier cassé

  if (existsSync(chiffre)) {
    try {
      if (dechiffrer(JSON.parse(readFileSync(chiffre, 'utf8')), cle) === texte) {
        console.log('Les textes chiffrés sont déjà à jour.');
        process.exit(0);
      }
    } catch {
      console.warn('La version chiffrée actuelle ne s\'ouvre pas avec cette clé : je la remplace.');
    }
  }
  writeFileSync(chiffre, JSON.stringify(chiffrer(texte, cle), null, 2) + '\n');
  console.log(`Textes chiffrés dans ${FICHIER_CHIFFRE}. Tu peux sauvegarder ce fichier, il est illisible sans la clé.`);
}
