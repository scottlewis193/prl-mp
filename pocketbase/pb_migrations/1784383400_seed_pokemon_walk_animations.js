/// <reference path="../pb_data/types.d.ts" />

const seedPokemonWalkAnimations = [
	{ id: 'prlseedpoke0001', frameWidth: 32, frameHeight: 40, durations: [8, 10, 8, 10] },
	{ id: 'prlseedpoke0002', frameWidth: 40, frameHeight: 40, durations: [4, 4, 4, 4, 4, 4] },
	{ id: 'prlseedpoke0003', frameWidth: 32, frameHeight: 32, durations: [6, 8, 6, 8] },
	{ id: 'prlseedpoke0004', frameWidth: 32, frameHeight: 32, durations: [12, 8, 12, 8] },
	{ id: 'prlseedpoke0005', frameWidth: 40, frameHeight: 48, durations: [4, 4, 4, 4, 6, 2, 2] },
	{ id: 'prlseedpoke0006', frameWidth: 24, frameHeight: 32, durations: [6, 10, 6, 10] },
	{ id: 'prlseedpoke0007', frameWidth: 32, frameHeight: 40, durations: [6, 8, 6, 8] },
	{ id: 'prlseedpoke0008', frameWidth: 24, frameHeight: 40, durations: [8, 12, 8, 12] }
];

function walkAnimation(animation) {
	return {
		AnimData: {
			Anims: {
				Anim: [
					{
						Name: 'Walk',
						FrameWidth: animation.frameWidth,
						FrameHeight: animation.frameHeight,
						Durations: { Duration: animation.durations }
					}
				]
			}
		}
	};
}

migrate(
	function (app) {
		for (var index = 0; index < seedPokemonWalkAnimations.length; index++) {
			var animation = seedPokemonWalkAnimations[index];
			var pokemon = app.findRecordById('pokemon', animation.id);
			pokemon.set('animData', walkAnimation(animation));
			app.save(pokemon);
		}
	},
	function (app) {
		for (var index = 0; index < seedPokemonWalkAnimations.length; index++) {
			var pokemon = app.findRecordById('pokemon', seedPokemonWalkAnimations[index].id);
			pokemon.set('animData', {});
			app.save(pokemon);
		}
	}
);
