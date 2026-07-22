/// <reference path="../pb_data/types.d.ts" />

const seedPokemonSprites = [
	{ id: 'prlseedpoke0001', name: 'pikachu' },
	{ id: 'prlseedpoke0002', name: 'bulbasaur' },
	{ id: 'prlseedpoke0003', name: 'charmander' },
	{ id: 'prlseedpoke0004', name: 'squirtle' },
	{ id: 'prlseedpoke0005', name: 'eevee' },
	{ id: 'prlseedpoke0006', name: 'meowth' },
	{ id: 'prlseedpoke0007', name: 'growlithe' },
	{ id: 'prlseedpoke0008', name: 'psyduck' }
];

function spritePath(name, suffix) {
	return $filepath.join($os.getwd(), 'static', 'pokemon-sprites', name + '-' + suffix + '.png');
}

migrate(
	function (app) {
		for (var index = 0; index < seedPokemonSprites.length; index++) {
			var seedPokemon = seedPokemonSprites[index];
			var pokemon = app.findRecordById('pokemon', seedPokemon.id);
			pokemon.set('overworldImage', $filesystem.fileFromPath(spritePath(seedPokemon.name, 'walk')));
			pokemon.set(
				'leaderboardImage',
				$filesystem.fileFromPath(spritePath(seedPokemon.name, 'portrait'))
			);
			app.save(pokemon);
		}
	},
	function (app) {
		for (var index = 0; index < seedPokemonSprites.length; index++) {
			var pokemon = app.findRecordById('pokemon', seedPokemonSprites[index].id);
			pokemon.set('overworldImage', '');
			pokemon.set('leaderboardImage', '');
			app.save(pokemon);
		}
	}
);
