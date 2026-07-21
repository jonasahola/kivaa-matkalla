#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   Kivaa matkalla · ElevenLabs-äänien generointi + upotus
   Käyttö Macilla:
     export ELEVENLABS_API_KEY="sk_..."
     node lisaa-aanet-elevenlabs.mjs index.html
   Skripti generoi ääniefektit ja suomenkieliset huudahdukset,
   upottaa ne base64:na suoraan pelitiedostoon ja tekee varmuuskopion.
   Peli käyttää näytteitä automaattisesti; ilman niitä synth-äänet.
   ═══════════════════════════════════════════════════════════════ */
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs';

const KEY = process.env.ELEVENLABS_API_KEY;
const FILE = process.argv[2] || 'index.html';
if (!KEY) { console.error('Aseta ELEVENLABS_API_KEY ympäristömuuttujaan.'); process.exit(1); }

const API = 'https://api.elevenlabs.io/v1';
// Monikielinen naisääni (Charlotte) toimii hyvin suomeksi — vaihda halutessasi:
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || 'XB0fDUnXU5powFXDhCwa';

const SFX = {
  honk:    { prompt: 'Friendly cartoon truck horn, two cheerful beeps, toy-like, short', dur: 1.5 },
  stamp:   { prompt: 'Rubber stamp thunk on paper, single hit, satisfying, short', dur: 0.6 },
  stamp2:  { prompt: 'Rubber stamp thunk with a small magical sparkle chime, short', dur: 0.9 },
  undo:    { prompt: 'Soft descending boop, playful UI cancel sound, very short', dur: 0.5 },
  swap:    { prompt: 'Quick playful card shuffle flick, two notes up, very short', dur: 0.6 },
  fanfare: { prompt: 'Short happy toy trumpet fanfare, celebration, bright, 1.5 seconds', dur: 1.8 },
  click:   { prompt: 'Soft wooden UI tap, single subtle tick, gentle, very short', dur: 0.4 },
  tab:     { prompt: 'Quick playful page flip whoosh, light paper flick, very short', dur: 0.5 },
  sheet:   { prompt: 'Soft paper sliding upward, gentle whoosh, short', dur: 0.7 },
  engine:  { prompt: 'Cute cartoon truck engine starting and revving up happily, playful brumm brumm, toy-like', dur: 1.6 },
  finish:  { prompt: 'Race finish whistle with tiny crowd cheer, playful and bright, short', dur: 1.4 },
  deal:    { prompt: 'Playing cards dealt quickly onto a table, three crisp snaps, short', dur: 0.8 },
};
const VOICES = {
  bingo:      'Bingo!',
  ahola:      'Aholan auto!',
  taysi:      'Täysi kortti! Mahtavaa!',
  lahdetaan:  'Lähdetään!',
};

const b64 = (buf) => 'data:audio/mpeg;base64,' + Buffer.from(buf).toString('base64');

async function sfxGen(name, { prompt, dur }) {
  const r = await fetch(`${API}/sound-generation`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: prompt, duration_seconds: dur, prompt_influence: 0.6 }),
  });
  if (!r.ok) throw new Error(`SFX ${name}: ${r.status} ${await r.text()}`);
  console.log('  🔊', name);
  return b64(await r.arrayBuffer());
}

async function ttsGen(name, text) {
  const r = await fetch(`${API}/text-to-speech/${VOICE_ID}?output_format=mp3_22050_32`, {
    method: 'POST',
    headers: { 'xi-api-key': KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text, model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.6 },
    }),
  });
  if (!r.ok) throw new Error(`TTS ${name}: ${r.status} ${await r.text()}`);
  console.log('  🗣 ', name, '→', JSON.stringify(text));
  return b64(await r.arrayBuffer());
}

console.log('Generoidaan ElevenLabs-äänet…');
const sounds = {};
for (const [k, v] of Object.entries(SFX)) sounds[k] = await sfxGen(k, v);
for (const [k, t] of Object.entries(VOICES)) sounds['say_' + k] = await ttsGen(k, t);

let html = readFileSync(FILE, 'utf8');
const MARKER = 'let EL_SOUNDS=null;/*ELEVENLABS_SOUNDS*/';
if (!html.includes(MARKER)) { console.error('Merkkiä ei löydy — onko tämä oikea pelitiedosto?'); process.exit(1); }
copyFileSync(FILE, FILE + '.bak');
html = html.replace(MARKER, 'let EL_SOUNDS=' + JSON.stringify(sounds) + ';/*ELEVENLABS_SOUNDS*/');

// puheversiot käyttöön speak()-kutsuissa
html = html
  .replace(`sfx.speak('Aholan auto!')`, `(EL_SOUNDS&&EL_SOUNDS.say_ahola?new Audio(EL_SOUNDS.say_ahola).play().catch(()=>{}):sfx.speak('Aholan auto!'))`)
  .replace(`sfx.speak('Lähdetään!')`, `(EL_SOUNDS&&EL_SOUNDS.say_lahdetaan?new Audio(EL_SOUNDS.say_lahdetaan).play().catch(()=>{}):sfx.speak('Lähdetään!'))`)
  .replace(`sfx.speak("Bingo!")`, `(EL_SOUNDS&&EL_SOUNDS.say_bingo?new Audio(EL_SOUNDS.say_bingo).play().catch(()=>{}):sfx.speak("Bingo!"))`)
  .replace(`sfx.speak("Täysi kortti! Mahtavaa!")`, `(EL_SOUNDS&&EL_SOUNDS.say_taysi?new Audio(EL_SOUNDS.say_taysi).play().catch(()=>{}):sfx.speak("Täysi kortti! Mahtavaa!"))`);

writeFileSync(FILE, html);
const kb = (html.length / 1024).toFixed(0);
console.log(`\nValmis! Äänet upotettu → ${FILE} (${kb} kt). Varmuuskopio: ${FILE}.bak`);
console.log('Julkaise uudelleen (vercel --prod / git push) niin äänet ovat livenä.');
