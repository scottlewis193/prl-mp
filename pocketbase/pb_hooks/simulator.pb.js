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
				if (typeof raceUpdate.endTime === 'string') race.set('endTime', raceUpdate.endTime);
				if (Array.isArray(raceUpdate.finishingOrder)) {
					race.set('finishingOrder', raceUpdate.finishingOrder);
				}
				txApp.save(race);
			}

			committed = true;
		});

		return e.json(200, { committed });
	},
	$apis.requireAuth('users')
);

routerAdd(
	'POST',
	'/api/prl/races/settle',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may settle races.', {});
		}

		const body = e.requestInfo().body;
		const raceId = typeof body.raceId === 'string' ? body.raceId.trim() : '';
		if (!raceId) throw e.badRequestError('A raceId is required.', {});

		let settled = false;
		e.app.runInTransaction((txApp) => {
			const race = txApp.findRecordById('races', raceId);
			const status = race.getString('status');
			if (status === 'settled') return;
			if (status !== 'finished') {
				throw e.badRequestError('Only finished races can be settled.', {});
			}

			const racers = txApp.findRecordsByFilter('racers', 'race = {:raceId}', 'id', 1000, 0, {
				raceId
			});
			if (racers.length === 0) {
				throw e.badRequestError('A race must have participants before settlement.', {});
			}

			const finishers = racers.map((racer) => {
				const currentRace = new DynamicModel({ finished: false, finishedAt: '' });
				racer.unmarshalJSONField('currentRace', currentRace);
				const finishedAt = typeof currentRace.finishedAt === 'string' ? currentRace.finishedAt : '';
				const finishedAtMs = Date.parse(finishedAt);
				if (!currentRace.finished || !Number.isFinite(finishedAtMs)) {
					throw e.badRequestError('Every participant must have a durable finish time.', {});
				}
				return { racer, finishedAtMs };
			});
			finishers.sort((left, right) => {
				const timeComparison = left.finishedAtMs - right.finishedAtMs;
				return timeComparison !== 0 ? timeComparison : left.racer.id.localeCompare(right.racer.id);
			});

			const raceEndTime = race.getString('endTime');
			if (!raceEndTime) {
				throw e.badRequestError('A finished race must have an end time.', {});
			}
			const rewardScales = {};
			for (let index = 0; index < finishers.length; index++) {
				const racer = finishers[index].racer;
				const position = index + 1;
				const history = new DynamicModel({
					wins: 0,
					totalRaces: 0,
					averageFinishPosition: 0,
					races: []
				});
				racer.unmarshalJSONField('raceHistory', history);
				const previousRaces = Array.isArray(history.races) ? history.races : [];
				if (previousRaces.some((result) => result && result.raceId === raceId)) {
					throw e.badRequestError('This race is already present in participant history.', {});
				}

				const leagueId = racer.getString('league');
				if (rewardScales[leagueId] === undefined) {
					const league = txApp.findRecordById('leagues', leagueId);
					rewardScales[leagueId] = Math.max(0, league.getFloat('prizeMoneyScaling'));
				}
				const prizeMoney = (finishers.length - index) * rewardScales[leagueId];
				const previousTotalRaces = Number(history.totalRaces) || 0;
				const totalRaces = previousTotalRaces + 1;
				const previousAverage = Number(history.averageFinishPosition) || 0;
				const stats = new DynamicModel({
					hp: 0,
					attack: 0,
					defense: 0,
					speed: 0,
					level: 0,
					ranking: 0,
					gender: 'male'
				});
				racer.unmarshalJSONField('stats', stats);
				const financials = new DynamicModel({
					totalEarnings: 0,
					earningsPerShare: 0,
					lastPayoutAt: '',
					issuedShares: 0,
					outstandingShares: 0,
					currentSharePrice: 0,
					priceHistory: []
				});
				racer.unmarshalJSONField('financials', financials);
				const ownership = new DynamicModel({ totalShares: 0, shareholders: [] });
				racer.unmarshalJSONField('ownership', ownership);
				const totalEarnings = (Number(financials.totalEarnings) || 0) + prizeMoney;
				const totalShares = Number(ownership.totalShares) || 0;

				racer.set('race', null);
				racer.set('stats', {
					hp: stats.hp,
					attack: stats.attack,
					defense: stats.defense,
					speed: stats.speed,
					level: stats.level,
					ranking: position,
					gender: stats.gender
				});
				racer.set('raceHistory', {
					wins: (Number(history.wins) || 0) + (position === 1 ? 1 : 0),
					totalRaces,
					averageFinishPosition: (previousAverage * previousTotalRaces + position) / totalRaces,
					races: [...previousRaces, { raceId, position, prizeMoney, date: raceEndTime }]
				});
				racer.set('financials', {
					totalEarnings,
					earningsPerShare: totalShares > 0 ? totalEarnings / totalShares : 0,
					lastPayoutAt: raceEndTime,
					issuedShares: financials.issuedShares,
					outstandingShares: financials.outstandingShares,
					currentSharePrice: financials.currentSharePrice,
					priceHistory: financials.priceHistory
				});
				txApp.save(racer);
			}

			race.set('winner', finishers[0].racer.id);
			race.set(
				'finishingOrder',
				finishers.map((finisher) => finisher.racer.id)
			);
			race.set('status', 'settled');
			txApp.save(race);
			settled = true;
		});

		return e.json(200, { settled });
	},
	$apis.requireAuth('users')
);
