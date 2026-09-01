/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/admin/world-audit',
	(e) => {
		if (!e.auth || (e.auth.id !== 'prlserviceuser0' && !e.auth.getBool('isAdmin'))) {
			throw e.forbiddenError('Administrative access is required.', {});
		}
		const body = e.requestInfo().body || {};
		const requested = body.repairFindingIds === undefined ? [] : body.repairFindingIds;
		if (
			!Array.isArray(requested) ||
			requested.length > 1000 ||
			requested.some((id) => typeof id !== 'string' || !id || id.length > 500)
		) {
			throw e.badRequestError('repairFindingIds must be a list of finding IDs.', {});
		}

		const configuration = JSON.parse(
			toString($os.readFile($filepath.join($os.getwd(), 'data', 'initial-population.v1.json')))
		);
		const targets = {
			speciesCount: 649,
			trainerCount: configuration.trainers.count,
			activeRacerCount: configuration.leagues.names.length * configuration.leagues.activeRacers,
			freeAgentCount: configuration.freeAgents.target,
			minimumTrackCount: 5
		};
		const jsonField = (record, name, fallback) => {
			try {
				const parsed = JSON.parse(toString(record.get(name)));
				return parsed === null ? fallback : parsed;
			} catch {
				return fallback;
			}
		};
		const snapshot = (app) => ({
			species: app.findAllRecords('pokemon').map((record) => ({ id: record.id })),
			trainers: app.findAllRecords('trainers').map((record) => ({
				id: record.id,
				rosterCapacity: record.getInt('rosterCapacity')
			})),
			racers: app.findAllRecords('racers').map((record) => {
				const status = jsonField(record, 'status', {});
				const health = jsonField(record, 'health', {});
				const financials = jsonField(record, 'financials', {});
				const raceHistory = jsonField(record, 'raceHistory', {});
				return {
					id: record.id,
					trainerId: record.getString('trainer'),
					leagueId: record.getString('league'),
					raceId: record.getString('race'),
					retired: status.retired === true,
					healthEligible: health.eligible !== false,
					price: financials.currentSharePrice,
					priceHistory: financials.priceHistory || [],
					raceHistory
				};
			}),
			leagues: app.findAllRecords('leagues').map((record) => ({
				id: record.id,
				maxPlayers: record.getInt('maxPlayers')
			})),
			seasons: app.findAllRecords('seasons').map((record) => ({
				id: record.id,
				status: record.getString('status')
			})),
			standings: app.findAllRecords('leagueStandings').map((record) => ({
				id: record.id,
				seasonId: record.getString('season'),
				leagueId: record.getString('league'),
				racerId: record.getString('racer'),
				points: record.getFloat('points'),
				starts: record.getInt('starts'),
				wins: record.getInt('wins'),
				podiums: record.getInt('podiums')
			})),
			races: app.findAllRecords('races').map((record) => ({
				id: record.id,
				status: record.getString('status'),
				trackId: record.getString('racetrack'),
				seasonId: record.getString('season'),
				awardedPrizes: jsonField(record, 'awardedPrizes', [])
			})),
			trainerResults: app.findAllRecords('trainerRaceResults').map((record) => ({
				id: record.id,
				raceId: record.getString('race'),
				racerId: record.getString('racer'),
				trainerId: record.getString('trainer')
			})),
			rosterHistory: app.findAllRecords('rosterHistory').map((record) => ({
				id: record.id,
				sourceEventId: record.getString('sourceEvent')
			})),
			healthConditions: app.findAllRecords('healthConditions').map((record) => ({
				id: record.id,
				sourceEventId: record.getString('sourceEvent'),
				recoveryEventId: record.getString('recoveryEvent')
			})),
			tracks: app.findAllRecords('racetracks').map((record) => ({
				id: record.id,
				checkpointCount: (jsonField(record, 'checkpoints', []) || []).length,
				length: record.getFloat('length') || record.getFloat('totalLength'),
				width: record.getFloat('width'),
				surface: record.getString('surface'),
				compatibleFormatCount: (jsonField(record, 'compatibleFormats', []) || []).length
			})),
			wagers: app.findAllRecords('wagers').map((record) => ({
				id: record.id,
				raceId: record.getString('race'),
				status: record.getString('status'),
				idempotencyKey: record.getString('idempotencyKey')
			})),
			users: app.findAllRecords('users').map((record) => ({
				id: record.id,
				balance: record.getFloat('balance')
			})),
			ledger: app.findAllRecords('accountLedger').map((record) => ({
				id: record.id,
				playerId: record.getString('player'),
				balanceDelta: record.getFloat('balanceDelta'),
				wagerId: record.getString('wager'),
				type: record.getString('type'),
				sourceKey: record.getString('sourceKey')
			})),
			events: app.findAllRecords('events').map((record) => ({
				id: record.id,
				type: record.getString('type'),
				facts: jsonField(record, 'facts', {})
			})),
			news: app.findAllRecords('news').map((record) => ({
				id: record.id,
				sourceEventId: record.getString('sourceEvent')
			}))
		});
		const rules = require(`${__hooks}/worldAudit.cjs`);
		const repair = { requested: [...requested], applied: [], skipped: [] };
		let findings;
		e.app.runInTransaction((txApp) => {
			findings = rules.auditWorld(snapshot(txApp), targets);
			const findingById = new Map(findings.map((finding) => [finding.id, finding]));
			for (const findingId of requested) {
				const finding = findingById.get(findingId);
				if (!finding) {
					repair.skipped.push({ findingId, reason: 'finding_not_present' });
					continue;
				}
				if (finding.repairability !== 'safe' || !finding.repair) {
					repair.skipped.push({ findingId, reason: 'administrative_review_required' });
					continue;
				}
				if (finding.repair.action === 'clear_racer_race_links') {
					let changed = 0;
					for (const racerId of finding.repair.racerIds) {
						const racer = txApp.findRecordById('racers', racerId);
						if (!racer.getString('race')) continue;
						racer.set('race', null);
						txApp.save(racer);
						changed += 1;
					}
					repair.applied.push({
						findingId,
						change: `Cleared ${changed} stale racer race link${changed === 1 ? '' : 's'}.`
					});
				}
			}
			findings = rules.auditWorld(snapshot(txApp), targets);
		});

		return e.json(200, {
			healthy: findings.length === 0,
			checkedDomains: rules.CHECKED_DOMAINS,
			findings: findings.map(({ repair: _repair, ...finding }) => finding),
			repair
		});
	},
	$apis.requireAuth('users')
);
