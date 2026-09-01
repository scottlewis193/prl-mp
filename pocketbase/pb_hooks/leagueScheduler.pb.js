/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/schedule/reconcile',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may reconcile schedules.', {});
		}
		const schedulerTimestamp = (record, field) => {
			const value = record.getDateTime(field).string();
			return value ? Date.parse(value) : Number.NaN;
		};
		const schedulerStatus = (record) => {
			const status = new DynamicModel({ retired: false, injured: false });
			record.unmarshalJSONField('status', status);
			return status;
		};
		const schedulerEligible = (record) => {
			if (schedulerStatus(record).retired) return false;
			try {
				const health = JSON.parse(toString(record.get('health'))) || {};
				if (typeof health.eligible === 'boolean') {
					return health.eligible && !schedulerStatus(record).injured;
				}
			} catch {
				// Legacy records continue to use the status projection.
			}
			return !schedulerStatus(record).injured;
		};
		const schedulerRanking = (record) => {
			const stats = new DynamicModel({ ranking: 0 });
			record.unmarshalJSONField('stats', stats);
			return Number(stats.ranking) || 0;
		};
		const exposeWinnerMarket = (race, racers, cutoff) => {
			let wageringPolicy = {};
			try {
				wageringPolicy = JSON.parse(toString(race.get('wageringPolicy'))) || {};
			} catch {}
			if (wageringPolicy.enabled !== true || !wageringPolicy.markets?.includes('winner')) {
				race.set('bettingCutoff', null);
				race.set('markets', {});
				return;
			}
			race.set('bettingCutoff', cutoff);
			if (racers.length < 2) {
				race.set('markets', {});
				return;
			}
			const market = require(`${__hooks}/wager.cjs`).buildWinnerMarket(
				racers.map((racer) => ({ racerId: racer.id, ranking: schedulerRanking(racer) })),
				cutoff
			);
			race.set('markets', {
				winnerType: market.type,
				winnerName: market.name,
				winnerCutoff: market.cutoff,
				winnerSelections: market.selections
			});
		};
		const snapshotPrizeCurve = (race, entrantCount, scale) => {
			const places = Math.max(0, entrantCount);
			const safeScale = Math.max(0, scale);
			race.set('prizeScale', safeScale);
			race.set(
				'prizeCurve',
				Array.from({ length: places }, (_, index) => (places - index) * safeScale)
			);
		};
		const snapshotLeagueRace = (race, season, league, track) => {
			const configuredCurve = JSON.parse(toString(season.get('pointsCurve')) || '[]');
			if (
				!Array.isArray(configuredCurve) ||
				configuredCurve.some((points) => !Number.isFinite(Number(points)) || Number(points) < 0)
			) {
				throw new Error(`Season ${season.id} has an invalid points curve.`);
			}
			race.set('season', season.id);
			race.set('raceFormat', {
				type: 'league_race',
				ranked: true,
				rulesVersion: season.getString('rulesVersion')
			});
			race.set('pointsCurve', configuredCurve.map(Number));
			race.set('eligibilityPolicy', {
				activeOnly: true,
				healthEligible: true,
				leagueId: league.id,
				retired: false,
				trainerRequired: true
			});
			race.set('movePolicy', { enabled: false, rulesVersion: 'moves-disabled-v1' });
			race.set('riskPolicy', {
				level: 'standard',
				incidentMultiplier: 1,
				trackRisk: track.getFloat('risk')
			});
			race.set('wageringPolicy', { enabled: true, markets: ['winner'] });
		};
		const ensureSeasonStanding = (txApp, seasonId, racer) => {
			try {
				txApp.findFirstRecordByFilter(
					'leagueStandings',
					'season = {:seasonId} && racer = {:racerId}',
					{ seasonId, racerId: racer.id }
				);
				return;
			} catch {
				const standing = new Record(txApp.findCollectionByNameOrId('leagueStandings'));
				standing.set('season', seasonId);
				standing.set('league', racer.getString('league'));
				standing.set('racer', racer.id);
				standing.set('points', 0);
				standing.set('starts', 0);
				standing.set('wins', 0);
				standing.set('podiums', 0);
				standing.set('bestFinish', 0);
				standing.set('recentForm', []);
				txApp.save(standing);
			}
		};
		const snapshotTrainerEntry = (racer) => {
			let currentRace = {};
			try {
				currentRace = JSON.parse(toString(racer.get('currentRace'))) || {};
			} catch {
				currentRace = {};
			}
			const trainerId = racer.getString('trainer');
			currentRace.trainerAtEntry = trainerId
				? { status: 'attributed', trainerId }
				: { status: 'untrained' };
			racer.set('currentRace', currentRace);
		};

		const body = e.requestInfo().body || {};
		const nowMs = body.now === undefined ? Date.now() : Date.parse(body.now);
		if (!Number.isFinite(nowMs)) throw e.badRequestError('now must be a valid date.', {});

		const futureEventCount = Number(body.futureEventCount ?? 5);
		const eventIntervalMs = Number(body.eventIntervalMs ?? 24 * 60 * 60 * 1000);
		const scheduleOffsetMs = Number(body.scheduleOffsetMs ?? 14 * 60 * 60 * 1000);
		const countdownMs = Number(body.countdownMs ?? 5 * 60 * 1000);
		const totalLaps = Number(body.totalLaps ?? 5);
		const raceFormat = require(`${__hooks}/trackSelection.cjs`).normalizeRaceFormat(body.format);
		const schedulingSeed =
			typeof body.schedulingSeed === 'string' && body.schedulingSeed.trim()
				? body.schedulingSeed.trim()
				: 'league-calendar-v1';
		if (!Number.isInteger(futureEventCount) || futureEventCount < 1 || futureEventCount > 30) {
			throw e.badRequestError('futureEventCount is outside the supported range.', {});
		}
		if (
			!Number.isInteger(eventIntervalMs) ||
			eventIntervalMs < 60 * 1000 ||
			eventIntervalMs > 30 * 24 * 60 * 60 * 1000
		) {
			throw e.badRequestError('eventIntervalMs is outside the supported range.', {});
		}
		if (
			!Number.isInteger(scheduleOffsetMs) ||
			scheduleOffsetMs < 0 ||
			scheduleOffsetMs >= eventIntervalMs
		) {
			throw e.badRequestError('scheduleOffsetMs is outside the supported range.', {});
		}
		if (!Number.isInteger(countdownMs) || countdownMs < 0 || countdownMs > eventIntervalMs) {
			throw e.badRequestError('countdownMs is outside the supported range.', {});
		}
		if (!Number.isInteger(totalLaps) || totalLaps < 1 || totalLaps > 999) {
			throw e.badRequestError('totalLaps is outside the supported range.', {});
		}
		if (schedulingSeed.length > 100) {
			throw e.badRequestError('schedulingSeed is outside the supported range.', {});
		}

		const result = {
			createdEvents: 0,
			createdRaces: 0,
			assignedRacers: 0,
			transitionedRaces: 0
		};

		try {
			e.app.runInTransaction((txApp) => {
				const activeSeasons = txApp.findRecordsByFilter('seasons', 'status = "active"', 'id', 2, 0);
				if (activeSeasons.length !== 1) {
					throw e.badRequestError(
						'Exactly one active season is required to schedule League Races.',
						{}
					);
				}
				const activeSeason = activeSeasons[0];
				const events = txApp
					.findAllRecords('events')
					.filter((event) => !event.getBool('finished'))
					.sort(
						(left, right) =>
							schedulerTimestamp(left, 'startTime') - schedulerTimestamp(right, 'startTime') ||
							left.id.localeCompare(right.id)
					);
				const eventByScheduleKey = {};
				const eventByStartTime = {};
				const leagues = txApp.findRecordsByFilter('leagues', 'id != ""', 'minRanking,id', 1000, 0);
				const leagueById = {};
				for (const league of leagues) leagueById[league.id] = league;
				const leagueRacers = txApp
					.findRecordsByFilter('racers', 'league != "" && trainer != ""', 'id', 5000, 0)
					.filter((racer) => {
						const status = schedulerStatus(racer);
						return !status.retired;
					});
				for (const racer of leagueRacers) ensureSeasonStanding(txApp, activeSeason.id, racer);
				const availableRacers = leagueRacers
					.filter((racer) => !racer.getString('race') && schedulerEligible(racer))
					.map((racer) => ({ racer, ranking: schedulerRanking(racer) }))
					.sort(
						(left, right) =>
							left.ranking - right.ranking || left.racer.id.localeCompare(right.racer.id)
					);
				const takeAvailableRacers = (leagueId, count) => {
					const selected = [];
					for (let index = 0; index < availableRacers.length && selected.length < count; ) {
						const candidate = availableRacers[index];
						if (candidate.racer.getString('league') === leagueId) {
							selected.push(candidate.racer);
							availableRacers.splice(index, 1);
						} else {
							index += 1;
						}
					}
					return selected;
				};

				for (const event of events) {
					const eventStartMs = schedulerTimestamp(event, 'startTime');
					const scheduleKey = event.getString('scheduleKey');
					if (scheduleKey) eventByScheduleKey[scheduleKey] = event;
					if (Number.isFinite(eventStartMs)) eventByStartTime[eventStartMs] = event;

					const raceIds = event.getStringSlice('raceIds');
					let allTerminal = raceIds.length > 0;
					for (const raceId of raceIds) {
						const race = txApp.findRecordById('races', raceId);
						const currentStatus = race.getString('status');
						let nextStatus = currentStatus;
						let scheduledRacers;
						if (currentStatus === 'pending' || currentStatus === 'countdown') {
							scheduledRacers = txApp.findRecordsByFilter(
								'racers',
								'race = {:raceId}',
								'id',
								1000,
								0,
								{ raceId }
							);
							for (let index = scheduledRacers.length - 1; index >= 0; index -= 1) {
								const racer = scheduledRacers[index];
								if (schedulerEligible(racer)) continue;
								racer.set('race', null);
								txApp.save(racer);
								scheduledRacers.splice(index, 1);
							}
							const league = leagueById[race.getString('league')];
							let racePolicy = {};
							try {
								racePolicy = JSON.parse(toString(race.get('raceFormat'))) || {};
							} catch {}
							if (league && racePolicy.type === 'league_race') {
								const capacity = Math.max(1, league.getInt('maxPlayers'));
								const backfill = takeAvailableRacers(league.id, capacity - scheduledRacers.length);
								for (const racer of backfill) {
									racer.set('race', race.id);
									snapshotTrainerEntry(racer);
									txApp.save(racer);
									scheduledRacers.push(racer);
									result.assignedRacers += 1;
								}
							}
							exposeWinnerMarket(race, scheduledRacers, new Date(eventStartMs).toISOString());
							txApp.save(race);
						}
						if (
							Number.isFinite(eventStartMs) &&
							nowMs >= eventStartMs &&
							(currentStatus === 'pending' || currentStatus === 'countdown')
						) {
							const racers = scheduledRacers || [];
							nextStatus = racers.length > 0 ? 'running' : 'cancelled';
							if (nextStatus === 'running') {
								const scheduledStart = new Date(eventStartMs).toISOString();
								for (const racer of racers) {
									const currentRace = new DynamicModel({
										lapsCompleted: 0,
										checkpointIndex: 0,
										distanceFromCheckpoint: 0,
										lastUpdatedAt: '',
										finished: false,
										finishedAt: '',
										lapStartTime: 0,
										lapTimes: {},
										bestLapTime: 0,
										trainerAtEntry: {}
									});
									racer.unmarshalJSONField('currentRace', currentRace);
									currentRace.lapsCompleted = 0;
									currentRace.checkpointIndex = 0;
									currentRace.distanceFromCheckpoint = 0;
									currentRace.lastUpdatedAt = scheduledStart;
									currentRace.finished = false;
									currentRace.finishedAt = '';
									currentRace.lapStartTime = 0;
									currentRace.lapTimes = {};
									currentRace.bestLapTime = 0;
									racer.set('currentRace', currentRace);
									txApp.save(racer);
								}
							}
						} else if (
							Number.isFinite(eventStartMs) &&
							nowMs >= eventStartMs - countdownMs &&
							currentStatus === 'pending'
						) {
							nextStatus = 'countdown';
						}

						if (nextStatus !== currentStatus) {
							if (nextStatus === 'cancelled') {
								require(`${__hooks}/wagerSettlement.cjs`).voidRace(txApp, {
									raceId: race.id,
									resolvedAt: new Date(nowMs).toISOString()
								});
							} else {
								race.set('status', nextStatus);
								txApp.save(race);
							}
							result.transitionedRaces += 1;
						}
						if (!['finished', 'cancelled', 'settled'].includes(nextStatus)) allTerminal = false;
					}

					const shouldBeStarted = Number.isFinite(eventStartMs) && nowMs >= eventStartMs;
					if (
						event.getBool('started') !== shouldBeStarted ||
						event.getBool('finished') !== allTerminal
					) {
						event.set('started', shouldBeStarted);
						event.set('finished', allTerminal);
						txApp.save(event);
					}
				}

				let futureEvents = events.filter(
					(event) => schedulerTimestamp(event, 'startTime') > nowMs
				).length;
				let slotMs =
					Math.floor((nowMs - scheduleOffsetMs) / eventIntervalMs) * eventIntervalMs +
					scheduleOffsetMs;
				if (slotMs <= nowMs) slotMs += eventIntervalMs;

				const racetracks = txApp
					.findRecordsByFilter('racetracks', 'id != ""', 'id', 1000, 0)
					.map((record) => {
						const storedFormats = JSON.parse(toString(record.get('compatibleFormats')) || '[]');
						return { id: record.id, record, compatibleFormats: storedFormats };
					});
				if (racetracks.length === 0) {
					throw e.badRequestError(
						'At least one racetrack is required to schedule league races.',
						{}
					);
				}

				while (futureEvents < futureEventCount) {
					const scheduleKey = `DailyLeagueRaces:${slotMs}`;
					if (eventByScheduleKey[scheduleKey] || eventByStartTime[slotMs]) {
						slotMs += eventIntervalMs;
						continue;
					}

					const raceIds = [];
					let trackSelectionIndex = Math.floor(slotMs / eventIntervalMs);
					for (const league of leagues) {
						const capacity = Math.max(1, league.getInt('maxPlayers'));
						const selected = takeAvailableRacers(league.id, capacity);

						const race = new Record(txApp.findCollectionByNameOrId('races'));
						const selectedTrack = require(`${__hooks}/trackSelection.cjs`).selectCompatibleTrack(
							racetracks,
							raceFormat,
							trackSelectionIndex++,
							schedulingSeed
						);
						race.set(
							'name',
							`${league.getString('name')} Race — ${new Date(slotMs).toISOString()}`
						);
						race.set('status', 'pending');
						race.set('league', league.id);
						race.set('format', raceFormat);
						race.set('racetrack', selectedTrack.id);
						race.set('startTime', new Date(slotMs).toISOString());
						race.set('totalLaps', totalLaps);
						snapshotLeagueRace(race, activeSeason, league, selectedTrack.record);
						snapshotPrizeCurve(race, capacity, league.getFloat('prizeMoneyScaling'));
						exposeWinnerMarket(race, selected, new Date(slotMs).toISOString());
						txApp.save(race);
						raceIds.push(race.id);
						result.createdRaces += 1;

						for (const racer of selected) {
							racer.set('race', race.id);
							snapshotTrainerEntry(racer);
							txApp.save(racer);
							result.assignedRacers += 1;
						}
					}

					const event = new Record(txApp.findCollectionByNameOrId('events'));
					event.set('type', 'DailyLeagueRaces');
					event.set('scheduleKey', scheduleKey);
					event.set('startTime', new Date(slotMs).toISOString());
					event.set('raceIds', raceIds);
					event.set('started', false);
					event.set('finished', false);
					txApp.save(event);
					eventByScheduleKey[scheduleKey] = event;
					eventByStartTime[slotMs] = event;
					result.createdEvents += 1;
					futureEvents += 1;
					slotMs += eventIntervalMs;
				}
			});
		} catch (error) {
			e.app.logger().error('League schedule transaction failed', 'error', String(error));
			throw error;
		}

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
