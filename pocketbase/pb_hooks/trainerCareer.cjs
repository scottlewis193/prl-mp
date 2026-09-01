const RECENT_RESULT_LIMIT = 10;

function emptyTrainerCareer() {
	// PocketBase hooks execute in Goja and cannot import the TypeScript domain helper;
	// keep this small runtime-boundary mirror aligned through shared projection tests.
	return {
		starts: 0,
		wins: 0,
		podiums: 0,
		earnings: 0,
		// Championships are awarded by the future season system (#23). Keeping the
		// durable field now avoids inventing awards from individual race wins.
		championships: 0,
		recentResults: []
	};
}

function buildTrainerCareer(results, championships = []) {
	const career = emptyTrainerCareer();
	const ordered = [...results].sort((left, right) => {
		const dateOrder = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
		return dateOrder || right.id.localeCompare(left.id);
	});

	for (const result of ordered) {
		const isDnf = result.outcome === 'dnf';
		if (
			!result.id ||
			!result.raceId ||
			!result.racerId ||
			(!isDnf && (!Number.isInteger(result.position) || result.position < 1)) ||
			(isDnf && result.position !== undefined && result.position !== 0) ||
			!Number.isFinite(result.earnings) ||
			result.earnings < 0 ||
			(isDnf && result.earnings !== 0) ||
			!Number.isFinite(Date.parse(result.occurredAt))
		) {
			throw new Error('Cannot project an invalid trainer race result');
		}
		career.starts += 1;
		career.wins += !isDnf && result.position === 1 ? 1 : 0;
		career.podiums += !isDnf && result.position <= 3 ? 1 : 0;
		career.earnings += result.earnings;
	}

	career.recentResults = ordered.slice(0, RECENT_RESULT_LIMIT).map((result) => ({
		resultId: result.id,
		raceId: result.raceId,
		racerId: result.racerId,
		...(result.outcome === 'dnf' ? { outcome: 'dnf' } : { position: result.position }),
		earnings: result.earnings,
		occurredAt: result.occurredAt
	}));
	for (const championship of championships) {
		if (!championship.id || !Number.isFinite(Date.parse(championship.occurredAt))) {
			throw new Error('Cannot project an invalid trainer championship fact');
		}
	}
	career.championships = championships.length;
	return career;
}

function loadAllByTrainer(app, collection, trainerId) {
	const pageSize = 1000;
	const records = [];
	for (let offset = 0; ; offset += pageSize) {
		const page = app.findRecordsByFilter(
			collection,
			'trainer = {:trainerId}',
			'occurredAt,id',
			pageSize,
			offset,
			{ trainerId }
		);
		records.push(...page);
		if (page.length < pageSize) return records;
	}
}

function loadAllTrainerRaceResults(app, trainerId) {
	return loadAllByTrainer(app, 'trainerRaceResults', trainerId);
}

function rebuildTrainerCareer(app, trainerId) {
	const durableResults = loadAllTrainerRaceResults(app, trainerId);
	const facts = durableResults.map((result) => ({
		id: result.id,
		raceId: result.getString('race'),
		racerId: result.getString('racer'),
		trainerId,
		outcome: result.getString('outcome') || 'finished',
		...(result.getString('outcome') === 'dnf' ? {} : { position: result.getInt('position') }),
		earnings: result.getFloat('earnings'),
		occurredAt: result.getString('occurredAt')
	}));
	const championships = loadAllByTrainer(app, 'trainerChampionships', trainerId).map((fact) => ({
		id: fact.id,
		trainerId,
		occurredAt: fact.getString('occurredAt')
	}));
	const trainer = app.findRecordById('trainers', trainerId);
	trainer.set('career', buildTrainerCareer(facts, championships));
	app.save(trainer);
}

module.exports = {
	buildTrainerCareer,
	emptyTrainerCareer,
	loadAllTrainerRaceResults,
	rebuildTrainerCareer,
	RECENT_RESULT_LIMIT
};
