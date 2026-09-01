/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/health/process',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may process racer health.', {});
		}
		const body = e.requestInfo().body || {};
		const nowMs = body.now === undefined ? Date.now() : Date.parse(body.now);
		const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
		const requestedIds = Array.isArray(body.racerIds) ? body.racerIds.map(String) : [];
		if (!Number.isFinite(nowMs) || !seed || seed.length > 200 || requestedIds.length > 1000) {
			throw e.badRequestError('A valid now, seed, and racer list are required.', {});
		}
		const occurredAt = new Date(nowMs).toISOString();
		const trackRisk = Number(body.trackRisk) || 0;
		const eventRisk = Number(body.eventRisk) || 0;
		const result = { createdConditions: 0, recoveredConditions: 0 };

		const jsonField = (record, name, fallback) => {
			try {
				const parsed = JSON.parse(toString(record.get(name)));
				return parsed === null ? fallback : parsed;
			} catch {
				return fallback;
			}
		};
		const eventExists = (txApp, idempotencyKey) => {
			try {
				txApp.findFirstRecordByFilter('events', 'idempotencyKey = {:key}', { key: idempotencyKey });
				return true;
			} catch {
				return false;
			}
		};
		const activeConditions = (txApp, racerId) =>
			txApp.findRecordsByFilter(
				'healthConditions',
				'racer = {:racerId} && recoveredAt = ""',
				'onsetAt,id',
				1000,
				0,
				{ racerId }
			);
		const createHealthEvent = (txApp, type, idempotencyKey) => {
			const event = new Record(txApp.findCollectionByNameOrId('events'));
			event.set('type', type);
			event.set('idempotencyKey', idempotencyKey);
			event.set('occurredAt', occurredAt);
			event.set('started', true);
			event.set('finished', true);
			event.set('facts', {});
			txApp.save(event);
			return event;
		};
		const projectHealth = (racer, conditions) => {
			const healthRules = require(`${__hooks}/racerHealth.cjs`);
			const effects = conditions.map((condition) => ({
				eligibilityEffect: condition.getString('eligibilityEffect'),
				performanceMultiplier: condition.getFloat('performanceMultiplier')
			}));
			const multiplier = healthRules.healthPerformanceMultiplier(effects);
			racer.set('health', {
				eligible: multiplier > 0,
				performanceMultiplier: multiplier > 0 ? multiplier : 1,
				activeConditionIds: conditions.map((condition) => condition.id)
			});
			const status = jsonField(racer, 'status', { retired: false, injured: false });
			status.injured = multiplier === 0;
			racer.set('status', status);
		};
		const appendValuation = (racer, condition, transition, sourceEvent) => {
			const financials = jsonField(racer, 'financials', {
				currentSharePrice: 10,
				priceHistory: []
			});
			const pricePoint = require(`${__hooks}/racerHealth.cjs`).buildHealthPricePoint({
				conditionId: condition.id,
				transition,
				severity: condition.getString('severity'),
				previousPrice: Number(financials.currentSharePrice) || 10,
				occurredAt,
				sourceEvent: sourceEvent.id
			});
			financials.currentSharePrice = pricePoint.price;
			financials.priceHistory = [...(financials.priceHistory || []), pricePoint];
			racer.set('financials', financials);
			return pricePoint;
		};
		const healthContext = (txApp, racer, condition) => {
			let trainer = null;
			let league = null;
			const trainerId = racer.getString('trainer');
			const leagueId = racer.getString('league');
			if (trainerId) {
				const record = txApp.findRecordById('trainers', trainerId);
				trainer = { id: trainerId, name: record.getString('name') };
			}
			if (leagueId) {
				const record = txApp.findRecordById('leagues', leagueId);
				league = { id: leagueId, name: record.getString('name') };
			}
			return {
				racer: {
					id: racer.id,
					name: racer.getString('name'),
					eligible: jsonField(racer, 'health', {}).eligible !== false
				},
				trainer,
				league,
				condition: {
					id: condition.id,
					kind: condition.getString('kind'),
					severity: condition.getString('severity'),
					cause: condition.getString('cause'),
					onsetAt: condition.getDateTime('onsetAt').string(),
					expectedRecoveryAt: condition.getDateTime('expectedRecoveryAt').string(),
					eligibilityEffect: condition.getString('eligibilityEffect')
				}
			};
		};
		const publishNews = (txApp, event, context, transition) => {
			const story = require(`${__hooks}/healthNews.cjs`).buildHealthStory({
				eventId: event.id,
				occurredAt,
				transition,
				...context
			});
			const news = new Record(txApp.findCollectionByNameOrId('news'));
			news.set('sourceEvent', event.id);
			news.set('racers', [context.racer.id]);
			if (context.trainer) news.set('trainers', [context.trainer.id]);
			if (context.league) news.set('league', context.league.id);
			news.set('category', story.category);
			news.set('importance', story.importance);
			news.set('publishedAt', story.publishedAt);
			news.set('headline', story.headline);
			news.set('summary', story.summary);
			news.set('templateVersion', story.templateVersion);
			news.set('links', story.links);
			txApp.save(news);
		};

		e.app.runInTransaction((txApp) => {
			const transitioned = {};
			const dueConditions = txApp.findRecordsByFilter(
				'healthConditions',
				'recoveredAt = "" && expectedRecoveryAt <= {:now}',
				'expectedRecoveryAt,id',
				5000,
				0,
				{ now: occurredAt }
			);
			for (const condition of dueConditions) {
				const racerId = condition.getString('racer');
				if (requestedIds.length > 0 && !requestedIds.includes(racerId)) continue;
				const idempotencyKey = `health-recovery:${condition.id}`;
				if (eventExists(txApp, idempotencyKey)) continue;
				const racer = txApp.findRecordById('racers', racerId);
				const event = createHealthEvent(txApp, 'HealthRecovery', idempotencyKey);
				condition.set('recoveredAt', occurredAt);
				condition.set('recoveryEvent', event.id);
				txApp.save(condition);
				const remaining = activeConditions(txApp, racerId);
				projectHealth(racer, remaining);
				const valuation = appendValuation(racer, condition, 'recovery', event);
				txApp.save(racer);
				const context = healthContext(txApp, racer, condition);
				event.set('facts', {
					racerId,
					conditionId: condition.id,
					transition: 'recovery',
					valuation,
					context
				});
				txApp.save(event);
				publishNews(txApp, event, context, 'recovery');
				transitioned[racerId] = true;
				result.recoveredConditions += 1;
			}

			const racers = requestedIds.length
				? requestedIds.map((id) => txApp.findRecordById('racers', id))
				: txApp.findRecordsByFilter('racers', 'id != ""', 'id', 5000, 0);
			for (const racer of racers) {
				if (transitioned[racer.id]) continue;
				const recoveredAtThisProcessingTime = txApp
					.findRecordsByFilter(
						'healthConditions',
						'racer = {:racerId} && recoveredAt != ""',
						'-recoveredAt',
						1,
						0,
						{ racerId: racer.id }
					)
					.some((condition) => Date.parse(condition.getDateTime('recoveredAt').string()) === nowMs);
				if (recoveredAtThisProcessingTime) continue;
				const status = jsonField(racer, 'status', { retired: false, injured: false });
				if (status.retired) continue;
				const openConditions = activeConditions(txApp, racer.id);
				const idempotencyKey = `health-onset:${racer.id}:${seed}:${occurredAt}`;
				if (eventExists(txApp, idempotencyKey)) continue;
				const traits = jsonField(racer, 'traits', { durability: 50, resilience: 50 });
				const careerStartedAt = racer.getDateTime('careerStartedAt').string();
				const pokemon = txApp.findRecordById('pokemon', racer.getString('pokemon'));
				const decision = require(`${__hooks}/racerHealth.cjs`).evaluateHealthOnset({
					racerId: racer.id,
					seed,
					processedAt: occurredAt,
					speciesHp: pokemon.getFloat('hp'),
					traits,
					ageDays: Number.isFinite(Date.parse(careerStartedAt))
						? Math.max(0, Math.floor((nowMs - Date.parse(careerStartedAt)) / 86400000))
						: 0,
					careerLoad: racer.getFloat('careerLoad'),
					activeConditionCount: openConditions.length,
					trackRisk,
					eventRisk
				});
				if (!decision.condition) continue;
				const event = createHealthEvent(txApp, 'HealthOnset', idempotencyKey);
				const condition = new Record(txApp.findCollectionByNameOrId('healthConditions'));
				condition.set('racer', racer.id);
				condition.set('kind', decision.condition.kind);
				condition.set('severity', decision.condition.severity);
				condition.set('cause', decision.condition.cause);
				condition.set('onsetAt', decision.condition.onsetAt);
				condition.set('expectedRecoveryAt', decision.condition.expectedRecoveryAt);
				condition.set('eligibilityEffect', decision.condition.eligibilityEffect);
				condition.set('performanceMultiplier', decision.condition.performanceMultiplier);
				condition.set('inputs', decision.inputs);
				condition.set('roll', decision.roll);
				condition.set('probability', decision.probability);
				condition.set('rulesVersion', decision.rulesVersion);
				condition.set('sourceEvent', event.id);
				txApp.save(condition);
				projectHealth(racer, [...openConditions, condition]);
				const valuation = appendValuation(racer, condition, 'onset', event);
				txApp.save(racer);
				const context = healthContext(txApp, racer, condition);
				event.set('facts', {
					racerId: racer.id,
					conditionId: condition.id,
					transition: 'onset',
					inputs: decision.inputs,
					roll: decision.roll,
					probability: decision.probability,
					valuation,
					context
				});
				txApp.save(event);
				publishNews(txApp, event, context, 'onset');
				result.createdConditions += 1;
			}
		});

		return e.json(200, result);
	},
	$apis.requireAuth('users')
);
