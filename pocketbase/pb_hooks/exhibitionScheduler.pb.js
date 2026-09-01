/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/races/exhibitions/schedule',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may schedule exhibitions.', {});
		}
		const body = e.requestInfo().body || {};
		const requestKey = String(body.requestKey || '').trim();
		const leagueId = String(body.leagueId || '').trim();
		const startTime = String(body.startTime || '').trim();
		const startMs = Date.parse(startTime);
		const entrantCount = Number(body.entrantCount ?? 8);
		const totalLaps = Number(body.totalLaps ?? 3);
		const prizeScale = Number(body.prizeScale ?? 0.25);
		const wageringEnabled = body.wageringEnabled === true;
		const schedulingSeed = String(body.schedulingSeed || 'exhibition-calendar-v1').trim();
		if (!requestKey || requestKey.length > 60) {
			throw e.badRequestError('A valid requestKey is required.', {});
		}
		if (!leagueId) throw e.badRequestError('A leagueId is required.', {});
		if (!Number.isFinite(startMs)) throw e.badRequestError('startTime must be a valid date.', {});
		if (!Number.isInteger(entrantCount) || entrantCount < 2 || entrantCount > 100) {
			throw e.badRequestError('entrantCount is outside the supported range.', {});
		}
		if (!Number.isInteger(totalLaps) || totalLaps < 1 || totalLaps > 999) {
			throw e.badRequestError('totalLaps is outside the supported range.', {});
		}
		if (!Number.isFinite(prizeScale) || prizeScale < 0 || prizeScale > 0.5) {
			throw e.badRequestError('Exhibition prizeScale must be between 0 and 0.5.', {});
		}
		if (!schedulingSeed || schedulingSeed.length > 100) {
			throw e.badRequestError('schedulingSeed is outside the supported range.', {});
		}

		const idempotencyKey = `exhibition-scheduled:${requestKey}`;
		let result;
		e.app.runInTransaction((txApp) => {
			try {
				const previous = txApp.findFirstRecordByFilter(
					'events',
					'idempotencyKey = {:idempotencyKey}',
					{ idempotencyKey }
				);
				const previousRaceIds = previous.getStringSlice('raceIds');
				if (previousRaceIds.length !== 1) throw new Error('Invalid exhibition schedule event.');
				result = { raceId: previousRaceIds[0], eventId: previous.id, created: false };
				return;
			} catch (error) {
				if (String(error).includes('Invalid exhibition schedule event')) throw error;
			}

			const statusOf = (racer) => {
				const status = new DynamicModel({ retired: false, injured: false });
				racer.unmarshalJSONField('status', status);
				return status;
			};
			const isEligible = (racer) => {
				const status = statusOf(racer);
				if (status.retired || status.injured || !racer.getString('trainer')) return false;
				try {
					const health = JSON.parse(toString(racer.get('health'))) || {};
					return health.eligible !== false;
				} catch {
					return true;
				}
			};
			const rankingOf = (racer) => {
				const stats = new DynamicModel({ ranking: 0 });
				racer.unmarshalJSONField('stats', stats);
				return Number(stats.ranking) || 0;
			};
			const snapshotTrainerEntry = (racer) => {
				let currentRace = {};
				try {
					currentRace = JSON.parse(toString(racer.get('currentRace'))) || {};
				} catch {}
				currentRace.trainerAtEntry = {
					status: 'attributed',
					trainerId: racer.getString('trainer')
				};
				racer.set('currentRace', currentRace);
			};

			const league = txApp.findRecordById('leagues', leagueId);
			const leaguePrizeScale = league.getFloat('prizeMoneyScaling');
			if (prizeScale >= leaguePrizeScale) {
				throw e.badRequestError(
					'Exhibition prizeScale must be lower than the league race prize scale.',
					{}
				);
			}
			const entrants = txApp
				.findRecordsByFilter(
					'racers',
					'league = {:leagueId} && race = "" && trainer != ""',
					'id',
					5000,
					0,
					{ leagueId }
				)
				.filter(isEligible)
				.sort(
					(left, right) => rankingOf(left) - rankingOf(right) || left.id.localeCompare(right.id)
				)
				.slice(0, entrantCount);
			if (entrants.length < 2) {
				throw e.badRequestError('At least two eligible racers are required for an exhibition.', {});
			}

			const tracks = txApp
				.findRecordsByFilter('racetracks', 'id != ""', 'id', 1000, 0)
				.map((record) => ({
					id: record.id,
					record,
					compatibleFormats: JSON.parse(toString(record.get('compatibleFormats')) || '[]')
				}));
			const selectedTrack = require(`${__hooks}/trackSelection.cjs`).selectCompatibleTrack(
				tracks,
				'circuit',
				Math.floor(startMs / (24 * 60 * 60 * 1000)),
				schedulingSeed
			);

			const race = new Record(txApp.findCollectionByNameOrId('races'));
			race.set(
				'name',
				`${league.getString('name')} Exhibition Race — ${new Date(startMs).toISOString()}`
			);
			race.set('status', 'pending');
			race.set('league', league.id);
			race.set('format', 'circuit');
			race.set('raceFormat', {
				type: 'exhibition',
				ranked: false,
				rulesVersion: 'exhibition-race-v1'
			});
			race.set('eligibilityPolicy', {
				activeOnly: true,
				healthEligible: true,
				leagueId: league.id,
				retired: false,
				trainerRequired: true
			});
			race.set('pointsCurve', []);
			race.set('prizeScale', prizeScale);
			race.set(
				'prizeCurve',
				Array.from(
					{ length: entrants.length },
					(_, index) => Math.round((entrants.length - index) * prizeScale * 100) / 100
				)
			);
			race.set('movePolicy', { enabled: false, rulesVersion: 'moves-disabled-v1' });
			race.set('riskPolicy', {
				level: 'low',
				incidentMultiplier: 0.5,
				trackRisk: selectedTrack.record.getFloat('risk')
			});
			race.set('wageringPolicy', {
				enabled: wageringEnabled,
				markets: wageringEnabled ? ['winner'] : []
			});
			race.set('racetrack', selectedTrack.id);
			race.set('startTime', new Date(startMs).toISOString());
			race.set('totalLaps', totalLaps);
			if (wageringEnabled) {
				const market = require(`${__hooks}/wager.cjs`).buildWinnerMarket(
					entrants.map((racer) => ({ racerId: racer.id, ranking: rankingOf(racer) })),
					new Date(startMs).toISOString()
				);
				race.set('bettingCutoff', new Date(startMs).toISOString());
				race.set('markets', {
					winnerType: market.type,
					winnerName: market.name,
					winnerCutoff: market.cutoff,
					winnerSelections: market.selections
				});
			} else {
				race.set('markets', {});
			}
			txApp.save(race);

			for (const racer of entrants) {
				racer.set('race', race.id);
				snapshotTrainerEntry(racer);
				txApp.save(racer);
			}

			const event = new Record(txApp.findCollectionByNameOrId('events'));
			event.set('type', 'ExhibitionRace');
			event.set('scheduleKey', `ExhibitionRace:${requestKey}`);
			event.set('idempotencyKey', idempotencyKey);
			event.set('startTime', new Date(startMs).toISOString());
			event.set('raceIds', [race.id]);
			event.set('started', false);
			event.set('finished', false);
			txApp.save(event);
			result = { raceId: race.id, eventId: event.id, created: true };
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
