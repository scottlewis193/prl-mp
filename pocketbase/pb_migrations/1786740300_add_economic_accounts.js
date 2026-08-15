/// <reference path="../pb_data/types.d.ts" />

const STARTING_BALANCE = 10000;

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(new NumberField({ name: 'balance', required: true, min: 0 }));
		users.createRule = null;
		users.updateRule =
			'id = @request.auth.id && @request.body.isAdmin:isset = false && @request.body.balance:isset = false';
		app.save(users);

		const holdings = new Collection({
			id: 'prlholdings00001',
			name: 'holdings',
			type: 'base',
			listRule: 'player = @request.auth.id',
			viewRule: 'player = @request.auth.id',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'relation', name: 'player', required: true, collectionId: users.id, maxSelect: 1 },
				{
					type: 'relation',
					name: 'racer',
					required: true,
					collectionId: 'prl_racers_0000',
					maxSelect: 1
				},
				{ type: 'number', name: 'quantity', required: true, min: 0, onlyInt: true },
				{ type: 'number', name: 'costBasis', required: true, min: 0 }
			],
			indexes: [
				'CREATE UNIQUE INDEX idx_holdings_player_racer ON holdings (player, racer)',
				'CREATE INDEX idx_holdings_player ON holdings (player)'
			]
		});
		app.save(holdings);

		const ledger = new Collection({
			id: 'prlledger000001',
			name: 'accountLedger',
			type: 'base',
			listRule: 'player = @request.auth.id',
			viewRule: 'player = @request.auth.id',
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'relation', name: 'player', required: true, collectionId: users.id, maxSelect: 1 },
				{
					type: 'relation',
					name: 'racer',
					collectionId: 'prl_racers_0000',
					maxSelect: 1
				},
				{
					type: 'select',
					name: 'type',
					required: true,
					maxSelect: 1,
					values: ['account_opened', 'buy', 'sell']
				},
				{ type: 'number', name: 'balanceDelta' },
				{ type: 'number', name: 'balanceAfter', min: 0 },
				{ type: 'number', name: 'quantityDelta', onlyInt: true },
				{ type: 'number', name: 'quantityAfter', min: 0, onlyInt: true },
				{ type: 'number', name: 'unitPrice', min: 0 },
				{ type: 'number', name: 'costBasisAfter', min: 0 },
				{ type: 'date', name: 'occurredAt', required: true }
			],
			indexes: [
				'CREATE INDEX idx_account_ledger_player_occurred ON accountLedger (player, occurredAt)'
			]
		});
		app.save(ledger);

		for (const user of app.findAllRecords('users')) {
			user.set('balance', STARTING_BALANCE);
			app.save(user);

			const entry = new Record(ledger);
			entry.set('player', user.id);
			entry.set('type', 'account_opened');
			entry.set('balanceDelta', STARTING_BALANCE);
			entry.set('balanceAfter', STARTING_BALANCE);
			entry.set('quantityDelta', 0);
			entry.set('quantityAfter', 0);
			entry.set('unitPrice', 0);
			entry.set('costBasisAfter', 0);
			entry.set('occurredAt', new Date().toISOString());
			app.save(entry);
		}
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('accountLedger'));
		app.delete(app.findCollectionByNameOrId('holdings'));
		const users = app.findCollectionByNameOrId('users');
		users.fields.removeByName('balance');
		users.createRule =
			'@request.body.isAdmin:isset = false && @request.body.id != "prlserviceuser0"';
		users.updateRule = 'id = @request.auth.id && @request.body.isAdmin:isset = false';
		app.save(users);
	}
);
