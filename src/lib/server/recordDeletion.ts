type DeletableRecord = { id: string };

type DeletableCollection = {
	getFullList: () => Promise<DeletableRecord[]>;
	delete: (id: string) => Promise<unknown>;
};

export async function deleteAllRecords(collection: DeletableCollection): Promise<number> {
	const records = await collection.getFullList();

	for (const record of records) {
		await collection.delete(record.id);
	}

	return records.length;
}
