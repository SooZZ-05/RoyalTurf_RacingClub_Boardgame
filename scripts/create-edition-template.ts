import { writeFile } from 'node:fs/promises';
import raw from '../src/data/edition.json';
const filename = process.argv[2] ?? 'docs/edition-template.json';
// Numerical completeness does not certify the language-specific manual or card labels.
const template = {
  ...structuredClone(raw),
  id: 'royal-turf-zh-2023',
  verified: false,
  sourceBacked: false,
  verification: { ...raw.verification, reviewer: null, date: null },
  cards: raw.cards.map((card) => ({
    ...card,
    names: {
      ...card.names,
      'zh-Hant':
        card.deck === 'historical' && card.names['zh-Hant'] === card.names.en
          ? null
          : card.names['zh-Hant'],
    },
  })),
  rules: { ...raw.rules, lastTie: null, evidence: { ...raw.rules.evidence, lastTie: null } },
};
await writeFile(filename, JSON.stringify(template, null, 2) + '\n');
console.log(
  `Created Chinese-certification template: ${filename}. All49 sourced numerical profiles are prefilled; untranscribed Chinese names, tied-last rule and reviewer certification remain unresolved.`,
);
