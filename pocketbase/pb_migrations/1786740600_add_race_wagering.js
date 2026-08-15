/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const races = app.findCollectionByNameOrId('races');
		races.fields.add(new DateField({ name: 'bettingCutoff' }));
		races.fields.add(new JSONField({ name: 'markets', maxSize: 100000 }));
		app.save(races);

		const wagers = new Collection({
			id: 'prlwagers000001',
			name: 'wagers',
			type: 'base',
			listRule: 'player = @request.auth.id',
			viewRule: 'player = @request.auth.id',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{
					type: 'relation',
					name: 'player',
					required: true,
					collectionId: '_pb_users_auth_',
					maxSelect: 1
				},
				{ type: 'relation', name: 'race', required: true, collectionId: races.id, maxSelect: 1 },
				{ type: 'select', name: 'market', required: true, maxSelect: 1, values: ['winner'] },
				{
					type: 'relation',
					name: 'selection',
					required: true,
					collectionId: 'prl_racers_0000',
					maxSelect: 1
				},
				{ type: 'number', name: 'stake', required: true, min: 0.01 },
				{ type: 'number', name: 'odds', required: true, min: 1 },
				{ type: 'number', name: 'potentialPayout', required: true, min: 0.01 },
				{
					type: 'select',
					name: 'status',
					required: true,
					maxSelect: 1,
					values: ['open', 'won', 'lost', 'refunded']
				},
				{ type: 'number', name: 'payout', min: 0 },
				{ type: 'text', name: 'idempotencyKey', required: true, max: 100 },
				{ type: 'date', name: 'placedAt', required: true },
				{ type: 'date', name: 'resolvedAt' }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_wagers_player_request ON wagers (player, idempotencyKey)',
				'CREATE INDEX idx_wagers_player_status_placed ON wagers (player, status, placedAt)',
				'CREATE INDEX idx_wagers_race_status ON wagers (race, status)'
			]
		});
		app.save(wagers);

		const ledger = app.findCollectionByNameOrId('accountLedger');
		ledger.fields.getByName('type').values = [
			'account_opened',
			'buy',
			'sell',
			'wager_reserve',
			'wager_payout',
			'wager_refund'
		];
		ledger.fields.add(new RelationField({ name: 'wager', collectionId: wagers.id, maxSelect: 1 }));
		app.save(ledger);
	},
	(app) => {
		const ledger = app.findCollectionByNameOrId('accountLedger');
		ledger.fields.removeByName('wager');
		ledger.fields.getByName('type').values = ['account_opened', 'buy', 'sell'];
		app.save(ledger);
		app.delete(app.findCollectionByNameOrId('wagers'));
		const races = app.findCollectionByNameOrId('races');
		races.fields.removeByName('markets');
		races.fields.removeByName('bettingCutoff');
		app.save(races);
	}
);
