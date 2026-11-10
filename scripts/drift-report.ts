import type { Finding } from "./drift-plan"

/** A run finds its issue by this open title prefix, so one repository never accumulates them. */
export const TITLE_PREFIX = "Tooling drift:"

export const ISSUE_TITLE = `${TITLE_PREFIX} the shared tooling has moved`

const PACKAGE = "@trajectonomics/tooling"

/** What the owner of the repository does about one finding. */
function remedy(finding: Finding): string {
	switch (finding.kind) {
		case "pin-behind":
			return `The pin \`${finding.pin}\` is behind the published \`${finding.latest}\`. Run \`bun add -d --exact ${PACKAGE}@${finding.latest}\`.`
		case "pin-not-exact":
			if (finding.reason !== undefined) {
				return `\`package.json\` could not be read: ${finding.reason}. This is a report, not a failed run: fix it when convenient.`
			}
			return finding.pin === null
				? `\`${PACKAGE}\` is not a dependency. Run \`bun add -d --exact ${PACKAGE}\`.`
				: `The pin \`${finding.pin}\` is a range, so two installs can resolve different versions. Run \`bun add -d --exact ${PACKAGE}\`.`
		case "preset-not-extended":
			return `\`biome.json\` extends no \`${PACKAGE}/configs/*\` preset. Add one to \`extends\`; the Presets table in the README says which.`
		case "local-rules":
			return `\`biome.json\` keeps rules the preset owns: ${finding.keys
				.map((key) => `\`${key}\``)
				.join(
					", ",
				)}. Delete them so the preset decides; if a rule is wrong for this repository, change it in \`${PACKAGE}\`.`
		case "config-unreadable":
			return `The Biome config could not be read: ${finding.reason}. This is a report, not a failed run: fix the file when convenient.`
	}
}

export function renderIssue(findings: readonly Finding[]): string {
	return [
		`The weekly drift check found ${findings.length} finding(s) against \`${PACKAGE}\`.`,
		"",
		...findings.map((finding) => `- ${remedy(finding)}`),
		"",
		"The next run rewrites this issue with whatever is left and closes it when nothing is stale.",
	].join("\n")
}
