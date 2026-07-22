/// <reference path="../pb_data/types.d.ts" />

migrate(
	(app) => {
		const userEmail = $os.getenv('PB_USER');
		const userPassword = $os.getenv('PB_PASS');

		if (userEmail && userPassword) {
			const users = app.findCollectionByNameOrId('users');
			const user = new Record(users);
			user.set('id', 'prlserviceuser0');
			user.set('email', userEmail);
			user.set('password', userPassword);
			user.set('verified', true);
			user.set('name', 'Local service user');
			user.set('options', {
				raceViewer: { leaderboardMode: 'interval', isViewing: false }
			});
			user.set('watchlist', []);
			app.save(user);
		}

		const superuserEmail = $os.getenv('PB_SUPERUSER_EMAIL');
		const superuserPassword = $os.getenv('PB_SUPERUSER_PASS');

		if (superuserEmail && superuserPassword) {
			const superusers = app.findCollectionByNameOrId('_superusers');
			const superuser = new Record(superusers);
			superuser.set('email', superuserEmail);
			superuser.set('password', superuserPassword);
			app.save(superuser);
		}
	},
	(app) => {
		for (const [collection, email] of [
			['users', $os.getenv('PB_USER')],
			['_superusers', $os.getenv('PB_SUPERUSER_EMAIL')]
		]) {
			if (!email) continue;
			try {
				app.delete(app.findAuthRecordByEmail(collection, email));
			} catch {
				// The account may already have been removed manually.
			}
		}
	}
);
