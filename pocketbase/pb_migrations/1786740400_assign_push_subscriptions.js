/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const subscriptions = app.findCollectionByNameOrId('subscriptions');
		const users = app.findCollectionByNameOrId('users');
		subscriptions.fields.add(
			new RelationField({
				name: 'user',
				collectionId: users.id,
				maxSelect: 1
			})
		);
		subscriptions.indexes.push('CREATE INDEX idx_subscriptions_user ON subscriptions (user)');
		app.save(subscriptions);
	},
	(app) => {
		const subscriptions = app.findCollectionByNameOrId('subscriptions');
		subscriptions.indexes = subscriptions.indexes.filter(
			(index) => !index.includes('idx_subscriptions_user')
		);
		subscriptions.fields.removeByName('user');
		app.save(subscriptions);
	}
);
