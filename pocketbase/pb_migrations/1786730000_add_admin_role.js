/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.add(new BoolField({ name: 'isAdmin' }));
		users.createRule =
			'@request.body.isAdmin:isset = false && @request.body.id != "prlserviceuser0"';
		users.updateRule = 'id = @request.auth.id && @request.body.isAdmin:isset = false';
		app.save(users);
	},
	(app) => {
		const users = app.findCollectionByNameOrId('users');
		users.fields.removeByName('isAdmin');
		users.createRule = '';
		users.updateRule = 'id = @request.auth.id';
		app.save(users);
	}
);
