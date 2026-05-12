import type { Poll, PollTally, VerifiedVote } from "../polls/types";

export type DuckDbSummary = {
  rows: PollTally[];
  duckdbVersion: string;
};

type QueryRow = {
  poll_id: string;
  option_id: string;
  votes: number | bigint;
};

export async function summarizeWithDuckDB(
  polls: Poll[],
  votes: VerifiedVote[]
): Promise<DuckDbSummary> {
  const duckdb = await import("@duckdb/duckdb-wasm");
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker ?? ""}");`], { type: "text/javascript" })
  );

  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);

  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  const duckdbVersion = await db.getVersion();
  const conn = await db.connect();

  try {
    await conn.query(
      "CREATE TABLE votes (poll_id VARCHAR, option_id VARCHAR, nullifier VARCHAR, created_at VARCHAR)"
    );

    const rows = votes
      .filter((vote) => vote.verified)
      .map((vote) => ({
        poll_id: vote.pollId,
        option_id: vote.optionId,
        nullifier: vote.nullifier,
        created_at: vote.createdAt
      }));

    if (rows.length > 0) {
      await db.registerFileText("votes.json", JSON.stringify(rows));
      await conn.query("INSERT INTO votes SELECT * FROM read_json_auto('votes.json')");
    }

    const table = await conn.query(`
      SELECT poll_id, option_id, count(DISTINCT nullifier) AS votes
      FROM votes
      GROUP BY poll_id, option_id
      ORDER BY poll_id, option_id
    `);
    const counts = new Map<string, number>();

    for (const row of table.toArray() as unknown as QueryRow[]) {
      counts.set(`${row.poll_id}:${row.option_id}`, Number(row.votes));
    }

    return {
      duckdbVersion,
      rows: polls.flatMap((poll) =>
        poll.options.map((option) => ({
          pollId: poll.id,
          optionId: option.id,
          label: option.label,
          votes: counts.get(`${poll.id}:${option.id}`) ?? 0
        }))
      )
    };
  } finally {
    await conn.close();
    await db.terminate();
    URL.revokeObjectURL(workerUrl);
  }
}
