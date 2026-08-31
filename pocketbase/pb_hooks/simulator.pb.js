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
				if (raceUpdate.status === 'settled') {
					throw e.badRequestError('Settled races must use the settlement endpoint.', {});
				}
				if (raceUpdate.status === 'cancelled') {
					require(`${__hooks}/wagerSettlement.cjs`).voidRace(txApp, {
						raceId: race.id,
						resolvedAt:
							typeof raceUpdate.endTime === 'string' &&
							Number.isFinite(Date.parse(raceUpdate.endTime))
								? raceUpdate.endTime
								: new Date().toISOString(),
						invalidStateError: (message) => e.badRequestError(message, {})
					});
				} else {
					if (['settled', 'cancelled'].includes(race.getString('status'))) {
						throw e.badRequestError('Terminal races cannot be mutated.', {});
					}
					if (typeof raceUpdate.status === 'string') race.set('status', raceUpdate.status);
					if (typeof raceUpdate.winner === 'string') race.set('winner', raceUpdate.winner);
					if (typeof raceUpdate.endTime === 'string') race.set('endTime', raceUpdate.endTime);
					if (Array.isArray(raceUpdate.finishingOrder)) {
						race.set('finishingOrder', raceUpdate.finishingOrder);
					}
					txApp.save(race);
				}
			}

			committed = true;
		});

		return e.json(200, { committed });
	},
	$apis.requireAuth('users')
);

routerAdd(
	'POST',
	'/api/prl/races/void',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may void races.', {});
		}

		const body = e.requestInfo().body || {};
		const raceId = typeof body.raceId === 'string' ? body.raceId.trim() : '';
		if (!raceId) throw e.badRequestError('A raceId is required.', {});

		let result = { voided: false, refundedWagers: 0 };
		e.app.runInTransaction((txApp) => {
			result = require(`${__hooks}/wagerSettlement.cjs`).voidRace(txApp, {
				raceId,
				resolvedAt: new Date().toISOString(),
				invalidStateError: (message) => e.badRequestError(message, {})
			});
		});

		return e.json(200, result);
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

			const participants = [];
			const racerById = {};
			const trainerByRacerId = {};
			for (const racer of racers) {
				const currentRace = new DynamicModel({
					finished: false,
					finishedAt: '',
					lastUpdatedAt: '',
					trainerAtEntry: {}
				});
				racer.unmarshalJSONField('currentRace', currentRace);
				const history = new DynamicModel({
					wins: 0,
					totalRaces: 0,
					averageFinishPosition: 0,
					races: []
				});
				racer.unmarshalJSONField('raceHistory', history);
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
				let trainerAtEntry = {};
				try {
					trainerAtEntry = JSON.parse(toString(racer.get('currentRace')))?.trainerAtEntry || {};
				} catch {
					trainerAtEntry = {};
				}
				const entryStatus = trainerAtEntry.status;
				const entryTrainerId = trainerAtEntry.trainerId || '';
				trainerByRacerId[racer.id] = {
					status:
						entryStatus === 'attributed' && entryTrainerId
							? 'attributed'
							: entryStatus === 'untrained'
								? 'untrained'
								: 'unknown_legacy',
					trainerId: entryStatus === 'attributed' ? entryTrainerId : ''
				};
				participants.push({
					id: racer.id,
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
				const storedPrizeCurve = race.get('prizeCurve');
				plan = settlementRules.buildRaceSettlement({
					raceId,
					participants,
					prizeCurve: JSON.parse(toString(storedPrizeCurve))
				});
			} catch (error) {
				throw e.badRequestError(error.message, {});
			}

			let raceFormat = {};
			try {
				raceFormat = JSON.parse(toString(race.get('raceFormat'))) || {};
			} catch {
				raceFormat = {};
			}
			const seasonPointFacts = [];
			let awardedPoints;
			try {
				awardedPoints = require(`${__hooks}/leagueStandings.cjs`).pointsForRaceSettlement(
					raceFormat,
					(() => {
						try {
							return JSON.parse(toString(race.get('pointsCurve')));
						} catch {
							return [];
						}
					})(),
					plan.race.finishingOrder.length
				);
			} catch (error) {
				throw e.badRequestError(error.message, {});
			}
			if (awardedPoints) {
				const seasonId = race.getString('season');
				const leagueId = race.getString('league');
				if (!seasonId || !leagueId) {
					throw e.badRequestError('A ranked League Race requires season and points snapshots.', {});
				}

				const standingCollection = txApp.findCollectionByNameOrId('leagueStandings');
				const standingsRules = require(`${__hooks}/leagueStandings.cjs`);
				for (let index = 0; index < plan.race.finishingOrder.length; index += 1) {
					const racerId = plan.race.finishingOrder[index];
					let standing;
					try {
						standing = txApp.findFirstRecordByFilter(
							'leagueStandings',
							'season = {:seasonId} && racer = {:racerId}',
							{ seasonId, racerId }
						);
					} catch {
						standing = new Record(standingCollection);
						standing.set('season', seasonId);
						standing.set('league', leagueId);
						standing.set('racer', racerId);
					}
					const projected = standingsRules.applyLeagueRaceResult(
						{
							racerId,
							points: standing.getFloat('points'),
							starts: standing.getInt('starts'),
							wins: standing.getInt('wins'),
							podiums: standing.getInt('podiums'),
							bestFinish: standing.getInt('bestFinish'),
							recentForm: (() => {
								try {
									return JSON.parse(toString(standing.get('recentForm'))) || [];
								} catch {
									return [];
								}
							})()
						},
						{ position: index + 1, points: awardedPoints[index] }
					);
					standing.set('league', leagueId);
					standing.set('points', projected.points);
					standing.set('starts', projected.starts);
					standing.set('wins', projected.wins);
					standing.set('podiums', projected.podiums);
					standing.set('bestFinish', projected.bestFinish);
					standing.set('recentForm', projected.recentForm);
					standing.set('updatedAt', plan.race.endTime);
					txApp.save(standing);
					seasonPointFacts.push({
						standingId: standing.id,
						racerId,
						position: index + 1,
						points: awardedPoints[index]
					});
				}
			}

			for (const update of plan.racers) {
				const racer = racerById[update.id];
				racer.set('race', null);
				racer.set('stats', update.stats);
				racer.set('raceHistory', update.raceHistory);
				racer.set('financials', update.financials);
				txApp.save(racer);
			}

			const trainerResultCollection = txApp.findCollectionByNameOrId('trainerRaceResults');
			const affectedTrainerIds = {};
			const trainerResultFacts = [];
			for (const award of plan.race.awardedPrizes) {
				const attribution = trainerByRacerId[award.racerId];
				const trainerId = attribution.trainerId;
				const result = new Record(trainerResultCollection);
				result.set('race', raceId);
				result.set('racer', award.racerId);
				if (trainerId) result.set('trainer', trainerId);
				result.set('attributionStatus', attribution.status);
				result.set('position', award.position);
				result.set('earnings', award.amount);
				result.set('occurredAt', plan.race.endTime);
				txApp.save(result);
				trainerResultFacts.push({
					resultId: result.id,
					racerId: award.racerId,
					trainerId: trainerId || null,
					attributionStatus: attribution.status,
					position: award.position,
					earnings: award.amount
				});
				if (trainerId) affectedTrainerIds[trainerId] = true;
			}

			for (const trainerId of Object.keys(affectedTrainerIds)) {
				require(`${__hooks}/trainerCareer.cjs`).rebuildTrainerCareer(txApp, trainerId);
			}
			require(`${__hooks}/wagerSettlement.cjs`).resolveRaceWagers(txApp, {
				raceId,
				outcome: 'settled',
				winnerId: plan.race.winner,
				resolvedAt: plan.race.endTime
			});

			race.set('winner', plan.race.winner);
			race.set('finishingOrder', plan.race.finishingOrder);
			race.set('awardedPrizes', plan.race.awardedPrizes);
			race.set('endTime', plan.race.endTime);
			race.set('status', plan.race.status);
			txApp.save(race);

			const settlementEvent = new Record(txApp.findCollectionByNameOrId('events'));
			settlementEvent.set('type', 'RaceSettled');
			settlementEvent.set('idempotencyKey', `race-settled:${raceId}`);
			settlementEvent.set('occurredAt', plan.race.endTime);
			settlementEvent.set('raceIds', [raceId]);
			settlementEvent.set('started', true);
			settlementEvent.set('finished', true);
			settlementEvent.set('facts', {
				raceId,
				winnerId: plan.race.winner,
				finishingOrder: plan.race.finishingOrder,
				awardedPrizes: plan.race.awardedPrizes,
				trainerResults: trainerResultFacts,
				seasonPoints: seasonPointFacts
			});
			txApp.save(settlementEvent);
			settled = true;
		});

		return e.json(200, { settled });
	},
	$apis.requireAuth('users')
);
