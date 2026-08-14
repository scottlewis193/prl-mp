/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/simulator/lease',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may claim the lease.', {});
		}

		const body = e.requestInfo().body;
		const ownerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
		const ttlMs = Number(body.ttlMs);
		if (
			!ownerId ||
			ownerId.length > 100 ||
			!Number.isFinite(ttlMs) ||
			ttlMs < 1 ||
			ttlMs > 60_000
		) {
			throw e.badRequestError('A valid ownerId and ttlMs are required.', {});
		}

		let result = { acquired: false };
		e.app.runInTransaction((txApp) => {
			const leaseId = 'prlsimlease0001';
			let lease;
			try {
				lease = txApp.findRecordById('simulator_leases', leaseId);
			} catch {
				lease = new Record(txApp.findCollectionByNameOrId('simulator_leases'));
				lease.set('id', leaseId);
				lease.set('token', 0);
			}

			const now = new DateTime();
			const currentOwner = lease.getString('ownerId');
			const leaseIsActive = !lease.isNew() && lease.getDateTime('expiresAt').after(now);
			if (leaseIsActive && currentOwner !== ownerId) return;

			let token = lease.getInt('token');
			if (!leaseIsActive || currentOwner !== ownerId) token += 1;
			lease.set('ownerId', ownerId);
			lease.set('token', token);
			lease.set('expiresAt', new Date(Date.now() + ttlMs).toISOString());
			txApp.save(lease);
			result = { acquired: true, token };
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);

routerAdd(
	'POST',
	'/api/prl/simulator/commit',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may commit race updates.', {});
		}

		const body = e.requestInfo().body;
		const ownerId = typeof body.ownerId === 'string' ? body.ownerId.trim() : '';
		const token = Number(body.token);
		const racerUpdates = Array.isArray(body.racerUpdates) ? body.racerUpdates : [];
		const raceUpdate = body.raceUpdate;
		if (!ownerId || !Number.isInteger(token) || token < 1 || racerUpdates.length > 1000) {
			throw e.badRequestError('A valid lease and racer update list are required.', {});
		}

		let committed = false;
		e.app.runInTransaction((txApp) => {
			let lease;
			try {
				lease = txApp.findRecordById('simulator_leases', 'prlsimlease0001');
			} catch {
				return;
			}

			const ownsActiveLease =
				lease.getString('ownerId') === ownerId &&
				lease.getInt('token') === token &&
				lease.getDateTime('expiresAt').after(new DateTime());
			if (!ownsActiveLease) return;

			for (const update of racerUpdates) {
				if (!update || typeof update.id !== 'string') {
					throw e.badRequestError('Every racer update requires an id.', {});
				}
				const racer = txApp.findRecordById('racers', update.id);
				racer.set('currentRace', update.currentRace);
				racer.set('positioning', update.positioning);
				racer.set('stats', update.stats);
				txApp.save(racer);
			}

			if (raceUpdate) {
				if (typeof raceUpdate.id !== 'string') {
					throw e.badRequestError('A race update requires an id.', {});
				}
				const race = txApp.findRecordById('races', raceUpdate.id);
				if (typeof raceUpdate.status === 'string') race.set('status', raceUpdate.status);
				if (typeof raceUpdate.winner === 'string') race.set('winner', raceUpdate.winner);
				txApp.save(race);
			}

			committed = true;
		});

		return e.json(200, { committed });
	},
	$apis.requireAuth('users')
);
