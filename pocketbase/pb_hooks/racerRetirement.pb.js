/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/retirements/process',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may process retirements.', {});
		}
		const body = e.requestInfo().body || {};
		const nowMs = body.now === undefined ? Date.now() : Date.parse(body.now);
		const seed = typeof body.seed === 'string' ? body.seed.trim() : '';
		const requestedIds = Array.isArray(body.racerIds) ? body.racerIds.map(String) : [];
		if (!Number.isFinite(nowMs) || !seed || seed.length > 200 || requestedIds.length > 1000) {
			throw e.badRequestError('A valid now, seed, and racer list are required.', {});
		}
		const occurredAt = new Date(nowMs).toISOString();
		const result = { retiredRacers: 0 };
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
		const hasRetirementEvent = (txApp, racerId) => {
			try {
				txApp.findFirstRecordByFilter('events', 'idempotencyKey = {:key}', {
					key: `retirement:${racerId}`
				});
				return true;
			} catch {
				return false;
			}
		};

		e.app.runInTransaction((txApp) => {
			const racers = requestedIds.length
				? requestedIds.map((id) => txApp.findRecordById('racers', id))
				: txApp.findRecordsByFilter('racers', 'id != ""', 'id', 5000, 0);
			for (const racer of racers) {
				const status = jsonField(racer, 'status', { retired: false, injured: false });
				if (status.retired || hasRetirementEvent(txApp, racer.id)) continue;
				const raceId = racer.getString('race');
				if (raceId) {
					const raceStatus = txApp.findRecordById('races', raceId).getString('status');
					if (['countdown', 'running', 'finished'].includes(raceStatus)) continue;
				}
				const careerStartedAt = racer.getDateTime('careerStartedAt').string();
				const traits = jsonField(racer, 'traits', { longevity: 50 });
				const health = jsonField(racer, 'health', {
					eligible: !status.injured,
					activeConditionIds: []
				});
				const decision = require(`${__hooks}/racerRetirement.cjs`).evaluateRacerRetirement({
					racerId: racer.id,
					seed,
					processedAt: occurredAt,
					ageDays: Number.isFinite(Date.parse(careerStartedAt))
						? Math.max(0, Math.floor((nowMs - Date.parse(careerStartedAt)) / 86400000))
						: 0,
					longevity: traits.longevity,
					careerLoad: racer.getFloat('careerLoad'),
					healthEligible: health.eligible !== false,
					activeConditionCount: Array.isArray(health.activeConditionIds)
						? health.activeConditionIds.length
						: 0
				});
				if (!decision.retire) continue;

				const previousTrainer = namedRelation(txApp, 'trainers', racer.getString('trainer'));
				const previousLeague = namedRelation(txApp, 'leagues', racer.getString('league'));
				const event = new Record(txApp.findCollectionByNameOrId('events'));
				event.set('type', 'RacerRetired');
				event.set('idempotencyKey', `retirement:${racer.id}`);
				event.set('occurredAt', occurredAt);
				event.set('started', true);
				event.set('finished', true);
				event.set('facts', {});
				txApp.save(event);

				const projection = {
					retiredAt: occurredAt,
					reason: decision.reason,
					rulesVersion: decision.rulesVersion,
					eventId: event.id,
					previousTrainer,
					previousLeague
				};
				status.retired = true;
				racer.set('status', status);
				racer.set('retirement', projection);
				racer.set('race', null);
				racer.set('trainer', null);
				racer.set('league', null);
				txApp.save(racer);

				event.set('facts', {
					racerId: racer.id,
					retiredAt: occurredAt,
					decision,
					previousTrainer,
					previousLeague,
					careerLoad: racer.getFloat('careerLoad')
				});
				txApp.save(event);
				const story = require(`${__hooks}/retirementNews.cjs`).buildRetirementStory({
					eventId: event.id,
					occurredAt,
					racer: { id: racer.id, name: racer.getString('name') },
					trainer: previousTrainer,
					league: previousLeague,
					careerLoad: racer.getFloat('careerLoad'),
					reason: decision.reason
				});
				const news = new Record(txApp.findCollectionByNameOrId('news'));
				news.set('sourceEvent', event.id);
				news.set('racers', [racer.id]);
				if (previousTrainer) news.set('trainers', [previousTrainer.id]);
				if (previousLeague) news.set('league', previousLeague.id);
				news.set('category', story.category);
				news.set('importance', story.importance);
				news.set('publishedAt', story.publishedAt);
				news.set('headline', story.headline);
				news.set('summary', story.summary);
				news.set('templateVersion', story.templateVersion);
				news.set('links', story.links);
				txApp.save(news);
				result.retiredRacers += 1;
			}
		});
		return e.json(200, result);
	},
	$apis.requireAuth('users')
);

onRecordUpdateRequest((e) => {
	const jsonField = (record, name, fallback) => {
		try {
			return JSON.parse(toString(record.get(name))) || fallback;
		} catch {
			return fallback;
		}
	};
	const originalStatus = jsonField(e.record.original(), 'status', { retired: false });
	if (originalStatus.retired) {
		const nextStatus = jsonField(e.record, 'status', { retired: false });
		const nextRaceId = e.record.getString('race');
		let enteringLegendsExhibition = false;
		if (nextRaceId) {
			try {
				const race = e.app.findRecordById('races', nextRaceId);
				const raceFormat = jsonField(race, 'raceFormat', {});
				enteringLegendsExhibition = raceFormat.type === 'legends_exhibition';
			} catch {}
		}
		if (
			!nextStatus.retired ||
			(nextRaceId && !enteringLegendsExhibition) ||
			e.record.getString('trainer') ||
			e.record.getString('league')
		) {
			throw e.forbiddenError(
				'Retired racers cannot return to active competition or free agency.',
				{}
			);
		}
	}
	return e.next();
}, 'racers');
