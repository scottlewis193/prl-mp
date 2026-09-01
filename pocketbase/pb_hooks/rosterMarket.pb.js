/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/rosters/process',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may process roster changes.', {});
		}
		const body = e.requestInfo().body || {};
		const nowMs = body.now === undefined ? Date.now() : Date.parse(body.now);
		const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
		const requestedTrainerIds = Array.isArray(body.trainerIds) ? body.trainerIds.map(String) : null;
		const minimumPoolSize = Math.max(0, Math.floor(Number(body.minimumPoolSize ?? 10)));
		const targetPoolSize = Math.max(minimumPoolSize, Math.floor(Number(body.targetPoolSize ?? 25)));
		if (
			!Number.isFinite(nowMs) ||
			!seed ||
			seed.length > 200 ||
			requestedTrainerIds?.length > 1000 ||
			!Number.isFinite(minimumPoolSize) ||
			!Number.isFinite(targetPoolSize) ||
			targetPoolSize > 1000
		) {
			throw e.badRequestError(
				'A valid now, seed, trainer list, and pool configuration are required.',
				{}
			);
		}
		const occurredAt = new Date(nowMs).toISOString();
		const processingDay = occurredAt.slice(0, 10);
		const result = { signedRacers: 0, releasedRacers: 0, createdFreeAgents: 0 };

		const jsonField = (record, name, fallback) => {
			try {
				const parsed = JSON.parse(toString(record.get(name)));
				return parsed === null ? fallback : parsed;
			} catch {
				return fallback;
			}
		};
		const namedRelation = (txApp, collection, id) => {
			if (!id) return null;
			const record = txApp.findRecordById(collection, id);
			return { id, name: record.getString('name') };
		};
		const hasEvent = (txApp, key) => {
			try {
				txApp.findFirstRecordByFilter('events', 'idempotencyKey = {:key}', { key });
				return true;
			} catch {
				return false;
			}
		};
		const activeRace = (txApp, racer) => {
			const raceId = racer.getString('race');
			if (!raceId) return false;
			const status = txApp.findRecordById('races', raceId).getString('status');
			return ['countdown', 'running', 'finished'].includes(status);
		};
		const candidateFact = (racer) => {
			const status = jsonField(racer, 'status', {});
			const health = jsonField(racer, 'health', {});
			const traits = jsonField(racer, 'traits', {});
			const financials = jsonField(racer, 'financials', {});
			const history = jsonField(racer, 'raceHistory', {});
			const careerStartedAt = racer.getDateTime('careerStartedAt').string();
			return {
				id: racer.id,
				trainerId: racer.getString('trainer'),
				leagueId: racer.getString('league'),
				price: Number(financials.currentSharePrice) || 0,
				healthEligible: health.eligible !== false,
				ageDays: Number.isFinite(Date.parse(careerStartedAt))
					? Math.max(0, Math.floor((nowMs - Date.parse(careerStartedAt)) / 86400000))
					: 0,
				ranking: Number(jsonField(racer, 'stats', {}).ranking) || 0,
				recentFinishes: (Array.isArray(history.races) ? history.races : []).map(
					(entry) => entry.position
				),
				potential: Number(traits.potential) || 0,
				retired: status.retired === true
			};
		};
		const saveNews = (txApp, event, facts) => {
			const story = require(`${__hooks}/rosterNews.cjs`).buildRosterStory({
				...facts,
				eventId: event.id,
				occurredAt
			});
			const news = new Record(txApp.findCollectionByNameOrId('news'));
			news.set('sourceEvent', event.id);
			news.set('racers', [facts.racer.id]);
			news.set('trainers', [facts.trainer.id]);
			if (facts.league) news.set('league', facts.league.id);
			news.set('category', story.category);
			news.set('importance', story.importance);
			news.set('publishedAt', story.publishedAt);
			news.set('headline', story.headline);
			news.set('summary', story.summary);
			news.set('templateVersion', story.templateVersion);
			news.set('links', story.links);
			txApp.save(news);
		};
		const applyRosterChange = (txApp, input) => {
			const eventKey = `roster:${processingDay}:${input.transition}:${input.racer.id}`;
			if (hasEvent(txApp, eventKey)) return false;
			const event = new Record(txApp.findCollectionByNameOrId('events'));
			event.set('type', input.transition === 'signing' ? 'RacerSigned' : 'RacerReleased');
			event.set('idempotencyKey', eventKey);
			event.set('occurredAt', occurredAt);
			event.set('started', true);
			event.set('finished', true);
			event.set('facts', {});
			txApp.save(event);

			const financials = jsonField(input.racer, 'financials', {});
			const valuation = require(`${__hooks}/rosterMarket.cjs`).buildRosterPricePoint({
				transition: input.transition,
				previousPrice: financials.currentSharePrice,
				occurredAt,
				sourceEvent: event.id,
				trainerId: input.trainer.id
			});
			financials.currentSharePrice = valuation.price;
			financials.priceHistory = [
				...(Array.isArray(financials.priceHistory) ? financials.priceHistory : []),
				valuation
			];
			input.racer.set('financials', financials);
			input.racer.set('race', null);
			input.racer.set('trainer', input.transition === 'signing' ? input.trainer.id : null);
			input.racer.set('league', input.transition === 'signing' ? input.league.id : null);
			txApp.save(input.racer);

			const history = new Record(txApp.findCollectionByNameOrId('rosterHistory'));
			history.set('racer', input.racer.id);
			history.set('trainer', input.trainer.id);
			history.set('league', input.league.id);
			history.set('type', input.transition);
			history.set('occurredAt', occurredAt);
			history.set('sourceEvent', event.id);
			history.set('decision', input.decision);
			history.set('valuation', valuation);
			txApp.save(history);

			const facts = {
				transition: input.transition,
				racer: { id: input.racer.id, name: input.racer.getString('name') },
				trainer: { id: input.trainer.id, name: input.trainer.getString('name') },
				league: { id: input.league.id, name: input.league.getString('name') },
				price: valuation.price,
				decision: input.decision,
				valuation
			};
			event.set('facts', facts);
			txApp.save(event);
			saveNews(txApp, event, facts);
			return true;
		};

		try {
			e.app.runInTransaction((txApp) => {
				let freeAgents = txApp
					.findRecordsByFilter('racers', 'trainer = "" && league = ""', 'id', 5000, 0)
					.filter((racer) => !jsonField(racer, 'status', {}).retired);
				const trainers = (
					requestedTrainerIds === null
						? txApp.findAllRecords('trainers')
						: requestedTrainerIds.map((id) => txApp.findRecordById('trainers', id))
				).sort((left, right) => left.id.localeCompare(right.id));

				for (const trainer of trainers) {
					let roster = txApp
						.findRecordsByFilter('racers', 'trainer = {:trainerId}', 'id', 5000, 0, {
							trainerId: trainer.id
						})
						.filter((racer) => !jsonField(racer, 'status', {}).retired);
					const capacity = Math.max(1, trainer.getInt('rosterCapacity'));
					let leagueId = roster.map((racer) => racer.getString('league')).find(Boolean) || '';
					const healthyFreeAgentExists = freeAgents.some(
						(racer) => jsonField(racer, 'health', {}).eligible !== false
					);
					const releasable = roster
						.filter((racer) => !activeRace(txApp, racer))
						.sort((left, right) => {
							const leftEligible = jsonField(left, 'health', {}).eligible !== false;
							const rightEligible = jsonField(right, 'health', {}).eligible !== false;
							return (
								Number(leftEligible) - Number(rightEligible) || left.id.localeCompare(right.id)
							);
						});
					while (
						releasable.length &&
						(roster.length > capacity ||
							(healthyFreeAgentExists && jsonField(releasable[0], 'health', {}).eligible === false))
					) {
						const racer = releasable.shift();
						const racerLeagueId = racer.getString('league');
						if (!leagueId) leagueId = racerLeagueId;
						const league = txApp.findRecordById('leagues', racerLeagueId);
						if (
							applyRosterChange(txApp, {
								transition: 'release',
								racer,
								trainer,
								league,
								decision: {
									reason: roster.length > capacity ? 'capacity_exceeded' : 'health_ineligible',
									rosterSize: roster.length,
									rosterCapacity: capacity,
									healthEligible: jsonField(racer, 'health', {}).eligible !== false,
									rulesVersion: 'roster-market-v1'
								}
							})
						) {
							result.releasedRacers += 1;
							freeAgents.push(racer);
						}
						roster = roster.filter((entry) => entry.id !== racer.id);
					}

					if (!leagueId) continue;
					const league = txApp.findRecordById('leagues', leagueId);
					while (roster.length < capacity) {
						const selection = require(`${__hooks}/rosterMarket.cjs`).selectSigningCandidate({
							trainer: {
								id: trainer.id,
								budget: trainer.getFloat('budget'),
								rosterCapacity: capacity
							},
							league: {
								id: league.id,
								minRanking: league.getFloat('minRanking'),
								maxRanking: league.getFloat('maxRanking')
							},
							rosterSize: roster.length,
							candidates: freeAgents.map(candidateFact),
							seed
						});
						if (!selection) break;
						const racer = freeAgents.find((entry) => entry.id === selection.candidateId);
						if (!racer) break;
						const signingPrice = Number(jsonField(racer, 'financials', {}).currentSharePrice) || 0;
						if (
							!applyRosterChange(txApp, {
								transition: 'signing',
								racer,
								trainer,
								league,
								decision: selection
							})
						)
							break;
						trainer.set('budget', Math.max(0, trainer.getFloat('budget') - signingPrice));
						txApp.save(trainer);
						result.signedRacers += 1;
						roster.push(racer);
						freeAgents = freeAgents.filter((entry) => entry.id !== racer.id);
					}
				}

				const allRacers = txApp.findAllRecords('racers');
				const existingSpeciesIds = allRacers
					.map((racer) => racer.getString('pokemon'))
					.filter(Boolean);
				const retiredSpeciesIds = allRacers
					.filter((racer) => jsonField(racer, 'status', {}).retired)
					.map((racer) => racer.getString('pokemon'))
					.filter(Boolean);
				const species = txApp
					.findAllRecords('pokemon')
					.sort((left, right) => left.id.localeCompare(right.id));
				const plans = require(`${__hooks}/rosterMarket.cjs`).planFreeAgentReplenishment({
					currentPoolSize: freeAgents.length,
					minimumPoolSize,
					targetPoolSize,
					seed,
					existingSpeciesIds,
					retiredSpeciesIds,
					eligibleSpeciesIds: species.map((entry) => entry.id)
				});
				for (const plan of plans) {
					const eventKey = `free-agent:${processingDay}:${plan.speciesId}`;
					if (hasEvent(txApp, eventKey)) continue;
					const pokemon = txApp.findRecordById('pokemon', plan.speciesId);
					const stats = jsonField(pokemon, 'stats', {});
					const event = new Record(txApp.findCollectionByNameOrId('events'));
					event.set('type', 'FreeAgentCreated');
					event.set('idempotencyKey', eventKey);
					event.set('occurredAt', occurredAt);
					event.set('started', true);
					event.set('finished', true);
					event.set('facts', {});
					txApp.save(event);

					const racer = new Record(txApp.findCollectionByNameOrId('racers'));
					racer.set('name', `${pokemon.getString('name')} Prospect`);
					racer.set('pokemon', pokemon.id);
					racer.set('generationSeed', plan.generationSeed);
					racer.set('traitRulesVersion', 'racer-traits-v1');
					racer.set('careerStartedAt', occurredAt);
					racer.set('careerLoad', 0);
					const traits = require(`${__hooks}/rosterMarket.cjs`).generateRosterRacerTraits(
						pokemon.id,
						plan.generationSeed
					);
					racer.set('traits', traits);
					racer.set('health', { eligible: true, performanceMultiplier: 1, activeConditionIds: [] });
					racer.set('status', { retired: false, injured: false });
					racer.set('stats', {
						hp: Number(stats.hp) || pokemon.getFloat('hp'),
						attack: Number(stats.attack) || pokemon.getFloat('attack'),
						defense: Number(stats.defense) || pokemon.getFloat('defense'),
						speed: Number(stats.speed) || pokemon.getFloat('speed'),
						level: 1,
						ranking: existingSpeciesIds.length + result.createdFreeAgents + 1,
						gender: traits.temperament % 2 ? 'male' : 'female'
					});
					racer.set('currentRace', {
						lapsCompleted: 0,
						checkpointIndex: 0,
						distanceFromCheckpoint: 0,
						lastUpdatedAt: '',
						finished: false,
						lapTimes: {}
					});
					racer.set('raceHistory', { wins: 0, totalRaces: 0, averageFinishPosition: 0, races: [] });
					racer.set('positioning', { x: 0, y: 0, trackOffset: 0, targetTrackOffset: 0 });
					racer.set('ownership', { totalShares: 1000, shareholders: [] });
					const openingPrice = Math.max(
						1,
						Math.round(((Number(stats.baseStatTotal) || 400) / 40) * 100) / 100
					);
					racer.set('financials', {
						totalEarnings: 0,
						earningsPerShare: 0,
						issuedShares: 1000,
						outstandingShares: 1000,
						currentSharePrice: openingPrice,
						priceHistory: [
							{
								timestamp: occurredAt,
								price: openingPrice,
								reason: 'free_agent_created',
								rulesVersion: 'roster-market-v1',
								sourceEvent: event.id
							}
						]
					});
					txApp.save(racer);
					event.set('facts', {
						racerId: racer.id,
						speciesId: pokemon.id,
						generationSeed: plan.generationSeed,
						rulesVersion: 'roster-market-v1'
					});
					txApp.save(event);
					freeAgents.push(racer);
					result.createdFreeAgents += 1;
				}
			});
		} catch (error) {
			throw e.badRequestError(`Roster processing failed: ${error}`, {});
		}
		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
