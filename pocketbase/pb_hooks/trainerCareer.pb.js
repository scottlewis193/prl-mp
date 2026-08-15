/// <reference path="../pb_data/types.d.ts" />

routerAdd(
	'POST',
	'/api/prl/trainers/rebuild-careers',
	(e) => {
		if (!e.auth || e.auth.id !== 'prlserviceuser0') {
			throw e.forbiddenError('Only the simulator service account may rebuild trainer careers.', {});
		}
		let rebuilt = 0;
		e.app.runInTransaction((txApp) => {
			for (const trainer of txApp.findAllRecords('trainers')) {
				require(`${__hooks}/trainerCareer.cjs`).rebuildTrainerCareer(txApp, trainer.id);
				rebuilt += 1;
			}
		});
		return e.json(200, { rebuilt });
	},
	$apis.requireAuth('users')
);
