import 'dotenv/config';

import PocketBase from 'pocketbase';
import catalogue from '../data/pokemon-species.gen1-5.v1.json';
import { resolvePocketBaseUrl } from '../src/lib/pocketbase-url.js';
import {
	importSpeciesCatalogue,
	type SpeciesCatalogueEntry
} from '../src/lib/server/speciesCatalogue';
import { PocketBaseSpeciesCatalogueRepository } from '../src/lib/server/pocketBaseSpeciesCatalogue';

const email = process.env.PB_USER;
const password = process.env.PB_PASS;
if (!email || !password)
	throw new Error('PB_USER and PB_PASS must be configured to import species');

const pb = new PocketBase(resolvePocketBaseUrl(process.env.PUBLIC_PB_URL));
pb.autoCancellation(false);
await pb.collection('users').authWithPassword(email, password);

const result = await importSpeciesCatalogue(
	catalogue.species as SpeciesCatalogueEntry[],
	new PocketBaseSpeciesCatalogueRepository(pb)
);
console.log(
	`Pokemon species catalogue imported: ${result.created} created, ${result.updated} updated, ${result.total} total`
);
