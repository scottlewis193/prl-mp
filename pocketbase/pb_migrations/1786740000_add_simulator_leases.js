/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const serviceMutationRule = '@request.auth.id = "prlserviceuser0"';
		const collection = new Collection({
			id: 'prl_sim_leases0',
			name: 'simulator_leases',
			type: 'base',
			listRule: serviceMutationRule,
			viewRule: serviceMutationRule,
			createRule: null,
			updateRule: null,
			deleteRule: null,
			fields: [
				{ type: 'text', name: 'ownerId', required: true, max: 100 },
				{ type: 'number', name: 'token', required: true, min: 1 },
				{ type: 'date', name: 'expiresAt', required: true }
			]
		});

		app.save(collection);
	},
	(app) => {
		app.delete(app.findCollectionByNameOrId('simulator_leases'));
	}
);
