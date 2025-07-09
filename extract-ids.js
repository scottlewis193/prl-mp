const fs = require('fs');

// Step 1: Read the raw text file
const raw = fs.readFileSync('pokemontemp.txt', 'utf-8');

// Step 2: Use regex to extract name, url, and id
const regex = /\{\s*name:\s*'([^']+)',\s*url:\s*'([^']+\/(\d+)\/)'\s*\}/g;

const results = [];
let match;
while ((match = regex.exec(raw)) !== null) {
	results.push({
		name: match[1],
		url: match[2],
		id: parseInt(match[3])
	});
}

// Step 3: Save to a new JSON file
fs.writeFileSync('pokemon_with_ids.json', JSON.stringify(results, null, 2), 'utf-8');

console.log(`✅ Saved ${results.length} entries to pokemon_with_ids.json`);
