/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const wagers = app.findCollectionByNameOrId('wagers');
		wagers.fields.add(new DateField({ name: 'cutoffAt' }));
		wagers.fields.add(
			new SelectField({
				name: 'cutoffSnapshotStatus',
				maxSelect: 1,
				values: ['accepted', 'unknown_legacy']
			})
		);
		app.save(wagers);

		for (const wager of app.findAllRecords('wagers')) {
			// Pre-migration records never persisted the cutoff accepted with the wager. The race's
			// current cutoff may have changed, so preserve the epistemic gap instead of fabricating it.
			wager.set('cutoffSnapshotStatus', 'unknown_legacy');
			app.save(wager);
		}

		wagers.fields.getByName('cutoffSnapshotStatus').required = true;
		app.save(wagers);

		const ledger = app.findCollectionByNameOrId('accountLedger');
		ledger.fields.add(new TextField({ name: 'reason', max: 100 }));
		ledger.fields.add(new TextField({ name: 'sourceKey', max: 200 }));
		app.save(ledger);

		// This historical mapping is intentionally self-contained: future runtime event names must
		// not rewrite the meaning or source identity of already-committed wager ledger entries.
		for (const entry of app.findAllRecords('accountLedger')) {
			const wagerId = entry.getString('wager');
			if (!wagerId) continue;
			const type = entry.getString('type');
			if (type === 'wager_reserve') {
				entry.set('reason', 'stake_reserved');
				entry.set('sourceKey', `wager:${wagerId}:reserve`);
			} else if (type === 'wager_payout') {
				entry.set('reason', 'winning_wager_paid');
				entry.set('sourceKey', `wager:${wagerId}:payout`);
			} else if (type === 'wager_refund') {
				entry.set('reason', 'voided_market_refund');
				entry.set('sourceKey', `wager:${wagerId}:refund`);
			}
			app.save(entry);
		}

		ledger.indexes.push(
			"CREATE UNIQUE INDEX idx_account_ledger_wager_source ON accountLedger (player, sourceKey) WHERE sourceKey != ''"
		);
		app.save(ledger);
	},
	(app) => {
		const ledger = app.findCollectionByNameOrId('accountLedger');
		ledger.indexes = ledger.indexes.filter(
			(index) => !index.includes('idx_account_ledger_wager_source')
		);
		ledger.fields.removeByName('sourceKey');
		ledger.fields.removeByName('reason');
		app.save(ledger);

		const wagers = app.findCollectionByNameOrId('wagers');
		wagers.fields.removeByName('cutoffSnapshotStatus');
		wagers.fields.removeByName('cutoffAt');
		app.save(wagers);
	}
);
