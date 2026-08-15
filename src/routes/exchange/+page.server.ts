export const load = async ({ locals, url }) => {
	const holdings = locals.user
		? await locals.pb
				.collection('holdings')
				.getFullList({ fields: 'id,player,racer,quantity,costBasis' })
		: [];
	return { user: locals.user, url: url.pathname, holdings };
};
