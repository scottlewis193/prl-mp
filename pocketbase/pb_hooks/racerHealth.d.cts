type HealthSeverity = 'minor' | 'moderate' | 'severe';
type HealthInputs = {
	speciesHp: number;
	durability: number;
	resilience: number;
	ageDays: number;
	careerLoad: number;
	activeConditionCount: number;
	trackRisk: number;
	eventRisk: number;
};
type HealthConditionDecision = {
	kind: 'injury' | 'illness';
	severity: HealthSeverity;
	cause: 'track_incident' | 'training_load' | 'illness_exposure';
	onsetAt: string;
	expectedRecoveryAt: string;
	eligibilityEffect: 'performance_penalty' | 'ineligible';
	performanceMultiplier: number;
};
type HealthPricePoint = {
	timestamp: string;
	previousPrice: number;
	price: number;
	change: number;
	changePercent: number;
	reason: {
		type: 'health';
		conditionId: string;
		transition: 'onset' | 'recovery';
		severity: HealthSeverity;
		appliedPercent: number;
	};
	rulesVersion: 'racer-health-v1';
	sourceEvent: string;
};

declare const racerHealth: {
	HEALTH_RULES: {
		version: 'racer-health-v1';
		priceFloor: number;
		priceCeiling: number;
		onsetPricePercent: Readonly<Record<HealthSeverity, number>>;
		recoveryPricePercent: Readonly<Record<HealthSeverity, number>>;
		minorPerformanceMultiplier: number;
	};
	evaluateHealthOnset(input: {
		racerId: string;
		seed: string;
		processedAt: string;
		speciesHp: number;
		traits: { durability: number; resilience: number };
		ageDays: number;
		careerLoad: number;
		activeConditionCount: number;
		trackRisk: number;
		eventRisk: number;
	}): {
		rulesVersion: 'racer-health-v1';
		inputs: HealthInputs;
		roll: number;
		probability: number;
		condition: HealthConditionDecision | null;
	};
	healthPerformanceMultiplier(
		conditions: Array<{
			eligibilityEffect: 'performance_penalty' | 'ineligible';
			performanceMultiplier: number;
		}>
	): number;
	buildHealthPricePoint(input: {
		conditionId: string;
		transition: 'onset' | 'recovery';
		severity: HealthSeverity;
		previousPrice: number;
		occurredAt: string;
		sourceEvent: string;
	}): HealthPricePoint;
};

export = racerHealth;
