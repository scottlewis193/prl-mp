/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';
		const news = new Collection({
			id: 'prl_news_000000',
			name: 'news',
			type: 'base',
			listRule: '',
			viewRule: '',
			createRule: serviceMutationRule,
			updateRule: serviceMutationRule,
			deleteRule: serviceMutationRule,
			fields: [
				{
					type: 'relation',
					name: 'sourceEvent',
					required: true,
					collectionId: 'prl_events_0000',
					maxSelect: 1,
					cascadeDelete: true
				},
				{
					type: 'relation',
					name: 'race',
					required: true,
					collectionId: 'prl_races_00000',
					maxSelect: 1
				},
				{ type: 'relation', name: 'racers', collectionId: 'prl_racers_0000', maxSelect: 100 },
				{ type: 'relation', name: 'trainers', collectionId: 'prl_trainers_00', maxSelect: 100 },
				{
					type: 'relation',
					name: 'league',
					required: true,
					collectionId: 'prl_leagues_000',
					maxSelect: 1
				},
				{
					type: 'relation',
					name: 'track',
					required: true,
					collectionId: 'prl_tracks_0000',
					maxSelect: 1
				},
				{ type: 'select', name: 'category', required: true, maxSelect: 1, values: ['race_result'] },
				{ type: 'number', name: 'importance', required: true, min: 0, max: 100 },
				{ type: 'date', name: 'publishedAt', required: true },
				{ type: 'text', name: 'headline', required: true, max: 250 },
				{ type: 'text', name: 'summary', required: true, max: 2000 },
				{ type: 'text', name: 'templateVersion', required: true, max: 50 },
				{ type: 'json', name: 'links', maxSize: 100000 }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_news_source_event ON news (sourceEvent)',
				'CREATE INDEX idx_news_feed ON news (category, importance DESC, publishedAt DESC)'
			]
		});
		app.save(news);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('news'));
	}
);
