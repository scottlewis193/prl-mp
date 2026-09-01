declare const retirement: {
	RETIREMENT_RULES: {
		version: 'racer-retirement-v1';
		minimumCareerDays: number;
		maximumProbability: number;
	};
	evaluateRacerRetirement(input: {
		racerId: string;
		seed: string;
		processedAt: string;
		ageDays: number;
		longevity: number;
		careerLoad: number;
		healthEligible: boolean;
		activeConditionCount: number;
	}): {
		rulesVersion: 'racer-retirement-v1';
		inputs: {
			ageDays: number;
			longevity: number;
			careerLoad: number;
			healthEligible: boolean;
			activeConditionCount: number;
		};
		roll: number;
		probability: number;
		retire: boolean;
		reason: 'age' | 'career_load' | 'health';
	};
};
export = retirement;
