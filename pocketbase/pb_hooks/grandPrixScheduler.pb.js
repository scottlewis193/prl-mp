/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/races/grand-prix/schedule',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError(
				'Only the simulator service account may schedule Grand Prix events.',
				{}
			);
		}
		const body = e.requestInfo().body || {};
		const requestKey = String(body.requestKey || '').trim();
		const leagueIds = Array.isArray(body.leagueIds)
			? [...new Set(body.leagueIds.map((id) => String(id).trim()).filter(Boolean))]
			: [];
		const startMs = Date.parse(String(body.startTime || '').trim());
		const entrantsPerClass = Number(body.entrantsPerClass ?? 4);
		const totalLaps = Number(body.totalLaps ?? 8);
		const prizeScale = Number(body.prizeScale ?? 1);
		const pointsEnabled = body.pointsEnabled === true;
		const pointsCurve = Array.isArray(body.pointsCurve) ? body.pointsCurve.map(Number) : [];
		const wageringEnabled = body.wageringEnabled === true;
		const schedulingSeed = String(body.schedulingSeed || 'grand-prix-calendar-v1').trim();
		if (!requestKey || requestKey.length > 60) {
			throw e.badRequestError('A valid requestKey is required.', {});
		}
		if (leagueIds.length < 2 || leagueIds.length > 10) {
			throw e.badRequestError('Grand Prix events require between two and ten league classes.', {});
		}
		if (!Number.isFinite(startMs)) throw e.badRequestError('startTime must be a valid date.', {});
		if (!Number.isInteger(entrantsPerClass) || entrantsPerClass < 1 || entrantsPerClass > 25) {
			throw e.badRequestError('entrantsPerClass is outside the supported range.', {});
		}
		if (!Number.isInteger(totalLaps) || totalLaps < 1 || totalLaps > 999) {
			throw e.badRequestError('totalLaps is outside the supported range.', {});
		}
		if (!Number.isFinite(prizeScale) || prizeScale < 0) {
			throw e.badRequestError('prizeScale must be non-negative.', {});
		}
		if (
			pointsEnabled &&
			(pointsCurve.length < entrantsPerClass ||
				pointsCurve.some((points) => !Number.isFinite(points) || points < 0))
		) {
			throw e.badRequestError('A valid points curve is required for every class place.', {});
		}
		if (!schedulingSeed || schedulingSeed.length > 100) {
			throw e.badRequestError('schedulingSeed is outside the supported range.', {});
		}

		const idempotencyKey = `grand-prix-scheduled:${requestKey}`;
		let result;
		e.app.runInTransaction((txApp) => {
			try {
				const previous = txApp.findFirstRecordByFilter(
					'events',
					'idempotencyKey = {:idempotencyKey}',
					{ idempotencyKey }
				);
				const previousRaceIds = previous.getStringSlice('raceIds');
				if (previousRaceIds.length !== 1) throw new Error('Invalid Grand Prix schedule event.');
				result = { raceId: previousRaceIds[0], eventId: previous.id, created: false };
				return;
			} catch (error) {
				if (String(error).includes('Invalid Grand Prix schedule event')) throw error;
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
					return (JSON.parse(toString(racer.get('health'))) || {}).eligible !== false;
				} catch {
					return true;
				}
			};
			const rankingOf = (racer) => {
				const stats = new DynamicModel({ ranking: 0 });
				racer.unmarshalJSONField('stats', stats);
				return Number(stats.ranking) || 0;
			};
			const leagues = leagueIds.map((leagueId) => txApp.findRecordById('leagues', leagueId));
			const entrants = [];
			const classEntries = [];
			for (const league of leagues) {
				const classEntrants = txApp
					.findRecordsByFilter(
						'racers',
						'league = {:leagueId} && race = "" && trainer != ""',
						'id',
						5000,
						0,
						{ leagueId: league.id }
					)
					.filter(isEligible)
					.sort(
						(left, right) => rankingOf(left) - rankingOf(right) || left.id.localeCompare(right.id)
					)
					.slice(0, entrantsPerClass);
				if (classEntrants.length !== entrantsPerClass) {
					throw e.badRequestError(
						`League ${league.id} does not have enough eligible Grand Prix racers.`,
						{}
					);
				}
				for (const racer of classEntrants) {
					entrants.push(racer);
					classEntries.push({
						racerId: racer.id,
						classId: league.id,
						className: league.getString('name')
					});
				}
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
			const activeSeasons = txApp.findRecordsByFilter('seasons', 'status = "active"', 'id', 2, 0);
			if (pointsEnabled && activeSeasons.length !== 1) {
				throw e.badRequestError('A ranked Grand Prix requires exactly one active season.', {});
			}

			const race = new Record(txApp.findCollectionByNameOrId('races'));
			race.set('name', `Multi-Class Grand Prix — ${new Date(startMs).toISOString()}`);
			race.set('status', 'pending');
			race.set('league', null);
			if (pointsEnabled) race.set('season', activeSeasons[0].id);
			race.set('format', 'circuit');
			race.set('raceFormat', {
				type: 'grand_prix',
				ranked: pointsEnabled,
				rulesVersion: 'grand-prix-v1'
			});
			race.set('eligibilityPolicy', {
				activeOnly: true,
				healthEligible: true,
				leagueIds,
				retired: false,
				trainerRequired: true
			});
			race.set('classEntries', classEntries);
			race.set('classResults', []);
			race.set('pointsCurve', pointsEnabled ? pointsCurve.slice(0, entrantsPerClass) : []);
			race.set('prizeScale', prizeScale);
			race.set(
				'prizeCurve',
				Array.from(
					{ length: entrantsPerClass },
					(_, index) => Math.round((entrantsPerClass - index) * prizeScale * 100) / 100
				)
			);
			race.set('movePolicy', {
				enabled: true,
				rulesVersion: 'racing-moves-v1',
				simulationSeed: `grand-prix:${schedulingSeed}:${requestKey}`
			});
			race.set('riskPolicy', {
				level: 'standard',
				incidentMultiplier: 1,
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
				currentRace.trainerAtEntry = {
					status: 'attributed',
					trainerId: racer.getString('trainer')
				};
				racer.set('currentRace', currentRace);
				racer.set('race', race.id);
				txApp.save(racer);
			}

			const event = new Record(txApp.findCollectionByNameOrId('events'));
			event.set('type', 'GrandPrix');
			event.set('scheduleKey', `GrandPrix:${requestKey}`);
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
