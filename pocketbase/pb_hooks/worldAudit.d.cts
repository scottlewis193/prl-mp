declare const worldAudit: {
	CHECKED_DOMAINS: string[];
	auditWorld(
		world: Record<string, any>,
		targets: Record<string, number>
	): Array<{
		id: string;
		code: string;
		domain: string;
		repairability: 'safe' | 'review';
		recordIds: string[];
		message: string;
		repair: unknown;
	}>;
};

export = worldAudit;
