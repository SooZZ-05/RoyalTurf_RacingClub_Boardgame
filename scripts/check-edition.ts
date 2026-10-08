import { readFile } from 'node:fs/promises';
import { parseEdition, parsePublishedEdition } from '../src/shared/edition';
const filename = process.argv[2] ?? 'src/data/edition.json';
try {
  const input = JSON.parse(await readFile(filename, 'utf8'));
  const edition = input.sourceBacked ? parsePublishedEdition(input) : parseEdition(input);
  console.log(
    `Validated ${edition.id} ${edition.version}: ${edition.cards.length} profiles and all rule evidence references.`,
  );
  console.log(
    edition.verified
      ? 'Certified-edition schema passed; verify the cited sources before claiming certification.'
      : 'Published decks are playable. Chinese name/manual certification remains separate; the crowded-field tie policy is disclosed.',
  );
} catch (error) {
  console.error(
    'Edition data is incomplete; the explicit seven-profile practice mode remains available.',
  );
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
