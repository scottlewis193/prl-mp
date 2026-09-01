/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/races/legends/schedule',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError(
				'Only the simulator service account may schedule Legends Exhibitions.',
				{}
			);
		}
		const body = e.requestInfo().body || {};
		const requestKey = String(body.requestKey || '').trim();
		const leagueId = String(body.leagueId || '').trim();
		const startTime = String(body.startTime || '').trim();
		const startMs = Date.parse(startTime);
		const racerIds = Array.isArray(body.racerIds)
			? body.racerIds.map((racerId) => String(racerId).trim()).filter(Boolean)
			: [];
		const totalLaps = Number(body.totalLaps ?? 3);
		const prizeScale = Number(body.prizeScale ?? 0.1);
		const wageringEnabled = body.wageringEnabled === true;
		const schedulingSeed = String(body.schedulingSeed || 'legends-calendar-v1').trim();
		if (!requestKey || requestKey.length > 60) {
			throw e.badRequestError('A valid requestKey is required.', {});
		}
		if (!leagueId) throw e.badRequestError('A leagueId is required.', {});
		if (!Number.isFinite(startMs)) throw e.badRequestError('startTime must be a valid date.', {});
		if (
			racerIds.length < 2 ||
			racerIds.length > 100 ||
			new Set(racerIds).size !== racerIds.length
		) {
			throw e.badRequestError('Between two and 100 unique racerIds are required.', {});
		}
		if (!Number.isInteger(totalLaps) || totalLaps < 1 || totalLaps > 999) {
			throw e.badRequestError('totalLaps is outside the supported range.', {});
		}
		if (!Number.isFinite(prizeScale) || prizeScale < 0 || prizeScale > 0.5) {
			throw e.badRequestError('Legends prizeScale must be between 0 and 0.5.', {});
		}
		if (!schedulingSeed || schedulingSeed.length > 100) {
			throw e.badRequestError('schedulingSeed is outside the supported range.', {});
		}

		const idempotencyKey = `legends-exhibition-scheduled:${requestKey}`;
		let result;
		e.app.runInTransaction((txApp) => {
			try {
				const previous = txApp.findFirstRecordByFilter(
					'events',
					'idempotencyKey = {:idempotencyKey}',
					{ idempotencyKey }
				);
				const previousRaceIds = previous.getStringSlice('raceIds');
				if (previousRaceIds.length !== 1) {
					throw new Error('Invalid Legends Exhibition schedule event.');
				}
				result = { raceId: previousRaceIds[0], eventId: previous.id, created: false };
				return;
			} catch (error) {
				if (String(error).includes('Invalid Legends Exhibition schedule event')) throw error;
			}

			const statusOf = (racer) => {
				const status = new DynamicModel({ retired: false, injured: false });
				racer.unmarshalJSONField('status', status);
				return status;
			};
			const rankingOf = (racer) => {
				const stats = new DynamicModel({ ranking: 0 });
				racer.unmarshalJSONField('stats', stats);
				return Number(stats.ranking) || 0;
			};
			const entrants = racerIds.map((racerId) => txApp.findRecordById('racers', racerId));
			if (
				entrants.some(
					(racer) =>
						!statusOf(racer).retired ||
						Boolean(racer.getString('race')) ||
						Boolean(racer.getString('trainer')) ||
						Boolean(racer.getString('league'))
				)
			) {
				throw e.badRequestError(
					'Only retired racers are eligible for a Legends Exhibition and they must be outside active competition.',
					{}
				);
			}

			const league = txApp.findRecordById('leagues', leagueId);
			if (prizeScale >= league.getFloat('prizeMoneyScaling')) {
				throw e.badRequestError(
					'Legends prizeScale must be lower than the host league race prize scale.',
					{}
				);
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
				`${league.getString('name')} Legends Exhibition — ${new Date(startMs).toISOString()}`
			);
			race.set('status', 'pending');
			race.set('league', league.id);
			race.set('format', 'circuit');
			race.set('raceFormat', {
				type: 'legends_exhibition',
				ranked: false,
				rulesVersion: 'legends-exhibition-v1'
			});
			race.set('eligibilityPolicy', {
				activeOnly: false,
				healthEligible: false,
				leagueId: league.id,
				retired: true,
				trainerRequired: false
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
				incidentMultiplier: 0.25,
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
				let currentRace = {};
				try {
					currentRace = JSON.parse(toString(racer.get('currentRace'))) || {};
				} catch {}
				currentRace.trainerAtEntry = { status: 'untrained', trainerId: '' };
				racer.set('race', race.id);
				racer.set('currentRace', currentRace);
				txApp.save(racer);
			}

			const event = new Record(txApp.findCollectionByNameOrId('events'));
			event.set('type', 'LegendsExhibition');
			event.set('scheduleKey', `LegendsExhibition:${requestKey}`);
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
