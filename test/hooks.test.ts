import { describe, expect, it } from "bun:test"
import { cpSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { run } from "./consumer"

const root = resolve(import.meta.dir, "..")
const hooks = join(root, ".githooks")
const HOOKS = ["pre-commit", "pre-merge-commit", "pre-push"] as const
const MESSAGE =
	"Direct changes to main are not allowed. Create `feat/*`, `fix/*` or `docs/*` and open a PR."

function git(dir: string, ...args: string[]): { code: number; output: string } {
	return run(["git", ...args], dir)
}

function temp(prefix: string): string {
	return mkdtempSync(join(tmpdir(), prefix))
}

/** Writes a file, stages it and commits it, returning git's exit code and output. */
function commit(dir: string, name: string, message: string): { code: number; output: string } {
	writeFileSync(join(dir, name), `${message}\n`)
	git(dir, "add", name)
	return git(dir, "commit", "-q", "-m", message)
}

function branch(dir: string, name: string): void {
	expect(git(dir, "checkout", "-q", "-b", name).code).toBe(0)
}

/** A clone with the guard committed, main pushed, and the hook path activated once. */
function clone(): { dir: string } {
	const dir = temp("cicd-hooks-")
	const remote = temp("cicd-hooks-remote-")
	git(dir, "init", "-q", "-b", "main")
	git(dir, "config", "user.name", "Guard Test")
	git(dir, "config", "user.email", "guard@example.com")
	git(dir, "config", "commit.gpgsign", "false")
	expect(commit(dir, "README", "initial commit").code).toBe(0)
	cpSync(hooks, join(dir, ".githooks"), { recursive: true })
	git(dir, "add", ".githooks")
	expect(git(dir, "commit", "-q", "-m", "add the guard").code).toBe(0)
	git(remote, "init", "-q", "--bare")
	git(dir, "remote", "add", "origin", remote)
	expect(git(dir, "push", "-q", "origin", "main").code).toBe(0)
	git(dir, "config", "core.hooksPath", ".githooks")
	return { dir }
}

describe("the direct-commit guard", () => {
	it("refuses a commit on main and names the rule and the fix", () => {
		const { dir } = clone()
		const result = commit(dir, "direct.txt", "direct change")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("refuses a commit on master too", () => {
		const { dir } = clone()
		branch(dir, "master")
		const result = commit(dir, "direct.txt", "direct change")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("allows a commit on feat/*, fix/*, docs/*, factory/* and a detached HEAD", () => {
		const { dir } = clone()
		for (const name of ["feat/x", "fix/x", "docs/x", "factory/14-guard"]) {
			branch(dir, name)
			expect(commit(dir, `${name.replace("/", "-")}.txt`, name).code).toBe(0)
		}
		expect(git(dir, "checkout", "-q", "--detach").code).toBe(0)
		expect(commit(dir, "detached.txt", "detached").code).toBe(0)
	})

	it("refuses the merge commit a merge into main would create", () => {
		const { dir } = clone()
		branch(dir, "feat/merge")
		expect(commit(dir, "feature.txt", "feature").code).toBe(0)
		expect(git(dir, "checkout", "-q", "main").code).toBe(0)
		const result = git(dir, "merge", "--no-ff", "-m", "merge feat/merge", "feat/merge")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("refuses git push origin HEAD:main from a feature branch", () => {
		const { dir } = clone()
		branch(dir, "feat/x")
		expect(commit(dir, "a.txt", "a").code).toBe(0)
		const result = git(dir, "push", "origin", "HEAD:main")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("refuses a deletion of main", () => {
		const { dir } = clone()
		branch(dir, "feat/x")
		const result = git(dir, "push", "origin", ":main")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("refuses a push to master", () => {
		const { dir } = clone()
		branch(dir, "feat/x")
		expect(commit(dir, "a.txt", "a").code).toBe(0)
		const result = git(dir, "push", "origin", "HEAD:master")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("refuses a multi-ref push where one ref is main", () => {
		const { dir } = clone()
		branch(dir, "feat/y")
		expect(commit(dir, "y.txt", "y").code).toBe(0)
		const moved = git(dir, "rev-parse", "HEAD").output.trim()
		expect(git(dir, "update-ref", "refs/heads/main", moved).code).toBe(0)
		branch(dir, "feat/x")
		expect(commit(dir, "a.txt", "a").code).toBe(0)
		const result = git(dir, "push", "origin", "HEAD:refs/heads/feat/x", "main:refs/heads/main")
		expect(result.code).not.toBe(0)
		expect(result.output).toContain(MESSAGE)
	})

	it("allows a feature-branch push, a tag and empty stdin", () => {
		const { dir } = clone()
		branch(dir, "feat/x")
		expect(commit(dir, "a.txt", "a").code).toBe(0)
		expect(git(dir, "push", "-q", "origin", "HEAD:refs/heads/feat/x").code).toBe(0)
		expect(git(dir, "tag", "v1").code).toBe(0)
		expect(git(dir, "push", "-q", "origin", "v1").code).toBe(0)
		const direct = run([join(dir, ".githooks/pre-push"), "origin", "url"], dir, new Uint8Array())
		expect(direct.code).toBe(0)
	})

	it("guards a linked worktree of a clone that set the hook path once", () => {
		const { dir } = clone()
		branch(dir, "feat/primary")
		expect(commit(dir, "primary.txt", "primary").code).toBe(0)
		const worktree = join(temp("cicd-hooks-worktree-"), "wt")
		expect(git(dir, "worktree", "add", "-q", worktree, "main").code).toBe(0)
		const refused = commit(worktree, "direct.txt", "direct change")
		expect(refused.code).not.toBe(0)
		expect(refused.output).toContain(MESSAGE)
		expect(git(worktree, "checkout", "-q", "-b", "feat/wt").code).toBe(0)
		expect(commit(worktree, "wt.txt", "worktree change").code).toBe(0)
		const push = git(worktree, "push", "origin", "HEAD:main")
		expect(push.code).not.toBe(0)
		expect(push.output).toContain(MESSAGE)
	})

	it("commits the shared guard executable too, because a hook execs it", () => {
		for (const name of [...HOOKS, "_main-guard.sh"]) {
			expect(statSync(join(hooks, name)).mode & 0o777).toBe(0o755)
		}
	})

	it("refuses instead of silently allowing when the shared guard file is missing", () => {
		const { dir } = clone()
		branch(dir, "feat/x")
		rmSync(join(dir, ".githooks/_main-guard.sh"))
		expect(commit(dir, "a.txt", "a").code).not.toBe(0)
	})
})

describe("the standard the guard ships with", () => {
	it("documents activation and says the guard is not branch protection", () => {
		const readme = readFileSync(join(root, "README.md"), "utf8")
		expect(readme).toContain("Guarding `main` without branch protection")
		expect(readme).toContain("git config core.hooksPath .githooks")
		expect(readme).toContain("not a substitute for branch protection")
		expect(readme).toContain("`--no-verify`")
		expect(readme).toContain("web UI")
		expect(readme).toContain("replaces `.git/hooks`")
	})
})
