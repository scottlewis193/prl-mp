/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		// PocketBase treats zero as blank for required number fields, but spending the exact balance
		// and fully liquidating a holding are valid trade outcomes.
		const users = app.findCollectionByNameOrId('users');
		users.fields.getByName('balance').required = false;
		app.save(users);

		const holdings = app.findCollectionByNameOrId('holdings');
		holdings.fields.getByName('quantity').required = false;
		holdings.fields.getByName('costBasis').required = false;
		app.save(holdings);

		const ledger = app.findCollectionByNameOrId('accountLedger');
		ledger.fields.add(new TextField({ name: 'idempotencyKey', max: 100 }));
		ledger.fields.add(new NumberField({ name: 'availableSupplyAfter', min: 0, onlyInt: true }));
		ledger.indexes.push(
			"CREATE UNIQUE INDEX idx_account_ledger_trade_request ON accountLedger (player, idempotencyKey) WHERE idempotencyKey != ''"
		);
		app.save(ledger);
	},
	(app) => {
		const ledger = app.findCollectionByNameOrId('accountLedger');
		ledger.indexes = ledger.indexes.filter(
			(index) => !index.includes('idx_account_ledger_trade_request')
		);
		ledger.fields.removeByName('availableSupplyAfter');
		ledger.fields.removeByName('idempotencyKey');
		app.save(ledger);

		const holdings = app.findCollectionByNameOrId('holdings');
		holdings.fields.getByName('quantity').required = true;
		holdings.fields.getByName('costBasis').required = true;
		app.save(holdings);

		const users = app.findCollectionByNameOrId('users');
		users.fields.getByName('balance').required = true;
		app.save(users);
	}
);
