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

			const rewardScaleByLeague = {};
			const participants = [];
			const racerById = {};
			for (const racer of racers) {
				const currentRace = new DynamicModel({
					finished: false,
					finishedAt: '',
					lastUpdatedAt: ''
				});
				racer.unmarshalJSONField('currentRace', currentRace);
				const history = new DynamicModel({
					wins: 0,
					totalRaces: 0,
					averageFinishPosition: 0,
					races: []
				});
				racer.unmarshalJSONField('raceHistory', history);
				const leagueId = racer.getString('league');
				if (rewardScaleByLeague[leagueId] === undefined) {
					const league = txApp.findRecordById('leagues', leagueId);
					rewardScaleByLeague[leagueId] = league.getFloat('prizeMoneyScaling');
				}
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
				racerById[racer.id] = racer;
				participants.push({
					id: racer.id,
					leagueId,
					finished: currentRace.finished,
					finishedAt: currentRace.finishedAt || currentRace.lastUpdatedAt,
					stats: {
						hp: stats.hp,
						attack: stats.attack,
						defense: stats.defense,
						speed: stats.speed,
						level: stats.level,
						ranking: stats.ranking,
						gender: stats.gender
					},
					raceHistory: {
						wins: Number(history.wins) || 0,
						totalRaces: Number(history.totalRaces) || 0,
						averageFinishPosition: Number(history.averageFinishPosition) || 0,
						races: Array.from(history.races || [])
					},
					financials: {
						totalEarnings: Number(financials.totalEarnings) || 0,
						earningsPerShare: Number(financials.earningsPerShare) || 0,
						lastPayoutAt: financials.lastPayoutAt,
						issuedShares: financials.issuedShares,
						outstandingShares: financials.outstandingShares,
						currentSharePrice: financials.currentSharePrice,
						priceHistory: financials.priceHistory
					},
					totalShares: Number(ownership.totalShares) || 0
				});
			}

			let plan;
			try {
				const settlementRules = require(`${__hooks}/raceSettlement.cjs`);
				plan = settlementRules.buildRaceSettlement({
					raceId,
					participants,
					rewardScaleByLeague
				});
			} catch (error) {
				throw e.badRequestError(error.message, {});
			}

			for (const update of plan.racers) {
				const racer = racerById[update.id];
				racer.set('race', null);
				racer.set('stats', update.stats);
				racer.set('raceHistory', update.raceHistory);
				racer.set('financials', update.financials);
				txApp.save(racer);
			}

			race.set('winner', plan.race.winner);
			race.set('finishingOrder', plan.race.finishingOrder);
			race.set('endTime', plan.race.endTime);
			race.set('status', plan.race.status);
			txApp.save(race);
			settled = true;
		});

		return e.json(200, { settled });
	},
	$apis.requireAuth('users')
);
