export const SERVICE_USER_ID = 'prlserviceuser0';

type AdministrativeUser = {
	id?: unknown;
	isAdmin?: unknown;
} | null;

export function isAdministrativeUser(user: AdministrativeUser | undefined): boolean {
	return user?.id === SERVICE_USER_ID || user?.isAdmin === true;
}
