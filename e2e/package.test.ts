import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Tests the package exactly as a user gets it: build, `npm pack`, install the
// tarball into an empty project, then import it from plain JavaScript and from
// TypeScript. Catches problems unit tests can't see, like a missing file in
// the tarball or an "exports" entry that points at the wrong place.

const run = promisify(execFile);
const repo = resolve(import.meta.dirname, "..");

// Async on purpose: the HTTP server below lives in this process, so a
// blocking execFileSync would deadlock the consumer's requests.
async function npm(args: string[], cwd: string): Promise<string> {
  // `npm run e2e` sets npm_execpath; calling npm's script through node avoids a
  // shell, which on Windows would mangle paths containing spaces.
  const npmCli = process.env.npm_execpath;
  const { stdout } = npmCli
    ? await run(process.execPath, [npmCli, ...args], { cwd })
    : await run("npm", args, { cwd });
  return stdout;
}

async function node(args: string[], cwd: string): Promise<string> {
  const { stdout } = await run(process.execPath, args, { cwd });
  return stdout;
}

interface PackedFile {
  path: string;
}

let workDir: string;
let consumerDir: string;
let packedFiles: string[];

beforeAll(async () => {
  workDir = await mkdtemp(join(tmpdir(), "recordsift-e2e-"));
  consumerDir = join(workDir, "consumer");

  await npm(["run", "build"], repo);
  const [packed] = JSON.parse(await npm(["pack", "--json", "--pack-destination", workDir], repo)) as [
    { filename: string; files: PackedFile[] },
  ];
  packedFiles = packed.files.map((f) => f.path);

  await mkdir(consumerDir);
  await writeFile(
    join(consumerDir, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
  );
  await npm(["install", join(workDir, packed.filename), "--no-audit", "--no-fund", "--no-package-lock"], consumerDir);
});

afterAll(async () => {
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

describe("published tarball", () => {
  it("ships the build, types, README and LICENSE", () => {
    expect(packedFiles).toEqual(
      expect.arrayContaining(["dist/index.js", "dist/index.d.ts", "README.md", "LICENSE", "package.json"]),
    );
  });

  it("leaves out tests, the package test and dev config", () => {
    expect(packedFiles.filter((f) => /\.test\.|^e2e\/|^examples\/|config\.ts$|^coverage\//.test(f))).toEqual([]);
  });
});

describe("installed package, used from JavaScript", () => {
  let server: Server;
  let baseUrl: string;
  let requests = 0;

  beforeAll(async () => {
    // Fails the first request with a 503, then serves a mix of good and bad records.
    server = createServer((req, res) => {
      requests++;
      if (req.url === "/users" && requests === 1) {
        res.writeHead(503).end("Service Unavailable");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify(
          req.url === "/users"
            ? [{ id: 1, email: "ada@example.com" }, { id: "2" }, { id: 3, email: "grace@example.com" }]
            : { data: [] },
        ),
      );
    });
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    await writeFile(
      join(consumerDir, "consumer.mjs"),
      `import { loadAndSift } from "recordsift";

const isUser = (v) => typeof v === "object" && v !== null && Number.isInteger(v.id) && typeof v.email === "string";

const load = async () => {
  const res = await fetch(process.argv[2]);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
};

try {
  const { valid, invalid } = await loadAndSift({ load, validate: isUser, delayMs: 10 });
  console.log(JSON.stringify({ valid, invalid }));
} catch (error) {
  console.log(JSON.stringify({ error: error.name + ": " + error.message }));
}
`,
    );
  });

  afterAll(async () => {
    await new Promise((done) => server.close(done));
  });

  it("exposes the public API", async () => {
    const out = await node(
      ["--input-type=module", "-e", 'import * as m from "recordsift"; console.log(Object.keys(m).sort().join(","))'],
      consumerDir,
    );
    expect(out.trim()).toBe("loadAndSift,retry,sift,siftAsync");
  });

  it("retries a failing API over real HTTP, then sifts the records", async () => {
    const out = JSON.parse(await node(["consumer.mjs", `${baseUrl}/users`], consumerDir));

    expect(requests).toBe(2);
    expect(out.valid).toEqual([
      { id: 1, email: "ada@example.com" },
      { id: 3, email: "grace@example.com" },
    ]);
    expect(out.invalid).toEqual([{ index: 1, value: { id: "2" }, issues: [{ message: "Rejected by isUser" }] }]);
  });

  it("fails clearly when the API returns an object instead of an array", async () => {
    const out = JSON.parse(await node(["consumer.mjs", `${baseUrl}/wrapped`], consumerDir));
    expect(out).toEqual({ error: "TypeError: load() must resolve to an array of records, got object" });
  });
});

describe("installed package, used from TypeScript", () => {
  it("resolves the published types and infers the valid record type", async () => {
    // Split so this file's own typecheck doesn't read it as a directive.
    const expectError = "// @ts-" + "expect-error";
    await writeFile(
      join(consumerDir, "consumer.ts"),
      `import { sift, type SiftResult } from "recordsift";

interface User { id: number; email: string }
const isUser = (v: unknown): v is User => typeof v === "object" && v !== null && "id" in v;

const result: SiftResult<User> = sift([{ id: 1, email: "a@b.co" }], isUser);
const first: User | undefined = result.valid[0];
const reasons: string[] = result.invalid.flatMap((r) => r.issues.map((i) => i.message));

${expectError} valid records are Users, not strings
const wrong: string[] = result.valid;

export { first, reasons, wrong };
`,
    );
    await writeFile(
      join(consumerDir, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: { module: "nodenext", target: "es2022", strict: true, noEmit: true, skipLibCheck: false, types: [] },
        files: ["consumer.ts"],
      }),
    );

    // Throws, failing the test, if tsc reports any error. That includes the
    // expect-error directive going unused, which would mean the types are too loose.
    await node([join(repo, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"], consumerDir);
  });
});
